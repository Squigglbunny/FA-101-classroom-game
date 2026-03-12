// ============================================================
//  main.js — Marine Ecosystem Classroom Game (Fixed Version)
// ============================================================

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

// Registry to track which IDs should actually exist on canvas
// This prevents "ghosting" if an image finishes loading after a reset.
let activeIds = new Set(); 

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
    'cl_seal.jpg', 'crab.png', 'jellyfish.png', 'kelp1.png', 
    'kelp2.png', 'octopus.png', 'orca1.png', 'orca2.png', 
    'redthing.png', 'seaurchin.jpg'
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
let stagingObj = null;

function startStaging(url) {
    if (stagingObj) cancelPlace();

    fabric.Image.fromURL(url, (img) => {
        img.set({
            left: Math.round(window.innerWidth * 0.3),
            top: Math.round(window.innerHeight * 0.3),
            scaleX: 0.5, scaleY: 0.5, angle: 0,
            opacity: 0.75,
            selectable: true, evented: true,
            hasControls: true, hasBorders: true,
            id: '__staging__'
        });

        stagingObj = img;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        document.getElementById('staging-banner').classList.add('active');
        document.getElementById('btn-confirm-place').classList.add('active');
        document.getElementById('btn-cancel-place').classList.add('active');
    }, { crossOrigin: 'anonymous' });
}

function confirmPlace() {
    if (!stagingObj) return;

    const id = 'obj_' + Date.now();
    const zIdx = canvas.getObjects().filter(o => o.id !== '__staging__').length;

    objectsRef.child(id).set({
        url: stagingObj._element.src,
        left: Math.round(stagingObj.left),
        top: Math.round(stagingObj.top),
        scaleX: stagingObj.scaleX,
        scaleY: stagingObj.scaleY,
        angle: stagingObj.angle,
        zIndex: zIdx
    });

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
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockScalingX: true, lockScalingY: true,
        lockRotation: true, hasControls: false,
        hasBorders: false, opacity: 1
