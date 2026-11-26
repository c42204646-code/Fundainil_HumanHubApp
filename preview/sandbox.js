// Read-only mock transport. Every request is intercepted; nothing is sent to a server.
(() => {
 const c=window.HH_SANDBOX_CATALOG;
 const response=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}}));
 window.fetch=(input,opts={})=>{
  const method=String(opts.method||"GET").toUpperCase();
  if(method!=="GET")return response({detail:"Demostración: las operaciones de escritura están desactivadas."},403);
  const u=new URL(String(input),location.origin);
  const path=u.pathname;
  if(u.origin!==location.origin)return response({detail:"Sin conexiones externas."},403);
  if(path==="/api/status")return response({ai:false,mail:false});
  if(path==="/api/projects"||path==="/api/jobs"||path==="/api/educo/forms"||path==="/api/educo/attendance/batches")return response([]);
  if(path==="/api/educo/catalog")return response(c);
  if(path==="/api/educo/dashboard"){
   const phase=u.searchParams.get("phase")||"expansion";
   return response({phase,indicators:c.indicators.map(i=>({...i,target:i[phase]??null,value:null,measurement:null})),note:"Vista de demostración: no hay avances registrados. Las metas de ampliación son propuestas."});
  }
  if(path==="/api/educo/attendance/config")return response({communities:c.communities,services:["Educación","Apoyo psicosocial","Protección","WASH","Orientación familiar","Formación comunitaria","Autocuidado","Otro"],ocr_local:false,enabled:false,role:new URLSearchParams(location.search).get("vista")==="captura"?"capture":"review"});
  if(path==="/api/educo/attendance/summary")return response({data:null});
  return response({detail:"Ruta no disponible en la vista de demostración."},404);
 };
 document.addEventListener("submit",e=>{e.preventDefault();e.stopImmediatePropagation();const m=document.getElementById("message");if(m)m.textContent="Solo demostración. No se ha guardado ni enviado información.";},true);
 document.addEventListener("DOMContentLoaded",()=>{
  const disable=()=>{document.querySelectorAll("input[type=file]").forEach(el=>{el.disabled=true;el.title="Carga desactivada en la demostración."});
   const csv=document.getElementById("csv");if(csv){csv.removeAttribute("href");csv.textContent="Exportar CSV (desactivado)";}
   const scan=document.getElementById("scan");if(scan)scan.disabled=true;
  };
  disable();
  const observer=new MutationObserver(()=>{const csv=document.getElementById("csv");if(csv?.hasAttribute("href"))csv.removeAttribute("href");});
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:["href"]});
  document.addEventListener("click",e=>{const a=e.target.closest("a");if(a&&a.getAttribute("href")?.startsWith("/api/")){e.preventDefault();}});
 });
})();
