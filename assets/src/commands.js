import { $, $$ } from "./core.js";

export function createCommands({ ui, stage, tele, audience, coach, report, store, setStatus }){
  const cpBack = $("#cpBack");
  const cpInput = $("#cpInput");
  const cpList = $("#cpList");

  const radial = $("#radial");
  const ring = $("#ring");
  const radialLabel = $("#radialLabel");

  const commands = [
    { key:"start", label:"Start Session", hint:"تشغيل الجلسة", run:()=> ui.startSession.click() },
    { key:"stop", label:"Stop Session", hint:"إيقاف الجلسة", run:()=> ui.stopSession.click() },
    { key:"tele", label:"Toggle Teleprompter", hint:"تلقين ON/OFF", run:()=> tele.toggle() },
    { key:"hud", label:"Toggle HUD", hint:"HUD ON/OFF", run:()=> ui.toggleHUD.click() },
    { key:"audience", label:"Toggle Audience", hint:"الجمهور ON/OFF", run:()=> ui.toggleAudience.click() },
    { key:"mirror", label:"Toggle Mirror", hint:"مرآة", run:()=> ui.toggleMirror.click() },
    { key:"save", label:"Save Snapshot", hint:"حفظ الجلسة", run:()=> ui.saveNow.click() },
    { key:"export html", label:"Export HTML", hint:"تقرير HTML", run:()=> ui.exportHTML.click() },
    { key:"export json", label:"Export JSON", hint:"تقرير JSON", run:()=> ui.exportJSON.click() },
    { key:"wipe", label:"Wipe Sessions", hint:"مسح", run:()=> ui.wipe.click() },
  ];

  function openCP(){
    cpBack.classList.add("on");
    cpInput.value = "";
    renderList(commands);
    cpInput.focus();
  }
  function closeCP(){
    cpBack.classList.remove("on");
  }

  function renderList(list){
    cpList.innerHTML = "";
    list.forEach(c=>{
      const row = document.createElement("div");
      row.className = "cpItem";
      row.innerHTML = `<b>${c.label}</b><span>${c.hint} • <code>${c.key}</code></span>`;
      row.addEventListener("click", ()=>{
        closeCP();
        c.run();
        setStatus(`CMD: ${c.key}`, "on");
      });
      cpList.appendChild(row);
    });
  }

  function filter(q){
    const s = q.trim().toLowerCase();
    if(!s) return commands;
    return commands.filter(c =>
      c.key.includes(s) ||
      c.label.toLowerCase().includes(s) ||
      c.hint.toLowerCase().includes(s)
    );
  }

  // Command palette triggers
  ui.cmdBtn.addEventListener("click", openCP);
  window.addEventListener("keydown",(e)=>{
    const isK = e.key.toLowerCase() === "k";
    if((e.ctrlKey || e.metaKey) && isK){
      e.preventDefault();
      openCP();
    }
    if(e.key === "Escape"){
      closeCP();
      closeRadial();
    }
  });

  cpBack.addEventListener("click",(e)=>{
    if(e.target === cpBack) closeCP();
  });

  cpInput.addEventListener("input", ()=>{
    renderList(filter(cpInput.value));
  });

  cpInput.addEventListener("keydown",(e)=>{
    if(e.key === "Enter"){
      const list = filter(cpInput.value);
      if(list[0]){
        closeCP();
        list[0].run();
        setStatus(`CMD: ${list[0].key}`, "on");
      }
    }
  });

  // Radial menu
  const radialItems = [
    { ico:"▶️", label:"Start", run:()=> ui.startSession.click() },
    { ico:"■",  label:"Stop", run:()=> ui.stopSession.click() },
    { ico:"📝", label:"Tele", run:()=> tele.toggle() },
    { ico:"🧿", label:"HUD", run:()=> ui.toggleHUD.click() },
    { ico:"👥", label:"Audience", run:()=> ui.toggleAudience.click() },
    { ico:"💾", label:"Save", run:()=> ui.saveNow.click() },
  ];

  function openRadial(x,y){
    radial.classList.add("on");
    radial.style.left = `${Math.max(12, x - 90)}px`;
    radial.style.top  = `${Math.max(12, y - 90)}px`;
    buildRadial();
  }
  function closeRadial(){
    radial.classList.remove("on");
    ring.innerHTML = "";
  }

  function buildRadial(){
    ring.innerHTML = "";
    const R = 74;
    const center = 90;

    radialItems.forEach((it, idx)=>{
      const a = (Math.PI*2)*(idx/radialItems.length) - Math.PI/2;
      const bx = center + Math.cos(a)*R - 28;
      const by = center + Math.sin(a)*R - 28;

      const b = document.createElement("button");
      b.style.left = `${bx}px`;
      b.style.top = `${by}px`;
      b.textContent = it.ico;

      b.addEventListener("mouseenter", ()=>{
        radialLabel.innerHTML = `XR Menu<br/>${it.label}`;
      });
      b.addEventListener("click", ()=>{
        closeRadial();
        it.run();
        setStatus(`XR Menu: ${it.label}`, "on");
      });

      ring.appendChild(b);
    });
  }

  // Right-click (desktop)
  window.addEventListener("contextmenu",(e)=>{
    // allow text selection in textarea
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if(tag === "textarea" || tag === "input") return;
    e.preventDefault();
    openRadial(e.clientX, e.clientY);
  });

  // Long-press (mobile) -> radial
  let lpTimer = null;
  window.addEventListener("touchstart",(e)=>{
    if(e.touches.length !== 1) return;
    const t = e.touches[0];
    lpTimer = setTimeout(()=>{
      openRadial(t.clientX, t.clientY);
    }, 520);
  }, { passive:true });

  window.addEventListener("touchend",()=>{ if(lpTimer) clearTimeout(lpTimer); lpTimer=null; }, { passive:true });

  // Click outside
  window.addEventListener("click",(e)=>{
    if(radial.classList.contains("on")){
      const inside = radial.contains(e.target);
      if(!inside) closeRadial();
    }
  });

  return { openCP, closeCP };
}
