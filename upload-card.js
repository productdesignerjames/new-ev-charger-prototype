/**
 * Upload Card Prototype – Design Parity Scaffold
 *
 * Comparison to supplied design screenshot:
 * ✔ States modelled: initial, progress, analysing, result-pass|improve|retry|failure, completed
 * ✔ Primary button label variance
 * ✔ Delete (remove) action & replace on click area
 * ✔ Hint / feedback line (single line)
 * ✔ Lock image on completed (button hidden)
 * ✖ Fine visual polish (exact spacing, typography scale) – defer to design system
 * ✖ AI quality / description logic – stubbed
 * ✖ Real accessibility copy / dynamic ARIA messaging improvements (basic polite live region only)
 * ✖ Drag & drop, camera capture UI, multi-image sequencing – out of scope for parity stub
 *
 * Extend later: plug real analysis → call setState(result-*).
 */
(function(){
  "use strict";

  const CONFIG = {
    backend: {
      enabled: true,              // set false to force local simulation
      qualityEndpoint: "/api/quality", // POST (multipart) => { decision, hints? }
      uploadEndpoint: "/api/upload",   // optional second POST to persist (set to null to skip)
      timeoutMs: 8000
    },
    progressTickMs: 170
  };

  const STATE_DECISION_MAP = {
    pass: 'result-pass',
    improve: 'result-improve',
    retry: 'result-retry',
    failure: 'result-failure'
  };

  const FALLBACK_HINTS = [
    "Improve lighting.",
    "Hold device steady.",
    "Step back for wider context.",
    "Avoid strong reflections."
  ];

  const SEL = {
    card: '.upload-card',
    media: '.upload-card__media',
    thumb: '.upload-card__thumb',
    file: '.upload-card__file',
    primary: '.upload-card__primary',
    deleteBtn: '.upload-card__delete',
    hint: '.upload-card__hint',
    ring: '.progress-ring',
    ringVal: '.progress-ring__value',
    ringFill: '.progress-ring__fill'
  };

  document.querySelectorAll(SEL.card).forEach(initCard);

  function initCard(card){
    if(card._init) return;
    card._init = true;
    card.dataset.state = 'initial';
    setPrimary(card,'Upload photo');

    const hint = q(card,SEL.hint);
    if(hint && !hint.getAttribute('aria-live')){
      hint.setAttribute('aria-live','polite');
      hint.setAttribute('role','status');
    }

    on(q(card,SEL.primary),'click',()=>{
      const s = state(card);
      if(s==='initial' || s.startsWith('result-')) triggerFile(card);
      if(s==='result-pass'){
        setState(card,'completed');
        setPrimary(card,'');
      }
    });
    on(q(card,SEL.media),'click',()=>{
      if(state(card)==='completed') return;
      triggerFile(card);
    });
    on(q(card,SEL.file),'change',e=>{
      if(!e.target.files.length) return;
      handleFile(card, e.target.files[0]);
    });
    on(q(card,SEL.deleteBtn),'click',e=>{
      e.stopPropagation();
      reset(card);
    });
  }

  function triggerFile(card){ q(card,SEL.file)?.click(); }

  function handleFile(card,file){
    reset(card,false);
    revoke(card);
    const img = q(card,SEL.thumb);
    const url = URL.createObjectURL(file);
    img.dataset.objectUrl = url;
    img.removeAttribute('src'); // defer
    img.alt = file.name || 'Uploaded photo';
    card._analysisToken = Symbol();
    card._file = file;
    card._deferred = true;
    setState(card,'progress');
    setPrimary(card,''); // hide during progress
    runProgress(card, ()=> {
      if(!valid(card)) return;
      reveal(card);
      setState(card,'analysing');
      analyse(card,file);
    });
  }

  /******** Progress ********/
  function runProgress(card,done){
    const val = q(card,SEL.ringVal);
    const fills = card.querySelectorAll(SEL.ringFill);
    const ring = q(card,SEL.ring);
    let p=0, stop=false;
    card._cancelProgress = ()=>{ stop=true; };
    draw(0);
    (function tick(){
      if(stop) return;
      p += Math.floor(Math.random()*13)+7;
      if(p>=100) p=100;
      draw(p);
      if(p===100){
        setTimeout(()=>{ if(!stop) done(); },260);
      } else {
        setTimeout(tick, CONFIG.progressTickMs);
      }
    })();
    function draw(v){
      if(val) val.textContent = v+'%';
      if(!fills[0]) return;
      const deg = Math.min(v,50)/50*180;
      fills[0].style.transform = `rotate(${deg}deg)`;
      if(ring && fills[1]){
        if(v>50){
          ring.dataset.over50='true';
          fills[1].style.transform = `rotate(${(v-50)/50*180}deg)`;
        } else {
          ring.dataset.over50='false';
          fills[1].style.transform = 'rotate(0deg)';
        }
      }
    }
  }

  /******** Backend analysis ********/
  async function analyse(card,file){
    if(!CONFIG.backend.enabled){
      return simulate(card);
    }
    try{
      const quality = await postFile(CONFIG.backend.qualityEndpoint,file);
      if(!valid(card)) return;
      let decision = quality.decision || 'improve';
      let hints = quality.hints || [];
      // Optionally upload/persist if pass
      if(decision==='pass' && CONFIG.backend.uploadEndpoint){
        try { await postFile(CONFIG.backend.uploadEndpoint,file); }
        catch { /* ignore store error */ }
      }
      applyDecision(card, decision, hints);
    }catch(e){
      if(!valid(card)) return;
      simulate(card,true);
    }
  }

  function simulate(card, fromError=false){
    // Simple deterministic heuristic fallback
    const imgEl = q(card,SEL.thumb);
    const decision = fromError ? 'retry' : pick(['pass','improve','retry','pass','improve']);
    const hints = (decision==='pass')
      ? ['Looks good']
      : [pick(FALLBACK_HINTS)];
    applyDecision(card, decision, hints);
  }

  function applyDecision(card, decision, hints){
    const mapped = STATE_DECISION_MAP[decision] || 'result-improve';
    const hintEl = q(card,SEL.hint);
    if(hintEl) hintEl.textContent = hints[0] || (mapped==='result-pass'?'Looks good':'Retake for better quality');
    switch(mapped){
      case 'result-pass': setPrimary(card,'Next photo'); break;
      case 'result-improve': setPrimary(card,'Retake photo'); break;
      case 'result-retry': setPrimary(card,'Try again'); break;
      case 'result-failure': setPrimary(card,'Re-upload photo'); break;
    }
    setState(card,mapped);
  }

  /******** HTTP helper ********/
  async function postFile(url,file){
    const ac = new AbortController();
    const t = setTimeout(()=>ac.abort(), CONFIG.backend.timeoutMs);
    const fd = new FormData();
    fd.append('image', file, file.name);
    const res = await fetch(url,{ method:'POST', body:fd, signal:ac.signal });
    clearTimeout(t);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  /******** Reset / reveal ********/
  function reset(card,clearFile=true){
    if(card._cancelProgress) card._cancelProgress();
    card._analysisToken = null;
    const img = q(card,SEL.thumb);
    if(clearFile){
      const file = q(card,SEL.file);
      if(file) file.value='';
    }
    if(img){
      if(img.dataset.objectUrl){
        URL.revokeObjectURL(img.dataset.objectUrl);
        delete img.dataset.objectUrl;
      }
      img.removeAttribute('src');
      img.alt='';
    }
    const hint = q(card,SEL.hint);
    if(hint) hint.textContent='';
    setPrimary(card,'Upload photo');
    setState(card,'initial');
  }

  function reveal(card){
    if(!card._deferred) return;
    const img = q(card,SEL.thumb);
    if(img?.dataset.objectUrl) img.src = img.dataset.objectUrl;
    card._deferred=false;
  }

  /******** State helpers ********/
  function setState(card,s){
    card.dataset.state = s;
    if(s==='completed') setPrimary(card,'');
  }
  function setPrimary(card,txt){
    const b=q(card,SEL.primary);
    if(!b) return;
    if(!txt){ b.style.display='none'; }
    else { b.style.display='inline-flex'; b.textContent=txt; }
  }
  function state(card){ return card.dataset.state || 'initial'; }
  function valid(card){ return !!card._analysisToken; }

  /******** Utils ********/
  function q(el,sel){ return el?.querySelector(sel); }
  function on(el,ev,fn){ el && el.addEventListener(ev,fn); }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function revoke(card){
    const img = q(card,SEL.thumb);
    if(img?.dataset.objectUrl){
      URL.revokeObjectURL(img.dataset.objectUrl);
      delete img.dataset.objectUrl;
    }
  }

  // Debug
  window.uploadCardBackendDemo = {
    simulateAll:()=>document.querySelectorAll(SEL.card).forEach(c=>applyDecision(c,pick(Object.keys(STATE_DECISION_MAP)),['debug'])),
    config: CONFIG
  };
})();
  function mergeDecision(heur, backend){
    if(!backend) return { state: mapDecision(heur.decision), hints: heur.hints.length?heur.hints:[pick(HINTS)] };
    // Simple weight: backend wins unless heuristic says retry (exposure) and backend says pass
    if(heur.decision==='retry' && backend.decision==='pass'){
      return { state:'result-improve', hints:['Exposure concerns. Retake clearer photo.'] };
    }
    return { state: mapDecision(backend.decision), hints:(backend.hints.length?backend.hints:heur.hints).slice(0,1) };
  }

  function mapDecision(d){
    switch(d){
      case 'pass': return 'result-pass';
      case 'improve': return 'result-improve';
      case 'retry': return 'result-retry';
      case 'failure': return 'result-failure';
      default: return 'result-improve';
    }
  }

  /******** Apply Result ********/
  function applyResult(card,state,hints,token){
    if(!validToken(card,token)) return;
    const hintEl = q(card,SEL.hint);
    if(hintEl){
      hintEl.textContent = (hints && hints[0]) || (state==='result-pass'?'Looks good':'Review & retake');
    }
    switch(state){
      case 'result-pass': setPrimary(card,'Next photo'); break;
      case 'result-improve': setPrimary(card,'Retake photo'); break;
      case 'result-retry': setPrimary(card,'Try again'); break;
      case 'result-failure': setPrimary(card,'Re-upload photo'); break;
    }
    setState(card,state);
  }

  /******** Reset / Reveal ********/
  function reset(card){
    cancelProgress(card);
    revokeURL(card);
    const img=q(card,SEL.thumb);
    if(img){
      img.removeAttribute('src');
      img.alt='';
      delete img.dataset.objectUrl;
    }
    setText(q(card,SEL.hint),'');
    card.dataset.state='initial';
    setPrimary(card,'Upload photo');
  }

  function reveal(card){
    if(!card._deferred) return;
    const img=q(card,SEL.thumb);
    if(img?.dataset.objectUrl) img.src=img.dataset.objectUrl;
    card._deferred=false;
  }

  function revokeURL(card){
    const img=q(card,SEL.thumb);
    if(img?.dataset.objectUrl){
      URL.revokeObjectURL(img.dataset.objectUrl);
    }
  }

  /******** UI helpers ********/
  function setState(card,s){
    card.dataset.state=s;
    if(s==='completed') setPrimary(card,'');
  }
  function setPrimary(card,txt){
    const b=q(card,SEL.primary);
    if(!b) return;
    if(!txt){ b.style.display='none'; }
    else { b.style.display='inline-flex'; b.textContent=txt; }
  }

  /******** Utils ********/
  function q(el,sel){ return el?.querySelector(sel); }
  function on(el,ev,fn){ el && el.addEventListener(ev,fn); }
  function setText(el,t){ if(el) el.textContent=t; }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function tokens(str){
    return new Set((str||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ')
      .split(/\s+/).filter(Boolean));
  }
  function loadImage(url){
    return new Promise((res,rej)=>{
      const i=new Image();
      i.onload=()=>res(i);
      i.onerror=rej;
      i.src=url;
    });
  }

  // Debug hook
  window.uploadCardDebug = {
    version:'proto-qa',
    forceState:(s)=>document.querySelectorAll(SEL.card).forEach(c=>setState(c,s)),
    config: CONFIG
  };
})();
      const i=new Image();
      i.onload=()=>res(i);
      i.onerror=rej;
      i.src=url;
    });
  }

  // Expose debug
  window._uploadCard = {
    resetAll: ()=>document.querySelectorAll(SEL.card).forEach(reset),
    version: '1.0.0'
  };

  // Duplicate STOP and tokenize declarations removed (original versions defined earlier).
  // Removed redundant loadImage/tokenize block that caused 'Cannot redeclare block-scoped variable "STOP"' errors.

  // Expose minimal debugging hook
  window._uploadCardDebug = {
    CONFIG,
    simulateAll:()=>document.querySelectorAll(SEL.card).forEach(c=>console.log(c.dataset))
  };

  function on(el,ev,fn){ if(el) el.addEventListener(ev,fn); }
  function set(el,t){ if(el) el.textContent=t; }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
  function clamp(v,a,b){ return Math.min(b,Math.max(a,v)); }
  function norm(v,min,max){ return clamp((v-min)/(max-min),0,1); }
  function loadImage(url){
    return new Promise((res,rej)=>{
      const i=new Image();
      i.onload=()=>res(i);
      i.onerror=rej;
      i.src=url;
    });
  }

  /**********************
   * BACKEND STUB (optional example)
   * Example Express handler (NOT in browser):
   *
   * app.post('/quality/analyse', upload.single('image'), async (req,res)=>{
   *   // Run real ML model / external service here
   *   return res.json({
   *     scores:{ sharpness:0.72, exposure:0.84, overall:0.8 },
   *     decision:'improve', // pass | improve | retry | failure
   *     hints:['Step back slightly for wider context.'],
   *     confidence:0.76
   *   });
   * });
   **********************/


