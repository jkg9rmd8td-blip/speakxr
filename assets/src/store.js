// /src/store.js
// SpeakXR X-Stage PRO — LocalStorage store for sessions + settings

const KEY_SESSIONS = "speakxr_xstage_pro_sessions_v2";
const KEY_SETTINGS = "speakxr_xstage_pro_settings_v2";

export function createStore() {
  /* ---------------------------
     Sessions
  ---------------------------- */
  function getSessions() {
    try {
      const raw = localStorage.getItem(KEY_SESSIONS);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function setSessions(arr) {
    localStorage.setItem(KEY_SESSIONS, JSON.stringify(arr));
  }

  function addSession(session) {
    const nowIso = new Date().toISOString();
    const arr = getSessions();

    const normalized = {
      id: session.id || `S-${Date.now()}`,
      at: session.at || nowIso,
      scenario: session.scenario || "—",
      env: session.env || "—",
      score: Number.isFinite(session.score) ? session.score : 0,
      decision: session.decision || "—",
      summary: session.summary || "",
      payload: session.payload || null,
    };

    // newest first
    arr.unshift(normalized);

    // cap to prevent huge localStorage usage
    if (arr.length > 120) arr.length = 120;

    setSessions(arr);
    return normalized;
  }

  function removeSession(id) {
    const arr = getSessions().filter((s) => s.id !== id);
    setSessions(arr);
    return arr;
  }

  function clear() {
    localStorage.removeItem(KEY_SESSIONS);
  }

  /* ---------------------------
     Settings (optional)
  ---------------------------- */
  function getSettings() {
    try {
      const raw = localStorage.getItem(KEY_SETTINGS);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }

  function setSettings(obj) {
    const safe = obj && typeof obj === "object" ? obj : {};
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(safe));
  }

  function patchSettings(partial) {
    const current = getSettings();
    const next = { ...current, ...(partial || {}) };
    setSettings(next);
    return next;
  }

  function resetSettings() {
    localStorage.removeItem(KEY_SETTINGS);
  }

  return {
    // sessions
    getSessions,
    addSession,
    removeSession,
    clear,
    // settings
    getSettings,
    setSettings,
    patchSettings,
    resetSettings,
  };
}
