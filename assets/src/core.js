export const $ = (q, root=document) => root.querySelector(q);
export const $$ = (q, root=document) => Array.from(root.querySelectorAll(q));
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
