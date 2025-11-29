const video=document.getElementById("webcam");
const canvas=document.getElementById("overlay");
const ctx=canvas.getContext("2d");

const subButtons=document.getElementById("subcategory-buttons");
const list=document.getElementById("jewelry-options");

const captureBtn=document.getElementById("capture-btn");
const modal=document.getElementById("snapshot-modal");
const preview=document.getElementById("snapshot-preview");
const closeModal=document.getElementById("close-snapshot");
const downloadBtn=document.getElementById("download-btn");
const shareBtn=document.getElementById("share-btn");

let earringImg=null, necklaceImg=null;
let smoothedLandmarks=null, smoothPts={};
let camera=null;
let lastShot="";

/* IMAGE LOADER */
function loadImage(src){
  return new Promise(res=>{let i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src;});
}
function generateList(type,count=20){
  return Array.from({length:count},(_,i)=>`${type}/${type}${i+1}.png`);
}
function changeJewelry(type,src){
  loadImage(src).then(img=>{
    if(type.includes("earrings")){ earringImg=img; necklaceImg=null; }
    else{ necklaceImg=img; earringImg=null; }
  });
}

/* CATEGORY */
function toggleCategory(){ subButtons.style.display="flex"; list.style.display="none"; }
function selectJewelryType(main,sub){
  const type=`${sub}_${main}`;
  list.style.display="flex";
  list.innerHTML="";
  generateList(type).forEach(src=>{
    const b=document.createElement("button");
    const img=document.createElement("img"); img.src=src;
    b.appendChild(img); b.onclick=()=>changeJewelry(type,src);
    list.appendChild(b);
  });
}

/* CAMERA + MEDIAPIPE */
document.addEventListener("DOMContentLoaded",()=>start());

function start(){
  camera=new Camera(video,{
    onFrame:async()=>await faceMesh.send({image:video}),
    width:1280,height:720,facingMode:"user"
  });
  camera.start();
}

video.addEventListener("loadedmetadata",()=>{
  canvas.width=video.videoWidth;
  canvas.height=video.videoHeight;
});

const faceMesh=new FaceMesh({
  locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
});
faceMesh.setOptions({maxNumFaces:1, refineLandmarks:true});

faceMesh.onResults(res=>{
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if(res.multiFaceLandmarks?.length){
    const raw=res.multiFaceLandmarks[0];
    smoothedLandmarks = smoothedLandmarks
      ? smoothedLandmarks.map((p,i)=>({
        x:p.x*0.8+raw[i].x*0.2,
        y:p.y*0.8+raw[i].y*0.2,
        z:p.z*0.8+raw[i].z*0.2,
      }))
      : raw;
    draw(smoothedLandmarks);
  }
});

function smooth(prev,c,f=0.4){ return !prev?c:{x:prev.x*(1-f)+c.x*f,y:prev.y*(1-f)+c.y*f}; }

/* DRAW JEWELRY */
function draw(face){
  const vw=canvas.width, vh=canvas.height;
  const L=face[33], R=face[263];
  const d=Math.hypot((R.x-L.x)*vw,(R.y-L.y)*vh);

  const le=face[132], re=face[361];
  smoothPts.left=smooth(smoothPts.left,{x:le.x*vw,y:le.y*vh});
  smoothPts.right=smooth(smoothPts.right,{x:re.x*vw,y:re.y*vh});

  if(earringImg){
    const w=d*0.42, h=w*(earringImg.height/earringImg.width);
    ctx.drawImage(earringImg,smoothPts.left.x-w/2,smoothPts.left.y,w,h);
    ctx.drawImage(earringImg,smoothPts.right.x-w/2,smoothPts.right.y,w,h);
  }

  const nk=face[152];
  smoothPts.neck=smooth(smoothPts.neck,{x:nk.x*vw,y:nk.y*vh});

  if(necklaceImg){
    const w=d*1.6, h=w*(necklaceImg.height/necklaceImg.width);
    ctx.drawImage(necklaceImg,smoothPts.neck.x-w/2,smoothPts.neck.y+d*1.0,w,h);
  }
}

/* SNAPSHOT */
captureBtn.onclick=shot;
closeModal.onclick=()=>modal.style.display="none";

function shot(){
  const c=document.createElement("canvas");
  c.width=video.videoWidth; c.height=video.videoHeight;
  const cx=c.getContext("2d");
  cx.drawImage(video,0,0); draw(smoothedLandmarks,cx);
  lastShot=c.toDataURL("image/png");
  preview.src=lastShot;
  modal.style.display="flex";
}

downloadBtn.onclick=()=>{
  const a=document.createElement("a");
  a.href=lastShot;
  a.download="jewelry-tryon.png";
  a.click();
};

shareBtn.onclick=async()=>{
  if(!navigator.share) return alert("Not supported");
  const blob=await(await fetch(lastShot)).blob();
  const file=new File([blob],"tryon.png",{type:"image/png"});
  await navigator.share({files:[file], title:"My Try-On"});
};
