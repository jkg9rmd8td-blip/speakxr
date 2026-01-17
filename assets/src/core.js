export const $ = (q, root=document) => root.querySelector(q);
export const $$ = (q, root=document) => Array.from(root.querySelectorAll(q));
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}

export function downloadText(filename, text){
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename, obj){
  downloadText(filename, JSON.stringify(obj, null, 2));
}
