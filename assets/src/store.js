const KEY = "speakxr_sessions_v1";

export function createStore(){
  function load(){
    try{
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    }catch{
      return [];
    }
  }

  function save(list){
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function add(item){
    const all = load();
    all.unshift(item);
    save(all.slice(0,50));
  }

  function wipe(){
    localStorage.removeItem(KEY);
  }

  return { load, add, wipe };
}
