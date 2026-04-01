
import { bundle } from "@remotion/bundler";
import { renderFrames, renderMedia, selectComposition, type RenderMediaOnProgress, } from "@remotion/renderer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateIndexFile, generateRootFile } from "./generate-root";
import { normalizeAndValidateSceneCode } from "./scene-guard";
import type { AudioConfig, SceneData } from "./types";
import "dotenv/config";

export type ProgressCallback = (rendered:number,total:number)=>void;


function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
 
function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requiredEnv("CF_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     requiredEnv("CF_R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("CF_R2_SECRET_ACCESS_KEY"),
    },
  });
}

 
/** Strip characters that are unsafe in filesystem paths or R2 keys */
function sanitizeProjectId(id: string): string {
  return id.replace(/[^a-zA-Z0-9\-_]/g, "_");
}

export async function renderProject(
    projectId:string,
    projectTitle:string,
    scenes:SceneData[],
    fps:number,
    width:number,
    height:number,
    audio?:AudioConfig,
    onProgress?:ProgressCallback
):Promise<{renderUrl:string; totalFrames:number; durationMs:number;}> {
    if(!scenes.length) throw new Error ("No scenes provided");

    const ordered = [...scenes].sort((a,b)=>a.order-b.order);
    const totalFrames = ordered.reduce((sum,s)=>sum+ s.durationFrames,0);
    if(totalFrames<=0) throw new Error("Total duration is 0 frames -check durationFrames values");

    const startedAt = Date.now();
    const safeId= sanitizeProjectId(projectId);
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(),`codecut-${safeId}`));

    console.log(`[render] START project=${safeId} scenes=${ordered.length} frames=${totalFrames} ${width}x${height} @ ${fps} at ${startedAt}`);

    if(audio?.musicTrackUrl) console.log(`[render] Music: ${audio.musicTrackUrl}`);
    if(audio?.voiceoverUrl) console.log(`[render] voiceover:${audio.voiceoverUrl}`);
    try{
        for(let i=0; i<ordered.length;i++){
            const scene = ordered[i];
            let safeCode: string;
            try {
              safeCode = normalizeAndValidateSceneCode(scene.code)  
            } catch (err) {
                throw new Error(
                    `Scene "${scene.title}" (index ${i}) failed validation :${err instanceof Error ? err.message:String(err)}`
                )
            }
            await fs.writeFile(path.join(workDir,`scene-${i}.tsx`),safeCode,"utf-8")
            console.log(`[render] wrote scene-${i}.tsx(${scene.title})`);
        }
        await fs.writeFile(
            path.join(workDir,"Root.tsx"),
            generateRootFile(ordered,fps,width,height,audio),
            "utf-8"
        );
        await fs.writeFile(
            path.join(workDir,"index.ts"),
            generateIndexFile(),
            "utf-8"
        );
        console.log(`[render] Bundling....`);
        //bundle
        const serveUrl = await bundle({
            entryPoint:path.join(workDir,"index.ts"),
            webpackOverride:(config)=>({
                ...config,
                resolve:{
                    ...config.resolve,
                    modules:[path.join(process.cwd(),"node_modules"),"node_modules"],
                },
            })
        });
        //selct composition
        const composition = await selectComposition({
            serveUrl,
            id:"MasterVideo",
            inputProps:{},
            timeoutInMilliseconds:30_000,
        }) 
        const outputPath = path.join(workDir,"output.mp4");
        console.log(`[render] Rendering ${totalFrames} frames ...`);
        const onProgressHandler:RenderMediaOnProgress= ({progress})=>{
            if(progress % 30 === 0 || progress === totalFrames){
                const pct = Math.round((progress/totalFrames)*100);
                console.log(`[render] ${progress}/${totalFrames} (${pct}%)`);
            }
            onProgress?.(Math.round(progress * totalFrames),totalFrames);
        };

        await renderMedia({
            composition:{...composition,durationInFrames:totalFrames,fps,width,height},
            serveUrl,
            codec: "h264",
            outputLocation:outputPath,
            inputProps:{},
            chromiumOptions:{
                disableWebSecurity:true
            },
            onProgress:onProgressHandler
        })
        const stat = await fs.stat(outputPath); //this gives us the stats of the file
        console.log(`[render] Render complete.Size :${(stat.size/1024/1024).toFixed(1)}MB`);
        //now we upload to r2

        const key = `${projectTitle}/${Date.now()}.mp4`;
        console.log(`[render] uploading to R2:${key}`);

        await getR2Client().send(new PutObjectCommand({
            Bucket: requiredEnv("CF_R2_BUCKET_NAME"),
            Key:key,
            Body:createReadStream(outputPath),
            ContentType:"video/mp4",
            ContentLength:stat.size
        }));
        const publicUrl = `${requiredEnv("CF_R2_PUBLIC_URL").replace(/\/$/, "")}/${key}`;
        const durationMs = Date.now() - startedAt;

        console.log(`[render] DONE url=${publicUrl} time=${(durationMs / 1000).toFixed(1)}s`);
        return { renderUrl: publicUrl, totalFrames, durationMs };

    }finally{
           // Always clean up — even on error
         await fs.rm(workDir, { recursive: true, force: true }).catch((err) => {
         console.warn(`[render] Cleanup warning: ${err.message}`);
         });
    }
}
