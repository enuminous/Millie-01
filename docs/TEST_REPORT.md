# Millie-01 v0.1.0 — local software test report

**Execution date:** 2026-11-16  
**Software source:** initially published commit `d42737031fa19cab7f0e46926ad16e07814d8491`  
**Scope:** Offline Python simulation and control state machine; **not** hardware, MCU firmware or physical electrical testing.

## Commands executed

```bash
python -m unittest discover -s tests -v
python -m millie01 matrix --steps 100 --out /mnt/data/millie01-matrix-output.json
python -m compileall -q millie01 tests
node --check <extracted-inline-dashboard-script.js>
```

## Test suite

**20 tests: PASS, 0 failures, 0 errors** on local Python 3.13. This includes human-arm authorization, unauthorized and expired command suppression, obstacles, hardware E-stop state simulation, latch reset/re-arm, loss of range, heartbeat and motor power, bumper contact, brownout, tilt, reverse denial, nonfinite command denial, basic monitor math and deterministic replay.

Test discovery and execution do **not** certify a physical safety integrity level. Hardware E-stop interruption, watchdog, sensor performance, motor stalls, electrical supply and stopping distances are **UNTESTED**.

## Ten deterministic scenarios (100 ticks × 50 ms)

| Case | Final x (m) | First stopped at (s) | Signed-EWMA alert ticks | Interpretation |
|---|---:|---:|---:|---|
| clear | 0.400 | — | 0 | Simulated forward travel |
| obstacle | 0.012 | 0.15 | 0 | Front range limit stops before modeled obstacle |
| estop | 0.040 | 0.50 | 0 | Mode latches, motor power set false in world model |
| bumper | 0.040 | 0.50 | 0 | Latched software fault |
| range_dropout | 0.040 | 0.50 | 0 | Missing sensor fails stop |
| low_battery | 0.040 | 0.50 | 0 | Simulated voltage threshold fails stop |
| heartbeat_loss | 0.040 | 0.50 | 0 | Simulated old heartbeats fail stop |
| expired_command | 0.040 | 0.50 | 0 | Stale/expired velocity request fails stop |
| traction_loss | 0.130 | — | 72 | Exploratory diagnostic only, not calibrated |
| tilt | 0.040 | 0.50 | 0 | Simulated tilt threshold fails stop |

**Important corrective change during development:** Earlier monitor logic compared observed odometry to the *unapproved requested command*, causing spurious alerts after the safety controller had deliberately rejected motion. The published code instead compares odometry with the *last released motor demand*, eliminating those incorrect post-stop alerts. The table reflects the corrected version.

These tests use idealized, self-generated trajectories, thresholds and sensor behavior. They do not estimate real-world false alarm rates, human or pet safety, braking distance, perception reliability, or hardware watchdog effectiveness. The ESP/Pico motor actuation firmware and physical safety circuit are not implemented.

## Findings and next test gates

- Software safety gate for declared scenarios: **PASS** (simulated only).
- Research monitor can detect a large injected traction discrepancy: **OBSERVED IN SIMULATION ONLY**; no comparative superiority claim.
- HTML dashboard JavaScript syntax: **PASS** under local Node syntax check; browser runtime appearance not independently validated.
- Physical E-stop, MCU timeout, harness fuse/relay and motor driver electrical tests: **NOT RUN**.
- Independent reproducibility, hidden fault families and calibrated false-alarm budget: **NOT RUN**.

**Release classification: SIMULATOR RESEARCH BUILD. NO GO FOR PHYSICAL ACTUATION.**
