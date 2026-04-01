import z from "zod";

export const AudioConfigSchema = z.object({
    musicTrackUrl:z.string().url().nullable().optional(),
    musicVolume:z.number().min(0).max(1).nullable().optional(),
    voiceoverUrl:z.string().url().nullable().optional(),
    voiceoverVolume:z.number().min(0).max(1).nullable().optional(),
})

export const SceneDataSchema = z.object({
    _id:z.string().min(1),
    title:z.string().min(1),
    code:z.string().min(1),
    durationFrames:z.number().int().positive(),
    durationSeconds:z.number().positive(),
    order:z.number().int().min(0)
})

export const RenderRequestSchema = z.object({
    projectId:z.string().min(1),
    scenes:z.array(SceneDataSchema).min(1).max(100),
    fps: z.number().int().refine((v)=>[24,30,60].includes(v),{
        message:"fps must be 24,30 or 60"
    }),
    width:z.number().int().min(320).max(3840),
    height:z.number().int().min(320).max(3840),
    audio:AudioConfigSchema.optional()
});

export type AudioConfig = z.infer<typeof AudioConfigSchema>;
export type SceneData = z.infer<typeof SceneDataSchema>;
export type RenderRequest = z.infer<typeof RenderRequestSchema>;

export type RenderSuccess = {
    success:true;
    projectId:string;
    renderUrl:string;
    totalFrames:number;
    durationMs:number;
}

export type RenderFailure = {
    success:false;
    projectId:string;
    error:string;
}

export type RenderResponse = RenderSuccess | RenderFailure;