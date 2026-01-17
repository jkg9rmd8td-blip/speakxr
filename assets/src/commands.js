// /src/commands.js — Command Palette (⌘K / Ctrl+K)
import { $, $$ } from "./core.js";

export function createCommands(api){
  const {
    setRoute, startSession, stopSession, setStatus,
    tele, stage, store, report, state
  } = api;

  // Create overlay (if not exist in your HTML, we inject it)
  let back = document.querySelector(".cpBackPro");
  if(!back){
    back = document.createElement("div");
    back.className = "cpBackPro";
    back.innerHTML = `
      <div class="cpPro">
        <input id="cpInputPro" placeholder="اكتب أمر… (stage, start, stop, tele, save, export, wipe)"/>
        <div class="cpListPro" id="cpListPro"></div>
      </div>
    `;
    document.body.appendChild(back);
  }

  const input = $("#cpInputPro", back) || document.getElementById("cpInputPro");
  const list = $("#cpListPro", back) || document.getElementById("cpListPro");

  const items = [
    { k: "stage", label: "فتح المسرح", run: ()=>setRoute("stage") },
    { k: "demo", label: "الرجوع للعرض", run: ()=>setRoute("demo") },
    { k: "analysis", label: "فتح التحليل", run: ()=>setRoute("analysis") },
    { k: "jury", label: "فتح التحكيم", run: ()=>setRoute("jury") },
    { k: "executive", label: "فتح التنفيذي", run: ()=>setRoute("executive") },

    { k: "start", label: "بدء جلسة", run: ()=>startSession() },
    { k: "stop", label: "إيقاف جلسة", run: ()=>stopSession() },

    { k: "tele", label: "تشغيل/إيقاف التلقين", run: ()=>tele.toggle() },

    { k: "save", label: "حفظ جلسة", run: ()=>document.getElementById("saveNow")?.click() },
    { k: "export html", label: "تصدير تقرير HTML", run: ()=>document.getElementById("exportHTML")?.click() },
    { k: "export json", label: "تصدير JSON", run: ()=>document.getElementById("exportJSON")?.click() },
    { k: "wipe", label: "مسح البيانات", run: ()=>document.getElementById("wipe")?.click() },
  ];

  function open(){
    back.classList.add("on");
    input.value = "";
    render(items);
    input.focus();
  }
  function close(){
    back.classList.remove("on");
  }

  function render(arr){
    list.innerHTML = "";
    arr.forEach(it=>{
      const div = document.createElement("div");
      div.className = "cpItemPro";
      div.innerHTML = `<b>${it.label}</b><span>${it.k}</span>`;
      div.addEventListener("click", ()=>{
        try { it.run(); } catch(e){ console.error(e); }
        setStatus(`تم تنفيذ: ${it.label}`, "on");
        close();
      });
      list.appendChild(div);
    });
  }

  function filter(q){
    q = (q||"").toLowerCase().trim();
    if(!q) return items;
    return items.filter(it => it.k.includes(q) || it.label.toLowerCase().includes(q));
  }

  // keyboard handler
  window.addEventListener("keydown",(e)=>{
    const isK = (e.key || "").toLowerCase() === "k";
    const cmd = e.metaKey || e.ctrlKey;
    if(cmd && isK){
      e.preventDefault();
      open();
    }
    if(e.key === "Escape") close();
  });

  // click outside
  back.addEventListener("click",(e)=>{
    if(e.target === back) close();
  });

  input.addEventListener("input", ()=>{
    render(filter(input.value));
  });
  input.addEventListener("keydown",(e)=>{
    if(e.key === "Enter"){
      const arr = filter(input.value);
      if(arr[0]){
        arr[0].run();
        setStatus(`تم تنفيذ: ${arr[0].label}`, "on");
        close();
      }
    }
    if(e.key === "Escape") close();
  });

  // button hook
  document.getElementById("cmdBtn")?.addEventListener("click", open);

  // minimal styles injected (so it works even لو CSS ما فيها)
  injectCSS();

  function injectCSS(){
    if(document.getElementById("cpProStyle")) return;
    const st = document.createElement("style");
    st.id = "cpProStyle";
    st.textContent = `
      .cpBackPro{position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.55);z-index:9999}
      .cpBackPro.on{display:grid}
      .cpPro{width:min(760px, calc(100% - 30px));border-radius:18px;border:1px solid rgba(255,255,255,.14);
        background:rgba(0,0,0,.45);backdrop-filter:blur(12px);box-shadow:0 50px 160px rgba(0,0,0,.65);overflow:hidden}
      .cpPro input{width:100%;border:0;outline:0;padding:16px 14px;background:rgba(255,255,255,.06);color:#fff;font-weight:900}
      .cpListPro{max-height:340px;overflow:auto;padding:10px}
      .cpItemPro{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.04);
        display:flex;justify-content:space-between;align-items:center;cursor:pointer;margin-bottom:10px}
      .cpItemPro:hover{border-color:rgba(255,255,255,.22)}
      .cpItemPro span{color:rgba(255,255,255,.65);font-size:12px;font-weight:900}
    `;
    document.head.appendChild(st);
  }
}
