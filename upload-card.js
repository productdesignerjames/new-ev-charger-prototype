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
  if (HAS_CAPTURE) document.documentElement.classList.add('has-capture');

  const LIST = document.getElementById('photoList');
  if(!LIST) return;

  const cards = Array.from(LIST.querySelectorAll('.ph-card'));
  const submitBtn = document.getElementById('submitPhotos');

  const STATES = {
    IDLE:'idle',
    UPLOADING:'uploading',
    ANALYSING:'analysing',
    SUCCESS:'success',
    WARNING:'warning',
    ERROR:'error'
  };

  const SIMULATE = true;
  const MIN_UPLOAD_MS = 1200;
  const RAND_UPLOAD_MS = 900;
  const ANALYSE_MS = 850;

  cards.forEach(initCard);
  updateSteps();
  updateSubmit();

  function initCard(card){
    if(card._init) return; card._init = true;

    const box       = card.querySelector('.ph-box');
    const preview   = card.querySelector('.ph-preview');
    const illus     = card.querySelector('.ph-illus');
    const removeBtn = card.querySelector('.ph-remove');
    const uploadBtn = card.querySelector('.circle-btn--upload');
    const cameraBtn = card.querySelector('.circle-btn--camera');
    const fileInput = card.querySelector('.file-input');
    const statusEl  = card.querySelector('.ph-status');
    const titleEl   = card.querySelector('.ph-title');
    const bar       = card.querySelector('.ph-progress .bar');
    const pct       = card.querySelector('.ph-progress .pct');

    let state = STATES.IDLE;
    let rafId = null;
    let startTime = 0;

    if(cameraBtn && !HAS_CAPTURE) cameraBtn.style.display='none';

    uploadBtn?.addEventListener('click',()=> trigger(false));
    cameraBtn?.addEventListener('click',()=> HAS_CAPTURE && trigger(true));
    box?.addEventListener('click', e=>{
      if(e.target===removeBtn) return;
      if(state===STATES.UPLOADING || state===STATES.ANALYSING) return;
      if(!box.classList.contains('has-image')) trigger(false);
    });
    removeBtn?.addEventListener('click', e=>{
      e.stopPropagation();
      if(state===STATES.UPLOADING || state===STATES.ANALYSING) return;
      clearImage();
    });
    fileInput?.addEventListener('change',()=>{
      if(!fileInput.files?.length) return;
      const f = fileInput.files[0];
      if(!validateBasic(f)){
        setStatus('Unsupported file (jpg/png ≤15MB)');
        fileInput.value=''; return;
      }
      loadPreview(f);
      simulateUploadAndAnalyse(f);
    });

    function trigger(useCamera){
      prepInput(fileInput,useCamera);
      fileInput.click();
    }

    function prepInput(input,useCamera){
      if(!input) return;
      input.removeAttribute('capture');
      if(useCamera) input.setAttribute('capture','environment');
      input.accept='image/*';
    }

    function validateBasic(f){
      return /^image\/(jpeg|png|jpg|webp)$/.test(f.type) && f.size <= 15*1024*1024;
    }

    function loadPreview(file){
      revoke();
      const url = URL.createObjectURL(file);
      preview.dataset.objectUrl = url;
      preview.src = url;
      preview.alt = (titleEl?.textContent?.trim()||'Uploaded photo');
      box.classList.add('has-image');
    }

    function simulateUploadAndAnalyse(file){
      setState(STATES.UPLOADING);
      startTime = performance.now();
      const duration = MIN_UPLOAD_MS + Math.random()*RAND_UPLOAD_MS;
      loop();
      function loop(){
        const prog = Math.min(100, (performance.now()-startTime)/duration*100);
        updateProgress(prog);
        if(prog<100){
          rafId = requestAnimationFrame(loop);
        } else {
          updateProgress(100);
          setStatus('Uploaded');
          setState(STATES.ANALYSING);
          setTimeout(()=> runQuality(file), ANALYSE_MS);
        }
      }
    }

    function runQuality(file){
      quickQuality(file).then(q=>{
        if(q.dimFail){
          setState(STATES.ERROR); setStatus('Too small - retake');
        } else if(q.score < .28){
          setState(STATES.ERROR); setStatus('Too blurry');
        } else if(q.score < .5){
          setState(STATES.WARNING); setStatus('Low quality (replace if possible)');
        } else {
          setState(STATES.SUCCESS); setStatus('Looks good');
        }
        updateSubmit();
      }).catch(()=>{
        setState(STATES.WARNING); setStatus('Analysis fallback');
        updateSubmit();
      });
    }

    function quickQuality(file){
      return new Promise((res,rej)=>{
        const img = new Image();
        img.onload = ()=>{
          const w = img.naturalWidth, h = img.naturalHeight;
            if(w<600 || h<450) return res({dimFail:true, score:0});
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d',{willReadFrequently:true});
          const target = 160;
          canvas.width = target;
          canvas.height = Math.round(target*(h/w));
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let sum=0,sumSq=0,c=0;
          for(let y=1;y<canvas.height-1;y+=2){
            for(let x=1;x<canvas.width-1;x+=2){
              const i=(y*canvas.width+x)*4;
              const lum = .2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
              const i2=((y-1)*canvas.width+x)*4;
              const i3=((y+1)*canvas.width+x)*4;
              const i4=(y*canvas.width+(x-1))*4;
              const i5=(y*canvas.width+(x+1))*4;
              const lum2=.2126*data[i2]+.7152*data[i2+1]+.0722*data[i2+2];
              const lum3=.2126*data[i3]+.7152*data[i3+1]+.0722*data[i3+2];
              const lum4=.2126*data[i4]+.7152*data[i4+1]+.0722*data[i4+2];
              const lum5=.2126*data[i5]+.7152*data[i5+1]+.0722*data[i5+2];
              const lap=Math.abs(4*lum - lum2 - lum3 - lum4 - lum5);
              sum+=lap; sumSq+=lap*lap; c++;
            }
          }
          const mean=sum/c;
          const variance=(sumSq/c)-mean*mean;
          const score=Math.min(1, variance/3800);
          res({score});
        };
        img.onerror=()=>rej();
        img.src = preview.src;
      });
    }

    function updateProgress(v){
      if(!bar||!pct) return;
      const max=125.6;
      bar.style.strokeDashoffset = (max - max*(v/100)).toFixed(1);
      pct.textContent = Math.round(v)+'%';
    }

    function setState(next){
      if(state===next) return;
      state = next;
      box.setAttribute('data-state', next);
      if(next!==STATES.UPLOADING) updateProgress(0);
    }

    function clearImage(){
      cancelAnim();
      setState(STATES.IDLE);
      revoke();
      preview.removeAttribute('src');
      preview.alt='';
      box.classList.remove('has-image');
      fileInput.value='';
      setStatus('');
      updateSubmit();
      if(illus) illus.style.display='';
    }

    function revoke(){
      if(preview.dataset.objectUrl){
        URL.revokeObjectURL(preview.dataset.objectUrl);
        delete preview.dataset.objectUrl;
      }
    }

    function cancelAnim(){ if(rafId){ cancelAnimationFrame(rafId); rafId=null; } }
    function setStatus(msg){ if(statusEl) statusEl.textContent = msg; }

    card._debug={
      setState,
      clearImage,
      state:()=>state
    };
  }

  function updateSteps(){
    const total = cards.length;
    cards.forEach((c,i)=>{
      const stepEl = c.querySelector('.step');
      if(stepEl) stepEl.textContent = `${i+1}/${total}`;
    });
  }

  function updateSubmit(){
    if(!submitBtn) return;
    const ok = cards
      .filter(c=>c.hasAttribute('data-required'))
      .every(c=>{
        const box=c.querySelector('.ph-box.has-image');
        if(!box) return false;
        const st=box.getAttribute('data-state');
        return st=== 'success' || st==='warning';
      });
    submitBtn.disabled = !ok;
  }

  window.phDebug = {
    cards,
    states: ()=>cards.map(c=>c.querySelector('.ph-box')?.getAttribute('data-state'))
  };
})();
      .every(c=>{
        const box = c.querySelector('.pu-box.has-image');
        if(!box) return false;
        const state = box.getAttribute('data-state');
        return state !== STATES.ERROR && state !== STATES.IDLE && state !== STATES.UPLOADING && state !== STATES.ANALYSING;
      });
    submitBtn.disabled = !ok;
  }

  window.puDebug = {
    cards,
    states: ()=>cards.map(c=>c.querySelector('.pu-box')?.getAttribute('data-state')),
    force:(i,s)=>cards[i]?cards[i].querySelector('.pu-box')?.setAttribute('data-state',s):0,
    version:'clean-1'
  };
})();


