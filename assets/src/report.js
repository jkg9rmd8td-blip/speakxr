import { downloadText, downloadJSON } from "./core.js";

export function createReport(store, ui){

  function computeScore(m){
    if(!m) return {score:0, decision:"—"};

    const s =
      m.energy*0.35 +
      m.clarity*0.35 +
      (100-Math.abs((m.wpm||140)-140))*0.3;

    const score = Math.round(Math.max(0, Math.min(100, s)));

    const decision =
      score>85 ? "ممتاز — جاهز للعرض"
      : score>65 ? "جيد — يحتاج صقل"
      : "ضعيف — تدريب إضافي";

    return {score, decision};
  }

  function save(snapshot){
    const r = computeScore(snapshot.metrics);
    store.add({
      at: snapshot.at,
      scenario: snapshot.scenario,
      env: snapshot.env,
      score: r.score,
      decision: r.decision,
      metrics: snapshot.metrics
    });
    refreshUI();
  }

  function refreshUI(){
    const all = store.load();
    ui.rCount.textContent = all.length;

    if(!all[0]){
      ui.rScore.textContent = "—";
      ui.rDecision.textContent = "—";
      ui.rSummary.textContent = "لا توجد جلسات";
      return;
    }

    ui.rScore.textContent = all[0].score;
    ui.rDecision.textContent = all[0].decision;
    ui.rSummary.textContent =
      `سيناريو ${all[0].scenario} • ${all[0].env}`;
  }

  function exportHTML(){
    const all = store.load();
    let html = `<h1>SpeakXR Report</h1>`;
    all.forEach(s=>{
      html += `<p><b>${s.at}</b> — ${s.score}/100 — ${s.decision}</p>`;
    });
    downloadText("SpeakXR_Report.html", html);
  }

  function exportJSON(){
    downloadJSON("SpeakXR_Report.json", store.load());
  }

  function wipe(){
    store.wipe();
    refreshUI();
  }

  return {
    save,
    refreshUI,
    exportHTML,
    exportJSON,
    wipe
  };
}
