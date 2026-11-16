import fs from 'node:fs';
import {calibrate,benchmarkCase,summarizeBenchmark,navigationCase,BENCH_PROTOCOL,VERSION} from '../assets/sim.mjs';
const out=process.argv[2]||'/tmp/millie01-web-benchmark.json',thresholds=calibrate(),rows=[];
for(const [f,family] of ['null','positive','negative','variance','oscillation'].entries())for(let i=0;i<100;i++)rows.push(benchmarkCase(BENCH_PROTOCOL.evaluationSeed+f*1000+i,family,thresholds));
const navigation=[];for(const preset of ['flat','highlands','ridge'])for(const seed of [101,203,307,409,503,607])navigation.push(navigationCase(seed,preset));
const report={version:VERSION,monitor:summarizeBenchmark(rows,thresholds,100),navigation};fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,monitorRuns:rows.length,matchedSignedIdentical:report.monitor.matchedSignedIdentical,missionsComplete:navigation.filter(x=>x.complete).length,missions:navigation.length,contacts:navigation.reduce((s,x)=>s+x.collisions,0),incomplete:navigation.filter(x=>!x.complete)},null,2));
