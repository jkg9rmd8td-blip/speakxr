// assets/js/app.js  (ESM)
// SpeakXR X-Stage PRO — Router + Wiring + Safe Imports
// أهم شيء: لأن هذا الملف داخل /assets/js/
// أي import من /src لازم يكون ../../src/...

const $  = (q, r=document) => r.querySelector(q);
const $$ = (q, r=document) => Array.from(r.querySelectorAll(q));

function setStatus(text, mode="ok"){
  const status = $("#status");
  const dot = $("#dot");
  if (status) status.textContent = text;

  if (dot){
    const map = {
      ok:   ["rgba(34,197,94,.95)",  "0 0 12px rgba(34,197,94,.65)"],
      warn: ["rgba(245,158,11,.95)", "0 0 12px rgba(245,158,11,.65)"],
      bad:  ["rgba(239,68,68,.95)",  "0 0 12px rgba(239,68,68,.65)"],
    };
    const [bg, sh] = map[mode] || map.ok;
    dot.style.background = bg;
    dot.style.boxShadow = sh;
  }
}

function showView(route){
  // route must match data-view values
  const views = $$(".view");
  const tabs  = $$("#tabs .tab");

  views.forEach(v => v.classList.toggle("on", v.dataset.view === route));
  tabs.forEach(t => t.classList.toggle("on", t.dataset.route === route));

  // تحديث URL بدون إعادة تحميل (حلوة للـ GitHub Pages)
  try {
    const u = new URL(window.location.href);
    u.hash = route ? `#${route}` : "";
    history.replaceState({}, "", u);
  } catch {}

  setStatus(`تم فتح: ${route}`, "ok");
}

function bootRouter(){
  const tabs = $("#tabs");
  if (!tabs) {
    console.warn("tabs nav not found");
    return;
  }

  // Tab Click
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    const route = btn.dataset.route;
    if (!route) return;
    showView(route);
  });

  // Hash route on load
  const hash = (location.hash || "").replace("#", "").trim();
  const initial = hash || "demo";
  showView(initial);

  // Buttons that should navigate
  const go = (id, route) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("click", () => showView(route));
  };

  go("#goStageBtn", "stage");
  go("#goStage2", "stage");
  go("#goStage3", "stage");

  const pickScenarioBtn = $("#pickScenarioBtn");
  if (pickScenarioBtn){
    pickScenarioBtn.addEventListener("click", () => {
      showView("demo");
      $("#scenarioPanel")?.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  }

  // Scenario cards
  $$(".scPro").forEach(btn => {
    btn.addEventListener("click", () => {
      // هنا فقط تنقل للمسرح — تقدر تربط env/scenario لاحقًا
      showView("stage");
      setStatus(`سيناريو: ${btn.dataset.sc || "—"} • بيئة: ${btn.dataset.env || "—"}`, "ok");
    });
  });

  // Presenter mode
  const presentBtn = $("#presentBtn");
  if (presentBtn){
    presentBtn.addEventListener("click", () => {
      document.body.classList.toggle("presenter");
      setStatus(document.body.classList.contains("presenter") ? "Presenter: ON" : "Presenter: OFF", "ok");
    });
  }
}

async function safeImportModules(){
  // نحاول استيراد الموديولات من /src بالمسار الصحيح
  // لو فشل، ما يوقف الموقع: التنقل يظل شغال
  const result = { ok:false };

  try {
    const core = await import("../../src/core.js");
    // إذا تحب تستخدمه هنا لاحقًا
    result.core = core;

    // باقي الموديولات (اختياري)
    const [
      xrStage,
      teleprompter,
      audience,
      coach,
      report,
      store,
      commands
    ] = await Promise.all([
      import("../../src/xrStage.js"),
      import("../../src/teleprompter.js"),
      import("../../src/audience.js"),
      import("../../src/coach.js"),
      import("../../src/report.js"),
      import("../../src/store.js"),
      import("../../src/commands.js"),
    ]);

    result.xrStage = xrStage;
    result.teleprompter = teleprompter;
    result.audience = audience;
    result.coach = coach;
    result.report = report;
    result.store = store;
    result.commands = commands;

    result.ok = true;
    setStatus("Modules: OK ✅", "ok");
  } catch (err) {
    console.error("Module import failed:", err);
    setStatus("Modules: Failed (check /src paths)", "warn");

    // تشخيص سريع واضح للمستخدم
    const msg =
      "فشل تحميل ملفات /src.\n\n" +
      "تأكد أن الهيكلة:\n" +
      "  /src/core.js\n" +
      "  /src/xrStage.js\n" +
      "  ...\n\n" +
      "وأنها مرفوعة بنفس أسماء الملفات تمامًا.\n\n" +
      "سبب شائع: اختلاف حرف كبير/صغير (case) على GitHub Pages.";
    console.warn(msg);
  }

  return result;
}

function wireStageBasics(mods){
  // لو الموديولات جاهزة: نفعل أزرار المسرح الأساسية (كاميرا/جلسة…)
  if (!mods.ok) return;

  // توقع أسماء exports حسب اللي بنيناه سابقًا:
  // createXRStage, createTeleprompter, createAudience, createCoach, createStore, createReport, createCommands
  const video = $("#cam");
  const hud = $("#hud");
  const audCanvas = $("#audience");

  const teleOverlay = $("#teleOverlay");
  const teleOverlayText = $("#teleOverlayText");
  const teleText = $("#teleText");
  const teleSpeed = $("#teleSpeed");
  const teleSize = $("#teleSize");

  const startSession = $("#startSession");
  const stopSession = $("#stopSession");
  const startAll = $("#startAll");
  const stopAll = $("#stopAll");

  const toggleMirror = $("#toggleMirror");
  const toggleAudience = $("#toggleAudience");
  const toggleTele = $("#toggleTele");
  const toggleHUD = $("#toggleHUD");

  // Defensive checks
  if (!video || !hud) return;

  const stage = mods.xrStage.createXRStage({ video, hud });
  const audience = mods.audience.createAudience({ canvas: audCanvas });
  const tele = mods.teleprompter.createTeleprompter({ overlay: teleOverlay, overlayText: teleOverlayText });
  const coach = mods.coach.createCoach();
  const store = mods.store.createStore();
  const report = mods.report.createReport(store);

  // defaults
  stage.setHUD(true);
  stage.setMirror(false);
  audience.setEnabled(true);

  tele.setText(teleText?.value || "");
  tele.setSpeed(Number(teleSpeed?.value || 64));
  tele.setSize(Number(teleSize?.value || 22));

  // tele input bindings
  teleText?.addEventListener("input", () => tele.setText(teleText.value));
  teleSpeed?.addEventListener("input", () => tele.setSpeed(Number(teleSpeed.value)));
  teleSize?.addEventListener("input", () => tele.setSize(Number(teleSize.value)));

  // toggles
  toggleMirror?.addEventListener("click", () => {
    stage.setMirror(!stage.getMirror?.() ? true : !stage.getMirror());
    setStatus("تم تبديل المرآة", "ok");
  });

  toggleHUD?.addEventListener("click", () => {
    stage.setHUD(!stage.getHUD?.() ? true : !stage.getHUD());
    setStatus("تم تبديل HUD", "ok");
  });

  toggleAudience?.addEventListener("click", () => {
    audience.setEnabled(!audience.isEnabled?.() ? true : !audience.isEnabled());
    setStatus("تم تبديل الجمهور", "ok");
  });

  toggleTele?.addEventListener("click", () => {
    tele.toggle();
    setStatus(tele.isOn() ? "Tele: ON" : "Tele: OFF", "ok");
  });

  let sessionOn = false;

  async function start(){
    if (sessionOn) return;
    try{
      setStatus("طلب صلاحيات الكاميرا/المايك…", "warn");
      await stage.ensureStarted();      // camera+mic permissions
      stage.resize();
      audience.resize();

      stage.startSession();
      coach.reset?.();
      sessionOn = true;

      startSession && (startSession.disabled = true);
      stopSession && (stopSession.disabled = false);
      startAll && (startAll.disabled = true);
      stopAll && (stopAll.disabled = false);

      setStatus("جلسة شغالة ✅", "ok");
    }catch(e){
      console.error(e);
      setStatus("فشل تشغيل الكاميرا/المايك", "bad");
      alert("لازم تسمح للكاميرا والمايك من المتصفح.");
    }
  }

  function stop(){
    if (!sessionOn) return;
    sessionOn = false;

    stage.stopSession();
    stage.stopAll?.();

    startSession && (startSession.disabled = false);
    stopSession && (stopSession.disabled = true);
    startAll && (startAll.disabled = false);
    stopAll && (stopAll.disabled = true);

    setStatus("تم إيقاف الجلسة ■", "warn");
  }

  startSession?.addEventListener("click", start);
  stopSession?.addEventListener("click", stop);
  startAll?.addEventListener("click", start);
  stopAll?.addEventListener("click", stop);

  // live metrics → update mini HUD + coach box (لو موجود)
  const wpmV = $("#wpmV"), enV = $("#enV"), clV = $("#clV"), auV = $("#auV");
  const wpmBar = $("#wpmBar"), enBar = $("#enBar"), clBar = $("#clBar"), auBar = $("#auBar");
  const coachBox = $("#coachBox");

  stage.onMetrics((m) => {
    // audience tick (لو عندك نظامه داخل المودول)
    const audScore = audience.tick?.({ clarity:m.clarity, energy:m.energy }) ?? 0;

    wpmV && (wpmV.textContent = m.wpm ?? "—");
    enV  && (enV.textContent  = m.energy ?? "—");
    clV  && (clV.textContent  = m.clarity ?? "—");
    auV  && (auV.textContent  = audScore ? String(audScore) : "—");

    const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
    const wpmScore = clamp(100 - Math.abs((m.wpm ?? 140) - 140)*1.8, 0, 100);

    wpmBar && (wpmBar.style.width = `${wpmScore}%`);
    enBar  && (enBar.style.width  = `${clamp(m.energy,0,100)}%`);
    clBar  && (clBar.style.width  = `${clamp(m.clarity,0,100)}%`);
    auBar  && (auBar.style.width  = `${clamp(audScore,0,100)}%`);

    if (coachBox){
      coachBox.textContent = coach.liveLine?.({ metrics:{...m, audience:audScore} }) || "جلسة شغالة…";
    }
  });

  // command palette (اختياري)
  try{
    mods.commands.createCommands?.({
      stage, tele, store, report,
      setRoute: (r)=>showView(r),
      startSession: start,
      stopSession: stop,
      setStatus,
      state: {}
    });
  }catch(e){
    // ignore if commands module differs
  }

  setStatus("Stage Wired ✅", "ok");
}

(async function boot(){
  // 1) Router always works
  bootRouter();

  // 2) Imports (optional). If it fails: site still navigates.
  const mods = await safeImportModules();

  // 3) If modules ok: wire stage + metrics
  wireStageBasics(mods);

  // 4) Final status
  setStatus(mods.ok ? "جاهز — كل شيء مفعل ✅" : "جاهز — التنقل مفعل (modules تحتاج ضبط)", mods.ok ? "ok":"warn");
})();
