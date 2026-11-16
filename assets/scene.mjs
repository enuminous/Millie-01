import {terrain,gradient,LIMIT,clamp} from './sim.mjs';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const r=new Array(16).fill(0);for(let c=0;c<4;c++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[c*4+j]+=a[k*4+j]*b[c*4+k];return r;}
function model(x=0,y=0,z=0,yaw=0,pitch=0,roll=0){let t=I();t[12]=x;t[13]=y;t[14]=z;let ry=I(),rx=I(),rz=I();ry[0]=ry[10]=Math.cos(yaw);ry[8]=Math.sin(yaw);ry[2]=-ry[8];rx[5]=rx[10]=Math.cos(pitch);rx[6]=Math.sin(pitch);rx[9]=-rx[6];rz[0]=rz[5]=Math.cos(roll);rz[1]=Math.sin(roll);rz[4]=-rz[1];return mul(mul(mul(t,ry),rx),rz);}
function view(eye,target){const z=unit(sub(eye,target)),x=unit(cross([0,1,0],z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
function perspective(aspect){const f=1/Math.tan(Math.PI/7),near=.12,far=430;return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];}
const COLORS={sand:[.55,.56,.39],rock:[.33,.37,.31],dark:[.08,.13,.14],orange:[.96,.40,.17],white:[.90,.94,.88],cyan:[.23,.9,.78],gold:[1,.76,.28]};
class Geometry {
  constructor(){this.data=[];}
  tri(a,b,c,color){const n=unit(cross(sub(b,a),sub(c,a)));for(const p of [a,b,c])this.data.push(...p,...n,...color);}
  quad(a,b,c,d,col){this.tri(a,b,c,col);this.tri(a,c,d,col);}
  box(x,y,z,sx,sy,sz,col){const a=[x-sx/2,y-sy/2,z-sz/2],b=[x+sx/2,y+sy/2,z+sz/2];const p=[[a[0],a[1],a[2]],[b[0],a[1],a[2]],[b[0],b[1],a[2]],[a[0],b[1],a[2]],[a[0],a[1],b[2]],[b[0],a[1],b[2]],[b[0],b[1],b[2]],[a[0],b[1],b[2]]];for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])this.quad(...f.map(i=>p[i]),col);}
  cylinder(x,y,z,r,h,col,n=12,axis='y'){const pt=(a,b,c)=>axis==='x'?[x+b,y+a,z+c]:[x+a,y+b,z+c];for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,ax=Math.cos(a)*r,az=Math.sin(a)*r,bx=Math.cos(b)*r,bz=Math.sin(b)*r;this.quad(pt(ax,-h/2,az),pt(ax,h/2,az),pt(bx,h/2,bz),pt(bx,-h/2,bz),col);this.tri(pt(0,h/2,0),pt(bx,h/2,bz),pt(ax,h/2,az),col);this.tri(pt(0,-h/2,0),pt(ax,-h/2,az),pt(bx,-h/2,bz),col);}}
  rock(x,y,z,r,h,col,rotation=0){const p=[];for(let j=0;j<7;j++){const a=j/7*6.283+rotation;p.push([x+Math.cos(a)*r,y+(j%2)*.2,z+Math.sin(a)*r]);}const top=[x+r*.2,y+h,z-r*.15];for(let i=0;i<7;i++)this.tri(p[i],top,p[(i+1)%7],col);}
  ring(x,z,r,width,col,w){for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2,pt=(a,r)=>{const px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;return [px,terrain(px,pz,w)+.07,pz];};this.quad(pt(a,r),pt(b,r),pt(b,r+width),pt(a,r+width),col);}}
}
export class Scene {
  constructor(canvas){
    this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:false});this.gl=gl;this.software=!gl;
    if(!gl){this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw Error('This browser cannot create a drawing canvas.');this.queue=[];}
    if(gl){
    const vs=`attribute vec3 position;attribute vec3 normal;attribute vec3 color;uniform mat4 projection;uniform mat4 view;uniform mat4 model;varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;void main(){vec4 w=model*vec4(position,1.);vWorld=w.xyz;vColor=color;vNormal=mat3(model)*normal;gl_Position=projection*view*w;}`;
    const fs=`precision mediump float;varying vec3 vColor;varying vec3 vNormal;varying vec3 vWorld;uniform vec3 eye;uniform float unlit;void main(){vec3 n=normalize(vNormal);float light=.50+.50*max(0.,dot(n,normalize(vec3(-.5,1.,.3))));vec3 c=vColor*mix(light,1.,unlit);float fog=clamp((distance(eye,vWorld)-65.)/185.,0.,.84);c=mix(c,vec3(.71,.80,.78),fog);gl_FragColor=vec4(c,1.);}`;
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('WebGL program failed');gl.useProgram(this.program);
    this.attrs=['position','normal','color'].map(k=>gl.getAttribLocation(this.program,k));this.uniforms=Object.fromEntries(['projection','view','model','eye','unlit'].map(k=>[k,gl.getUniformLocation(this.program,k)]));
    gl.enable(gl.DEPTH_TEST);}
    this.camera='chase';this.azimuth=-.7;this.elevation=.18;this.distance=18;this.eye=null;this.grid=false;this.sensors=false;this.meshes=[];
    const body=new Geometry();body.box(0,.55,0,1.75,.48,2.4,COLORS.dark);body.box(0,.95,0,1.58,.48,2.15,COLORS.orange);body.box(0,1.3,-.2,1.28,.26,1.25,COLORS.white);body.box(0,1.13,1.12,1.2,.14,.08,COLORS.white);body.box(-.48,1.3,.48,.28,.16,.1,COLORS.cyan);body.box(.48,1.3,.48,.28,.16,.1,COLORS.cyan);body.cylinder(0,1.8,-.45,.06,.9,COLORS.dark);body.box(0,2.23,-.45,.72,.24,.32,COLORS.white);body.box(0,2.23,-.26,.53,.13,.07,COLORS.dark);body.cylinder(.35,1.65,-.65,.035,.8,COLORS.dark);body.cylinder(.35,2.08,-.65,.08,.1,COLORS.orange);for(const x of [-.47,.47])body.box(x,1.48,-.2,.06,.1,1.3,COLORS.dark);this.body=this.upload(body);
    const wheel=new Geometry();wheel.cylinder(0,0,0,.44,.35,COLORS.dark,16,'x');wheel.cylinder(0,0,0,.27,.37,[.36,.40,.38],10,'x');wheel.cylinder(0,0,0,.11,.40,COLORS.orange,8,'x');for(let i=0;i<12;i++){const a=i/12*6.283;wheel.box(0,Math.cos(a)*.43,Math.sin(a)*.43,.38,.065,.065,[.16,.20,.19]);}this.wheel=this.upload(wheel);this.dynamic=gl?gl.createBuffer():null;
  }
  upload(geometry){if(this.software)return {data:new Float32Array(geometry.data),count:geometry.data.length/9};const gl=this.gl,buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.data),gl.STATIC_DRAW);return {buffer,count:geometry.data.length/9};}
  setWorld(w){this.world=w;for(const m of this.meshes)if(this.gl)this.gl.deleteBuffer(m.buffer);this.meshes=[];
    const land=new Geometry(),cell=this.software?5:2;for(let z=-95;z<95;z+=cell)for(let x=-95;x<95;x+=cell){const points=[[x,z],[x+cell,z],[x+cell,z+cell],[x,z+cell]].map(([a,b])=>[a,terrain(a,b,w),b]);const h=terrain(x,z,w),g=gradient(x,z,w),s=Math.hypot(g.x,g.z),noise=(Math.sin(x*1.7+z*3.7)+1)*.013;const col=w.preset==='ridge'?[.60+h*.007+noise,.50+h*.006,.34+h*.004]:[.45+h*.006+noise+s*.09,.53+h*.007+noise,.35+h*.004+s*.05];land.quad(points[0],points[3],points[2],points[1],col);}
    this.meshes.push(this.upload(land));const objects=new Geometry();
    for(const o of w.obstacles){const y=terrain(o.x,o.z,w);if(o.kind==='barrier'){objects.box(o.x,y+o.h*.5,o.z,o.r*1.4,o.h,o.r*1.4,[.50,.48,.35]);objects.box(o.x,y+o.h*.76,o.z,o.r*1.42,.18,o.r*1.42,COLORS.orange);}else objects.rock(o.x,y-.2,o.z,o.r,o.h,COLORS.rock,o.rotation);}
    for(let i=0;i<42;i++){const a=i/42*6.283,r=92+(i%5)*6,x=Math.sin(a)*r,z=Math.cos(a)*r;objects.rock(x,terrain(x,z,w)-4,z,12+(i%4)*4,14+(i%7)*3,[.42,.51,.46],a);}
    // Survey outpost near spawn, outside the driving line.
    const bx=w.start.x-9,bz=w.start.z-7,by=terrain(bx,bz,w);objects.box(bx,by+1.2,bz,5,2.4,3,COLORS.white);objects.box(bx,by+2.5,bz,5.3,.2,3.3,COLORS.dark);objects.box(bx,by+1.4,bz+1.52,3,.7,.05,[.13,.30,.30]);objects.cylinder(bx-4,by+3,bz,.09,6,COLORS.white);objects.box(bx-3,by+5.6,bz,2,.7,.08,COLORS.orange);
    for(let i=-70;i<=70;i+=10)for(const p of [[i,-75],[i,75],[-75,i],[75,i]]){const y=terrain(...p,w);objects.cylinder(p[0],y+.5,p[1],.08,1,COLORS.white,6);objects.cylinder(p[0],y+1,p[1],.13,.12,COLORS.orange,6);}
    this.meshes.push(this.upload(objects));const grid=new Geometry();for(let z=-75;z<75;z+=5)for(let x=-75;x<75;x+=5){for(const [a,b]of [[[x,z],[x+5,z]],[[x,z],[x,z+5]]])for(const p of [a,b])grid.data.push(p[0],terrain(...p,w)+.04,p[1],0,1,0,.61,.69,.51);}this.gridMesh=this.upload(grid);this.meshes.push(this.gridMesh);this.eye=null;
  }
  draw(mesh,transform=I(),lines=false,unlit=0){if(this.software){this.softwareDraw(mesh,transform,lines,unlit);return;}const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);this.attrs.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});gl.uniformMatrix4fv(this.uniforms.model,false,transform);gl.uniform1f(this.uniforms.unlit,unlit);gl.drawArrays(lines?gl.LINES:gl.TRIANGLES,0,mesh.count);}
  dynamicDraw(geo,lines=false){if(this.software){this.draw({data:geo.data},I(),lines,1);return;}const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geo.data),gl.DYNAMIC_DRAW);this.draw({buffer:this.dynamic,count:geo.data.length/9},I(),lines,1);}
  softwareDraw(mesh,t,lines,unlit){
    const m=mul(this.vp,t),v=mesh.data,width=this.canvas.width,height=this.canvas.height,stride=lines?18:27,light=unit([-.5,1,.3]);
    for(let i=0;i<v.length;i+=stride){const points=[];let depth=0,clipped=false;for(let j=0;j<stride;j+=9){const x=v[i+j],y=v[i+j+1],z=v[i+j+2],w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<.2){clipped=true;break;}points.push([(m[0]*x+m[4]*y+m[8]*z+m[12])/w*width*.5+width*.5,height*.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*height*.5]);depth+=w;}
      if(clipped||points.every(p=>p[0]<0)||points.every(p=>p[0]>width)||points.every(p=>p[1]<0)||points.every(p=>p[1]>height))continue;
      depth/=stride/9;const nx=v[i+3],ny=v[i+4],nz=v[i+5],normal=[t[0]*nx+t[4]*ny+t[8]*nz,t[1]*nx+t[5]*ny+t[9]*nz,t[2]*nx+t[6]*ny+t[10]*nz],shade=unlit?1:.5+.5*Math.max(0,dot(normal,light)),fog=clamp((depth-65)/185,0,.84),fogColor=[.71,.80,.78],col=[6,7,8].map((k,j)=>Math.round(255*clamp(v[i+k]*shade*(1-fog)+fogColor[j]*fog,0,1)));
      if(!lines&&!unlit){const px=t[0]*v[i]+t[4]*v[i+1]+t[8]*v[i+2]+t[12],py=t[1]*v[i]+t[5]*v[i+1]+t[9]*v[i+2]+t[13],pz=t[2]*v[i]+t[6]*v[i+1]+t[10]*v[i+2]+t[14];if(dot(normal,[this.eye[0]-px,this.eye[1]-py,this.eye[2]-pz])<0)continue;}
      this.queue.push({points,depth,color:`rgb(${col.join(',')})`,lines});
    }
  }
  flushSoftware(){const ctx=this.ctx;this.queue.sort((a,b)=>b.depth-a.depth);for(const face of this.queue){ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(face.lines){ctx.strokeStyle=face.color;ctx.lineWidth=1.3;ctx.stroke();}else{ctx.closePath();ctx.fillStyle=face.color;ctx.fill();ctx.strokeStyle=face.color;ctx.lineWidth=.5;ctx.stroke();}}this.queue.length=0;}
  render(sim,delta=.016){
    const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,this.software?.7:1.75),width=Math.round(c.clientWidth*dpr),height=Math.round(c.clientHeight*dpr);if(c.width!==width||c.height!==height){c.width=width;c.height=height;}if(gl){gl.viewport(0,0,c.width,c.height);gl.clearColor(.71,.80,.78,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);}else{this.ctx.fillStyle='#b5ccc7';this.ctx.fillRect(0,0,width,height);}
    const s=sim.state,w=this.world,sn=Math.sin(s.heading),cs=Math.cos(s.heading);let target=[s.x,s.y+1,s.z],desired;
    if(this.camera==='cockpit'){desired=[s.x+sn*.5,s.y+2.35,s.z+cs*.5];target=[s.x+sn*25,s.y+2.2+Math.sin(s.pitch)*15,s.z+cs*25];}
    else if(this.camera==='map'){desired=[s.x,s.y+85,s.z-.01];target=[s.x,s.y,s.z];}
    else {const a=this.camera==='chase'?s.heading+Math.PI+this.azimuth*.3:this.azimuth;desired=[s.x+Math.sin(a)*this.distance*Math.cos(this.elevation),s.y+3+this.distance*Math.sin(this.elevation),s.z+Math.cos(a)*this.distance*Math.cos(this.elevation)];desired[1]=Math.max(desired[1],terrain(desired[0],desired[2],w)+2);}
    if(!this.eye||this.camera==='cockpit'||this.camera==='map')this.eye=desired;else this.eye=this.eye.map((v,i)=>v+(desired[i]-v)*Math.min(1,delta*7));
    this.projection=perspective(c.width/c.height);this.view=view(this.eye,target);this.vp=mul(this.projection,this.view);if(gl){gl.uniformMatrix4fv(this.uniforms.projection,false,this.projection);gl.uniformMatrix4fv(this.uniforms.view,false,this.view);gl.uniform3fv(this.uniforms.eye,this.eye);}
    this.meshes.slice(0,2).forEach(m=>this.draw(m));if(this.grid)this.draw(this.gridMesh,I(),true,1);
    const markers=new Geometry();for(let i=0;i<w.goals.length;i++){const g=w.goals[i],y=terrain(g.x,g.z,w),col=i<s.goalIndex?COLORS.cyan:i===s.goalIndex?COLORS.gold:[.72,.80,.72];markers.ring(g.x,g.z,2.5,.22,col,w);markers.cylinder(g.x,y+1.8,g.z,.07,3.6,COLORS.white,6);markers.box(g.x+.65,y+3.3,g.z,1.3,.65,.08,col);markers.cylinder(g.x,y+.10,g.z,.4,.15,col);}
    this.dynamicDraw(markers);
    // A terrain-conforming contact shadow anchors the rover visually.
    const shadow=new Geometry();shadow.ring(s.x,s.z,.04,1.22,[.29,.34,.25],w);this.dynamicDraw(shadow);
    const transform=model(s.x,s.y+.1,s.z,s.heading,-s.pitch,s.roll);if(this.camera!=='cockpit')this.draw(this.body,transform);
    for(const x of [-1,1])for(const z of [-.85,0,.85]){const wx=s.x+x*cs+z*sn,wz=s.z-x*sn+z*cs,wy=terrain(wx,wz,w)+.43;this.draw(this.wheel,model(wx,wy,wz,s.heading,sim.wheelAngle,0));}
    const lines=new Geometry(),line=(a,b,col)=>{for(const p of [a,b])lines.data.push(...p,0,1,0,...col);};
    if(sim.path.length&&sim.auto){let prev=s;for(const p of sim.path){line([prev.x,terrain(prev.x,prev.z,w)+.17,prev.z],[p.x,terrain(p.x,p.z,w)+.17,p.z],COLORS.gold);prev=p;}}
    if(this.sensors){const ranges=sim.ranges(),angles=[0,.5,-.5,Math.PI/2,-Math.PI/2,Math.PI];ranges.forEach((r,i)=>{const a=s.heading+angles[i],x=s.x+Math.sin(a)*r,z=s.z+Math.cos(a)*r;line([s.x,s.y+1,s.z],[x,terrain(x,z,w)+.3,z],r<3?COLORS.orange:COLORS.cyan);});}
    if(lines.data.length)this.dynamicDraw(lines,true);if(this.software)this.flushSoftware();
  }
  project(x,y,z){if(!this.vp)return null;const m=this.vp,p=[x,y,z,1],q=[0,0,0,0];for(let i=0;i<4;i++)for(let j=0;j<4;j++)q[i]+=m[j*4+i]*p[j];if(q[3]<=0)return null;return {x:(q[0]/q[3]*.5+.5)*this.canvas.clientWidth,y:(.5-q[1]/q[3]*.5)*this.canvas.clientHeight};}
}
