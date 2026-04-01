import { parse } from "@babel/parser";
import type {File} from "@babel/types";
import traverse from "@babel/traverse";


const ALLOWED_IMPORTS = new Set(["react","remotion"])
const BLOCKED_IDENTIFIERS = new Set([
  "process",
  "require",
  "global",
  "globalThis",
  "Function",
  "eval",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "__dirname",
  "__filename",
  "Buffer",
  "setInterval",
  "setTimeout", // animations should use useCurrentFrame, not timers
]);

export function normalizeAndValidateSceneCode(input: string): string {
  const normalized = normalizeSceneExport(input);
  validateSceneCode(normalized);
  return normalized;
}

function normalizeSceneExport(code:string):string {
    //here if it has exported the scene no need for normalizing
    if(code.includes("export const Scene")|| code.includes("export function Scene")){
        return code;
    }
    const namedDefault = code.replace(
        /export\s+default\s+function\s+\w+/,
        "export function Scene"
    );

    if(namedDefault.includes("export function Scene")) return namedDefault;

    const bareDefault = code.replace(
        /export\s+default\s+/,
        "export const Scene = ",
    )
    if (bareDefault.includes("export const Scene")|| bareDefault.includes("export function Scene")){
        return bareDefault;
    }
    throw new Error(
        "Scene code must export a scene component: `export const Scene= ()=>....` or `export function Scene(){....}`"
    );
}

//ast validation ,this is checking for errors like syntax 
function validateSceneCode(code:string):void {
    let ast:File;
    try {
        ast = parse(code,{
            sourceType:"module",
            plugins:["typescript","jsx"]
        });
    } catch (err) {
        throw new Error (`scene code could not be parsed :${err instanceof Error ? err.message:String(err)}`)   
    }
    let hasSceneExport = false;
    traverse(ast,{
        //block unauthorised import
        ImportDeclaration(path){
            const source = path.node.source.value;
            if(!ALLOWED_IMPORTS.has(source)){
                throw path.buildCodeFrameError(`
                    Import "${source}" is not allowed.Only "react " and "remotion are permitted"`)
            }
        },
        //Block dynamic import() and require()/eval() calls
        CallExpression(path){
            if(path.node.callee.type === "Import"){
                throw path.buildCodeFrameError("Dynamic import() is not allowed");
            }
            if(path.node.callee.type === "Identifier" && (path.node.callee.name === "require" || path.node.callee.name === "eval")){
                throw path.buildCodeFrameError(`calling "${path.node.callee.name}" is not allowed `);
            }
        },
        // Block new function()
        NewExpression(path){
            if(path.node.callee.type === "Identifier" && path.node.callee.name === "Function"){
                throw path.buildCodeFrameError("new Function() is not allowed ")
            }
        },
        //Block dangerous global identifiers
        Identifier(path){
            const parent = path.parent;
            const isMemberTarget = parent.type === "MemberExpression" && parent.property === path.node;
            const isObjectKey = parent.type === "ObjectProperty" && parent.key === path.node;
            if(!isMemberTarget && !isObjectKey && BLOCKED_IDENTIFIERS.has(path.node.name)){
                throw path.buildCodeFrameError(
                    `Identifier "${path.node.name}" is not allowed in render code`
                )
            }
        },
            // Confirm Scene is exported
        ExportNamedDeclaration(path) {
           const decl = path.node.declaration;
           if (!decl) return;
 
           if (
            decl.type === "VariableDeclaration" &&
            decl.declarations.some(
            (d) => d.id.type === "Identifier" && d.id.name === "Scene",
           )
           ) {
              hasSceneExport = true;
            }
 
            if (decl.type === "FunctionDeclaration" && decl.id?.name === "Scene") {
             hasSceneExport = true;
            }
        },

    })
    if(!hasSceneExport){
        throw new Error("Scene code must export a named Scene component.")
    }

}
