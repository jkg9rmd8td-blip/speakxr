// /src/report.js — SpeakXR X-Stage PRO
// Build summaries + export HTML/JSON + export Executive + export Jury + download helper.

export function createReport(store){

  function makeSummary(payload){
    const j = payload.jury;
    const m = payload.metrics;
    return `WPM ${m.wpm ?? "—"} • Clarity ${m.clarity} • Energy ${m.energy} • Audience ${m.audience} • Score ${j.total}`;
  }

  function makeExecutiveSummary(sessions){
    if(!sessions.length){
      return "لا توجد جلسات محفوظة بعد. ابدأ جلسة ثم احفظها ليظهر الملخص التنفيذي.";
    }
    const best = sessions.reduce((a,s)=>Math.max(a, s.score||0), 0);
    const last = sessions[0];
    return [
      `ملخص تنفيذي (SpeakXR X-Stage PRO)`,
      `- عدد الجلسات: ${sessions.length}`,
      `- أفضل درجة: ${best}/100`,
      `- آخر جلسة: ${new Date(last.at).toLocaleString("ar-SA")} — ${last.scenario} • ${last.env}`,
      ``,
      `جاهزية العرض: ${best>=85 ? "Elite (عرض فوري)" : best>=70 ? "Pro (صقل بسيط)" : "Rising (تدريب إضافي)"}`,
      ``,
      `توصيات مركزة:`,
      `1) افتح بجملة "عناوين" ثم ادخل المثال`,
      `2) قلل الحشو (يعني/اممم) في أول 20 ثانية`,
      `3) اجعل كل فكرة: (سبب → مثال → نتيجة)`,
    ].join("\n");
  }

  function exportJSON(sessions){
    return JSON.stringify({ generatedAt: new Date().toISOString(), sessions }, null, 2);
  }

  function exportHTML(sessions, opts={}){
    const title = opts.title || "SpeakXR Report";
    const rows = sessions.map(s=>`
      <tr>
        <td>${new Date(s.at).toLocaleString("ar-SA")}</td>
        <td>${escapeHtml(s.scenario)}</td>
        <td>${escapeHtml(s.env)}</td>
        <td><b>${escapeHtml(String(s.score))}</b></td>
        <td>${escapeHtml(s.decision || "")}</td>
        <td>${escapeHtml(s.summary || "")}</td>
      </tr>
    `).join("");

    return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:Tahoma,Arial;background:#0b1020;color:#fff;padding:18px}
  h1{margin:0 0 10px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.12);text-align:right;vertical-align:top}
  th{color:rgba(255,255,255,.75)}
  .muted{color:rgba(255,255,255,.70);line-height:1.85}
</style>
</head><body>
<h1>${escapeHtml(title)}</h1>

<div class="grid">
  <div class="card">
    <div class="muted">تم التوليد: ${new Date().toLocaleString("ar-SA")}</div>
    <div class="muted">عدد الجلسات: ${sessions.length}</div>
  </div>
  <div class="card">
    <div class="muted">ملاحظة: البيانات محفوظة محليًا على الجهاز (LocalStorage) لأغراض العرض والنمذجة.</div>
  </div>
</div>

<div class="card" style="margin-top:12px">
  <table>
    <thead>
      <tr><th>الوقت</th><th>السيناريو</th><th>البيئة</th><th>الدرجة</th><th>القرار</th><th>الملخص</th></tr>
    </thead>
    <tbody>${rows || "<tr><td colspan='6'>لا توجد بيانات</td></tr>"}</tbody>
  </table>
</div>

</body></html>`;
  }

  function exportExecutiveHTML(sessions){
    const text = makeExecutiveSummary(sessions);
    return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SpeakXR Executive</title>
<style>
  body{font-family:Tahoma,Arial;background:#0b1020;color:#fff;padding:18px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px}
  pre{white-space:pre-wrap;line-height:1.9}
</style>
</head><body>
<h1>SpeakXR — ملخص تنفيذي</h1>
<div class="card"><pre>${escapeHtml(text)}</pre></div>
</body></html>`;
  }

  function exportJuryHTML(j, state){
    return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SpeakXR Jury</title>
<style>
  body{font-family:Tahoma,Arial;background:#0b1020;color:#fff;padding:18px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px}
  .big{grid-column:1/-1}
  .muted{color:rgba(255,255,255,.72);line-height:1.9}
  .score{font-size:42px;font-weight:800}
  .bar{height:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:999px;overflow:hidden;margin-top:10px}
  .bar i{display:block;height:100%;width:${j.total}%;background:linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.92), rgba(168,85,247,.90))}
</style>
</head><body>
<h1>SpeakXR — تقرير التحكيم</h1>

<div class="grid">
  <div class="card">
    <div class="muted">السيناريو</div>
    <div><b>${escapeHtml(state.scenario || "")}</b></div>
    <div class="muted" style="margin-top:6px">البيئة</div>
    <div><b>${escapeHtml(state.env || "")}</b></div>
  </div>

  <div class="card">
    <div class="muted">المؤشرات</div>
    <div class="muted">WPM: <b>${escapeHtml(String(j.wpm))}</b></div>
    <div class="muted">Clarity: <b>${escapeHtml(String(j.clarity))}</b></div>
    <div class="muted">Energy: <b>${escapeHtml(String(j.energy))}</b></div>
    <div class="muted">Audience: <b>${escapeHtml(String(j.audienceScore))}</b></div>
    <div class="muted">Fillers: <b>${escapeHtml(String(j.fillers))}</b></div>
  </div>

  <div class="card big">
    <div class="muted">الدرجة النهائية</div>
    <div class="score">${j.total}/100</div>
    <div class="bar"><i></i></div>
    <div style="margin-top:10px"><b>${escapeHtml(j.decision)}</b> <span class="muted">(${escapeHtml(j.level)})</span></div>
    <div class="muted" style="margin-top:10px">Note Boost: ${escapeHtml(String(j.noteBoost ?? 0))}</div>
  </div>
</div>

</body></html>`;
  }

  function exportLastHTMLOrStub(state, jury){
    // used from demo "download report" even when no sessions stored yet
    const payload = {
      at: new Date().toISOString(),
      scenario: state.scenario,
      env: state.env,
      metrics: state.metrics,
      jury
    };
    const sessions = store?.getSessions ? store.getSessions() : [];
    const html = exportHTML(sessions.length ? sessions : [{
      at: payload.at,
      scenario: payload.scenario,
      env: payload.env,
      score: jury.total,
      decision: jury.decision,
      summary: makeSummary(payload),
      payload
    }], { title: "SpeakXR X-Stage PRO Report" });

    return html;
  }

  function download(filename, content, mime="text/html"){
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return {
    makeSummary,
    makeExecutiveSummary,
    exportJSON,
    exportHTML,
    exportExecutiveHTML,
    exportJuryHTML,
    exportLastHTMLOrStub,
    download,
  };
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
