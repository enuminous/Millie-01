"""Reproduce MILLIE-THRESHOLD-001 with Python 3.10+, stdlib only.

Loads the frozen simulator from its Git object, never from a moving working tree.
All emitted timings are controller timestamps. ND is finite-horizon censoring.
"""
from __future__ import annotations
import csv
import gzip
import hashlib
import io
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
from collections import Counter

HERE = Path(__file__).resolve().parent
MONITORS = ('S', 'A', 'C')
SCORES = {'S': 'efmw_signed_score', 'A': 'absolute_ewma_score', 'C': 'cusum_score'}
ALERTS = {'S': 'efmw_alert', 'A': 'baseline_alert', 'C': 'cusum_alert'}
FIELDS = {'S': 'coherence_threshold_mps', 'A': 'baseline_threshold_mps', 'C': 'cusum_threshold_mps'}


def flags(scores, threshold, consecutive=3):
    run = 0
    result = []
    for score in scores:
        run = run + 1 if score > threshold else 0
        result.append(run >= consecutive)
    return result


def first_alert(scores, threshold, consecutive=3):
    return next((i for i, alert in enumerate(flags(scores, threshold, consecutive)) if alert), None)


def windows(scores, consecutive=3):
    """Running maximum of the smallest score in each confirmation window."""
    result, best = [], 0.0
    for i in range(len(scores)):
        if i >= consecutive - 1:
            best = max(best, min(scores[i-consecutive+1:i+1]))
        result.append(best)
    return result


def rank(indices):
    groups = {}
    missing = []
    for name, index in zip(MONITORS, indices):
        if index is None:
            missing.append(name)
        else:
            groups.setdefault(index, []).append(name)
    finite = ['='.join(groups[i]) for i in sorted(groups)]
    order = ' > '.join(finite)
    if missing:
        order += (' | ' if order else '') + 'ND:' + ','.join(missing)
    return (finite[0] if finite else 'NONE'), order


def write_csv(path, rows, fields=None):
    if fields is None:
        fields = list(rows[0])
    with path.open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_gzip_csv(path, rows, fields):
    with path.open('wb') as raw:
        with gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as gz:
            with io.TextIOWrapper(gz, encoding='utf-8', newline='') as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows)


def main():
    protocol_bytes = (HERE / 'protocol.json').read_bytes()
    protocol = json.loads(protocol_bytes)
    repo = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], cwd=HERE, text=True).strip())
    pin = protocol['source_commit']
    source_paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', pin, '--', 'millie01/'], cwd=repo, text=True).splitlines()
    source_hashes = {}
    with tempfile.TemporaryDirectory(prefix='millie-frozen-source-') as temp:
        for name in source_paths:
            if not name.endswith('.py'):
                continue
            content = subprocess.check_output(['git', 'show', pin + ':' + name], cwd=repo)
            source_hashes[name] = hashlib.sha256(content).hexdigest()
            dest = Path(temp) / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)
        sys.path.insert(0, temp)
        from millie01.simulator import simulate
        from millie01.model import Config
        from dataclasses import replace
        scene_names = [protocol['ranked_scenario'], *protocol['other_scenarios']]
        scenes = {name: simulate(name, protocol['steps']) for name in scene_names}
        dt = protocol['dt_s']
        injection = protocol['fault_injection_s']
        g = protocol['threshold_grid']
        ks = list(range(g['k_min'], g['k_max'] + 1))
        factors = [2 ** (k/4) for k in ks]
        n = len(ks)
        base = g['base_thresholds']
        trace = scenes['traction_loss']['trace']
        score = {m: [t[SCORES[m]] for t in trace] for m in MONITORS}
        lookup = {m: [first_alert(score[m], base[m]*factor) for factor in factors] for m in MONITORS}
        bands = {m: windows(score[m]) for m in MONITORS}

        # Independent analytic recurrence check for the deterministic step fault.
        for i, step in enumerate(trace):
            count = max(0, i - 10)
            expected = {'S': .06*(1-.97**count), 'A': .06*(1-.9**count), 'C': .055*count}
            for m in MONITORS:
                assert math.isclose(step[SCORES[m]], expected[m], rel_tol=1e-12, abs_tol=1e-13)
        direct = 0
        for scene, result in scenes.items():
            for m in MONITORS:
                for factor in factors:
                    threshold = base[m] * factor
                    actual = simulate(scene, protocol['steps'], replace(Config(), **{FIELDS[m]: threshold}))['trace']
                    expected = flags([s[SCORES[m]] for s in result['trace']], threshold)
                    assert [s[ALERTS[m]] for s in actual] == expected
                    assert all(a['x_m'] == b['x_m'] and a['left'] == b['left'] and a['right'] == b['right'] for a,b in zip(actual,result['trace']))
                    direct += 1
        combined = list(itertools.product((0,n-1), repeat=3)) + [(ks.index(0),)*3]
        for cell in combined:
            cfg = replace(Config(), **{FIELDS[m]: base[m]*factors[cell[j]] for j,m in enumerate(MONITORS)})
            actual = simulate('traction_loss', protocol['steps'], cfg)['trace']
            for j,m in enumerate(MONITORS):
                assert [s[ALERTS[m]] for s in actual] == flags(score[m],base[m]*factors[cell[j]])

    # Thresholds do not affect score trajectories or control: the Cartesian grid
    # is exactly factored into three validated 37-entry lookup vectors.
    def row_for(cell):
        indices = [lookup[m][cell[j]] for j,m in enumerate(MONITORS)]
        winner, ranking = rank(indices)
        row = {'cell_id': (cell[0]*n+cell[1])*n+cell[2]}
        for j,m in enumerate(MONITORS):
            row[m+'_k'] = ks[cell[j]]
            row[m+'_multiplier'] = factors[cell[j]]
            row[m+'_threshold'] = base[m]*factors[cell[j]]
            row[m+'_first_alert_s'] = None if indices[j] is None else trace[indices[j]]['t_s']
            row[m+'_latency_s'] = None if indices[j] is None else round(trace[indices[j]]['t_s']-injection,6)
        row.update(winner=winner, ranking=ranking)
        return row

    cells = list(itertools.product(range(n), repeat=3))
    rows = [row_for(cell) for cell in cells]
    write_gzip_csv(HERE/'grid-ranking.csv.gz',rows,list(rows[0]))
    winners, rankings = Counter(r['winner'] for r in rows), Counter(r['ranking'] for r in rows)
    diagonal = [row_for((j,j,j)) for j in range(n)]
    write_csv(HERE/'common-multiplier.csv',diagonal)
    curves = []
    for m in MONITORS:
        for j,f in enumerate(factors):
            i = lookup[m][j]
            curves.append({'monitor':m,'k':ks[j],'multiplier':f,'threshold':base[m]*f,'first_alert_s':None if i is None else trace[i]['t_s'],'latency_s':None if i is None else round(trace[i]['t_s']-injection,6),'status':'ND' if i is None else 'DETECTED'})
    write_csv(HERE/'threshold-curves.csv',curves)
    threshold_bands = []
    for m in MONITORS:
        previous = 0.0
        for i,bound in enumerate(bands[m]):
            if bound > previous:
                threshold_bands.append({'monitor':m,'lower_inclusive':previous,'upper_exclusive':bound,'first_alert_s':trace[i]['t_s'],'latency_s':round(trace[i]['t_s']-injection,6)})
                previous = bound
        threshold_bands.append({'monitor':m,'lower_inclusive':previous,'upper_exclusive':None,'first_alert_s':None,'latency_s':None})
    write_csv(HERE/'threshold-bands.csv',threshold_bands)

    frontiers = []
    for varied, fixed in itertools.permutations(MONITORS,2):
        for j,factor in enumerate(factors):
            i = lookup[fixed][j]
            frontiers.append({'varied_monitor':varied,'fixed_monitor':fixed,'fixed_multiplier':factor,'fixed_threshold':base[fixed]*factor,'fixed_first_alert_s':None if i is None else trace[i]['t_s'],
                'varied_faster_if_threshold_below':bands[varied][-1] if i is None else (bands[varied][i-1] if i else 0.),
                'varied_tie_lower_inclusive':None if i is None else (bands[varied][i-1] if i else 0.),
                'varied_tie_upper_exclusive':None if i is None else bands[varied][i],
                'note':'Fixed monitor ND; varied detects below boundary, otherwise both ND (not a detection tie)' if i is None else 'Below lower: faster; [lower,upper): same timestamp; at/above upper: later or ND'})
    write_csv(HERE/'pairwise-frontiers.csv',frontiers)

    edges, winner_changes, strict_reversals = [], 0, 0
    for cell in cells:
        row = rows[(cell[0]*n+cell[1])*n+cell[2]]
        for axis,m in enumerate(MONITORS):
            if cell[axis] == n-1:
                continue
            other = list(cell)
            other[axis] += 1
            dest = rows[(other[0]*n+other[1])*n+other[2]]
            if row['ranking'] != dest['ranking']:
                changed = row['winner'] != dest['winner']
                strict = changed and row['winner'] in MONITORS and dest['winner'] in MONITORS
                winner_changes += changed
                strict_reversals += strict
                edges.append({'from_cell_id':row['cell_id'],'to_cell_id':dest['cell_id'],'varied_monitor':m,'from_multiplier':factors[cell[axis]],'to_multiplier':factors[other[axis]],'from_winner':row['winner'],'to_winner':dest['winner'],'winner_set_changes':changed,'strict_single_winner_reversal':strict,'from_ranking':row['ranking'],'to_ranking':dest['ranking']})
    write_gzip_csv(HERE/'adjacent-flips.csv.gz',edges,list(edges[0]))

    examples = {}
    for row in rows:
        if 'ND:' in row['ranking'] or '=' in row['ranking']:
            continue
        distance = sum(abs(row[m+'_k']) for m in MONITORS)
        old = examples.get(row['ranking'])
        if old is None or distance < old['distance_quarter_octaves']:
            examples[row['ranking']] = dict(row,distance_quarter_octaves=distance)
    default = row_for((ks.index(0),)*3)
    prealerts = {m:sum(any(flags(score[m][:10],base[m]*f)) for f in factors) for m in MONITORS}
    controls = []
    for scene in protocol['other_scenarios']:
        tr = scenes[scene]['trace']
        controls.append({'scenario':scene,'monitor_threshold_settings_with_any_alert':sum(any(flags([s[SCORES[m]] for s in tr],base[m]*f)) for m in MONITORS for f in factors),'settings_checked':3*n})
    source_records = []
    for name,result in scenes.items():
        previous_demand = 0.
        for s in result['trace']:
            source_records.append(dict(s,scenario=name,previous_released_velocity_mps=previous_demand,residual_mps=s['observed_v_mps']-previous_demand))
            previous_demand = (s['left']+s['right'])/2*result['cfg']['max_linear_mps']
    write_csv(HERE/'source-traces.csv',source_records)
    summary = {
        'study':protocol['study'],'source_commit':pin,'protocol_sha256':hashlib.sha256(protocol_bytes).hexdigest(),'combinations':len(rows),
        'winner_counts':dict(sorted(winners.items())),'ranking_counts':dict(sorted(rankings.items())),
        'missed_threshold_levels':{m:sum(x is None for x in lookup[m]) for m in MONITORS},
        'default':default,'common_multiplier_winner_counts':dict(Counter(r['winner'] for r in diagonal)),
        'strict_order_examples':list(examples.values()),'example_selection':'Post-hoc nearest-default example for each strict complete order, minimizing sum(abs(k)); lexicographic loop breaks ties.',
        'adjacent_edges_checked':3*(n-1)*n*n,'ranking_change_edges':len(edges),'winner_set_change_edges':winner_changes,'strict_single_winner_reversal_edges':strict_reversals,
        'pre_injection_alert_thresholds':prealerts,'controls':controls,
        'first_traction_residual_s':0.55,'last_observation_s':3.95,'physics_horizon_s':4.0,
        'evidence_status':'DEMONSTRATED: numerical threshold sensitivity of this fixed synthetic trace. UNRESOLVED: matched-false-alarm ranking, generalization, physical behavior, EFMW-specific advantage.',
        'verification':{'single_monitor_direct_simulations':direct,'combined_direct_simulations':len(combined),'analytical_step_response_samples':len(trace)*3,'passed':True},
        'source_file_sha256':source_hashes,
    }
    (HERE/'summary.json').write_text(json.dumps(summary,indent=2,allow_nan=False)+'\n')
    compact = {'factors':factors,'ks':ks,'base':base,'first':{m:[None if i is None else trace[i]['t_s'] for i in lookup[m]] for m in MONITORS},'summary':summary}
    (HERE/'explorer-data.json').write_text(json.dumps(compact,indent=2,allow_nan=False)+'\n')
    template = HERE/'explorer-template.html'
    if template.exists():
        (HERE/'index.html').write_text(template.read_text().replace('/*__DATA__*/',json.dumps(compact,allow_nan=False)))
    print(json.dumps({key:summary[key] for key in ['source_commit','combinations','winner_counts','common_multiplier_winner_counts','missed_threshold_levels','ranking_change_edges','winner_set_change_edges','strict_single_winner_reversal_edges','verification']},indent=2))
    print('Strict order examples:',json.dumps(summary['strict_order_examples'],indent=2))


if __name__ == '__main__':
    main()
