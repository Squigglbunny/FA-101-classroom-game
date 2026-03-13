// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//
//  Flow:
//   1. Student clicks an animal button → a staging copy appears
//      on their local canvas, fully editable (move/scale/rotate).
//   2. They drag the "Layer Position" slider to choose depth,
//      then confirm with Place It!
//      The slider tracks relative position so if new objects
//      arrive while staging the depth intent is preserved.
//   3. The final position is written to Firebase and locked.
//   4. "Cancel" removes the staging object without touching Firebase.
//
//  Overlay behaviour:
//   • Michelangelo.jpg  — colour photo (loaded first; drives canvas aspect ratio)
//   • Michelangelo_outline.png — white pixels made transparent via pixel processing
//   • Toggle tabs switch which image is shown; opacity slider applies to the active one
//   • Both overlays live in canvas.overlayImage (above every canvas object)
//     and are never cleared by Reset All.
//
//  Canvas is letter-boxed to the artwork's aspect ratio and centred in the
//  viewport via CSS, so the composition always matches the painting on phones.
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
//  Start at window size; resized to artwork aspect ratio once
//  Michelangelo.jpg loads.  CSS centres the Fabric wrapper div.
const canvas = new fabric.Canvas('oceanCanvas', {
    width:     window.innerWidth,
    height:    window.innerHeight,
    selection: false
});

// Aspect ratio of the artwork (set when colour image loads)
let artworkAspect = null;

/** Return canvas dimensions that fit inside the window while
 *  preserving artworkAspect (letter-box / pillar-box). */
function computeCanvasSize() {
    if (!artworkAspect) {
        return { w: window.innerWidth, h: window.innerHeight };
    }
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const winAspect = winW / winH;
    if (winAspect > artworkAspect) {
        // Window is wider → constrained by height
        const h = winH;
        return { w: Math.floor(h * artworkAspect), h };
    } else {
        // Window is taller → constrained by width
        const w = winW;
        return { w, h: Math.floor(w / artworkAspect) };
    }
}

function resizeCanvas() {
    const { w, h } = computeCanvasSize();
    canvas.setDimensions({ width: w, height: h });
    rescaleOverlays();
    canvas.renderAll();
}

window.addEventListener('resize', resizeCanvas);


// ── 3. OVERLAY ───────────────────────────────────────────────
//  canvas.overlayImage is rendered by Fabric above all objects.
//  It is not in getObjects() so Reset All never touches it.

let overlayImages  = { color: null, outline: null }; // cached Fabric Images
let activeOverlay  = 'color';
let overlayOpacity = 0.5;

/** Scale a Fabric Image to fill the current canvas exactly. */
function scaleOverlayToCanvas(img) {
    img.set({
        left:   0,
        top:    0,
        scaleX: canvas.width  / img.width,
        scaleY: canvas.height / img.height
    });
}

/** Re-scale whichever overlay images have been loaded (called on resize). */
function rescaleOverlays() {
    if (overlayImages.color)   scaleOverlayToCanvas(overlayImages.color);
    if (overlayImages.outline) scaleOverlayToCanvas(overlayImages.outline);
}

/** Activate the named overlay ('color' or 'outline'). */
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

/** Update opacity on the currently active overlay. */
function setOverlayOpacity(value) {
    overlayOpacity = parseFloat(value);
    if (canvas.overlayImage) {
        canvas.overlayImage.set({ opacity: overlayOpacity });
        canvas.renderAll();
    }
}

/**
 * Process a Fabric Image by replacing near-white pixels with full
 * transparency on an offscreen canvas, then return a new Fabric Image
 * built from the processed data URL.
 *
 * @param {fabric.Image} fabricImg  - source image (must already be loaded)
 * @param {number}       threshold  - 0-255; pixels with R,G,B all above this become transparent
 * @param {function}     callback   - called with the processed fabric.Image
 */
function makeWhiteTransparent(fabricImg, threshold, callback) {
    const src = fabricImg.getElement();
    const w   = src.naturalWidth  || src.width;
    const h   = src.naturalHeight || src.height;

    const offscreen = document.createElement('canvas');
    offscreen.width  = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(src, 0, 0);

    const imageData = ctx.getImageData(0, 0, w, h);
    const d         = imageData.data;

    for (let i = 0; i < d.length; i += 4) {
        if (d[i] > threshold && d[i+1] > threshold && d[i+2] > threshold) {
            d[i+3] = 0; // fully transparent
        }
    }
    ctx.putImageData(imageData, 0, 0);

    fabric.Image.fromURL(offscreen.toDataURL('image/png'), callback);
}

/** Load both overlay images.  The colour image is loaded first so its
 *  dimensions can drive the canvas aspect ratio. */
function initOverlays() {
    fabric.Image.fromURL('assets/Michelangelo.jpg', (colorImg) => {
        // Derive artwork aspect ratio from the natural image dimensions
        artworkAspect = colorImg.width / colorImg.height;

        overlayImages.color = colorImg;
        colorImg.set({ opacity: overlayOpacity });

        // Size the canvas to the artwork before setting the overlay
        resizeCanvas();

        scaleOverlayToCanvas(colorImg);
        canvas.overlayImage = colorImg;
        canvas.renderAll();

        // Now load the outline (white → transparent)
        fabric.Image.fromURL('assets/Michelangelo_outline.png', (rawOutline) => {
            makeWhiteTransparent(rawOutline, 230, (processedOutline) => {
                overlayImages.outline = processedOutline;
                processedOutline.set({ opacity: overlayOpacity });
                scaleOverlayToCanvas(processedOutline);
                // Don't switch the active overlay here — user chose colour
            });
        }, { crossOrigin: 'anonymous' });

    }, { crossOrigin: 'anonymous' });
}

window.addEventListener('load', initOverlays);


// ── 4. ANIMAL BUTTONS ────────────────────────────────────────
const marineFiles = [
    'Seal.png',
    'Crab.png',
    'Jellyfish.png',
    'Kelp1.png',
    'Kelp2.png',
    'Octopus.png',
    'Orca1.png',
    'Orca2.png',
    'RedCoral.png',
    'SeaUrchin.png',
    'Starfish.png',
    'bg.jpg'
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


// ── 5. STAGING — editable object before placement ────────────
let stagingObj = null;   // local-only Fabric object being positioned
let stagingUrl = null;   // stored URL for the Firebase write

// Relative depth intent, preserved across incoming Firebase updates:
//   { fromTop: N }    — N layers from the top  (0 = front)
//   { fromBottom: N } — N layers from the bottom (0 = back)
let stagingLayerIntent = null;

/** All permanent (non-staging) objects on the canvas. */
function getPlacedObjects() {
    return canvas.getObjects().filter(o => o.id !== '__staging__');
}

function startStaging(url) {
    if (stagingObj) cancelPlace();

    stagingUrl         = url;
    stagingLayerIntent = null;

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:        Math.round(canvas.width  * 0.3),
            top:         Math.round(canvas.height * 0.3),
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


// ── 6. LAYER SLIDER ──────────────────────────────────────────
//  Slider: 1 = back (bottom), max = front (top)

function onLayerSliderInput(rawValue) {
    const value    = parseInt(rawValue);
    const placed   = getPlacedObjects();
    const total    = placed.length + 1;

    const fromTop    = total - value;
    const fromBottom = value - 1;

    stagingLayerIntent = (fromTop <= fromBottom)
        ? { fromTop }
        : { fromBottom };

    updateLayerLabel(value, total);
    applyZOrder();
}

/** Recompute slider range when the placed-object count changes mid-staging,
 *  keeping the user's relative depth intent intact. */
function updateStagingSliderRange() {
    if (!stagingObj) return;

    const placed = getPlacedObjects();
    const total  = placed.length + 1;
    const slider = document.getElementById('layer-slider');
    slider.max   = total;

    let newValue;
    if (!stagingLayerIntent) {
        newValue = total;
    } else if (stagingLayerIntent.fromTop !== undefined) {
        newValue = Math.max(1, total - stagingLayerIntent.fromTop);
    } else {
        newValue = Math.min(total, stagingLayerIntent.fromBottom + 1);
    }

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


// ── 7. CONFIRM / CANCEL ──────────────────────────────────────
function confirmPlace() {
    if (!stagingObj) return;

    const placed    = getPlacedObjects()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);

    let zIdx;
    if (placed.length === 0) {
        zIdx = 0;
    } else if (sliderVal <= 1) {
        zIdx = (placed[0].zIndex ?? 0) - 1;
    } else if (sliderVal > placed.length) {
        zIdx = (placed[placed.length - 1].zIndex ?? 0) + 1;
    } else {
        const below = placed[sliderVal - 2]?.zIndex ?? 0;
        const above = placed[sliderVal - 1]?.zIndex ?? 0;
        zIdx = (below + above) / 2;
    }

    objectsRef.child('obj_' + Date.now()).set({
        url:    stagingUrl,
        left:   Math.round(stagingObj.left),
        top:    Math.round(stagingObj.top),
        scaleX: stagingObj.scaleX,
        scaleY: stagingObj.scaleY,
        angle:  stagingObj.angle,
        zIndex: zIdx
    });

    canvas.remove(stagingObj);
    stagingObj         = null;
    stagingUrl         = null;
    stagingLayerIntent = null;
    hideStagingUI();
    canvas.renderAll();
}

function cancelPlace() {
    if (stagingObj) {
        canvas.remove(stagingObj);
        canvas.discardActiveObject();
        stagingObj         = null;
        stagingUrl         = null;
        stagingLayerIntent = null;
        canvas.renderAll();
    }
    hideStagingUI();
}


// ── 8. STAGING UI SHOW / HIDE ────────────────────────────────
function showStagingUI() {
    const placed = getPlacedObjects();
    const total  = placed.length + 1;
    const slider = document.getElementById('layer-slider');
    slider.min   = 1;
    slider.max   = total;
    slider.value = total;                  // default: front
    stagingLayerIntent = { fromTop: 0 };

    updateLayerLabel(total, total);

    document.getElementById('staging-banner').classList.add('active');
    document.getElementById('staging-depth-row').classList.add('active');
    document.getElementById('btn-confirm-place').classList.add('active');
    document.getElementById('btn-cancel-place').classList.add('active');
}

function hideStagingUI() {
    document.getElementById('staging-banner').classList.remove('active');
    document.getElementById('staging-depth-row').classList.remove('active');
    document.getElementById('btn-confirm-place').classList.remove('active');
    document.getElementById('btn-cancel-place').classList.remove('active');
}


// ── 9. LOCK HELPER ───────────────────────────────────────────
function lockObject(obj) {
    obj.set({
        selectable:    false,
        evented:       false,
        lockMovementX: true,
        lockMovementY: true,
        lockScalingX:  true,
        lockScalingY:  true,
        lockRotation:  true,
        hasControls:   false,
        hasBorders:    false,
        opacity:       1
    });
}


// ── 10. Z-ORDER ──────────────────────────────────────────────
//  canvas.overlayImage always renders above everything automatically;
//  this function only manages the permanent objects + staging object.
function applyZOrder() {
    const placed = getPlacedObjects()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

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
        canvas.discardActiveObject();   // buried — don't let Fabric float it
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


// ── 11. FIREBASE → CANVAS: new object ────────────────────────
objectsRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    if (canvas.getObjects().find(o => o.id === snapshot.key)) return;

    fabric.Image.fromURL(data.url, (img) => {
        img.set({
            left:   data.left,
            top:    data.top,
            scaleX: data.scaleX,
            scaleY: data.scaleY,
            angle:  data.angle,
            id:     snapshot.key,
            zIndex: data.zIndex ?? 0
        });
        lockObject(img);
        canvas.add(img);
        applyZOrder();
        if (stagingObj) updateStagingSliderRange();
    }, { crossOrigin: 'anonymous' });
});


// ── 12. FIREBASE → CANVAS: object updated ────────────────────
objectsRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const obj  = canvas.getObjects().find(o => o.id === snapshot.key);
    if (!obj) return;
    obj.zIndex = data.zIndex ?? obj.zIndex;
    applyZOrder();
    if (stagingObj) updateStagingSliderRange();
});


// ── 13. FIREBASE → CANVAS: object removed ────────────────────
objectsRef.on('child_removed', (snapshot) => {
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) { canvas.remove(obj); canvas.renderAll(); }
    if (stagingObj) updateStagingSliderRange();
});

// Reset All wipe: canvas.overlayImage is not in getObjects() → untouched
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
        canvas.getObjects()
            .filter(o => o.id !== '__staging__')
            .slice()
            .forEach(o => canvas.remove(o));
        canvas.renderAll();
    }
});


// ── 14. RESET ALL ────────────────────────────────────────────
function clearOcean() {
    objectsRef.set(null);
    canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .slice()
        .forEach(o => canvas.remove(o));
    canvas.renderAll();
}


// ── 15. QR CODE ──────────────────────────────────────────────
new QRCode(document.getElementById('qrcode'), {
    text:   window.location.href,
    width:  128,
    height: 128
});
