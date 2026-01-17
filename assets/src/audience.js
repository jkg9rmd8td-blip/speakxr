import { clamp } from "./core.js";

export function createAudience(stage){
  const canvas = document.getElementById("audience");
  const ctx = canvas.getContext("2d");

  let enabled = true;
  let mood = 60; // 0..100

  function resize(){
    const r = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
  }
  window.addEventListener("resize", resize);
  resize();

  function setEnabled(v){
    enabled = !!v;
    if(!enabled) ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  function draw(m){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // خلفية تفاعلية خفيفة
    const g = ctx.createRadialGradient(w*0.5,h*0.65,50,w*0.5,h*0.65,Math.max(w,h));
    g.addColorStop(0, `rgba(59,130,246,${0.08 + m/600})`);
    g.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // نقاط تمثل "جمهور"
    const count = 24;
    for(let i=0;i<count;i++){
      const x = (i+1)/(count+1)*w;
      const y = h*0.75 + Math.sin((Date.now()/800)+i)*8;
      const r = 6 + (m/20);

      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle = m>70
        ? "rgba(34,197,94,.65)"
        : m>40
          ? "rgba(59,130,246,.55)"
          : "rgba(239,68,68,.55)";
      ctx.fill();
    }
  }

  function onSessionStart(){
    mood = 60;
  }
  function onSessionStop(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  function tick(m){
    if(!enabled) return 0;

    const boost = (m.energy*0.55 + m.clarity*0.45);
    const penalty = (m.gateState === "صمت" ? 18 : 0);
    mood = clamp(mood*0.85 + (boost - penalty)*0.15, 0, 100);

    draw(mood);
    return Math.round(mood);
  }

  return {
    setEnabled,
    onSessionStart,
    onSessionStop,
    tick
  };
}
