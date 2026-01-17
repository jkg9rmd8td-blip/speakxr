// /src/core.js
// SpeakXR X-Stage PRO — Core Utilities (DOM, math, time, downloads, safe text, canvas helpers)

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
   Download helpers
---------------------------- */
export function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename, obj) {
  downloadText(filename, JSON.stringify(obj, null, 2), "application/json;charset=utf-8");
}

/* ---------------------------
   Safe HTML
---------------------------- */
export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------------------
   Canvas utils
---------------------------- */
export function fitCanvasToRect(canvas, rect, targetHeightPx = null) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = rect.width;
  const h = targetHeightPx != null ? targetHeightPx : rect.height;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  return { dpr, w: canvas.width, h: canvas.height };
}

/* ---------------------------
   Rolling buffer
---------------------------- */
export function pushRolling(arr, value, max = 90) {
  arr.push(value);
  if (arr.length > max) arr.shift();
  return arr;
}

/* ---------------------------
   Scoring helpers
---------------------------- */
export function scoreWPM(wpm, target = 140, tolerance = 60) {
  if (wpm == null || Number.isNaN(wpm)) return 0;
  // linear penalty around target
  const diff = Math.abs(wpm - target);
  const raw = 100 - (diff / tolerance) * 100;
  return clamp(Math.round(raw), 0, 100);
}

export function scoreGate(gateState) {
  // Simple: silence is bad during session, voice is good
  return gateState === "صمت" ? 30 : 85;
}

/* ---------------------------
   Locale / date
---------------------------- */
export function formatArDate(iso) {
  try {
    return new Date(iso).toLocaleString("ar-SA");
  } catch {
    return String(iso || "");
  }
}
