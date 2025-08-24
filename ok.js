(function() {
    if (!window.geofs || !geofs.api?.viewer) {
        alert("GeoFS not loaded yet!");
        return;
    }

    const v = geofs.api.viewer;
    const gl = v.scene.globe;
    const C = window.Cesium;
    const W = window;

    W.__walk = W.__walk || {};
    const S = W.__walk;

    // Notification function
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
        setTimeout(() => {
            d.style.opacity = 0;
            setTimeout(() => d.remove(), 300);
        }, 2000);
    }

    const R = 6378137;
    const rad = x => x * Math.PI / 180;
    const latM = m => (m / R) * 180 / Math.PI;
    const lonM = (m, la) => m / (R * Math.cos(rad(la))) * 180 / Math.PI;

    function gnd(lon, lat) {
        try {
            return gl.getHeight(C.Cartographic.fromDegrees(lon, lat)) || 0;
        } catch {
            return 0;
        }
    }

    function setCam() {
        const p = C.Cartesian3.fromDegrees(S.lon, S.lat, S.alt);
        v.camera.setView({
            destination: p,
            orientation: { heading: C.Math.toRadians(S.hdg || 0), pitch: C.Math.toRadians(-10), roll: 0 }
        });
    }

    function spawn() {
        const a = geofs.aircraft.instance;
        S.lat = a.llaLocation[0];
        S.lon = a.llaLocation[1];
        S.hdg = a.heading || 0;
        S.alt = gnd(S.lon, S.lat) + 1.6;
    }

    function loop() {
        if (!S.on) return;
        const now = performance.now();
        const dt = Math.min(.05, (now - S.t) / 1000);
        S.t = now;

        let f = S.mvY, r = S.mvX;
        let L = Math.hypot(f, r) || 1;
        if (L > 0) { f /= L; r /= L; }

        const sp = (S.mvRun ? 7 : 4) * dt;
        const h = rad(S.hdg || 0);
        const n = f * Math.cos(h) - r * Math.sin(h);
        const e = f * Math.sin(h) + r * Math.cos(h);
        S.lat += latM(n * sp);
        S.lon += lonM(e * sp, S.lat);
        S.alt = gnd(S.lon, S.lat) + 1.6;

        setCam();
    }

    // Toggle walk mode
    if (S.on) {
        v.scene.postRender.removeEventListener(S._lp);
        if (S._joy) S._joy.remove();
        if (S._css) S._css.remove();
        (S.hid || []).forEach(([el, d]) => el.style.display = d || "");
        S.on = false;
        const c = v.scene.screenSpaceCameraController;
        c.enableRotate = c.enableZoom = c.enableTilt = c.enableTranslate = true;
        note("Walk OFF");
        return;
    }

    spawn();
    S.mvX = 0;
    S.mvY = 0;
    S.mvRun = false;
    S.t = performance.now();
    S._lp = () => loop();
    v.scene.postRender.addEventListener(S._lp);

    S.hid = [];
    document.querySelectorAll('.joystick,.geofs-joystick,.mobile-controls').forEach(el => {
        S.hid.push([el, el.style.display]);
        el.style.display = "none";
    });

    // Add joystick
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

    const start = e => {
        act = true;
        const t = e.touches[0];
        const r = J.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        id = t.identifier;
        e.preventDefault();
    };
    const move = e => {
        if (!act) return;
        const t = [...e.touches].find(x => x.identifier === id);
        if (!t) return;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        let m = 40, l = Math.hypot(dx, dy) || 1, k = l > m ? m / l : 1;
        dx *= k; dy *= k;
        st(dx, dy);
        S.mvX = dx / m;
        S.mvY = -dy / m;
        e.preventDefault();
    };
    const end = () => { act = false; st(0, 0); S.mvX = 0; S.mvY = 0; };

    J.addEventListener("touchstart", start, { passive: false });
    J.addEventListener("touchmove", move, { passive: false });
    J.addEventListener("touchend", end, { passive: false });

    // Right-side swipe for yaw
    let rot = false, rx = 0, rid = 0;
    function rStart(e) {
        const t = [...e.touches].find(x => x.clientX > window.innerWidth / 2);
        if (!t) return;
        rot = true;
        rx = t.clientX;
        rid = t.identifier;
        e.preventDefault();
    }
    function rMove(e) {
        if (!rot) return;
        const t = [...e.touches].find(x => x.identifier === rid);
        if (!t) return;
        let dx = t.clientX - rx;
        S.hdg = (S.hdg + dx * 0.1) % 360;
        rx = t.clientX;
        e.preventDefault();
    }
    function rEnd() { rot = false; }

    document.addEventListener("touchstart", rStart, { passive: false });
    document.addEventListener("touchmove", rMove, { passive: false });
    document.addEventListener("touchend", rEnd, { passive: false });

    // Disable default camera movement while walking
    const c = v.scene.screenSpaceCameraController;
    c.enableRotate = c.enableZoom = c.enableTilt = c.enableTranslate = false;

    S.on = true;
    note("Walk ON — joystick + swipe right side to turn");
})();
