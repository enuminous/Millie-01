"""Fail-stop SOFTWARE interlock in the simulator.

Crucial: production hardware MUST have a physically independent, normally-closed
E-stop motor-power interruption. This Python object cannot qualify as it.
"""
import math
from .model import Config, Mode, SensorFrame, VelocityCommand, MotorOutput


class SafetySupervisor:
    def __init__(self, config: Config):
        self.cfg = config
        self.mode = Mode.DISARMED
        self._reason = "not armed"
        self._last_time = None

    def _fault(self, frame: SensorFrame) -> str | None:
        if not frame.estop_closed:
            return "hardware E-stop open"
        if not frame.motor_power_present:
            return "motor power absent"
        vals = (frame.t_s, frame.battery_v, frame.tilt_deg,
                frame.host_heartbeat_age_s, frame.mcu_heartbeat_age_s,
                frame.odom_linear_mps)
        if not all(math.isfinite(v) for v in vals):
            return "invalid numeric sensor"
        if (frame.front_range_m is None or
                not math.isfinite(frame.front_range_m) or
                frame.front_range_m <= 0):
            return "range sensor invalid"
        if frame.bumper_pressed:
            return "bumper pressed"
        if abs(frame.tilt_deg) > self.cfg.max_tilt_deg:
            return "tilt limit"
        if not self.cfg.min_battery_v <= frame.battery_v <= self.cfg.max_battery_v:
            return "motor rail voltage outside bounds"
        if (frame.host_heartbeat_age_s > self.cfg.heartbeat_timeout_s or
                frame.mcu_heartbeat_age_s > self.cfg.heartbeat_timeout_s or
                frame.host_heartbeat_age_s < 0 or frame.mcu_heartbeat_age_s < 0):
            return "heartbeat timeout"
        if self._last_time is not None and frame.t_s < self._last_time:
            return "time moved backward"
        return None

    def arm(self, frame: SensorFrame, human_confirmed: bool) -> bool:
        if self.mode != Mode.DISARMED or not human_confirmed:
            return False
        problem = self._fault(frame)
        if problem:
            self._reason = problem
            return False
        self.mode = Mode.ARMED
        self._reason = "armed by human"
        self._last_time = frame.t_s
        return True

    def disarm(self) -> None:
        # Deliberate disarm is allowed in any state, but resetting a latch isn't.
        if self.mode == Mode.ARMED:
            self.mode = Mode.DISARMED
        self._reason = "operator disarm"

    def reset_latch(self, frame: SensorFrame, human_confirmed: bool) -> bool:
        if self.mode not in (Mode.ESTOP_LATCHED, Mode.FAULT_LATCHED):
            return False
        if not human_confirmed or self._fault(frame):
            return False
        self.mode = Mode.DISARMED  # explicit second arm action still required
        self._last_time = frame.t_s
        self._reason = "latch reset; re-arm required"
        return True

    def step(self, frame: SensorFrame, cmd: VelocityCommand | None) -> MotorOutput:
        # A hardware E-stop must latch even if the program had been disarmed.
        if not frame.estop_closed:
            self.mode = Mode.ESTOP_LATCHED
            self._reason = "hardware E-stop open"
        elif self.mode not in (Mode.ESTOP_LATCHED, Mode.FAULT_LATCHED):
            problem = self._fault(frame)
            if problem:
                self.mode = Mode.FAULT_LATCHED
                self._reason = problem
        self._last_time = frame.t_s
        if self.mode != Mode.ARMED:
            return MotorOutput(mode=self.mode, reason=self._reason)
        if cmd is None or not cmd.authorized:
            return MotorOutput(mode=self.mode, reason="no authorized command")
        if not all(math.isfinite(v) for v in (cmd.linear_mps,cmd.angular_radps,
                                             cmd.issued_at_s,cmd.expires_at_s)):
            return MotorOutput(mode=self.mode, reason="invalid command")
        if cmd.issued_at_s > frame.t_s + 1e-9:
            return MotorOutput(mode=self.mode, reason="future command")
        if (cmd.expires_at_s < frame.t_s or
                frame.t_s - cmd.issued_at_s > self.cfg.command_max_age_s):
            return MotorOutput(mode=self.mode, reason="stale command")
        if cmd.linear_mps < 0:
            return MotorOutput(mode=self.mode, reason="reverse requires rear sensing")
        if frame.front_range_m <= self.cfg.stop_distance_m:
            return MotorOutput(mode=self.mode, reason="obstacle stop")
        # Angular-only rotation would move the outer chassis; absent side sensing,
        # the demo only permits gentle turning with a forward-clear cone.
        v = max(0.0, min(self.cfg.max_linear_mps, cmd.linear_mps))
        w = max(-self.cfg.max_angular_radps,
                min(self.cfg.max_angular_radps, cmd.angular_radps))
        # No rear / side sensing: forbid movements that reverse either wheel.
        # A forward-facing range sensor is not sufficient for in-place turns.
        if abs(w)*self.cfg.wheelbase_m/2 > v:
            return MotorOutput(mode=self.mode, reason="turn needs side and rear sensing")
        lv = v - w*self.cfg.wheelbase_m/2
        rv = v + w*self.cfg.wheelbase_m/2
        # Duty mapping is abstract; firmware must supply calibrated speed control.
        demand = max(self.cfg.max_linear_mps, 1e-12)
        l = max(-1.0, min(1.0, lv/demand))
        r = max(-1.0, min(1.0, rv/demand))
        return MotorOutput(left=l, right=r, mode=self.mode, reason="bounded command")
