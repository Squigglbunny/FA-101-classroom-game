// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//
//  Coordinate system — WHY NORMALISED?
//  ─────────────────────────────────────
//  Every placed object is stored in Firebase with normalised
//  coordinates (leftN, topN, scaleXN, scaleYN) in the range 0-1,
//  where 1 = full canvas width or height.
//
//  Formula:
//    leftN   = left   / canvasWidth
//    topN    = top    / canvasHeight
//    scaleXN = scaleX * naturalImgW / canvasWidth
//    scaleYN = scaleY * naturalImgH / canvasHeight
//
//  On load (or resize), pixel values are recovered:
//    left   = leftN   * canvasWidth
//    top    = topN    * canvasHeight
//    scaleX = scaleXN * canvasWidth  / naturalImgW
//    scaleY = scaleYN * canvasHeight / naturalImgH
//
//  This means rotating the phone, switching devices, or joining
//  mid-session all produce correctly scaled/positioned objects
//  that align with the Michelangelo overlay.
//
//  Overlay behaviour:
//   • Michelangelo.jpg       — colour photo; drives canvas aspect ratio
//   • Michelangelo_outline.png — white → transparent via pixel processing
//   • Toggle tabs switch overlays; opacity slider applies to active one
//   • Both overlays live in canvas.overlayImage (above every canvas
//     object) and are never cleared by Reset All.
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

// Set once Michelangelo.jpg loads; drives letterbox sizing
let artworkAspect = null;

/** Largest canvas size that fits the viewport while preserving artworkAspect. */
function computeCanvasSize() {
    if (!artworkAspect) return { w: window.innerWidth, h: window.innerHeight };
    const winW      = window.innerWidth;
    const winH      = window.innerHeight;
    const winAspect = winW / winH;
    if (winAspect > artworkAspect) {
        const h = winH;
        return { w: Math.floor(h * artworkAspect), h };
    } else {
        const w = winW;
        return { w, h: Math.floor(w / artworkAspect) };
    }
}

/**
 * Resize the canvas, then reposition every placed object from its
 * stored normalised coordinates so it stays aligned with the overlay.
 * Also proportionally moves the in-progress staging object.
 */
function resizeCanvas() {
    const oldW = canvas.width;
    const oldH = canvas.height;

    const { w, h } = computeCanvasSize();
    canvas.setDimensions({ width: w, height: h });

    // Reposition permanent objects using their saved normalised coords
    canvas.getObjects()
        .filter(o => o.id !== '__staging__' && o._normCoords)
        .forEach(o => applyNormCoords(o));

    // Move the staging object proportionally (it hasn't been confirmed yet
    // so it has no normalised coords in Firebase)
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

/**
 * Store normalised coords on a Fabric Image object so they survive
 * resizes.  Call this right after the image is set up.
 *
 * @param {fabric.Image} obj  - Fabric Image with left/top/scaleX/scaleY set
 */
function storeNormCoords(obj) {
    const naturalW = obj.width;   // Fabric Image.width is the natural (pre-scale) dimension
    const naturalH = obj.height;
    obj._normCoords = {
        leftN:   obj.left   / canvas.width,
        topN:    obj.top    / canvas.height,
        scaleXN: obj.scaleX * naturalW / canvas.width,
        scaleYN: obj.scaleY * naturalH / canvas.height,
        naturalW,
        naturalH
    };
}

/**
 * Apply the stored normalised coords to a Fabric Image, converting back
 * to pixel values for the current canvas size.
 *
 * @param {fabric.Image} obj
 */
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
//  canvas.overlayImage is rendered by Fabric ABOVE all canvas objects.
//  It is not in getObjects() so Reset All never touches it.

let overlayImages  = { color: null, outline: null };
let activeOverlay  = 'color';
let overlayOpacity = 0.5;

function scaleOverlayToCanvas(img) {
    img.set({
        left:   0,
        top:    0,
        scaleX: canvas.width  / img.width,
        scaleY: canvas.height / img.height
    });
}

function rescaleOverlays() {
    if (overlayImages.color)   scaleOverlayToCanvas(overlayImages.color);
    if (overlayImages.outline) scaleOverlayToCanvas(overlayImages.outline);
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

/**
 * Replace near-white pixels (all channels > threshold) with full
 * transparency on an offscreen canvas, then return a new Fabric Image.
 */
function makeWhiteTransparent(fabricImg, threshold, callback) {
    const src = fabricImg.getElement();
    const w   = src.naturalWidth  || src.width;
    const h   = src.naturalHeight || src.height;

    const offscreen    = document.createElement('canvas');
    offscreen.width    = w;
    offscreen.height   = h;
    const ctx          = offscreen.getContext('2d');
    ctx.drawImage(src, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);
    const d         = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i] > threshold && d[i+1] > threshold && d[i+2] > threshold) {
            d[i+3] = 0;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    fabric.Image.fromURL(offscreen.toDataURL('image/png'), callback);
}

/** Load both overlays. Colour image loads first to set artworkAspect. */
function initOverlays() {
    fabric.Image.fromURL('assets/Michelangelo.jpg', (colorImg) => {
        artworkAspect       = colorImg.width / colorImg.height;
        overlayImages.color = colorImg;
        colorImg.set({ opacity: overlayOpacity });

        resizeCanvas();                   // correct canvas size BEFORE setting overlay
        scaleOverlayToCanvas(colorImg);
        canvas.overlayImage = colorImg;
        canvas.renderAll();

        // Load and process the outline overlay
        fabric.Image.fromURL('assets/Michelangelo_outline.png', (rawOutline) => {
            makeWhiteTransparent(rawOutline, 230, (processedOutline) => {
                overlayImages.outline = processedOutline;
                processedOutline.set({ opacity: overlayOpacity });
                scaleOverlayToCanvas(processedOutline);
            });
        }, { crossOrigin: 'anonymous' });

    }, { crossOrigin: 'anonymous' });
}

window.addEventListener('load', initOverlays);


// ── 5. ANIMAL BUTTONS ────────────────────────────────────────
const marineFiles = [
    'Seal.png', 'Crab.png', 'Jellyfish.png', 'Kelp1.png', 'Kelp2.png',
    'Octopus.png', 'Orca1.png', 'Orca2.png', 'RedCoral.png',
    'SeaUrchin.png', 'Starfish.png', 'bg.jpg'
];

const container = document.getElementById('button-container');
marineFiles.forEach(fileName => {
    const btn   = document.createElement('button');
    const base  = fileName.replace(/\.[^.]+$/, '');
    const label = base.replace(/_/g, ' ').replace(/([a-z])(\d)/g, '$1 $2');
    btn.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    btn.onclick = () => startStaging(`assets/${fileName}`);
    container.appendChild(btn);
});


// ── 6. STAGING ───────────────────────────────────────────────
let stagingObj         = null;
let stagingUrl         = null;
let stagingLayerIntent = null;   // { fromTop: N } or { fromBottom: N }

function getPlacedObjects() {
    return canvas.getObjects().filter(o => o.id !== '__staging__');
}

function startStaging(url) {
    if (stagingObj) cancelPlace();
    stagingUrl         = url;
    stagingLayerIntent = null;

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:        canvas.width  * 0.3,
            top:         canvas.height * 0.3,
            scaleX:      0.5,
            scaleY:      0.5,
            angle:       0,
            opacity:     1,
            selectable:  true,
            evented:     true,
            hasControls: true,
            hasBorders:  true,
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
    const value    = parseInt(rawValue);
    const total    = getPlacedObjects().length + 1;
    const fromTop    = total - value;
    const fromBottom = value - 1;

    stagingLayerIntent = (fromTop <= fromBottom) ? { fromTop } : { fromBottom };
    updateLayerLabel(value, total);
    applyZOrder();
}

function updateStagingSliderRange() {
    if (!stagingObj) return;
    const placed = getPlacedObjects();
    const total  = placed.length + 1;
    const slider = document.getElementById('layer-slider');
    slider.max   = total;

    let newValue;
    if (!stagingLayerIntent)                          newValue = total;
    else if (stagingLayerIntent.fromTop !== undefined) newValue = Math.max(1, total - stagingLayerIntent.fromTop);
    else                                               newValue = Math.min(total, stagingLayerIntent.fromBottom + 1);

    slider.value = newValue;
    updateLayerLabel(newValue, total);
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

    const placed    = getPlacedObjects().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);

    let zIdx;
    if (placed.length === 0)          zIdx = 0;
    else if (sliderVal <= 1)          zIdx = (placed[0].zIndex ?? 0) - 1;
    else if (sliderVal > placed.length) zIdx = (placed[placed.length - 1].zIndex ?? 0) + 1;
    else {
        const below = placed[sliderVal - 2]?.zIndex ?? 0;
        const above = placed[sliderVal - 1]?.zIndex ?? 0;
        zIdx = (below + above) / 2;
    }

    // ── Store normalised coordinates so any device/orientation renders correctly
    const naturalW = stagingObj.width;
    const naturalH = stagingObj.height;

    objectsRef.child('obj_' + Date.now()).set({
        url:    stagingUrl,
        angle:  stagingObj.angle,
        zIndex: zIdx,
        // Normalised position (0-1 fraction of canvas dimensions)
        leftN:   stagingObj.left   / canvas.width,
        topN:    stagingObj.top    / canvas.height,
        scaleXN: stagingObj.scaleX * naturalW / canvas.width,
        scaleYN: stagingObj.scaleY * naturalH / canvas.height
    });

    canvas.remove(stagingObj);
    stagingObj = null; stagingUrl = null; stagingLayerIntent = null;
    hideStagingUI();
    canvas.renderAll();
}

function cancelPlace() {
    if (stagingObj) {
        canvas.remove(stagingObj);
        canvas.discardActiveObject();
        stagingObj = null; stagingUrl = null; stagingLayerIntent = null;
        canvas.renderAll();
    }
    hideStagingUI();
}


// ── 9. STAGING UI ────────────────────────────────────────────
function showStagingUI() {
    const total  = getPlacedObjects().length + 1;
    const slider = document.getElementById('layer-slider');
    slider.min   = 1;
    slider.max   = total;
    slider.value = total;
    stagingLayerIntent = { fromTop: 0 };
    updateLayerLabel(total, total);

    ['staging-banner','staging-depth-row','btn-confirm-place','btn-cancel-place']
        .forEach(id => document.getElementById(id).classList.add('active'));
}

function hideStagingUI() {
    ['staging-banner','staging-depth-row','btn-confirm-place','btn-cancel-place']
        .forEach(id => document.getElementById(id).classList.remove('active'));
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
    const placed = getPlacedObjects().sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    if (!stagingObj) {
        placed.forEach(o => canvas.bringToFront(o));
        canvas.renderAll();
        return;
    }

    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);
    const total     = placed.length + 1;

    const stack = [...placed];
    stack.splice(sliderVal - 1, 0, stagingObj);
    stack.forEach(o => canvas.bringToFront(o));

    if (sliderVal < total) {
        canvas.discardActiveObject();
    } else {
        canvas.setActiveObject(stagingObj);
    }
    canvas.renderAll();
}

canvas.on('mouse:up', () => {
    if (stagingObj) {
        const slider    = document.getElementById('layer-slider');
        const sliderVal = parseInt(slider.value || slider.max || 1);
        if (sliderVal <= getPlacedObjects().length) {
            canvas.discardActiveObject();
            applyZOrder();
        }
    }
});


// ── 12. FIREBASE → CANVAS: new object ────────────────────────
objectsRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (canvas.getObjects().find(o => o.id === snapshot.key)) return;

    fabric.Image.fromURL(data.url, (img) => {
        const naturalW = img.width;
        const naturalH = img.height;

        // Support both normalised (new) and legacy absolute (old) records
        let left, top, scaleX, scaleY;
        if (data.leftN !== undefined) {
            left   = data.leftN   * canvas.width;
            top    = data.topN    * canvas.height;
            scaleX = data.scaleXN * canvas.width  / naturalW;
            scaleY = data.scaleYN * canvas.height / naturalH;
        } else {
            // Legacy: use absolute pixel values as-is
            left = data.left; top = data.top; scaleX = data.scaleX; scaleY = data.scaleY;
        }

        img.set({ left, top, scaleX, scaleY, angle: data.angle, id: snapshot.key, zIndex: data.zIndex ?? 0 });

        // Cache normalised coords so resizeCanvas() can reposition this object
        img._normCoords = data.leftN !== undefined
            ? { leftN: data.leftN, topN: data.topN, scaleXN: data.scaleXN, scaleYN: data.scaleYN, naturalW, naturalH }
            : null;   // legacy objects won't reposition on resize (no data to go on)

        lockObject(img);
        canvas.add(img);
        applyZOrder();
        if (stagingObj) updateStagingSliderRange();
    }, { crossOrigin: 'anonymous' });
});


// ── 13. FIREBASE → CANVAS: object updated ────────────────────
objectsRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const obj  = canvas.getObjects().find(o => o.id === snapshot.key);
    if (!obj) return;
    obj.zIndex = data.zIndex ?? obj.zIndex;
    applyZOrder();
    if (stagingObj) updateStagingSliderRange();
});


// ── 14. FIREBASE → CANVAS: object removed ────────────────────
objectsRef.on('child_removed', (snapshot) => {
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) { canvas.remove(obj); canvas.renderAll(); }
    if (stagingObj) updateStagingSliderRange();
});

// Reset All wipe — overlayImage is not in getObjects(), so it survives
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
        canvas.getObjects()
            .filter(o => o.id !== '__staging__')
            .slice().forEach(o => canvas.remove(o));
        canvas.renderAll();
    }
});


// ── 15. RESET ALL ────────────────────────────────────────────
function clearOcean() {
    objectsRef.set(null);
    canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .slice().forEach(o => canvas.remove(o));
    canvas.renderAll();
}


// ── 16. QR CODE ──────────────────────────────────────────────
new QRCode(document.getElementById('qrcode'), {
    text:   window.location.href,
    width:  128,
    height: 128
});
