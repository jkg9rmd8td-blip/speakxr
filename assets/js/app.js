import { $, $$, clamp, fmtTime } from "./src/core.js";
import { createXRStage } from "./src/xrStage.js";
import { createTeleprompter } from "./src/teleprompter.js";
import { createAudience } from "./src/audience.js";
import { createCoach } from "./src/coach.js";
import { createReport } from "./src/report.js";
import { createStore } from "./src/store.js";
import { createCommands } from "./src/commands.js";

const ui = {
  dot: $("#dot"),
  status: $("#status"),

  scenarioV: $("#scenarioV"),
  timeV: $("#timeV"),
  timeBar: $("#timeBar"),
  gateV: $("#gateV"),
  gateBar: $("#gateBar"),

  wpmV: $("#wpmV"),
  enV: $("#enV"),
  clV: $("#clV"),
  auV: $("#auV"),
  wpmBar: $("#wpmBar"),
  enBar: $("#enBar"),
  clBar: $("#clBar"),
  auBar: $("#auBar"),

  scenarioSeg: $("#scenarioSeg"),
  envSeg: $("#envSeg"),

  teleText: $("#teleText"),
  teleSpeed: $("#teleSpeed"),
  teleSize: $("#teleSize"),
  teleOverlay: $("#teleOverlay"),
  teleOverlayText: $("#teleOverlayText"),
  teleRun: $("#teleRun"),
  telePause: $("#telePause"),

  coachBox: $("#coachBox"),

  rScore: $("#rScore"),
  rDecision: $("#rDecision"),
  rSummary: $("#rSummary"),
  rCount: $("#rCount"),

  cmdBtn: $("#cmdBtn"),
  presentBtn: $("#presentBtn"),
  startAll: $("#startAll"),
  stopAll: $("#stopAll"),

  toggleMirror: $("#toggleMirror"),
  toggleAudience: $("#toggleAudience"),
  toggleTele: $("#toggleTele"),
  toggleHUD: $("#toggleHUD"),
  startAR: $("#startAR"),
  startSession: $("#startSession"),
  stopSession: $("#stopSession"),

  saveNow: $("#saveNow"),
  exportHTML: $("#exportHTML"),
  exportJSON: $("#exportJSON"),
  wipe: $("#wipe"),

  dock: $("#dock"),
};

const store = createStore();
const report = createReport(store, ui);
report.refreshUI();

const stage = createXRStage(ui);
const audience = createAudience(stage);
const tele = createTeleprompter(ui);
const coach = createCoach(ui);

const state = {
  scenario: "مقابلة",
  env: "studio",
  showAudience: true,
  showHUD: true,
  mirror: false,
  presenter: false,
  sessionOn: false,
};

function setDot(mode){
  ui.dot.classList.remove("on","warn","bad");
  if(mode==="on") ui.dot.classList.add("on");
  if(mode==="warn") ui.dot.classList.add("warn");
  if(mode==="bad") ui.dot.classList.add("bad");
}

function setStatus(txt, mode=""){
  ui.status.textContent = txt;
  if(mode) setDot(mode);
}

function setSegOn(segEl, attr, value){
  [...segEl.querySelectorAll("button")].forEach(b=>{
    b.classList.toggle("on", b.getAttribute(attr) === value);
  });
}

// Scenario / Env
ui.scenarioSeg.addEventListener("click",(e)=>{
  const b = e.target.closest("button"); if(!b) return;
  state.scenario = b.dataset.sc;
  setSegOn(ui.scenarioSeg, "data-sc", state.scenario);
  stage.setScenario(state.scenario);
  ui.scenarioV.textContent = state.scenario;
  setStatus(`Scenario: ${state.scenario}`, "on");
});

ui.envSeg.addEventListener("click",(e)=>{
  const b = e.target.closest("button"); if(!b) return;
  state.env = b.dataset.env;
  setSegOn(ui.envSeg, "data-env", state.env);
  stage.setEnv(state.env);
  setStatus(`Env: ${state.env}`, "on");
});

// Scenario cards
$$(".scCard").forEach(card=>{
  card.addEventListener("click", ()=>{
    state.scenario = card.dataset.sc || state.scenario;
    state.env = card.dataset.env || state.env;

    setSegOn(ui.scenarioSeg, "data-sc", state.scenario);
    setSegOn(ui.envSeg, "data-env", state.env);

    stage.setScenario(state.scenario);
    stage.setEnv(state.env);

    location.hash = "#xr";
    setStatus(`تم اختيار: ${state.scenario} • ${state.env}`, "on");
  });
});

// Tele
ui.teleSpeed.addEventListener("input", ()=> tele.setSpeed(+ui.teleSpeed.value));
ui.teleSize.addEventListener("input", ()=> tele.setSize(+ui.teleSize.value));
ui.teleText.addEventListener("input", ()=> tele.setText(ui.teleText.value));
ui.teleRun.addEventListener("click", ()=> { tele.on(); setStatus("Teleprompter ON", "on"); });
ui.telePause.addEventListener("click", ()=> { tele.off(); setStatus("Teleprompter OFF", "warn"); });

// Toggles
ui.toggleMirror.addEventListener("click", ()=>{
  state.mirror = !state.mirror;
  stage.setMirror(state.mirror);
  setStatus(state.mirror ? "مرآة ON" : "مرآة OFF", "on");
});

ui.toggleAudience.addEventListener("click", ()=>{
  state.showAudience = !state.showAudience;
  audience.setEnabled(state.showAudience);
  setStatus(state.showAudience ? "الجمهور ON" : "الجمهور OFF", state.showAudience ? "on":"warn");
});

ui.toggleHUD.addEventListener("click", ()=>{
  state.showHUD = !state.showHUD;
  stage.setHUD(state.showHUD);
  setStatus(state.showHUD ? "HUD ON" : "HUD OFF", state.showHUD ? "on":"warn");
});

ui.toggleTele.addEventListener("click", ()=>{
  tele.toggle();
  setStatus(tele.isOn() ? "Teleprompter ON" : "Teleprompter OFF", tele.isOn() ? "on":"warn");
});

// Session
ui.startSession.addEventListener("click", async ()=>{
  try{
    await stage.ensureStarted(); // camera + mic
    state.sessionOn = true;

    stage.startSession();
    audience.onSessionStart();
    coach.onSessionStart();

    setStatus("جلسة شغالة", "on");

    ui.startSession.disabled = true;
    ui.stopSession.disabled = false;
    ui.startAll.disabled = true;
    ui.stopAll.disabled = false;
  }catch(err){
    console.error(err);
    setStatus("رفض صلاحيات الكاميرا/المايك", "bad");
    alert("لازم تسمح بالكاميرا والمايك.");
  }
});

ui.stopSession.addEventListener("click", ()=>{
  state.sessionOn = false;

  stage.stopSession();
  audience.onSessionStop();
  coach.onSessionStop();

  setStatus("تم الإيقاف", "warn");

  ui.startSession.disabled = false;
  ui.stopSession.disabled = true;
  ui.startAll.disabled = false;
  ui.stopAll.disabled = true;
});

// Start/Stop All
ui.startAll.addEventListener("click", ()=> ui.startSession.click());
ui.stopAll.addEventListener("click", ()=>{
  tele.off();
  ui.stopSession.click();
  stage.stopAll();
  setStatus("تم إيقاف الكل", "warn");
});

// Presenter
ui.presentBtn.addEventListener("click", ()=>{
  state.presenter = !state.presenter;
  document.body.classList.toggle("presenter", state.presenter);
  setStatus(state.presenter ? "Presenter Mode" : "Normal Mode", "on");
});

// WebXR AR (optional)
ui.startAR.addEventListener("click", async ()=>{
  const ok = await stage.tryWebXR();
  if(!ok) alert("WebXR AR غير مدعوم هنا. (لكن الكاميرا + HUD شغالين).");
});

// Report actions
ui.saveNow.addEventListener("click", ()=>{
  const snap = stage.snapshot(state.scenario, state.env);
  const saved = report.save(snap);
  setStatus(`تم حفظ الجلسة (${saved.score}/100)`, "on");
});

ui.exportHTML.addEventListener("click", ()=> report.exportHTML());
ui.exportJSON.addEventListener("click", ()=> report.exportJSON());
ui.wipe.addEventListener("click", ()=>{
  if(confirm("متأكد تمسح كل السجلات؟")) {
    report.wipe();
    setStatus("تم المسح", "warn");
  }
});

// Dock actions
ui.dock.addEventListener("click",(e)=>{
  const b = e.target.closest("button");
  if(!b) return;
  [...ui.dock.querySelectorAll("button")].forEach(x=>x.classList.remove("on"));
  b.classList.add("on");

  const act = b.dataset.action;
  if(act === "stage") location.hash = "#xr";
  if(act === "tele") { tele.on(); location.hash="#xr"; }
  if(act === "report") location.hash = "#analyze";
  if(act === "coach") location.hash = "#analyze";
  setStatus(`Dock: ${act}`, "on");
});

// Metrics loop
stage.onMetrics((m)=>{
  coach.tick(m);
  const au = audience.tick(m);
  m.audience = au;

  // WPM score: closeness to 140
  m.wpmScore = clamp(100 - Math.abs((m.wpm||140) - 140) * 1.8, 0, 100);

  ui.timeV.textContent = fmtTime(m.elapsed);
  ui.timeBar.style.width = `${((m.elapsed%60)/60)*100}%`;

  ui.scenarioV.textContent = state.scenario;

  ui.gateV.textContent = m.gateState;
  ui.gateBar.style.width = `${clamp(m.gate,0,100)}%`;

  ui.wpmV.textContent = m.wpm ?? "—";
  ui.enV.textContent = m.energy ?? "—";
  ui.clV.textContent = m.clarity ?? "—";
  ui.auV.textContent = m.audience ?? "—";

  ui.wpmBar.style.width = `${clamp(m.wpmScore,0,100)}%`;
  ui.enBar.style.width  = `${clamp(m.energy,0,100)}%`;
  ui.clBar.style.width  = `${clamp(m.clarity,0,100)}%`;
  ui.auBar.style.width  = `${clamp(m.audience,0,100)}%`;
});

// Commands (⌘K + RightClick)
createCommands({
  ui,
  stage,
  tele,
  audience,
  coach,
  report,
  store,
  setStatus
});

// Init
setSegOn(ui.scenarioSeg, "data-sc", state.scenario);
setSegOn(ui.envSeg, "data-env", state.env);
stage.setScenario(state.scenario);
stage.setEnv(state.env);
ui.scenarioV.textContent = state.scenario;
setStatus("جاهز — اختر سيناريو وابدأ", "on");
