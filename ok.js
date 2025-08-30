(function() {
    if (!window.geofs || !geofs.api?.viewer) { alert("GeoFS not loaded yet!"); return }
    const v = geofs.api.viewer, gl = v.scene.globe, C = window.Cesium, W = window;
    W.__walk = W.__walk || {}; const S = W.__walk;
    function note(m){let d=document.createElement("div");d.textContent=m;d.style.cssText="position:fixed;top:20px;right:20px;padding:6px 12px;background:#222;color:#fff;font:13px sans-serif;border-radius:6px;z-index:9999;opacity:0;transition:.3s";document.body.appendChild(d);setTimeout(()=>d.style.opacity=1,20);setTimeout(()=>{d.style.opacity=0;setTimeout(()=>d.remove(),300)},2000)}
    const R=6378137,rad=x=>x*Math.PI/180,latM=m=>(m/R)*180/Math.PI,lonM=(m,la)=>m/(R*Math.cos(rad(la)))*180/Math.PI;
    function gnd(lo,la){try{return gl.getHeight(C.Cartographic.fromDegrees(lo,la))||0}catch{return 0}}
    function setCam(){const p=C.Cartesian3.fromDegrees(S.lon,S.lat,S.alt);v.camera.setView({destination:p,orientation:{heading:C.Math.toRadians(S.hdgCur),pitch:C.Math.toRadians(S.pitchCur),roll:0}})}
    function spawn(){const a=geofs.aircraft.instance;S.lat=a.llaLocation[0];S.lon=a.llaLocation[1];S.hdg=a.heading||0;S.pitch=0;S.hdgCur=S.hdg;S.pitchCur=S.pitch;S.alt=gnd(S.lon,S.lat)+1.6;S._t0=performance.now();S._bob=0}
    function lerp(a,b,t){return a+(b-a)*t}
    function loop(){if(!S.on)return;const now=performance.now(),dt=Math.min(.05,(now-S.t)/1000);S.t=now;S.hdgCur=lerp(S.hdgCur,S.hdg,0.15);S.pitchCur=lerp(S.pitchCur,S.pitch,0.15);let f=S.mvY,r=S.mvX,L=Math.hypot(f,r);if(L>0){f/=L;r/=L}const sp=(S.mvRun?7:4)*dt,h=rad(S.hdgCur),n=f*Math.cos(h)-r*Math.sin(h),e=f*Math.sin(h)+r*Math.cos(h);S.lat+=latM(n*sp);S.lon+=lonM(e*sp,S.lat);const speed=Math.hypot(f,r)*(S.mvRun?2:1);S._bob+=dt*speed*6;const bob=Math.sin(S._bob)*0.03;const targ=gnd(S.lon,S.lat)+1.6+bob;S.alt=lerp(S.alt,targ,0.2);setCam()}
    if(S.on){v.scene.postRender.removeEventListener(S._lp);if(S._joy)S._joy.remove();if(S._css)S._css.remove();(S.hid||[]).forEach(([el,d])=>el.style.display=d||"");S.on=false;note("Walk OFF");return}
    spawn();S.mvX=0;S.mvY=0;S.mvRun=false;S.t=performance.now();S._lp=()=>loop();v.scene.postRender.addEventListener(S._lp);S.hid=[];document.querySelectorAll('.joystick,.geofs-joystick,.mobile-controls').forEach(el=>{S.hid.push([el,el.style.display]);el.style.display="none"});
    S._css=document.createElement("style");S._css.textContent="#waJoy{position:fixed;left:20px;bottom:20px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);z-index:9999;touch-action:none}#waStick{position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(255,255,255,.3)}";document.head.appendChild(S._css);
    S._joy=document.createElement("div");S._joy.id="waJoy";S._joy.innerHTML='<div id="waStick"></div>';document.body.appendChild(S._joy);
    const J=S._joy,ST=J.firstChild;let act=false,cx=0,cy=0,id=0;const st=(dx,dy)=>ST.style.transform=`translate(${dx}px,${dy}px)`;
    J.addEventListener("touchstart",e=>{const t=e.touches[0];act=true;const r=J.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;id=t.identifier;e.preventDefault()},{passive:false});
    J.addEventListener("touchmove",e=>{if(!act)return;const t=[...e.touches].find(x=>x.identifier===id);if(!t)return;let dx=t.clientX-cx,dy=t.clientY-cy,m=40,l=Math.hypot(dx,dy)||1,k=l>m?m/l:1;dx*=k;dy*=k;st(dx,dy);S.mvX=dx/m;S.mvY=-dy/m;e.preventDefault()},{passive:false});
    J.addEventListener("touchend",()=>{act=false;st(0,0);S.mvX=0;S.mvY=0},{passive:true});
    let rot=false,rx=0,ry=0,rid=0;
    function rStart(e){const t=[...e.touches].find(x=>x.clientX>140);if(!t)return;rot=true;rx=t.clientX;ry=t.clientY;rid=t.identifier}
    function rMove(e){if(!rot)return;const t=[...e.touches].find(x=>x.identifier===rid);if(!t)return;const dx=t.clientX-rx,dy=t.clientY-ry;S.hdg=(S.hdg+dx*0.5)%360;S.pitch=Math.min(Math.max(S.pitch-dy*0.2,-89),89);rx=t.clientX;ry=t.clientY}
    function rEnd(){rot=false}
    document.addEventListener("touchstart",rStart,{passive:true});
    document.addEventListener("touchmove",rMove,{passive:true});
    document.addEventListener("touchend",rEnd,{passive:true});
    S.on=true;note("Walk ON — joystick + smooth look + head bob")
})();
