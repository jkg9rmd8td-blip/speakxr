// /src/xrStage.js — XR Stage (camera + mic analysis + HUD canvas)
import { clamp } from "./core.js";

export function createXRStage({ video, hud }){
  const ctx = hud.getContext("2d");

  let stream = null;
  let started = false;
  let t0 = 0;
  let raf = null;

  let mirror = false;
  let showHUD = true;

  // audio
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let data = null;

  let cb = null;

  const m = {
    elapsed: 0,
    gate: 0,
    gateState: "—",
    wpm: null,
    energy: 0,
    clarity: 0
  };

  function resize(){
    const r = hud.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    hud.width = Math.floor(r.width * dpr);
    hud.height = Math.floor(r.height * dpr);
  }

  async function ensureStarted(){
    if(started) return true;
    resize();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true
    });

    video.srcObject = stream;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    data = new Float32Array(analyser.fftSize);
    started = true;
    return true;
  }

  function stopAll(){
    stopSession();
    if(stream){
      stream.getTracks().forEach(t=>t.stop());
      stream = null;
    }
    try{ source?.disconnect(); analyser?.disconnect(); }catch{}
    source=null; analyser=null;
    try{ audioCtx?.close(); }catch{}
    audioCtx=null;
    started=false;
  }

  function setMirror(v){ mirror = !!v; }
  function setHUD(v){ showHUD = !!v; }

  function startSession(){
    if(!started) return;
    t0 = performance.now();
    loop();
  }

  function stopSession(){
    try{ cancelAnimationFrame(raf); }catch{}
    raf = null;
  }

  function onMetrics(fn){ cb = fn; }

  function computeAudio(){
    if(!analyser) return;
    analyser.getFloatTimeDomainData(data);

    // RMS
    let sum = 0;
    for(let i=0;i<data.length;i++) sum += data[i]*data[i];
    const rms = Math.sqrt(sum / data.length); // ~0..0.2

    const energy = clamp((rms/0.08)*100, 0, 100);
    const gate = clamp((rms/0.03)*100, 0, 100);
    const gateState = rms < 0.012 ? "صمت" : "صوت";

    // clarity heuristic based on variance
    let mean = 0;
    for(let i=0;i<data.length;i++) mean += data[i];
    mean /= data.length;
    let v = 0;
    for(let i=0;i<data.length;i++){
      const d = data[i] - mean;
      v += d*d;
    }
    v /= data.length;
    const clarity = clamp(100 - v*9000, 0, 100);

    // WPM estimate (heuristic)
    const base = 135;
    const wpm = clamp(base + (energy-50)*0.6 - (gateState==="صمت"? 25:0), 80, 190);

    m.energy = Math.round(energy);
    m.gate = Math.round(gate);
    m.gateState = gateState;
    m.clarity = Math.round(clarity);
    m.wpm = Math.round(wpm);
  }

  function drawHUD(){
    if(!showHUD){
      ctx.clearRect(0,0,hud.width,hud.height);
      return;
    }
    const W = hud.width, H = hud.height;
    ctx.clearRect(0,0,W,H);

    // soft overlay
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillRect(0,0,W,H);

    ctx.save();
    if(mirror){
      ctx.translate(W,0);
      ctx.scale(-1,1);
    }

    // reticle
    ctx.strokeStyle = "rgba(168,85,247,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W/2, H/2, 46, 0, Math.PI*2);
    ctx.stroke();

    // horizon line
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W*0.12, H*0.58);
    ctx.lineTo(W*0.88, H*0.58);
    ctx.stroke();

    // tiny bars bottom left
    const bx = 18, by = H - 18;
    const bw = 160, bh = 8;
    drawBar(bx, by-24, bw, bh, m.energy/100, "Energy");
    drawBar(bx, by-12, bw, bh, m.clarity/100, "Clarity");

    ctx.restore();
  }

  function drawBar(x,y,w,h,p,label){
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle = "rgba(34,211,238,0.95)";
    ctx.fillRect(x,y,w*p,h);
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = `${Math.max(12, Math.floor(hud.width/100))}px Tahoma, Arial`;
    ctx.fillText(label, x, y-4);
  }

  function loop(){
    m.elapsed = Math.floor((performance.now() - t0)/1000);
    computeAudio();
    drawHUD();
    cb && cb({ ...m });
    raf = requestAnimationFrame(loop);
  }

  async function isWebXRARSupported(){
    const xr = navigator.xr;
    if(!xr) return false;
    try{
      return await xr.isSessionSupported("immersive-ar");
    }catch{
      return false;
    }
  }

  return {
    ensureStarted,
    startSession,
    stopSession,
    stopAll,
    resize,
    setMirror,
    setHUD,
    onMetrics,
    isWebXRARSupported,
  };
}
