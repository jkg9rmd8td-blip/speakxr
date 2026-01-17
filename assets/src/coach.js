export function createCoach(ui){
  let lastMsg = "";
  let active = false;

  function say(msg){
    if(msg === lastMsg) return;
    lastMsg = msg;
    ui.coachBox.textContent = msg;
  }

  function onSessionStart(){
    active = true;
    say("ابدأ بثقة… الجمهور معك 👀");
  }

  function onSessionStop(){
    active = false;
    say("انتهت الجلسة. راجع التقرير 📊");
  }

  function tick(m){
    if(!active) return;

    if(m.gateState === "صمت"){
      say("في صمت طويل… كمل الفكرة فورًا");
      return;
    }

    if(m.wpm > 175){
      say("سرعة عالية… هدّئ الإيقاع");
      return;
    }

    if(m.wpm < 100){
      say("الإيقاع بطيء… ارفع السرعة شوي");
      return;
    }

    if(m.energy < 45){
      say("الطاقة منخفضة… ارفع النبرة");
      return;
    }

    if(m.clarity < 55){
      say("الجملة غير واضحة… قصّرها");
      return;
    }

    if(m.energy > 75 && m.clarity > 70){
      say("أداء ممتاز 👏 كمل");
    }
  }

  return {
    onSessionStart,
    onSessionStop,
    tick
  };
}
