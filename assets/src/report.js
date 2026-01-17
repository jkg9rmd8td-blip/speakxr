// /src/report.js
// SpeakXR X-Stage PRO — Report engine (summary + exports HTML/JSON + executive + jury)

import { escapeHtml, formatArDate, downloadText } from "./core.js";

export function createReport(store) {
  /* ---------------------------
     Summaries
  ---------------------------- */
  function makeSummary(payload) {
    const m = payload?.metrics || {};
    const j = payload?.jury || {};
    const wpm = m.wpm ?? "—";
    const cl = m.clarity ?? "—";
    const en = m.energy ?? "—";
    const au = m.audience ?? "—";
    const sc = j.total ?? "—";
    return `WPM ${wpm} • Clarity ${cl} • Energy ${en} • Audience ${au} • Score ${sc}`;
  }

  function makeExecutiveSummary(sessions = []) {
    if (!sessions.length) {
      return "لا توجد جلسات محفوظة بعد. ابدأ جلسة ثم احفظها ليظهر الملخص التنفيذي.";
    }

    const best = sessions.reduce((a, s) => Math.max(a, Number(s.score || 0)), 0);
    const last = sessions[0];

    const grade =
      best >= 85 ? "Elite (جاهز للعرض الرسمي)" :
      best >= 70 ? "Pro (جاهز مع صقل بسيط)" :
      best >= 55 ? "Rising (تقدم جيد)" :
      "Starter (يلزم تدريب مكثف)";

    return [
      "ملخص تنفيذي — SpeakXR X-Stage PRO",
      `- عدد الجلسات: ${sessions.length}`,
      `- أفضل درجة: ${best}/100`,
      `- آخر جلسة: ${formatArDate(last.at)} — ${last.scenario} • ${last.env}`,
      "",
      `جاهزية العرض: ${grade}`,
      "",
      "توصيات تنفيذية سريعة:",
      "1) افتح بجملة قوية (10–12 كلمة) ثم مثال واحد.",
      "2) خفف الحشو: (يعني/اممم) أول 3 جمل.",
      "3) وقفة قصيرة قبل الرقم/الدليل ثم أكمل بثقة.",
      "4) اجعل الخاتمة: دعوة/قرار + جملة ختامية واحدة.",
    ].join("\n");
  }

  /* ---------------------------
     Export: JSON
  ---------------------------- */
  function exportJSON(sessions = []) {
    return JSON.stringify(
      { generatedAt: new Date().toISOString(), sessions },
      null,
      2
    );
  }

  /* ---------------------------
     Export: HTML (Sessions)
  ---------------------------- */
  function exportHTML(sessions = [], opts = {}) {
    const title = opts.title || "SpeakXR X-Stage PRO — Report";

    const rows = sessions
      .map((s) => {
        return `
        <tr>
          <td>${escapeHtml(formatArDate(s.at))}</td>
          <td>${escapeHtml(s.scenario)}</td>
          <td>${escapeHtml(s.env)}</td>
          <td><b>${escapeHtml(String(s.score))}</b></td>
          <td>${escapeHtml(s.decision || "")}</td>
          <td>${escapeHtml(s.summary || "")}</td>
        </tr>`;
      })
      .join("");

    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:Tahoma,Arial;background:#070815;color:#fff;padding:18px}
  h1{margin:0 0 10px;font-size:22px}
  .meta{opacity:.75;margin-bottom:12px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px}
  table{width:100%;border-collapse:collapse;margin-top:12px}
  th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.12);text-align:right;vertical-align:top}
  th{color:rgba(255,255,255,.75)}
  .empty{opacity:.7;padding:16px}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">تم التوليد: ${escapeHtml(new Date().toLocaleString("ar-SA"))}</div>

  <div class="card">
    <div><b>عدد الجلسات:</b> ${sessions.length}</div>
    <div style="margin-top:6px"><b>ملخص تنفيذي:</b></div>
    <pre style="white-space:pre-wrap;line-height:1.8;opacity:.9">${escapeHtml(makeExecutiveSummary(sessions))}</pre>
  </div>

  <div class="card" style="margin-top:12px">
    <table>
      <thead>
        <tr>
          <th>الوقت</th>
          <th>السيناريو</th>
          <th>البيئة</th>
          <th>الدرجة</th>
          <th>القرار</th>
          <th>الملخص</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td class="empty" colspan="6">لا توجد بيانات بعد</td></tr>`}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  }

  /* ---------------------------
     Export: Jury HTML (single)
  ---------------------------- */
  function exportJuryHTML(jury, state) {
    const title = "SpeakXR X-Stage PRO — Jury Board";
    const s = state || {};
    const j = jury || {};

    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:Tahoma,Arial;background:#070815;color:#fff;padding:18px}
  h1{margin:0 0 10px;font-size:22px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;margin-top:12px}
  .row{display:flex;gap:12px;flex-wrap:wrap}
  .pill{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);margin-left:8px}
  .big{font-size:46px;font-weight:900}
  .muted{opacity:.75}
  ul{line-height:1.9}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="muted">تم التوليد: ${escapeHtml(new Date().toLocaleString("ar-SA"))}</div>

  <div class="card">
    <div class="row">
      <div class="pill">Scenario: ${escapeHtml(s.scenario || "—")}</div>
      <div class="pill">Env: ${escapeHtml(s.env || "—")}</div>
      <div class="pill">Mode: ${escapeHtml(s.coachMode || "—")}</div>
    </div>
    <div style="margin-top:12px">
      <div class="big">${escapeHtml(String(j.total ?? "—"))}/100</div>
      <div style="margin-top:6px"><b>Decision:</b> ${escapeHtml(j.decision || "—")} (${escapeHtml(j.level || "—")})</div>
      <div class="muted" style="margin-top:6px">WPM: ${escapeHtml(String(j.wpm ?? "—"))} • Clarity: ${escapeHtml(String(j.clarity ?? "—"))} • Energy: ${escapeHtml(String(j.energy ?? "—"))} • Audience: ${escapeHtml(String(j.audienceScore ?? "—"))} • Fillers: ${escapeHtml(String(j.fillers ?? "—"))}</div>
    </div>
  </div>

  <div class="card">
    <b>ملاحظات (اختياري):</b>
    <ul>
      <li>حافظ على بداية قوية + مثال واحد فقط.</li>
      <li>قلّل الحشو، وخذ وقفة صغيرة قبل الدليل.</li>
      <li>نبرة ثابتة + نهاية: قرار/دعوة واضحة.</li>
    </ul>
  </div>
</body>
</html>`;
  }

  /* ---------------------------
     Export: Executive HTML
  ---------------------------- */
  function exportExecutiveHTML(sessions = []) {
    const title = "SpeakXR X-Stage PRO — Executive Summary";
    const text = makeExecutiveSummary(sessions);

    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:Tahoma,Arial;background:#070815;color:#fff;padding:18px}
  h1{margin:0 0 10px;font-size:22px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px}
  pre{white-space:pre-wrap;line-height:1.9}
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="card">
    <div style="opacity:.75">تم التوليد: ${escapeHtml(new Date().toLocaleString("ar-SA"))}</div>
    <pre>${escapeHtml(text)}</pre>
  </div>
</body>
</html>`;
  }

  /* ---------------------------
     Utility: download
  ---------------------------- */
  function download(filename, content, mime = "text/html;charset=utf-8") {
    downloadText(filename, content, mime);
  }

  /* ---------------------------
     Convenience: last HTML stub
  ---------------------------- */
  function exportLastHTMLOrStub(appState, juryObj) {
    const sessions = store?.getSessions ? store.getSessions() : [];
    if (sessions.length) return exportHTML(sessions, { title: "SpeakXR X-Stage PRO — Report" });

    // stub if no sessions saved yet
    const title = "SpeakXR X-Stage PRO — Quick Report";
    const s = appState || {};
    const j = juryObj || {};
    return `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>
body{font-family:Tahoma,Arial;background:#070815;color:#fff;padding:18px}
.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px;margin-top:12px}
.big{font-size:44px;font-weight:900}
.muted{opacity:.75}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="muted">تم التوليد: ${escapeHtml(new Date().toLocaleString("ar-SA"))}</div>

<div class="card">
  <div><b>Scenario:</b> ${escapeHtml(s.scenario || "—")}</div>
  <div><b>Env:</b> ${escapeHtml(s.env || "—")}</div>
</div>

<div class="card">
  <div class="big">${escapeHtml(String(j.total ?? "—"))}/100</div>
  <div style="margin-top:6px"><b>Decision:</b> ${escapeHtml(j.decision || "—")} (${escapeHtml(j.level || "—")})</div>
  <div class="muted" style="margin-top:6px">WPM ${escapeHtml(String(j.wpm ?? "—"))} • Clarity ${escapeHtml(String(j.clarity ?? "—"))} • Energy ${escapeHtml(String(j.energy ?? "—"))} • Audience ${escapeHtml(String(j.audienceScore ?? "—"))}</div>
</div>

<div class="card">
  <b>ماذا بعد؟</b>
  <div class="muted" style="margin-top:6px;line-height:1.9">
    ابدأ جلسة من تبويب المسرح ثم اضغط “حفظ” لتخزين الجلسة وعرض التقارير كاملة.
  </div>
</div>
</body></html>`;
  }

  return {
    makeSummary,
    makeExecutiveSummary,
    exportJSON,
    exportHTML,
    exportJuryHTML,
    exportExecutiveHTML,
    exportLastHTMLOrStub,
    download,
  };
}
