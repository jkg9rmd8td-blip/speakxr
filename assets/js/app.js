// app.js — SpeakXR X-Stage PRO (Static / GitHub Pages)
// Full wiring: tabs routing, stage session, metrics, audience, teleprompter,
// executive dashboard, jury board, analysis timeline, data table, export.

import { $, $$, clamp, fmtTime, sleep } from "./src/core.js";
import { createXRStage } from "./src/xrStage.js";
import { createTeleprompter } from "./src/teleprompter.js";
import { createAudience } from "./src/audience.js";
import { createCoach } from "./src/coach.js";
import { createStore } from "./src/store.js";
import { createReport } from "./src/report.js";
import { createCommands } from "./src/commands.js";

/* ---------------------------
   UI MAP (PRO index.html)
---------------------------- */
const ui = {
  // status
  dot: $("#dot"),
  status: $("#status"),

  // top buttons
  cmdBtn: $("#cmdBtn"),
  presentBtn: $("#presentBtn"),
  startAll: $("#startAll"),
  stopAll: $("#stopAll"),

  // tabs
  tabs: $("#tabs"),
  tabBtns: $$("#tabs .tab"),
  views: $$(".view"),

  // demo quick actions
  goStageBtn: $("#goStageBtn"),
  pickScenarioBtn: $("#pickScenarioBtn"),
  downloadReportBtn: $("#downloadReportBtn"),

  // KPI demo
  kpiSessions: $("#kpiSessions"),
  kpiBest: $("#kpiBest"),
  kpiReady: $("#kpiReady"),

  // mini HUD values
  wpmV: $("#wpmV"),
  enV: $("#enV"),
  clV: $("#clV"),
  auV: $("#auV"),
  wpmBar: $("#wpmBar"),
  enBar: $("#enBar"),
  clBar: $("#clBar"),
  auBar: $("#auBar"),

  coachBox: $("#coachBox"),

  // report mini
  rScore: $("#rScore"),
  rDecision: $("#rDecision"),
  rSummary: $("#rSummary"),
  rCount: $("#rCount"),
  saveNow: $("#saveNow"),
  exportHTML: $("#exportHTML"),
  exportJSON: $("#exportJSON"),
  wipe: $("#wipe"),

  // WebXR view
  xrSupport: $("#xrSupport"),
  checkXRBtn: $("#checkXRBtn"),
  startAR: $("#startAR"),

  // executive
  exSessions: $("#exSessions"),
  exBest: $("#exBest"),
  exLast: $("#exLast"),
  exReady: $("#exReady"),
  execText: $("#execText"),
  exportExecutive: $("#exportExecutive"),
  goStage2: $("#goStage2"),

  // settings
  coachModeSeg: $("#coachModeSeg"),
  pressure: $("#pressure"),
  audienceSense: $("#audienceSense"),
  autoTele: $("#autoTele"),

  // jury
  jConfidence: $("#jConfidence"),
  jVoice: $("#jVoice"),
  jAudience: $("#jAudience"),
  jBuild: $("#jBuild"),
  finalScore: $("#finalScore"),
  finalBar: $("#finalBar"),
  finalDecision: $("#finalDecision"),
  calcJury: $("#calcJury"),
  juryExport: $("#juryExport"),

  // analysis
  aWpm: $("#aWpm"),
  aConf: $("#aConf"),
  aFillers: $("#aFillers"),
  timeline: $("#timeline"),
  tips: $("#tips"),

  // data
  sessionsTbl: $("#sessionsTbl"),
  refreshData: $("#refreshData"),
  goStage3: $("#goStage3"),

  // stage elements
  stageWrap: $("#stageWrap"),
  video: $("#cam"),
  hud: $("#hud"),
  audienceCanvas: $("#audience"),

  teleOverlay: $("#teleOverlay"),
  teleOverlayText: $("#teleOverlayText"),
  teleText: $("#teleText"),
  teleSpeed: $("#teleSpeed"),
  teleSize: $("#teleSize"),

  toggleMirror: $("#toggleMirror"),
  toggleAudience: $("#toggleAudience"),
  toggleTele: $("#toggleTele"),
  toggleHUD: $("#toggleHUD"),

  startSession: $("#startSession"),
  stopSession: $("#stopSession"),
};

/* ---------------------------
   Core State
---------------------------- */
const store = createStore();
const report = createReport(store);
const stage = createXRStage({ video: ui.video, hud: ui.hud });
const audience = createAudience({ canvas: ui.audienceCanvas });
const tele = createTeleprompter({
  overlay: ui.teleOverlay,
  overlayText: ui.teleOverlayText,
});
const coach = createCoach();

const state = {
  route: "demo",
  presenter: false,
  sessionOn: false,

  scenario: "مقابلة",
  env: "conference",

  showHUD: true,
  showAudience: true,
  mirror: false,

  // settings
  coachMode: "soft", // soft | direct | jury
  pressure: 45,
  audienceSense: 55,
  autoTele: false,

  // last metrics
  metrics: {
    elapsed: 0,
    wpm: null,
    energy: 0,
    clarity: 0,
    fillers: 0,
    gate: 0,
    gateState: "—",
    audience: 0,
  },

  // timeline buffer
  timeline: {
    wpm: [],
    energy: [],
    clarity: [],
    max: 90,
  },
};

/* ---------------------------
   Helpers: status dot
---------------------------- */
function setDot(mode = "on") {
  // Keep simple: green-ish always, but blink by class in CSS if you want.
  ui.dot.style.background =
    mode === "bad" ? "rgba(239,68,68,.95)"
    : mode === "warn" ? "rgba(245,158,11,.95)"
    : "rgba(34,197,94,.95)";
  ui.dot.style.boxShadow =
    mode === "bad" ? "0 0 12px rgba(239,68,68,.7)"
    : mode === "warn" ? "0 0 12px rgba(245,158,11,.7)"
    : "0 0 12px rgba(34,197,94,.7)";
}
function setStatus(txt, mode="on") {
  ui.status.textContent = txt;
  setDot(mode);
}

/* ---------------------------
   Routing (Tabs)
---------------------------- */
function setRoute(route) {
  state.route = route;
  ui.tabBtns.forEach(b => b.classList.toggle("on", b.dataset.route === route));
  ui.views.forEach(v => v.classList.toggle("on", v.dataset.view === route));

  // Small UX: when opening stage, ensure canvases resized
  if (route === "stage") {
    stage.resize();
    audience.resize();
    ui.stageWrap?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  refreshDashboards();
}
ui.tabs?.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  setRoute(btn.dataset.route);
});

/* ---------------------------
   Scenario selection (PRO cards)
---------------------------- */
$$(".scPro").forEach(btn => {
  btn.addEventListener("click", () => {
    state.scenario = btn.dataset.sc || state.scenario;
    state.env = btn.dataset.env || state.env;
    setStatus(`تم اختيار: ${state.scenario} • ${state.env}`, "on");
    // go stage quickly
    setRoute("stage");
  });
});

/* ---------------------------
   Stage controls
---------------------------- */
ui.toggleMirror?.addEventListener("click", () => {
  state.mirror = !state.mirror;
  stage.setMirror(state.mirror);
  setStatus(state.mirror ? "المرآة: ON" : "المرآة: OFF", "on");
});

ui.toggleHUD?.addEventListener("click", () => {
  state.showHUD = !state.showHUD;
  stage.setHUD(state.showHUD);
  setStatus(state.showHUD ? "HUD: ON" : "HUD: OFF", "on");
});

ui.toggleAudience?.addEventListener("click", () => {
  state.showAudience = !state.showAudience;
  audience.setEnabled(state.showAudience);
  setStatus(state.showAudience ? "الجمهور: ON" : "الجمهور: OFF", "on");
});

ui.toggleTele?.addEventListener("click", () => {
  tele.toggle();
  setStatus(tele.isOn() ? "Teleprompter: ON" : "Teleprompter: OFF", "on");
});

/* ---------------------------
   Teleprompter inputs
---------------------------- */
ui.teleText?.addEventListener("input", () => tele.setText(ui.teleText.value));
ui.teleSpeed?.addEventListener("input", () => tele.setSpeed(+ui.teleSpeed.value));
ui.teleSize?.addEventListener("input", () => tele.setSize(+ui.teleSize.value));

/* ---------------------------
   Settings (coach mode / pressure / audienceSense / autoTele)
---------------------------- */
ui.coachModeSeg?.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.coachMode = b.dataset.mode;
  $$("#coachModeSeg button").forEach(x => x.classList.toggle("on", x === b));
  setStatus(`Coach Mode: ${state.coachMode}`, "on");
});
ui.pressure?.addEventListener("input", () => {
  state.pressure = +ui.pressure.value;
});
ui.audienceSense?.addEventListener("input", () => {
  state.audienceSense = +ui.audienceSense.value;
});
ui.autoTele?.addEventListener("change", () => {
  state.autoTele = !!ui.autoTele.checked;
});

/* ---------------------------
   Start/Stop session (real mic+cam)
---------------------------- */
async function startSession() {
  if (state.sessionOn) return;

  try {
    setStatus("طلب صلاحيات الكاميرا والمايك…", "warn");
    await stage.ensureStarted();
    stage.resize();
    audience.resize();

    state.sessionOn = true;
    ui.startSession.disabled = true;
    ui.stopSession.disabled = false;
    ui.startAll.disabled = true;
    ui.stopAll.disabled = false;

    if (state.autoTele && !tele.isOn()) tele.on();

    stage.startSession();
    coach.reset();
    setStatus("جلسة شغالة ✅", "on");
  } catch (err) {
    console.error(err);
    setStatus("فشل تشغيل الكاميرا/المايك", "bad");
    alert("لازم تسمح للكاميرا والمايك في المتصفح.");
  }
}
function stopSession() {
  if (!state.sessionOn) return;
  state.sessionOn = false;

  stage.stopSession();
  ui.startSession.disabled = false;
  ui.stopSession.disabled = true;
  ui.startAll.disabled = false;
  ui.stopAll.disabled = true;

  setStatus("تم الإيقاف ■", "warn");
}
ui.startSession?.addEventListener("click", startSession);
ui.stopSession?.addEventListener("click", stopSession);

// topbar start/stop all
ui.startAll?.addEventListener("click", startSession);
ui.stopAll?.addEventListener("click", () => {
  if (tele.isOn()) tele.off();
  stopSession();
  stage.stopAll();
  setStatus("تم إيقاف الكل", "warn");
});

/* ---------------------------
   Demo buttons
---------------------------- */
ui.goStageBtn?.addEventListener("click", () => setRoute("stage"));
ui.goStage2?.addEventListener("click", () => setRoute("stage"));
ui.goStage3?.addEventListener("click", () => setRoute("stage"));

ui.pickScenarioBtn?.addEventListener("click", () => {
  // scroll to scenario panel in demo view
  setRoute("demo");
  $("#scenarioPanel")?.scrollIntoView({ behavior:"smooth", block:"start" });
});

ui.downloadReportBtn?.addEventListener("click", () => {
  // if no sessions, auto generate quick report from last metrics
  const html = report.exportLastHTMLOrStub(state, buildJuryFromMetrics(state.metrics));
  report.download("SpeakXR_Report.html", html);
  setStatus("تم تنزيل تقرير HTML", "on");
});

/* ---------------------------
   Presenter mode
---------------------------- */
ui.presentBtn?.addEventListener("click", () => {
  state.presenter = !state.presenter;
  document.body.classList.toggle("presenter", state.presenter);
  setStatus(state.presenter ? "Presenter: ON" : "Presenter: OFF", "on");
});

/* ---------------------------
   WebXR support checks
---------------------------- */
ui.checkXRBtn?.addEventListener("click", async () => {
  ui.xrSupport.textContent = "جارٍ الفحص…";
  const ok = await stage.isWebXRARSupported();
  ui.xrSupport.textContent = ok ? "✅ Supported (immersive-ar)" : "❌ Not supported";
});
ui.startAR?.addEventListener("click", async () => {
  const ok = await stage.isWebXRARSupported();
  if (!ok) {
    alert("WebXR AR غير مدعوم على هذا الجهاز/المتصفح. التجربة ستعمل XR بالكاميرا/HUD.");
    return;
  }
  alert("تم اكتشاف دعم WebXR AR. (في هذا النموذج: نعرض دعم فقط، وXR Stage يعمل بالكامل بالكاميرا).");
});

/* ---------------------------
   Live Metrics Loop
---------------------------- */
const timelineCtx = ui.timeline?.getContext("2d");
function pushTimeline(m) {
  state.timeline.wpm.push(m.wpm ?? 0);
  state.timeline.energy.push(m.energy ?? 0);
  state.timeline.clarity.push(m.clarity ?? 0);

  const max = state.timeline.max;
  if (state.timeline.wpm.length > max) state.timeline.wpm.shift();
  if (state.timeline.energy.length > max) state.timeline.energy.shift();
  if (state.timeline.clarity.length > max) state.timeline.clarity.shift();
}

function renderBars() {
  const m = state.metrics;

  ui.wpmV.textContent = m.wpm ?? "—";
  ui.enV.textContent = m.energy ? `${m.energy}` : "—";
  ui.clV.textContent = m.clarity ? `${m.clarity}` : "—";
  ui.auV.textContent = m.audience ? `${m.audience}` : "—";

  const wpmScore = clamp(100 - Math.abs((m.wpm ?? 140) - 140) * 1.8, 0, 100);
  ui.wpmBar.style.width = `${wpmScore}%`;
  ui.enBar.style.width = `${clamp(m.energy,0,100)}%`;
  ui.clBar.style.width = `${clamp(m.clarity,0,100)}%`;
  ui.auBar.style.width = `${clamp(m.audience,0,100)}%`;
}

function renderAnalysis() {
  const m = state.metrics;
  ui.aWpm.textContent = m.wpm ?? "—";
  // confidence is derived here from clarity+energy and pressure
  const conf = clamp(Math.round(m.clarity*0.55 + m.energy*0.45 - state.pressure*0.10), 0, 100);
  ui.aConf.textContent = conf ? `${conf}` : "—";
  ui.aFillers.textContent = m.fillers ? `${m.fillers}` : "—";

  ui.tips.textContent = coach.makeTips({
    mode: state.coachMode,
    metrics: m,
    pressure: state.pressure,
    audienceSense: state.audienceSense,
    scenario: state.scenario,
    env: state.env,
  });
}

function drawTimeline() {
  if (!timelineCtx || !ui.timeline) return;
  const c = ui.timeline;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = c.getBoundingClientRect();
  c.width = Math.floor(rect.width * dpr);
  c.height = Math.floor(220 * dpr);

  const W = c.width, H = c.height;
  timelineCtx.clearRect(0,0,W,H);
  timelineCtx.fillStyle = "rgba(0,0,0,0.18)";
  timelineCtx.fillRect(0,0,W,H);

  // grid
  timelineCtx.strokeStyle = "rgba(255,255,255,0.08)";
  timelineCtx.lineWidth = 1;
  for (let i=1;i<=4;i++){
    const y = (H*i)/5;
    timelineCtx.beginPath();
    timelineCtx.moveTo(0,y);
    timelineCtx.lineTo(W,y);
    timelineCtx.stroke();
  }

  const series = [
    { arr: state.timeline.wpm.map(v => clamp((v-80)/110*100,0,100)), stroke:"rgba(34,211,238,0.95)" }, // wpm normalized
    { arr: state.timeline.energy, stroke:"rgba(56,189,248,0.95)" },
    { arr: state.timeline.clarity, stroke:"rgba(99,102,241,0.95)" },
  ];

  series.forEach(s=>{
    const arr = s.arr;
    if (!arr.length) return;
    timelineCtx.strokeStyle = s.stroke;
    timelineCtx.lineWidth = 2.5;
    timelineCtx.beginPath();
    const n = arr.length;
    for (let i=0;i<n;i++){
      const x = (i/(n-1||1))*(W-20)+10;
      const y = H - (arr[i]/100)*(H-20) - 10;
      if(i===0) timelineCtx.moveTo(x,y);
      else timelineCtx.lineTo(x,y);
    }
    timelineCtx.stroke();
  });
}

stage.onMetrics((m) => {
  // augment with audience engine (real time)
  const audienceScore = audience.tick({
    clarity: m.clarity,
    energy: m.energy,
    gateState: m.gateState,
    pressure: state.pressure,
    audienceSense: state.audienceSense,
  });

  const fillers = coach.estimateFillers(m); // heuristic based on gate+energy jitter

  state.metrics = {
    ...m,
    audience: audienceScore,
    fillers,
  };

  pushTimeline(state.metrics);

  // coach update
  ui.coachBox.textContent = coach.liveLine({
    mode: state.coachMode,
    metrics: state.metrics,
    pressure: state.pressure,
    audienceSense: state.audienceSense,
    scenario: state.scenario,
    env: state.env,
  });

  // UI updates
  renderBars();
  renderAnalysis();
  drawTimeline();

  // auto refresh executive/data while session running
  if (state.metrics.elapsed % 5 === 0) {
    refreshDashboards();
  }
});

/* ---------------------------
   Report + Store actions
---------------------------- */
function buildJuryFromMetrics(m) {
  // Convert metrics -> score and decision (deterministic, explainable)
  const wpm = m.wpm ?? 0;
  const clarity = m.clarity ?? 0;
  const energy = m.energy ?? 0;
  const audienceScore = m.audience ?? 0;
  const fillers = m.fillers ?? 0;

  const wpmScore = clamp(100 - Math.abs(wpm - 140) * 1.7, 0, 100);
  const fillPenalty = clamp(fillers * 1.1, 0, 35);

  let total = (
    wpmScore * 0.20 +
    clarity * 0.35 +
    energy * 0.20 +
    audienceScore * 0.25
  ) - fillPenalty;

  // apply pressure + sense penalty
  total -= (state.pressure * 0.08);
  total -= (state.audienceSense * 0.05);

  total = clamp(Math.round(total), 0, 100);

  const level = total >= 85 ? "Elite" : total >= 70 ? "Pro" : total >= 55 ? "Rising" : "Starter";
  const decision = total >= 85 ? "قبول فوري + جاهز للعرض الرسمي"
    : total >= 70 ? "ممتاز — يحتاج صقل بسيط"
    : total >= 55 ? "جيد — يحتاج تدريب مركز"
    : "غير مجتاز — يحتاج إعادة بناء الأداء";

  return { total, level, decision, wpm, clarity, energy, audienceScore, fillers };
}

function refreshMiniReport() {
  const sessions = store.getSessions();
  ui.rCount.textContent = `${sessions.length}`;

  const last = sessions[0];
  if (!last) {
    ui.rScore.textContent = "—";
    ui.rDecision.textContent = "—";
    ui.rSummary.textContent = "لا توجد جلسات محفوظة";
    return;
  }

  ui.rScore.textContent = `${last.score}/100`;
  ui.rDecision.textContent = last.decision;
  ui.rSummary.textContent = last.summary;
}

ui.saveNow?.addEventListener("click", () => {
  const jury = buildJuryFromMetrics(state.metrics);
  const payload = {
    at: new Date().toISOString(),
    scenario: state.scenario,
    env: state.env,
    metrics: state.metrics,
    jury,
  };
  const saved = store.addSession({
    at: payload.at,
    scenario: payload.scenario,
    env: payload.env,
    score: jury.total,
    decision: jury.decision,
    summary: report.makeSummary(payload),
    payload
  });

  setStatus(`تم حفظ الجلسة ✅ (${saved.score}/100)`, "on");
  refreshDashboards();
  refreshMiniReport();
});

ui.exportHTML?.addEventListener("click", () => {
  const sessions = store.getSessions();
  const html = report.exportHTML(sessions, { title: "SpeakXR X-Stage PRO Report" });
  report.download("SpeakXR_Report.html", html);
  setStatus("تم تصدير تقرير HTML", "on");
});

ui.exportJSON?.addEventListener("click", () => {
  const sessions = store.getSessions();
  const json = report.exportJSON(sessions);
  report.download("SpeakXR_Sessions.json", json, "application/json");
  setStatus("تم تصدير JSON", "on");
});

ui.wipe?.addEventListener("click", () => {
  if (!confirm("متأكد؟ سيتم حذف كل الجلسات من هذا الجهاز.")) return;
  store.clear();
  setStatus("تم مسح البيانات", "warn");
  refreshDashboards();
  refreshMiniReport();
  renderDataTable();
});

function refreshDashboards() {
  const sessions = store.getSessions();
  const count = sessions.length;
  const best = sessions.reduce((a,s)=>Math.max(a, s.score||0), 0);
  const last = sessions[0];

  // demo KPI
  ui.kpiSessions.textContent = `${count}`;
  ui.kpiBest.textContent = count ? `${best}` : "—";
  ui.kpiReady.textContent = best >= 70 ? "Ready" : "Training";

  // executive
  ui.exSessions.textContent = `${count}`;
  ui.exBest.textContent = count ? `${best}` : "—";
  ui.exLast.textContent = last ? `${last.scenario} • ${last.env}` : "—";
  ui.exReady.textContent = best >= 85 ? "Elite" : best >= 70 ? "Pro" : "Rising";

  // executive text (auto)
  ui.execText.textContent = report.makeExecutiveSummary(sessions);

  // mini report
  refreshMiniReport();

  // data table
  renderDataTable();
}

/* ---------------------------
   Jury view logic (textarea board)
---------------------------- */
function computeManualJury() {
  const base = buildJuryFromMetrics(state.metrics);
  // add small "manual notes weight" based on note lengths (pure UX)
  const n1 = (ui.jConfidence.value || "").trim().length;
  const n2 = (ui.jVoice.value || "").trim().length;
  const n3 = (ui.jAudience.value || "").trim().length;
  const n4 = (ui.jBuild.value || "").trim().length;

  const noteBoost = clamp(Math.round((n1+n2+n3+n4)/220*6), 0, 6);
  const total = clamp(base.total + noteBoost, 0, 100);

  const level = total >= 85 ? "Elite" : total >= 70 ? "Pro" : total >= 55 ? "Rising" : "Starter";
  const decision = total >= 85 ? "قبول فوري + جاهز للعرض الرسمي"
    : total >= 70 ? "ممتاز — يحتاج صقل بسيط"
    : total >= 55 ? "جيد — يحتاج تدريب مركز"
    : "غير مجتاز — يحتاج إعادة بناء الأداء";

  return { ...base, total, level, decision, noteBoost };
}

ui.calcJury?.addEventListener("click", () => {
  const j = computeManualJury();
  ui.finalScore.textContent = `${j.total}`;
  ui.finalBar.style.width = `${j.total}%`;
  ui.finalDecision.textContent = `${j.decision} (${j.level})`;
  setStatus("تم حساب التحكيم", "on");
});

ui.juryExport?.addEventListener("click", () => {
  const j = computeManualJury();
  const html = report.exportJuryHTML(j, state);
  report.download("SpeakXR_Jury.html", html);
  setStatus("تم تصدير تقرير التحكيم", "on");
});

/* ---------------------------
   Data table
---------------------------- */
function renderDataTable() {
  if (!ui.sessionsTbl) return;
  const tbody = ui.sessionsTbl.querySelector("tbody");
  if (!tbody) return;

  const sessions = store.getSessions();
  tbody.innerHTML = "";

  sessions.slice(0, 30).forEach(s => {
    const tr = document.createElement("tr");
    const t = new Date(s.at);
    tr.innerHTML = `
      <td>${t.toLocaleString("ar-SA")}</td>
      <td>${s.scenario}</td>
      <td>${s.env}</td>
      <td><b>${s.score}</b></td>
      <td>${s.decision}</td>
    `;
    tbody.appendChild(tr);
  });
}

ui.refreshData?.addEventListener("click", () => {
  renderDataTable();
  setStatus("تم تحديث البيانات", "on");
});

/* ---------------------------
   Executive export
---------------------------- */
ui.exportExecutive?.addEventListener("click", () => {
  const sessions = store.getSessions();
  const html = report.exportExecutiveHTML(sessions);
  report.download("SpeakXR_Executive.html", html);
  setStatus("تم تصدير الملخص التنفيذي", "on");
});

/* ---------------------------
   Command Palette (⌘K)
---------------------------- */
createCommands({
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

/* ---------------------------
   Init
---------------------------- */
function boot() {
  // defaults
  ui.pressure && (ui.pressure.value = String(state.pressure));
  ui.audienceSense && (ui.audienceSense.value = String(state.audienceSense));
  ui.autoTele && (ui.autoTele.checked = state.autoTele);

  stage.setHUD(true);
  audience.setEnabled(true);
  stage.setMirror(false);

  // Tele defaults
  tele.setText(ui.teleText?.value || "");
  tele.setSpeed(+ui.teleSpeed?.value || 64);
  tele.setSize(+ui.teleSize?.value || 22);

  refreshDashboards();
  refreshMiniReport();
  setRoute("demo");
  setStatus("جاهز — اختر تبويب وابدأ", "on");

  // resize on show
  window.addEventListener("resize", () => {
    stage.resize();
    audience.resize();
    drawTimeline();
  });

  // smooth: focus stage after tab "stage"
  ui.goStageBtn?.addEventListener("click", async () => {
    await sleep(80);
    stage.resize();
    audience.resize();
  });
}
boot();
