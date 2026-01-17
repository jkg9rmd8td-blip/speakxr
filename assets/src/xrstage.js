// /src/xrStage.js
// SpeakXR X-Stage PRO — XR Stage Engine (Camera + Mic + HUD)
// Real getUserMedia + AudioAnalyser metrics + HUD overlay rendering.
// Exposes: ensureStarted, startSession, stopSession, stopAll,
//          setHUD, setMirror, resize, onMetrics, isWebXRARSupported

import { clamp, fitCanvasToRect, rmsFromTimeDomain, varianceFromTimeDomain } from "./core.js";

export function createXRStage({ video, hud }) {
  if (!video) throw new Error("xrStage: video element required");
  if (!hud) throw new Error("xrStage: hud canvas required");

  const ctx = hud.getContext("2d");

  let stream = null;
  let started = false;
  let sessionOn = false;
  let raf = null;
  let t0 = 0;

  let showHUD = true;
  let mirror = false;

  // Audio
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let data = null;

  // Callback
  let metricsCb = null;

  // Running state metrics
  const m = {
    elapsed: 0,
    gate: 0,
    gateState: "—",
    wpm: null,
    energy: 0,
    clarity: 0,
    // optional fields: stable for other modules
    rms: 0,
  };

  function resize() {
    // Fit HUD canvas
    const rect = hud.getBoundingClientRect();
    fitCanvasToRect(hud, rect);
  }

  window.addEventListener("resize", resize);

  async function ensureStarted() {
    if (started) return true;

    // Fit once before starting
    resize();

    // Request camera+mic
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    video.srcObject = stream;

    // Audio analysis
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    data = new Float32Array(analyser.fftSize);

    started = true;
    return true;
  }

  function stopAll() {
    stopSession();

    // stop stream tracks
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    // audio cleanup
    try { source?.disconnect(); } catch {}
    try { analyser?.disconnect(); } catch {}
    source = null;
    analyser = null;

    try { audioCtx?.close(); } catch {}
    audioCtx = null;

    data = null;
    started = false;

    // reset metrics
    Object.assign(m, {
      elapsed: 0,
      gate: 0,
      gateState: "—",
      wpm: null,
      energy: 0,
      clarity: 0,
      rms: 0,
    });
  }

  function setHUD(v) {
    showHUD = !!v;
    if (!showHUD) ctx.clearRect(0, 0, hud.width, hud.height);
  }

  function setMirror(v) {
    mirror = !!v;
    // Mirror the video element for UX (and HUD will follow)
    video.style.transform = mirror ? "scaleX(-1)" : "none";
  }

  function onMetrics(cb) {
    metricsCb = cb;
  }

  function startSession() {
    if (!started) return;
    if (sessionOn) return;

    sessionOn = true;
    t0 = performance.now();
    loop();
  }

  function stopSession() {
    sessionOn = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    // leave camera running (stopAll controls hardware)
    // clear HUD softly if needed
  }

  function computeAudioMetrics() {
    if (!analyser || !data) return;

    analyser.getFloatTimeDomainData(data);

    // RMS energy (~0..0.2 typical)
    const rms = rmsFromTimeDomain(data);
    m.rms = rms;

    // Convert to 0..100
    const energy = clamp((rms / 0.08) * 100, 0, 100);

    // Gate detects silence / weak signal
    const gate = clamp((rms / 0.03) * 100, 0, 100);
    const gateState = rms < 0.012 ? "صمت" : "صوت";

    // Clarity proxy: inverse variance
    const v = varianceFromTimeDomain(data);
    const clarity = clamp(100 - v * 9000, 0, 100);

    m.energy = Math.round(energy);
    m.gate = Math.round(gate);
    m.gateState = gateState;
    m.clarity = Math.round(clarity);

    // WPM heuristic: energy drives pace, silence pulls down
    const base = 135;
    const wpm = clamp(base + (m.energy - 50) * 0.6 - (gateState === "صمت" ? 22 : 0), 80, 190);
    m.wpm = Math.round(wpm);
  }

  function drawHUD() {
    if (!showHUD) return;

    const W = hud.width, H = hud.height;
    ctx.clearRect(0, 0, W, H);

    // soft overlay
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(0, 0, W, H);

    // gradient frame
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "rgba(168,85,247,0.18)");
    g.addColorStop(0.5, "rgba(255,255,255,0.06)");
    g.addColorStop(1, "rgba(59,130,246,0.16)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.2;
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.stroke();

    // reticle
    ctx.strokeStyle = "rgba(168,85,247,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.07, 0, Math.PI * 2);
    ctx.stroke();

    // crosshair lines
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W * 0.15, H / 2);
    ctx.lineTo(W * 0.85, H / 2);
    ctx.stroke();

    // HUD meters (bottom left)
    const boxW = Math.max(260, W * 0.22);
    const boxH = 128;
    const bx = 14;
    const by = H - boxH - 16;

    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, boxW, boxH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `${Math.floor(H * 0.020)}px system-ui, Tahoma, Arial`;
    ctx.fillText(`XR HUD`, bx + 14, by + 26);

    const lineY = by + 52;
    drawMeter(ctx, bx + 14, lineY, boxW - 28, 10, m.energy, "Energy");
    drawMeter(ctx, bx + 14, lineY + 24, boxW - 28, 10, m.clarity, "Clarity");
    drawMeter(ctx, bx + 14, lineY + 48, boxW - 28, 10, clamp((m.wpm ?? 0) - 80, 0, 110) / 110 * 100, `WPM ${m.wpm ?? "—"}`);

    // gate status (top right pill)
    const pill = `${m.gateState} • Gate ${m.gate}`;
    ctx.font = `bold ${Math.floor(H * 0.018)}px system-ui, Tahoma, Arial`;
    const tw = ctx.measureText(pill).width;
    const px = W - tw - 36;
    const py = 22;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    roundRect(ctx, px, py, tw + 22, 32, 999);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = m.gateState === "صمت" ? "rgba(245,158,11,0.95)" : "rgba(34,197,94,0.95)";
    ctx.fillText(pill, px + 12, py + 22);
  }

  function loop() {
    if (!sessionOn) return;

    m.elapsed = Math.floor((performance.now() - t0) / 1000);
    computeAudioMetrics();
    drawHUD();

    if (metricsCb) metricsCb({ ...m });

    raf = requestAnimationFrame(loop);
  }

  async function isWebXRARSupported() {
    const xr = navigator.xr;
    if (!xr) return false;
    try {
      return await xr.isSessionSupported("immersive-ar");
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

/* ---------- Helpers ---------- */

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

function drawMeter(ctx, x, y, w, h, val, label) {
  const v = clamp(val, 0, 100);

  // label
  ctx.fillStyle = "rgba(226,232,240,0.78)";
  ctx.font = `600 12px system-ui, Tahoma, Arial`;
  ctx.fillText(label, x, y - 6);

  // bg
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(x, y, w, h);

  // fg gradient
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, "rgba(34,211,238,0.95)");
  g.addColorStop(0.5, "rgba(59,130,246,0.92)");
  g.addColorStop(1, "rgba(168,85,247,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, (w * v) / 100, h);

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.strokeRect(x, y, w, h);
}
