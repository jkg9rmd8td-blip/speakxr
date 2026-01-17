import { clamp } from "./core.js";

export function createXRStage(ui){
  const video = document.getElementById("cam");
  const hud = document.getElementById("hud");
  const ctx = hud.getContext("2d");

  let stream = null;
  let started = false;
  let t0 = 0;
  let raf = null;

  let scenario = "مقابلة";
  let env = "studio";
  let mirror = false;
  let showHUD = true;

  // audio analysis (basic real)
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let data = null;

  let metricsCb = null;

  const state = {
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

  window.addEventListener("resize", resize);

  async function ensureStarted(){
    if(started) return true;
    resize();

    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"user" }, audio: true });
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
    try{ cancelAnimationFrame(raf); }catch{}
    raf = null;
    if(stream){
      stream.getTracks().forEach(t=>t.stop());
      stream = null;
    }
    try{ source?.disconnect(); analyser?.disconnect(); }catch{}
    source=null; analyser=null;
    try{ audioCtx?.close(); }catch{}
    audioCtx=null;
    started=false;
    state.elapsed=0;
  }

  function setScenario(s){ scenario = s; }
  function setEnv(e){ env = e; }
  function setMirror(v){ mirror = !!v; }
  function setHUD(v){ showHUD = !!v; }

  function startSession(){
    t0 = performance.now();
    loop();
  }

  function stopSession(){
    try{ cancelAnimationFrame(raf); }catch{}
    raf = null;
  }

  function snapshot(sc, env){
    return {
      at: new Date().toISOString(),
      scenario: sc,
      env,
      metrics: { ...state }
    };
  }

  function computeAudio(){
    if(!analyser) return;
    analyser.getFloatTimeDomainData(data);

    // RMS energy
    let sum=0;
    for(let i=0;i<data.length;i++) sum += data[i]*data[i];
    const rms = Math.sqrt(sum/data.length); // ~0..0.2
    const energy = clamp((rms/0.08)*100, 0, 100);

    // gate: detect silence
    const gate = clamp((rms/0.03)*100, 0, 100);
    const gateState = rms < 0.012 ? "صمت" : "صوت";

    // pseudo clarity: stability indicator
    // (lower variance => better)
    let mean = 0;
    for(let i=0;i<data.length;i++) mean += data[i];
    mean /= data.length;
    let v=0;
    for(let i=0;i<data.length;i++){
      const d = data[i]-mean;
      v += d*d;
    }
    v /= data.length;
    const clarity = clamp(100 - v*9000, 0, 100);

    state.energy = Math.round(energy);
    state.gate = Math.round(gate);
    state.gateState = gateState;
    state.clarity = Math.round(clarity);

    // WPM estimate from energy (rough)
    const base = 135;
    state.wpm = Math.round(clamp(base + (state.energy-50)*0.6 - (gateState==="صمت"? 20:0), 80, 190));
  }

  function drawHUD(){
    if(!showHUD) { ctx.clearRect(0,0,hud.width,hud.height); return; }
    ctx.clearRect(0,0,hud.width,hud.height);

    const w = hud.width, h = hud.height;

    // soft vignette
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0,0,w,h);

    ctx.save();
    if(mirror){
      ctx.translate(w,0);
      ctx.scale(-1,1);
    }

    // overlay line
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w*0.1, h*0.55);
    ctx.lineTo(w*0.9, h*0.55);
    ctx.stroke();

    // center reticle
    ctx.strokeStyle = "rgba(168,85,247,0.18)";
    ctx.beginPath();
    ctx.arc(w/2, h/2, 36, 0, Math.PI*2);
    ctx.stroke();

    ctx.restore();
  }

  function loop(){
    state.elapsed = Math.floor((performance.now()-t0)/1000);
    computeAudio();
    drawHUD();
    metricsCb && metricsCb({ ...state });
    raf = requestAnimationFrame(loop);
  }

  async function tryWebXR(){
    // lightweight feature detect
    const xr = navigator.xr;
    if(!xr) return false;
    try{
      const ok = await xr.isSessionSupported("immersive-ar");
      return !!ok;
    }catch{
      return false;
    }
  }

  function onMetrics(cb){ metricsCb = cb; }

  return {
    ensureStarted,
    startSession,
    stopSession,
    stopAll,
    setScenario,
    setEnv,
    setMirror,
    setHUD,
    snapshot,
    tryWebXR,
    onMetrics
  };
}
