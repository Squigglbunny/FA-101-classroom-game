// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//  Rules:
//   • Clicking an animal button shows a confirm modal first.
//   • Once placed, objects are fully locked (no move/scale/rotate).
//   • Bring to Front / Send to Back are stored in Firebase so
//     z-order is consistent across all devices.
//   • Delete Selected and Reset All require a teacher password.
// ============================================================

// ─────────────────────────────────────────────────────────────
// TEACHER PASSWORD — change this to whatever you like
// ─────────────────────────────────────────────────────────────
const TEACHER_PASSWORD = 'ocean123';


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
    // Disable the default selection box — objects are locked anyway
    selection: false
});

window.addEventListener('resize', () => {
    canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });
    canvas.renderAll();
});


// ── 3. ANIMAL BUTTONS ────────────────────────────────────────
const marineFiles = [
    'cl_seal.jpg',
    'crab.png',
    'jellyfish.png',
    'kelp1.png',
    'kelp2.png',
    'octopus.png',
    'orca1.png',
    'orca2.png',
    'redthing.png',
    'seaurchin.jpg'
];

const container = document.getElementById('button-container');

marineFiles.forEach(fileName => {
    const btn   = document.createElement('button');
    const base  = fileName.replace(/\.[^.]+$/, '');
    const label = base.replace(/_/g, ' ').replace(/([a-z])(\d)/g, '$1 $2');
    btn.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    btn.onclick = () => openConfirmModal(`assets/${fileName}`);
    container.appendChild(btn);
});


// ── 4. CONFIRM-PLACEMENT MODAL ───────────────────────────────
let pendingUrl = null;   // URL waiting for confirmation

function openConfirmModal(url) {
    pendingUrl = url;
    document.getElementById('confirm-preview').src = url;
    document.getElementById('confirm-modal').classList.add('active');
}

function cancelPlace() {
    pendingUrl = null;
    document.getElementById('confirm-modal').classList.remove('active');
}

function confirmPlace() {
    document.getElementById('confirm-modal').classList.remove('active');
    if (!pendingUrl) return;

    const id   = 'obj_' + Date.now();
    const zIdx = canvas.getObjects().length; // place on top of existing stack

    objectsRef.child(id).set({
        url:    pendingUrl,
        left:   Math.random() * (window.innerWidth  * 0.6) + 50,
        top:    Math.random() * (window.innerHeight * 0.6) + 50,
        scaleX: 0.5,
        scaleY: 0.5,
        angle:  0,
        zIndex: zIdx
    });

    pendingUrl = null;
}


// ── 5. HELPERS: lock an object so it cannot be edited ────────
function lockObject(obj) {
    obj.set({
        selectable:          false,
        evented:             false,
        lockMovementX:       true,
        lockMovementY:       true,
        lockScalingX:        true,
        lockScalingY:        true,
        lockRotation:        true,
        hasControls:         false,
        hasBorders:          false,
    });
}

// Apply the stored z-order after all objects are on the canvas
function applyZOrder() {
    const objs = canvas.getObjects().slice(); // copy
    objs.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    objs.forEach(o => canvas.bringToFront(o));
    canvas.renderAll();
}


// ── 6. FIREBASE → CANVAS: new object added ───────────────────
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


// ── 7. FIREBASE → CANVAS: object updated (z-order change) ────
objectsRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const obj  = canvas.getObjects().find(o => o.id === snapshot.key);
    if (!obj) return;
    obj.zIndex = data.zIndex ?? obj.zIndex;
    applyZOrder();
});


// ── 8. FIREBASE → CANVAS: object removed ─────────────────────
objectsRef.on('child_removed', (snapshot) => {
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) { canvas.remove(obj); canvas.renderAll(); }
});

// Clear canvas when all data is wiped
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) { canvas.clear(); canvas.renderAll(); }
});


// ── 9. BRING TO FRONT / SEND TO BACK ─────────────────────────
// zIndex is stored in Firebase so every client renders the same order.
// Since objects are locked, we use a two-step flow:
//   1. "Select for Depth" temporarily unlocks objects for one click.
//   2. Front/Back buttons update zIndex in Firebase → all clients re-sort.
let depthTargetId = null;

function enableDepthSelect() {
    // Make all objects temporarily selectable for one click
    canvas.getObjects().forEach(o => {
        o.set({ selectable: true, evented: true });
    });
    canvas.selection = false;
    document.getElementById('btn-select-depth').textContent = '🖱 Click an object...';

    canvas.once('mouse:down', (e) => {
        const clicked = canvas.findTarget(e.e);
        // Re-lock everything
        canvas.getObjects().forEach(o => lockObject(o));

        if (!clicked || !clicked.id) {
            document.getElementById('btn-select-depth').textContent = '🎯 Select for Depth';
            return;
        }
        depthTargetId = clicked.id;
        document.getElementById('btn-select-depth').textContent = `Selected: ${clicked.id.slice(-6)}`;
        document.getElementById('btn-front').disabled = false;
        document.getElementById('btn-back').disabled  = false;
    });
}

function applyDepth(dir) {
    if (!depthTargetId) { alert('Click "Select for Depth" first.'); return; }

    const allObjs = canvas.getObjects().slice();
    allObjs.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    const idx = allObjs.findIndex(o => o.id === depthTargetId);
    if (idx === -1) return;

    if (dir === 'front') {
        // Give it the highest zIndex
        const maxZ = Math.max(...allObjs.map(o => o.zIndex ?? 0));
        objectsRef.child(depthTargetId).update({ zIndex: maxZ + 1 });
    } else {
        // Give it the lowest zIndex
        const minZ = Math.min(...allObjs.map(o => o.zIndex ?? 0));
        objectsRef.child(depthTargetId).update({ zIndex: minZ - 1 });
    }

    depthTargetId = null;
    document.getElementById('btn-select-depth').textContent = '🎯 Select for Depth';
    document.getElementById('btn-front').disabled = true;
    document.getElementById('btn-back').disabled  = true;
}


// ── 10. PASSWORD MODAL ────────────────────────────────────────
let pendingPasswordAction = null;

function openPasswordModal(title, desc, action) {
    pendingPasswordAction = action;
    document.getElementById('pw-modal-title').textContent = title;
    document.getElementById('pw-modal-desc').textContent  = desc;
    document.getElementById('pw-input').value             = '';
    document.getElementById('pw-error').textContent       = '';
    document.getElementById('password-modal').classList.add('active');
    setTimeout(() => document.getElementById('pw-input').focus(), 100);
}

function closePasswordModal() {
    pendingPasswordAction = null;
    document.getElementById('password-modal').classList.remove('active');
}

function submitPassword() {
    const entered = document.getElementById('pw-input').value;
    if (entered === TEACHER_PASSWORD) {
        closePasswordModal();
        if (pendingPasswordAction) pendingPasswordAction();
    } else {
        document.getElementById('pw-error').textContent = 'Incorrect password. Try again.';
        document.getElementById('pw-input').value = '';
        document.getElementById('pw-input').focus();
    }
}


// ── 11. DELETE SELECTED (password-gated) ─────────────────────
// Since objects aren't selectable normally, we do the same
// "one-click" temporary unlock approach.
let deleteTargetId = null;

function askDeleteSelected() {
    // Step 1: let the user click the object they want to delete
    canvas.getObjects().forEach(o => o.set({ selectable: true, evented: true }));
    canvas.selection = false;
    document.getElementById('btn-delete').textContent = '🖱 Click object to delete...';

    canvas.once('mouse:down', (e) => {
        const clicked = canvas.findTarget(e.e);
        canvas.getObjects().forEach(o => lockObject(o));
        document.getElementById('btn-delete').textContent = '🗑 Delete Selected';

        if (!clicked || !clicked.id) return;
        deleteTargetId = clicked.id;

        // Step 2: ask for password
        openPasswordModal(
            '🗑 Delete Object',
            'Enter the teacher password to delete this creature.',
            () => {
                objectsRef.child(deleteTargetId).remove();
                deleteTargetId = null;
            }
        );
    });
}


// ── 12. RESET ALL (password-gated) ───────────────────────────
function askClearOcean() {
    openPasswordModal(
        '⚠ Reset Ocean',
        'Enter the teacher password to clear ALL creatures for everyone.',
        () => {
            objectsRef.remove();
            canvas.clear();
            canvas.renderAll();
        }
    );
}


// ── 13. QR CODE ───────────────────────────────────────────────
new QRCode(document.getElementById('qrcode'), {
    text:   window.location.href,
    width:  128,
    height: 128
});
