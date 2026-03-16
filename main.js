// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//
//  Coordinates stored as normalised fractions (0-1) of canvas
//  size in Firebase so every device/orientation matches the overlay.
//
//  New in this version:
//   • Placement cooldown   — 6 s between confirms; countdown on button
//   • Persist staging      — after confirm, staging restarts ⅕ offset away
//   • Flip (flipX)         — stored in Firebase; applied on load
//   • Display / kiosk mode — Ctrl+Shift+H hides all UI
//   • Teacher mode         — password-gated; syncs lock/overlay via Firebase
//   • Undo                 — removes the client's last placed object
//   • Keyboard shortcuts   — Ctrl+Shift+H, Ctrl+Shift+T, Esc
// ============================================================

const TEACHER_PASSWORD = 'teach';  // ← change this to your preferred password
const COOLDOWN_MS      = 6000;     // ms between confirmed placements


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
const db               = firebase.database();
const objectsRef       = db.ref('marine-objects');
const teacherSettingsRef = db.ref('teacher-settings');


// ── 2. CANVAS ────────────────────────────────────────────────
const canvas = new fabric.Canvas('oceanCanvas', {
    width: window.innerWidth, height: window.innerHeight,
    selection: false
});

let artworkAspect = null;

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

    canvas.getObjects()
        .filter(o => o.id !== '__staging__' && o._normCoords)
        .forEach(applyNormCoords);

    if (stagingObj && oldW && oldH) {
        stagingObj.set({
            left: stagingObj.left * (w / oldW),
            top:  stagingObj.top  * (h / oldH)
        });
        stagingObj.setCoords();
    }

    rescaleOverlays();
    sizeBorderBars();
    canvas.renderAll();
}

window.addEventListener('resize', resizeCanvas);


// ── 3. NORMALISED COORDINATE HELPERS ─────────────────────────
function storeNormCoords(obj) {
    const nW = obj.width, nH = obj.height;
    obj._normCoords = {
        leftN: obj.left / canvas.width, topN: obj.top / canvas.height,
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
let overlayOpacity = 0;

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
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ctx = off.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const id = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4)
        if (id.data[i] > threshold && id.data[i+1] > threshold && id.data[i+2] > threshold)
            id.data[i+3] = 0;
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


// ── 4b. INSET BORDER BARS ────────────────────────────────────
//  Four solid fabric.Rect objects forming a frame inset from the
//  canvas edges. Because they are real Fabric objects they zoom
//  and pan in perfect sync with the image and all placed creatures.
//  They are excluded from every other game operation via their IDs.

const BORDER_INSET = 0.045;   // fraction of the smaller canvas dimension
const BORDER_IDS   = ['__border_top__','__border_bottom__','__border_left__','__border_right__'];
let borderRects = [];

function createBorderBars() {
    borderRects = BORDER_IDS.map(id => {
        const r = new fabric.Rect({
            fill: '#000', selectable: false, evented: false,
            hasControls: false, hasBorders: false,
            lockMovementX: true, lockMovementY: true,
            id: id
        });
        canvas.add(r);
        return r;
    });
    sizeBorderBars();
}

function sizeBorderBars() {
    if (borderRects.length === 0) return;
    const w     = canvas.width;
    const h     = canvas.height;
    const inset = Math.round(Math.min(w, h) * BORDER_INSET);
    const [top, bottom, left, right] = borderRects;

    // Bars sit just OUTSIDE the image rectangle (image occupies 0,0 → w,h).
    // Inner edges flush with the image boundary; outer edges extend by inset.
    top.set    ({ left: -inset,  top: -inset, width: w + inset * 2, height: inset });
    bottom.set ({ left: -inset,  top: h,      width: w + inset * 2, height: inset });
    left.set   ({ left: -inset,  top: -inset, width: inset,         height: h + inset * 2 });
    right.set  ({ left: w,       top: -inset, width: inset,         height: h + inset * 2 });

    borderRects.forEach(r => r.setCoords());
    bringBorderBarsToFront();
}

function bringBorderBarsToFront() {
    borderRects.forEach(r => canvas.bringToFront(r));
}

window.addEventListener('load', createBorderBars);


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
    btn.onclick = () => { if (!teacherSettings.locked) startStaging(`assets/${fileName}`); };
    container.appendChild(btn);
});


// ── 6. COOLDOWN ──────────────────────────────────────────────
let cooldownEnd   = 0;
let cooldownTimer = null;

function startCooldown() {
    cooldownEnd = Date.now() + COOLDOWN_MS;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
        if (Date.now() >= cooldownEnd) {
            clearInterval(cooldownTimer);
            cooldownTimer = null;
            cooldownEnd   = 0;
        }
        updateCooldownUI();
    }, 200);
    updateCooldownUI();
}

function isOnCooldown() { return Date.now() < cooldownEnd; }

function updateCooldownUI() {
    const btn = document.getElementById('btn-confirm-place');
    if (!btn) return;
    if (isOnCooldown()) {
        const secs = Math.ceil((cooldownEnd - Date.now()) / 1000);
        btn.textContent = `⏳ ${secs}s`;
        btn.disabled    = true;
    } else {
        btn.textContent = '✅ Place It!';
        btn.disabled    = false;
    }
}


// ── 7. STAGING ───────────────────────────────────────────────
let stagingObj         = null;
let stagingUrl         = null;
let stagingLayerIntent = null;
let stagingFlipped     = false;

function getPlacedObjects() {
    return canvas.getObjects().filter(o => o.id !== '__staging__' && !BORDER_IDS.includes(o.id));
}

function startStaging(url, opts = {}) {
    if (stagingObj) cancelPlace(/*silent*/ true);

    // Auto-close sidebar on mobile
    if (window.innerWidth < 768) closeSidebar();

    stagingUrl         = url;
    stagingLayerIntent = null;
    stagingFlipped     = opts.flipX ?? false;

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:        opts.left   ?? canvas.width  * 0.5,
            top:         opts.top    ?? canvas.height * 0.4,
            scaleX:      opts.scaleX ?? 0.5,
            scaleY:      opts.scaleY ?? 0.5,
            angle:       opts.angle  ?? 0,
            flipX:       stagingFlipped,
            opacity:     1,
            selectable:  true, evented:     true,
            hasControls: true, hasBorders:  true,
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

function flipStaging() {
    if (!stagingObj) return;
    stagingFlipped = !stagingFlipped;
    stagingObj.set({ flipX: stagingFlipped });
    document.getElementById('btn-flip').classList.toggle('flipped', stagingFlipped);
    canvas.renderAll();
}


// ── 8. LAYER SLIDER ──────────────────────────────────────────
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


// ── 9. CONFIRM / CANCEL ──────────────────────────────────────
const myPlacedKeys = [];   // keys of objects THIS client has placed (for undo)

function confirmPlace() {
    if (!stagingObj || isOnCooldown()) return;

    const placed    = getPlacedObjects().sort((a,b) => (a.zIndex??0)-(b.zIndex??0));
    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);

    let zIdx;
    if (placed.length === 0)            zIdx = 0;
    else if (sliderVal <= 1)            zIdx = (placed[0].zIndex ?? 0) - 1;
    else if (sliderVal > placed.length) zIdx = (placed[placed.length-1].zIndex ?? 0) + 1;
    else {
        const below = placed[sliderVal-2]?.zIndex ?? 0;
        const above = placed[sliderVal-1]?.zIndex ?? 0;
        zIdx = (below + above) / 2;
    }

    const naturalW = stagingObj.width;
    const naturalH = stagingObj.height;
    const key      = 'obj_' + Date.now();

    objectsRef.child(key).set({
        url:    stagingUrl,
        angle:  stagingObj.angle,
        flipX:  stagingFlipped,
        zIndex: zIdx,
        leftN:   stagingObj.left   / canvas.width,
        topN:    stagingObj.top    / canvas.height,
        scaleXN: stagingObj.scaleX * naturalW / canvas.width,
        scaleYN: stagingObj.scaleY * naturalH / canvas.height
    });

    myPlacedKeys.push(key);
    updateUndoButton();
    startCooldown();

    // ── Persist staging: restart with ⅕ offset (≈0.8 % of canvas width)
    const OFFSET  = Math.round(canvas.width * 0.008);
    const prevL   = stagingObj.left;
    const prevT   = stagingObj.top;
    const prevSX  = stagingObj.scaleX;
    const prevSY  = stagingObj.scaleY;
    const prevAng = stagingObj.angle;
    const prevFX  = stagingFlipped;
    const prevUrl = stagingUrl;

    canvas.remove(stagingObj);
    stagingObj = null; stagingUrl = null; stagingLayerIntent = null;
    canvas.renderAll();

    const newLeft = Math.min(canvas.width  - 20, Math.max(5, prevL + OFFSET));
    const newTop  = Math.min(canvas.height - 20, Math.max(5, prevT + OFFSET));
    startStaging(prevUrl, { left: newLeft, top: newTop, scaleX: prevSX, scaleY: prevSY, angle: prevAng, flipX: prevFX });
}

function cancelPlace(silent = false) {
    if (stagingObj) {
        canvas.remove(stagingObj);
        canvas.discardActiveObject();
        stagingObj = null; stagingUrl = null; stagingLayerIntent = null; stagingFlipped = false;
        canvas.renderAll();
    }
    if (!silent) hideStagingUI();
}


// ── 10. UNDO ─────────────────────────────────────────────────
function undoLastPlace() {
    if (myPlacedKeys.length === 0) return;
    const key = myPlacedKeys.pop();
    objectsRef.child(key).remove();
    updateUndoButton();
}

function updateUndoButton() {
    const btn = document.getElementById('btn-undo');
    if (!btn) return;
    btn.disabled = myPlacedKeys.length === 0;
}


// ── 11. STAGING UI ───────────────────────────────────────────
function showStagingUI() {
    const total  = getPlacedObjects().length + 1;
    const slider = document.getElementById('layer-slider');
    slider.min = 1; slider.max = total; slider.value = total;
    stagingLayerIntent = { fromTop: 0 };
    updateLayerLabel(total, total);

    // Sync flip button visual state
    document.getElementById('btn-flip').classList.toggle('flipped', stagingFlipped);

    updateCooldownUI();   // reflect any active cooldown on the button
    document.getElementById('staging-bar').classList.add('active');
}

function hideStagingUI() {
    document.getElementById('staging-bar').classList.remove('active');
}


// ── 12. LOCK HELPER ──────────────────────────────────────────
function lockObject(obj) {
    obj.set({
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockScalingX: true,  lockScalingY: true,
        lockRotation: true,  hasControls: false,
        hasBorders: false,   opacity: 1
    });
}


// ── 13. Z-ORDER ──────────────────────────────────────────────
function applyZOrder() {
    const placed = getPlacedObjects().sort((a,b) => (a.zIndex??0)-(b.zIndex??0));
    if (!stagingObj) {
        placed.forEach(o => canvas.bringToFront(o));
        bringBorderBarsToFront();
        canvas.renderAll();
        return;
    }

    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);
    const total     = placed.length + 1;

    const stack = [...placed];
    stack.splice(sliderVal - 1, 0, stagingObj);
    stack.forEach(o => canvas.bringToFront(o));

    if (sliderVal < total) canvas.discardActiveObject();
    else                   canvas.setActiveObject(stagingObj);

    bringBorderBarsToFront();
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


// ── 14. ZOOM & PAN ───────────────────────────────────────────
const MIN_ZOOM = 0.4, MAX_ZOOM = 10;

// Scroll-wheel zoom (desktop)
canvas.wrapperEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect  = canvas.wrapperEl.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    canvas.zoomToPoint(point, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, canvas.getZoom() * factor)));
    canvas.renderAll();
}, { passive: false });

// Pinch-to-zoom + two-finger pan (mobile)
let pinchStartDist = null, pinchStartZoom = null, pinchLastMid = null;

function touchPoint(touches, i) {
    const r = canvas.wrapperEl.getBoundingClientRect();
    return { x: touches[i].clientX - r.left, y: touches[i].clientY - r.top };
}
function touchDist(touches) { const a=touchPoint(touches,0),b=touchPoint(touches,1); return Math.hypot(b.x-a.x,b.y-a.y); }
function touchMid(touches)  { const a=touchPoint(touches,0),b=touchPoint(touches,1); return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

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
    canvas.zoomToPoint(mid, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartZoom * (dist / pinchStartDist))));
    if (pinchLastMid) {
        const vpt = canvas.viewportTransform;
        vpt[4] += mid.x - pinchLastMid.x;
        vpt[5] += mid.y - pinchLastMid.y;
        canvas.requestRenderAll();
    }
    pinchLastMid = mid;
}, { passive: false });

canvas.wrapperEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) { pinchStartDist = pinchStartZoom = pinchLastMid = null; }
});

// Single-finger pan on empty canvas (not staging)
let isPanning = false, lastPanPt = null;

canvas.on('mouse:down', (opt) => {
    if (!stagingObj && !opt.target) {
        isPanning  = true;
        const e = opt.e;
        lastPanPt  = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                               : { x: e.clientX, y: e.clientY };
        canvas.defaultCursor = 'grabbing';
    }
});

canvas.on('mouse:move', (opt) => {
    if (!isPanning || !lastPanPt) return;
    const e   = opt.e;
    const cur = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                          : { x: e.clientX, y: e.clientY };
    const vpt = canvas.viewportTransform;
    vpt[4] += cur.x - lastPanPt.x;
    vpt[5] += cur.y - lastPanPt.y;
    canvas.requestRenderAll();
    lastPanPt = cur;
});

canvas.on('mouse:up', () => { isPanning = false; lastPanPt = null; canvas.defaultCursor = 'default'; });

function resetZoom() {
    canvas.setViewportTransform([1,0,0,1,0,0]);
    canvas.renderAll();
}


// ── 15. DISPLAY / KIOSK MODE ─────────────────────────────────
let displayMode = false;

function toggleDisplayMode() {
    displayMode = !displayMode;
    document.body.classList.toggle('display-mode', displayMode);
    // Entering display mode cancels any active staging (clean projection)
    if (displayMode && stagingObj) cancelPlace(true);
}


// ── 16. TEACHER MODE ─────────────────────────────────────────
let isTeacherMode   = false;
let teacherSettings = { locked: false, overlayEnabled: true };

// Listen for settings pushed by teacher (syncs to all clients)
teacherSettingsRef.on('value', (snapshot) => {
    const s = snapshot.val() || {};
    teacherSettings = {
        locked:         s.locked         ?? false,
        overlayEnabled: s.overlayEnabled ?? true
    };
    applyTeacherSettings();
});

function applyTeacherSettings() {
    // Lock / unlock animal buttons
    document.querySelectorAll('#button-container button').forEach(btn => {
        btn.disabled = teacherSettings.locked;
    });

    // If locked mid-staging, cancel immediately
    if (teacherSettings.locked && stagingObj) cancelPlace();

    // Locked notice banner
    const notice = document.getElementById('locked-notice');
    if (notice) notice.style.display = teacherSettings.locked ? 'block' : 'none';

    // Show/hide overlay controls section
    const overlayCtrl = document.getElementById('overlay-controls');
    const hr = overlayCtrl ? overlayCtrl.previousElementSibling : null;
    if (overlayCtrl) overlayCtrl.style.display = teacherSettings.overlayEnabled ? '' : 'none';
    if (hr && hr.tagName === 'HR') hr.style.display = teacherSettings.overlayEnabled ? '' : 'none';

    // Update teacher panel buttons
    const lockBtn = document.getElementById('tp-lock-btn');
    if (lockBtn) {
        lockBtn.textContent = teacherSettings.locked ? '🔒 Locked' : '🔓 Unlocked';
        lockBtn.classList.toggle('tp-active', teacherSettings.locked);
    }
    const overlayBtn = document.getElementById('tp-overlay-btn');
    if (overlayBtn) {
        overlayBtn.textContent = teacherSettings.overlayEnabled ? '👁 Visible' : '🚫 Hidden';
        overlayBtn.classList.toggle('tp-active', !teacherSettings.overlayEnabled);
    }
}

function openTeacherModal() {
    if (isTeacherMode) {
        // Already authenticated — just show the panel again
        document.getElementById('teacher-panel').classList.add('active');
        return;
    }
    const modal = document.getElementById('teacher-modal');
    modal.classList.add('active');
    document.getElementById('teacher-password').value = '';
    document.getElementById('teacher-pw-error').textContent = '';
    setTimeout(() => document.getElementById('teacher-password').focus(), 100);
}

function closeTeacherModal() {
    document.getElementById('teacher-modal').classList.remove('active');
}

function submitTeacherPassword() {
    const pw = document.getElementById('teacher-password').value;
    if (pw === TEACHER_PASSWORD) {
        isTeacherMode = true;
        closeTeacherModal();
        document.getElementById('teacher-panel').classList.add('active');
    } else {
        document.getElementById('teacher-pw-error').textContent = 'Incorrect password';
        document.getElementById('teacher-password').select();
    }
}

function exitTeacherMode() {
    isTeacherMode = false;
    document.getElementById('teacher-panel').classList.remove('active');
}

function teacherToggleLock() {
    teacherSettingsRef.update({ locked: !teacherSettings.locked });
}

function teacherToggleOverlay() {
    teacherSettingsRef.update({ overlayEnabled: !teacherSettings.overlayEnabled });
}

function teacherClearAll() {
    if (window.confirm('Clear everything from the canvas for all students?')) clearOcean();
}


// ── 17. HELP MODAL ───────────────────────────────────────────
function openHelp()  { document.getElementById('help-modal').classList.add('active'); }
function closeHelp() { document.getElementById('help-modal').classList.remove('active'); }


// ── 18. SIDEBAR TOGGLE (mobile) ──────────────────────────────
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


// ── 19. KEYBOARD SHORTCUTS ───────────────────────────────────
document.addEventListener('keydown', (e) => {
    // Ctrl+Shift+H — toggle display/kiosk mode
    if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        toggleDisplayMode();
        return;
    }
    // Ctrl+Shift+T — toggle teacher mode
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        if (isTeacherMode) exitTeacherMode();
        else openTeacherModal();
        return;
    }
    // Escape — close any open modal or exit display mode
    if (e.key === 'Escape') {
        if (displayMode) { toggleDisplayMode(); return; }
        closeTeacherModal();
        closeHelp();
    }
});


// ── 20. FIREBASE → CANVAS: new object ────────────────────────
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
            left = data.left; top = data.top; scaleX = data.scaleX; scaleY = data.scaleY;
        }

        img.set({ left, top, scaleX, scaleY,
                  angle: data.angle, flipX: data.flipX ?? false,
                  id: snapshot.key, zIndex: data.zIndex ?? 0 });

        img._normCoords = data.leftN !== undefined
            ? { leftN: data.leftN, topN: data.topN,
                scaleXN: data.scaleXN, scaleYN: data.scaleYN,
                naturalW: nW, naturalH: nH }
            : null;

        lockObject(img);
        canvas.add(img);
        applyZOrder();
        if (stagingObj) updateStagingSliderRange();
    }, { crossOrigin: 'anonymous' });
});


// ── 21. FIREBASE → CANVAS: updated / removed ─────────────────
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

// Full wipe — overlayImage and border bars are untouched
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
        canvas.getObjects()
            .filter(o => o.id !== '__staging__' && !BORDER_IDS.includes(o.id))
            .slice().forEach(o => canvas.remove(o));
        canvas.renderAll();
    }
});


// ── 22. RESET ALL ────────────────────────────────────────────
function clearOcean() {
    objectsRef.set(null);
    canvas.getObjects()
        .filter(o => o.id !== '__staging__' && !BORDER_IDS.includes(o.id))
        .slice().forEach(o => canvas.remove(o));
    canvas.renderAll();
}


// ── 23. QR CODE ──────────────────────────────────────────────
new QRCode(document.getElementById('qrcode'), {
    text: window.location.href, width: 128, height: 128
});
