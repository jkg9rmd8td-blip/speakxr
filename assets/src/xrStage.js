// /src/xrStage.js
// SpeakXR X-Stage PRO — XR Stage Engine (Camera + Mic + HUD Canvas)
// Real mic analysis (RMS energy + gate + clarity heuristic) + WebXR support check
// Exposes: ensureStarted, startSession, stopSession, stopAll, resize, setHUD, setMirror, onMetrics, isWebXRARSupported

import { clamp } from "./core.js";

export function createXRStage({ video, hud }) {
  if (!video) throw new Error("xrStage: video element is required");
  if (!hud) throw new Error("xrStage: hud canvas is required");

  const ctx = hud.getContext("2d");

  // camera / audio
  let stream = null;
  let started = false;

  // session loop
  let t0 = 0;
  let raf = null;
  let metricsCb = null;

  // HUD state
  let showHUD = true;
  let mirror = false;

  // audio analysis nodes
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let timeData = null;

  // internal metrics
  const m = {
    elapsed: 0,
    wpm: null,
    energy: 0,
    clarity: 0,
    gate: 0,
    gateState: "—",
  };

  /* ---------------------------
     Canvas sizing
  ---------------------------- */
  function resize() {
    const r = hud.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    hud.width = Math.floor(r.width * dpr);
    hud.height = Math.floor(r.height * dpr);
  }

  /* ---------------------------
     Permissions: camera + mic
  ---------------------------- */
  async function ensureStarted() {
    if (started) return true;

    resize();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    video.srcObject = stream;

    // Audio context
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    timeData = new Float32Array(analyser.fftSize);

    started = true;
    return true;
  }

  /* ---------------------------
     Stop everything
  ---------------------------- */
  function stopAll() {
    try {
      cancelAnimationFrame(raf);
    } catch {}
    raf = null;

    // stop tracks
    if (stream) {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      stream = null;
    }

    // audio cleanup
    try { source?.disconnect(); } catch {}
    try { analyser?.disconnect(); } catch {}
    source = null;
    analyser = null;

    try { audioCtx?.close(); } catch {}
    audioCtx = null;

    started = false;

    // reset metrics
    m.elapsed = 0;
    m.wpm = null;
    m.energy = 0;
    m.clarity = 0;
    m.gate = 0;
    m.gateState = "—";

    // clear HUD
    ctx.clearRect(0, 0, hud.width, hud.height);
  }

  /* ---------------------------
     Session start/stop (loop)
  ---------------------------- */
  function startSession() {
    t0 = performance.now();
    loop();
  }

  function stopSession() {
    try {
      cancelAnimationFrame(raf);
    } catch {}
    raf = null;
  }

  /* ---------------------------
     Settings
  ---------------------------- */
  function setHUD(v) {
    showHUD = !!v;
    if (!showHUD) ctx.clearRect(0, 0, hud.width, hud.height);
  }

  function setMirror(v) {
    mirror = !!v;
  }

  /* ---------------------------
     WebXR Support
  ---------------------------- */
  async function isWebXRARSupported() {
    const xr = navigator.xr;
    if (!xr || typeof xr.isSessionSupported !== "function") return false;
    try {
      return await xr.isSessionSupported("immersive-ar");
    } catch {
      return false;
    }
  }

  /* ---------------------------
     Audio analysis
  ---------------------------- */
  function analyzeAudio() {
    if (!analyser || !timeData) return;

    analyser.getFloatTimeDomainData(timeData);

    // RMS
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length); // ~0..0.2

    // Energy (0..100)
    // tuned: 0.08 rms ~ strong voice
    const energy = clamp((rms / 0.08) * 100, 0, 100);

    // Gate (silence detection)
    // tuned: 0.012..0.02 is low speech
    const gate = clamp((rms / 0.03) * 100, 0, 100);
    const gateState = rms < 0.012 ? "صمت" : "صوت";

    // Clarity heuristic: stability (variance)
    // lower variance implies cleaner/steadier waveform
    let mean = 0;
    for (let i = 0; i < timeData.length; i++) mean += timeData[i];
    mean /= timeData.length;

    let variance = 0;
    for (let i = 0; i < timeData.length; i++) {
      const d = timeData[i] - mean;
      variance += d * d;
    }
    variance /= timeData.length;

    const clarity = clamp(100 - variance * 9000, 0, 100);

    // WPM estimate (heuristic)
    // base 135, energy pushes up, silence pulls down
    const base = 135;
    const wpm = clamp(
      base + (energy - 50) * 0.6 - (gateState === "صمت" ? 20 : 0),
      80,
      190
    );

    m.energy = Math.round(energy);
    m.gate = Math.round(gate);
    m.gateState = gateState;
    m.clarity = Math.round(clarity);
    m.wpm = Math.round(wpm);
  }

  /* ---------------------------
     HUD drawing (glass neon)
  ---------------------------- */
  function drawHUD() {
    if (!showHUD) return;

    const W = hud.width;
    const H = hud.height;

    ctx.clearRect(0, 0, W, H);

    // subtle overlay
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(0, 0, W, H);

    // apply mirror transform for HUD elements if desired
    ctx.save();
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }

    // reticle
    const cx = W / 2;
    const cy = H / 2;

    ctx.strokeStyle = "rgba(168,85,247,0.22)";
    ctx.lineWidth = Math.max(2, W * 0.002);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(W, H) * 0.07, 0, Math.PI * 2);
    ctx.stroke();

    // horizon line
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = Math.max(2, W * 0.0016);
    ctx.beginPath();
    ctx.moveTo(W * 0.12, H * 0.58);
    ctx.lineTo(W * 0.88, H * 0.58);
    ctx.stroke();

    // mini corner indicators
    drawCorner(W * 0.12, H * 0.18);
    drawCorner(W * 0.88, H * 0.18, true);
    drawCorner(W * 0.12, H * 0.88);
    drawCorner(W * 0.88, H * 0.88, true);

    // top-left KPI block
    drawKPIBlock(18, 18);

    ctx.restore();
  }

  function drawCorner(x, y, flip = false) {
    const len = 22;
    ctx.strokeStyle = "rgba(59,130,246,0.16)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (!flip) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x - len, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
    }
    ctx.stroke();
  }

  function drawKPIBlock(x, y) {
    const pad = 10;
    const w = 220;
    const h = 96;

    // glass bg
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();

    // text
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "900 16px system-ui, Tahoma, Arial";
    ctx.fillText("XR HUD", x + pad, y + 24);

    ctx.fillStyle = "rgba(226,232,240,0.82)";
    ctx.font = "800 13px system-ui, Tahoma, Arial";
    ctx.fillText(`WPM: ${m.wpm ?? "—"}`, x + pad, y + 48);
    ctx.fillText(`Energy: ${m.energy}`, x + pad, y + 68);
    ctx.fillText(`Clarity: ${m.clarity}`, x + pad + 110, y + 48);
    ctx.fillText(`Gate: ${m.gateState}`, x + pad + 110, y + 68);
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /* ---------------------------
     Main loop
  ---------------------------- */
  function loop() {
    m.elapsed = Math.floor((performance.now() - t0) / 1000);

    analyzeAudio();
    drawHUD();

    metricsCb && metricsCb({ ...m });

    raf = requestAnimationFrame(loop);
  }

  function onMetrics(cb) {
    metricsCb = cb;
  }

  return {
    // lifecycle
    ensureStarted,
    startSession,
    stopSession,
    stopAll,

    // ui
    resize,
    setHUD,
    setMirror,

    // webxr
    isWebXRARSupported,

    // events
    onMetrics,
  };
}
