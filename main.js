// ============================================================
//  main.js — Marine Ecosystem Classroom Game
//  Uses: Fabric.js (canvas) + Firebase Compat SDK (real-time)
// ============================================================

// ── 1. FIREBASE CONFIGURATION ────────────────────────────────
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
const db = firebase.database();
const objectsRef = db.ref('marine-objects');


// ── 2. CANVAS SETUP ──────────────────────────────────────────
const canvas = new fabric.Canvas('oceanCanvas', {
    width: window.innerWidth,
    height: window.innerHeight
});

// Resize canvas when the window is resized (important on mobile)
window.addEventListener('resize', () => {
    canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
    });
    canvas.renderAll();
});


// ── 3. ANIMAL BUTTONS ────────────────────────────────────────
// Add every image file you have in your /assets folder here.
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
    const btn = document.createElement('button');

    // Make a readable label: "orca1.png" → "Orca 1"
    const baseName = fileName.replace(/\.[^.]+$/, '');       // strip extension
    const label    = baseName
        .replace(/_/g, ' ')                                   // underscores → spaces
        .replace(/([a-z])(\d)/g, '$1 $2');                    // "orca1" → "orca 1"
    btn.textContent = label.charAt(0).toUpperCase() + label.slice(1);

    btn.onclick = () => {
        addAnimal(`assets/${fileName}`);
        // 2-second cooldown to prevent spam
        btn.disabled = true;
        setTimeout(() => (btn.disabled = false), 2000);
    };

    container.appendChild(btn);
});


// ── 4. ADD AN ANIMAL ─────────────────────────────────────────
function addAnimal(url) {
    // Hard cap: protect canvas performance
    if (canvas.getObjects().length >= 50) {
        alert('The ocean is full! Delete some creatures before adding more.');
        return;
    }

    const id   = 'obj_' + Date.now();
    const data = {
        url,
        left:   Math.random() * (window.innerWidth  * 0.6) + 50,   // random start position
        top:    Math.random() * (window.innerHeight * 0.6) + 50,
        scaleX: 0.5,
        scaleY: 0.5,
        angle:  0
    };

    // Write to Firebase — the child_added listener below will render it
    objectsRef.child(id).set(data);
}


// ── 5. SYNC: LISTEN FOR NEW OBJECTS ──────────────────────────
objectsRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    // Skip if this object is already on our canvas (prevents duplicates)
    if (canvas.getObjects().find(o => o.id === snapshot.key)) return;

    fabric.Image.fromURL(data.url, (img) => {
        img.set({
            left:   data.left,
            top:    data.top,
            scaleX: data.scaleX,
            scaleY: data.scaleY,
            angle:  data.angle,
            id:     snapshot.key
        });
        canvas.add(img);
        canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
});


// ── 6. SYNC: LISTEN FOR CHANGES (MOVE / ROTATE / SCALE) ──────
objectsRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const obj  = canvas.getObjects().find(o => o.id === snapshot.key);
    if (!obj) return;

    obj.set({
        left:   data.left,
        top:    data.top,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        angle:  data.angle
    });
    obj.setCoords();
    canvas.renderAll();
});


// ── 7. SYNC: LISTEN FOR DELETIONS ────────────────────────────
objectsRef.on('child_removed', (snapshot) => {
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) {
        canvas.remove(obj);
        canvas.renderAll();
    }
});

// Clear canvas when ALL data is wiped (Reset All)
objectsRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
        canvas.clear();
        canvas.renderAll();
    }
});


// ── 8. PUSH LOCAL CHANGES TO FIREBASE ────────────────────────
canvas.on('object:modified', (e) => {
    const obj = e.target;
    if (!obj.id) return;
    objectsRef.child(obj.id).update({
        left:   obj.left,
        top:    obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle:  obj.angle
    });
});


// ── 9. DEPTH CONTROL (FRONT / BACK) ──────────────────────────
function changeDepth(dir) {
    const active = canvas.getActiveObject();
    if (!active) return;
    dir === 'front' ? active.bringToFront() : active.sendToBack();
    canvas.renderAll();
    // Note: z-order is local only; full z-order sync would need extra Firebase logic
}


// ── 10. DELETE SELECTED OBJECT ────────────────────────────────
function deleteSelected() {
    const active = canvas.getActiveObject();
    if (!active) return;
    objectsRef.child(active.id).remove();   // removes from Firebase → triggers child_removed
    canvas.remove(active);
    canvas.renderAll();
}


// ── 11. RESET ALL (teacher button) ───────────────────────────
function clearOcean() {
    if (confirm('Clear the entire ocean for everyone?')) {
        objectsRef.remove();   // deletes all data → triggers the value listener above
        canvas.clear();
        canvas.renderAll();
    }
}


// ── 12. QR CODE (auto-generates from current URL) ────────────
new QRCode(document.getElementById('qrcode'), {
    text:   window.location.href,
    width:  128,
    height: 128
});
