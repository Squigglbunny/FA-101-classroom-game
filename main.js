// --- 1. FIREBASE CONFIGURATION ---
// You will get these details from the Firebase Console (Settings > Project Settings)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_ID",
    appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const objectsRef = db.ref('marine-objects');

// --- 2. CANVAS SETUP ---
const canvas = new fabric.Canvas('oceanCanvas', {
    width: window.innerWidth,
    height: window.innerHeight,
});

// --- 3. ADDING ANIMALS ---
function addAnimal(url) {
    const id = 'item_' + Date.now(); // Unique ID for each object
    fabric.Image.fromURL(url, (img) => {
        img.set({ left: 100, top: 100, id: id });
        canvas.add(img);
        updateFirebase(img);
    });
}

// --- 4. SYNCING TO FIREBASE ---
canvas.on('object:modified', (e) => {
    updateFirebase(e.target);
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
