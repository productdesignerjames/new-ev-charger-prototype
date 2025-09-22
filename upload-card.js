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

  const HAS_CAPTURE = 'capture' in document.createElement('input');
  if(!HAS_CAPTURE) document.documentElement.classList.add('no-capture');
  else document.documentElement.classList.add('uc-has-camera');

  const list = document.getElementById('photoList');
  const cards = list ? Array.from(list.querySelectorAll('.photo-card')) : [];
  const submitBtn = document.getElementById('submitPhotos');

  cards.forEach(initCard);
  initCarousel(cards);
  updateSubmit();

  function initCard(card){
    if(card._init) return;
    card._init = true;

    const fileInput = card.querySelector('.file-input');
    const galleryBtn = card.querySelector('.action-col--gallery .circle-upload');
    const cameraBtn  = card.querySelector('.action-col--camera .circle-camera');
    const box        = card.querySelector('.upload-box');
    const preview    = card.querySelector('.upload-preview');
    const removeBtn  = card.querySelector('.remove-photo');
    const status     = card.querySelector('.status');
    const guidanceToggle = card.querySelector('.guidance-toggle');
    const guidance   = card.querySelector('.guidance');

    guidanceToggle?.addEventListener('click',()=>{
      const exp = guidanceToggle.getAttribute('aria-expanded') === 'true';
      guidanceToggle.setAttribute('aria-expanded', String(!exp));
      if(guidance) guidance.hidden = exp;
    });

    galleryBtn?.addEventListener('click',()=>{
      prepare(fileInput,false);
      fileInput.click();
    });

    cameraBtn?.addEventListener('click',()=>{
      if(!HAS_CAPTURE) return;
      prepare(fileInput,true);
      fileInput.click();
    });

    box?.addEventListener('click', e=>{
      if(e.target===removeBtn) return;
      if(box.classList.contains('has-image')) return;
      prepare(fileInput,false);
      fileInput.click();
    });

    removeBtn?.addEventListener('click', e=>{
      e.stopPropagation();
      clearImage();
    });

    fileInput?.addEventListener('change',()=>{
      if(!fileInput.files || !fileInput.files.length) return;
      const f = fileInput.files[0];
      if(!/^image\/.+/.test(f.type)){
        fileInput.value='';
        setStatus('Unsupported file');
        return;
      }
      if(preview.dataset.objectUrl){
        URL.revokeObjectURL(preview.dataset.objectUrl);
      }
      const url = URL.createObjectURL(f);
      preview.dataset.objectUrl = url;
      preview.src = url;
      preview.alt = card.querySelector('.card-title')?.textContent || 'Photo';
      box.classList.add('has-image');
      setStatus('Added');
      updateSubmit();
    });

    function prepare(input,useCamera){
      if(!input) return;
      input.removeAttribute('capture');
      if(useCamera) input.setAttribute('capture','environment');
      input.accept='image/*';
    }
    function clearImage(){
      if(preview.dataset.objectUrl){
        URL.revokeObjectURL(preview.dataset.objectUrl);
        delete preview.dataset.objectUrl;
      }
      preview.removeAttribute('src');
      preview.alt='';
      box.classList.remove('has-image');
      fileInput.value='';
      setStatus('');
      updateSubmit();
    }
    function setStatus(msg){
      if(status) status.textContent = msg;
    }
  }

  function updateSubmit(){
    if(!submitBtn) return;
    const ok = cards
      .filter(c=>c.hasAttribute('data-required'))
      .every(c=>c.querySelector('.upload-box.has-image'));
    submitBtn.disabled = !ok;
  }

  function initCarousel(cards){
    const prev = document.querySelector('.nav-prev');
    const next = document.querySelector('.nav-next');
    if(!prev || !next) return;

    let idx = cards.findIndex(c=>c.classList.contains('is-active'));
    if(idx < 0) idx = 0;

    prev.addEventListener('click',()=>{ if(idx>0){ idx--; render(); }});
    next.addEventListener('click',()=>{ if(idx<cards.length-1){ idx++; render(); }});

    window.addEventListener('keydown',e=>{
      if(window.innerWidth > 869) return;
      if(e.key==='ArrowRight' && idx<cards.length-1){ idx++; render(); }
      if(e.key==='ArrowLeft' && idx>0){ idx--; render(); }
    });

    function render(){
      cards.forEach((c,i)=> c.classList.toggle('is-active', i===idx));
      prev.disabled = idx===0;
      next.disabled = idx===cards.length-1;
    }
    render();
  }

  // Debug helper
  window.photoUploadDebug = {
    cameraSupport: HAS_CAPTURE,
    list: ()=>cards.map(c=>({title:c.querySelector('.card-title')?.textContent, hasImage: !!c.querySelector('.upload-box.has-image')}))
  };
})();

  /* Progress animation */
  function simulateProgress(card,done){
    const ringVal = q(card,SEL.ringVal);
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
        setTimeout(()=>{ if(!stop) done(); },300);
      } else {
        setTimeout(tick, CONFIG.progressTickMs);
      }
    })();
    function draw(v){
      if(ringVal) ringVal.textContent=v+'%';
      if(!fills[0]) return;
      const deg = Math.min(v,50)/50*180;
      fills[0].style.transform=`rotate(${deg}deg)`;
      if(ring && fills[1]){
        if(v>50){
          ring.dataset.over50='true';
          fills[1].style.transform=`rotate(${(v-50)/50*180}deg)`;
        } else {
          ring.dataset.over50='false';
          fills[1].style.transform='rotate(0deg)';
        }
      }
    }
  }

  function cancelProgress(card){
    if(card._cancelProgress) card._cancelProgress();
    card._analysisToken=null;
  }

  /* Analysis */
  async function runAnalysis(card,file,token){
    try{
      const img = await loadImage(q(card,SEL.thumb).dataset.objectUrl);
      if(!valid(card) || token!==card._analysisToken) return;
      const heur = measureHeuristics(img, card);
      let backend=null;
      if(CONFIG.backend.enabled){
        try{
          backend = await backendQuality(file);
        }catch(e){
          backend=null;
        }
      }
      const { state:finalState, hint } = decide(heur, backend);
      applyResult(card, finalState, hint, token);
    }catch(e){
      if(!valid(card)) return;
      applyResult(card,'result-retry','Could not analyse – try again',token);
    }
  }

  function measureHeuristics(img, card){
    const t = CONFIG.heuristicResize;
    const scale = Math.min(1, t / img.naturalWidth);
    const w = Math.max(48, Math.round(img.naturalWidth*scale));
    const h = Math.max(48, Math.round(img.naturalHeight*scale));
    const c = document.createElement('canvas');
    c.width=w; c.height=h;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0,w,h);
    const {data} = ctx.getImageData(0,0,w,h);

    let over=0, under=0, sum=0;
    const gray=new Float32Array(w*h);
    for(let y=0,i=0,g=0;y<h;y++){
      for(let x=0;x<w;x++,i+=4,g++){
        const r=data[i],gch=data[i+1],b=data[i+2];
        const lum=0.2126*r+0.7152*gch+0.0722*b;
        sum+=lum;
        if(r>245&&gch>245&&b>245) over++;
        if(r<12&&gch<12&&b<12) under++;
        gray[g]=lum;
      }
    }
    let lapSum=0,count=0;
    for(let y=1;y<h-1;y++){
      for(let x=1;x<w-1;x++){
        const i=y*w+x;
        const lap = -gray[i-w]-gray[i-1]-gray[i+1]-gray[i+w] + 4*gray[i];
        lapSum += lap*lap; count++;
      }
    }
    const lapVar=lapSum/Math.max(1,count);
    const avgBrightness=sum/(w*h);
    const overPct=over/(w*h);
    const underPct=under/(w*h);

    // Preliminary
    let decision='pass';
    const hints=[];
    if(overPct>CONFIG.overLimit || underPct>CONFIG.underLimit){ decision='retry'; hints.push('Fix extreme exposure.'); }
    else if(lapVar<CONFIG.blurThreshold){ decision='improve'; hints.push('Reduce blur / hold still.'); }
    else if(avgBrightness<CONFIG.brightnessLow){ decision='improve'; hints.push('Increase lighting.'); }
    else if(avgBrightness>CONFIG.brightnessHigh){ decision='improve'; hints.push('Reduce glare.'); }

    // Minimal description token match (very loose)
    const reqTokens = tokens(card.dataset.description||'');
    let matchRatio = 1;
    if(reqTokens.size){
      // heuristic: assume partial fulfillment unless improved semantics added
      matchRatio = decision==='pass' ? 0.6 : 0.4;
      if(matchRatio < 0.3 && decision==='pass') decision='improve';
    }

    return {
      source:'heuristic',
      decision,
      hints,
      metrics:{lapVar, overPct, underPct, avgBrightness, match:matchRatio}
    };
  }

  async function backendQuality(file){
    const res = await postFile(CONFIG.backend.qualityEndpoint,file);
    return {
      source:'backend',
      decision:res.decision || 'improve',
      hints:res.hints || [],
      confidence:res.confidence ?? 0.7
    };
  }

  function decide(heur, backend){
    if(!backend){
      return { state: mapDecision(heur.decision), hint: heur.hints[0] || randomHint(heur.decision) };
    }
    // Merge: backend preferred except heuristic hard retry vs backend pass => degrade to improve
    if(heur.decision==='retry' && backend.decision==='pass'){
      return { state:'result-improve', hint:'Exposure concerns – retake clearer shot.' };
    }
    const chosen = backend.decision;
    const hint = (backend.hints[0]) || (heur.hints[0]) || randomHint(chosen);
    return { state: mapDecision(chosen), hint };
  }

  function mapDecision(d){ return STATE_MAP[d] || 'result-improve'; }

  function applyResult(card,state,hint,token){
    if(!valid(card) || token!==card._analysisToken) return;
    const hintEl = q(card,SEL.hint);
    if(hintEl) hintEl.textContent = hint || (state==='result-pass'?'Looks good':'Retake for clarity');
    switch(state){
      case 'result-pass': setPrimary(card,'Next photo'); break;
      case 'result-improve': setPrimary(card,'Retake photo'); break;
      case 'result-retry': setPrimary(card,'Try again'); break;
      case 'result-failure': setPrimary(card,'Re-upload photo'); break;
    }
    setState(card,state);
  }

  /* Reset / reveal */
  function reset(card){
    cancelProgress(card);
    card._analysisToken=null;
    const file=q(card,SEL.file);
    if(file) file.value='';
    revokeURL(card);
    const img=q(card,SEL.thumb);
    if(img){
      img.removeAttribute('src');
      img.alt='';
      delete img.dataset.objectUrl;
    }
    const hint=q(card,SEL.hint);
    if(hint) hint.textContent='';
    setPrimary(card,'Upload photo');
    setState(card,'initial');
  }

  function revokeURL(card){
    const img=q(card,SEL.thumb);
    if(img?.dataset.objectUrl){
      URL.revokeObjectURL(img.dataset.objectUrl);
      delete img.dataset.objectUrl;
    }
  }

  function reveal(card){
    if(!card._deferred) return;
    const img=q(card,SEL.thumb);
    if(img?.dataset.objectUrl) img.src=img.dataset.objectUrl;
    card._deferred=false;
  }

  function prepareFileInput(input,useCamera){
    // Always clear previous capture attr first to avoid caching weirdness
    input.removeAttribute('capture');
    if(useCamera) input.setAttribute('capture','environment');
    // Reassign accept in case altered (optional future proof)
    input.setAttribute('accept','image/*');
  }

  /* Backend multipart helper */
  async function postFile(url,file){
    const ac = new AbortController();
    const t = setTimeout(()=>ac.abort(), CONFIG.backend.timeoutMs);
    const fd = new FormData();
    fd.append('image',file,file.name);
    const res = await fetch(url,{ method:'POST', body:fd, signal:ac.signal });
    clearTimeout(t);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }

  /* State / UI utilities */
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
  function state(card){ return card.dataset.state || 'initial'; }
  function valid(card){ return !!card._analysisToken; }

  /* Generic utilities */
  function q(el,sel){ return el?.querySelector(sel); }
  function on(el,ev,fn){ el && el.addEventListener(ev,fn); }
  function warn(...a){ console.warn('[upload-card]',...a); }
  function randomHint(decision){
    if(decision==='pass') return 'Looks good';
    return HINTS[(Math.random()*HINTS.length)|0];
  }
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

  // Debug / inspection
  window.uploadCardDebug = {
    config: CONFIG,
    force(decision){
      document.querySelectorAll(SEL.card).forEach(c=>{
        applyResult(c,mapDecision(decision),'debug override',c._analysisToken || Symbol());
      });
    },
    resetAll(){
      document.querySelectorAll(SEL.card).forEach(reset);
    }
  };
})();
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


