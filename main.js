// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//
//  Flow:
//   1. Student clicks an animal button → a staging copy appears
//      on their local canvas, fully editable (move/scale/rotate).
//   2. They click "Place It!" → the final position is written to
//      Firebase and locked for everyone, including them.
//   3. "Cancel" removes the staging object without touching Firebase.
//
//  Teacher actions (Delete, Reset All) require a password.
//  z-order (Front/Back) is stored in Firebase so all devices agree.
// ============================================================

const TEACHER_PASSWORD = 'ocean123'; // ← change this


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
    selection: false   // no rubber-band multi-select
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
    btn.onclick = () => startStaging(`assets/${fileName}`);
    container.appendChild(btn);
});


// ── 4. STAGING — editable object before placement ────────────
let stagingObj = null;   // the local-only Fabric object being positioned

function startStaging(url) {
    // Only one staging object at a time
    if (stagingObj) cancelPlace();

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left:       Math.round(window.innerWidth  * 0.3),
            top:        Math.round(window.innerHeight * 0.3),
            scaleX:     0.5,
            scaleY:     0.5,
            angle:      0,
            opacity:    0.75,          // visual hint: "not yet placed"
            selectable: true,
            evented:    true,
            hasControls: true,
            hasBorders:  true,
            id:         '__staging__'  // special marker
        });

        stagingObj = img;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        // Show staging UI
        document.getElementById('staging-banner').classList.add('active');
        document.getElementById('btn-confirm-place').classList.add('active');
        document.getElementById('btn-cancel-place').classList.add('active');
    }, { crossOrigin: 'anonymous' });
}

function confirmPlace() {
    if (!stagingObj) return;

    const id   = 'obj_' + Date.now();
    const zIdx = canvas.getObjects().filter(o => o.id !== '__staging__').length;

    // Write the final transform to Firebase (triggers child_added on all clients)
    objectsRef.child(id).set({
        url:    stagingObj._element.src,
        left:   Math.round(stagingObj.left),
        top:    Math.round(stagingObj.top),
        scaleX: stagingObj.scaleX,
        scaleY: stagingObj.scaleY,
        angle:  stagingObj.angle,
        zIndex: zIdx
    });

    // Remove the staging ghost (the locked version will arrive via child_added)
    canvas.remove(stagingObj);
    stagingObj = null;
    hideStagingUI();
    canvas.renderAll();
}

function cancelPlace() {
    if (stagingObj) {
        canvas.remove(stagingObj);
        canvas.discardActiveObject();
        stagingObj = null;
        canvas.renderAll();
    }
    hideStagingUI();
}

function hideStagingUI() {
    document.getElementById('staging-banner').classList.remove('active');
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
        opacity:       1      // fully opaque once placed
    });
}


// ── 6. Z-ORDER helper ────────────────────────────────────────
function applyZOrder() {
    const objs = canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .slice()
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    objs.forEach(o => canvas.bringToFront(o));

    // Keep staging object on top of everything so it stays interactive
    if (stagingObj) canvas.bringToFront(stagingObj);

    canvas.renderAll();
}


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


// ── 8. FIREBASE → CANVAS: object updated (z-order) ───────────
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

// When the entire ref is set to null (Reset All), clear every client's canvas
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
        canvas.getObjects()
            .filter(o => o.id !== '__staging__')
            .slice()
            .forEach(o => canvas.remove(o));
        canvas.renderAll();
    }
});


// ── 10. DEPTH CONTROL ────────────────────────────────────────
let depthTargetId = null;

function enableDepthSelect() {
    // Temporarily make locked objects clickable for one tap
    canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .forEach(o => o.set({ selectable: true, evented: true }));

    document.getElementById('btn-select-depth').textContent = '🖱 Click an object...';

    canvas.once('mouse:down', (e) => {
        const clicked = canvas.findTarget(e.e);

        // Re-lock all (except any active staging object)
        canvas.getObjects()
            .filter(o => o.id !== '__staging__')
            .forEach(o => lockObject(o));

        document.getElementById('btn-select-depth').textContent = '🎯 Select for Depth';

        if (!clicked || !clicked.id || clicked.id === '__staging__') return;

        depthTargetId = clicked.id;
        document.getElementById('btn-select-depth').textContent = `✔ Selected`;
        document.getElementById('btn-front').disabled = false;
        document.getElementById('btn-back').disabled  = false;
    });
}

function applyDepth(dir) {
    if (!depthTargetId) { alert('Click "Select for Depth" first.'); return; }

    const placed = canvas.getObjects().filter(o => o.id !== '__staging__');
    placed.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

    if (dir === 'front') {
        const maxZ = Math.max(...placed.map(o => o.zIndex ?? 0));
        objectsRef.child(depthTargetId).update({ zIndex: maxZ + 1 });
    } else {
        const minZ = Math.min(...placed.map(o => o.zIndex ?? 0));
        objectsRef.child(depthTargetId).update({ zIndex: minZ - 1 });
    }

    depthTargetId = null;
    document.getElementById('btn-select-depth').textContent = '🎯 Select for Depth';
    document.getElementById('btn-front').disabled = true;
    document.getElementById('btn-back').disabled  = true;
}


// ── 11. PASSWORD MODAL ────────────────────────────────────────
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


// ── 12. DELETE SELECTED (password-gated) ─────────────────────
let deleteTargetId = null;

function askDeleteSelected() {
    canvas.getObjects()
        .filter(o => o.id !== '__staging__')
        .forEach(o => o.set({ selectable: true, evented: true }));

    document.getElementById('btn-delete').textContent = '🖱 Click object to delete...';

    canvas.once('mouse:down', (e) => {
        const clicked = canvas.findTarget(e.e);

        canvas.getObjects()
            .filter(o => o.id !== '__staging__')
            .forEach(o => lockObject(o));

        document.getElementById('btn-delete').textContent = '🗑 Delete Selected';

        if (!clicked || !clicked.id || clicked.id === '__staging__') return;

        deleteTargetId = clicked.id;
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


// ── 13. RESET ALL (password-gated) ───────────────────────────
// objectsRef.set(null) wipes the entire node → triggers the value listener
// on every connected client → each client clears their own canvas.
function askClearOcean() {
    openPasswordModal(
        '⚠ Reset Ocean',
        'Enter the teacher password to clear ALL creatures for everyone.',
        () => {
            // Wipe Firebase completely — the value listener below handles all clients
            objectsRef.set(null);

            // Clear local canvas immediately too
            canvas.getObjects()
                .filter(o => o.id !== '__staging__')
                .slice()
                .forEach(o => canvas.remove(o));
            canvas.renderAll();
        }
    );
}


// ── 14. QR CODE ───────────────────────────────────────────────
new QRCode(document.getElementById('qrcode'), {
    text:   window.location.href,
    width:  128,
    height: 128
});
