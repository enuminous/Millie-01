"""CLI entry point; simulation only, no motor interfaces."""
import argparse,json
from pathlib import Path
from .simulator import simulate


def main():
    parser=argparse.ArgumentParser(description="MILLIE-01 deterministic simulator (NO hardware output)")
    sub=parser.add_subparsers(dest="cmd",required=True)
    run=sub.add_parser("demo",help="Run one scenario and output JSON")
    run.add_argument("--scenario",default="clear")
    run.add_argument("--steps",type=int,default=80)
    run.add_argument("--out",type=Path)
    matrix=sub.add_parser("matrix",help="Run all declared fault scenarios")
    matrix.add_argument("--steps",type=int,default=80)
    matrix.add_argument("--out",type=Path)
    a=parser.parse_args()
    if a.cmd=="demo":result=simulate(a.scenario,a.steps)
    else:
        scenes=("clear","obstacle","estop","bumper","range_dropout","low_battery",
                "heartbeat_loss","expired_command","traction_loss","tilt")
        result={"status":"SIMULATED_ONLY","scenarios":{s:simulate(s,a.steps) for s in scenes}}
    data=json.dumps(result,indent=2,allow_nan=False)
    if a.out:
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_text(data+"\n",encoding="utf-8")
        print(str(a.out))
    else:print(data)

if __name__=="__main__":main()
