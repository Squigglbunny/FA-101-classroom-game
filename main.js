// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//
//  Coordinate system — normalised (0-1) fractions of canvas size
//  are stored in Firebase so any device / orientation renders
//  objects at the correct position relative to the painting.
//
//  UX features:
//   • Pinch-to-zoom + two-finger pan (mobile)
//   • Scroll-wheel zoom (desktop)
//   • Single-finger pan on empty canvas when not staging
//   • After confirming a placement the staging copy persists
//     (offset slightly) so rapid multi-placement is easy
//   • Staging controls live in a bottom action bar for
//     thumb-friendly access on phones
//   • Sidebar is collapsible on mobile; closes auto when staging
// ============================================================


// ── 1. FIREBASE ──────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDbel-9z-agY4Fg0fSzKRGgfOAbz8Ken2E",
    authDomain: "fa-101-classroom-game.firebaseapp.com",
    databaseURL: "https://fa-101-classroom-game-default-rtdb.firebaseio.com",
    projectId: "fa-101-classroom-game",
    storageBucket: "fa-101-classroom-game.firebasestorage.app",
    messagingSenderId: "357744157002",
    appId: "1:357744157002:web:c49c360e340454f535a1b3"
};
firebase.initializeApp(firebaseConfig);
const db         = firebase.database();
const objectsRef = db.ref('marine-objects');


// ── 2. CANVAS ────────────────────────────────────────────────
const canvas = new fabric.Canvas('oceanCanvas', {
    width:     window.innerWidth,
    height:    window.innerHeight,
    selection: false
});

let artworkAspect = null; // set when Michelangelo.jpg loads

function computeCanvasSize() {
    if (!artworkAspect) return { w: window.innerWidth, h: window.innerHeight };
    const winW = window.innerWidth, winH = window.innerHeight;
    return (winW / winH > artworkAspect)
        ? { w: Math.floor(winH * artworkAspect), h: winH }
        : { w: winW, h: Math.floor(winW / artworkAspect) };
}

function resizeCanvas() {
    const oldW = canvas.width, oldH = canvas.height;
    const { w, h } = computeCanvasSize();
    canvas.setDimensions({ width: w, height: h });

    // Reposition permanent objects from their normalised coords
    canvas.getObjects()
        .filter(o => o.id !== '__staging__' && o._normCoords)
        .forEach(applyNormCoords);

    // Move the in-progress staging object proportionally
    if (stagingObj && oldW && oldH) {
        stagingObj.set({
            left: stagingObj.left * (w / oldW),
            top:  stagingObj.top  * (h / oldH)
        });
        stagingObj.setCoords();
    }

    rescaleOverlays();
    canvas.renderAll();
}

window.addEventListener('resize', resizeCanvas);


// ── 3. NORMALISED-COORDINATE HELPERS ─────────────────────────
function storeNormCoords(obj) {
    const nW = obj.width, nH = obj.height;
    obj._normCoords = {
        leftN:   obj.left   / canvas.width,
        topN:    obj.top    / canvas.height,
        scaleXN: obj.scaleX * nW / canvas.width,
        scaleYN: obj.scaleY * nH / canvas.height,
        naturalW: nW, naturalH: nH
    };
}

function applyNormCoords(obj) {
    const { leftN, topN, scaleXN, scaleYN, naturalW, naturalH } = obj._normCoords;
    obj.set({
        left:   leftN   * canvas.width,
        top:    topN    * canvas.height,
        scaleX: scaleXN * canvas.width  / naturalW,
        scaleY: scaleYN * canvas.height / naturalH
    });
    obj.setCoords();
}


// ── 4. OVERLAY ───────────────────────────────────────────────
let overlayImages  = { color: null, outline: null };
let activeOverlay  = 'color';
let overlayOpacity = 0.5;

function scaleOverlayToCanvas(img) {
    img.set({ left: 0, top: 0,
        scaleX: canvas.width  / img.width,
        scaleY: canvas.height / img.height });
}

function rescaleOverlays() {
    if (overlayImages.color)   scaleOverlayToCanvas(overlayImages.color);
    if (overlayImages.outline) scaleOverlayToCanvas(overlayImages.outline);
    if (canvas.overlayImage)   scaleOverlayToCanvas(canvas.overlayImage);
}

function toggleOverlay(which) {
    activeOverlay = which;
    document.getElementById('btn-overlay-color')
        .classList.toggle('active', which === 'color');
    document.getElementById('btn-overlay-outline')
        .classList.toggle('active', which === 'outline');
    const img = overlayImages[which];
    if (img) {
        scaleOverlayToCanvas(img);
        img.set({ opacity: overlayOpacity });
        canvas.overlayImage = img;
        canvas.renderAll();
    }
}

function setOverlayOpacity(value) {
    overlayOpacity = parseFloat(value);
    if (canvas.overlayImage) {
        canvas.overlayImage.set({ opacity: overlayOpacity });
        canvas.renderAll();
    }
}

function makeWhiteTransparent(fabricImg, threshold, callback) {
    const src = fabricImg.getElement();
    const w = src.naturalWidth || src.width;
    const h = src.naturalHeight || src.height;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    const id = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) {
        if (id.data[i] > threshold && id.data[i+1] > threshold && id.data[i+2] > threshold)
            id.data[i+3] = 0;
    }
    ctx.putImageData(id, 0, 0);
    fabric.Image.fromURL(off.toDataURL('image/png'), callback);
}

function initOverlays() {
    fabric.Image.fromURL('assets/Michelangelo.jpg', (colorImg) => {
        artworkAspect = colorImg.width / colorImg.height;
        overlayImages.color = colorImg;
        colorImg.set({ opacity: overlayOpacity });
        resizeCanvas();
        scaleOverlayToCanvas(colorImg);
        canvas.overlayImage = colorImg;
        canvas.renderAll();

        fabric.Image.fromURL('assets/Michelangelo_outline.png', (raw) => {
            makeWhiteTransparent(raw, 230, (processed) => {
                overlayImages.outline = processed;
                processed.set({ opacity: overlayOpacity });
                scaleOverlayToCanvas(processed);
            });
        }, { crossOrigin: 'anonymous' });
    }, { crossOrigin: 'anonymous' });
}

window.addEventListener('load', initOverlays);


// ── 5. ANIMAL BUTTONS ────────────────────────────────────────
const marineFiles = [
    'Seal.png','Crab.png','Jellyfish.png','Kelp1.png','Kelp2.png',
    'Octopus.png','Orca1.png','Orca2.png','RedCoral.png',
    'SeaUrchin.png','Starfish.png','bg.jpg'
];

const container = document.getElementById('button-container');
marineFiles.forEach(fileName => {
    const btn   = document.createElement('button');
    const base  = fileName.replace(/\.[^.]+$/, '');
    const label = base.replace(/_/g,' ').replace(/([a-z])(\d)/g,'$1 $2');
    btn.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    btn.onclick = () => startStaging(`assets/${fileName}`);
    container.appendChild(btn);
});


// ── 6. STAGING ───────────────────────────────────────────────
let stagingObj         = null;
let stagingUrl         = null;
let stagingLayerIntent = null;

function getPlacedObjects() {
    return canvas.getObjects().filter(o => o.id !== '__staging__');
}

function startStaging(url, opts = {}) {
    if (stagingObj) cancelPlace(/*silent*/ true);

    stagingUrl         = url;
    stagingLayerIntent = null;

    // Auto-close sidebar on mobile when staging begins
    if (window.innerWidth < 768) closeSidebar();

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:        opts.left  ?? canvas.width  * 0.5,
            top:         opts.top   ?? canvas.height * 0.4,
            scaleX:      opts.scaleX ?? 0.5,
            scaleY:      opts.scaleY ?? 0.5,
            angle:       opts.angle  ?? 0,
            opacity:     1,
            selectable:  true, evented: true,
            hasControls: true, hasBorders: true,
            id:          '__staging__'
        });
        stagingObj = img;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        showStagingUI();
        applyZOrder();
    }, { crossOrigin: 'anonymous' });
}


// ── 7. LAYER SLIDER ──────────────────────────────────────────
function onLayerSliderInput(rawValue) {
    const value  = parseInt(rawValue);
    const total  = getPlacedObjects().length + 1;
    const fromTop    = total - value;
    const fromBottom = value - 1;
    stagingLayerIntent = (fromTop <= fromBottom) ? { fromTop } : { fromBottom };
    updateLayerLabel(value, total);
    applyZOrder();
}

function updateStagingSliderRange() {
    if (!stagingObj) return;
    const total  = getPlacedObjects().length + 1;
    const slider = document.getElementById('layer-slider');
    slider.max   = total;

    let v;
    if (!stagingLayerIntent)                           v = total;
    else if (stagingLayerIntent.fromTop !== undefined) v = Math.max(1, total - stagingLayerIntent.fromTop);
    else                                               v = Math.min(total, stagingLayerIntent.fromBottom + 1);

    slider.value = v;
    updateLayerLabel(v, total);
    applyZOrder();
}

function updateLayerLabel(value, total) {
    const el = document.getElementById('layer-label');
    if (value >= total)   el.textContent = 'Front (top layer)';
    else if (value === 1) el.textContent = 'Back (bottom layer)';
    else                  el.textContent = `Layer ${value} of ${total}`;
}


// ── 8. CONFIRM / CANCEL ──────────────────────────────────────
function confirmPlace() {
    if (!stagingObj) return;

    const placed    = getPlacedObjects().sort((a,b) => (a.zIndex??0)-(b.zIndex??0));
    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);

    let zIdx;
    if (placed.length === 0)           zIdx = 0;
    else if (sliderVal <= 1)           zIdx = (placed[0].zIndex ?? 0) - 1;
    else if (sliderVal > placed.length) zIdx = (placed[placed.length-1].zIndex ?? 0) + 1;
    else {
        const below = placed[sliderVal-2]?.zIndex ?? 0;
        const above = placed[sliderVal-1]?.zIndex ?? 0;
        zIdx = (below + above) / 2;
    }

    const naturalW = stagingObj.width;
    const naturalH = stagingObj.height;

    // Write normalised coords to Firebase
    objectsRef.child('obj_' + Date.now()).set({
        url:    stagingUrl,
        angle:  stagingObj.angle,
        zIndex: zIdx,
        leftN:   stagingObj.left   / canvas.width,
        topN:    stagingObj.top    / canvas.height,
        scaleXN: stagingObj.scaleX * naturalW / canvas.width,
        scaleYN: stagingObj.scaleY * naturalH / canvas.height
    });

    // ── Keep staging alive: restart at a small offset so the user can
    //    see the object was placed and immediately place another one.
    const OFFSET  = Math.round(canvas.width * 0.04);   // ~4% canvas width
    const prevL   = stagingObj.left;
    const prevT   = stagingObj.top;
    const prevSX  = stagingObj.scaleX;
    const prevSY  = stagingObj.scaleY;
    const prevAng = stagingObj.angle;
    const prevUrl = stagingUrl;

    canvas.remove(stagingObj);
    stagingObj = null; stagingUrl = null; stagingLayerIntent = null;
    canvas.renderAll();

    // Clamp offset so it stays within canvas bounds
    const newLeft = Math.min(canvas.width  - 50, Math.max(10, prevL + OFFSET));
    const newTop  = Math.min(canvas.height - 50, Math.max(10, prevT + OFFSET));

    startStaging(prevUrl, { left: newLeft, top: newTop, scaleX: prevSX, scaleY: prevSY, angle: prevAng });
}

// cancelPlace can be called silently (no UI hide) when switching animals mid-stage
function cancelPlace(silent = false) {
    if (stagingObj) {
        canvas.remove(stagingObj);
        canvas.discardActiveObject();
        stagingObj = null; stagingUrl = null; stagingLayerIntent = null;
        canvas.renderAll();
    }
    if (!silent) hideStagingUI();
}


// ── 9. STAGING UI SHOW / HIDE ────────────────────────────────
function showStagingUI() {
    const total  = getPlacedObjects().length + 1;
    const slider = document.getElementById('layer-slider');
    slider.min = 1; slider.max = total; slider.value = total;
    stagingLayerIntent = { fromTop: 0 };
    updateLayerLabel(total, total);
    document.getElementById('staging-bar').classList.add('active');
}

function hideStagingUI() {
    document.getElementById('staging-bar').classList.remove('active');
}


// ── 10. LOCK HELPER ──────────────────────────────────────────
function lockObject(obj) {
    obj.set({
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockScalingX: true,  lockScalingY: true,
        lockRotation: true,  hasControls: false,
        hasBorders: false,   opacity: 1
    });
}


// ── 11. Z-ORDER ──────────────────────────────────────────────
function applyZOrder() {
    const placed = getPlacedObjects().sort((a,b) => (a.zIndex??0)-(b.zIndex??0));
    if (!stagingObj) { placed.forEach(o => canvas.bringToFront(o)); canvas.renderAll(); return; }

    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);
    const total     = placed.length + 1;

    const stack = [...placed];
    stack.splice(sliderVal - 1, 0, stagingObj);
    stack.forEach(o => canvas.bringToFront(o));

    if (sliderVal < total) canvas.discardActiveObject();
    else                   canvas.setActiveObject(stagingObj);

    canvas.renderAll();
}

canvas.on('mouse:up', () => {
    if (stagingObj) {
        const sliderVal = parseInt(document.getElementById('layer-slider').value || 1);
        if (sliderVal <= getPlacedObjects().length) {
            canvas.discardActiveObject();
            applyZOrder();
        }
    }
});


// ── 12. ZOOM & PAN ───────────────────────────────────────────
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

// Scroll-wheel zoom (desktop)
canvas.wrapperEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect  = canvas.wrapperEl.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * factor));
    canvas.zoomToPoint(point, newZoom);
    canvas.renderAll();
}, { passive: false });

// Pinch-to-zoom + two-finger pan (mobile)
let pinchStartDist = null;
let pinchStartZoom = null;
let pinchLastMid   = null;

function touchPoint(touches, i) {
    const r = canvas.wrapperEl.getBoundingClientRect();
    return { x: touches[i].clientX - r.left, y: touches[i].clientY - r.top };
}
function touchDist(touches) {
    const a = touchPoint(touches,0), b = touchPoint(touches,1);
    return Math.hypot(b.x-a.x, b.y-a.y);
}
function touchMid(touches) {
    const a = touchPoint(touches,0), b = touchPoint(touches,1);
    return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
}

canvas.wrapperEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        pinchStartDist = touchDist(e.touches);
        pinchStartZoom = canvas.getZoom();
        pinchLastMid   = touchMid(e.touches);
    }
}, { passive: false });

canvas.wrapperEl.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dist = touchDist(e.touches);
    const mid  = touchMid(e.touches);

    // Zoom relative to pinch-start (smoother than incremental)
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
        pinchStartZoom * (dist / pinchStartDist)));
    canvas.zoomToPoint(mid, newZoom);

    // Pan from midpoint delta
    if (pinchLastMid) {
        const vpt = canvas.viewportTransform;
        vpt[4] += mid.x - pinchLastMid.x;
        vpt[5] += mid.y - pinchLastMid.y;
        canvas.requestRenderAll();
    }
    pinchLastMid = mid;
}, { passive: false });

canvas.wrapperEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
        pinchStartDist = null; pinchStartZoom = null; pinchLastMid = null;
    }
});

// Single-finger pan on empty canvas when NOT staging
let isPanning  = false;
let lastPanPt  = null;

canvas.on('mouse:down', (opt) => {
    if (!stagingObj && !opt.target) {
        isPanning = true;
        const e = opt.e;
        lastPanPt = e.touches
            ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
            : { x: e.clientX,            y: e.clientY            };
        canvas.defaultCursor = 'grabbing';
    }
});

canvas.on('mouse:move', (opt) => {
    if (!isPanning || !lastPanPt) return;
    const e = opt.e;
    const cur = e.touches
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
        : { x: e.clientX,            y: e.clientY            };
    const vpt = canvas.viewportTransform;
    vpt[4] += cur.x - lastPanPt.x;
    vpt[5] += cur.y - lastPanPt.y;
    canvas.requestRenderAll();
    lastPanPt = cur;
});

canvas.on('mouse:up', () => {
    isPanning = false; lastPanPt = null;
    canvas.defaultCursor = 'default';
});

function resetZoom() {
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.renderAll();
}


// ── 13. SIDEBAR TOGGLE (mobile) ──────────────────────────────
function toggleSidebar() {
    const ctrl = document.getElementById('controls');
    const btn  = document.getElementById('sidebar-toggle');
    const open = ctrl.classList.toggle('open');
    btn.textContent = open ? '✕' : '☰';
}

function closeSidebar() {
    document.getElementById('controls').classList.remove('open');
    document.getElementById('sidebar-toggle').textContent = '☰';
}


// ── 14. FIREBASE → CANVAS: new object ────────────────────────
objectsRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (canvas.getObjects().find(o => o.id === snapshot.key)) return;

    fabric.Image.fromURL(data.url, (img) => {
        const nW = img.width, nH = img.height;
        let left, top, scaleX, scaleY;

        if (data.leftN !== undefined) {
            left   = data.leftN   * canvas.width;
            top    = data.topN    * canvas.height;
            scaleX = data.scaleXN * canvas.width  / nW;
            scaleY = data.scaleYN * canvas.height / nH;
        } else {
            // Legacy absolute-pixel fallback
            left = data.left; top = data.top; scaleX = data.scaleX; scaleY = data.scaleY;
        }

        img.set({ left, top, scaleX, scaleY, angle: data.angle, id: snapshot.key, zIndex: data.zIndex ?? 0 });
        img._normCoords = data.leftN !== undefined
            ? { leftN: data.leftN, topN: data.topN, scaleXN: data.scaleXN, scaleYN: data.scaleYN, naturalW: nW, naturalH: nH }
            : null;

        lockObject(img);
        canvas.add(img);
        applyZOrder();
        if (stagingObj) updateStagingSliderRange();
    }, { crossOrigin: 'anonymous' });
});


// ── 15. FIREBASE → CANVAS: updated / removed ─────────────────
objectsRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const obj  = canvas.getObjects().find(o => o.id === snapshot.key);
    if (!obj) return;
    obj.zIndex = data.zIndex ?? obj.zIndex;
    applyZOrder();
    if (stagingObj) updateStagingSliderRange();
});

objectsRef.on('child_removed', (snapshot) => {
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) { canvas.remove(obj); canvas.renderAll(); }
    if (stagingObj) updateStagingSliderRange();
});

// Full wipe (Reset All) — overlayImage is untouched
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
        canvas.getObjects()
            .filter(o => o.id !== '__staging__')
            .slice().forEach(o => canvas.remove(o));
        canvas.renderAll();
    }
});


// ── 16. RESET ALL ────────────────────────────────────────────
function clearOcean() {
    objectsRef.set(null);
    canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .slice().forEach(o => canvas.remove(o));
    canvas.renderAll();
}


// ── 17. QR CODE ──────────────────────────────────────────────
new QRCode(document.getElementById('qrcode'), {
    text: window.location.href, width: 128, height: 128
});
