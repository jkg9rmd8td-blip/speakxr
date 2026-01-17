// /src/audience.js — Audience Engine (Canvas mood + applause particles)
import { clamp } from "./core.js";

export function createAudience({ canvas }){
  const ctx = canvas.getContext("2d");
  let enabled = true;
  let mood = 60; // 0..100
  let particles = [];

  function resize(){
    const r = canvas.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
  }

  function setEnabled(v){
    enabled = !!v;
    if(!enabled) ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  function spawnApplause(intensity){
    const W = canvas.width, H = canvas.height;
    const n = Math.round(clamp(intensity/12, 2, 10));
    for(let i=0;i<n;i++){
      particles.push({
        x: Math.random()*W,
        y: H - 30 - Math.random()*60,
        vx: (Math.random()-0.5)*2.2,
        vy: - (1.4 + Math.random()*2.6),
        life: 40 + Math.random()*40,
      });
    }
  }

  function tick({ clarity=0, energy=0, gateState="صوت", pressure=45, audienceSense=55 }){
    if(!enabled) return 0;

    const boost = (clarity*0.55 + energy*0.45);
    const penalty = (gateState === "صمت" ? 22 : 0);
    const sensePenalty = (audienceSense*0.12);
    const pressurePenalty = (pressure*0.08);

    mood = clamp(mood*0.86 + (boost - penalty - sensePenalty - pressurePenalty)*0.14, 0, 100);

    if(mood > 72 && energy > 60 && gateState !== "صمت"){
      spawnApplause(mood);
    }

    draw();
    return Math.round(mood);
  }

  function draw(){
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    // subtle overlay
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(0,0,W,H);

    // audience silhouettes
    const rows = 3;
    for(let r=0;r<rows;r++){
      const y = H*0.70 + r*28;
      const count = 10 + r*6;
      for(let i=0;i<count;i++){
        const x = (i/(count-1))*(W-40) + 20 + (Math.sin(i*1.7+r)*4);
        const alpha = clamp((mood/100)*0.22, 0.06, 0.22) * (1 - r*0.15);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x,y, 10 - r*1.2, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // mood label (top right)
    const label = mood < 40 ? "😐" : mood < 65 ? "🙂" : "👏";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${Math.max(18, Math.floor(W/28))}px Tahoma, Arial`;
    ctx.fillText(`${label}  ${Math.round(mood)}%`, W-120, 34);

    // particles
    for(const p of particles){
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.life -= 1;
      ctx.fillStyle = "rgba(34,211,238,0.75)";
      ctx.fillRect(p.x, p.y, 4, 4);
    }
    particles = particles.filter(p=>p.life>0);
  }

  return { resize, setEnabled, tick };
}
