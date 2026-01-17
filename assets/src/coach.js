import { clamp } from "./core.js";

export function createCoach(ui){
  let lastMsgAt = 0;
  let style = "enc"; // enc | dir
  let sessionOn = false;

  function setStyle(v){
    style = v === "dir" ? "dir" : "enc";
  }

  function onSessionStart(){
    sessionOn = true;
    ui.coachBox.textContent = "ابدأنا… عطنا افتتاحية قوية (جملة + دليل).";
  }

  function onSessionStop(){
    sessionOn = false;
    ui.coachBox.textContent = "تم الإيقاف. احفظ الجلسة أو صدّر التقرير.";
  }

  function say(msg){
    ui.coachBox.innerHTML = msg + `<div class="small">Coach: ${style === "dir" ? "Direct" : "Encourage"}</div>`;
  }

  function pickHint(m){
    // logic: focus on biggest weakness
    const gateBad = m.gateState === "صمت" && m.gate < 30;
    const lowCl = m.clarity < 55;
    const lowEn = m.energy < 50;
    const fast = (m.wpm ?? 140) > 170;
    const slow = (m.wpm ?? 140) < 105;

    if(gateBad){
      return style==="dir"
        ? "وقف صمت طويل… خذ نفس وقل جملة قصيرة الآن."
        : "خُذ نفس… وابدأ بجملة واحدة واضحة، لا تترك فراغ.";
    }
    if(lowCl){
      return style==="dir"
        ? "وضوحك نازل… جُمَل أقصر + توقفات محسوبة."
        : "خفّف طول الجمل… وخلك على وقفات قصيرة بين الأفكار.";
    }
    if(lowEn){
      return style==="dir"
        ? "ارفع الطاقة… صوت أعلى ونبرة أثبت."
        : "ارفع الحماس شوي… طاقة أعلى = جمهور متفاعل.";
    }
    if(fast){
      return style==="dir"
        ? "سرعتك عالية… بطّئ."
        : "ممتاز… بس بطّئ قليلًا عشان الرسالة تثبت.";
    }
    if(slow){
      return style==="dir"
        ? "سرعتك بطيئة… زِد الإيقاع."
        : "زيد الإيقاع شوي… خلك أكثر حيوية.";
    }

    // advanced: encourage structure
    if((m.energy > 70) && (m.clarity > 70)){
      return style==="dir"
        ? "أعطِ رقم/دليل الآن… ثم دعوة واضحة."
        : "أحسنت! الآن أضف مثال واقعي ثم اختم بدعوة تنفيذية.";
    }

    return style==="dir"
      ? "ركز: (رسالة واحدة → دليل → مثال)."
      : "خل رسالتك واحدة… ثم دعمها بدليل ومثال.";
  }

  function tick(m){
    if(!sessionOn) return;
    const now = performance.now();
    if(now - lastMsgAt < 1800) return; // throttle
    lastMsgAt = now;
    say(pickHint(m));
  }

  return { setStyle, onSessionStart, onSessionStop, tick };
}
