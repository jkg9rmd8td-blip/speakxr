const KEY = "speakxr_xstage_sessions_v1";

export function createStore(){
  function read(){
    try{
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }

  function write(arr){
    localStorage.setItem(KEY, JSON.stringify(arr));
  }

  function add(session){
    const all = read();
    all.unshift(session);
    if(all.length > 60) all.length = 60;
    write(all);
    return all;
  }

  function wipe(){
    localStorage.removeItem(KEY);
  }

  function stats(){
    const all = read();
    let best = null;
    for(const s of all){
      if(typeof s.score === "number"){
        best = best === null ? s.score : Math.max(best, s.score);
      }
    }
    return { count: all.length, best };
  }

  return { read, add, wipe, stats };
}
