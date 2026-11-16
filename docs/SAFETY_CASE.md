# Preliminary safety case and hazard ledger

**Not a certified safety assessment. No physical test performed.** The Python software interlock helps simulate failure responses but cannot be relied on as the sole protection for a real robot. Independent mechanical/electrical safety must dominate all AI outputs.

## Hazard / controls / evidence

| ID | Hazard | Intended barrier | Evidence to close |
|---|---|---|---|
| H01 | Uncommanded motion during boot/crash | NC E-stop physically cuts motor power; STBY default low; MCU watchdog | Witnessed powered tests during Pi/Pico reboot and unexpected disconnect |
| H02 | Collision with person, pet, fragile object | Supervised enclosed test area; bumper; sensor validation; speed cap | Stopping envelope measured under poor reflectivity and sensor dropout; independent observers |
| H03 | Reverse travel into unseen obstacle | No reverse command in v0.1.0; no wheel-reversing turns | Source unit tests + actual motor direction checks after hardware review |
| H04 | Power short, overheating, battery fire | Fused motor branch, certified sources, separate Pi rail, qualified enclosure | Wiring current/fault and thermal tests by competent reviewer |
| H05 | Host sends stale/unauthorized command | Expiry, explicit arm, bounded commands, future hardware CRC and watchdog | Simulation unit tests; physical communication tests OPEN |
| H06 | Stale or invented sensors | Missing/NaN/heartbeat failure -> latched fault | Unit tests; sensor-disconnect tests OPEN |
| H07 | Fault-monitor false positive/negative | Diagnostic monitor separated from independent motion permissions | Comparison protocol and held-out fault family tests OPEN |
| H08 | Internet/AI compromise | No network actuator interface; future signed local authorization | Threat model and penetration test OPEN |
| H09 | Privacy breach | No camera/mic in baseline, no upload code | Future consent, retention and network audit OPEN |
| H10 | Misleading EFMW superiority claim | Side-by-side signed EWMA, abs EWMA and CUSUM; status labels | Strong external replication and ablations OPEN |

## Safety state machine

- **DISARMED** initial; zero motor command. Only explicit human arm on valid sensor frame transitions to ARMED.
- **ARMED** can issue a bounded forward-only request if all sensors valid, range clear, command fresh and authorized. Otherwise output zero.
- **ESTOP_LATCHED** when E-stop loop opens; never resumes automatically when switch closes.
- **FAULT_LATCHED** on bumper, missing sensor, missing motor rail, brownout, excessive tilt, bad heartbeat or clock rollback.
- Separate deliberate human RESET moves latch to DISARMED, then separate ARM is required. Physical circuit cannot be reset by Python.

## Known insufficiencies

- Simulation assumes ideal range projection; missed detections, wall glancing, turning side sweep and occlusion are unmodeled.
- Obstacles may appear suddenly; speed/distance limits are not physically validated.
- Hardware cutoff, fuse, watchdog and power supply circuit have not been built or tested.
- USB/Pico motor control and dynamic closed-loop speed regulation have not been implemented.
- Coherence detector threshold is illustrative; no live false-alarm budget or fault-specific sensitivity is known.
- Unit tests cannot assert a safety integrity level or compliance with a safety standard.

## Controls before field testing

Obtain independent electrical/mechanical review, validate emergency power cut under all credible host faults, perform risk assessment for the intended environment and applicable laws/standards, establish incident response and maintenance ownership, and secure human signoffs.
