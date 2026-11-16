import unittest
from millie01.model import Config,Mode,SensorFrame,VelocityCommand
from millie01.safety import SafetySupervisor
from millie01.controller import Controller


def cmd(t,v=.08,age=0,expires=.25,authorized=True):
    return VelocityCommand(v,0.0,t-age,authorized,t-age+expires)

class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.cfg=Config()
        self.s=SafetySupervisor(self.cfg)
        self.f=SensorFrame(0,1.0)

    def test_stays_disarmed_without_human(self):
        self.assertFalse(self.s.arm(self.f,False))
        self.assertTrue(self.s.step(self.f,cmd(0)).stopped)

    def test_arm_with_human_and_bounded_motion(self):
        self.assertTrue(self.s.arm(self.f,True))
        a=self.s.step(self.f,cmd(0,v=100))
        self.assertEqual(a.reason,"bounded command")
        self.assertTrue(-1<=a.left<=1 and -1<=a.right<=1)

    def test_no_unauthorized_motion(self):
        self.s.arm(self.f,True)
        self.assertTrue(self.s.step(self.f,cmd(0,authorized=False)).stopped)
        self.assertTrue(self.s.step(self.f,None).stopped)

    def test_stale_and_future_commands_fail_stop(self):
        self.s.arm(self.f,True)
        self.assertTrue(self.s.step(SensorFrame(1,1.0),cmd(1,age=.5)).stopped)
        self.assertTrue(self.s.step(SensorFrame(1,1.0),cmd(1,age=-1)).stopped)

    def test_near_obstacle_fails_stop(self):
        self.s.arm(self.f,True)
        x=self.s.step(SensorFrame(.05,.30),cmd(.05))
        self.assertTrue(x.stopped)
        self.assertEqual(x.reason,"obstacle stop")

    def test_estop_latches_and_needs_two_human_actions(self):
        self.s.arm(self.f,True)
        self.assertEqual(self.s.step(SensorFrame(.05,1,estop_closed=False),cmd(.05)).mode,Mode.ESTOP_LATCHED)
        self.assertTrue(self.s.step(SensorFrame(.1,1),cmd(.1)).stopped)
        self.assertFalse(self.s.reset_latch(SensorFrame(.1,1),False))
        self.assertTrue(self.s.reset_latch(SensorFrame(.1,1),True))
        self.assertEqual(self.s.mode,Mode.DISARMED)
        self.assertTrue(self.s.step(SensorFrame(.15,1),cmd(.15)).stopped)
        self.assertTrue(self.s.arm(SensorFrame(.2,1),True))

    def test_faults_latch(self):
        self.s.arm(self.f,True)
        bad=[SensorFrame(.05,None),SensorFrame(.05,1,bumper_pressed=True),
             SensorFrame(.05,1,tilt_deg=20),SensorFrame(.05,1,battery_v=4.5),
             SensorFrame(.05,1,host_heartbeat_age_s=.4),
             SensorFrame(.05,1,mcu_heartbeat_age_s=.4),
             SensorFrame(.05,float('nan')),
             SensorFrame(.05,1,motor_power_present=False)]
        for f in bad:
            with self.subTest(f=f):
                s=SafetySupervisor(self.cfg);s.arm(self.f,True)
                x=s.step(f,cmd(.05))
                self.assertEqual(x.mode,Mode.FAULT_LATCHED)
                self.assertTrue(x.stopped)

    def test_no_reverse_without_rear_sensor(self):
        self.s.arm(self.f,True)
        self.assertTrue(self.s.step(self.f,cmd(0,-.05)).stopped)

    def test_nonfinite_cmd_rejected(self):
        self.s.arm(self.f,True)
        self.assertTrue(self.s.step(self.f,cmd(0,float('nan'))).stopped)

    def test_e_stop_latched_even_if_unarmed(self):
        self.assertEqual(self.s.step(SensorFrame(.05,1,estop_closed=False),cmd(.05)).mode,Mode.ESTOP_LATCHED)

    def test_coherence_cannot_override_safety(self):
        c=Controller(self.cfg)
        c.safety.arm(self.f,True)
        # Force a diagnostic alert via persistent invalid odometry; safety still wins.
        bad=SensorFrame(.05,.2,odom_linear_mps=-1.0)
        for k in range(30):
            r=c.tick(SensorFrame(.05+k*.05,.2,odom_linear_mps=-1.0),cmd(.05+k*.05))
            self.assertTrue(r.output.stopped)
        self.assertTrue(r.monitor.signed_alert)
