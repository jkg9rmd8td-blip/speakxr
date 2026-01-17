// /src/coach.js — SpeakXR Coach Engine (heuristic, real-time)
import { clamp } from "./core.js";

export function createCoach(){
  let lastEnergy = 0;
  let jitter = 0;

  function reset(){
    lastEnergy = 0;
    jitter = 0;
  }

  function estimateFillers(m){
    // heuristic: more jitter + more silence switches -> more fillers
    const e = m.energy ?? 0;
    const diff = Math.abs(e - lastEnergy);
    jitter = clamp(jitter*0.85 + diff*0.15, 0, 100);
    lastEnergy = e;

    let base = 0;
    if ((m.gateState || "").includes("صمت")) base += 2;
    if (jitter > 22) base += 1;
    if (jitter > 38) base += 1;
    if ((m.clarity ?? 0) < 55) base += 1;
    return clamp(base, 0, 6);
  }

  function liveLine({ mode="soft", metrics, pressure=45, audienceSense=55, scenario="مقابلة" }){
    const wpm = metrics.wpm ?? 0;
    const c = metrics.clarity ?? 0;
    const e = metrics.energy ?? 0;
    const a = metrics.audience ?? 0;
    const fillers = metrics.fillers ?? 0;
    const silent = (metrics.gateState || "") === "صمت";

    // build issues
    const wpmMsg =
      wpm === 0 ? "ابدأ الكلام…" :
      wpm < 110 ? "سرّع شوي (بدون تهور)" :
      wpm > 170 ? "خفف السرعة… لا تحرق النَفَس" :
      "السرعة ممتازة";

    const clarityMsg =
      c < 55 ? "وضوحك يحتاج رفع: نطق الحروف + وقفـات" :
      c < 70 ? "وضوح جيد… زِد ترتيب الجمل" :
      "وضوح قوي";

    const energyMsg =
      e < 35 ? "ارفع الطاقة (نبرة/ثقة)" :
      e > 85 ? "طاقة عالية… اضبطها حتى ما تصير عصبية" :
      "طاقة مناسبة";

    const audienceMsg =
      a < 45 ? "الجمهور بدأ يمل… مثال واحد يوقظه" :
      a < 65 ? "تفاعل متوسط… اضف رقم/دليل" :
      "الجمهور متفاعل 👏";

    const fillerMsg =
      fillers >= 4 ? "خفف (يعني/اممم)… سكتة قصيرة أفضل" :
      fillers >= 2 ? "انتبه للحشو…" :
      "كلامك نظيف";

    const pressureMsg =
      pressure > 70 ? "ضغط عالي: جاوب بثلاث نقاط فقط" :
      pressure > 45 ? "توقع سؤال مفاجئ" :
      "ضغط منخفض";

    const head =
      mode === "jury" ? "🧑‍⚖️ لجنة التحكيم:" :
      mode === "direct" ? "🎯 ملاحظة مباشرة:" :
      "🧠 المدرب:";

    if(silent){
      return `${head} صمت… خذ نفس وابدأ بجملة افتتاح قوية مرتبطة بالسيناريو (${scenario}).`;
    }

    const line = `${head} ${wpmMsg} • ${clarityMsg} • ${energyMsg} • ${audienceMsg} • ${fillerMsg} • ${pressureMsg}`;
    return tweakTone(line, mode);
  }

  function makeTips({ mode="soft", metrics, pressure=45, audienceSense=55 }){
    const wpm = metrics.wpm ?? 0;
    const c = metrics.clarity ?? 0;
    const e = metrics.energy ?? 0;
    const fillers = metrics.fillers ?? 0;

    const tips = [];
    if (wpm && wpm > 170) tips.push("خفف السرعة: قسم الجمل إلى وحدات قصيرة.");
    if (wpm && wpm < 110) tips.push("سرّع الإيقاع: استخدم جملتين قصيرتين بدل جملة طويلة.");
    if (c < 60) tips.push("الوضوح: افتح الفم أكثر + شد الحروف المهموسة (س/ص/ث).");
    if (e < 35) tips.push("الطاقة: ارفع النبرة في الكلمات المفتاحية فقط.");
    if (fillers >= 3) tips.push("الحشو: بدل 'اممم' استخدم سكتة نصف ثانية ثم أكمل.");
    if (pressure > 60) tips.push("تحت الضغط: استخدم نموذج (عنوان → مثال → نتيجة).");
    if (audienceSense > 60) tips.push("الجمهور حساس: ادخل رقم/دليل كل 20–30 ثانية.");
    if (!tips.length) tips.push("أداؤك متوازن… ركّز على بداية أقوى وخاتمة مختصرة.");

    const prefix =
      mode === "jury" ? "🧑‍⚖️ توصيات اللجنة:\n" :
      mode === "direct" ? "🎯 نفّذ التالي:\n" :
      "🧠 جرب التالي:\n";

    return prefix + tips.map((t,i)=>`${i+1}) ${t}`).join("\n");
  }

  function tweakTone(text, mode){
    if(mode === "jury"){
      return text.replace("👏","").replace("🧠 المدرب:","🧑‍⚖️ لجنة التحكيم:");
    }
    if(mode === "direct"){
      return text.replace("🧠 المدرب:","🎯 ملاحظة مباشرة:");
    }
    return text;
  }

  return { reset, estimateFillers, liveLine, makeTips };
}
