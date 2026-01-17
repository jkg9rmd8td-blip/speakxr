// assets/src/core.js
// SpeakXR X-Stage PRO — Core Utilities (Static / GitHub Pages)

export const $ = (q, root = document) => root.querySelector(q);
export const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, t) => a + (b - a) * t;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/* ---------------------------
   Safe JSON / Local Storage
---------------------------- */
export function safeJSONParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return safeJSONParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function lsDel(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------
   Download Helpers
---------------------------- */
export function downloadFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/* ---------------------------
   Fetch Text (for loading prompts etc.)
---------------------------- */
export async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetchText failed: ${res.status} ${res.statusText}`);
  return await res.text();
}

/* ---------------------------
   Canvas DPI Resize
---------------------------- */
export function fitCanvas(canvas, heightPx = null) {
  if (!canvas) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor((heightPx ?? rect.height) * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { w, h, dpr };
}

/* ---------------------------
   Simple Event Bus
---------------------------- */
export function createBus() {
  const map = new Map();
  function on(evt, fn) {
    if (!map.has(evt)) map.set(evt, new Set());
    map.get(evt).add(fn);
    return () => off(evt, fn);
  }
  function off(evt, fn) {
    const s = map.get(evt);
    if (!s) return;
    s.delete(fn);
  }
  function emit(evt, payload) {
    const s = map.get(evt);
    if (!s) return;
    for (const fn of s) {
      try {
        fn(payload);
      } catch (e) {
        console.error("[bus handler error]", evt, e);
      }
    }
  }
  return { on, off, emit };
}

/* ---------------------------
   Audio utilities (for Voice Engine basics)
---------------------------- */
export async function getMicStream(constraints = {}) {
  const base = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...constraints,
    },
    video: false,
  };
  return await navigator.mediaDevices.getUserMedia(base);
}

export function createAudioMeter(stream) {
  // Lightweight RMS meter
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);

  const data = new Uint8Array(analyser.fftSize);
  function readLevel() {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    return clamp(Math.round(rms * 140), 0, 100); // 0..100
  }

  function stop() {
    try { ctx.close(); } catch {}
  }

  return { readLevel, stop, ctx };
}

/* ---------------------------
   Text helpers (fillers, token counts)
---------------------------- */
export function countFillers(text = "") {
  const t = (text || "").toLowerCase();
  const list = ["يعني", "اممم", "اا", "آآ", "مم", "اوكي", "طيب"];
  let c = 0;
  for (const w of list) {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "g");
    const m = t.match(re);
    if (m) c += m.length;
  }
  return c;
}

export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---------------------------
   Debug: check module paths quickly
---------------------------- */
export function debugPaths() {
  // Useful to detect wrong base paths on GitHub Pages
  const base = document.baseURI;
  return {
    base,
    core: new URL("./core.js", base).toString(),
    now: new Date().toISOString(),
  };
}
