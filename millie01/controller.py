"""Simulation controller: monitor observations, but hard safety wins."""
from dataclasses import dataclass
from .model import Config, MotorOutput, SensorFrame, VelocityCommand
from .safety import SafetySupervisor
from .coherence import CoherenceMonitor, MonitorSample


@dataclass(frozen=True)
class TickResult:
    output: MotorOutput
    monitor: MonitorSample


class Controller:
    def __init__(self, cfg: Config|None=None):
        self.cfg=cfg or Config()
        self.safety=SafetySupervisor(self.cfg)
        self.monitor=CoherenceMonitor(self.cfg)
        self._previous_released_v_mps=0.0

    def tick(self, frame:SensorFrame, command:VelocityCommand|None)->TickResult:
        # Odometry describes motion resulting from the *previous* tick's motor
        # output, not the current unapproved request. Otherwise a safety STOP
        # fabricates an apparent model fault by treating rejected motion as real.
        sample=self.monitor.update(self._previous_released_v_mps,
                                   frame.odom_linear_mps)
        output=self.safety.step(frame,command)
        self._previous_released_v_mps=(output.left+output.right)/2*self.cfg.max_linear_mps
        return TickResult(output,sample)
