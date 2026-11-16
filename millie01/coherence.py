"""Research-only residual monitors; NO EFMW-specific superiority claimed.

The 'EFMW-style' signed state is mathematically an ordinary signed EWMA.
This module never authorizes movement or bypasses the independent safety gate.
"""
from dataclasses import dataclass
from .model import Config


@dataclass(frozen=True)
class MonitorSample:
    signed_state: float
    signed_score: float
    absolute_ewma_score: float
    cusum_score: float
    signed_alert: bool
    absolute_alert: bool
    cusum_alert: bool
    residual_mps: float


class CoherenceMonitor:
    def __init__(self, cfg: Config):
        self.cfg=cfg
        self.signed=0.0
        self.absolute=0.0
        self.cplus=0.0
        self.cminus=0.0
        self.signed_run=0
        self.absolute_run=0
        self.cusum_run=0

    def update(self, commanded_mps:float, observed_mps:float)->MonitorSample:
        # Bounded, signed discrepancy between measured and requested longitudinal
        # velocity. The mismatch may reflect traction, motor saturation, etc.
        residual=observed_mps-commanded_mps
        self.signed=self.cfg.efmw_decay*self.signed+(1-self.cfg.efmw_decay)*residual
        self.absolute=self.cfg.baseline_decay*self.absolute+(1-self.cfg.baseline_decay)*abs(residual)
        self.cplus=max(0.0,self.cplus+residual-self.cfg.cusum_k_mps)
        self.cminus=max(0.0,self.cminus-residual-self.cfg.cusum_k_mps)
        e=abs(self.signed)
        c=max(self.cplus,self.cminus)
        self.signed_run=self.signed_run+1 if e>self.cfg.coherence_threshold_mps else 0
        self.absolute_run=self.absolute_run+1 if self.absolute>self.cfg.baseline_threshold_mps else 0
        self.cusum_run=self.cusum_run+1 if c>self.cfg.cusum_threshold_mps else 0
        n=self.cfg.alert_consecutive
        return MonitorSample(self.signed,e,self.absolute,c,
                             self.signed_run>=n,self.absolute_run>=n,
                             self.cusum_run>=n,residual)
