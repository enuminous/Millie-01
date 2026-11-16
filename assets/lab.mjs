import {Simulation,makeWorld,terrain,gradient,dist,clamp,DT,LIMIT,VERSION,calibrate,benchmarkCase,summarizeBenchmark,navigationCase,BENCH_PROTOCOL} from './sim.mjs';
import {Scene} from './scene.mjs';
const $=id=>document.getElementById(id),all=q=>[...document.querySelectorAll(q)],fmt=(x,n=2)=>Number.isFinite(x)?x.toFixed(n):'—';
let sim=new Simulation(makeWorld()),scene,paused=false,activeTab='drive',accumulator=0,last=0,hudAt=0,frames=0,fpsAt=0,toastTimer,benchTask=null;
const keys=new Set(),history=[];
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
try{scene=new Scene($('world'));scene.setWorld(sim.world);}catch(e){$('webgl-error').hidden=false;$('webgl-error').textContent=e.message;}
function reset(world=sim.world){const speed=+$('speed').value,traction=+$('traction').value;sim=new Simulation(world,{speed,traction});keys.clear();history.length=0;accumulator=0;paused=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause simulation');$('fault').value='none';scene?.setWorld(world);$('world-title').textContent=$('terrain').selectedOptions[0].text.toUpperCase()+' / SEED '+world.seed;syncMode();updateHud();}
function syncMode(){$('manual').classList.toggle('selected',!sim.auto);$('auto').classList.toggle('selected',sim.auto);}
function generate(){const v=Number($('seed').value);if(!Number.isInteger(v)||v<0||v>4294967295){toast('Choose an integer seed from 0 to 4294967295.');return;}reset(makeWorld(v,$('terrain').value,+$('relief').value));toast('World rebuilt. Arm the rover to begin.');}
$('generate').onclick=generate;$('terrain').onchange=()=>{if($('terrain').value==='ridge'){$('relief').value='1.6';$('relief-value').textContent='1.6×';}generate();};
$('relief').oninput=()=>{$('relief-value').textContent=(+$('relief').value).toFixed(1)+'×';};$('relief').onchange=()=>{const w=makeWorld(+$('seed').value,$('terrain').value,+$('relief').value);w.relief=+$('relief').value;reset(w);};
$('speed').oninput=()=>{sim.options.speed=+$('speed').value;$('speed-value').textContent=sim.options.speed.toFixed(1)+' m/s';};
$('traction').oninput=()=>{sim.options.traction=+$('traction').value;$('traction-value').textContent=Math.round(sim.options.traction*100)+'%';};
$('arm').onclick=()=>{if(sim.state.mode==='ARMED'){sim.disarm();syncMode();}else if(!sim.arm())toast('Clear the fault, reset the latch, then arm.');else{paused=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause simulation');$('world').focus({preventScroll:true});}updateHud();};
$('manual').onclick=()=>{sim.setAuto(false);syncMode();};$('auto').onclick=()=>{sim.setAuto(true);syncMode();toast(sim.state.mode==='ARMED'?'Following the survey route.':'Autonomy selected. Arm the rover to start.');};
$('estop').onclick=()=>{sim.stop();keys.clear();syncMode();updateHud();};$('reset-latch').onclick=()=>{toast(sim.resetLatch()?'Latch reset. Arm to resume.':'Clear the injected fault first.');updateHud();};$('reset').onclick=()=>{reset();toast('Run restarted on the same world.');};
$('inject').onclick=()=>{sim.inject($('fault').value);toast($('fault').value==='none'?'Fault cleared. Reset any latch before arming.':'Fault applied: '+$('fault').selectedOptions[0].text);updateHud();};
function pause(value=!paused){paused=value;keys.clear();accumulator=0;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Resume simulation':'Pause simulation');}
$('pause').onclick=()=>pause();$('step').onclick=()=>{pause(true);tick();updateHud();};
function camera(name){if(!scene)return;scene.camera=name;scene.eye=null;all('[data-camera]').forEach(b=>b.classList.toggle('selected',b.dataset.camera===name));}
all('[data-camera]').forEach(b=>b.onclick=()=>camera(b.dataset.camera));
for(const name of ['grid','sensors'])$(name).onclick=()=>{if(!scene)return;scene[name]=!scene[name];$(name).classList.toggle('selected',scene[name]);$(name).setAttribute('aria-pressed',scene[name]);};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}};
function download(name,data,type='application/json'){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('export').onclick=()=>{download('millie01-run-'+sim.world.seed+'.json',sim.export());toast('Run exported with world, settings, events, and telemetry.');};
all('[data-tab]').forEach(button=>button.onclick=()=>{activeTab=button.dataset.tab;all('[data-tab]').forEach(b=>b.classList.toggle('active',b===button));for(const t of ['drive','bench','guide'])$(t+'-view').hidden=t!==activeTab;pause(true);});
const isTyping=e=>['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable;
const controlKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
document.addEventListener('keydown',e=>{
  if(isTyping(e)||activeTab!=='drive')return;
  if(e.code==='Space'&&['BUTTON','A'].includes(e.target.tagName))return;
  if(controlKeys.includes(e.code)){e.preventDefault();keys.add(e.code);if(sim.auto&&e.code!=='Space'){sim.setAuto(false);syncMode();}}
  if(e.repeat)return;
  if(e.code==='KeyX')$('estop').click();if(e.code==='KeyP')pause();if(e.code==='KeyR')$('reset').click();if(e.code==='KeyC'){const modes=['chase','orbit','cockpit','map'];camera(modes[(modes.indexOf(scene?.camera)+1)%4]);}
});
document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>pause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
all('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(sim.auto){sim.setAuto(false);syncMode();}};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
let drag=null;$('world').onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};$('world').setPointerCapture(e.pointerId);};$('world').onpointermove=e=>{if(!drag||!scene)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>1)camera('orbit');scene.azimuth-=dx*.007;scene.elevation=clamp(scene.elevation+dy*.006,.12,1.35);drag={x:e.clientX,y:e.clientY};};for(const e of ['pointerup','pointercancel'])$('world').addEventListener(e,()=>drag=null);$('world').addEventListener('wheel',e=>{e.preventDefault();if(scene)scene.distance=clamp(scene.distance+e.deltaY*.015,5,70);},{passive:false});
$('minimap').onclick=e=>{
  const mode=$('edit').value;if(mode==='inspect')return;const box=$('minimap').getBoundingClientRect(),x=((e.clientX-box.left)/box.width-.5)*150,z=((e.clientY-box.top)/box.height-.5)*150,w=JSON.parse(JSON.stringify(sim.world)),point={x,z};
  if(mode==='goal'){
    if(w.goals.length>=12){toast('Maximum 12 goals per mission. Erase one first.');return;}
    if(w.obstacles.some(o=>dist(point,o)<o.r+4)||dist(point,w.start)<5||w.goals.some(g=>dist(point,g)<6)||Math.abs(x)>69||Math.abs(z)>69||Math.hypot(...Object.values(gradient(x,z,w)))>.5){toast('Choose open, gentler terrain with space around the goal.');return;}
    w.goals.push({x,z,name:'Custom beacon '+(w.goals.length+1)});
  }else if(mode==='obstacle'){
    if(w.obstacles.length>=150){toast('Maximum 150 obstacles. Erase one first.');return;}
    if([w.start,...w.goals].some(g=>dist(point,g)<7)||w.obstacles.some(o=>dist(point,o)<o.r+3)||Math.abs(x)>70||Math.abs(z)>70){toast('Leave clearance around goals, spawn, and other obstacles.');return;}
    w.obstacles.push({x,z,r:2,h:2.4,kind:'rock',rotation:0});
  }else{
    const items=[...w.goals.map((g,i)=>({kind:'g',i,d:dist(g,point)})),...w.obstacles.map((o,i)=>({kind:'o',i,d:dist(o,point)}))].sort((a,b)=>a.d-b.d),hit=items[0];
    if(!hit||hit.d>6){toast('Click closer to an object to erase it.');return;}if(hit.kind==='g'){if(w.goals.length===1){toast('Keep at least one goal.');return;}w.goals.splice(hit.i,1);}else w.obstacles.splice(hit.i,1);
  }
  w.revision++;reset(w);toast('World edited. Run reset; arm to start.');
};
function tick(){const input={throttle:(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),brake:keys.has('Space')};const sample=sim.step(input);history.push(sample);if(history.length>240)history.shift();}
let lastEvents='';
function updateHud(){
  const s=sim.state,m=sim.monitor.last,g=sim.world.goals[s.goalIndex];
  $('clock').textContent='T+ '+String(Math.floor(s.t/60)).padStart(2,'0')+':'+(s.t%60).toFixed(1).padStart(4,'0');
  $('run-status').textContent=paused?'TIME PAUSED':s.mode==='ARMED'?(sim.auto?'AUTONOMOUS SURVEY':'MANUAL DRIVE'):s.mode.replaceAll('_',' ');
  $('arm').innerHTML=s.mode==='ARMED'?'Disarm rover <span>■</span>':'Arm rover <span>↗</span>';
  $('velocity').innerHTML=fmt(s.v)+' <em>m/s</em>';$('speed-meter').style.width=Math.abs(s.v)/6*100+'%';$('distance').innerHTML=fmt(s.distance,1)+' <em>m</em>';$('attitude').textContent=fmt(s.pitch*180/Math.PI,1)+'° / '+fmt(s.roll*180/Math.PI,1)+'°';$('battery').innerHTML=fmt(s.battery,0)+' <em>%</em>';
  $('contacts').textContent=s.collisions;$('range').textContent=sim.hardFault()&&sim.fault==='dropout'?'INVALID':fmt(sim.ranges()[0],1)+' m';$('energy').textContent=fmt(s.energy)+' Wh';$('goal-count').textContent=s.goalIndex+' / '+sim.world.goals.length;
  $('safety-reason').textContent=s.mode+' · '+s.reason;
  const heading=(s.heading*180/Math.PI+360)%360,cardinal=['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8];$('compass-heading').innerHTML=String(Math.round(heading)).padStart(3,'0')+'° <b>'+cardinal+'</b>';
  $('goals').innerHTML=sim.world.goals.map((goal,i)=>'<li class="'+(i<s.goalIndex?'done':i===s.goalIndex?'current':'')+'"><span class="goal-number">'+(i<s.goalIndex?'✓':String(i+1).padStart(2,'0'))+'</span><span><strong>'+goal.name+'</strong><small>'+(i<s.goalIndex?'SURVEY COMPLETE':Math.round(dist(s,goal))+' m '+(i===s.goalIndex?'· ACTIVE':'· QUEUED'))+'</small></span></li>').join('');
  if(m){$('signed-value').textContent=fmt(m.signed,4);$('abs-value').textContent=fmt(m.scores[1],4);$('cusum-value').textContent=fmt(m.scores[2],4);$('residual-value').textContent=fmt(m.residual,4);const status=!m.valid?'UNRESOLVED':m.alerts.some(Boolean)?'ALERT':'OBSERVING';$('monitor-status').textContent=status;$('monitor-status').classList.toggle('alert',status!=='OBSERVING');}else{for(const id of ['signed-value','abs-value','cusum-value'])$(id).textContent='0.0000';$('residual-value').textContent='—';$('monitor-status').textContent='IDLE';$('monitor-status').classList.remove('alert');}
  const ev=sim.events.slice(0,6).map(e=>'<div><time>'+fmt(e.t,1)+'s</time><span>'+e.message+'</span></div>').join('');if(ev!==lastEvents){$('events').innerHTML=ev||'Ready for a new expedition.';lastEvents=ev;}
  if(g&&scene){const p=scene.project(g.x,terrain(g.x,g.z,sim.world)+4.4,g.z);$('goal-label').hidden=!p||p.x<30||p.x>$('world').clientWidth-30||p.y<95||p.y>$('world').clientHeight-60;if(p){$('goal-label').style.left=p.x+'px';$('goal-label').style.top=p.y+'px';$('goal-label-name').textContent=g.name.toUpperCase();$('goal-label-distance').textContent=fmt(dist(s,g),0)+' m';}}else $('goal-label').hidden=true;
  drawMap();drawChart();syncMode();
}
function drawMap(){const c=$('minimap'),ctx=c.getContext('2d'),n=c.width,scale=n/150,w=sim.world,s=sim.state;ctx.fillStyle='#203831';ctx.fillRect(0,0,n,n);
  for(let z=0;z<n;z+=8)for(let x=0;x<n;x+=8){const h=terrain(x/scale-75,z/scale-75,w),v=Math.round(42+h*1.8);ctx.fillStyle=`rgb(${v},${v+22},${v+10})`;ctx.fillRect(x,z,8,8);}
  const pt=p=>[(p.x+75)*scale,(p.z+75)*scale];ctx.strokeStyle='#789b6c30';ctx.lineWidth=.6;for(let i=0;i<=n;i+=n/6){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,n);ctx.moveTo(0,i);ctx.lineTo(n,i);ctx.stroke();}
  for(const o of w.obstacles){ctx.fillStyle='#bdc2a47d';ctx.beginPath();ctx.arc(...pt(o),o.r*scale,0,Math.PI*2);ctx.fill();}
  if(sim.trace.length>1){ctx.strokeStyle='#a6d5a0';ctx.lineWidth=1;ctx.beginPath();sim.trace.forEach((p,i)=>{const q=pt(p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.stroke();}
  if(sim.auto&&sim.path.length){ctx.strokeStyle='#edc879';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(...pt(s));for(const p of sim.path)ctx.lineTo(...pt(p));ctx.stroke();ctx.setLineDash([]);}
  w.goals.forEach((g,i)=>{ctx.fillStyle=i<s.goalIndex?'#96d3b3':i===s.goalIndex?'#f7d083':'#91a89a';ctx.beginPath();ctx.arc(...pt(g),4,0,6.283);ctx.fill();ctx.fillStyle='#172d26';ctx.font='bold 6px monospace';ctx.textAlign='center';const q=pt(g);ctx.fillText(i+1,q[0],q[1]+2);});
  ctx.save();ctx.translate(...pt(s));ctx.rotate(-s.heading);ctx.fillStyle='#fdf4da';ctx.strokeStyle='#1b3028';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,6);ctx.lineTo(-4,-4);ctx.lineTo(4,-4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawChart(){const c=$('chart'),ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);const max=Math.max(.04,...history.map(v=>Math.abs(v.residual||0)));ctx.strokeStyle='#32433c';ctx.lineWidth=1;for(const y of [h*.2,h*.5,h*.8]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  for(const [color,fn] of [['#627c7766',v=>v.residual],['#ed9d6b',v=>v.scores[1]],['#62cbb9',v=>v.signed]]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();let prev=false;history.forEach((v,i)=>{const val=fn(v);if(!Number.isFinite(val)){prev=false;return;}const x=i/239*w,y=h*.5-val/max*h*.43;prev?ctx.lineTo(x,y):ctx.moveTo(x,y);prev=true;});ctx.stroke();}
}
function animate(now){const delta=Math.min(.1,(now-(last||now))/1000);last=now;if(!paused&&activeTab==='drive'){accumulator+=delta*+$('timescale').value;let count=0;while(accumulator>=DT&&count++<12){tick();accumulator-=DT;}}
  if(activeTab==='drive'){scene?.render(sim,delta);if(now-hudAt>100){updateHud();hudAt=now;}frames++;if(now-fpsAt>1000){$('fps').textContent=Math.round(frames*1000/(now-fpsAt));fpsAt=now;frames=0;}}
  requestAnimationFrame(animate);
}
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
function setBusy(task){benchTask=task;for(const id of ['run-bench','run-nav'])$(id).disabled=Boolean(task);$('bench-progress').hidden=!task;}
function progress(text,value){$('bench-progress-label').textContent=text;$('progress').value=value;}
$('cancel-bench').onclick=()=>{if(benchTask)benchTask.cancelled=true;};
function resultsActions(report,title){$('bench-results').innerHTML='<div class="results-heading"><div><span class="eyebrow">COMPUTED IN THIS BROWSER</span><h2>'+title+'</h2></div><div class="button-row"><button id="result-json">JSON ↓</button><button id="result-csv">CSV ↓</button></div></div>';
  $('result-json').onclick=()=>download('millie01-'+report.schema.split('.')[1]+'-benchmark.json',report);
  $('result-csv').onclick=()=>{const rows=report.summary||report.rows,columns=Object.keys(rows[0]);const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';download('millie01-benchmark.csv',[columns.join(','),...rows.map(r=>columns.map(k=>escape(r[k])).join(','))].join('\n'),'text/csv');};
}
$('run-bench').onclick=async()=>{
  if(benchTask)return;const task={cancelled:false};setBusy(task);pause(true);const runs=+$('runs').value;progress('Calibrating on 100 null runs…',0);await yieldUI();
  try{const thresholds=calibrate(),rows=[],families=['null','positive','negative','variance','oscillation'];for(let f=0;f<families.length;f++)for(let i=0;i<runs;i++){if(task.cancelled){toast('Benchmark cancelled. Partial results discarded.');return;}rows.push(benchmarkCase(BENCH_PROTOCOL.evaluationSeed+f*1000+i,families[f],thresholds));if(i%4===0){progress('Evaluating '+families[f]+' · '+(i+1)+' / '+runs,100*(f*runs+i+1)/(runs*5));await yieldUI();}}
    const report=summarizeBenchmark(rows,thresholds,runs);resultsActions(report,'Detector comparison · '+rows.length+' evaluation runs');
    $('bench-results').insertAdjacentHTML('beforeend','<p class="pass">Matched signed-EWMA control: '+(report.matchedSignedIdentical?'EXACT TIE on every sample and alert.':'PARITY FAILED')+'</p><p>Thresholds: signed '+fmt(thresholds.signed,5)+' · absolute '+fmt(thresholds.absolute,5)+' · CUSUM '+fmt(thresholds.cusum,5)+'. Null false alarms use the full run; fault false alarms occur before onset.</p><table><thead><tr><th>FAULT FAMILY</th><th>DETECTOR</th><th>FALSE ALARMS</th><th>DETECTED</th><th>MISSED / EARLY</th><th>MEDIAN DELAY</th><th>PENALIZED DELAY</th></tr></thead><tbody>'+report.summary.map(r=>'<tr><td>'+r.family+'</td><td>'+r.monitor+'</td><td>'+r.falseAlarms+' / '+r.n+'</td><td>'+(r.detections===null?'—':r.detections+' / '+r.n)+'</td><td>'+(r.misses??'—')+'</td><td>'+fmt(r.medianDelay)+' s</td><td>'+fmt(r.penalizedDelay)+' s</td></tr>').join('')+'</tbody></table><p>Conditional median includes detections only. Penalized delay includes all fault runs, assigning 12 seconds to misses and pre-onset alarms. Open deterministic seeds are not an independently sealed test.</p>');
  }catch(e){toast('Benchmark failed: '+e.message);}finally{setBusy(null);}
};
$('run-nav').onclick=async()=>{
  if(benchTask)return;const task={cancelled:false};setBusy(task);pause(true);try{const rows=[],terrains=['flat','highlands','ridge'],seeds=[101,203,307,409,503,607];for(const preset of terrains)for(const seed of seeds){if(task.cancelled){toast('Mission matrix cancelled. Partial results discarded.');return;}progress(preset+' / seed '+seed,rows.length/18*100);await yieldUI();rows.push(navigationCase(seed,preset));}
    const complete=rows.filter(r=>r.complete).length,report={schema:'millie01.navigation.benchmark.v1',version:VERSION,status:'SIMULATED_ONLY',dt:DT,timeout_s:240,planner:'A* / known full map / 2.5 m grid',seeds,terrains,rows};resultsActions(report,'Navigation matrix · '+complete+' / 18 complete');
    $('bench-results').insertAdjacentHTML('beforeend','<p>All 18 missions are retained, including incomplete routes and safety latches. Efficiency is the straight-line lower bound divided by traveled distance; it does not measure optimal route quality.</p><table><thead><tr><th>TERRAIN / SEED</th><th>RESULT</th><th>GOALS</th><th>TIME</th><th>DISTANCE</th><th>CONTACTS</th><th>ENERGY</th><th>REASON</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r.preset+' / '+r.seed+'</td><td class="'+(r.complete?'pass':'fail')+'">'+(r.complete?'COMPLETE':'INCOMPLETE')+'</td><td>'+r.goals+'/'+r.totalGoals+'</td><td>'+fmt(r.time_s,1)+' s</td><td>'+fmt(r.distance_m,1)+' m</td><td>'+r.collisions+'</td><td>'+fmt(r.energy_Wh,3)+' Wh</td><td>'+r.reason+'</td></tr>').join('')+'</tbody></table>');
  }catch(e){toast('Mission matrix failed: '+e.message);}finally{setBusy(null);}
};
updateHud();requestAnimationFrame(animate);
