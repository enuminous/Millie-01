# Provisional bill of materials and procurement controls

**This is a reference shortlist, not a purchase order or verified system assembly.** Source-specific published prices are labeled; other ranges are planning estimates in USD and must be requoted before buying. No payment or purchase was made.

## Candidate parts

- [Raspberry Pi 5 4GB](https://www.raspberrypi.com/products/raspberry-pi-5/), **$110 manufacturer list price** in the 2026 product brief; additional power supply, case, SD and cooling required.
- [Pico 2 with headers](https://www.raspberrypi.com/products/raspberry-pi-pico-2/), a 3.3 V logic microcontroller, approximately **$6** in one observed retail listing; hardware watchdog design still open.
- [Pololu TB6612FNG carrier](https://www.pololu.com/product/713): **$4.95** published single-unit price; recommended 4.5–13.5 V motor input, 1 A continuous per channel, 3 A peak. Driver can overheat and its safe operating current depends on real conditions.
- [Pololu 150:1 LP 6 V motor + encoder](https://www.pololu.com/product/5114/specs): **$29.95 each**, 0.36 A extrapolated stall current; 90 RPM nominal no load at 6 V. Using these on a 0.5 kg prototype requires torque-margin and traction testing. No gearbox should be held stalled.
- [Pololu VL53 sensor family](https://www.pololu.com/category/306): front ranging prototype; sensor performance in sunlight/reflective surfaces must be tested. A single sensor is not a safe human/pet detector.
- Hardware safety hardware, chassis and 6 V source: prices are **broad allowances**, not manufacturer-verified selections. Qualified electrical review needed before wiring motor power.

## Planning envelope

Summing the **planning low/high ranges** in [BOM.csv](BOM.csv) yields approximately **$314–$571**, before taxes, shipping, tools, customization, spares, labor and test equipment. This is not a fixed project cost. Cost may rise if a motor, chassis or power topology fails engineering review; a Pi 5 may be overkill for early rover sensing.

## Purchasing order

1. Prototype software and bench sensors first; use a Pi/Pico already owned if possible.
2. Decide chassis mass and confirm torque, wheel radius, encoder compatibility, axle mounts and stall limits.
3. Pick source protection and a **rated independent physical motor-power cutoff** with qualified reviewer.
4. Only then purchase/assemble motor supply, H-bridge and motors.
5. Never substitute an arbitrary power bank/battery or DIY charger for an approved, enclosed, compatible power system.

## Source fidelity

Price references are time-sensitive. Values labeled `planning_only` are estimates rather than observed market quotes. Verify supplier documentation, local availability, shipping and tax at purchase time. Nothing in the BOM certifies product suitability for a safety-related system.
