"use strict";
// Only the publishable key may be present in browser source. Access token stays in memory.
const BASE="https://wakitroyztkypiadasyh.supabase.co", KEY="sb_publishable_tqWlxKplCrx01YR7j61FJw_Gku8Tsg6";
let accessToken=null,expiryTimer=null,authEpoch=0,projects=[];
const $=id=>document.getElementById(id);
const message=t=>{$("message").textContent=t};
const node=(tag,t,cls)=>{const e=document.createElement(tag);if(t!=null)e.textContent=t;if(cls)e.className=cls;return e};
async function api(path,method="GET",payload,token=accessToken){
 const headers={apikey:KEY,Accept:"application/json"};
 if(token)headers.Authorization="Bearer "+token;
 if(payload!==undefined)headers["Content-Type"]="application/json";
 const res=await fetch(BASE+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",redirect:"error"});
 if(!res.ok)throw new Error("HTTP "+res.status);
 return res.status===204?null:await res.json();
}
function reset(text){
 authEpoch++;accessToken=null;projects=[];clearTimeout(expiryTimer);
 $("workspace").hidden=true;$("signin").hidden=false;$("projects").replaceChildren();$("catalog-content").replaceChildren();$("catalog").hidden=true;$("password").value="";$("login").disabled=false;
 message(text??"");
}
function renderProjects(){
 const container=$("projects");container.replaceChildren();
 for(const p of projects){
  const box=node("section",null,"card");box.append(node("h2",p.project_name),node("p","Rol asignado: "+({field:"Campo",coordinator:"Coordinación",monitoring:"MERA",manager:"Gerencia",director:"Dirección",auditor:"Auditoría"}[p.member_role]??"No reconocido")));
  const grid=node("div",null,"grid three");
  for(const [allowed,label] of [[p.field_access,"Reporte de campo"],[p.coord_access,"Coordinación"],[p.mera_access,"MERA"]]){
   const card=node("div",null,"tile");card.append(node("h3",label),node("p",allowed?"Rol autorizado · funciones operativas pendientes":"Sin permiso para este módulo"),node("span",allowed?"Autorizado":"Restringido","tag "+(allowed?"green":"orange")));grid.append(card);
  }
  box.append(grid);
  const b=node("button","Consultar catálogo en Supabase","btn secondary");b.type="button";b.addEventListener("click",()=>readCatalog(p.project_id));box.append(b);container.append(box);
 }
}
async function readCatalog(projectId){
 const epoch=authEpoch;
 if(!accessToken)return;
 $("catalog").hidden=true;message("Consultando catálogo autorizado…");
 try{
  const fresh=await api("/rest/v1/rpc/hh_my_access","POST",{});
  if(epoch!==authEpoch)return;
  if(!Array.isArray(fresh)||!fresh.some(p=>p.project_id===projectId)){reset("Tu acceso ya no está activo. Contacta a administración.");return}
  projects=fresh;renderProjects();
  const rows=await api("/rest/v1/rpc/hh_project_catalog","POST",{p_project:projectId});
  if(epoch!==authEpoch)return;
  if(!Array.isArray(rows))throw Error("Invalid data");
  const table=node("table"),head=node("thead"),tr=node("tr"),body=node("tbody");["Código","Indicador","Tipo de medición"].forEach(x=>tr.append(node("th",x)));head.append(tr);table.append(head,body);
  for(const row of rows){const r=node("tr");[row.indicator_code,row.label,({unique:"Personas únicas",event:"Eventos",stock:"Existencias",rate:"Tasa"}[row.kind]??row.kind)].forEach(x=>r.append(node("td",x)));body.append(r)}
  $("catalog-content").replaceChildren(node("p",rows.length+" definiciones consultadas en la base de datos."),table);$("catalog").hidden=false;message("Consulta completada.");
 }catch(e){if(epoch===authEpoch)reset("No se pudo verificar el acceso. Inicia sesión nuevamente.")}
}
$("login-form").addEventListener("submit",async e=>{
 e.preventDefault();const epoch=++authEpoch;$("login").disabled=true;message("Verificando credenciales…");
 const email=$("email").value.trim(),password=$("password").value;$("password").value="";
 try{
  const data=await api("/auth/v1/token?grant_type=password","POST",{email,password},null);
  if(epoch!==authEpoch)return;
  if(typeof data.access_token!=="string"||!data.access_token)throw Error("Invalid token");
  accessToken=data.access_token;
  const rows=await api("/rest/v1/rpc/hh_my_access","POST",{});
  if(epoch!==authEpoch)return;
  if(!Array.isArray(rows)||!rows.length){const old=accessToken;reset("Cuenta autenticada, pero sin proyecto asignado. Contacta a administración.");try{await api("/auth/v1/logout","POST",undefined,old)}catch{}return}
  projects=rows;
  $("signin").hidden=true;$("workspace").hidden=false;renderProjects();message("Sesión autenticada. Permisos consultados en PostgreSQL.");
  const duration=Math.min(15*60,Math.max(1,Number(data.expires_in)||60));expiryTimer=setTimeout(()=>reset("La sesión de prueba ha expirado. Vuelve a ingresar."),duration*1000);
 }catch(e){if(epoch===authEpoch)reset("No se pudo iniciar sesión o verificar los permisos. Revisa tus credenciales o contacta a administración.")}
});
$("logout").addEventListener("click",async()=>{const old=accessToken;reset("Sesión local cerrada.");if(old){try{await api("/auth/v1/logout","POST",undefined,old)}catch{message("Sesión local cerrada. No se pudo confirmar la revocación remota.")}}});
window.addEventListener("pagehide",()=>{reset("")});
