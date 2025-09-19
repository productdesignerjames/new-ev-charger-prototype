(function(){
  const IMPROVE_HINTS=[
    'Try better lighting.',
    'Step back to capture more context.',
    'Hold the camera steady.',
    'Avoid reflections or glare.'
  ];
  const SEL={
    step:'.upload-card__step',
    title:'.upload-card__title',
    desc:'.upload-card__desc',
    hint:'.upload-card__hint',
    btn:'.upload-card__primary',
    file:'.upload-card__file',
    thumb:'.upload-card__thumb',
    progressValue:'.progress-ring__value',
    fills:'.progress-ring__fill',
    ring:'.progress-ring',
    del:'.upload-card__delete'
  };
  document.querySelectorAll('.upload-card').forEach(initCard);
  function initCard(card){
    q(card,SEL.step).textContent=`${card.dataset.step||'?'}\/${card.dataset.total||'?'}`;
    q(card,SEL.title).textContent=card.dataset.label||'';
    q(card,SEL.desc).textContent=card.dataset.description||'';
    card.dataset.state='initial';card.dataset.hasImage='false';
    setPrimary(card,'Upload photo');
    q(card,SEL.btn).addEventListener('click',()=>{
      const s=card.dataset.state;
      if(s==='initial'||s.startsWith('result-')) triggerFile(card);
      if(s==='result-pass'){ setState(card,'completed'); setPrimary(card,''); }
    });
    q(card,SEL.file).addEventListener('change',e=>{
      if(!e.target.files.length)return;
      handleFile(card,e.target.files[0]);
    });
    q(card,SEL.del).addEventListener('click',()=>reset(card));
  }
  function triggerFile(card){ q(card,SEL.file).click(); }
  function handleFile(card,file){
    const img=q(card,SEL.thumb);
    if(img.dataset.objectUrl){ URL.revokeObjectURL(img.dataset.objectUrl); }
    const url=URL.createObjectURL(file);
    img.dataset.objectUrl=url;
    img.alt=`${card.dataset.label||'Uploaded'} photo`;
    card.dataset.hasImage='true';
    card._deferred=true;
    setState(card,'progress');
    simulateProgress(card,()=>{
      setState(card,'analysing');
      simulateAI(card);
    });
  }
  function simulateProgress(card,done){
    const value=q(card,SEL.progressValue);
    const fills=card.querySelectorAll(SEL.fills);
    const ring=q(card,SEL.ring);
    let p=0;
    function upd(v){
      value.textContent=`${v}%`;
      const deg=Math.min(v,50)/50*180;
      fills[0].style.transform=`rotate(${deg}deg)`;
      if(v>50){
        ring.dataset.over50='true';
        fills[1].style.transform=`rotate(${(v-50)/50*180}deg)`;
      }else{
        ring.dataset.over50='false';
        fills[1].style.transform='rotate(0deg)';
      }
    }
    upd(0);
    const int=setInterval(()=>{
      p+=Math.floor(Math.random()*12)+5;
      if(p>=100)p=100;
      upd(p);
      if(p===100){ clearInterval(int); setTimeout(done,350); }
    },200);
  }
  function simulateAI(card){
    setTimeout(()=>{
      const r=Math.random();
      let rs;
      if(r<0.5)rs='result-pass';
      else if(r<0.7)rs='result-retry';
      else if(r<0.9)rs='result-improve';
      else rs='result-failure';
      reveal(card);
      applyResult(card,rs);
    },900+Math.random()*1200);
  }
  function reveal(card){
    if(!card._deferred)return;
    const img=q(card,SEL.thumb);
    if(img.dataset.objectUrl) img.src=img.dataset.objectUrl;
    card._deferred=false;
  }
  function applyResult(card,res){
    const hint=q(card,SEL.hint); hint.textContent='';
    switch(res){
      case 'result-pass': setPrimary(card,'Next photo'); break;
      case 'result-retry': setPrimary(card,'Try again'); break;
      case 'result-improve': hint.textContent=pick(IMPROVE_HINTS); setPrimary(card,'Retake photo'); break;
      case 'result-failure': setPrimary(card,'Re-upload photo'); break;
    }
    setState(card,res);
  }
  function reset(card){
    const f=q(card,SEL.file); f.value='';
    const img=q(card,SEL.thumb);
    if(img.dataset.objectUrl){ URL.revokeObjectURL(img.dataset.objectUrl); delete img.dataset.objectUrl; }
    img.removeAttribute('src'); img.alt='';
    card.dataset.hasImage='false'; card._deferred=false;
    q(card,SEL.hint).textContent='';
    setPrimary(card,'Upload photo');
    setState(card,'initial');
  }
  function setPrimary(card,txt){
    const b=q(card,SEL.btn);
    if(!txt){ b.style.display='none'; }
    else { b.style.display='inline-flex'; b.textContent=txt; }
  }
  function setState(card,s){ card.dataset.state=s; if(s==='completed') setPrimary(card,''); }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function q(el,sel){ return el.querySelector(sel); }
})();
  }

  function maybeReveal(card){
    if (!card._deferred) return;
    const img = q(card, SEL.thumb);
    if (img.dataset.objectUrl){
      img.src = img.dataset.objectUrl;
    }
    card._deferred = false;
  }

  function presentResult(card, state){
    // Reveal thumbnail now
    maybeReveal(card);

    setState(card, state);
    const hint = q(card, SEL.hint);
    hint.textContent = '';
    switch(state){
      case 'result-pass':
        setPrimaryLabel(card,'Next photo');
        break;
      case 'result-retry':
        setPrimaryLabel(card,'Try again');
        break;
      case 'result-improve':
        hint.textContent = pick(IMPROVE_HINTS);
        setPrimaryLabel(card,'Retake photo');
        break;
      case 'result-failure':
        setPrimaryLabel(card,'Re-upload photo');
        break;
    }
  }

  function setState(card, state){
    card.dataset.state = state;
    if (state === 'completed'){
      setPrimaryLabel(card,'');
    }
  }

  function resetCard(card){
    const fileInput = q(card, SEL.file);
    fileInput.value = '';
    const img = q(card, SEL.thumb);
    if (img.dataset.objectUrl){
      URL.revokeObjectURL(img.dataset.objectUrl);
      delete img.dataset.objectUrl;
    }
    img.removeAttribute('src');
    img.alt = '';
    card.dataset.hasImage = 'false';
    card._deferred = false;
    q(card, SEL.hint).textContent = '';
    setPrimaryLabel(card,'Upload photo');
    setState(card,'initial');
  }

  function setPrimaryLabel(card, text){
    const btn = q(card, SEL.btn);
    if (!text){
      btn.style.display='none';
    } else {
      btn.style.display='inline-flex';
      btn.textContent = text;
    }
  }

  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function q(el, sel){ return el.querySelector(sel); }
})();
