/* SpeakXR X-Stage — app.js (REAL Recording + REAL Audio Analysis + UI Wiring) */
(() => {
  "use strict";

  // =========================
  // Utils
  // =========================
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad2 = (n) => String(n).padStart(2, "0");
  const mmss = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(Math.floor(sec % 60))}`;
  const nowISO = () => new Date().toISOString();

  const downloadBlob = (filename, blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadText = (filename, text) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    downloadBlob(filename, blob);
  };

  const safeJSON = (v, fallback) => {
    try { return JSON.parse(v); } catch { return fallback; }
  };

  // =========================
  // Elements (from your HTML)
  // =========================
  const navPills = $$(".navPill");
  const panels = $$(".panel");

  const btnExec = $("#btnExec");
  const btnXR = $("#btnXR");
  const btnQuickDemo = $("#btnQuickDemo");
  const btnEnterStage = $("#btnEnterStage");
  const btnDownloadReport = $("#btnDownloadReport");

  const btnCamera = $("#btnCamera");
  const btnStartSim = $("#btnStartSim");

  const cam = $("#cam");

  const toast = $("#toast");
  const toastTitle = $("#toastTitle");
  const toastList = $("#toastList");
  const btnToastOk = $("#btnToastOk");

  const hudMode = $("#hudMode");
  const hudEnv = $("#hudEnv");
  const hudCoach = $("#hudCoach");

  const mWpm = $("#mWpm"), bWpm = $("#bWpm");
  const mConf = $("#mConf"), bConf = $("#bConf");
  const mEng = $("#mEng"), bEng = $("#bEng");
  const mFill = $("#mFill"), bFill = $("#bFill");

  const audEmoji = $("#audEmoji");
  const audText = $("#audText");

  const btnRecord = $("#btnRecord");
  const recLbl = $("#recLbl");
  const recTime = $("#recTime");
  const btnSnap = $("#btnSnap");
  const btnResetStage = $("#btnResetStage");

  // analysis
  const btnSimStress = $("#btnSimStress");
  const btnGenerate = $("#btnGenerate");
  const aWpm = $("#aWpm");
  const aConf = $("#aConf");
  const aFill = $("#aFill");
  const analysisSummary = $("#analysisSummary");
  const timelineCanvas = $("#timeline");
  const tctx = timelineCanvas.getContext("2d");

  // jury
  const btnTextReport = $("#btnTextReport");
  const btnSaveSession = $("#btnSaveSession");
  const scoreEl = $("#score");
  const scoreBar = $("#scoreBar");
  const decisionEl = $("#decision");
  const lvlEl = $("#lvl");

  const jVoice1 = $("#jVoice1"), jVoice2 = $("#jVoice2"), jVoice3 = $("#jVoice3"), jVoiceNote = $("#jVoiceNote");
  const jPres1  = $("#jPres1"),  jPres2  = $("#jPres2"),  jPres3  = $("#jPres3"),  jPresNote  = $("#jPresNote");
  const jPers1  = $("#jPers1"),  jPers2  = $("#jPers2"),  jPers3  = $("#jPers3"),  jPersNote  = $("#jPersNote");
  const jAud1   = $("#jAud1"),   jAud2   = $("#jAud2"),   jAud3   = $("#jAud3"),   jAudNote   = $("#jAudNote");

  const textReport = $("#textReport");

  // settings
  const audSens = $("#audSens");
  const stress = $("#stress");
  const coachSegBtns = $$(".segBtn[data-coach]");
  const envSegBtns = $$(".segBtn[data-env]");
  const modeSegBtns = $$(".segBtn[data-mode]");
  const trainSegBtns = $$(".segBtn[data-train]");

  // sidebar
  const sideMode = $("#sideMode");
  const sWpm = $("#sWpm");
  const sFill = $("#sFill");
  const sEng = $("#sEng");
  const sConf = $("#sConf");
  const sMood = $("#sMood");
  const sSessions = $("#sSessions");

  const btnGoStage = $("#btnGoStage");
  const btnGoScenarios = $("#btnGoScenarios");
  const btnGoJury = $("#btnGoJury");

  // stats hero
  const statSessions = $("#statSessions");
  const statBest = $("#statBest");
  const statLevel = $("#statLevel");

  // =========================
  // State
  // =========================
  const STORAGE_KEY = "speakxr_xstage_sessions_v2";

  const state = {
    tab: "stage",
    mode: "xr",
    train: "official",
    env: "conference",
    coachStyle: "enc",

    // camera (video)
    cameraOn: false,
    camStream: null,

    // recording (audio)
    recording: false,
    recStartMs: 0,
    recTimer: null,
    audioStream: null,
    mediaRecorder: null,
    recChunks: [],

    // analysis (real)
    audioCtx: null,
    analyser: null,
    sourceNode: null,
    rafId: null,
    energyRms: 0,          // 0..1-ish
    energyScore: 0,        // 0..100
    stabilityScore: 0,     // 0..100
    silenceRatio: 0,       // 0..1
    lastEnergySamples: [], // for stability
    silenceFrames: 0,
    totalFrames: 0,

    // speech (optional)
    speechOn: false,
    recognition: null,
    transcript: "",
    finalTranscript: "",

    // metrics shown
    wpm: 0,
    conf: 0,
    eng: 0,
    fill: 0,
    mood: 0,

    // timeline
    timeline: { conf: [], eng: [], wpm: [], max: 90 },

    // simulation toggle (fallback/demo)
    simOn: false,
    simTimer: null,
    stressOn: false,

    lastJury: null,
    sessions: []
  };

  // =========================
  // Toast
  // =========================
  function toastShow(title, items) {
    toastTitle.textContent = title;
    toastList.innerHTML = "";
    items.forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      toastList.appendChild(li);
    });
    toast.classList.remove("hidden");
  }
  function toastHide() { toast.classList.add("hidden"); }
  btnToastOk.addEventListener("click", toastHide);

  // =========================
  // Tabs / Navigation
  // =========================
  function setTab(tab) {
    state.tab = tab;
    navPills.forEach(p => p.classList.toggle("on", p.dataset.tab === tab));
    panels.forEach(panel => {
      panel.style.display = (panel.dataset.panel === tab) ? "" : "none";
    });
    sideMode.textContent = tab.toUpperCase();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function jumpToPanel(tab) {
    setTab(tab);
    const el = $(`.panel[data-panel="${tab}"]`);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - 110;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  navPills.forEach(p => p.addEventListener("click", () => setTab(p.dataset.tab)));
  btnEnterStage.addEventListener("click", () => jumpToPanel("stage"));
  btnGoStage.addEventListener("click", () => jumpToPanel("stage"));
  btnGoScenarios.addEventListener("click", () => jumpToPanel("scenarios"));
  btnGoJury.addEventListener("click", () => jumpToPanel("jury"));
  $$("[data-jump]").forEach(b => b.addEventListener("click", () => jumpToPanel(b.dataset.jump)));

  // =========================
  // Segmented controls
  // =========================
  function setSegOn(btns, key, val) {
    btns.forEach(b => b.classList.toggle("on", b.dataset[key] === val));
  }

  function setCoachText(text) {
    hudCoach.textContent = text;
  }

  function setMode(mode) {
    state.mode = mode;
    hudMode.textContent = mode.toUpperCase();
    setSegOn(modeSegBtns, "mode", mode);
  }

  function setTrain(train) {
    state.train = train;
    setSegOn(trainSegBtns, "train", train);
    const msg =
      train === "official" ? "تدريب رسمي: قرار واضح + رقم + دعوة تنفيذية." :
      train === "media" ? "تدريب إعلامي: جمل قصيرة + ثبات نبرة + أقل حشو." :
      "تدريب مقابلة: جواب ثم مثال ثم رجوع للرسالة.";
    setCoachText(msg);
  }

  function setEnv(env) {
    state.env = env;
    const map = {
      conference: "مؤتمر",
      studio: "استوديو",
      interviewRoom: "مقابلة",
      classroom: "تدريب",
      podcast: "بودكاست",
      field: "ميداني"
    };
    hudEnv.textContent = map[env] || env;
    setSegOn(envSegBtns, "env", env);

    const hints = {
      conference: "ابدأ بجملة قوية + رقم/حقيقة + وعد مختصر.",
      studio: "ثبات… بدون حشو… وإيقاع مضبوط.",
      interviewRoom: "إجابة بجملة + مثال + رجوع للرسالة.",
      classroom: "قسّم الفكرة لخطوات… واسأل سؤال تفاعلي.",
      podcast: "نبرة دافئة + قصة قصيرة + خاتمة لطيفة.",
      field: "صوت أعلى + ترتيب معلومات + ربط بالمشهد."
    };
    setCoachText(hints[env] || "ثبت حضورك… والجمهور معك.");
  }

  function setCoachStyle(style) {
    state.coachStyle = style;
    setSegOn(coachSegBtns, "coach", style);
  }

  modeSegBtns.forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  trainSegBtns.forEach(b => b.addEventListener("click", () => setTrain(b.dataset.train)));
  envSegBtns.forEach(b => b.addEventListener("click", () => setEnv(b.dataset.env)));
  coachSegBtns.forEach(b => b.addEventListener("click", () => setCoachStyle(b.dataset.coach)));

  // Scenario cards (click to select env + jump stage)
  $$(".scenarioCard[data-pick]").forEach(card => {
    card.addEventListener("click", () => {
      setEnv(card.dataset.pick);
      toastShow("تم اختيار السيناريو ✅", [
        "تم ضبط البيئة.",
        "انطلق للمسرح… واضغط تسجيل أو Demo."
      ]);
      jumpToPanel("stage");
    });
  });

  // =========================
  // Executive + WebXR info
  // =========================
  btnExec.addEventListener("click", () => {
    document.body.classList.toggle("exec");
    toastShow("Executive Mode", [
      "تم تفعيل وضع العرض للجنة.",
      "واجهة أوضح + إحساس رسمي."
    ]);
  });

  btnXR.addEventListener("click", () => {
    toastShow("WebXR", [
      "AR/VR الحقيقي يحتاج متصفح داعم WebXR (غالبًا Chrome Android أو Meta Quest).",
      "على iPhone الدعم محدود.",
      "لكن: التسجيل والتحليل شغالين بشكل كامل."
    ]);
  });

  // =========================
  // Camera (Video)
  // =========================
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      state.camStream = stream;
      cam.srcObject = stream;
      cam.classList.add("on");
      state.cameraOn = true;
      btnCamera.textContent = "📷 إيقاف الكاميرا";
      setCoachText("الكاميرا شغالة… خلك جاهز للمسرح 😄");
    } catch (e) {
      toastShow("صلاحيات الكاميرا", [
        "اسمح للكاميرا من المتصفح.",
        "iPhone: Settings > Safari > Camera > Allow"
      ]);
      console.error(e);
    }
  }

  function stopCamera() {
    if (state.camStream) state.camStream.getTracks().forEach(t => t.stop());
    state.camStream = null;
    cam.srcObject = null;
    cam.classList.remove("on");
    state.cameraOn = false;
    btnCamera.textContent = "📷 تشغيل الكاميرا";
  }

  btnCamera.addEventListener("click", () => state.cameraOn ? stopCamera() : startCamera());

  // =========================
  // REAL Audio Capture + Analysis
  // =========================
  function ensureAudioCtx() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return state.audioCtx;
  }

  function stopAudioEngine() {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = null;

    try { state.analyser?.disconnect(); } catch {}
    try { state.sourceNode?.disconnect(); } catch {}

    state.analyser = null;
    state.sourceNode = null;

    state.lastEnergySamples = [];
    state.silenceFrames = 0;
    state.totalFrames = 0;
  }

  function startAudioEngine(stream) {
    const ctx = ensureAudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    state.analyser = ctx.createAnalyser();
    state.analyser.fftSize = 2048;
    state.analyser.smoothingTimeConstant = 0.8;

    state.sourceNode = ctx.createMediaStreamSource(stream);
    state.sourceNode.connect(state.analyser);

    const buf = new Float32Array(state.analyser.fftSize);

    const loop = () => {
      // get time-domain data
      state.analyser.getFloatTimeDomainData(buf);

      // RMS Energy
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length); // 0..~0.3 typical
      state.energyRms = rms;

      // Silence detection
      // threshold tuned for mic
      const silent = rms < 0.012;
      state.totalFrames += 1;
      if (silent) state.silenceFrames += 1;

      // stability: track last rms samples
      state.lastEnergySamples.push(rms);
      if (state.lastEnergySamples.length > 40) state.lastEnergySamples.shift();

      // compute stability score (lower variance => higher stability)
      const mean = state.lastEnergySamples.reduce((a, b) => a + b, 0) / (state.lastEnergySamples.length || 1);
      const variance = state.lastEnergySamples.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (state.lastEnergySamples.length || 1);

      // map to 0..100
      const energyScore = clamp((rms / 0.08) * 100, 0, 100);
      const stabilityScore = clamp(100 - (variance * 90000), 0, 100); // scale tuned

      state.energyScore = Math.round(energyScore);
      state.stabilityScore = Math.round(stabilityScore);
      state.silenceRatio = clamp(state.silenceFrames / (state.totalFrames || 1), 0, 1);

      // update metrics live
      computeLiveMetrics();     // updates wpm/conf/eng/fill when possible
      pushTimelineTick();       // timeline arrays
      renderMetrics();          // UI
      drawTimeline(false);      // canvas
      updateAudienceMood();     // emoji/text

      state.rafId = requestAnimationFrame(loop);
    };

    state.rafId = requestAnimationFrame(loop);
  }

  // =========================
  // Speech Recognition (optional)
  // =========================
  function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      state.speechOn = false;
      return false;
    }

    try {
      const rec = new SR();
      // العربية: حاول "ar-SA" وإذا الجهاز ما يدعمها بيتجاهل
      rec.lang = "ar-SA";
      rec.interimResults = true;
      rec.continuous = true;

      state.transcript = "";
      state.finalTranscript = "";
      state.recognition = rec;
      state.speechOn = true;

      rec.onresult = (ev) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const txt = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) state.finalTranscript += txt + " ";
          else interim += txt;
        }
        state.transcript = (state.finalTranscript + interim).trim();
      };

      rec.onerror = () => { /* ignore */ };
      rec.onend = () => { /* may end on its own */ };

      rec.start();
      return true;
    } catch {
      state.speechOn = false;
      return false;
    }
  }

  function stopSpeech() {
    try { state.recognition?.stop(); } catch {}
    state.recognition = null;
    state.speechOn = false;
  }

  // =========================
  // Real Recording (MediaRecorder)
  // =========================
  async function startRecording() {
    if (state.recording) return;

    // Request mic (audio true)
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      toastShow("صلاحيات المايك", [
        "لازم تسمح بالميكروفون من المتصفح.",
        "iPhone: Settings > Safari > Microphone > Allow",
        "أعد المحاولة بعد السماح."
      ]);
      console.error(e);
      return;
    }

    state.audioStream = stream;
    state.recChunks = [];

    // Start audio engine (real analysis)
    stopAudioEngine();
    startAudioEngine(stream);

    // Start speech (optional)
    const speechOk = startSpeech();
    if (!speechOk) {
      setCoachText("التسجيل شغال ✅ (تفريغ الكلام غير مدعوم هنا… بنحسب WPM تقديري).");
    } else {
      setCoachText("التسجيل شغال ✅ (تفريغ كلام + تحليل صوت لحظي).");
    }

    // Setup MediaRecorder
    let mr;
    try {
      const opts = {};
      // Some browsers support "audio/webm;codecs=opus"
      mr = new MediaRecorder(stream, opts);
    } catch (e) {
      toastShow("MediaRecorder", [
        "متصفحك ما يدعم تسجيل الصوت بهذه الطريقة.",
        "جرّب Chrome/Edge أو أحدث Safari."
      ]);
      console.error(e);
      return;
    }

    state.mediaRecorder = mr;

    mr.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) state.recChunks.push(ev.data);
    };

    mr.onstop = () => {
      // Create audio blob
      const blob = new Blob(state.recChunks, { type: mr.mimeType || "audio/webm" });
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      downloadBlob(`SpeakXR_Audio_${ts}.webm`, blob);

      // Also download text report if exists
      if (state.lastJury) {
        downloadText(`SpeakXR_Report_${ts}.txt`, buildFullTextReport(state.lastJury));
      }
    };

    // Start recording
    state.recording = true;
    state.recStartMs = Date.now();
    document.body.classList.add("recording");
    recLbl.textContent = "تسجيل جاري";
    recTime.textContent = "00:00";

    mr.start(250); // chunk every 250ms

    state.recTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - state.recStartMs) / 1000);
      recTime.textContent = mmss(sec);
    }, 250);

    toastShow("بدء التسجيل ✅", [
      "الميكروفون شغال + تحليل لحظي.",
      "لإنهاء التسجيل اضغط زر التسجيل مرة ثانية."
    ]);
  }

  function stopRecording() {
    if (!state.recording) return;

    state.recording = false;
    document.body.classList.remove("recording");
    recLbl.textContent = "اضغط للتسجيل";
    if (state.recTimer) clearInterval(state.recTimer);
    state.recTimer = null;

    // stop speech
    stopSpeech();

    // stop recorder
    try { state.mediaRecorder?.stop(); } catch {}
    state.mediaRecorder = null;

    // stop audio engine
    stopAudioEngine();

    // stop mic stream
    if (state.audioStream) {
      state.audioStream.getTracks().forEach(t => t.stop());
      state.audioStream = null;
    }

    toastShow("إيقاف التسجيل ✅", [
      "تم تنزيل ملف الصوت تلقائيًا.",
      "تقدر الآن تضغط (تحكيم فوري) أو (حفظ الجلسة)."
    ]);
  }

  btnRecord.addEventListener("click", () => {
    if (state.recording) stopRecording();
    else startRecording();
  });

  // =========================
  // Simulation (fallback/demo)
  // =========================
  function startSim() {
    if (state.simOn) return;
    state.simOn = true;
    btnStartSim.textContent = "🧪 إيقاف محاكاة";
    setCoachText("المحاكاة شغالة… الجمهور افتراضي بس بيحاسبك 😅");

    state.simTimer = setInterval(() => {
      // Simulated values if user wants demo without mic
      const baseWpm = state.env === "studio" ? 145 : state.env === "podcast" ? 125 : 140;
      const baseConf = state.train === "official" ? 72 : state.train === "media" ? 68 : 64;
      const baseEng = state.env === "field" ? 78 : 70;

      const st = (+stress.value || 35) / 100;
      const hard = state.stressOn ? 1 : 0;

      state.wpm = clamp(Math.round(baseWpm + (Math.random() * 36 - 18) + hard * (Math.random() * 20 - 10)), 85, 190);
      state.conf = clamp(Math.round(baseConf + (Math.random() * 20 - 10) - st * 8 - hard * 6), 30, 95);
      state.eng = clamp(Math.round(baseEng + (Math.random() * 24 - 12) - st * 6), 30, 95);
      state.fill = clamp(Math.round(22 + (Math.random() * 24 - 10) + st * 22 + hard * 8), 0, 85);

      pushTimelineTick();
      renderMetrics();
      drawTimeline(false);
      updateAudienceMood();

      if (Math.random() < 0.25) setCoachText(makeCoachHint());
    }, 900);
  }

  function stopSim() {
    state.simOn = false;
    btnStartSim.textContent = "🧪 تشغيل محاكاة";
    if (state.simTimer) clearInterval(state.simTimer);
    state.simTimer = null;
    setCoachText("تم إيقاف المحاكاة. تقدر تسوي تحكيم فوري الآن.");
  }

  btnStartSim.addEventListener("click", () => {
    if (state.simOn) stopSim();
    else startSim();
  });

  btnQuickDemo.addEventListener("click", () => {
    // clean start
    stopSim();
    stopRecording();
    setMode("xr");
    setTrain("official");
    setEnv("conference");
    resetMetrics();
    jumpToPanel("stage");
    startSim();
    toastShow("Demo ⚡", ["تم تشغيل Demo ومحاكاة حقيقية للمؤشرات."]);
  });

  // =========================
  // Metrics: live computation
  // =========================
  function countFillers(text) {
    // Arabic fillers list (you can expand)
    const fillers = [
      "يعني", "أمم", "امم", "طيب", "أوكي", "اوكي", "مثل", "هيا", "اه", "آه", "شوف", "بصراحة"
    ];
    if (!text) return 0;
    const t = text.replace(/[^\u0600-\u06FF\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!t) return 0;
    let count = 0;
    for (const f of fillers) {
      const re = new RegExp(`\\b${f}\\b`, "g");
      const m = t.match(re);
      if (m) count += m.length;
    }
    return count;
  }

  function computeWPMfromTranscript(durationSec) {
    const txt = (state.transcript || "").trim();
    if (!txt || durationSec <= 0) return null;

    const words = txt
      .replace(/[^\u0600-\u06FF\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);

    const wpm = Math.round((words.length / durationSec) * 60);
    return clamp(wpm, 40, 240);
  }

  function computeLiveMetrics() {
    // Energy & stability from real audio engine:
    // - energyScore => "Energy"
    // - stabilityScore + silenceRatio + fillers => "Confidence"
    // WPM from transcript if available, else estimate.

    // 1) Energy
    state.eng = clamp(state.energyScore || 0, 0, 100);

    // 2) WPM
    const durSec = state.recording ? (Date.now() - state.recStartMs) / 1000 : 0;
    const wpmReal = computeWPMfromTranscript(durSec);

    if (wpmReal !== null) state.wpm = wpmReal;
    else {
      // fallback estimate: use energy & silence to guess pace (rough but consistent)
      const pace = 120 + (state.eng - 50) * 0.8 - (state.silenceRatio * 80);
      state.wpm = clamp(Math.round(pace), 70, 190);
    }

    // 3) Fillers (real if transcript exists)
    const fillerCount = countFillers(state.transcript || "");
    // map to 0..85 relative to duration
    if (durSec > 5 && (state.transcript || "").trim()) {
      const perMin = (fillerCount / durSec) * 60;
      state.fill = clamp(Math.round(perMin * 9), 0, 85); // scale tuned
    } else {
      // if no transcript, keep low/neutral (don’t fake)
      state.fill = 0;
    }

    // 4) Confidence score:
    // combine stability + low silence + low fillers + WPM closeness
    const wpmScore = clamp(100 - Math.abs(state.wpm - 145) * 1.6, 0, 100);
    const silencePenalty = clamp(state.silenceRatio * 120, 0, 55);
    const fillPenalty = clamp(state.fill * 0.55, 0, 45);
    const rawConf = (state.stabilityScore * 0.45) + (wpmScore * 0.25) + (state.eng * 0.25) + ((100 - fillPenalty) * 0.05) - silencePenalty * 0.35;
    state.conf = clamp(Math.round(rawConf), 0, 100);
  }

  // =========================
  // Mood + Coach
  // =========================
  function updateAudienceMood() {
    const sens = (+audSens.value || 55) / 100;
    const st = (+stress.value || 35) / 100;

    const conf = state.conf / 100;
    const eng = state.eng / 100;
    const fill = state.fill / 100;

    let mood = (conf * 55 + eng * 45) - (fill * 60);
    mood -= (sens * 15);
    mood -= (state.stressOn ? 12 : 0);
    mood -= (st * 10);
    mood = clamp(mood, -50, 50);

    state.mood = clamp(state.mood * 0.75 + mood * 0.25, -100, 100);

    if (state.mood > 22) { audEmoji.textContent = "👏"; audText.textContent = "تصفيق… كمل!"; }
    else if (state.mood > 5) { audEmoji.textContent = "🙂"; audText.textContent = "الجمهور متابع"; }
    else if (state.mood > -10) { audEmoji.textContent = "😐"; audText.textContent = "ركز… فيه تشتت بسيط"; }
    else if (state.mood > -28) { audEmoji.textContent = "😕"; audText.textContent = "فيه ملل… اختصر واذكر مثال"; }
    else { audEmoji.textContent = "😬"; audText.textContent = "ضغط عالي… عدّل النبرة وقلل الحشو"; }

    sMood.textContent = audEmoji.textContent;
  }

  function makeCoachHint() {
    const dir = state.coachStyle === "dir";

    if (state.fill > 45) return dir ? "الحشو مرتفع… وقف (يعني/أمم) فورًا." : "خفف (يعني/أمم)… وبتشوف فرق سريع 👍";
    if (state.wpm > 170) return dir ? "سرعتك عالية… بطّئ." : "سرعتك ممتازة، بس بطّئ شوي عشان الرسالة توصل.";
    if (state.conf < 55) return dir ? "ثبات أقل… نفس عميق وخلك مباشر." : "خذ نفس… وانطلق بجملة واضحة.";
    if (state.eng < 55) return dir ? "الطاقة منخفضة… ارفع الصوت." : "ارفع طاقتك شوي… الجمهور يحب الحماس.";

    return dir ? "عطِ رقم/دليل الآن… بدون هذا كلام عام." : "أضف مثال واحد يعزز الفكرة.";
  }

  // =========================
  // Timeline (canvas)
  // =========================
  function pushTimelineTick() {
    state.timeline.conf.push(state.conf);
    state.timeline.eng.push(state.eng);
    // normalize WPM to 0..100 for drawing
    const wpmN = clamp(((state.wpm - 80) / 110) * 100, 0, 100);
    state.timeline.wpm.push(wpmN);

    const max = state.timeline.max;
    if (state.timeline.conf.length > max) state.timeline.conf.shift();
    if (state.timeline.eng.length > max) state.timeline.eng.shift();
    if (state.timeline.wpm.length > max) state.timeline.wpm.shift();
  }

  function drawTimeline(clear) {
    const W = timelineCanvas.width;
    const H = timelineCanvas.height;

    tctx.clearRect(0, 0, W, H);
    tctx.fillStyle = "rgba(0,0,0,0.15)";
    tctx.fillRect(0, 0, W, H);

    if (clear) return;

    // grid
    tctx.strokeStyle = "rgba(255,255,255,0.08)";
    tctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (H * i) / 5;
      tctx.beginPath();
      tctx.moveTo(0, y);
      tctx.lineTo(W, y);
      tctx.stroke();
    }

    const series = [
      { arr: state.timeline.conf, color: "rgba(34,211,238,0.95)" },
      { arr: state.timeline.eng,  color: "rgba(59,130,246,0.95)" },
      { arr: state.timeline.wpm,  color: "rgba(99,102,241,0.95)" }
    ];

    for (const s of series) {
      const arr = s.arr;
      if (!arr.length) continue;

      tctx.strokeStyle = s.color;
      tctx.lineWidth = 2.5;
      tctx.beginPath();

      const n = arr.length;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1 || 1)) * (W - 20) + 10;
        const y = H - (arr[i] / 100) * (H - 20) - 10;
        if (i === 0) tctx.moveTo(x, y);
        else tctx.lineTo(x, y);
      }
      tctx.stroke();
    }
  }

  // =========================
  // Render (HUD + Sidebar + Analysis)
  // =========================
  function renderMetrics() {
    const wpmScore = clamp(100 - Math.abs(state.wpm - 145) * 1.8, 0, 100);

    mWpm.textContent = state.wpm ? String(state.wpm) : "—";
    mConf.textContent = state.conf ? String(state.conf) : "—";
    mEng.textContent = state.eng ? String(state.eng) : "—";
    mFill.textContent = (state.transcript && state.transcript.trim()) ? String(state.fill) : "—";

    bWpm.style.width = `${wpmScore}%`;
    bConf.style.width = `${clamp(state.conf, 0, 100)}%`;
    bEng.style.width = `${clamp(state.eng, 0, 100)}%`;
    bFill.style.width = `${clamp(state.fill, 0, 100)}%`;

    // sidebar
    sWpm.textContent = state.wpm ? String(state.wpm) : "—";
    sConf.textContent = state.conf ? String(state.conf) : "—";
    sEng.textContent = state.eng ? String(state.eng) : "—";
    sFill.textContent = (state.transcript && state.transcript.trim()) ? String(state.fill) : "—";

    // analysis minis
    aWpm.textContent = state.wpm ? String(state.wpm) : "—";
    aConf.textContent = state.conf ? String(state.conf) : "—";
    aFill.textContent = (state.transcript && state.transcript.trim()) ? String(state.fill) : "—";
  }

  // =========================
  // Reset
  // =========================
  function resetMetrics() {
    state.wpm = 0; state.conf = 0; state.eng = 0; state.fill = 0; state.mood = 0;
    state.transcript = ""; state.finalTranscript = "";
    state.timeline.conf = []; state.timeline.eng = []; state.timeline.wpm = [];
    state.energyRms = 0; state.energyScore = 0; state.stabilityScore = 0;
    state.silenceRatio = 0;
    renderMetrics();
    drawTimeline(true);
    analysisSummary.textContent = "ابدأ بالتسجيل الحقيقي 🎙️ ثم اضغط “تحكيم فوري”.";
    setCoachText("جاهز. اضغط تسجيل… وخلك قوي قدّام الجمهور 😄");
    updateAudienceMood();
  }

  btnResetStage.addEventListener("click", () => {
    if (state.recording) stopRecording();
    stopSim();
    resetMetrics();
    toastShow("Reset ✅", ["رجعنا كل شيء للوضع الافتراضي."]);
  });

  // =========================
  // Stress
  // =========================
  btnSimStress.addEventListener("click", () => {
    state.stressOn = !state.stressOn;
    toastShow("الضغط", [
      state.stressOn ? "تم تفعيل الضغط ✅ (اللجنة قاسية)" : "تم إلغاء الضغط ✅",
      "عدّل مستوى الضغط من السلايدر."
    ]);
  });

  // =========================
  // Jury (Real)
  // =========================
  function computeScore() {
    if (!state.wpm && !state.conf && !state.eng) return null;

    const sens = (+audSens.value || 55) / 100;
    const st = (+stress.value || 35) / 100;
    const stressPenalty = state.stressOn ? 6 : 0;

    const wpmScore = clamp(100 - Math.abs(state.wpm - 145) * 1.6, 0, 100);
    const confScore = clamp(state.conf, 0, 100);
    const engScore  = clamp(state.eng, 0, 100);

    // fillers only if transcript exists; otherwise don't penalize
    const hasText = !!(state.transcript && state.transcript.trim());
    const fillPenalty = hasText ? clamp(state.fill * 0.55, 0, 45) : 0;

    let total = (wpmScore * 0.22) + (confScore * 0.38) + (engScore * 0.30) + ((100 - fillPenalty) * 0.10);
    total -= (sens * 4);
    total -= (st * 5);
    total -= stressPenalty;

    total = clamp(Math.round(total), 0, 100);

    const level = total >= 85 ? "Elite" : total >= 70 ? "Pro" : total >= 55 ? "Rising" : "Starter";
    const decision =
      total >= 85 ? "قبول فوري + جاهز للعرض الرسمي" :
      total >= 70 ? "ممتاز — يحتاج صقل بسيط" :
      total >= 55 ? "جيد — يحتاج تدريب مركز" :
      "غير مجتاز — نحتاج إعادة بناء الأداء";

    const voice = {
      clarity: clamp(Math.round(confScore * 0.60 + (100 - fillPenalty) * 0.40), 0, 100),
      tone: clamp(Math.round(engScore * 0.55 + confScore * 0.45), 0, 100),
      pace: clamp(Math.round(wpmScore), 0, 100)
    };

    const presence = {
      steadiness: clamp(Math.round(state.stabilityScore * 0.75 + confScore * 0.25), 0, 100),
      stressMgmt: clamp(Math.round(confScore - (state.stressOn ? 10 : 4)), 0, 100),
      contact: clamp(Math.round(confScore * 0.85 + engScore * 0.15), 0, 100)
    };

    const persuasion = {
      opener: clamp(Math.round(confScore * 0.65 + engScore * 0.35), 0, 100),
      structure: clamp(Math.round((100 - fillPenalty) * 0.55 + confScore * 0.45), 0, 100),
      close: clamp(Math.round(confScore * 0.60 + wpmScore * 0.40), 0, 100)
    };

    const audience = {
      interact: clamp(Math.round((state.mood + 100) / 2), 0, 100),
      boredom: clamp(Math.round(100 - (state.mood + 100) / 2), 0, 100),
      applause: clamp(Math.round(clamp(state.mood, 0, 50) * 2), 0, 100)
    };

    const notes = makeJuryNotes(total, hasText);

    return {
      total, level, decision,
      voice, presence, persuasion, audience,
      notes,
      meta: {
        mode: state.mode,
        env: state.env,
        train: state.train,
        coach: state.coachStyle,
        stressOn: state.stressOn,
        audSens: +audSens.value || 55,
        stress: +stress.value || 35,
        wpm: state.wpm,
        conf: state.conf,
        eng: state.eng,
        fill: hasText ? state.fill : null,
        silenceRatio: state.silenceRatio,
        stability: state.stabilityScore,
        transcript: (state.transcript || "").trim() || null
      }
    };
  }

  function makeJuryNotes(total, hasText) {
    const fillerLine = hasText ? "وخفف الحشو (يعني/أمم) لأنه يأكل الثقة." : "تفريغ الكلام غير متاح هنا، ركّز على التوقفات والثبات.";
    if (total >= 85) {
      return {
        voice: "وضوح ممتاز ونبرة متماسكة.",
        presence: "حضور قوي… وثبات عالي تحت الضغط.",
        persuasion: "بناء مقنع… الافتتاح والخاتمة متزنين.",
        audience: "الجمهور متفاعل بقوة.",
        extra: fillerLine
      };
    }
    if (total >= 70) {
      return {
        voice: "الصوت جيد. راقب الإيقاع وخلك على سرعة ثابتة.",
        presence: "الثقة واضحة لكنها تهتز مع الضغط… نفس عميق قبل الجمل المهمة.",
        persuasion: "محتوى جيد—أضف مثال أقوى في المنتصف.",
        audience: "الجمهور متابع… يحتاج لحظة تأثير/قصة قصيرة.",
        extra: fillerLine
      };
    }
    if (total >= 55) {
      return {
        voice: "الوضوح يحتاج دعم: جمل أقصر وتوقفات محسوبة.",
        presence: "خفف التوتر: ركّز على رسالة واحدة وكررها بصيغ مختلفة.",
        persuasion: "رتّب البناء: (مشكلة → حل → دليل → دعوة).",
        audience: "التفاعل متوسط… اختصر وابدأ بقوة.",
        extra: fillerLine
      };
    }
    return {
      voice: "السرعة/الثبات غير مستقرة. رجّع الأساسيات: جمل قصيرة ونبرة ثابتة.",
      presence: "الثقة منخفضة تحت الضغط. ابدأ بتدريب تنفس + قراءة بطيئة.",
      persuasion: "المحتوى مشتت. ركّز على 3 نقاط فقط.",
      audience: "الجمهور يمل بسرعة… افتح بقصة/رقم قوي.",
      extra: fillerLine
    };
  }

  function buildSummaryText(j) {
    const m = j.meta;
    const envMap = {
      conference: "قاعة مؤتمر",
      studio: "استوديو الأخبار",
      interviewRoom: "مقابلة",
      classroom: "قاعة تدريب",
      podcast: "بودكاست",
      field: "تقرير ميداني"
    };

    const fillLine = (m.fill === null) ? "Fillers: — (لا يوجد تفريغ كلام)" : `Fillers: ${m.fill}`;
    return [
      `ملخص تحليلي (XR Jury)`,
      `- الوضع: ${m.mode.toUpperCase()} | البيئة: ${envMap[m.env] || m.env} | التدريب: ${m.train}`,
      `- WPM: ${m.wpm} | Confidence: ${m.conf} | Energy: ${m.eng} | ${fillLine}`,
      `- ثبات الصوت: ${m.stability} | نسبة الصمت: ${(m.silenceRatio * 100).toFixed(0)}%`,
      `- الدرجة: ${j.total}/100 (${j.level})`,
      `- القرار: ${j.decision}`,
      ``,
      `أفضل تحسين سريع (60 ثانية):`,
      `1) وقفة 1 ثانية قبل رقم/دليل.`,
      `2) جملة رسالة واحدة + مثال واحد.`,
      `3) ثبّت سرعة بين 120–160.`,
      `4) ${j.notes.extra}`,
    ].join("\n");
  }

  function buildFullTextReport(j) {
    const m = j.meta;
    const envMap = {
      conference: "قاعة مؤتمر",
      studio: "استوديو الأخبار",
      interviewRoom: "مقابلة",
      classroom: "قاعة تدريب",
      podcast: "بودكاست",
      field: "تقرير ميداني"
    };
    return [
      `SpeakXR X-Stage — تقرير تحكيم (AI Jury)`,
      `----------------------------------------`,
      `التاريخ: ${new Date().toLocaleString("ar-SA")}`,
      `الوضع: ${m.mode.toUpperCase()} | البيئة: ${envMap[m.env] || m.env} | نمط التدريب: ${m.train}`,
      `الضغط: ${m.stress}% | حساسية الجمهور: ${m.audSens}% | Stress Toggle: ${m.stressOn ? "ON" : "OFF"}`,
      ``,
      `المؤشرات (حقيقية من الصوت):`,
      `- WPM: ${m.wpm}`,
      `- Confidence: ${m.conf}`,
      `- Energy: ${m.eng}`,
      `- Stability: ${m.stability}`,
      `- Silence Ratio: ${(m.silenceRatio * 100).toFixed(0)}%`,
      `- Fillers: ${m.fill === null ? "— (لا يوجد تفريغ كلام)" : m.fill}`,
      ``,
      `النتيجة النهائية: ${j.total}/100`,
      `المستوى: ${j.level}`,
      `القرار: ${j.decision}`,
      ``,
      `تفصيل اللجان:`,
      `1) لجنة الصوت`,
      `   - وضوح: ${j.voice.clarity}`,
      `   - نبرة: ${j.voice.tone}`,
      `   - إيقاع: ${j.voice.pace}`,
      `   - ملاحظة: ${j.notes.voice}`,
      ``,
      `2) لجنة الثقة والحضور`,
      `   - ثبات: ${j.presence.steadiness}`,
      `   - إدارة توتر: ${j.presence.stressMgmt}`,
      `   - تواصل: ${j.presence.contact}`,
      `   - ملاحظة: ${j.notes.presence}`,
      ``,
      `3) لجنة الإقناع والبناء`,
      `   - بداية قوية: ${j.persuasion.opener}`,
      `   - بناء منطقي: ${j.persuasion.structure}`,
      `   - خاتمة: ${j.persuasion.close}`,
      `   - ملاحظة: ${j.notes.persuasion}`,
      ``,
      `4) لجنة الجمهور`,
      `   - تفاعل: ${j.audience.interact}`,
      `   - ملل/تشتيت: ${j.audience.boredom}`,
      `   - تصفيق: ${j.audience.applause}`,
      `   - ملاحظة: ${j.notes.audience}`,
      ``,
      `توصيات تنفيذية (Actionable):`,
      `- (30 ثانية) افتح بجملة قوية + رقم/حقيقة.`,
      `- (60 ثانية) ثبّت النبرة وقلل الصمت الطويل.`,
      `- (90 ثانية) مثال واحد + خاتمة دعوة واضحة.`,
      `- ملاحظة: ${j.notes.extra}`,
      ``,
      `تفريغ الكلام (إن توفر):`,
      `${m.transcript ? m.transcript : "—"}`,
      ``,
      `— نهاية التقرير —`
    ].join("\n");
  }

  function applyJury(j) {
    state.lastJury = j;

    scoreEl.textContent = String(j.total);
    scoreBar.style.width = `${j.total}%`;
    lvlEl.textContent = j.level;
    decisionEl.textContent = `القرار: ${j.decision}`;

    jVoice1.textContent = j.voice.clarity;
    jVoice2.textContent = j.voice.tone;
    jVoice3.textContent = j.voice.pace;
    jVoiceNote.textContent = j.notes.voice;

    jPres1.textContent = j.presence.steadiness;
    jPres2.textContent = j.presence.stressMgmt;
    jPres3.textContent = j.presence.contact;
    jPresNote.textContent = j.notes.presence;

    jPers1.textContent = j.persuasion.opener;
    jPers2.textContent = j.persuasion.structure;
    jPers3.textContent = j.persuasion.close;
    jPersNote.textContent = j.notes.persuasion;

    jAud1.textContent = j.audience.interact;
    jAud2.textContent = j.audience.boredom;
    jAud3.textContent = j.audience.applause;
    jAudNote.textContent = j.notes.audience;

    analysisSummary.textContent = buildSummaryText(j);
    textReport.textContent = buildFullTextReport(j);
  }

  btnGenerate.addEventListener("click", () => {
    const j = computeScore();
    if (!j) {
      toastShow("تحكيم فوري", [
        "ما فيه بيانات كفاية.",
        "اضغط تسجيل 🎙️ وتكلم 10 ثواني… ثم ارجع للتحكيم."
      ]);
      return;
    }
    applyJury(j);
    jumpToPanel("jury");
    toastShow("تم التحكيم ✅", [
      `الدرجة: ${j.total}/100`,
      `المستوى: ${j.level}`
    ]);
  });

  btnTextReport.addEventListener("click", () => {
    if (!state.lastJury) {
      toastShow("تقرير نصي", ["سو تحكيم أولاً (زر: تحكيم فوري)."]);
      return;
    }
    textReport.classList.toggle("hidden");
  });

  // =========================
  // Save sessions (localStorage)
  // =========================
  function loadSessions() {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.sessions = raw ? safeJSON(raw, []) : [];
    if (!Array.isArray(state.sessions)) state.sessions = [];
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
    for (const s of state.sessions) {
      if (typeof s.score === "number") best = best === null ? s.score : Math.max(best, s.score);
    }
    statBest.textContent = best === null ? "—" : String(best);
    statLevel.textContent = best === null ? "—" : best >= 85 ? "Elite" : best >= 70 ? "Pro" : best >= 55 ? "Rising" : "Starter";
  }

  function saveSessionNow() {
    const j = state.lastJury;
    if (!j) {
      toastShow("حفظ الجلسة", ["سوّ تحكيم أول (زر: تحكيم فوري)."]);
      return;
    }
    const s = {
      id: `S-${Date.now()}`,
      at: nowISO(),
      score: j.total,
      level: j.level,
      decision: j.decision,
      meta: j.meta
    };
    state.sessions.unshift(s);
    if (state.sessions.length > 60) state.sessions.length = 60;
    saveSessions();
    toastShow("تم الحفظ ✅", [
      `جلسة: ${s.id}`,
      `الدرجة: ${s.score}/100 (${s.level})`
    ]);
  }

  btnSaveSession.addEventListener("click", saveSessionNow);

  // =========================
  // Downloads
  // =========================
  btnDownloadReport.addEventListener("click", () => {
    if (!state.lastJury) {
      toastShow("تحميل تقرير", ["سو تحكيم أولاً (تحكيم فوري)."]);
      return;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadText(`SpeakXR_Report_${ts}.txt`, buildFullTextReport(state.lastJury));
  });

  // HUD Snapshot (بدون مكتبة خارجية: نص + لقطة فريم فيديو لو الكام شغالة)
  btnSnap.addEventListener("click", () => {
    const snapshotText = [
      `SpeakXR HUD Snapshot`,
      `TIME: ${new Date().toLocaleString("ar-SA")}`,
      `MODE: ${state.mode}`,
      `ENV: ${state.env}`,
      `TRAIN: ${state.train}`,
      `WPM: ${state.wpm}`,
      `CONF: ${state.conf}`,
      `ENG: ${state.eng}`,
      `FILL: ${(state.transcript && state.transcript.trim()) ? state.fill : "—"}`,
      `MOOD: ${audEmoji.textContent} ${audText.textContent}`,
      `TRANSCRIPT: ${(state.transcript || "").trim() || "—"}`
    ].join("\n");

    downloadText("SpeakXR_HUD_SNAPSHOT.txt", snapshotText);

    // if camera is on, export a PNG frame
    if (state.cameraOn && cam.videoWidth) {
      const c = document.createElement("canvas");
      c.width = cam.videoWidth;
      c.height = cam.videoHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(cam, 0, 0, c.width, c.height);

      // overlay small HUD box
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(24, 24, 520, 210);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px Tajawal, sans-serif";
      ctx.fillText("SpeakXR HUD", 44, 60);
      ctx.font = "bold 18px Tajawal, sans-serif";
      ctx.fillText(`WPM: ${state.wpm}`, 44, 95);
      ctx.fillText(`CONF: ${state.conf}`, 44, 125);
      ctx.fillText(`ENG: ${state.eng}`, 44, 155);
      ctx.fillText(`MOOD: ${audEmoji.textContent}`, 44, 185);

      c.toBlob((blob) => {
        if (blob) downloadBlob("SpeakXR_CameraFrame.png", blob);
      }, "image/png");
    }

    toastShow("لقطة HUD ✅", [
      "تم تنزيل Snapshot نصي.",
      state.cameraOn ? "وتم تنزيل لقطة PNG من الكاميرا." : "شغّل الكاميرا لو تبي PNG."
    ]);
  });

  // =========================
  // Misc Buttons
  // =========================
  btnSimStress.addEventListener("click", () => {
    state.stressOn = !state.stressOn;
    toastShow("ضغط التدريب", [
           state.stressOn ? "ON ✅" : "OFF ✅",
      "الضغط يزيد صعوبة التقييم ويقلل الدرجة."
    ]);
  });

  btnCamera.addEventListener("dblclick", () => {
    // Easter egg: double-click toggles exec
    document.body.classList.toggle("exec");
  });

  // =========================
  // FIX: Wire missing buttons + transitions
  // =========================

  // زر “تشغيل مسرح XR” لو موجود بالصفحة
  if (btnEnterStage) {
    btnEnterStage.addEventListener("click", () => jumpToPanel("stage"));
  }

  // زر “تحميل تقرير” من الهيرو
  if (btnDownloadReport) {
    btnDownloadReport.addEventListener("click", () => {
      if (!state.lastJury) {
        toastShow("تحميل تقرير", ["سو تحكيم أولاً (تحكيم فوري)."]);
        return;
      }
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      downloadText(`SpeakXR_Report_${ts}.txt`, buildFullTextReport(state.lastJury));
    });
  }

  // زر "حفظ الجلسة" لو موجود
  if (btnSaveSession) {
    btnSaveSession.addEventListener("click", saveSessionNow);
  }

  // زر “فتح/إغلاق التقرير النصي”
  if (btnTextReport) {
    btnTextReport.addEventListener("click", () => {
      if (!state.lastJury) {
        toastShow("تقرير نصي", ["سو تحكيم أولاً (زر: تحكيم فوري)."]);
        return;
      }
      textReport.classList.toggle("hidden");
    });
  }

  // زر “تحكيم فوري”
  if (btnGenerate) {
    btnGenerate.addEventListener("click", () => {
      const j = computeScore();
      if (!j) {
        toastShow("تحكيم فوري", [
          "ما فيه بيانات كفاية.",
          "اضغط تسجيل 🎙️ وتكلم 10 ثواني… ثم ارجع للتحكيم."
        ]);
        return;
      }
      applyJury(j);
      jumpToPanel("jury");
      toastShow("تم التحكيم ✅", [
        `الدرجة: ${j.total}/100`,
        `المستوى: ${j.level}`
      ]);
    });
  }

  // زر “تفعيل/إيقاف المحاكاة”
  if (btnStartSim) {
    btnStartSim.addEventListener("click", () => {
      if (state.simOn) stopSim();
      else startSim();
    });
  }

  // زر Demo السريع
  if (btnQuickDemo) {
    btnQuickDemo.addEventListener("click", () => {
      stopSim();
      stopRecording();
      setMode("xr");
      setTrain("official");
      setEnv("conference");
      resetMetrics();
      jumpToPanel("stage");
      startSim();
      toastShow("Demo ⚡", ["تم تشغيل Demo ومحاكاة حقيقية للمؤشرات."]);
    });
  }

  // زر “تشغيل/إيقاف الكاميرا”
  if (btnCamera) {
    btnCamera.addEventListener("click", () => state.cameraOn ? stopCamera() : startCamera());
  }

  // زر “تسجيل” (Toggle)
  if (btnRecord) {
    btnRecord.addEventListener("click", () => {
      if (state.recording) stopRecording();
      else startRecording();
    });
  }

  // زر “Reset”
  if (btnResetStage) {
    btnResetStage.addEventListener("click", () => {
      if (state.recording) stopRecording();
      stopSim();
      resetMetrics();
      toastShow("Reset ✅", ["رجعنا كل شيء للوضع الافتراضي."]);
    });
  }

  // زر “Snapshot”
  if (btnSnap) {
    btnSnap.addEventListener("click", () => {
      const snapshotText = [
        `SpeakXR HUD Snapshot`,
        `TIME: ${new Date().toLocaleString("ar-SA")}`,
        `MODE: ${state.mode}`,
        `ENV: ${state.env}`,
        `TRAIN: ${state.train}`,
        `WPM: ${state.wpm}`,
        `CONF: ${state.conf}`,
        `ENG: ${state.eng}`,
        `FILL: ${(state.transcript && state.transcript.trim()) ? state.fill : "—"}`,
        `MOOD: ${audEmoji.textContent} ${audText.textContent}`,
        `TRANSCRIPT: ${(state.transcript || "").trim() || "—"}`
      ].join("\n");

      downloadText("SpeakXR_HUD_SNAPSHOT.txt", snapshotText);

      if (state.cameraOn && cam && cam.videoWidth) {
        const c = document.createElement("canvas");
        c.width = cam.videoWidth;
        c.height = cam.videoHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(cam, 0, 0, c.width, c.height);

        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(24, 24, 520, 210);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 26px Tajawal, sans-serif";
        ctx.fillText("SpeakXR HUD", 44, 60);
        ctx.font = "bold 18px Tajawal, sans-serif";
        ctx.fillText(`WPM: ${state.wpm}`, 44, 95);
        ctx.fillText(`CONF: ${state.conf}`, 44, 125);
        ctx.fillText(`ENG: ${state.eng}`, 44, 155);
        ctx.fillText(`MOOD: ${audEmoji.textContent}`, 44, 185);

        c.toBlob((blob) => {
          if (blob) downloadBlob("SpeakXR_CameraFrame.png", blob);
        }, "image/png");
      }

      toastShow("لقطة HUD ✅", [
        "تم تنزيل Snapshot نصي.",
        state.cameraOn ? "وتم تنزيل لقطة PNG من الكاميرا." : "شغّل الكاميرا لو تبي PNG."
      ]);
    });
  }

  // =========================
  // UX: Close toast by clicking outside
  // =========================
  if (toast) {
    toast.addEventListener("click", (e) => {
      if (e.target === toast) toastHide();
    });
  }

  // =========================
  // Init
  // =========================
  function init() {
    // default show stage
    panels.forEach(p => p.style.display = (p.dataset.panel === "stage") ? "" : "none");

    setMode("xr");
    setTrain("official");
    setEnv("conference");
    setCoachStyle("enc");

    resetMetrics();
    loadSessions();
    drawTimeline(true);

    toastHide();
    toastShow("جاهز ✅", [
      "أفضل بداية: شغّل الكاميرا (اختياري) ثم اضغط تسجيل 🎙️ وتكلم 15 ثانية.",
      "بعدها اضغط (تحكيم فوري) و(حفظ الجلسة)."
    ]);
  }

  init();

})();
