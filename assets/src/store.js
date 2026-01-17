const KEY = "speakxr_xstage_pro_sessions_v1";

export function createStore(){
  function getSessions(){
    try{
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }

  function setSessions(arr){
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  function addSession(s){
    const arr = getSessions();
    arr.unshift({
      id: `S-${Date.now()}`,
      ...s
    });
    // keep up to 80 sessions
    if(arr.length > 80) arr.length = 80;
    setSessions(arr);
    return arr[0];
  }

  function clear(){
    localStorage.removeItem(KEY);
  }

  return { getSessions, addSession, clear };
}
