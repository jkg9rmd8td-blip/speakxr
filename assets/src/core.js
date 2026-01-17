// /src/core.js
// SpeakXR X-Stage PRO — Core Utilities
// DOM helpers, math helpers, canvas helpers, audio math

/* -------------------------
   DOM helpers
-------------------------- */
export const $ = (q, root = document) => root.querySelector(q);
export const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));

/* -------------------------
   Math helpers
-------------------------- */
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* -------------------------
   Canvas helpers
-------------------------- */
export function fitCanvasToRect(canvas, rect) {
  if (!canvas || !rect) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* -------------------------
   Audio analysis helpers
-------------------------- */
// RMS (energy) from time-domain signal
export function rmsFromTimeDomain(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    sum += v * v;
  }
  return Math.sqrt(sum / arr.length);
}

// Variance proxy (used for clarity / stability)
export function varianceFromTimeDomain(arr) {
  let mean = 0;
  for (let i = 0; i < arr.length; i++) mean += arr[i];
  mean /= arr.length;

  let v = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - mean;
    v += d * d;
  }
  return v / arr.length;
}

/* -------------------------
   Misc helpers
-------------------------- */
export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
