export function createTeleprompter(ui){
  let on = false;
  let speed = 64;
  let size = 22;
  let text = "";
  let offset = 0;
  let raf = null;

  function render(){
    ui.teleOverlayText.style.fontSize = `${size}px`;
    ui.teleOverlayText.textContent = text || "اكتب نصك… ثم شغل التلقين.";
  }

  function tick(){
    if(!on) return;
    offset += (speed/100);
    ui.teleOverlayText.style.transform = `translateY(${-offset}px)`;
    raf = requestAnimationFrame(tick);
  }

  function setSpeed(v){ speed = v; }
  function setSize(v){ size = v; render(); }
  function setText(t){ text = t; render(); }

  function toggle(){
    on ? off() : onFn();
  }

  function onFn(){
    on = true;
    ui.teleOverlay.classList.add("on");
    render();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }

  function off(){
    on = false;
    ui.teleOverlay.classList.remove("on");
    cancelAnimationFrame(raf);
    raf = null;
    offset = 0;
    ui.teleOverlayText.style.transform = `translateY(0px)`;
  }

  function isOn(){ return on; }

  return { setSpeed, setSize, setText, toggle, on: onFn, off, isOn };
}
