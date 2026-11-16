# Terrain lab verification — v0.2.0

2026-11-16 · Local execution and browser QA, not independent replication.

## Executed checks

- 14 JavaScript model tests passed with Node's built-in test runner.
- All 20 existing Python tests passed. Python and firmware source are unchanged.
- 100 calibration nulls + 500 evaluation runs completed in both Node and the browser UI.
- The algorithmically identical signed-EWMA control tied on every score and alarm.
- All 18 navigation missions completed all 3 goals with zero contacts.
- The browser-exported 18-row navigation JSON agreed with Node results to 1e-12; the largest discrepancy was approximately 6e-16 in an unrounded efficiency fraction. Reported time, distance, contacts, energy, and status matched.
- Browser interactions verified: manual keyboard drive, autonomous progress, pause/step, emergency-stop latch, separate reset/arm, injected dropout producing FAULT_LATCHED and UNRESOLVED, benchmark selection/execution, JSON download, and adding a custom map goal.
- The local preview rendered using the software 3D fallback. WebGL was unavailable in the test browser, so GPU rendering, device-specific GPU performance, and mobile touch behavior remain unverified. Source-level shader and module syntax checks do not replace GPU testing.

## Full detector evaluation

The target was a 5% whole-run calibration alarm budget. Independent-seed evaluation **did not uniformly meet that target**. No thresholds were retuned after these outcomes.

| Monitor | Null alarms / 100 | Positive detected / 100 | Negative detected / 100 | Variance detected / 100 | Oscillation detected / 100 |
|---|---:|---:|---:|---:|---:|
| EFMW-style signed | 8 | 97 | 97 | 96 | 5 |
| Absolute EWMA | 4 | 99 | 100 | 100 | 97 |
| Two-sided CUSUM | 11 | 97 | 98 | 94 | 10 |

Early alarms are counted as unsuccessful fault detections. Delays and all individual seed outcomes are in [`benchmarks/web-results-v0.2.0.json`](../benchmarks/web-results-v0.2.0.json).

This run demonstrates no EFMW-specific advantage: the matched signed-EWMA control is identical, absolute EWMA detects oscillation much more reliably, and all three detectors have limitations. These results apply to these synthetic settings, not physical robots or the broader EFMW research program.

## Navigation rows

| Terrain | Seed | Complete | Time (s) | Distance (m) | Contacts | Energy (Wh) |
|---|---:|---|---:|---:|---:|---:|
| flat | 101 | True | 41.00 | 120.656 | 0 | 0.4778 |
| flat | 203 | True | 38.80 | 116.825 | 0 | 0.4411 |
| flat | 307 | True | 38.80 | 116.825 | 0 | 0.4411 |
| flat | 409 | True | 41.35 | 120.923 | 0 | 0.4787 |
| flat | 503 | True | 45.95 | 134.948 | 0 | 0.5286 |
| flat | 607 | True | 42.45 | 124.470 | 0 | 0.4915 |
| highlands | 101 | True | 53.20 | 145.399 | 0 | 0.6072 |
| highlands | 203 | True | 40.30 | 118.360 | 0 | 0.4493 |
| highlands | 307 | True | 41.20 | 120.008 | 0 | 0.4638 |
| highlands | 409 | True | 49.25 | 142.032 | 0 | 0.5457 |
| highlands | 503 | True | 50.50 | 143.708 | 0 | 0.5750 |
| highlands | 607 | True | 45.10 | 129.229 | 0 | 0.5095 |
| ridge | 101 | True | 54.10 | 147.991 | 0 | 0.6094 |
| ridge | 203 | True | 40.65 | 119.353 | 0 | 0.4448 |
| ridge | 307 | True | 41.90 | 121.910 | 0 | 0.4649 |
| ridge | 409 | True | 50.55 | 146.040 | 0 | 0.5503 |
| ridge | 503 | True | 55.15 | 152.897 | 0 | 0.6243 |
| ridge | 607 | True | 46.00 | 131.645 | 0 | 0.5151 |

## Reproduce

```bash
node --test tests/web_sim.test.mjs
node benchmarks/run_web.mjs /tmp/millie01-web-benchmark.json
python -m unittest discover -s tests -v
```

CI runs the same model checks and full benchmark. GitHub Pages activation is left to the repository owner; this change does not deploy it.

## Source fingerprints

SHA-256 of the model and rendering source used for this release (the browser renderer is excluded from headless benchmark calculations):

- `assets/sim.mjs`: `b2a838d4a1b8ea235a4eded999aae4f34c2d20ba01c7bbb6ae01dc8e966fcbb1`
- `assets/scene.mjs`: `374d723c81b89e2678cd81a31a096ca60e9413c2199093dad497a66290e365cf`
- `assets/lab.mjs`: `d95904cda24a6240e0b640c191b5e8266defea5f3ec81b951d2992f9ecd16053`
- `benchmarks/web-results-v0.2.0.json`: `1b0ca9a36be79f544577edc8db70511ff4d5f57dc447871420a10cdf046ee96f`
