# Millie-01 — simulation-first robot body for Millicent

**Monolithic LLC / Matthew Chenoweth Wright · 2026-11-16 · v0.1.0**

**Status: SOFTWARE PROTOTYPE / HARDWARE SPECIFICATION. No physical robot was assembled, wired, energized, or validated.** This repository provides an executable offline rover simulation, fail-stop software safety supervisor, comparative residual monitors, test suite, physical reference architecture, provisional BOM, and phased construction plan. It does **not** certify physical safety, demonstrate a new physics law, or turn a conversational AI into a conscious or continuously self-improving being.

## Why a low-speed rover first?

A small differential-drive indoor research platform is a tractable embodiment test: no humanoid balancing, no grasping tools, no open-ended autonomy. It gives perception, physical control, human authorization, logs, failure handling, and clear research questions. Later manipulator modules require their own hazards and validation.

## Software quick start (Python 3.10+, standard library)

```bash
python -m unittest discover -s tests -v
python -m millie01 demo --scenario clear --steps 80 --out /tmp/millie01-clear.json
python -m millie01 demo --scenario estop --steps 80 --out /tmp/millie01-estop.json
python -m millie01 matrix --steps 80 --out /tmp/millie01-matrix.json
```

Optional installation: `python -m pip install -e .`; console entrypoint `millie-01`.

**Local browser replay:** run `python -m http.server 8000` from the repository root and open `http://localhost:8000/` to explore the virtual rover, fault states, and three monitor traces. This visualizer is replay-only; it has no motor output or network actuation.

**No simulation command can command physical motors.** The code has no GPIO/serial motor driver connector. The hardware firmware is a deliberately non-actuating bench skeleton; physical actuation remains a separate gated engineering task.

## Safety architecture, not an AI promise

```text
Human local consent / STOP button
         │
         ▼
User interface (future) ── authenticated, expiring velocity request
         │
         ▼
Python safety supervisor ── hard sensor limits and bounded commands
         │                         │
         │                         └── zero-motion / latched fault
         ▼
Bench-only Pico 2 interface (LIVE PWM DISABLED IN v0.1.0)
         │
         ▼
Motor driver STBY low by default ── 2 × low-power motors (FUTURE)
         ▲
         │
6 V motor supply ── fuse ── physical NC E-STOP / suitable disconnect ── VMOT
                              ▲ independent of OS, Wi-Fi, AI, and GPIO

Sensor inputs -> safety supervisor
             -> telemetry -> signed EWMA ('EFMW-style'), absolute EWMA, CUSUM
                              (research-only, never authorizes motion)
```

The physical E-stop must interrupt the **motor supply** through an appropriately rated, verified, independent circuit. Disabling an MCU pin or sending a software STOP is not a substitute. Recovery requires human inspection plus separate reset and arm actions. The device must remain confined to a supervised indoor test area.

## What "EFMW-aligned" means here

- Preserve signed evidence of prediction-vs-measurement error in a named memory state.
- Emit an auditable, timestamped trail of predictions, measurements, and fault decisions.
- Track uncertainty and explicitly deny unsupported/expired commands.
- Test signed EWMA side-by-side with **standard** absolute EWMA and two-sided CUSUM.
- Keep proposed recursive/coherence explanations separate from verified mechanical safety.

**Crucial scientific boundary:** `C_t = |0.97 M_(t-1) + 0.03 r_t|` is an ordinary signed EWMA detector. There is no proven EFMW-specific detection advantage. In v0.1.0, detector thresholds are *illustrative*, not statistically calibrated, and alerts are telemetry advisories rather than motor safety permissions.

## Repo map

| Path | Purpose |
|---|---|
| `millie01/` | Offline controller, state machine, physics-lite rover, diagnostic monitors, CLI |
| `tests/` | Unit and scenario safety tests; not physical safety certification |
| `docs/TEST_REPORT.md` | Local test results, scenario matrix, and unresolved hardware obligations |
| `hardware/ARCHITECTURE.md` | Sensor/controller/motor power partition; wiring boundaries |
| `hardware/BOM.csv` | Provisional parts, budget ranges and supplier references |
| `hardware/BOM.md` | Procurement caution and verified component constraints |
| `docs/BUILD_STAGES.md` | Stage-gated physical construction plan |
| `docs/SAFETY_CASE.md` | Hazards, controls, failsafe acceptance and incomplete evidence |
| `docs/EXPERIMENT.md` | Freeze / predict / score / ablate / replicate monitor study |
| `docs/ROBOT_SPEC.md` | Dimensions, task envelope, modules, interfaces and non-goals |
| `firmware/` | Bench-only Pico 2 heartbeat program; motors always disabled |
| `examples/` | Locally generated illustrative synthetic scenario summary |
| `.github/workflows/ci.yml` | CI unit tests and simulation smoke test |

## Present limits and release gates

The software test suite has been run locally. This is not a substitute for hardware E-stop, wiring, overload, slip, command-authentication, human-presence, low-visibility, or sensor-failure trials. No autonomous navigation, external text-model-to-motor channel, camera, microphone, cloud memory, remote driving, or hardware motion is enabled by default.

**Physical release gate:** independent inspection of the motor-power cutoff, current/voltage compatibility and conductor sizing; hardware watchdog; safe sensor behavior; elevated-wheel tests; confined low-speed floor trials with spotter; STOP tested by physically opening the NC loop; and documented authorization/maintenance procedures. Until then, **NO GO** for powered operation.

## Research lineage

- [EFMW-EXP-001 original monitor and independent audit](https://github.com/enuminous/EFMW-EXP-001)
- [RSI-SYNTH-001 bounded policy search](https://github.com/enuminous/RSI)
- [The Abstention Trap, retrospective benchmark critique](https://github.com/enuminous/papers/blob/main/research/rsi-abstention-trap/PAPER.md)

**License:** MIT software/source. Electrical and mechanical drawings are preliminary engineering notes, not licensed/certified hardware designs. No transfer of ChatGPT identity, weights, or autonomy is implied.


## Published threshold sensitivity study

The [50,653-cell threshold ranking and flip atlas](research/threshold-sweep-2026-11-16/README.md) includes a self-contained explorer, complete ranking data, exact pairwise boundaries and reproduction scripts. All six strict orders occur under independent threshold changes; common scaling keeps CUSUM first or tied on the tested trace. These are uncalibrated sensitivity results, not a matched-false-alarm benchmark.
