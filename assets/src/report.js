import { downloadText, downloadJSON, clamp } from "./core.js";

export function createReport(store, ui){
  let last = null;

  function makeDecision(score){
    if(score >= 85) return { level:"Elite", decision:"قبول فوري + جاهز للعرض الرسمي" };
    if(score >= 70) return { level:"Pro", decision:"ممتاز — يحتاج صقل بسيط" };
    if(score >= 55) return { level:"Rising", decision:"جيد — يحتاج تدريب مركز" };
    return { level:"Starter", decision:"غير مجتاز — نحتاج إعادة بناء الأداء" };
  }

  function scoreFromMetrics(m){
    // weighted score: clarity+energy+pace+gate
    const wpm = m.wpm ?? 140;
    const paceScore = clamp(100 - Math.abs(wpm - 145)*1.6, 0, 100);
    const gatePenalty = (m.gateState === "صمت") ? 12 : 0;

    let total =
      (m.clarity*0.40) +
      (m.energy*0.33) +
      (paceScore*0.22) +
      (m.gate*0.05);

    total -= gatePenalty;
    return clamp(Math.round(total), 0, 100);
  }

  function summaryLine(m){
    return `WPM:${m.wpm ?? "—"} | Energy:${m.energy ?? "—"} | Clarity:${m.clarity ?? "—"} | Gate:${m.gateState}`;
  }

  function save(snapshot){
    // snapshot: { at, scenario, env, metrics }
    const score = scoreFromMetrics(snapshot.metrics);
    const res = makeDecision(score);

    const item = {
      id: `S-${Date.now()}`,
      at: snapshot.at,
      scenario: snapshot.scenario,
      env: snapshot.env,
      metrics: snapshot.metrics,
      score,
      level: res.level,
      decision: res.decision
    };

    last = item;
    store.add(item);
    refreshUI();
    return item;
  }

  function refreshUI(){
    const st = store.stats();
    ui.rCount.textContent = String(st.count);

    if(last){
      ui.rScore.textContent = `${last.score}/100 (${last.level})`;
      ui.rDecision.textContent = last.decision;
      ui.rSummary.textContent = summaryLine(last.metrics);
    }else{
      ui.rScore.textContent = "—";
      ui.rDecision.textContent = "—";
      ui.rSummary.textContent = "—";
    }
  }

  function exportJSON(){
    const all = store.read();
    downloadJSON(`SpeakXR_Sessions_${Date.now()}.json`, all);
  }

  function exportHTML(){
    const all = store.read();
    const rows = all.slice(0, 25).map(s => `
      <tr>
        <td>${escapeHTML(new Date(s.at).toLocaleString("ar-SA"))}</td>
        <td>${escapeHTML(s.scenario)}</td>
        <td>${escapeHTML(s.env)}</td>
        <td><b>${s.score}</b> / 100</td>
        <td>${escapeHTML(s.level)}</td>
        <td>${escapeHTML(s.decision)}</td>
      </tr>
    `).join("");

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SpeakXR Report</title>
<style>
body{font-family:Tahoma,Arial;background:#070815;color:#fff;margin:0;padding:24px}
h1{margin:0 0 12px}
table{width:100%;border-collapse:collapse;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;overflow:hidden}
th,td{padding:12px;border-bottom:1px solid rgba(255,255,255,.10);text-align:right}
th{background:rgba(255,255,255,.08)}
.small{opacity:.75;font-size:12px;margin-top:8px}
</style>
</head>
<body>
<h1>SpeakXR — تقرير الجلسات</h1>
<div class="small">آخر 25 جلسة (LocalStorage)</div>
<table>
<thead>
<tr><th>التاريخ</th><th>السيناريو</th><th>البيئة</th><th>النتيجة</th><th>المستوى</th><th>القرار</th></tr>
</thead>
<tbody>
${rows || `<tr><td colspan="6">لا توجد جلسات محفوظة</td></tr>`}
</tbody>
</table>
</body>
</html>`;

    downloadText(`SpeakXR_Report_${Date.now()}.html`, html);
  }

  function wipe(){
    store.wipe();
    last = null;
    refreshUI();
  }

  function escapeHTML(s){
    return String(s).replace(/[&<>"']/g, (m)=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  return { save, refreshUI, exportJSON, exportHTML, wipe };
}
