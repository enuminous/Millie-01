// Millie-01 terrain lab v0.2.0 — deterministic, browser/Node shared model.
export const VERSION = '0.2.0';
export const DT = 0.05;
export const LIMIT = 75;
export const RADIUS = 1.05;
export const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export const angle = x => Math.atan2(Math.sin(x),Math.cos(x));
export const dist = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function rng(seed) { let s=seed>>>0; return () => {s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; }
export function terrain(x,z,world) {
  if(world.preset==='flat') return 0;
  const p=(world.seed%1000)*.013, a=world.relief;
  return a*(3.8*Math.sin(x*.042+p)*Math.cos(z*.037-p)+2.2*Math.sin((x+z)*.07+p)+.65*Math.sin(x*.16-z*.13));
}
export function gradient(x,z,w) {return {x:(terrain(x+.2,z,w)-terrain(x-.2,z,w))/.4,z:(terrain(x,z+.2,w)-terrain(x,z-.2,w))/.4};}
export function makeWorld(seed=888,preset='highlands',relief=preset==='ridge'?1.6:1) {
  const random=rng(seed),w={seed:seed>>>0,preset,relief,obstacles:[],goals:[],revision:0};
  w.start={x:-44,z:-36};
  w.goals=[{x:-18,z:-12,name:'Survey station'},{x:17,z:14,name:'Ridge relay'},{x:45,z:40,name:'Return beacon'}];
  const count=preset==='slalom'?85:preset==='flat'?28:58;
  for(let i=0;i<count;i++) {
    const o={x:(random()-.5)*138,z:(random()-.5)*138,r:1+random()*2.3,h:1+random()*3,kind:random()>.78?'barrier':'rock',rotation:random()*6.28};
    if([w.start,...w.goals].every(p=>dist(p,o)>o.r+6))w.obstacles.push(o);
  }
  return w;
}
export const MONITOR_DEFAULTS=Object.freeze({signed:.023,absolute:.030,cusum:.12});
export class Monitor {
  constructor(thresholds=MONITOR_DEFAULTS){this.thresholds={...thresholds};this.m=0;this.a=0;this.cp=0;this.cm=0;this.runs=[0,0,0];this.samples=0;this.invalid=0;this.last=null;}
  update(residual) {
    if(!Number.isFinite(residual)){this.invalid++;this.runs=[0,0,0];return this.last={valid:false,residual:null,signed:this.m,scores:[Math.abs(this.m),this.a,Math.max(this.cp,this.cm)],alerts:[false,false,false],status:'UNRESOLVED'};}
    this.samples++;this.m=.97*this.m+.03*residual;this.a=.90*this.a+.10*Math.abs(residual);
    this.cp=Math.max(0,this.cp+residual-.005);this.cm=Math.max(0,this.cm-residual-.005);
    const scores=[Math.abs(this.m),this.a,Math.max(this.cp,this.cm)],t=Object.values(this.thresholds);
    this.runs=this.runs.map((n,i)=>scores[i]>t[i]?n+1:0);
    return this.last={valid:true,residual,signed:this.m,scores,alerts:this.runs.map(n=>n>=3),status:'OBSERVED'};
  }
}
function rayRange(s,w,direction) {
  const dx=Math.sin(direction),dz=Math.cos(direction);let nearest=22;
  for(const o of w.obstacles){const x=o.x-s.x,z=o.z-s.z,f=x*dx+z*dz,l=x*dz-z*dx,r=o.r+RADIUS;if(f>0&&Math.abs(l)<r)nearest=Math.min(nearest,Math.max(0,f-Math.sqrt(r*r-l*l)));}
  for(const [p,d] of [[s.x,dx],[s.z,dz]])if(Math.abs(d)>1e-7)nearest=Math.min(nearest,((d>0?LIMIT:-LIMIT)-p)/d-RADIUS);
  return Math.max(0,nearest);
}
export function route(world,start,goal) {
  // A* on a 2.5 m occupancy grid; circular footprints inflated for clearance.
  const cell=2.5,n=59,lo=-72.5,id=(x,z)=>z*n+x;
  const coord=p=>clamp(Math.round((p-lo)/cell),0,n-1), sx=coord(start.x),sz=coord(start.z),gx=coord(goal.x),gz=coord(goal.z),target=id(gx,gz),origin=id(sx,sz);
  const blocked=new Uint8Array(n*n);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const px=lo+x*cell,pz=lo+z*cell,g=gradient(px,pz,world);
    if(Math.hypot(g.x,g.z)>.56||world.obstacles.some(o=>Math.hypot(px-o.x,pz-o.z)<o.r+RADIUS+1.7))blocked[id(x,z)]=1;
  }
  blocked[origin]=0;if(blocked[target])return [];
  const gs=new Float64Array(n*n).fill(Infinity),parent=new Int32Array(n*n).fill(-1),closed=new Uint8Array(n*n),open=[origin];gs[origin]=0;
  const h=i=>Math.hypot(i%n-gx,Math.floor(i/n)-gz);
  while(open.length){let best=0;for(let j=1;j<open.length;j++)if(gs[open[j]]+h(open[j])<gs[open[best]]+h(open[best]))best=j;
    const cur=open.splice(best,1)[0];if(closed[cur])continue;closed[cur]=1;
    if(cur===target){let rev=[{...goal}];for(let k=cur;k!==origin&&k>=0;k=parent[k])rev.push({x:lo+(k%n)*cell,z:lo+Math.floor(k/n)*cell});return rev.reverse();}
    const x=cur%n,z=Math.floor(cur/n);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
      const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=n||nz>=n)continue;const next=id(nx,nz);
      if(blocked[next]||closed[next]||(dx&&dz&&(blocked[id(x+dx,z)]||blocked[id(x,z+dz)])))continue;
      const cost=gs[cur]+Math.hypot(dx,dz);if(cost<gs[next]){gs[next]=cost;parent[next]=cur;open.push(next);}
    }
  }
  return [];
}
export class Simulation {
  constructor(world=makeWorld(),options={}) {
    this.world=world;this.options={speed:4,traction:.92,noise:.018,...options};this.random=rng(world.seed^0xa12d);this.monitor=new Monitor();this.fault='none';this.faultAt=Infinity;
    this.state={x:world.start.x,z:world.start.z,y:terrain(world.start.x,world.start.z,world),heading:.74,v:0,w:0,pitch:0,roll:0,t:0,battery:100,energy:0,distance:0,collisions:0,goalIndex:0,mode:'DISARMED',reason:'Arm the rover to drive',slip:0};
    this.path=[];this.pathGoal=-1;this.auto=false;this.estop=false;this.trace=[];this.events=[];this.cooldown=0;this.lastSample=null;this.wheelAngle=0;
  }
  event(message){this.events.unshift({t:this.state.t,message});if(this.events.length>100)this.events.pop();}
  arm(){if(this.state.mode==='DISARMED'&&!this.estop&&!this.hardFault()){this.state.mode='ARMED';this.state.reason='Ready';this.event('Drive armed');return true;}return false;}
  disarm(){if(this.state.mode==='ARMED')this.state.mode='DISARMED';this.state.v=0;this.state.w=0;this.auto=false;this.event('Drive disarmed');}
  stop(){this.estop=true;this.state.mode='ESTOP_LATCHED';this.state.reason='Emergency stop';this.state.v=0;this.state.w=0;this.auto=false;this.event('E-stop latched');}
  resetLatch(){this.estop=false;if(this.hardFault()){this.state.reason='Clear the injected fault first';return false;}this.state.mode='DISARMED';this.state.v=0;this.state.w=0;this.state.reason='Latch reset · arm separately';this.event('Latch reset');return true;}
  hardFault(){return ['dropout','heartbeat','battery'].includes(this.fault)&&this.state.t>=this.faultAt;}
  inject(fault){this.fault=fault;this.faultAt=this.state.t;this.event(fault==='none'?'Fault cleared':'Injected '+fault);}
  setAuto(value){this.auto=value;this.pathGoal=-1;this.event(value?'Autonomous mission selected':'Manual drive selected');}
  ranges(){const s=this.state;return [0,.5,-.5,Math.PI/2,-Math.PI/2,Math.PI].map(a=>rayRange(s,this.world,s.heading+a));}
  autopilot() {
    const s=this.state,g=this.world.goals[s.goalIndex];if(!g)return {throttle:0,steer:0};
    if(this.pathGoal!==s.goalIndex){this.path=route(this.world,s,g);this.pathGoal=s.goalIndex;this.event(this.path.length?'Route planned to '+g.name:'No route · edit terrain or goal');}
    while(this.path.length>1&&dist(s,this.path[0])<1.7)this.path.shift();
    if(!this.path.length){s.reason='No route';return {throttle:0,steer:0};}
    const target=this.path[0],err=angle(Math.atan2(target.x-s.x,target.z-s.z)-s.heading);
    return {throttle:Math.abs(err)>1.1?0:clamp(1-Math.abs(err)*.65,.15,.85),steer:clamp(err*1.6,-1,1)};
  }
  step(input={},dt=DT) {
    if(dt!==DT)throw Error('Use the fixed 0.05 s physics step');
    const s=this.state,active=this.fault!=='none'&&s.t>=this.faultAt;
    if(this.hardFault()&&s.mode!=='ESTOP_LATCHED'){s.mode='FAULT_LATCHED';s.reason=this.fault+' fault';}
    if(s.battery<=1&&s.mode==='ARMED'){s.mode='FAULT_LATCHED';s.reason='Battery depleted';}
    const grad=gradient(s.x,s.z,this.world),sn=Math.sin(s.heading),cs=Math.cos(s.heading);
    s.pitch=Math.atan(grad.x*sn+grad.z*cs);s.roll=Math.atan(grad.x*cs-grad.z*sn);
    if(Math.max(Math.abs(s.pitch),Math.abs(s.roll))>32*Math.PI/180&&s.mode==='ARMED'){s.mode='FAULT_LATCHED';s.reason='Tilt limit exceeded';}
    let cmd=this.auto?this.autopilot():input;
    let request=clamp(Number(cmd.throttle)||0,-1,1)*this.options.speed,turn=clamp(Number(cmd.steer)||0,-1,1)*1.05;
    const ranges=this.ranges();
    if(s.mode!=='ARMED'||this.estop){request=0;turn=0;s.v=0;s.w=0;}
    else {
      const clearance=request>=0?Math.min(...ranges.slice(0,3)):ranges[5];
      // Ground-truth synthetic range, both front and rear; never a hardware safety claim.
      const safeSpeed=Math.sqrt(Math.max(0,2*3*(clearance-.65)));
      if(Math.abs(request)>safeSpeed){request=Math.sign(request)*safeSpeed;s.reason='Range limiter';}
      else s.reason=this.auto?(this.path.length?'Navigating':'No route'):'Manual drive';
    }
    const oldV=s.v,traction=clamp(this.options.traction*(active&&this.fault==='slip'?.22:1),.05,1);
    const slope=Math.sin(s.pitch),target=request*traction*(1-.28*Math.abs(slope));
    if(s.mode==='ARMED') {
      const brake=Boolean(input.brake);s.v+=clamp((brake?0:target)-s.v,-(brake?8:3)*dt,(brake?8:2)*dt);
      if(Math.abs(request)<.01)s.v*=.85;
      s.w+=(turn-s.w)*.22;
      if(brake)s.w*=.65;
    }
    s.heading=angle(s.heading+s.w*dt);
    const nx=s.x+Math.sin(s.heading)*s.v*dt,nz=s.z+Math.cos(s.heading)*s.v*dt;
    const collision=Math.abs(nx)>LIMIT-RADIUS||Math.abs(nz)>LIMIT-RADIUS||this.world.obstacles.some(o=>Math.hypot(nx-o.x,nz-o.z)<o.r+RADIUS);
    if(collision){s.v=0;s.reason='Contact · motion blocked';if(this.cooldown<=0){s.collisions++;this.event('Collision contact');this.cooldown=1;}}
    else {s.distance+=Math.hypot(nx-s.x,nz-s.z,terrain(nx,nz,this.world)-s.y);s.x=nx;s.z=nz;}
    this.cooldown-=dt;s.y=terrain(s.x,s.z,this.world);s.t+=dt;
    s.slip=Math.abs(request)>.1?clamp(1-Math.abs(s.v/request),0,1):0;
    const watts=12+Math.abs(s.v)*9+Math.abs(s.v-oldV)/dt*4+Math.abs(s.w)*5;s.energy+=watts*dt/3600;s.battery=Math.max(0,100-s.energy/120*100);
    this.wheelAngle+=s.v*dt/.43;
    const noise=(this.random()+this.random()+this.random()-1.5)*this.options.noise;
    let observed=s.v+noise;if(active&&this.fault==='bias')observed+=.25;if(active&&this.fault==='variance')observed+=(this.random()-.5)*1.8;if(active&&this.fault==='dropout')observed=NaN;
    const mon=this.monitor.update(observed-request);
    const goal=this.world.goals[s.goalIndex];if(s.mode==='ARMED'&&goal&&dist(s,goal)<3){s.goalIndex++;this.event('Reached '+goal.name);if(s.goalIndex===this.world.goals.length){this.auto=false;s.v=0;s.w=0;s.mode='DISARMED';s.reason='Mission complete';this.event('All goals complete');}}
    this.lastSample={t:+s.t.toFixed(3),x:s.x,y:s.y,z:s.z,heading:s.heading,requested:request,observed:Number.isFinite(observed)?observed:null,speed:s.v,pitch:s.pitch,roll:s.roll,range:ranges[0],battery:s.battery,energy:s.energy,mode:s.mode,goal:s.goalIndex,fault:active?this.fault:'none',...mon};
    // 5 Hz export trace; physics and monitors remain 20 Hz.
    if(Math.round(s.t/DT)%4===0){this.trace.push(this.lastSample);if(this.trace.length>18000)this.trace.shift();}
    return this.lastSample;
  }
  export(){return {schema:'millie01.terrain.trace.v1',version:VERSION,status:'SIMULATED_ONLY',model:'heightfield-constrained differential drive; no rigid-body solver',dt:DT,traceHz:5,world:this.world,options:this.options,monitor:{decay:.97,absoluteDecay:.90,k:.005,consecutive:3,thresholds:this.monitor.thresholds},state:{...this.state},events:[...this.events].reverse(),trace:this.trace};}
}
export const BENCH_PROTOCOL=Object.freeze({id:'M01-WEB-001',version:1,steps:400,onset:160,dt:DT,sigma:.025,calibrationRuns:100,calibrationSeed:10000,evaluationSeed:30000,targetRunFalseAlarm:.05,consecutive:3,drift:.07,varianceSigma:.14,oscillation:.12});
const normal=random=>Math.sqrt(-2*Math.log(Math.max(1e-12,random())))*Math.cos(2*Math.PI*random());
function traceFor(seed,family){const random=rng(seed),p=BENCH_PROTOCOL,out=[];for(let i=0;i<p.steps;i++){let r=normal(random)*p.sigma;if(i>=p.onset){if(family==='positive')r+=p.drift;if(family==='negative')r-=p.drift;if(family==='variance')r=normal(random)*p.varianceSigma;if(family==='oscillation')r+=p.oscillation*Math.sin((i-p.onset)*Math.PI/2);}out.push(r);}return out;}
const percentile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(p*xs.length)-1)];
export function calibrate(){
  const maxima=[[],[],[]],p=BENCH_PROTOCOL;
  for(let j=0;j<p.calibrationRuns;j++){
    const m=new Monitor(),window=[],max=[0,0,0];for(const r of traceFor(p.calibrationSeed+j,'null')){const v=m.update(r);window.push(v.scores);if(window.length>3)window.shift();if(window.length===3)for(let k=0;k<3;k++)max[k]=Math.max(max[k],Math.min(...window.map(s=>s[k])));}
    max.forEach((v,k)=>maxima[k].push(v));
  }
  return Object.fromEntries(['signed','absolute','cusum'].map((n,k)=>[n,percentile(maxima[k],.95)]));
}
export function benchmarkCase(seed,family,thresholds){
  const monitors=[new Monitor(thresholds),new Monitor(thresholds)],first=[null,null,null],post=[null,null,null];let identical=true;
  traceFor(seed,family).forEach((r,i)=>{const a=monitors[0].update(r),b=monitors[1].update(r);if(a.scores[0]!==b.scores[0]||a.alerts[0]!==b.alerts[0])identical=false;a.alerts.forEach((v,k)=>{if(v&&first[k]===null)first[k]=i;if(v&&i>=BENCH_PROTOCOL.onset&&post[k]===null)post[k]=i;});});
  return {seed,family,first,post,matchedSignedIdentical:identical};
}
export function summarizeBenchmark(rows,thresholds,runs){
  const p=BENCH_PROTOCOL,names=['EFMW-style signed','Absolute EWMA','Two-sided CUSUM'],summary=[];
  for(const family of ['null','positive','negative','variance','oscillation'])for(let k=0;k<3;k++){
    const group=rows.filter(r=>r.family===family),nullRun=family==='null',pre=group.filter(r=>r.first[k]!==null&&r.first[k]<p.onset).length;
    // Early-alarmed fault runs count as failures, not successful early detections.
    const detected=group.filter(r=>r.post[k]!==null&&(r.first[k]===null||r.first[k]>=p.onset));
    const delays=detected.map(r=>(r.post[k]-p.onset)*p.dt),alarms=group.filter(r=>r.first[k]!==null).length;
    summary.push({family,monitor:names[k],n:group.length,falseAlarms:nullRun?alarms:pre,detections:nullRun?null:detected.length,misses:nullRun?null:group.length-detected.length,medianDelay:!nullRun&&delays.length?percentile(delays,.5):null,penalizedDelay:nullRun||!group.length?null:(delays.reduce((a,b)=>a+b,0)+(group.length-delays.length)*(p.steps-p.onset)*p.dt)/group.length});
  }
  return {schema:'millie01.monitor.benchmark.v1',version:VERSION,status:'EXPLORATORY_SYNTHETIC_NOT_INDEPENDENT',protocol:p,runsPerFamily:runs,thresholds,matchedSignedIdentical:rows.every(r=>r.matchedSignedIdentical),summary,rows};
}
export function navigationCase(seed,preset='highlands') {
  const sim=new Simulation(makeWorld(seed,preset));sim.arm();sim.setAuto(true);const initial=sim.world.goals.reduce((a,g,i)=>a+dist(i?sim.world.goals[i-1]:sim.world.start,g),0);
  for(let i=0;i<4800&&sim.state.goalIndex<sim.world.goals.length&&sim.state.mode==='ARMED';i++)sim.step();
  const s=sim.state;return {seed,preset,complete:s.goalIndex===sim.world.goals.length,goals:s.goalIndex,totalGoals:sim.world.goals.length,time_s:+s.t.toFixed(2),distance_m:+s.distance.toFixed(3),collisions:s.collisions,energy_Wh:+s.energy.toFixed(4),straightLineEfficiency:Math.min(1,initial/Math.max(initial,s.distance)),finalState:s.mode,reason:s.reason};
}
