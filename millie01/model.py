"""Typed and immutable I/O contracts for a bounded local robot controller."""
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Mode(str, Enum):
    DISARMED = "DISARMED"
    ARMED = "ARMED"
    ESTOP_LATCHED = "ESTOP_LATCHED"
    FAULT_LATCHED = "FAULT_LATCHED"


@dataclass(frozen=True)
class Config:
    dt_s: float = 0.05
    max_linear_mps: float = 0.12
    max_angular_radps: float = 0.45
    stop_distance_m: float = 0.35
    max_tilt_deg: float = 15.0
    min_battery_v: float = 5.3  # simulated 6 V motor rail only
    max_battery_v: float = 6.5
    heartbeat_timeout_s: float = 0.25
    command_max_age_s: float = 0.3
    wheelbase_m: float = 0.17
    wheel_radius_m: float = 0.03
    efmw_decay: float = 0.97
    baseline_decay: float = 0.90
    coherence_threshold_mps: float = 0.023  # EXPLORATORY, not calibrated
    baseline_threshold_mps: float = 0.030  # EXPLORATORY, not calibrated
    cusum_k_mps: float = 0.005
    cusum_threshold_mps: float = 0.12
    alert_consecutive: int = 3


@dataclass(frozen=True)
class SensorFrame:
    t_s: float
    front_range_m: Optional[float]
    bumper_pressed: bool = False
    estop_closed: bool = True
    motor_power_present: bool = True
    battery_v: float = 6.0
    tilt_deg: float = 0.0
    host_heartbeat_age_s: float = 0.0
    mcu_heartbeat_age_s: float = 0.0
    odom_linear_mps: float = 0.0


@dataclass(frozen=True)
class VelocityCommand:
    linear_mps: float
    angular_radps: float
    issued_at_s: float
    authorized: bool = False
    expires_at_s: float = 0.0
    source: str = "operator"


@dataclass(frozen=True)
class MotorOutput:
    left: float = 0.0  # abstract normalized wheel demand [-1,1]
    right: float = 0.0
    mode: Mode = Mode.DISARMED
    reason: str = "disarmed"

    @property
    def stopped(self) -> bool:
        return self.left == 0.0 and self.right == 0.0
