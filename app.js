const state = {
  stream: null,
  scanning: false,
  cameraFacing: 'environment',
  detector: null,
  installPrompt: null,
};

const elements = {
  startCameraBtn: document.getElementById('startCameraBtn'),
  switchCameraBtn: document.getElementById('switchCameraBtn'),
  stopCameraBtn: document.getElementById('stopCameraBtn'),
  scannerStatus: document.getElementById('scannerStatus'),
  videoElement: document.getElementById('videoElement'),
  resultCard: document.getElementById('resultCard'),
  resultText: document.getElementById('resultText'),
  copyResultBtn: document.getElementById('copyResultBtn'),
  openLinkBtn: document.getElementById('openLinkBtn'),
  imageUpload: document.getElementById('imageUpload'),
  contentInput: document.getElementById('contentInput'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  copyContentBtn: document.getElementById('copyContentBtn'),
  clearBtn: document.getElementById('clearBtn'),
  qrCanvas: document.getElementById('qrCanvas'),
  generatorStatus: document.getElementById('generatorStatus'),
  installButton: document.getElementById('installButton'),
  themeToggle: document.getElementById('themeToggle'),
};

document.addEventListener('DOMContentLoaded', init);

function init() {
  bindEvents();
  initTheme();
  registerServiceWorker();
  preloadQrLibrary();
  renderQr('Scan and Generate QR Codes Instantly');
}

function bindEvents() {
  elements.startCameraBtn.addEventListener('click', startCamera);
  elements.switchCameraBtn.addEventListener('click', switchCamera);
  elements.stopCameraBtn.addEventListener('click', stopCamera);
  elements.imageUpload.addEventListener('change', handleImageUpload);
  elements.generateBtn.addEventListener('click', () => renderQr(elements.contentInput.value || 'QR Master'));
  elements.downloadBtn.addEventListener('click', downloadQr);
  elements.copyContentBtn.addEventListener('click', copyContent);
  elements.clearBtn.addEventListener('click', clearContent);
  elements.copyResultBtn.addEventListener('click', copyResult);
  elements.openLinkBtn.addEventListener('click', openDetectedLink);
  elements.themeToggle.addEventListener('click', toggleTheme);
  document.querySelectorAll('[data-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.getAttribute('data-scroll'));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  elements.installButton.addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    const { outcome } = await state.installPrompt.userChoice;
    if (outcome === 'accepted') {
      setScannerStatus('App installed successfully.', 'success');
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    elements.installButton.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    elements.installButton.classList.add('hidden');
  });
}

function initTheme() {
  const savedTheme = localStorage.getItem('qr-master-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const darkMode = savedTheme ? savedTheme === 'dark' : prefersDark;
  document.body.classList.toggle('dark', darkMode);
  elements.themeToggle.textContent = darkMode ? '🌙' : '☀️';
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('qr-master-theme', isDark ? 'dark' : 'light');
  elements.themeToggle.textContent = isDark ? '🌙' : '☀️';
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  }
}

function preloadQrLibrary() {
  if (window.QRCode) return;

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.0/build/qrcode.min.js';
  script.onload = () => {
    renderQr(elements.contentInput.value || 'Scan and Generate QR Codes Instantly');
  };
  script.onerror = () => {
    elements.generatorStatus.textContent = 'QR library unavailable. Please reconnect once to cache it.';
  };
  document.head.appendChild(script);
}

function renderQr(content) {
  if (!window.QRCode) {
    elements.generatorStatus.textContent = 'Loading QR engine...';
    return;
  }

  const safeContent = content.trim() || 'QR Master';
  elements.contentInput.value = safeContent;
  elements.generatorStatus.textContent = 'QR generated successfully';

  window.QRCode.toCanvas(elements.qrCanvas, safeContent, {
    width: 260,
    margin: 2,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  }, (error) => {
    if (error) {
      elements.generatorStatus.textContent = 'Unable to render QR code.';
      console.error(error);
    }
  });
}

function downloadQr() {
  const link = document.createElement('a');
  link.href = elements.qrCanvas.toDataURL('image/png');
  link.download = 'qr-master.png';
  link.click();
}

function copyContent() {
  const content = elements.contentInput.value;
  navigator.clipboard.writeText(content).then(() => {
    elements.generatorStatus.textContent = 'Content copied';
  });
}

function clearContent() {
  elements.contentInput.value = '';
  renderQr('QR Master');
}

async function startCamera() {
  if (!('BarcodeDetector' in window)) {
    setScannerStatus('This browser does not support QR scanning. Use Chrome or Edge on desktop or mobile.', 'warning');
    return;
  }

  if (!state.detector) {
    state.detector = new BarcodeDetector({ formats: ['qr_code'] });
  }

  if (state.stream) {
    setScannerStatus('Camera already active.', 'success');
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.cameraFacing },
      audio: false,
    });
    elements.videoElement.srcObject = state.stream;
    await elements.videoElement.play();
    state.scanning = true;
    setScannerStatus('Scanning in progress...', 'success');
    scanLoop();
  } catch (error) {
    console.error(error);
    setScannerStatus('Camera access was denied or unavailable.', 'warning');
  }
}

async function switchCamera() {
  if (state.stream) {
    stopCamera();
  }
  state.cameraFacing = state.cameraFacing === 'environment' ? 'user' : 'environment';
  await startCamera();
}

function stopCamera() {
  state.scanning = false;
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
  if (elements.videoElement.srcObject) {
    elements.videoElement.srcObject = null;
  }
  setScannerStatus('Camera stopped.', 'info');
}

async function scanLoop() {
  if (!state.scanning || !state.detector) return;

  try {
    const barcodes = await state.detector.detect(elements.videoElement);
    if (barcodes.length > 0) {
      const value = barcodes[0].rawValue;
      handleScanResult(value);
      return;
    }
  } catch (error) {
    console.warn('Detection error', error);
  }

  if (state.scanning) {
    window.setTimeout(scanLoop, 250);
  }
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!state.detector) {
    state.detector = new BarcodeDetector({ formats: ['qr_code'] });
  }

  try {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    const barcodes = await state.detector.detect(image);
    if (barcodes.length > 0) {
      handleScanResult(barcodes[0].rawValue);
    } else {
      setScannerStatus('No QR code was detected in the uploaded image.', 'warning');
    }
    URL.revokeObjectURL(imageUrl);
  } catch (error) {
    console.error(error);
    setScannerStatus('The selected file could not be processed.', 'warning');
  }
}

function handleScanResult(value) {
  state.scanning = false;
  elements.resultText.textContent = value;
  elements.resultCard.classList.remove('hidden');
  elements.openLinkBtn.classList.toggle('hidden', !isLikelyUrl(value));
  setScannerStatus('QR code detected.', 'success');
}

function copyResult() {
  navigator.clipboard.writeText(elements.resultText.textContent).then(() => {
    setScannerStatus('Result copied to clipboard.', 'success');
  });
}

function openDetectedLink() {
  const value = elements.resultText.textContent;
  if (isLikelyUrl(value)) {
    window.open(value, '_blank', 'noopener,noreferrer');
  }
}

function isLikelyUrl(value) {
  return /^(https?:\/\/|mailto:)/i.test(value);
}

function setScannerStatus(message, type) {
  elements.scannerStatus.textContent = message;
  elements.scannerStatus.style.background = type === 'warning'
    ? 'rgba(234, 88, 12, 0.14)'
    : type === 'success'
      ? 'rgba(16, 185, 129, 0.16)'
      : 'rgba(37, 99, 235, 0.12)';
  elements.scannerStatus.style.color = type === 'warning' ? '#c2410c' : type === 'success' ? '#047857' : 'var(--primary)';
}
