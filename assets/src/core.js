// src/core.js
// Utilities: DOM helpers, math, time, download, safe JSON

export const $ = (q, root = document) => root.querySelector(q);
export const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function nowISO() {
  return new Date().toISOString();
}

export function safeJSONParse(raw, fallback) {
  try {
    const x = JSON.parse(raw);
    return x ?? fallback;
  } catch {
    return fallback;
  }
}

export function downloadFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 250);
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
