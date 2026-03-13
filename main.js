// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//
//  Flow:
//   1. Student clicks an animal button → a staging copy appears
//      on their local canvas, fully editable (move/scale/rotate).
//   2. They drag the "Layer Position" slider to choose depth,
//      then confirm placement with Place It!
//      The slider tracks relative position (e.g. "2nd from top")
//      so that if new objects arrive while staging, the slider
//      automatically adjusts to maintain the same relative depth.
//   3. The final position is written to Firebase and locked for everyone.
//   4. "Cancel" removes the staging object without touching Firebase.
//
//  The overlay image is always rendered on top of all canvas objects
//  via canvas.overlayImage and is never cleared by Reset All.
//
//  Reset All has no password — button clears everything immediately.
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
    width:  window.innerWidth,
    height: window.innerHeight,
    selection: false
});

window.addEventListener('resize', () => {
    canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });
    // Keep overlay scaled to fill the canvas after resize
    if (canvas.overlayImage) {
        canvas.overlayImage.set({
            scaleX: canvas.width  / canvas.overlayImage.width,
            scaleY: canvas.height / canvas.overlayImage.height
        });
    }
    canvas.renderAll();
});


// ── 3. OVERLAY ───────────────────────────────────────────────
//  Uses canvas.overlayImage so Fabric always renders it ABOVE
//  every regular canvas object. It is never part of getObjects()
//  and therefore is never touched by Reset All.
function initOverlay(url) {
    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:    0,
            top:     0,
            scaleX:  canvas.width  / img.width,
            scaleY:  canvas.height / img.height,
            opacity: 0.5
        });
        // Assign to overlayImage — Fabric renders this after all objects
        canvas.overlayImage = img;
        canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
}

function setOverlayOpacity(value) {
    if (canvas.overlayImage) {
        canvas.overlayImage.set({ opacity: parseFloat(value) });
        canvas.renderAll();
    }
}

window.addEventListener('load', () => {
    initOverlay('assets/Michelangelo.jpg');
});


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
let stagingObj = null;   // the local-only Fabric object being positioned
let stagingUrl = null;   // stored url for Firebase write

// Tracks where the user intends to place relative to the stack:
//   { fromTop: N }    — N steps from the top  (0 = front/top)
//   { fromBottom: N } — N steps from the bottom (0 = back/bottom)
// Null while not staging.
let stagingLayerIntent = null;

/** Returns all permanent (non-staging) objects on the canvas. */
function getPlacedObjects() {
    return canvas.getObjects().filter(o => o.id !== '__staging__');
}

function startStaging(url) {
    if (stagingObj) cancelPlace();

    stagingUrl          = url;
    stagingLayerIntent  = null;   // will be set to fromTop:0 (front) in showStagingUI

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:        Math.round(window.innerWidth  * 0.3),
            top:         Math.round(window.innerHeight * 0.3),
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
//  Slider value: 1 = back (bottom of stack), max = front (top).

/** Called by the slider's oninput handler in HTML. */
function onLayerSliderInput(rawValue) {
    const value    = parseInt(rawValue);
    const placed   = getPlacedObjects();
    const total    = placed.length + 1;   // includes the staging object

    const fromTop    = total - value;     // 0 = top
    const fromBottom = value - 1;         // 0 = bottom

    // Anchor to whichever end is closer (ties go to top)
    stagingLayerIntent = (fromTop <= fromBottom)
        ? { fromTop }
        : { fromBottom };

    updateLayerLabel(value, total);
    applyZOrder();
}

/** Recomputes slider max & value to preserve the user's relative intent
 *  when new objects arrive while staging is active. */
function updateStagingSliderRange() {
    if (!stagingObj) return;

    const placed = getPlacedObjects();
    const total  = placed.length + 1;

    const slider = document.getElementById('layer-slider');
    slider.max   = total;

    let newValue;
    if (!stagingLayerIntent) {
        newValue = total;                                         // default: front
    } else if (stagingLayerIntent.fromTop !== undefined) {
        newValue = Math.max(1, total - stagingLayerIntent.fromTop);
    } else {
        newValue = Math.min(total, stagingLayerIntent.fromBottom + 1);
    }

    slider.value = newValue;
    updateLayerLabel(newValue, total);
    applyZOrder();
}

/** Updates the text label beneath the slider. */
function updateLayerLabel(value, total) {
    const el = document.getElementById('layer-label');
    if (value >= total)    el.textContent = 'Front (top layer)';
    else if (value === 1)  el.textContent = 'Back (bottom layer)';
    else                   el.textContent = `Layer ${value} of ${total}`;
}


// ── 7. CONFIRM / CANCEL ──────────────────────────────────────
function confirmPlace() {
    if (!stagingObj) return;

    const placed = getPlacedObjects()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    const slider   = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);

    // Compute a zIndex that slots the new object at sliderVal's position.
    let zIdx;
    if (placed.length === 0) {
        zIdx = 0;
    } else if (sliderVal <= 1) {
        zIdx = (placed[0].zIndex ?? 0) - 1;
    } else if (sliderVal > placed.length) {
        zIdx = (placed[placed.length - 1].zIndex ?? 0) + 1;
    } else {
        // Between placed[sliderVal-2] and placed[sliderVal-1] (0-indexed)
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
    slider.value = total;                // default: front

    stagingLayerIntent = { fromTop: 0 }; // anchored to front

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
//  Sorts all permanent objects by their zIndex, renders them
//  back-to-front, then inserts the staging object at the slider
//  position. canvas.overlayImage sits above everything automatically.
function applyZOrder() {
    const placed = getPlacedObjects()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    if (!stagingObj) {
        // No staging: simply re-stack permanent objects
        placed.forEach(o => canvas.bringToFront(o));
        canvas.renderAll();
        return;
    }

    const slider    = document.getElementById('layer-slider');
    const sliderVal = parseInt(slider.value || slider.max || 1);
    const total     = placed.length + 1;

    // Build full stack with staging inserted at sliderVal-1 (0-indexed, back→front)
    const stack = [...placed];
    stack.splice(sliderVal - 1, 0, stagingObj);

    // Apply: call bringToFront in order so the last call = topmost
    stack.forEach(o => canvas.bringToFront(o));

    // Manage selection: Fabric renders the active object above everything else,
    // which would break depth preview when staging is not at the top.
    if (sliderVal < total) {
        canvas.discardActiveObject();   // staging is buried — don't let Fabric float it
    } else {
        canvas.setActiveObject(stagingObj); // staging is at front — keep handles visible
    }

    canvas.renderAll();
}

// After the user finishes dragging the staging object when it is NOT at the top,
// discard the selection so Fabric stops floating it above other objects.
canvas.on('mouse:up', () => {
    if (stagingObj) {
        const slider    = document.getElementById('layer-slider');
        const sliderVal = parseInt(slider.value || slider.max || 1);
        const placed    = getPlacedObjects();
        if (sliderVal <= placed.length) {
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

        // If another student just placed while this user is still staging,
        // recalculate the slider range to keep the user's relative position.
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
    if (obj) {
        canvas.remove(obj);
        canvas.renderAll();
    }
    if (stagingObj) updateStagingSliderRange();
});

// When the entire ref is wiped (Reset All), clear every client's canvas.
// The overlay lives in canvas.overlayImage (not getObjects()) and is untouched.
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
    // Clear local canvas immediately; value listener handles all other clients.
    // canvas.overlayImage is untouched — it is not part of getObjects().
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
