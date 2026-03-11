import { initializeApp } from "firebase/app";
import { getDatabase, ref, onChildAdded, onChildChanged, onChildRemoved, update, remove, set } from "firebase/database";

// 1. Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDbel-9z-agY4Fg0fSzKRGgfOAbz8Ken2E",
  authDomain: "fa-101-classroom-game.firebaseapp.com",
  databaseURL: "https://fa-101-classroom-game-default-rtdb.firebaseio.com",
  projectId: "fa-101-classroom-game",
  storageBucket: "fa-101-classroom-game.firebasestorage.app",
  messagingSenderId: "357744157002",
  appId: "1:357744157002:web:c49c360e340454f535a1b3"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const oceanRef = ref(db, 'marine-objects');

// 2. Setup Fabric Canvas
const canvas = new fabric.Canvas('oceanCanvas', {
    width: window.innerWidth,
    height: window.innerHeight
});

// 3. Logic to add animal to Firebase
window.addAnimal = (url) => {
    const id = 'obj_' + Date.now();
    const animalData = { url, left: 100, top: 100, scaleX: 0.5, scaleY: 0.5, angle: 0 };
    set(ref(db, 'marine-objects/' + id), animalData);
};

// 4. Listen for additions from others
onChildAdded(oceanRef, (snapshot) => {
    const data = snapshot.val();
    fabric.Image.fromURL(data.url, (img) => {
        img.set({ ...data, id: snapshot.key });
        canvas.add(img);
    });
});

// 5. Listen for changes (moving/rotating)
onChildChanged(oceanRef, (snapshot) => {
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) {
        obj.set(snapshot.val());
        canvas.renderAll();
    }
});

// 6. Update Firebase when user moves an object
canvas.on('object:modified', (e) => {
    const obj = e.target;
    update(ref(db, 'marine-objects/' + obj.id), {
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle
    });
});

function updateFirebase(obj) {
    objectsRef.child(obj.id).set({
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        angle: obj.angle,
        url: obj._element.src // Store the image path
    });
}

// --- 5. LISTENING FOR UPDATES ---
objectsRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const obj = canvas.getObjects().find(o => o.id === snapshot.key);
    if (obj) {
        obj.set(data);
        canvas.renderAll();
    }
});

// Sync initial state
objectsRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    // Prevent adding duplicates
    if (canvas.getObjects().find(o => o.id === snapshot.key)) return;
    
    fabric.Image.fromURL(data.url, (img) => {
        img.set({...data, id: snapshot.key});
        canvas.add(img);
    });
});

// --- 6. DEPTH CONTROL ---
function changeDepth(dir) {
    const active = canvas.getActiveObject();
    if (!active) return;
    dir === 'front' ? active.bringToFront() : active.sendToBack();
    updateFirebase(active); 
}

new QRCode(document.getElementById("qrcode"), {
    text: window.location.href,
    width: 128,
    height: 128
});

window.addEventListener('resize', () => {
    canvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
    });
    canvas.renderAll();
});
