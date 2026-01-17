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

  function onSessionStart(){ /* optional */ }
  function onSessionStop(){ /* optional */ }

  function tick(m){
    if(!enabled) return 0;

    // mood influenced by clarity+energy and gate (silence)
    const boost = (m.clarity*0.45 + m.energy*0.55);
    const penalty = (m.gateState === "صمت" ? 18 : 0);
    mood = clamp(mood*0.85 + (boost - penalty)*0.15, 0, 100);

    draw(mood);
    return Math.round(mood);
  }

 
