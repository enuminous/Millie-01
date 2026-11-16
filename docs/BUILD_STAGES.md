# Stage-gated construction plan

**The presence of code or a BOM is not approval to energize motors.** Each transition requires a human signoff and an evidence record. A failure keeps the current stage CLOSED.

| Stage | Build activity | Required evidence / STOP rule | Status |
|---|---|---|---|
| S0 — Offline simulation | Install Python, run all tests and scenario matrix | Exact commit, command line and all test logs archived | SOFTWARE IMPLEMENTED; review still open |
| S1 — Sensors bench | Pi 5/Pico 2 powered without motors; wire ToF, bumper, IMU; verify timestamps | Pull a sensor cable: raw signal invalid -> motor enable would remain disabled; measured latency | NOT STARTED |
| S2 — Power/E-stop bench | Independently rated 6 V motor power rail, fuse, physical NC E-stop and STBY defaults; wheels absent | Qualified wiring review; E-stop physically removes VMOT independent of Pi and MCU | NOT STARTED |
| S3 — Elevated-wheel motion | Select validated gearmotors, connect encoders and MCU firmware; chassis wheels elevated, guarded | E-stop, MCU reset, heartbeat lost, serial corruption, stuck PWM, battery fault, thermal and overcurrent tests | NOT STARTED |
| S4 — Confined floor motion | Human-held local arm, spotter, closed dry area, low speed; no reverse | Measured stopping distance and sensor coverage, humans/pets exclusion, friction/slip observations, no uncontrolled contact | NOT STARTED |
| S5 — Adversarial monitoring study | Freeze signed/abs EWMA/CUSUM thresholds on development-only traces; independent sealed fault tests | External custodian, preregistration commit+timestamp, report all fault families and false alarms | NOT STARTED |
| S6 — Future embodiment | Optional camera, speech, navigation, manipulator | Separate privacy, cybersecurity, thermal, collision and functional-safety review; no direct LLM-to-motor control | NOT AUTHORIZED |

## Operator rules

- Human present, local master switch reachable, physical STOP visible.
- Power OFF while changing mounts, connectors, software images or battery wiring.
- No unattended operation, no stairs/doorways, no outdoor roads or public environments.
- No live physical motion without signed S2 and S3 evidence; no user interface or AI command may override these gates.
- Keep an incident ledger including near misses and negative trials, not just successes.

## Minimal evidence files for each stage

Record date, location type (not private address), operator, reviewer, hardware part/serial list, firmware revision, supply voltage/current/fuse, git SHA, test steps, raw trace, PASS/FAIL/UNRESOLVED per requirement, signatures, residual risk, and rollback action.

**Release decision:** This repository is an S0 candidate; all S1–S6 evidence obligations remain OPEN.
