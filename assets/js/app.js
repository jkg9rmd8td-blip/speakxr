/* SpeakXR X-Stage — UI Activator (Tabs + Transitions + Buttons) */

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.round(rnd(a, b));

  // ---------- Elements ----------
  const navPills = $$(".navPill");
  const panels = $$(".panel"); // each has data-panel
  const btnExec = $("#btnExec");
  const btnXR = $("#btnXR");
  const btnQuickDemo = $("#btnQuickDemo");

  const btnEnterStage = $("#btnEnterStage");
  const btnDownloadReport = $("#btnDownloadReport");

  const btnCamera = $("#btnCamera");
  const btnStartSim = $("#btnStartSim");

  const btnRecord = $("#btnRecord");
  const btnSnap = $("#btnSnap");
  const btnResetStage = $("#btnResetStage");

  const btnSimStress = $("#btnSimStress");
  const btnGenerate = $("#btnGenerate");

  const btnTextReport = $("#btnTextReport");
  const btnSaveSession = $("#btnSaveSession");

  const btnGoStage = $("#btnGoStage");
  const btnGoScenarios = $("#btnGoScenarios");
  const btnGoJury = $("#btnGoJury");

  // Segments
  const modeSegBtns = $$(".segBtn[data-mode]");
  const trainSegBtns = $$(".segBtn[data-train]");
  const envSegBtns = $$(".segBtn[data-env]");
  const coachSegBtns = $$(".segBtn[data-coach]");

  // Scenario cards
  const scenarioCards = $$(".scenarioCard[data-pick]");
  const scenarioBtns = $$(".scenarioBtn");

  // HUD + Metrics
  const hudMode = $("#hudMode");
  const hudEnv = $("#hudEnv");
  const hudCoach = $("#hudCoach");

  const mWpm = $("#mWpm"), bWpm = $("#bWpm");
  const mConf = $("#mConf"), bConf = $("#bConf");
  const mEng = $("#mEng"), bEng = $("#bEng");
  const mFill = $("#mFill"), bFill = $("#bFill");

  const audEmoji = $("#audEmoji");
  const audText = $("#audText");

  // Analysis UI
  const aWpm = $("#aWpm");
  const aConf = $("#aConf");
  const aFill = $("#aFill");
  const analysisSummary = $("#analysisSummary");

  // Jury UI
  const scoreEl = $("#score");
  const scoreBar = $("#scoreBar");
  const decisionEl = $("#decision");
  const lvlEl = $("#lvl");

  // Toast
  const toast = $("#toast");
  const toastTitle = $("#toastTitle");
  const toastList = $("#toastList");
  const btnToastOk = $("#btnToastOk");

  // Settings sliders
  const audSens = $("#audSens");
  const stress = $("#stress");

  // Canvas
  const timelineCanvas = $("#timeline");
  const tctx = timelineCanvas?.getContext("2d");

  // Camera
  const cam = $("#cam");

  // Hero stats
  const statSessions = $("#statSessions");
  const statBest = $("#statBest");
  const statLevel = $("#statLevel");
  const sSessions = $("#sSessions");

  // ---------- State ----------
  const STORAGE_KEY = "speakxr_xstage_sessions_v1";

  const state = {
    tab: "stage",
    mode: "xr",
    train: "official",
    env: "conference",
    coachStyle: "enc",

    cameraOn: false,
    stream: null,

    simOn: false,
    stressOn: false,

    recording: false,
    recStart: 0,
    recTimer: null,

    tickTimer: null,

    // metrics
    wpm: 0,
    conf: 0,
    eng: 0,
    fill: 0,
    mood: 0,

    timeline: { conf: [], eng: [], wpm: [], max: 80 },

    sessions: [],
  };

  // ---------- Toast ----------
  function toastShow(title, items) {
    if (!toast) return;
    toastTitle.textContent = title;
    toastList.innerHTML = "";
    items.forEach(x => {
      const li = document.createElement("li");
      li.textContent = x;
      toastList.appendChild(li);
    });
    toast.classList.remove("hidden");
  }
  function toastHide() {
    toast?.classList.add("hidden");
  }
  btnToastOk?.addEventListener("click", toastHide);

  // ---------- Tabs / Navigation ----------
  function setTab(tab) {
    state.tab = tab;

    // nav highlight
    navPills.forEach(p => p.classList.toggle("on", p.dataset.tab === tab));

    // show/hide panels
    panels.forEach(p => {
      p.style.display = (p.dataset.panel === tab) ? "" : "none";
    });

    // smooth top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  navPills.forEach(p => {
    p.addEventListener("click", () => setTab(p.dataset.tab));
  });

  // Jump helpers
  function jumpTo(tab) {
    setTab(tab);
    // nicer scroll to panel
    const el = $(`.panel[data-panel="${tab}"]`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  // Buttons that jump
  btnEnterStage?.addEventListener("click", () => jumpTo("stage"));
  btnGoStage?.addEventListener("click", () => jumpTo("stage"));
  btnGoScenarios?.addEventListener("click", () => jumpTo("scenarios"));
  btnGoJury?.addEventListener("click", () => jumpTo("jury"));

  // If any element has data-jump="tab"
  $$("[data-jump]").forEach(b => {
    b.addEventListener("click", () => jumpTo(b.dataset.jump));
  });

  // ---------- Segmented Buttons ----------
  function setSegOn(btns, key, val) {
    btns.forEach(b => b.classList.toggle("on", b.dataset[key] === val));
  }

  function setMode(mode) {
    state.mode = mode;
    hudMode.textContent = mode.toUpperCase();
    setSegOn(modeSegBtns, "mode", mode);

    // little UX: change coach message
    if (mode === "ar") setCoach("AR mode: خلي عينك على الـ HUD فوق الواقع 👀");
    if (mode === "vr") setCoach("VR mode: تخيل المسرح حولك… وخلّ الصوت يقود.");
    if (mode === "xr") setCoach("XR mode: المسرح + التحليل + الجمهور… جاهزين.");
  }

  function setTrain(train) {
    state.train = train;
    setSegOn(trainSegBtns, "train", train);

    const msg =
      train === "official" ? "تدريب رسمي: ابدأ بجملة قوية + رقم + قرار." :
      train === "media" ? "تدريب إعلامي: جمل قصيرة + نبرة ثابتة + بدون حشو." :
      "تدريب مقابلة: جواب مختصر + مثال + رجوع للرسالة.";
    setCoach(msg);
  }

  function setEnv(env) {
    state.env = env;
    setSegOn(envSegBtns, "env", env);

    const map = {
      conference: "مؤتمر",
      studio: "استوديو",
      interviewRoom: "مقابلة",
      classroom: "تدريب",
      podcast: "بودكاست",
      field: "ميداني"
    };
    hudEnv.textContent = map[env] || env;

    const hint = {
      conference: "قاعة مؤتمر: ركّز على القرار النهائي في 10 ثواني.",
      studio: "استوديو: ثبات النبرة أهم من الحماس الزائد.",
      interviewRoom: "مقابلة: لا تلتف… جواب ثم مثال.",
      classroom: "تدريب: قسّم الفكرة 1-2-3.",
      podcast: "بودكاست: خلك قصصي… وهدئ السرعة.",
      field: "ميداني: صوت أعلى + ترتيب معلومات."
    }[env] || "ثبت رسالتك… وخلك واضح.";
    setCoach(hint);
  }

  function setCoachStyle(style) {
    state.coachStyle = style;
    setSegOn(coachSegBtns, "coach", style);
    setCoach(style === "dir" ? "المدرب مباشر… لا يتحمّل اللف والدوران 😅" : "المدرب مشجّع… بس بيحاسبك بالأرقام.");
  }

  modeSegBtns.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  trainSegBtns.forEach(b => b.addEventListener("click", () => setTrain(b.dataset.train)));
  envSegBtns.forEach(b => b.addEventListener("click", () => setEnv(b.dataset.env)));
  coachSegBtns.forEach(b => b.addEventListener("click", () => setCoachStyle(b.dataset.coach)));

  // ---------- Scenario cards ----------
  scenarioCards.forEach(card => {
    card.addEventListener("click", () => {
      const env = card.dataset.pick;
      if (env) {
        setEnv(env);
        toastShow("تم اختيار السيناريو ✅", [
          `تم ضبط البيئة: ${env}`,
          "تم نقلك للمسرح… اضغط Demo أو شغّل الكاميرا.",
        ]);
        jumpTo("stage");
      }
    });
  });

  // Buttons inside cards (AR Preview)
  scenarioBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = e.target.closest(".scenarioCard");
      const env = card?.dataset.pick;
      if (env) {
        setEnv(env);
        toastShow("AR Preview", [
          "هذا Preview (تغيير البيئة + HUD).",
          "للـ WebXR الحقيقي لازم جهاز/متصفح داعم.",
        ]);
        jumpTo("stage");
      }
    });
  });

  // ---------- Coach ----------
  function setCoach(text) {
    if (!hudCoach) return;
    hudCoach.textContent = text;
  }

  // ---------- Executive mode ----------
  btnExec?.addEventListener("click", () => {
    document.body.classList.toggle("exec");
    toastShow("Executive Mode", [
      "تم تفعيل وضع العرض للجنة.",
      "واجهة أثقل + HUD أوضح + إحساس رسمي."
    ]);
  });

  // ---------- WebXR help ----------
  btnXR?.addEventListener("click", () => {
    toastShow("WebXR (AR/VR)", [
      "للـ AR/VR الحقيقي تحتاج WebXR (غالبًا Chrome Android أو Meta Quest).",
      "على iPhone دعم WebXR محدود.",
      "المنصة تشتغل XR عبر الكاميرا + HUD بكل الأحوال."
    ]);
  });

  // ---------- Demo / Simulation ----------
  function resetMetrics() {
    state.wpm = 0; state.conf = 0; state.eng = 0; state.fill = 0; state.mood = 0;
    state.timeline.conf = [];
    state.timeline.eng = [];
    state.timeline.wpm = [];
    renderMetrics();
    drawTimeline(true);
    analysisSummary.textContent = "شغّل Demo أو المحاكاة… ثم اضغط “تحكيم فوري”.";
  }

  function moodUpdate() {
    // مزاج الجمهور يعتمد على الثقة/الطاقة والحشو + حساسية/ضغط
    const sens = (+audSens?.value || 55) / 100;
    const st = (+stress?.value || 35) / 100;

    const conf = state.conf / 100;
    const eng = state.eng / 100;
    const fill = state.fill / 100;

    let mood = (conf * 55 + eng * 45) - (fill * 65);
    mood -= sens * 14;
    mood -= st * 10;
    mood -= state.stressOn ? 10 : 0;

    state.mood = clamp(state.mood * 0.75 + mood * 0.25, -100, 100);

    if (state.mood > 22) return { e: "👏", t: "تصفيق… كمل!", v: state.mood };
    if (state.mood > 5) return { e: "🙂", t: "الجمهور متابع", v: state.mood };
    if (state.mood > -10) return { e: "😐", t: "فيه تشتت بسيط… رتّب الفكرة", v: state.mood };
    if (state.mood > -28) return { e: "😕", t: "ملل… اختصر واذكر مثال", v: state.mood };
    return { e: "😬", t: "ضغط عالي… ثبّت نبرة وقلّل الحشو", v: state.mood };
  }

  function tickSim() {
    // baseline حسب البيئة
    const baseWpm = state.env === "studio" ? 150 : state.env === "podcast" ? 125 : 140;
    const baseConf = state.train === "official" ? 74 : state.train === "media" ? 68 : 62;
    const baseEng = state.env === "field" ? 78 : 70;

    const st = (+stress?.value || 35) / 100;
    const hard = state.stressOn ? 1 : 0;

    state.wpm = clamp(Math.round(baseWpm + rnd(-18, 18) + hard * rnd(-10, 10)), 80, 190);
    state.conf = clamp(Math.round(baseConf + rnd(-12, 12) - st * 8 - hard * 6), 30, 95);
    state.eng = clamp(Math.round(baseEng + rnd(-14, 14) - st * 6 + (state.mode === "ar" ? 2 : 0)), 30, 95);
    state.fill = clamp(Math.round(22 + rnd(-10, 18) + st * 22 + hard * 8 - (state.conf - 60) * 0.25), 0, 90);

    state.timeline.wpm.push(state.wpm);
    state.timeline.conf.push(state.conf);
    state.timeline.eng.push(state.eng);
    if (state.timeline.wpm.length > state.timeline.max) {
      state.timeline.wpm.shift();
      state.timeline.conf.shift();
      state.timeline.eng.shift();
    }

    renderMetrics();
    drawTimeline(false);

    const mood = moodUpdate();
    audEmoji.textContent = mood.e;
    audText.textContent = mood.t;

    // coach hint بسيط
    if (Math.random() < 0.22) {
      const dir = state.coachStyle === "dir";
      if (state.fill > 45) setCoach(dir ? "الحشو مرتفع… وقف (يعني/أمم) الآن." : "خفف الحشو وبتشوف الدرجة ترتفع 👍");
      else if (state.wpm > 170) setCoach(dir ? "سرعة عالية… بطّئ." : "سرعتك ممتازة بس بطّئ شوي.");
      else if (state.conf < 55) setCoach(dir ? "ثبات أقل… نفس عميق وخلك مباشر." : "خذ نفس… وجملة واضحة.");
      else setCoach(dir ? "قدّم رقم/دليل الآن." : "أضف مثال صغير يقوّي فكرتك.");
    }
  }

  function startSim() {
    if (state.simOn) return;
    state.simOn = true;
    btnStartSim.textContent = "🧪 إيقاف محاكاة";
    toastShow("Simulation ON", [
      "المحاكاة شغالة… المؤشرات تتحرك.",
      "تقدر الآن تضغط (تحكيم فوري)."
    ]);
    state.tickTimer = setInterval(tickSim, 900);
  }

  function stopSim() {
    state.simOn = false;
    btnStartSim.textContent = "🧪 تشغيل محاكاة";
    if (state.tickTimer) clearInterval(state.tickTimer);
    state.tickTimer = null;
    toastShow("Simulation OFF", ["تم إيقاف المحاكاة."]);
  }

  btnStartSim?.addEventListener("click", () => {
    if (state.simOn) stopSim();
    else startSim();
  });

  // Quick Demo: يفعّل Stage + يشغل المحاكاة + ينقلك للمسرح
  btnQuickDemo?.addEventListener("click", () => {
    setMode("xr");
    setTrain("official");
    setEnv("conference");
    jumpTo("stage");
    resetMetrics();
    startSim();
    setCoach("Demo شغّال… خلّك ثابت وخاطب الجمهور كأنها لجنة تحكيم 👑");
  });

  // ---------- Camera (تشغيل/إيقاف) ----------
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      state.stream = stream;
      cam.srcObject = stream;
      cam.classList.add("on");
      state.cameraOn = true;
      btnCamera.textContent = "📷 إيقاف الكاميرا";
      toastShow("Camera ON", ["تم تشغيل الكاميرا.", "HUD فوق المسرح جاهز."]);
    } catch (e) {
      toastShow("صلاحيات الكاميرا", [
        "لازم تسمح بالكاميرا من المتصفح.",
        "iPhone: Settings > Safari > Camera > Allow",
      ]);
      console.error(e);
    }
  }

  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
    cam.srcObject = null;
    cam.classList.remove("on");
    state.cameraOn = false;
    btnCamera.textContent = "📷 تشغيل الكاميرا";
  }

  btnCamera?.addEventListener("click", () => {
    if (state.cameraOn) stopCamera();
    else startCamera();
  });

  // ---------- Render metrics ----------
  function renderMetrics() {
    const wpmScore = clamp(100 - Math.abs(state.wpm - 145) * 1.8, 0, 100);

    mWpm.textContent = state.wpm ? String(state.wpm) : "—";
    mConf.textContent = state.conf ? String(state.conf) : "—";
    mEng.textContent = state.eng ? String(state.eng) : "—";
    mFill.textContent = state.fill ? String(state.fill) : "—";

    bWpm.style.width = `${wpmScore}%`;
    bConf.style.width = `${clamp(state.conf, 0, 100)}%`;
    bEng.style.width = `${clamp(state.eng, 0, 100)}%`;
    bFill.style.width = `${clamp(state.fill, 0, 100)}%`;

    aWpm.textContent = state.wpm ? String(state.wpm) : "—";
    aConf.textContent = state.conf ? String(state.conf) : "—";
    aFill.textContent = state.fill ? String(state.fill) : "—";
  }

  function drawTimeline(clear) {
    if (!tctx) return;
    const W = timelineCanvas.width;
    const H = timelineCanvas.height;

    tctx.clearRect(0, 0, W, H);
    tctx.fillStyle = "rgba(0,0,0,0.15)";
    tctx.fillRect(0, 0, W, H);

    if (clear) return;

    // grid lines
    tctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let i = 1; i <= 4; i++) {
      const y = (H * i) / 5;
      tctx.beginPath();
      tctx.moveTo(0, y);
      tctx.lineTo(W, y);
      tctx.stroke();
    }

    const series = [
      { arr: state.timeline.conf, color: "rgba(34,211,238,0.95)" },
      { arr: state.timeline.eng, color: "rgba(59,130,246,0.95)" },
      { arr: state.timeline.wpm.map(v => clamp((v - 80) / 110 * 100, 0, 100)), color: "rgba(99,102,241,0.95)" }
    ];

    series.forEach(s => {
      if (!s.arr.length) return;
      tctx.strokeStyle = s.color;
      tctx.lineWidth = 2.5;
      tctx.beginPath();

      const n = s.arr.length;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1 || 1)) * (W - 20) + 10;
        const y = H - (s.arr[i] / 100) * (H - 20) - 10;
        if (i === 0) tctx.moveTo(x, y);
        else tctx.lineTo(x, y);
      }
      tctx.stroke();
    });
  }

  // ---------- Buttons: Record / Snap / Reset ----------
  btnRecord?.addEventListener("click", () => {
    toastShow("تسجيل", [
      "هذا Prototype: زر التسجيل يفعّل “حالة” فقط.",
      "تبغى تسجيل صوت فعلي؟ أضيفه لك (MediaRecorder)."
    ]);
  });

  btnSnap?.addEventListener("click", () => {
    toastShow("HUD Snapshot", [
      "لقطة HUD: حالياً توست (بدون مكتبة تصوير).",
      "إذا تبغى PNG فعلي للواجهة: نضيف html2canvas (اختياري)."
    ]);
  });

  btnResetStage?.addEventListener("click", () => {
    stopSim();
    stopCamera();
    resetMetrics();
    setMode("xr");
    setTrain("official");
    setEnv("conference");
    state.stressOn = false;
    setCoach("تم Reset ✅ — جاهز للجولة القادمة.");
    toastShow("Reset ✅", ["رجعنا كل شيء للوضع الافتراضي."]);
  });

  // ---------- Stress toggle ----------
  btnSimStress?.addEventListener("click", () => {
    state.stressOn = !state.stressOn;
    toastShow("Stress", [
      state.stressOn ? "تم تفعيل الضغط ✅ (اللجنة بتصير قاسية)" : "تم إلغاء الضغط ✅",
      "تقدر تغيّر مستوى الضغط من السلايدر."
    ]);
  });

  // ---------- Jury (تحكيم فوري) ----------
  function computeScore() {
    if (!state.wpm && !state.conf && !state.eng) return null;

    const sens = (+audSens?.value || 55) / 100;
    const st = (+stress?.value || 35) / 100;

    const wpmScore = clamp(100 - Math.abs(state.wpm - 145) * 1.6, 0, 100);
    const confScore = clamp(state.conf, 0, 100);
    const engScore = clamp(state.eng, 0, 100);
    const fillPenalty = clamp(state.fill * 0.55, 0, 45);

    let total = (wpmScore * 0.22) + (confScore * 0.36) + (engScore * 0.28) + ((100 - fillPenalty) * 0.14);
    total -= sens * 4;
    total -= st * 5;
    total -= state.stressOn ? 6 : 0;

    total = clamp(Math.round(total), 0, 100);

    const level = total >= 85 ? "Elite" : total >= 70 ? "Pro" : total >= 55 ? "Rising" : "Starter";
    const decision =
      total >= 85 ? "قبول فوري + جاهز للعرض الرسمي" :
      total >= 70 ? "ممتاز — يحتاج صقل بسيط" :
      total >= 55 ? "جيد — يحتاج تدريب مركز" :
      "غير مجتاز — نحتاج إعادة بناء الأداء";

    return { total, level, decision };
  }

  function applyJury(j) {
    scoreEl.textContent = String(j.total);
    scoreBar.style.width = `${j.total}%`;
    lvlEl.textContent = j.level;
    decisionEl.textContent = `القرار: ${j.decision}`;

    analysisSummary.textContent =
      `ملخص تحكيم:\n- الدرجة: ${j.total}/100 (${j.level})\n- القرار: ${j.decision}\n\nنصيحة سريعة:\nقلل الحشو + ثبت السرعة + أضف مثال واحد قوي.`;
  }

  btnGenerate?.addEventListener("click", () => {
    const j = computeScore();
    if (!j) {
      toastShow("تحكيم فوري", ["شغّل Demo أو المحاكاة أولاً عشان تكون فيه بيانات."]);
      return;
    }
    applyJury(j);
    jumpTo("jury");
    toastShow("تم التحكيم ✅", [`الدرجة: ${j.total}/100`, `المستوى: ${j.level}`]);
  });

  btnTextReport?.addEventListener("click", () => {
    toastShow("تقرير نصي", [
      "تقرير نصي كامل يتولد لما نضيف جزء التقرير.",
      "تبغاه PDF/HTML؟ أعطيك زر Export جاهز."
    ]);
  });

  // ---------- Sessions (localStorage minimal) ----------
  function loadSessions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      state.sessions = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.sessions)) state.sessions = [];
    } catch {
      state.sessions = [];
    }
    refreshStats();
  }

  function saveSessions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions));
    refreshStats();
  }

  function refreshStats() {
    const count = state.sessions.length;
    statSessions.textContent = String(count);
    sSessions.textContent = String(count);

    let best = null;
    for (const s of state.sessions) best = best === null ? s : Math.max(best, s);
    statBest.textContent = best === null ? "—" : String(best);
    statLevel.textContent = best === null ? "—" : best >= 85 ? "Elite" : best >= 70 ? "Pro" : best >= 55 ? "Rising" : "Starter";
  }

  btnSaveSession?.addEventListener("click", () => {
    const j = computeScore();
    if (!j) {
      toastShow("حفظ الجلسة", ["سو تحكيم أولاً (زر: تحكيم فوري)."]);
      return;
    }
    state.sessions.unshift(j.total);
    if (state.sessions.length > 60) state.sessions.length = 60;
    saveSessions();
    toastShow("تم الحفظ ✅", [`الدرجة: ${j.total}/100`, "محفوظة داخل المتصفح."]);
  });

  btnDownloadReport?.addEventListener("click", () => {
    toastShow("تحميل تقرير", [
      "زر التحميل جاهز…",
      "إذا تبغى تنزيل TXT/HTML فعلي: أعطيك Export كامل بسطرين."
    ]);
  });

  // ---------- Init ----------
  function init() {
    // default: show stage only
    panels.forEach(p => p.style.display = (p.dataset.panel === "stage") ? "" : "none");
    setMode("xr");
    setTrain("official");
    setEnv("conference");
    resetMetrics();
    loadSessions();
    toastHide();
  }

  init();

})();
