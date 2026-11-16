import unittest
from millie01.simulator import simulate
from millie01.coherence import CoherenceMonitor
from millie01.model import Config

class SimTests(unittest.TestCase):
    def test_clear_moves(self):
        x=simulate("clear",60)
        self.assertGreater(x["final_pose"]["x_m"],.0)
        self.assertEqual(x["status"],"SIMULATED_ONLY")

    def test_estop_keeps_stationary_after_fault(self):
        x=simulate("estop",60)["trace"]
        self.assertTrue(all(z["left"]==z["right"]==0 for z in x[10:]))
        self.assertTrue(all(z["mode"]=="ESTOP_LATCHED" for z in x[10:]))

    def test_fault_cases_stop_after_injection(self):
        for s in ("bumper","range_dropout","low_battery","heartbeat_loss","tilt"):
            with self.subTest(s=s):
                t=simulate(s,50)["trace"]
                self.assertTrue(all(z["left"]==z["right"]==0 for z in t[10:]))

    def test_expired_command(self):
        x=simulate("expired_command",60)["trace"]
        self.assertTrue(all(z["left"]==z["right"]==0 for z in x[16:]))

    def test_obstacle_stops_before_collision(self):
        result=simulate("obstacle",200)
        self.assertLess(result["final_pose"]["x_m"],.3)
        self.assertTrue(any(z["reason"]=="obstacle stop" for z in result["trace"]))

    def test_traction_fault_increases_signed_discrepancy(self):
        result=simulate("traction_loss",100)
        self.assertTrue(any(z["efmw_alert"] for z in result["trace"]))

    def test_coherence_is_standard_ewma_formula(self):
        c=CoherenceMonitor(Config())
        s=c.update(.1,.0)
        self.assertAlmostEqual(s.signed_state,-.003)
        self.assertAlmostEqual(s.absolute_ewma_score,.01)
        self.assertFalse(s.signed_alert)

    def test_reproducible(self):
        self.assertEqual(simulate("clear",20),simulate("clear",20))

    def test_unknown_scenario(self):
        with self.assertRaises(ValueError):simulate("alien_fault")
