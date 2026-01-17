// /src/audience.js
// SpeakXR X-Stage PRO — Audience Engine (Canvas)
// Draws an abstract audience that reacts to clarity/energy/silence + settings.
// Exposes: setEnabled, tick, resize

import { clamp, lerp, fitCanvasToRect } from "./core.js";

export function createAudience({ canvas }) {
  if (!canvas) throw new Error("audience: canvas required");
  const ctx = canvas.getContext("2d");

  let enabled = true;

  // mood & dynamics (0..100)
  let mood = 60;
  let applause = 0;     // 0..100 (short bursts)
  let boredom = 0;      // 0..100
  let focus = 60;       // 0..100

  // particles
  const crowd = [];
  const MAX = 120;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    fitCanvasToRect(canvas, rect);
    // regenerate if empty
    if (crowd.length === 0) seedCrowd();
  }

  function seedCrowd() {
    crowd.length = 0;
    const W = canvas.width, H = canvas.height;
    for (let i = 0; i < MAX; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      crowd.push({
        x, y,
        r: 6 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 1.2,
        wobble: 0.6 + Math.random() * 1.6,
      });
    }
  }

  window.addEventListener("resize", resize);
  resize();

  function setEnabled(v) {
    enabled = !!v;
    if (!enabled) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function compute(m) {
    const clarity = clamp(m.clarity ?? 0, 0, 100);
    const energy = clamp(m.energy ?? 0, 0, 100);
    const gateState = m.gateState ?? "—";

    const pressure = clamp(m.pressure ?? 45, 0, 100);
    const sense = clamp(m.audienceSense ?? 55, 0, 100);

    // base response: clarity+energy lifts mood
    const boost = clarity * 0.55 + energy * 0.45;

    // silence penalty depends on pressure/sense
    const silencePenalty = gateState === "صمت"
      ? (14 + pressure * 0.10 + sense * 0.10)
      : 0;

    // jitter penalty: lower clarity means more jitter
    const jitterPenalty = (100 - clarity) * 0.08 + (sense * 0.05);

    // mood update (smooth)
    const targetMood = clamp(boost - silencePenalty - jitterPenalty, 0, 100);
    mood = lerp(mood, targetMood, 0.10);

    // focus & boredom
    const targetFocus = clamp(clarity * 0.75 + energy * 0.25 - pressure * 0.10, 0, 100);
    focus = lerp(focus, targetFocus, 0.08);

    const targetBored = clamp((100 - energy) * 0.45 + (gateState === "صمت" ? 25 : 0) + pressure * 0.10, 0, 100);
    boredom = lerp(boredom, targetBored, 0.06);

    // applause bursts when mood crosses thresholds
    const clapTarget = mood > 75 && energy > 55 ? 70 : mood > 85 ? 85 : 0;
    applause = lerp(applause, clapTarget, 0.10);

    // return computed score
    return Math.round(mood);
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // very subtle overlay to make crowd visible on any camera feed
    ctx.fillStyle = "rgba(0,0,0,0.02)";
    ctx.fillRect(0, 0, W, H);

    if (!enabled) return;

    // background glow based on mood/focus
    const glowA = 0.06 + (mood / 100) * 0.10;
    ctx.fillStyle = `rgba(168,85,247,${glowA})`;
    ctx.beginPath();
    ctx.ellipse(W * 0.25, H * 0.75, W * 0.32, H * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    const glowB = 0.05 + (focus / 100) * 0.10;
    ctx.fillStyle = `rgba(59,130,246,${glowB})`;
    ctx.beginPath();
    ctx.ellipse(W * 0.75, H * 0.70, W * 0.32, H * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // crowd dots
    const baseAlpha = 0.10 + (mood / 100) * 0.15;
    const jitter = (boredom / 100) * 0.9;

    crowd.forEach((p, idx) => {
      const t = performance.now() / 1000;

      const wobX = Math.sin(t * p.speed + p.phase) * p.wobble * (1 + jitter);
      const wobY = Math.cos(t * (p.speed * 0.9) + p.phase) * p.wobble * (1 + jitter);

      const x = p.x + wobX;
      const y = p.y + wobY;

      // radius shrinks with boredom
      const rr = p.r * (0.85 + (mood / 100) * 0.35) * (1 - (boredom / 100) * 0.25);

      // color shifts: low mood -> amber, high mood -> teal/purple
      const hot = mood < 45 ? 1 : 0;
      const a = baseAlpha + (applause / 100) * 0.10;

      if (hot) ctx.fillStyle = `rgba(245,158,11,${a})`;
      else ctx.fillStyle = `rgba(34,211,238,${a})`;

      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();

      // occasional "spark" when applause high
      if (applause > 55 && idx % 9 === 0) {
        ctx.strokeStyle = `rgba(255,255,255,${0.10 + applause / 100 * 0.12})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, rr + 10 + (applause / 6), 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // bottom bar indicator (mood)
    const barW = W * 0.55;
    const barH = 10;
    const bx = (W - barW) / 2;
    const by = H - 22;

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(bx, by, barW, barH);

    ctx.fillStyle = `rgba(34,197,94,${0.35 + mood / 100 * 0.30})`;
    ctx.fillRect(bx, by, (barW * mood) / 100, barH);
  }

  // External tick: called by app.js each metrics update
  function tick(m) {
    if (!enabled) return 0;
    const score = compute(m);
    draw();
    return score;
  }

  return {
    setEnabled,
    tick,
    resize,
  };
}
