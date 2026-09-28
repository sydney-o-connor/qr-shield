/**
 * app.js
 * Wires up camera scanning, image upload, heuristic + Safe Browsing checks,
 * and the green/red result UI.
 */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });
const scanFrame = document.getElementById("scanFrame");
const startCameraBtn = document.getElementById("startCameraBtn");
const cameraError = document.getElementById("cameraError");

const cameraSection = document.getElementById("cameraSection");
const uploadSection = document.getElementById("uploadSection");
const cameraModeBtn = document.getElementById("cameraModeBtn");
const uploadModeBtn = document.getElementById("uploadModeBtn");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

const resultPanel = document.getElementById("resultPanel");
const resultGlow = document.getElementById("resultGlow");
const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultUrl = document.getElementById("resultUrl");
const resultReasons = document.getElementById("resultReasons");
const openLinkBtn = document.getElementById("openLinkBtn");
const openAnywayBtn = document.getElementById("openAnywayBtn");
const scanAgainBtn = document.getElementById("scanAgainBtn");

const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const clearKeyBtn = document.getElementById("clearKeyBtn");
const keyStatus = document.getElementById("keyStatus");

let stream = null;
let scanLoopId = null;
let isPaused = false;

// ---------- Mode toggle ----------

cameraModeBtn.addEventListener("click", () => switchMode("camera"));
uploadModeBtn.addEventListener("click", () => switchMode("upload"));

function switchMode(mode) {
  const toCamera = mode === "camera";
  cameraModeBtn.classList.toggle("active", toCamera);
  uploadModeBtn.classList.toggle("active", !toCamera);
  cameraSection.hidden = !toCamera;
  uploadSection.hidden = toCamera;
  if (!toCamera) stopCamera();
  hideResult();
}

// ---------- Camera scanning ----------

startCameraBtn.addEventListener("click", startCamera);

async function startCamera() {
  cameraError.hidden = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    video.srcObject = stream;
    await video.play();
    startCameraBtn.hidden = true;
    scanFrame.classList.remove("neutral");
    scanFrame.classList.add("scanning");
    isPaused = false;
    scanLoop();
  } catch (err) {
    cameraError.textContent = "Couldn't access camera: " + err.message + ". Try the upload option instead.";
    cameraError.hidden = false;
  }
}

function stopCamera() {
  if (scanLoopId) cancelAnimationFrame(scanLoopId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  startCameraBtn.hidden = false;
  scanFrame.classList.remove("scanning", "safe", "danger");
  scanFrame.classList.add("neutral");
}

function scanLoop() {
  if (isPaused) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      isPaused = true;
      handleScannedData(code.data);
      return;
    }
  }

  scanLoopId = requestAnimationFrame(scanLoop);
}

// ---------- Upload / drag-and-drop ----------

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "var(--accent)";
});
dropZone.addEventListener("dragleave", () => {
  dropZone.style.borderColor = "var(--border)";
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "var(--border)";
  const file = e.dataTransfer.files[0];
  if (file) processImageFile(file);
});
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) processImageFile(file);
});

function processImageFile(file) {
  const img = new Image();
  const reader = new FileReader();
  reader.onload = (e) => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      canvasCtx.drawImage(img, 0, 0);
      const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        handleScannedData(code.data);
      } else {
        alert("No QR code detected in that image. Try a clearer photo.");
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ---------- Result handling ----------

async function handleScannedData(rawData) {
  hideResult();
  resultPanel.hidden = false;
  resultTitle.textContent = "Checking link…";
  resultUrl.textContent = rawData;
  resultReasons.innerHTML = "";
  resultIcon.textContent = "🔍";
  openLinkBtn.hidden = true;
  openAnywayBtn.hidden = true;
  resultGlow.classList.remove("safe", "danger");

  const heuristics = runHeuristicChecks(rawData);
  const reasons = [...heuristics.reasons];
  let flagged = heuristics.flagged;

  if (heuristics.isUrl) {
    const sb = await checkSafeBrowsing(rawData);
    if (sb.checked) {
      if (sb.error) {
        reasons.push({ text: `Safe Browsing check couldn't complete: ${sb.error}`, type: "flag" });
      } else if (sb.threatFound) {
        flagged = true;
        reasons.push({ text: `Google Safe Browsing flagged this as: ${sb.threatTypes.join(", ")}.`, type: "flag" });
      } else {
        reasons.push({ text: "Google Safe Browsing found no known threats.", type: "pass" });
      }
    }
  }

  renderResult(rawData, heuristics.isUrl, flagged, reasons);
}

function renderResult(rawData, isUrl, flagged, reasons) {
  resultReasons.innerHTML = "";
  reasons.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r.text;
    li.className = r.type;
    resultReasons.appendChild(li);
  });

  if (!isUrl) {
    resultIcon.textContent = "ℹ️";
    resultTitle.textContent = "Not a link";
    resultGlow.classList.remove("danger");
    scanFrame.classList.remove("danger", "safe");
    return;
  }

  if (flagged) {
    resultIcon.textContent = "⛔";
    resultTitle.textContent = "This link looks risky";
    resultGlow.classList.add("danger");
    resultGlow.classList.remove("safe");
    scanFrame.classList.add("danger");
    scanFrame.classList.remove("safe", "scanning");
    openAnywayBtn.hidden = false;
    openAnywayBtn.onclick = () => {
      if (confirm("This link was flagged as potentially unsafe. Open it anyway?")) {
        window.open(rawData, "_blank", "noopener,noreferrer");
      }
    };
  } else {
    resultIcon.textContent = "✅";
    resultTitle.textContent = "Looks safe to open";
    resultGlow.classList.add("safe");
    resultGlow.classList.remove("danger");
    scanFrame.classList.add("safe");
    scanFrame.classList.remove("danger", "scanning");
    openLinkBtn.hidden = false;
    openLinkBtn.href = rawData;
  }
}

function hideResult() {
  resultPanel.hidden = true;
  openLinkBtn.hidden = true;
  openAnywayBtn.hidden = true;
}

scanAgainBtn.addEventListener("click", () => {
  hideResult();
  isPaused = false;
  if (stream) {
    scanFrame.classList.remove("safe", "danger");
    scanFrame.classList.add("scanning");
    scanLoop();
  }
});

// ---------- Settings: API key ----------

function refreshKeyStatus() {
  const key = getSavedApiKey();
  keyStatus.textContent = key
    ? "✅ Safe Browsing API key saved — live threat checks enabled."
    : "No API key saved — running local heuristic checks only.";
}

saveKeyBtn.addEventListener("click", () => {
  const val = apiKeyInput.value.trim();
  if (!val) return;
  saveApiKey(val);
  apiKeyInput.value = "";
  refreshKeyStatus();
});

clearKeyBtn.addEventListener("click", () => {
  clearApiKey();
  refreshKeyStatus();
});

refreshKeyStatus();
