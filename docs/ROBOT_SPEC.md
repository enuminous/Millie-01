# Millie-01 Robot System Specification — v0.1.0

**Status: SIMULATION IMPLEMENTED; PHYSICAL PLATFORM NOT BUILT.**

## Mission

Develop a supervised indoor robotic body research platform to experiment with evidence-bounded perception, safe actuation, explicit memory and comparative anomaly monitors. An AI assistant may be a **higher-level, non-safety-critical dialogue component in a future release**; it is not the motor controller.

## Envelope (provisional target, not measured physical performance)

| Item | Spec / research target |
|---|---|
| Geometry | Two-wheel differential drive with rear caster; low center of mass; guard wheels |
| Footprint | Target 230 × 180 mm, maximum 120 mm tall before later sensor mast; mechanical design TBC |
| Total mass | Prefer below 0.5 kg with selected low-power gearmotors; verify available torque/traction before procurement |
| Area | Controlled dry indoor flat floor, no stairs/traffic/children/pets; supervised only |
| Forward travel | 0–0.12 m/s simulated cap; field cap must be validated lower if necessary |
| Angular rate | ±0.45 rad/s simulation cap; reverse wheel/spin prohibited without rear/side sensing |
| Clearance | Simulation software stops if front obstacle at or below 0.35 m; actual stopping envelope unverified |
| Control interval | 50 ms deterministic simulated timestep; physical scheduling jitter not established |
| Power | Pi 5 separately powered from suitable 5 V / 5 A supply; motor rail separately fused, nominal 6 V |
| Operating mode | Human-supervised, locally armed, default DISARMED; E-stop latches until manual reset |
| Optional sensors | Front ToF, bumpers, IMU, motor encoders; camera/microphone not in v0.1.0 baseline |
| Telemetry | Timestamp, commanded/observed velocity, range, safety state, reason, three monitor scores |

## Traceable requirements

- R-001: No motor command before a local human arm action — *software unit test*.
- R-002: Stop on E-stop, bumper, lost range, lost heartbeat, tilt/voltage anomaly — *software tests only; physical validation open*.
- R-003: Latched E-stop or fault does not resume movement on recovered sensor alone — *software test*.
- R-004: No old, future, unauthorized, nonfinite or reverse command actuates — *software test*.
- R-005: Forward motion limited to configured maximum; wheel-reversing turns denied — *software test*.
- R-006: Fault monitors remain separate from hard safety authorization — *software test*.
- R-007: Independent physical NC E-stop interrupts motor power without Pi/Pico/AI cooperation — *design requirement, NOT implemented*.
- R-008: Physical MCU disables motor standby on command timeout, watchdog fault and invalid packet — *design requirement, NOT implemented*.
- R-009: Every released firmware/hardware revision must have signed/hashed build provenance and test log — *future requirement*.
- R-010: Unverified EFMW/RSI ideas cannot grant physical permissions — *architecture rule*.

## Layer model

1. **Human safety:** physical power cutoff, spotter, fixed area boundaries.
2. **Hardware control:** MCU watchdog, encoder feedback, motor current limiting and STBY; all unimplemented in v0.1.0.
3. **Python safety gate:** fail-stop policy with explicit authorization and age limits; simulator implemented.
4. **World model:** synthetic range, pose and odometry; real sensor adapters future.
5. **Research monitors:** signed EWMA, absolute EWMA, two-sided CUSUM; telemetry only.
6. **Reasoning/dialogue:** future optional assistant with human-approved goal proposals; never direct PWM or E-stop override.

## Data provenance and privacy

No cameras, microphones, cloud storage or hidden telemetry in the current code. Future recording requires visible indicator, local consent, retention settings and deletion policy. Do not record bystanders by default.

## Unresolved

Motor mount stiffness, selected caster, payload/torque margin, power topology certification, braking distance on varied floors, ToF accuracy under sunlight/reflective materials, MCU real-time implementation, watchdog timing, battery and charging compliance, thermal protection, and independent physical safety review.
