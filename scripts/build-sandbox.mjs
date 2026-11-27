// Builds an isolated, non-persistent visual preview from the actual UI.
import { readFile, writeFile, mkdir, rm, copyFile } from "node:fs/promises";
const out="sandbox-dist";
await rm(out,{recursive:true,force:true});
await mkdir(out+"/intelligence",{recursive:true});
const source=await readFile("server/educo_catalog.py","utf8");
const block=source.split("ROWS = [")[1]?.split("\n]")[0];
if(!block) throw new Error("Catalog format changed");
const indicators=block.split("\n").filter(x=>x.trim().startsWith("(")).map(line=>{
 const row=line.trim().match(/^\((.*)\),$/);
 if(!row)throw new Error("Unexpected catalog row");
 const v=JSON.parse("["+row[1].replace(/"(?:[^"\\]|\\.)*"|\bNone\b/g,x=>x==="None"?"null":x)+"]");
 if(v.length!==8)throw new Error("Incomplete indicator");
 const [id,code,label,kind,original,expansion,operational,evidence]=v;
 return {id,code,label,kind,original,expansion,operational,evidence};
});
if(!indicators.length)throw new Error("Empty catalog");
const list=name=>JSON.parse(source.match(new RegExp("^"+name+" = (\\[.*\\])$","m"))[1]);
const catalog={indicators,ages:list("AGES"),communities:list("COMMUNITIES"),activities:JSON.parse(source.split("ACTIVITIES = ")[1].trim().replace(/,\s*}/g,"}")),warning:"DEMOSTRACIÓN VISUAL · Metas de referencia; sin registros reales ni resultados de ejecución."};
await writeFile(out+"/intelligence/sandbox-data.js","window.HH_SANDBOX_CATALOG="+JSON.stringify(catalog)+";\n");
for(const [src,dst] of [["index.html","intelligence.html"],["educo.html","mera-legacy.html"],["attendance.html","asistencia.html"]]){
 let html=await readFile("intelligence/"+src,"utf8");
 html=html.replace("</head>",'<script src="/intelligence/sandbox-data.js" defer></script><script src="/intelligence/sandbox.js" defer></script><link rel="stylesheet" href="/intelligence/sandbox.css"></head>');
 // Load the read-only adapter before the application scripts.
 html=html.replace(/<script src="\/intelligence\/(app|educo|attendance)\.js" defer><\/script>/,m=>{globalThis.__script=m;return ""});
 html=html.replace("</head>",globalThis.__script+"</head>");
 html=html.replace("<main>",'<main><aside class="sandbox-banner"><strong>HumanHub Sandbox · SOLO DEMOSTRACIÓN</strong><p>Vista del diseño real. No registra, no envía, no ejecuta IA ni OCR. No introduzca datos personales ni fotografías.</p><a href="/">Gerencia</a> · <a href="/educo">MERA</a> · <a href="/educo/asistencia?vista=captura">Captura</a> · <a href="/educo/asistencia?vista=revision">Revisión</a></aside>');
 await writeFile(out+"/"+dst,html);
}
for(const file of ["app.js","educo.js","attendance.js","style.css","educo.css"])await copyFile("intelligence/"+file,out+"/intelligence/"+file);
await copyFile("intelligence/style.css",out+"/intelligence/attendance-style.css");
await copyFile("intelligence/educo.css",out+"/intelligence/attendance-extra.css");
for(const file of ["sandbox.js","sandbox.css"])await copyFile("preview/"+file,out+"/intelligence/"+file);
// New pilot portal; the legacy technical screens remain separate.
await copyFile("preview/portal.html",out+"/index.html");
for(const f of ["portal.js","portal.css","educo-logo.svg"])await copyFile("preview/"+f,out+"/intelligence/"+f);
console.log("Static HumanHub preview built: "+indicators.length+" indicators; no backend, no credentials, no data writes.");
