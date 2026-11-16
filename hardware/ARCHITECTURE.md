# Physical architecture, power isolation and interface contracts

**NOT a construction-certified electrical schematic. Motor actuation is disabled in the released firmware. Have a qualified robotics/electrical practitioner review the actual circuit, fuse, connector/wire ratings, and enclosure before energizing.**

## Recommended starter topology

```
5 V/5 A certified Pi 5 supply --> Raspberry Pi 5 (Linux, UI, logging; not hard realtime)
                                              | USB / later serial protocol
                                              v
                                   Pico 2 motor control MCU (unimplemented)
                         I2C sensor(s) ------>|   wheel encoders (planned)
                         bumper + IMU ------->|   PWM outputs (disabled now)
                                              v
                                  TB6612FNG motor driver, STBY default LOW
                                     |                    |
6 V rated motor supply -> fuse -> NC E-stop / suitable rated contactor -> VMOT
                                     |                    |
                                  left motor         right motor

Motor-power E-stop must remain effective if Pi crashes, Pico locks or STBY is stuck HIGH.
```

**Motor and logic supply separation:** never power motors from the Pi 5's USB/GPIO rails. The Pi 5 uses its own compliant 5 V/5 A supply. The 6 V motor rail is protected by a fuse selected from actual wire gauge, source fault capacity, connector limits and motor current measurements. Provide a documented common signal ground where needed; do not join separate power sources incorrectly or permit backfeeding. Use keyed connectors, strain relief, enclosure and a master power switch.

**TB6612FNG carrier:** vendor states motor power 4.5–13.5 V, 1 A/channel continuous and 3 A/channel peak, with STBY pulled low by default. The suggested 6 V low-power motors have 0.36 A *extrapolated stall* current per motor, but the motor and gearbox can still be damaged by stalls, and chassis torque suitability is unproven. Use current limiting, thermal checks and software speed limits regardless of nominal stall figures.

## Wiring boundaries, NOT a completed netlist

| Connection | Design intent | Verification required |
|---|---|---|
| E-stop | Normally closed, mechanically latched, physically interrupts motor rail to VMOT via rated switching method | Measure motor rail actually reaches 0 V when pressed, including during MCU crash |
| Fuse | Upstream of branch and appropriately rated for conductor/fault current | Qualified electrical calculation and bench short/overcurrent review |
| Motor supply | Regulated 6 V low-current bench supply in initial elevated-wheel tests; future approved enclosed battery | Avoid improvised lithium cells/charger; verify power-up behavior |
| Pi supply | Manufacturer-recommended 5 V / 5 A USB-C source | No motor backfeed; brownout test |
| MCU ↔ motor driver | 3.3 V logic for IN1/IN2/PWM/STBY with STBY pulldown | Every reset/fault holds STBY LOW; exact Pico pins assigned after board review |
| MCU ↔ encoders | Appropriate voltage-level-compatible quadrature lines | Noise, debounce and cable strain checks |
| MCU ↔ sensors | ToF over I2C, bumpers over pulled-up digital inputs, IMU I2C | Missing readings fail STOP; no single front sensor guarantees all-around safety |
| Pi ↔ MCU | USB serial framed messages with command expiry and counters | Checksum/CRC, replay prevention, heartbeat watchdog and fail-stop latency |

## Power-up and reset hazards

- Default hardware state must be motor supply OFF and STBY LOW, including Pi and Pico boot/reset.
- E-stop releases only its physical latch; software re-arming requires two separate human actions (reset fault then arm).
- No automatic resume after lost heartbeat, E-stop release, or sensor reacquisition.
- Low-voltage and high-tilt values are illustrative simulator numbers; measure real sensor tolerances and battery rail behavior.
- Limit initial tests to elevated wheels with motor rail controlled by a physical cutoff; prohibit unsupervised travel.
- No motor power from the Pico's USB port or 3.3 V pins.

## Safety independence evidence still needed

A safety claim requires a witnessed test physically interrupting VMOT while the control host tries to command motion; separate tests with Pico frozen, unplugged or crashed; mechanical STOP accessibility; fixed contactor state under power loss; and documented operator training. The supplied simulator cannot provide these results.

## Vendor references

- [Raspberry Pi 5 product specifications](https://www.raspberrypi.com/products/raspberry-pi-5/)
- [Raspberry Pi Pico 2](https://www.raspberrypi.com/products/raspberry-pi-pico-2/)
- [Pololu TB6612FNG carrier](https://www.pololu.com/product/713)
- [Pololu 150:1 6 V low-power motor, encoder variant](https://www.pololu.com/product/5114/specs)
