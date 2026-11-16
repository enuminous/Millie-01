# MicroPython Pico 2 bench diagnostic only. NEVER energizes motor pins.
# Hardware specific LED availability may vary; adjust per Pico 2 revision.
import time
try:
    import json
except ImportError:
    import ujson as json
try:
    from machine import Pin
    led = Pin("LED", Pin.OUT)
except Exception:
    led = None

while True:
    if led is not None:
        led.toggle()
    print(json.dumps({"product":"Millie-01", "mode":"BENCH_ONLY",
                      "active_drive":False,"monotonic_ms":time.ticks_ms()}))
    time.sleep_ms(500)
