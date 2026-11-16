"""Deterministic low-speed rover simulator with injectable faults.

Educational kinematics only; not validated for floor traction, dynamics,
people detection, braking distance, tipping, thermal/current faults or latency.
"""
from dataclasses import asdict, dataclass
import math
from .controller import Controller
from .model import Config, MotorOutput, SensorFrame, VelocityCommand


@dataclass
class RoverWorld:
    x_m:float=0.0
    y_m:float=0.0
    heading_rad:float=0.0
    actual_speed_mps:float=0.0
    obstacle_x_m:float=1.2
    obstacle_y_m:float=0.0
    obstacle_radius_m:float=0.12
    chassis_radius_m:float=0.12
    motor_power_on:bool=True

    def forward_range(self)->float:
        dx=self.obstacle_x_m-self.x_m;dy=self.obstacle_y_m-self.y_m
        fwd=dx*math.cos(self.heading_rad)+dy*math.sin(self.heading_rad)
        lat=-dx*math.sin(self.heading_rad)+dy*math.cos(self.heading_rad)
        radius=self.obstacle_radius_m+self.chassis_radius_m
        if fwd<=0 or abs(lat)>=radius:
            return 5.0
        return max(0.001, fwd-math.sqrt(radius**2-lat**2))

    def physics(self, output:MotorOutput,cfg:Config,traction:float=1.0):
        # Normalized wheel demand to approximate speeds. Positive velocity only.
        if not self.motor_power_on:
            target_v=0.0;target_w=0.0
        else:
            vl=output.left*cfg.max_linear_mps*traction
            vr=output.right*cfg.max_linear_mps*traction
            target_v=(vl+vr)/2.0
            target_w=(vr-vl)/cfg.wheelbase_m
        self.actual_speed_mps=target_v
        self.heading_rad+=target_w*cfg.dt_s
        self.x_m+=target_v*math.cos(self.heading_rad)*cfg.dt_s
        self.y_m+=target_v*math.sin(self.heading_rad)*cfg.dt_s


def simulate(scenario:str="clear",steps:int=80,cfg:Config|None=None)->dict:
    if steps<1: raise ValueError("steps must be positive")
    valid={"clear","obstacle","estop","bumper","range_dropout","low_battery",
           "heartbeat_loss","expired_command","traction_loss","tilt"}
    if scenario not in valid:raise ValueError("unknown scenario: "+scenario)
    cfg=cfg or Config()
    ctrl=Controller(cfg)
    world=RoverWorld()
    if scenario=="obstacle":world.obstacle_x_m=0.60
    data=[]
    for i in range(steps):
        t=i*cfg.dt_s
        activated=i>=10
        sensor=SensorFrame(
            t_s=t,
            front_range_m=None if scenario=="range_dropout" and activated else world.forward_range(),
            bumper_pressed=scenario=="bumper" and activated,
            estop_closed=not (scenario=="estop" and activated),
            motor_power_present=not (scenario=="estop" and activated),
            battery_v=4.5 if scenario=="low_battery" and activated else 6.0,
            tilt_deg=19.0 if scenario=="tilt" and activated else 0.0,
            host_heartbeat_age_s=.5 if scenario=="heartbeat_loss" and activated else 0.0,
            mcu_heartbeat_age_s=.5 if scenario=="heartbeat_loss" and activated else 0.0,
            odom_linear_mps=world.actual_speed_mps)
        if i==0:
            ctrl.safety.arm(sensor,human_confirmed=True)
        issued=t if scenario!="expired_command" or not activated else 0.0
        command=VelocityCommand(linear_mps=.08,angular_radps=0.0,issued_at_s=issued,
                    expires_at_s=issued+.25,authorized=True,source="sim_operator")
        result=ctrl.tick(sensor,command)
        if scenario=="estop" and activated: world.motor_power_on=False
        world.physics(result.output,cfg,traction=.25 if scenario=="traction_loss" and activated else 1.0)
        data.append({"t_s":round(t,6),"x_m":round(world.x_m,6),
            "front_m":sensor.front_range_m,"command_v_mps":command.linear_mps,
            "observed_v_mps":sensor.odom_linear_mps,
            "mode":result.output.mode.value,"left":result.output.left,"right":result.output.right,
            "reason":result.output.reason,"efmw_signed_score":result.monitor.signed_score,
            "absolute_ewma_score":result.monitor.absolute_ewma_score,
            "cusum_score":result.monitor.cusum_score,
            "efmw_alert":result.monitor.signed_alert,
            "baseline_alert":result.monitor.absolute_alert,"cusum_alert":result.monitor.cusum_alert})
    return {"scenario":scenario,"cfg":asdict(cfg),"steps":steps,
            "final_pose":{"x_m":world.x_m,"y_m":world.y_m,"heading_rad":world.heading_rad},
            "trace":data,"status":"SIMULATED_ONLY"}
