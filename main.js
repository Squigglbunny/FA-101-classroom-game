// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//
//  Flow:
//   1. Student clicks an animal button → a staging copy appears
//      on their local canvas, fully editable (move/scale/rotate).
//   2. They choose Place Front or Place Back, then confirm.
//      Place Back: the staging object renders behind all existing
//      objects as a live preview before committing.
//   3. The final position is written to Firebase and locked for everyone.
//   4. "Cancel" removes the staging object without touching Firebase.
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
    canvas.renderAll();
});


// ── 3. ANIMAL BUTTONS ────────────────────────────────────────
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
    'Starfish.png'
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


// ── 4. STAGING — editable object before placement ────────────
let stagingObj     = null;   // the local-only Fabric object being positioned
let stagingUrl     = null;   // stored url so we don't rely on _element.src
let stagingDepth   = 'front'; // 'front' or 'back'

function startStaging(url) {
    if (stagingObj) cancelPlace();

    stagingUrl   = url;
    stagingDepth = 'front';

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:        Math.round(window.innerWidth  * 0.3),
            top:         Math.round(window.innerHeight * 0.3),
            scaleX:      0.5,
            scaleY:      0.5,
            angle:       0,
            opacity:     1,            // fully opaque while staging
            selectable:  true,
            evented:     true,
            hasControls: true,
            hasBorders:  true,
            id:          '__staging__'
        });

        stagingObj = img;
        canvas.add(img);
        canvas.bringToFront(img);      // starts at front
        canvas.setActiveObject(img);
        canvas.renderAll();

        showStagingUI();
    }, { crossOrigin: 'anonymous' });
}

// Called by the Front / Back toggle buttons in the sidebar
function setStagingDepth(dir) {
    stagingDepth = dir;

    document.getElementById('btn-place-front').classList.toggle('depth-active', dir === 'front');
    document.getElementById('btn-place-back').classList.toggle('depth-active',  dir === 'back');

    applyZOrder();
}

function confirmPlace() {
    if (!stagingObj) return;

    const placed = canvas.getObjects().filter(o => o.id !== '__staging__');
    let zIdx;

    if (stagingDepth === 'back') {
        const minZ = placed.length ? Math.min(...placed.map(o => o.zIndex ?? 0)) : 0;
        zIdx = minZ - 1;
    } else {
        const maxZ = placed.length ? Math.max(...placed.map(o => o.zIndex ?? 0)) : 0;
        zIdx = maxZ + 1;
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
    stagingObj   = null;
    stagingUrl   = null;
    hideStagingUI();
    canvas.renderAll();
}

function cancelPlace() {
    if (stagingObj) {
        canvas.remove(stagingObj);
        canvas.discardActiveObject();
        stagingObj = null;
        stagingUrl = null;
        canvas.renderAll();
    }
    hideStagingUI();
}

function showStagingUI() {
    document.getElementById('staging-banner').classList.add('active');
    document.getElementById('staging-depth-row').classList.add('active');
    document.getElementById('btn-confirm-place').classList.add('active');
    document.getElementById('btn-cancel-place').classList.add('active');
    // Reset toggle to Front
    document.getElementById('btn-place-front').classList.add('depth-active');
    document.getElementById('btn-place-back').classList.remove('depth-active');
}

function hideStagingUI() {
    document.getElementById('staging-banner').classList.remove('active');
    document.getElementById('staging-depth-row').classList.remove('active');
    document.getElementById('btn-confirm-place').classList.remove('active');
    document.getElementById('btn-cancel-place').classList.remove('active');
}


// ── 5. LOCK helper ───────────────────────────────────────────
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


// ── 6. Z-ORDER helper ────────────────────────────────────────
function applyZOrder() {
    const objs = canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .slice()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    canvas.discardActiveObject();
    objs.forEach(o => canvas.bringToFront(o));

    if (stagingObj) {
        if (stagingDepth === 'back') {
            canvas.sendToBack(stagingObj);
            // ✦ Do NOT call setActiveObject here — Fabric always renders
            //   the active object on top, defeating the back-preview entirely.
        } else {
            canvas.bringToFront(stagingObj);
            canvas.setActiveObject(stagingObj);
        }
    }

    canvas.renderAll();
}
// After the user finishes moving the staging object in "back" mode,
// drop the selection so Fabric stops rendering it in the top overlay.
canvas.on('mouse:up', () => {
    if (stagingObj && stagingDepth === 'back') {
        canvas.discardActiveObject();
        applyZOrder();
    }
});

// ── 7. FIREBASE → CANVAS: new object ─────────────────────────
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
    }, { crossOrigin: 'anonymous' });
});


// ── 8. FIREBASE → CANVAS: object updated ─────────────────────
objectsRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const obj  = canvas.getObjects().find(o => o.id === snapshot.key);
    if (!obj) return;
    obj.zIndex = data.zIndex ?? obj.zIndex;
    applyZOrder();
});


// ── 9. FIREBASE → CANVAS: object removed ─────────────────────
objectsRef.on('child_removed', (snapshot) => {
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) { canvas.remove(obj); canvas.renderAll(); }
});

// When the entire ref is wiped (Reset All), clear every client's canvas
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
        canvas.getObjects()
            .filter(o => o.id !== '__staging__')
            .slice()
            .forEach(o => canvas.remove(o));
        canvas.renderAll();
    }
});


// ── 10. RESET ALL (no password) ──────────────────────────────
function clearOcean() {
    objectsRef.set(null);
    // Clear local canvas immediately; value listener handles all other clients
    canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .slice()
        .forEach(o => canvas.remove(o));
    canvas.renderAll();
}


// ── 11. QR CODE ──────────────────────────────────────────────
new QRCode(document.getElementById('qrcode'), {
    text:   window.location.href,
    width:  128,
    height: 128
});
