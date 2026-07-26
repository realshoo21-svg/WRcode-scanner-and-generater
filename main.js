
const video = document.getElementById('camera-video');
const canvas = document.getElementById('scanner-canvas');
const ctx = canvas.getContext('2d');
const previewCanvas = document.getElementById('qr-preview');
const previewCtx = previewCanvas.getContext('2d');
const startButton = document.getElementById('start-camera');
const stopButton = document.getElementById('stop-camera');
const switchButton = document.getElementById('switch-camera');
const uploadInput = document.getElementById('upload-image');
const scanResult = document.getElementById('scan-result');
const scannerStatus = document.getElementById('scanner-status');
const qrText = document.getElementById('qr-text');
const generateButton = document.getElementById('generate-qr');
const downloadButton = document.getElementById('download-qr');
const copyButton = document.getElementById('copy-content');
const clearButton = document.getElementById('clear-input');

const state = {
  stream: null,
  scanning: false,
  facingMode: 'environment'
};

function setStatus(message, tone = 'info') {
  scannerStatus.textContent = message;
  scannerStatus.className = `status-pill ${tone}`;
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  state.scanning = false;
  video.srcObject = null;
  setStatus('Camera stopped', 'info');
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('Camera access is not available', 'alert');
    return;
  }

  try {
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facingMode },
      audio: false
    });

    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    state.scanning = true;
    setStatus('Scanning live', 'success');
    scanFrame();
  } catch (error) {
    console.error(error);
    setStatus('Unable to access camera', 'alert');
  }
}

function scanFrame() {
  if (!state.scanning) return;

  if (video.videoWidth && video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      scanResult.textContent = code.data;
      setStatus('QR code detected', 'success');
      return;
    }
  }

  requestAnimationFrame(scanFrame);
}

function handleUpload(file) {
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      scanResult.textContent = code.data;
      setStatus('QR code found in image', 'success');
    } else {
      scanResult.textContent = 'No QR code was detected in that image.';
      setStatus('No code detected', 'alert');
    }
  };

  img.src = URL.createObjectURL(file);
}

function renderQr(value) {
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  QRCode.toCanvas(previewCanvas, value, {
    width: 260,
    margin: 1,
    color: { dark: '#111827', light: '#ffffff' }
  }).catch((error) => {
    console.error(error);
  });
}

function generateQr() {
  const value = qrText.value.trim() || 'https://qrmaster.shoo';
  renderQr(value);
  setStatus('QR generated', 'success');
}

async function downloadQr() {
  const value = qrText.value.trim() || 'https://qrmaster.shoo';
  const dataUrl = await QRCode.toDataURL(value, { width: 900, margin: 2 });
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'qr-master-shoo.png';
  link.click();
}

async function copyContent() {
  const value = qrText.value.trim();
  if (!value) {
    scanResult.textContent = 'Enter some text before copying.';
    return;
  }
  await navigator.clipboard.writeText(value);
  scanResult.textContent = 'Content copied to clipboard.';
}

function clearInput() {
  qrText.value = '';
  renderQr('QR Master by Shoo');
}

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
switchButton.addEventListener('click', () => {
  state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});
uploadInput.addEventListener('change', (event) => handleUpload(event.target.files[0]));
generateButton.addEventListener('click', generateQr);
downloadButton.addEventListener('click', downloadQr);
copyButton.addEventListener('click', copyContent);
clearButton.addEventListener('click', clearInput);

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

renderQr('QR Master by Shoo');
setStatus('Camera ready', 'info');
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (installBtn) {
    installBtn.style.display = 'inline-block';
  }
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  await deferredPrompt.userChoice;

  deferredPrompt = null;
  installBtn.style.display = 'none';
});
