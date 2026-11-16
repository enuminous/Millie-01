import unittest
from run_sweep import flags, first_alert, windows, rank

class ThresholdSemantics(unittest.TestCase):
    def test_strict_equality_does_not_trigger(self):
        self.assertEqual(flags([1,1,1,2,2,2],1),[False,False,False,False,False,True])
    def test_nonconsecutive_crossings_reset_confirmation(self):
        self.assertIsNone(first_alert([2,2,0,2,2],1))
    def test_ties_and_misses_remain_distinct(self):
        self.assertEqual(rank([5,5,None]),('S=A','S=A | ND:C'))
        self.assertEqual(rank([None,None,None]),('NONE','ND:S,A,C'))
    def test_frontier_applies_to_nonmonotonic_scores(self):
        scores=[0,2,3,4,1,5,6,7,0]
        best=windows(scores)
        for h in [0,1,1.999,2,2.001,3,5,6,8]:
            actual=first_alert(scores,h)
            derived=next((i for i,v in enumerate(best) if v>h),None)
            self.assertEqual(actual,derived)

if __name__=='__main__':unittest.main()
