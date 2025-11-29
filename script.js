/* === CONFIG: PUT YOUR GITHUB USER + REPO === */
const GITHUB_USER = "NishanthAiEagle";         // <-- CHANGE THIS
const GITHUB_REPO = "JewewsAi";        // <-- CHANGE THIS
const BRANCH = "main";                       // or master

/* === ELEMENTS === */
const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

const subButtons = document.getElementById("subcategory-buttons");
const list = document.getElementById("jewelry-options");

const captureBtn = document.getElementById("capture-btn");
const modal = document.getElementById("snapshot-modal");
const preview = document.getElementById("snapshot-preview");
const closeModal = document.getElementById("close-snapshot");
const downloadBtn = document.getElementById("download-btn");
const shareBtn = document.getElementById("share-btn");

let earringImg = null, necklaceImg = null;
let smoothedLandmarks = null, smoothPts = {};
let camera = null;
let lastShot = "";

/* ----------------------------------------------------
   🔥 AUTO LOAD IMAGES FROM GITHUB FOLDER USING API
------------------------------------------------------ */

async function fetchFolderImages(folderName) {
  const apiURL = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folderName}?ref=${BRANCH}`;

  try {
    const response = await fetch(apiURL);
    const data = await response.json();

    if (!Array.isArray(data)) return [];

    // Filter: only png, jpg, jpeg
    return data
      .filter(f =>
        f.name.toLowerCase().endsWith(".png") ||
        f.name.toLowerCase().endsWith(".jpg") ||
        f.name.toLowerCase().endsWith(".jpeg")
      )
      .map(f => f.download_url);

  } catch (err) {
    console.error("GitHub Folder Error:", err);
    return [];
  }
}

/* ========== Load Selected Category (auto image listing) ========== */

async function selectJewelryType(mainType, subType) {
  const folder = `${subType}_${mainType}`; // example: gold_earrings

  list.style.display = "flex";
  list.innerHTML = "";

  const images = await fetchFolderImages(folder);

  images.forEach(src => {
    const btn = document.createElement("button");
    const img = document.createElement("img");
    img.src = src;

    img.onload = () => {
      btn.onclick = () => changeJewelry(mainType, subType, src);
      btn.appendChild(img);
      list.appendChild(btn);
    };

    img.onerror = () => console.warn("Skipping broken image:", src);
  });
}

function changeJewelry(mainType, subType, src) {
  const type = `${subType}_${mainType}`;

  const image = new Image();
  image.src = src;
  image.onload = () => {
    if (type.includes("earrings")) {
      earringImg = image;
      necklaceImg = null;
    } else {
      necklaceImg = image;
      earringImg = null;
    }
  }
}

/* UI */
function toggleCategory() {
  subButtons.style.display = "flex";
  list.style.display = "none";
}

/* ----------------------------------------------------
   FACE MESH + CAMERA
------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", () => startCam());

function startCam() {
  camera = new Camera(video, {
    onFrame: async () => await faceMesh.send({ image: video }),
    width: 1280,
    height: 720,
    facingMode: "user"
  });
  camera.start();
}

video.addEventListener("loadedmetadata", () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
});

const faceMesh = new FaceMesh({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

faceMesh.onResults(res => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (res.multiFaceLandmarks?.length) {
    const raw = res.multiFaceLandmarks[0];
    smoothedLandmarks = smoothedLandmarks
      ? smoothedLandmarks.map((p, i) => ({
        x: p.x * 0.8 + raw[i].x * 0.2,
        y: p.y * 0.8 + raw[i].y * 0.2,
        z: p.z * 0.8 + raw[i].z * 0.2
      }))
      : raw;

    draw(smoothedLandmarks);
  }
});

function smooth(prev, c, f = 0.4) {
  return !prev
    ? c
    : { x: prev.x * (1 - f) + c.x * f, y: prev.y * (1 - f) + c.y * f };
}

/* DRAWING EARRINGS + NECKLACE */
function draw(face) {
  if (!face) return;

  const vw = canvas.width, vh = canvas.height;
  const L = face[33], R = face[263];
  const d = Math.hypot((R.x - L.x) * vw, (R.y - L.y) * vh);

  /* Earrings */
  const le = face[132], re = face[361];
  smoothPts.left = smooth(smoothPts.left, { x: le.x * vw, y: le.y * vh });
  smoothPts.right = smooth(smoothPts.right, { x: re.x * vw, y: re.y * vh });

  if (earringImg) {
    const w = d * 0.42;
    const h = w * (earringImg.height / earringImg.width);

    ctx.drawImage(earringImg, smoothPts.left.x - w / 2, smoothPts.left.y - h * 0.1, w, h);
    ctx.drawImage(earringImg, smoothPts.right.x - w / 2, smoothPts.right.y - h * 0.1, w, h);
  }

  /* Necklace */
  const nk = face[152];
  smoothPts.neck = smooth(smoothPts.neck, { x: nk.x * vw, y: nk.y * vh });

  if (necklaceImg) {
    const w = d * 1.6;
    const h = w * (necklaceImg.height / necklaceImg.width);
    const offset = d * 1.0;

    ctx.drawImage(necklaceImg, smoothPts.neck.x - w / 2, smoothPts.neck.y + offset, w, h);
  }
}

/* SNAPSHOT */
captureBtn.onclick = shot;
closeModal.onclick = () => modal.style.display = "none";

function shot() {
  if (!smoothedLandmarks) {
    alert("No face detected yet!");
    return;
  }

  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const cx = c.getContext("2d");

  cx.drawImage(video, 0, 0);
  draw(smoothedLandmarks, cx);

  lastShot = c.toDataURL("image/png");
  preview.src = lastShot;
  modal.style.display = "flex";
}

downloadBtn.onclick = () => {
  const a = document.createElement("a");
  a.href = lastShot;
  a.download = "jewelry-tryon.png";
  a.click();
};

shareBtn.onclick = async () => {
  if (!navigator.share) return alert("Sharing not supported");

  const blob = await (await fetch(lastShot)).blob();
  const file = new File([blob], "tryon.png", { type: "image/png" });
  await navigator.share({ files: [file], title: "My Try-On Look" });
};
