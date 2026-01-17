// app.js — SpeakXR X-Stage PRO (Static / GitHub Pages)
// Fixes full navigation + robust wiring + QoL improvements
// - Tabs routing (data-route -> .view[data-view])
// - URL hash support (#demo #stage ...)
// - Remember last route (localStorage)
// - Safe DOM access (no crash if some ids are missing)
// - Smooth scroll + active tab highlight
// - Stage resize on view enter

import { $, $$, sleep } from "./src/core.js";

// Optional modules (only if you already have them)
// If any file not present, comment its import line.
import { createXRStage } from "./src/xrStage.js";
import { createAudience } from "./src/audience.js";
import { createTeleprompter } from "./src/teleprompter.js";
import { createCoach } from "./src/coach.js";
import { createStore } from "./src/store.js";
import { createReport } from "./src/report.js";
import { createCommands } from "./src/commands.js";

// ---------- Safe helpers ----------
const safe = (v) => (v === null || v === undefined ? null : v);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const setTxt = (el, t) => { if (el) el.textContent = t; };
const setDisabled = (el, v) => { if (el) el.disabled = !!v; };

const ROUTE_KEY = "sx_route_v1";

function normalizeRoute(x) {
  const r = (x || "").replace("#", "").trim();
  return r || "demo";
}

function collectViews() {
  return $$(".view").map(v => ({
    el: v,
    name: v.getAttribute("data-view")
  }));
}

function collectTabs() {
  return $$("#tabs .tab").map(b => ({
    el: b,
    route: b.getAttribute("data-route")
  }));
}

// ---------- UI map (minimal required for routing) ----------
const ui = {
  tabsWrap: $("#tabs"),
  tabBtns: $$("#tabs .tab"),
  views: $$(".view"),
};

// ---- MUST exist check ----
if (!ui.tabBtns.length || !ui.views.length) {
  console.warn("⚠️ Tabs or views not found. Check index.html structure.");
}

// ---------- Core state ----------
const state = {
  route: "demo",
  sessionOn: false,
};

// ---------- Initialize modules safely ----------
const store = createStore?.() || null;
const report = createReport?.(store) || null;

const stage = (() => {
  const video = $("#cam");
  const hud = $("#hud");
  if (!video || !hud || !createXRStage) return null;
  try { return createXRStage({ video, hud }); } catch(e){ console.error(e); return null; }
})();

const audience = (() => {
  const canvas = $("#audience");
  if (!canvas || !createAudience) return null;
  try { return createAudience({ canvas }); } catch(e){ console.error(e); return null; }
})();

const tele = (() => {
  const overlay = $("#teleOverlay");
  const overlayText = $("#teleOverlayText");
  if (!overlay || !overlayText || !createTeleprompter) return null;
  try { return createTeleprompter({ overlay, overlayText }); } catch(e){ console.error(e); return null; }
})();

const coach = (() => {
  if (!createCoach) return null;
  try { return createCoach(); } catch(e){ console.error(e); return null; }
})();

// ---------- Status ----------
const dot = $("#dot");
const statusEl = $("#status");
function setStatus(txt, mode="on"){
  setTxt(statusEl, txt);
  if(dot){
    dot.style.background =
      mode==="bad" ? "rgba(239,68,68,.95)" :
      mode==="warn"? "rgba(245,158,11,.95)" :
      "rgba(34,197,94,.95)";
    dot.style.boxShadow =
      mode==="bad" ? "0 0 12px rgba(239,68,68,.7)" :
      mode==="warn"? "0 0 12px rgba(245,158,11,.7)" :
      "0 0 12px rgba(34,197,94,.7)";
  }
}

// ---------- Routing ----------
function setRoute(route, { pushHash=true, remember=true } = {}){
  route = normalizeRoute(route);
  state.route = route;

  // highlight tabs
  ui.tabBtns.forEach(b=>{
    b.classList.toggle("on", b.getAttribute("data-route") === route);
  });

  // show view
  ui.views.forEach(v=>{
    v.classList.toggle("on", v.getAttribute("data-view") === route);
  });

  // update url hash
  if(pushHash){
    // avoid scroll jump by using replaceState
    history.replaceState(null, "", `#${route}`);
  }

  // remember
  if(remember){
    try{ localStorage.setItem(ROUTE_KEY, route); }catch{}
  }

  // on-enter view hooks
  if(route === "stage"){
    // Ensure canvases correct size
    if(stage?.resize) stage.resize();
    if(audience?.resize) audience.resize();
    // scroll into stage smoothly
    $("#stageWrap")?.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  if(route === "analysis"){
    // make sure timeline canvas drawn if you have it
    $("#timeline")?.scrollIntoView({ behavior:"smooth", block:"start" });
  }
}

// Tab clicks
on(ui.tabsWrap, "click", (e)=>{
  const btn = e.target.closest(".tab");
  if(!btn) return;
  const route = btn.getAttribute("data-route");
  setRoute(route);
});

// Hash navigation (when user types #stage etc.)
window.addEventListener("hashchange", ()=>{
  const r = normalizeRoute(location.hash);
  setRoute(r, { pushHash:false, remember:true });
});

// Load initial route: hash > remembered > default
(function bootRoute(){
  const fromHash = normalizeRoute(location.hash);
  let fromStore = "demo";
  try{ fromStore = normalizeRoute(localStorage.getItem(ROUTE_KEY)); }catch{}
  const initial = location.hash ? fromHash : fromStore;
  setRoute(initial, { pushHash:true, remember:true });
})();

// ---------- Quick buttons navigation (optional, if exist) ----------
on($("#goStageBtn"), "click", ()=> setRoute("stage"));
on($("#goStage2"), "click", ()=> setRoute("stage"));
on($("#goStage3"), "click", ()=> setRoute("stage"));
on($("#pickScenarioBtn"), "click", ()=>{
  setRoute("demo");
  $("#scenarioPanel")?.scrollIntoView({ behavior:"smooth", block:"start" });
});

// ---------- Stage session wiring (if buttons exist) ----------
async function startSession(){
  if(!stage?.ensureStarted) {
    alert("XR Stage غير جاهز: تأكد أن عناصر #cam و #hud موجودة.");
    return;
  }
  try{
    setStatus("طلب صلاحيات الكاميرا/المايك…", "warn");
    await stage.ensureStarted();
    stage.resize?.();
    audience?.resize?.();

    stage.startSession?.();
    coach?.reset?.();

    state.sessionOn = true;

    setDisabled($("#startSession"), true);
    setDisabled($("#stopSession"), false);
    setDisabled($("#startAll"), true);
    setDisabled($("#stopAll"), false);

    setStatus("جلسة شغالة ✅", "on");
  }catch(err){
    console.error(err);
    setStatus("رفض صلاحيات الكاميرا/المايك", "bad");
    alert("لازم تسمح للكاميرا والمايك.");
  }
}

function stopSession(){
  stage?.stopSession?.();
  state.sessionOn = false;

  setDisabled($("#startSession"), false);
  setDisabled($("#stopSession"), true);
  setDisabled($("#startAll"), false);
  setDisabled($("#stopAll"), true);

  setStatus("تم الإيقاف ■", "warn");
}

on($("#startSession"), "click", startSession);
on($("#stopSession"), "click", stopSession);
on($("#startAll"), "click", startSession);
on($("#stopAll"), "click", ()=>{
  tele?.off?.();
  stopSession();
  stage?.stopAll?.();
  setStatus("تم إيقاف الكل", "warn");
});

// ---------- Tele controls ----------
on($("#toggleTele"), "click", ()=>{
  tele?.toggle?.();
  setStatus(tele?.isOn?.() ? "Teleprompter: ON" : "Teleprompter: OFF", "on");
});
on($("#teleText"), "input", (e)=> tele?.setText?.(e.target.value));
on($("#teleSpeed"), "input", (e)=> tele?.setSpeed?.(+e.target.value));
on($("#teleSize"), "input", (e)=> tele?.setSize?.(+e.target.value));

// ---------- HUD/Audience/Mirror toggles ----------
on($("#toggleHUD"), "click", ()=>{
  if(!stage?.setHUD) return;
  stage._hudOn = !stage._hudOn;
  stage.setHUD(stage._hudOn);
  setStatus(stage._hudOn ? "HUD: ON" : "HUD: OFF", "on");
});
on($("#toggleAudience"), "click", ()=>{
  if(!audience?.setEnabled) return;
  audience._on = !audience._on;
  audience.setEnabled(audience._on);
  setStatus(audience._on ? "Audience: ON" : "Audience: OFF", "on");
});
on($("#toggleMirror"), "click", ()=>{
  if(!stage?.setMirror) return;
  stage._mir = !stage._mir;
  stage.setMirror(stage._mir);
  setStatus(stage._mir ? "Mirror: ON" : "Mirror: OFF", "on");
});

// ---------- Metrics plumbing (if stage emits metrics) ----------
if(stage?.onMetrics){
  stage.onMetrics((m)=>{
    // update demo mini hud if exists
    const wpmV = $("#wpmV"), enV = $("#enV"), clV = $("#clV"), auV = $("#auV");
    setTxt(wpmV, m.wpm ?? "—");
    setTxt(enV, m.energy ?? "—");
    setTxt(clV, m.clarity ?? "—");

    // audience tick
    let auScore = 0;
    if(audience?.tick){
      auScore = audience.tick({
        clarity: m.clarity,
        energy: m.energy,
        gateState: m.gateState,
        pressure: +($("#pressure")?.value ?? 45),
        audienceSense: +($("#audienceSense")?.value ?? 55),
      });
    }
    setTxt(auV, auScore ? `${auScore}` : "—");

    // bars if exist
    const wpmBar = $("#wpmBar"), enBar = $("#enBar"), clBar = $("#clBar"), auBar = $("#auBar");
    if(wpmBar) wpmBar.style.width = `${Math.max(0, Math.min(100, 100 - Math.abs((m.wpm ?? 140) - 140) * 1.8))}%`;
    if(enBar) enBar.style.width = `${Math.max(0, Math.min(100, m.energy ?? 0))}%`;
    if(clBar) clBar.style.width = `${Math.max(0, Math.min(100, m.clarity ?? 0))}%`;
    if(auBar) auBar.style.width = `${Math.max(0, Math.min(100, auScore ?? 0))}%`;

    // coach line
    const coachBox = $("#coachBox");
    if(coachBox && coach?.liveLine){
      coachBox.textContent = coach.liveLine({
        mode: "soft",
        metrics: { ...m, audience: auScore },
        pressure: +($("#pressure")?.value ?? 45),
        audienceSense: +($("#audienceSense")?.value ?? 55),
        scenario: "—",
        env: "—",
      });
    }
  });
}

// ---------- Commands (⌘K) optional ----------
try{
  createCommands?.({
    stage,
    tele,
    store,
    report,
    setRoute,
    startSession,
    stopSession,
    setStatus,
    state,
  });
}catch(e){ /* ignore */ }

// ---------- Final init ----------
setStatus("جاهز — التابات شغالة ✅", "on");
