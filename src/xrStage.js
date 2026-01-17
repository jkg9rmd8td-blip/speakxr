// src/xrStage.js
// XR Stage Engine: Camera + Audio Analysis + HUD + Metrics Loop

import { clamp } from "./core.js";

export function createXRStage({ video, hud }) {
  const ctx = hud.getContext("2d");

  let stream = null;
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let audioData = null;

  let raf = null;
  let started = false;
  let sessionOn = false;
  let t0 = 0;

  let mirror = false;
  let showHUD = true;

  let metricsCB = null;

  const state = {
    elapsed: 0,
    wpm: null,
    energy: 0,
    clarity: 0,
    gate: 0,
    gateState: "—",
  };

  /* ---------------- Resize ---------------- */
  function resize() {
    const r = hud.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    hud.width = Math.floor(r.width * dpr);
    hud.height = Math.floor(r.height * dpr);
  }
  window.addEventListener("resize", resize);

  /* ---------------- Start Devices ---------------- */
  async function ensureStarted() {
    if (started) return true;

    resize();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true,
    });

    video.srcObject = stream;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioData = new Float32Array(analyser.fftSize);

    started = true;
    return true;
  }

  /* ---------------- Stop All ---------------- */
  function stopAll() {
    cancelAnimationFrame(raf);
    raf = null;

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    try {
      source?.disconnect();
      analyser?.disconnect();
      audioCtx?.close();
    } catch {}

    source = null;
    analyser = null;
    audioCtx = null;
    started = false;
    sessionOn = false;
    state.elapsed = 0;
  }

  /* ---------------- Session ---------------- */
  function startSession() {
    if (!started) return;
    sessionOn = true;
    t0 = performance.now();
    loop();
  }

  function stopSession() {
    sessionOn = false;
    cancelAnimationFrame(raf);
    raf = null;
  }

  /* ---------------- Audio Metrics ---------------- */
  function computeAudio() {
    if (!analyser) return;

    analyser.getFloatTimeDomainData(audioData);

    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);

    // Energy (0–100)
    const energy = clamp((rms / 0.08) * 100, 0, 100);

    // Gate (silence detection)
    const gate = clamp((rms / 0.03) * 100, 0, 100);
    const gateState = rms < 0.012 ? "صمت" : "صوت";

    // Clarity (signal stability heuristic)
    let mean = 0;
    for (let i = 0; i < audioData.length; i++) mean += audioData[i];
    mean /= audioData.length;

    let variance = 0;
    for (let i = 0; i < audioData.length; i++) {
      const d = audioData[i] - mean;
      variance += d * d;
    }
    variance /= audioData.length;

    const clarity = clamp(100 - variance * 9000, 0, 100);

    // WPM estimate (heuristic)
    const base = 135;
    const wpm = Math.round(
      clamp(base + (energy - 50) * 0.6 - (gateState === "صمت" ? 20 : 0), 80, 190)
    );

    state.energy = Math.round(energy);
    state.gate = Math.round(gate);
    state.gateState = gateState;
    state.clarity = Math.round(clarity);
    state.wpm = wpm;
  }

  /* ---------------- HUD Drawing ---------------- */
  function drawHUD() {
    if (!showHUD) {
      ctx.clearRect(0, 0, hud.width, hud.height);
      return;
    }

    ctx.clearRect(0, 0, hud.width, hud.height);

    const w = hud.width;
    const h = hud.height;

    ctx.save();
    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    // vignette
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, w, h);

    // center reticle
    ctx.strokeStyle = "rgba(99,102,241,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 36, 0, Math.PI * 2);
    ctx.stroke();

    // horizon line
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.55);
    ctx.lineTo(w * 0.9, h * 0.55);
    ctx.stroke();

    ctx.restore();
  }

  /* ---------------- Main Loop ---------------- */
  function loop() {
    if (!sessionOn) return;

    state.elapsed = Math.floor((performance.now() - t0) / 1000);
    computeAudio();
    drawHUD();

    metricsCB && metricsCB({ ...state });

    raf = requestAnimationFrame(loop);
  }

  /* ---------------- API ---------------- */
  function setMirror(v) {
    mirror = !!v;
  }

  function setHUD(v) {
    showHUD = !!v;
  }

  function onMetrics(cb) {
    metricsCB = cb;
  }

  async function isWebXRARSupported() {
    if (!navigator.xr) return false;
    try {
      return await navigator.xr.isSessionSupported("immersive-ar");
    } catch {
      return false;
    }
  }

  return {
    ensureStarted,
    startSession,
    stopSession,
    stopAll,
    resize,
    setMirror,
    setHUD,
    onMetrics,
    isWebXRARSupported,
  };
}
