import express from "express";
import multer from "multer";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 8 * 1024 * 1024 } });

/**
 * Heuristic "AI" scoring:
 * - Resize to 256px
 * - Compute luminance stats + very rough blur proxy (variance of Laplacian via convolution)
 * Returns decision + hint list.
 */
async function analyseBuffer(buf){
  const img = sharp(buf).rotate(); // auto-orient
  const { data, info } = await img
    .resize(256,256,{ fit:"inside", withoutEnlargement:true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject:true });

  // Compute luminance & simple blur metric
  const w = info.width, h = info.height;
  let over=0, under=0, sum=0;
  const gray = new Float32Array(w*h);
  for(let i=0,p=0;i<gray.length;i++,p+=4){
    const r=data[p],g=data[p+1],b=data[p+2];
    const lum = 0.2126*r+0.7152*g+0.0722*b;
    gray[i]=lum;
    sum+=lum;
    if(r>245&&g>245&&b>245) over++;
    if(r<12&&g<12&&b<12) under++;
  }
  let lap=0,count=0;
  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const i=y*w+x;
      const v = -gray[i-w]-gray[i-1]-gray[i+1]-gray[i+w] + 4*gray[i];
      lap += v*v;
      count++;
    }
  }
  const lapVar = lap / Math.max(1,count);
  const avg = sum/gray.length;
  const overPct = over/gray.length;
  const underPct = under/gray.length;

  let decision = "pass";
  const hints = [];
  if(overPct > 0.18 || underPct > 0.30){
    decision = "retry"; hints.push("Fix exposure (too bright/dark).");
  } else if(lapVar < 900){ // tuned for 0..~4000 variance
    decision = "improve"; hints.push("Reduce blur / hold steady.");
  } else if(avg < 40){
    decision = "improve"; hints.push("Increase lighting.");
  } else if(avg > 225){
    decision = "improve"; hints.push("Reduce glare.");
  }

  return { decision, hints, metrics:{ lapVar, overPct, underPct, avgBrightness: avg } };
}

app.post("/api/quality", upload.single("image"), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ error:"missing file" });
    const result = await analyseBuffer(req.file.buffer);
    // Add stub confidence
    const confidence = result.decision==="pass" ? 0.85 : 0.65;
    res.json({ decision: result.decision, hints: result.hints, confidence, metrics: result.metrics });
  }catch(e){
    console.error(e);
    res.status(500).json({ decision:"failure", hints:["Server error analysing image"] });
  }
});

/**
 * Optional persistence endpoint (stores original file).
 * NOTE: In production use object storage (S3/GCS), add auth & validation.
 */
const uploadDir = path.join(process.cwd(),"uploads");
if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.post("/api/upload", upload.single("image"), async (req,res)=>{
  try{
    if(!req.file) return res.status(400).json({ error:"missing file" });
    const id = crypto.randomBytes(8).toString("hex");
    const ext = (req.file.originalname.match(/\.[a-zA-Z0-9]+$/)||["",".jpg"])[0];
    fs.writeFileSync(path.join(uploadDir, id+ext), req.file.buffer);
    res.json({ stored:true, id });
  }catch(e){
    console.error(e);
    res.status(500).json({ stored:false, error:"persist failed" });
  }
});

app.get("/health",(_,res)=>res.json({ ok:true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Backend listening on "+PORT));
