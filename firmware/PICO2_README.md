# Pico 2 bench-only firmware

**This is not a motor driver.** `pico2_bench.py` is an executable MicroPython diagnostic to test serial communication and an on-board heartbeat LED. It does **not** configure PWM, STBY, motor direction, VMOT or GPIO drive outputs. No high-power device should be connected during this stage.

Deployment to a physical robot requires separately reviewed motor firmware with input validation, command expiry, sequence counters/CRC, monotonic watchdog, speed/current limits, encoder feedback and no automatic restart. A **physical normally closed E-stop disconnect** must independently interrupt the motor rail. Even a perfect software watchdog cannot replace it.

## Bench use

1. Load the supported MicroPython image on a Pico 2.
2. Save `pico2_bench.py` to the board (or adapt its entrypoint), with motors and motor supply disconnected.
3. Connect USB serial; program prints JSON heartbeat with `active_drive: false`.
4. Verify disconnecting the host does not energize any motor pins (there are none in this firmware).
5. Record serial logs and firmware hash for stage S1 evidence.

**Status:** Code provided but not tested on physical Pico 2 hardware.
