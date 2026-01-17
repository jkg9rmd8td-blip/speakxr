export function createCommands({ ui, stage, tele, audience, coach, report, store, setStatus }){

  const back = document.getElementById("cpBack");
  const input = document.getElementById("cpInput");
  const list = document.getElementById("cpList");

  const cmds = [
    {k:"start", d:"بدء الجلسة", run:()=>ui.startSession.click()},
    {k:"stop", d:"إيقاف الجلسة", run:()=>ui.stopSession.click()},
    {k:"tele", d:"تشغيل التلقين", run:()=>tele.on()},
    {k:"notele", d:"إيقاف التلقين", run:()=>tele.off()},
    {k:"audience", d:"إظهار/إخفاء الجمهور", run:()=>ui.toggleAudience.click()},
    {k:"save", d:"حفظ الجلسة", run:()=>ui.saveNow.click()},
    {k:"export", d:"تصدير التقرير", run:()=>ui.exportHTML.click()},
  ];

  function open(){
    back.classList.add("on");
    input.value="";
    render("");
    input.focus();
  }
  function close(){
    back.classList.remove("on");
  }

  function render(q){
    list.innerHTML="";
    cmds
      .filter(c=>c.k.includes(q))
      .forEach(c=>{
        const div = document.createElement("div");
        div.className="cpItem";
        div.innerHTML=`<b>${c.k}</b><span>${c.d}</span>`;
        div.onclick=()=>{ c.run(); close(); };
        list.appendChild(div);
      });
  }

  ui.cmdBtn.addEventListener("click", open);
  back.addEventListener("click",(e)=>{ if(e.target===back) close(); });

  document.addEventListener("keydown",(e)=>{
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==="k"){
      e.preventDefault(); open();
    }
    if(e.key==="Escape") close();
  });

  input.addEventListener("input",()=>render(input.value));
}
