import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { RenderFailure, RenderRequestSchema, RenderResponse, RenderSuccess } from './types';
import { renderProject } from './renderer';
import "dotenv/config";
const app = new Hono()

app.use("/render",async(c,next)=>{
    const secret = process.env.RENDER_SECRET;
    if(!secret) return next();
    const supplied = c.req.header("x-render-secret");
    // if(supplied!== secret){
    //     return c.json({error:"Unauthorized"},401)
    // }
    return next();
})

app.get("/health",(c)=>c.json({
    ok:true,
    timestamp:new Date().toISOString(),
    version:process.env.npm_package_version ?? "dev",
}));

app.post("/render",async(c)=>{
    const body = await c.req.json().catch(()=>null);
    const parsed = RenderRequestSchema.safeParse(body);
    if (!parsed.success) {
        const failure: RenderFailure = {
            success: false,
            projectId: body && typeof body === "object" && "projectId" in body 
                ? String((body as Record<string,unknown>).projectId) 
                : "unknown",
            error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(", ")
        };
        return c.json(failure satisfies RenderResponse, 400);
    }
    const {projectId,scenes,fps,width,height,audio}=parsed.data;
    console.log(`[server] Render request received: projectId=${projectId} scenes=${scenes.length}`);

    try {

        const {renderUrl,totalFrames,durationMs}= await renderProject(projectId,scenes,fps,width,height,audio);

        const success:RenderSuccess={
            success:true,
            projectId,
            renderUrl,
            totalFrames,
            durationMs,
        };
        return c.json(success satisfies RenderResponse);
    } catch (err) {
        console.error(`[server] Render failed for ${projectId}`,err);
        const failure:RenderFailure={
            success:false,
            projectId,
            error:err instanceof Error ? err.message:"unknown render error"
        };
        return c.json(failure satisfies RenderFailure)        
    }
})

app.notFound((c)=>c.json({error:"not found"},404))
app.onError((err,c)=>{
   console.error("[render-service] unhandled error", err);
  return c.json({ error: "Internal server error" }, 500);
})

const port = 4000;

serve({fetch:app.fetch,port},(info)=>{
   console.log(`Render service listening on :${info.port}`)
})

export default app