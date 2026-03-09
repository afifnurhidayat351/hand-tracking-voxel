const video3 = document.getElementsByClassName('input_video3')[0];
const out3 = document.getElementsByClassName('output3')[0];
const controlsElement3 = document.getElementsByClassName('control3')[0];
const canvasCtx3 = out3.getContext('2d');
const fpsControl = new FPS();
// Konfigurasi Grid Block

// false = kosong, true = ada block

const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
  spinner.style.display = 'none';
};

function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Variabel untuk menyimpan posisi kamera sederhana
const gridSize = 10;
const blocks = Array(gridSize).fill().map(() => Array(gridSize).fill(false));
let cameraOffset = { x: 0, y: 0 }; 
let cameraRotation = 0; // Tambahkan ini untuk rotasi

function onResultsHands(results) {
  document.body.classList.add('loaded');
  fpsControl.tick();

  canvasCtx3.save();
  canvasCtx3.clearRect(0, 0, out3.width, out3.height);
  canvasCtx3.drawImage(results.image, 0, 0, out3.width, out3.height);

  const cellW = out3.width / gridSize;
  const cellH = out3.height / gridSize;

  if (results.multiHandLandmarks && results.multiHandedness) {
    for (let index = 0; index < results.multiHandLandmarks.length; index++) {
      const landmarks = results.multiHandLandmarks[index];
      const classification = results.multiHandedness[index];
      const isRightHand = classification.label === 'Right';

      // --- TANGAN KANAN: MOVE & ROTATE ---
      if (isRightHand) {
        const palm = landmarks[9];
        const thumbTip = landmarks[4];
        const pinkyTip = landmarks[20];

        // Geser Posisi (X, Y)
        cameraOffset.x = (palm.x - 0.5) * 400;
        cameraOffset.y = (palm.y - 0.5) * 400;

        // Rotasi: Hitung kemiringan tangan (antara jempol dan kelingking)
        cameraRotation = Math.atan2(pinkyTip.y - thumbTip.y, pinkyTip.x - thumbTip.x);

        drawConnectors(canvasCtx3, landmarks, HAND_CONNECTIONS, {color: '#00FF00'});
      } 
      
      // --- TANGAN KIRI: BUILD & DESTROY ---
      else {
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12]; // Jari Tengah untuk hapus

        const distanceBuild = getDistance(thumbTip, indexTip);
        const distanceDestroy = getDistance(thumbTip, middleTip);

        const adjustedX = indexTip.x * out3.width - cameraOffset.x;
        const adjustedY = indexTip.y * out3.height - cameraOffset.y;
        
        const gridX = Math.floor(adjustedX / cellW);
        const gridY = Math.floor(adjustedY / cellH);

        if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
          // Cubit Telunjuk + Jempol = PASANG
          if (distanceBuild < 0.05) {
            blocks[gridY][gridX] = true;
          }
          // Cubit Jari Tengah + Jempol = HAPUS
          else if (distanceDestroy < 0.05) {
            blocks[gridY][gridX] = false;
          }
        }
        drawConnectors(canvasCtx3, landmarks, HAND_CONNECTIONS, {color: '#FF0000'});
      }
    }
  }

  // --- MENGGAMBAR BLOCK DENGAN ROTASI ---
  canvasCtx3.translate(out3.width/2 + cameraOffset.x, out3.height/2 + cameraOffset.y);
  canvasCtx3.rotate(cameraRotation); // Putar seluruh grid block
  canvasCtx3.translate(-out3.width/2, -out3.height/2);

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (blocks[r][c]) {
        const x = c * cellW;
        const y = r * cellH;
        
        // Efek 3D Sederhana (Sisi Atas)
        canvasCtx3.fillStyle = "rgba(100, 50, 10, 0.9)";
        canvasCtx3.beginPath();
        canvasCtx3.moveTo(x, y);
        canvasCtx3.lineTo(x + 10, y - 10);
        canvasCtx3.lineTo(x + cellW + 10, y - 10);
        canvasCtx3.lineTo(x + cellW, y);
        canvasCtx3.fill();

        // Sisi Depan
        canvasCtx3.fillStyle = "rgba(139, 69, 19, 0.8)";
        canvasCtx3.fillRect(x, y, cellW - 2, cellH - 2);
      }
    }
  }

  canvasCtx3.restore();
}

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.1/${file}`;
}});
hands.onResults(onResultsHands);

const camera = new Camera(video3, {
  onFrame: async () => {
    await hands.send({image: video3});
  },
  width: 480,
  height: 480
});
camera.start();

new ControlPanel(controlsElement3, {
      selfieMode: true,
      maxNumHands: 2,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    .add([
      new StaticText({title: 'MediaPipe Hands'}),
      fpsControl,
      new Toggle({title: 'Selfie Mode', field: 'selfieMode'}),
      new Slider(
          {title: 'Max Number of Hands', field: 'maxNumHands', range: [1, 4], step: 1}),
      new Slider({
        title: 'Min Detection Confidence',
        field: 'minDetectionConfidence',
        range: [0, 1],
        step: 0.01
      }),
      new Slider({
        title: 'Min Tracking Confidence',
        field: 'minTrackingConfidence',
        range: [0, 1],
        step: 0.01
      }),
    ])
    .on(options => {
      video3.classList.toggle('selfie', options.selfieMode);
      hands.setOptions(options);
    });