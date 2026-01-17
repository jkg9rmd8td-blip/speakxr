// assets/src/xrStage.js
// SpeakXR X-Stage PRO — XR Stage (Camera + HUD + Metrics)
// Static / GitHub Pages compatible (no build)

import { clamp, fitCanvas } from "./core.js";

export function createXRStage({ video, hud }) {
  if (!video) throw new Error("xrStage: video element required");
  if (!hud) throw new Error("xrStage: hud canvas required");

  let stream = null;
  let running = false;
  let showHUD = true;
  let mirror = false;

  const ctx = hud.getContext("2d");

  // Metrics subscribers
  const metricSubs = new Set();

  // session clock
  let t0 = 0;
  let raf = 0;

  // WPM estimate (light heuristic): based on audio energy changes
  // (Real ASR needs server or WebSpeech, we keep it deterministic offline)
  let wpm = 0;
  let wpmTarget = 140;
  let energy = 0;
  let clarity = 0;
  let gate = 0;
  let gateState = "—";

  // Audio meter
  let audioCtx = null;
  let analyser = null;
  let timeData = null;

  // Small smoothing
  function smooth(prev, next, a = 0.12) {
    return prev + (next - prev) * a;
  }

  async function ensureStarted() {
    if (stream) return true;

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    video.srcObject = stream;
    await video.play();

    // Audio analyser
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    timeData = new Uint8Array(analyser.fftSize);

    resize();
    return true;
  }

  function stopAll() {
    stopSession();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    try {
      audioCtx?.close();
    } catch {}
    audioCtx = null;
    analyser = null;
    timeData = null;

    clearHUD();
  }

  function startSession() {
    if (running) return;
    running = true;
    t0 = performance.now();
    loop();
  }

  function stopSession() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function setHUD(on) {
    showHUD = !!on;
    if (!showHUD) clearHUD();
  }

  function setMirror(on) {
    mirror = !!on;
    // mirror video via CSS transform; keep canvas aligned
    video.style.transform = mirror ? "scaleX(-1)" : "scaleX(1)";
  }

  function resize() {
    // fit HUD to match displayed stage
    fitCanvas(hud);
  }

  function clearHUD() {
    fitCanvas(hud);
    ctx.clearRect(0, 0, hud.width, hud.height);
  }

  function onMetrics(fn) {
    metricSubs.add(fn);
    return () => metricSubs.delete(fn);
  }

  function emitMetrics(m) {
    metricSubs.forEach((fn) => {
      try {
        fn(m);
      } catch (e) {
        console.error("metrics cb error", e);
      }
    });
  }

  function readAudioLevel() {
    if (!analyser || !timeData) return 0;
    analyser.getByteTimeDomainData(timeData);

    // RMS
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);
    return clamp(Math.round(rms * 160), 0, 100);
  }

  function computeClarity(level) {
    // clarity heuristic: stable energy = clearer
    // compute from gate stability (lower jitter)
    const ideal = 35 + (level * 0.15);
    const diff = Math.abs(level - ideal);
    const c = clamp(100 - diff * 2.0, 0, 100);
    return c;
  }

  function computeGate(level) {
    // gate is like "speech activity"
    // we treat >18 as speaking (tuneable)
    const g = clamp((level - 12) * 4.8, 0, 100);
    return g;
  }

  function computeWPM(level, speaking) {
    // WPM estimate:
    // speaking = more stable and higher energy => faster
    // We keep it in realistic range
    if (!speaking) return smooth(wpm, 0, 0.06);

    const base = 110 + level * 1.25; // 110..235
    const sway = (Math.sin(performance.now() / 900) * 6);
    const next = clamp(base + sway, 80, 220);

    return smooth(wpm, next, 0.08);
  }

  function hudDraw(m) {
    if (!showHUD) return;
    fitCanvas(hud);
    const W = hud.width, H = hud.height;

    ctx.clearRect(0, 0, W, H);

    // background gradient overlay
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "rgba(0,0,0,0.18)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // HUD frame
    roundRect(ctx, 18, 18, W - 36, H - 36, 18);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Title
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `${Math.round(H * 0.03)}px system-ui, -apple-system, Arial`;
    ctx.textAlign = "right";
    ctx.fillText("SpeakXR • XR HUD", W - 34, 56);

    // Metrics text
    ctx.font = `${Math.round(H * 0.026)}px system-ui, -apple-system, Arial`;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillText(`WPM: ${m.wpm ? Math.round(m.wpm) : "—"}`, W - 34, 98);
    ctx.fillText(`Energy: ${Math.round(m.energy)}`, W - 34, 132);
    ctx.fillText(`Clarity: ${Math.round(m.clarity)}`, W - 34, 166);
    ctx.fillText(`Gate: ${m.gateState}`, W - 34, 200);

    // Bars
    drawBar(ctx, 34, 92, 240, 14, m.wpmScore, "WPM Balance");
    drawBar(ctx, 34, 126, 240, 14, m.energy, "Energy");
    drawBar(ctx, 34, 160, 240, 14, m.clarity, "Clarity");
    drawBar(ctx, 34, 194, 240, 14, m.gate, "Gate");

    // Center reticle
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 48, H / 2);
    ctx.lineTo(W / 2 + 48, H / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2 - 48);
    ctx.lineTo(W / 2, H / 2 + 48);
    ctx.stroke();
  }

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);

    const elapsed = Math.floor((performance.now() - t0) / 1000);

    // read and smooth audio level
    const lvl = readAudioLevel();
    energy = smooth(energy, lvl, 0.12);

    gate = computeGate(energy);
    gateState = gate > 30 ? "Speaking" : gate > 12 ? "Warm" : "Silent";

    const speaking = gate > 30;
    clarity = smooth(clarity, computeClarity(energy), 0.10);

    wpm = computeWPM(energy, speaking);

    // wpm score: closest to 140
    const wpmScore = clamp(100 - Math.abs((wpm || wpmTarget) - wpmTarget) * 1.7, 0, 100);

    const m = {
      elapsed,
      wpm: speaking ? Math.round(wpm) : null,
      energy: Math.round(energy),
      clarity: Math.round(clarity),
      gate: Math.round(gate),
      gateState,
      wpmScore,
    };

    // draw HUD
    hudDraw(m);

    // notify
    emitMetrics(m);
  }

  async function isWebXRARSupported() {
    // Only checks support (no session start here)
    try {
      if (!navigator.xr) return false;
      const ok = await navigator.xr.isSessionSupported("immersive-ar");
      return !!ok;
    } catch {
      return false;
    }
  }

  return {
    ensureStarted,
    startSession,
    stopSession,
    stopAll,
    setHUD,
    setMirror,
    resize,
    onMetrics,
    isWebXRARSupported,
  };
}

/* ---------------------------
   Draw helpers
---------------------------- */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBar(ctx, x, y, w, h, val, label) {
  val = clamp(val ?? 0, 0, 100);

  // background
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();

  // fill
  const fw = Math.max(8, (w * val) / 100);
  ctx.fillStyle = "rgba(56,189,248,0.85)";
  roundRect(ctx, x, y, fw, h, 10);
  ctx.fill();

  // label
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "12px system-ui, -apple-system, Arial";
  ctx.textAlign = "left";
  ctx.fillText(label, x + w + 10, y + h);
}
