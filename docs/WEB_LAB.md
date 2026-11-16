# Millie-01 terrain lab v0.2.0

2026-11-16 · Monolithic LLC / Matthew Chenoweth Wright

## Run and publish

The root `index.html` plus `assets/lab.css`, `assets/lab.mjs`, `assets/sim.mjs`, and `assets/scene.mjs` form a buildless static application. Serve the repository with `python -m http.server 8000`, or enable GitHub Pages manually from `main` / root. No service, dependency download, external script, account, or API is needed. ES modules require HTTP(S). The original Python trace viewer remains at `replay.html`.

WebGL is the preferred renderer. A perspective-projected, depth-sorted Canvas renderer is a software fallback. It uses coarser terrain and lower pixel resolution, with approximate occlusion. Both render the same simulation state. Rendering FPS is not the physics sample rate; the fixed timestep is 0.05 seconds. On slow devices the simulator can run slower than wall time. Hidden tabs pause, preventing background time jumps.

## Operator controls

| Input | Action |
|---|---|
| W / up arrow | Forward |
| S / down arrow | Reverse |
| A / left arrow | Turn left |
| D / right arrow | Turn right |
| Space | Brake |
| X | Latch emergency stop |
| P | Pause / resume |
| C | Cycle chase, orbit, onboard, overhead |
| R | Restart the same world |
| Drag viewport / wheel | Orbit / zoom |
| Touch arrows | Drive and brake on small screens |
| Arm rover | Explicit simulated motion enable |
| Reset latch | Clear a recoverable latch into DISARMED; does not arm |
| Map edit selector + click | Add goal, add obstacle, or erase nearest object |

Changing the world or editing the map resets the run. Edits protect spawn and goal clearance. The editor retains at least one goal, allows at most 12 goals and 150 obstacles, and rejects steep goal locations. Autonomy can report no route; this is retained as a failure, not silently repaired. Map geometry and custom edits are included in exports.

## Simulation definitions

All positions and distances are in metres; velocities in m/s; internal angles in radians; time in seconds. The X/Z horizontal world is bounded to ±75 m. Heading zero is +Z. The terrain is a seeded sum of smooth sinusoidal height components, with amplitude controlled by relief. Terrain outside the boundary and distant peaks are scenery.

The rover has a circular collision envelope with radius 1.05 m; the visible six-wheel body is approximately 2.4 m long. The visible wheels sample the analytical heightfield separately. Chassis pitch and roll use the local terrain gradient. This is a ground-constrained differential-drive approximation: longitudinal acceleration is bounded, yaw velocity is filtered, traction and grade affect target speed, and circles prevent obstacle penetration. There is **no** rigid-body solver, airborne flight, roll-over, soil model, calibrated suspension, tire contact-patch physics, or contact-force solver. Decorative rocks and square barriers use conservative circular collision footprints; the outpost and distant mountains are scenery outside the normal mission route.

Virtual speed range is 0.5–6 m/s, default 4 m/s; default traction is 0.92. These dimensions and speeds are deliberately separate from the low-speed indoor physical design in `docs/ROBOT_SPEC.md`. The browser does not modify the Python safety configuration or firmware.

Synthetic range rays cover front, two forward obliques, sides, and rear, up to 22 m. Front/rear clearance limits requested speed using `sqrt(2 * 3 * max(0, clearance - 0.65))`. Collision projection is a separate final constraint. Maximum pitch/roll is 32 degrees before a fault latch. This simplified gate is not a validated stopping-distance or physical safety model.

Battery capacity is a modeled 120 Wh. Power is `12 + 9|v| + 4|Δv|/dt + 5|yaw rate|` watts. This is an illustrative energy proxy, not measured motor power. Distance includes changes in terrain elevation. Contacts are counted at most once per second of repeated contact.

Autonomy uses a known full map, 2.5 m A* grid, inflated obstacle footprints, gradient exclusion, and no diagonal corner cutting. The heading controller tracks waypoints and slows for turns. Goal radius is 3 m; goals are sequential. All goals complete → DISARMED. This is not SLAM, visual perception, reinforcement learning, or an EFMW navigation algorithm.

## Fault and state semantics

- E-stop latches immediately, zeros speed/yaw, and disables autonomy.
- Dropout, heartbeat loss, and low battery rail latch FAULT_LATCHED. Dropout produces unresolved monitor evidence rather than a zero residual.
- Clearing an injected fault does not release its latch. Reset → DISARMED → Arm are separate actions.
- Traction loss multiplies traction by 0.22; encoder bias adds 0.25 m/s; variance adds uniform noise in ±0.9 m/s.
- The three research monitors are advisory and never grant motion or bypass safety. A high live monitor score is not itself a safety fault.
- Keyboard state clears on loss of window focus, visibility, pause, tab changes, and restart. Text/form input does not operate the rover.

## EFMW mapping and formulas

Ported from the repository's `millie01/coherence.py` at source baseline `bc35015e90a466812c07742d0ad4558e1e4259d6`:

`r_t = observed_velocity_t - bounded_requested_velocity_t`.

1. Signed memory: `M_t = .97 M_(t-1) + .03 r_t`; score `|M_t|`.
2. Absolute EWMA: `A_t = .90 A_(t-1) + .10 |r_t|`.
3. CUSUM: `C+_t = max(0,C+_(t-1)+r_t-.005)`, `C-_t = max(0,C-_(t-1)-r_t-.005)`; score `max(C+,C-)`.

An alarm needs three consecutive threshold exceedances. Invalid samples preserve monitor memory but clear the consecutive evidence counter. Live illustrative thresholds are 0.023, 0.030, and 0.12, matching the Python defaults. CUSUM is an accumulated discrete score, not a physical instantaneous velocity. The plot displays signed memory, absolute EWMA, and instantaneous residual; CUSUM is shown numerically to avoid a misleading shared scale.

The browser compares current post-step measurement to the applied bounded request. The Python demo compares its sensor frame to the request in its own tick timing. The recurrences match; the trajectories and observation timing are not claimed to be interchangeable. Live acceleration, drag, and grade produce nominal residuals. Live alerts are therefore **not calibrated fault diagnoses**.

The EFMW label means preserved signed residual evidence and an auditable event trail in this implementation. It is mathematically ordinary signed EWMA. This lab does not claim to implement every EFMW equation, prove an EFMW-specific effect, or validate an embodiment theory.

## M01-WEB-001: detector comparison protocol

This versioned, open, exploratory protocol is separate from the proposed externally sealed MON-M01 experiment. Definitions were fixed before the recorded run; there is no external custodian or confirmatory preregistration.

| Parameter | Frozen value |
|---|---|
| PRNG | Mulberry32-style deterministic 32-bit generator in `sim.mjs` |
| Noise | Box–Muller Gaussian, nominal σ=0.025 m/s |
| Samples | 400 at 20 Hz (20 simulated seconds) |
| Change onset | Index 160 (8 seconds) |
| Calibration seeds | 10000–10099, 100 nominal runs |
| Evaluation seeds | 30000+family_index×1000+replicate_index |
| Evaluation families | null, positive drift, negative drift, variance, oscillation |
| Drift | ±0.07 m/s after onset |
| Variance | σ=0.14 m/s after onset |
| Oscillation | 0.12 sin((index−160)π/2) m/s after onset |
| Evaluation size | Quick: 24/family; full: 100/family |
| Alarm | Three consecutive scores strictly above threshold |
| Threshold calibration | For each null, max over the minimum of each 3-sample score window; empirical 95th percentile over runs |
| Target | 5% whole-run calibration false alarms; not a guarantee on evaluation |

All detectors see the identical generated trace. Calibration and evaluation seeds do not overlap. The matched signed-EWMA arm repeats the exact same algorithm and is checked for exact score/alert equality. It is an identity control, **not** an independently implemented or independent-review arm.

Null false alarms count any alarm over the full 20-second run. For fault families, pre-onset alarms disqualify the run from a successful detection. Post-onset first detection latency is measured from onset. Conditional median delay excludes misses and must be read with coverage. Penalized delay includes every run and assigns the full 12-second observation window to misses and pre-onset alarms. All trials are retained; no tuning occurs after evaluation. Reported figures are descriptive Monte Carlo counts, with no significance or superiority claim.

The raw JSON includes fixed protocol values, thresholds, family, seed, first alarm index, first post-onset alarm index, identity-control result, and summaries. CSV contains the summaries. It does not contain hidden independent test data. Regenerate common traces with the published generator and seed.

## Navigation benchmark

Flat, highlands, and ridge × seeds 101, 203, 307, 409, 503, 607 = 18 missions. Default rover settings, three goals per mission, 240-second timeout, 20 Hz. Measures completion, goals reached, time, path distance, contacts, and model energy. All missions are recorded even when incomplete. Efficiency is straight-line lower-bound length / traveled distance, capped at 1, and is not an optimality guarantee. Benchmarks create separate Simulation instances and cannot disturb a live run.

## Reproduction and export

```bash
node --test tests/web_sim.test.mjs
node benchmarks/run_web.mjs /tmp/millie01-web-benchmark.json
```

The same `sim.mjs` supplies browser behavior and headless benchmarks. No browser dependency is required for Node tests. World/config/event/telemetry JSON exports have schema `millie01.terrain.trace.v1`. Live physics and monitors run at 20 Hz; exported telemetry is sampled at 5 Hz and retains at most 18,000 samples (one hour). The export is an audit/visualization trace, not a complete command stream for exact manual-run replay. Deterministic recreation requires the same seed, world, options, and input sequence. Benchmark exports include their full deterministic reproduction definitions.

## Evidence boundaries

- Demonstrated by executable tests: repeatability under fixed input, formula recurrences, simulated interlocks, obstacle/boundary constraints, and mission completion for recorded seeds.
- Supported but incomplete: interactive operation in the tested browser; other devices and GPU drivers may differ.
- Unresolved: physical transfer, genuine suspension/soil dynamics, sensor uncertainty realism, externally calibrated detector budgets, independent replication, and useful EFMW-specific incremental benefit.

This application makes no motor, serial, GPIO, actuator, or external AI call.
