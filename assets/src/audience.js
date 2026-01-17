import { clamp } from "./core.js";

export function createAudience(stage){
  const canvas = document.getElementById("audience");
  const ctx = canvas.getContext("2d");

  let enabled = true;
  let mood = 60; // 0..100
  let lastEmoji = "🙂";
  let lastText = "الجمهور متابع";

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

  function onSessionStart(){ /* placeholder */ }
  function onSessionStop(){ /* placeholder */ }

  function draw(m){
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // soft overlay (audience fog)
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0,0,w,h);

    // mood to emoji/text
    if(m > 82){ lastEmoji="👏"; lastText="تصفيق… كمل!"; }
    else if(m > 62){ lastEmoji="🙂"; lastText="الجمهور متابع"; }
    else if(m > 45){ lastEmoji="😐"; lastText="ركز… فيه تشتت بسيط"; }
    else if(m > 28){ lastEmoji="😕"; lastText="فيه ملل… اختصر واذكر مثال"; }
    else { lastEmoji="😬"; lastText="ضغط عالي… عدّل النبرة وقلل الحشو"; }

    // render floating audience dots (bokeh)
    const count = Math.floor(18 + (m/100)*28);
    for(let i=0;i<count;i++){
      const x = (Math.random()*0.9 + 0.05) * w;
      const y = (Math.random()*0.7 + 0.15) * h;
      const r = (Math.random()*10 + 6) * (1 + (m/100)*0.4);
      const a = 0.05 + (m/100)*0.08;

      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }

    // mood badge bottom-right
    const bx = w - 20;
    const by = h - 20;
    ctx.font = `bold ${Math.floor(Math.max(18, w/40))}px system-ui, -apple-system, Tahoma`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";

    // background pill
    const text = `${lastEmoji}  ${lastText}`;
    const metrics = ctx.measureText(text);
    const pad = 14;
    const pw = metrics.width + pad*2;
    const ph = 46;

    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;

    roundRect(ctx, bx - pw, by - ph, pw, ph, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(text, bx - 14, by - 12);
  }

  function roundRect(ctx,x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function tick(m){
    if(!enabled) return 0;

    // mood influenced by clarity+energy and gate (silence)
    const boost = (m.clarity*0.45 + m.energy*0.55);

    // silence hurts more if repeated
    const penalty = (m.gateState === "صمت" ? 18 : 0);

    // faster WPM slightly helps if clarity good; hurts if clarity low
    const paceEffect = (m.wpm ? (m.wpm - 140) : 0);
    const paceAdj = clamp((paceEffect/60)*8, -10, 10) * (m.clarity > 60 ? 1 : -0.7);

    mood = clamp(mood*0.86 + (boost - penalty + paceAdj)*0.14, 0, 100);

    draw(mood);
    return Math.round(mood);
  }

  function getLabel(){
    return { emoji: lastEmoji, text: lastText, mood: Math.round(mood) };
  }

  return {
    setEnabled,
    onSessionStart,
    onSessionStop,
    tick,
    getLabel
  };
}
