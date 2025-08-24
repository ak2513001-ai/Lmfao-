(function() {
    if (!window.geofs || !geofs.api?.viewer) { alert("GeoFS not loaded yet!"); return; }

    const v = geofs.api.viewer;
    const gl = v.scene.globe;
    const C = window.Cesium;
    const W = window;

    W.__walk = W.__walk || {};
    const S = W.__walk;

    function note(msg) {
        const d = document.createElement("div");
        d.textContent = msg;
        d.style.cssText = `
            position:fixed; top:20px; right:20px;
            padding:6px 12px; background:#222; color:#fff;
            font:13px sans-serif; border-radius:6px; z-index:9999;
            opacity:0; transition:.3s;
        `;
        document.body.appendChild(d);
        setTimeout(() => d.style.opacity = 1, 20);
        setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 300); }, 2000);
    }

    const R = 6378137;
    const rad = x => x * Math.PI / 180;
    const latM = m => (m / R) * 180 / Math.PI;
    const lonM = (m, la) => m / (R * Math.cos(rad(la))) * 180 / Math.PI;

    function getGround(lon, lat) { try { return gl.getHeight(C.Cartographic.fromDegrees(lon, lat)) || 0; } catch { return 0; } }

    function setCam() {
        const p = C.Cartesian3.fromDegrees(S.lon, S.lat, S.alt);
        v.camera.setView({
            destination: p,
            orientation: { heading: C.Math.toRadians(S.hdgCurrent), pitch: C.Math.toRadians(S.pitchCurrent), roll: 0 }
        });
    }

    function spawn() {
        const a = geofs.aircraft.instance;
        S.lat = a.llaLocation[0];
        S.lon = a.llaLocation[1];
        S.hdg = a.heading || 0;
        S.pitch = 0;
        S.hdgCurrent = S.hdg;
        S.pitchCurrent = S.pitch;
        S.alt = getGround(S.lon, S.lat) + 1.6;
        S._t0 = performance.now();
        S._bobPhase = 0;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function loop() {
        if (!S.on) return;
        const now = performance.now();
        const dt = Math.min(.05, (now - S.t) / 1000);
        S.t = now;

        // Smooth yaw/pitch interpolation
        const smoothFactor = 0.15; // smaller = slower smoothing
        S.hdgCurrent = lerp(S.hdgCurrent, S.hdg, smoothFactor);
        S.pitchCurrent = lerp(S.pitchCurrent, S.pitch, smoothFactor);

        // Movement
        let f = S.mvY, r = S.mvX;
        const L = Math.hypot(f, r);
        if (L > 0) { f /= L; r /= L; }

        const sp = (S.mvRun ? 7 : 4) * dt;
        const h = rad(S.hdgCurrent);
        const n = f * Math.cos(h) - r * Math.sin(h);
        const e = f * Math.sin(h) + r * Math.cos(h);
        S.lat += latM(n * sp);
        S.lon += lonM(e * sp, S.lat);

        // Head bob
        const speed = Math.hypot(f, r) * (S.mvRun ? 2 : 1);
        S._bobPhase += dt * speed * 6;
        const bobOffset = Math.sin(S._bobPhase) * 0.03;

        // Smooth altitude
        const targetAlt = getGround(S.lon, S.lat) + 1.6 + bobOffset;
        S.alt = lerp(S.alt, targetAlt, 0.2);

        setCam();
    }

    if (S.on) {
        v.scene.postRender.removeEventListener(S._lp);
        if (S._joy) S._joy.remove();
        if (S._css) S._css.remove();
        (S.hid || []).forEach(([el, d]) => el.style.display = d || "");
        S.on = false;
        note("Walk OFF");
        return;
    }

    spawn();
    S.mvX = 0; S.mvY = 0; S.mvRun = false; S.t = performance.now();
    S._lp = () => loop();
    v.scene.postRender.addEventListener(S._lp);

    S.hid = [];
    document.querySelectorAll('.joystick,.geofs-joystick,.mobile-controls').forEach(el => {
        S.hid.push([el, el.style.display]);
        el.style.display = "none";
    });

    // Left joystick
    S._css = document.createElement("style");
    S._css.textContent = `
        #waJoy{position:fixed;left:20px;bottom:20px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);z-index:9999;touch-action:none}
        #waStick{position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(255,255,255,.3)}
    `;
    document.head.appendChild(S._css);

    S._joy = document.createElement("div");
    S._joy.id = "waJoy";
    S._joy.innerHTML = '<div id="waStick"></div>';
    document.body.appendChild(S._joy);

    const J = S._joy, ST = J.firstChild;
    let act = false, cx = 0, cy = 0, id = 0;
    const st = (dx, dy) => ST.style.transform = `translate(${dx}px,${dy}px)`;

    const start = e => { act = true; const t = e.touches[0]; const r = J.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; id = t.identifier; e.preventDefault(); };
    const move = e => { if (!act) return; const t = [...e.touches].find(x => x.identifier === id); if (!t) return; let dx = t.clientX - cx, dy = t.clientY - cy; let m = 40, l = Math.hypot(dx, dy) || 1, k = l > m ? m / l : 1; dx *= k; dy *= k; st(dx, dy); S.mvX = dx / m; S.mvY = -dy / m; e.preventDefault(); };
    const end = () => { act = false; st(0,0); S.mvX = 0; S.mvY = 0; };
    J.addEventListener("touchstart", start, { passive:false });
    J.addEventListener("touchmove", move, { passive:false });
    J.addEventListener("touchend", end, { passive:false });

    // Full-screen swipe for yaw + pitch
    let rot = false, rx = 0, ry = 0, rid = 0;
    function rStart(e) {
        const t = [...e.touches].find(x => x.clientX > 140 || x.clientY < window.innerHeight);
        if (!t) return;
        rot = true; rx = t.clientX; ry = t.clientY; rid = t.identifier; e.preventDefault();
    }
    function rMove(e) {
        if (!rot) return;
        const t = [...e.touches].find(x => x.identifier === rid);
        if (!t) return;
        const dx = t.clientX - rx;
        const dy = t.clientY - ry;
        S.hdg = (S.hdg + dx * 0.5) % 360; // horizontal target
        S.pitch = Math.min(Math.max(S.pitch - dy * 0.2, -89), 89); // vertical target
        rx = t.clientX; ry = t.clientY; e.preventDefault();
    }
    function rEnd() { rot = false; }

    document.addEventListener("touchstart", rStart, { passive:false });
    document.addEventListener("touchmove", rMove, { passive:false });
    document.addEventListener("touchend", rEnd, { passive:false });

    S.on = true;
    note("Walk ON — joystick + smooth turning + head bob");
})();
