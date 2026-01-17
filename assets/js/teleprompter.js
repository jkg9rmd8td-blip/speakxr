// /src/teleprompter.js — Overlay teleprompter with speed/size
export function createTeleprompter({ overlay, overlayText }){
  let on = false;
  let speed = 64; // 10..140
  let size = 22;  // px
  let text = "";
  let offset = 0;
  let raf = null;

  function render(){
    overlayText.style.fontSize = `${size}px`;
    overlayText.textContent = text || "اكتب نصك… ثم شغل التلقين.";
  }

  function tick(){
    if(!on) return;
    // speed normalized
    offset += (speed / 95);
    overlayText.style.transform = `translateY(${-offset}px)`;
    raf = requestAnimationFrame(tick);
  }

  function setSpeed(v){ speed = v; }
  function setSize(v){ size = v; render(); }
  function setText(t){ text = t; render(); }

  function onFn(){
    on = true;
    overlay.classList.add("on");
    render();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function off(){
    on = false;
    overlay.classList.remove("on");
    cancelAnimationFrame(raf);
    raf = null;
    offset = 0;
    overlayText.style.transform = `translateY(0px)`;
  }

  function toggle(){ on ? off() : onFn(); }
  function isOn(){ return on; }

  return { setSpeed, setSize, setText, on: onFn, off, toggle, isOn };
}
