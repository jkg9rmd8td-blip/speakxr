// /src/teleprompter.js
// SpeakXR X-Stage PRO — Teleprompter Engine
// Overlay scrolling text with speed & font-size controls.
// Exposes: setText, setSpeed, setSize, on, off, toggle, isOn, reset

export function createTeleprompter({ overlay, overlayText }) {
  if (!overlay) throw new Error("teleprompter: overlay element required");
  if (!overlayText) throw new Error("teleprompter: overlayText element required");

  let enabled = false;

  // tele state
  let text = "";
  let speed = 64;     // 10..140 (interpreted)
  let size = 22;      // px
  let offset = 0;     // px translateY
  let raf = null;

  // internal: smoothing
  let lastTs = 0;

  function applyRender() {
    overlayText.style.fontSize = `${size}px`;
    overlayText.textContent = text || "اكتب نصك… ثم شغّل التلقين.";
    overlayText.style.transform = `translateY(${-offset}px)`;
  }

  function tick(ts) {
    if (!enabled) return;

    // delta time in seconds
    const dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
    lastTs = ts;

    // speed mapping: 10..140 -> px/sec
    // tuned so 64 feels medium
    const pxPerSec = (speed * 0.85); // ~54 px/sec at 64
    offset += pxPerSec * dt;

    // keep overlay text from running forever into infinity:
    // if huge offset, reset to top (loop)
    if (offset > 50000) offset = 0;

    overlayText.style.transform = `translateY(${-offset}px)`;
    raf = requestAnimationFrame(tick);
  }

  function on() {
    if (enabled) return;
    enabled = true;
    overlay.classList.add("on");
    lastTs = 0;
    applyRender();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function off() {
    enabled = false;
    overlay.classList.remove("on");
    cancelAnimationFrame(raf);
    raf = null;
  }

  function toggle() {
    enabled ? off() : on();
  }

  function isOn() {
    return enabled;
  }

  function reset() {
    offset = 0;
    lastTs = 0;
    applyRender();
  }

  function setText(t) {
    text = String(t ?? "");
    // reset offset when text changes significantly
    // but keep if user is live editing short words
    if (text.length < 40) offset = 0;
    applyRender();
  }

  function setSpeed(v) {
    const n = Number(v);
    speed = Number.isFinite(n) ? n : speed;
    // clamp in case UI passes weird values
    if (speed < 10) speed = 10;
    if (speed > 140) speed = 140;
  }

  function setSize(v) {
    const n = Number(v);
    size = Number.isFinite(n) ? n : size;
    if (size < 14) size = 14;
    if (size > 44) size = 44;
    applyRender();
  }

  return {
    setText,
    setSpeed,
    setSize,
    on,
    off,
    toggle,
    isOn,
    reset,
  };
}
