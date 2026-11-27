"use strict";
// Only the publishable key may be present in browser source. Access token stays in memory.
const BASE="https://wakitroyztkypiadasyh.supabase.co", KEY="sb_publishable_tqWlxKplCrx01YR7j61FJw_Gku8Tsg6";
let accessToken=null,expiryTimer=null,authEpoch=0,projects=[],panelEpoch=0;
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
 authEpoch++;panelEpoch++;accessToken=null;projects=[];clearTimeout(expiryTimer);
 if($("pilot-panel"))$("pilot-panel").replaceChildren();$("workspace").hidden=true;$("signin").hidden=false;$("projects").replaceChildren();$("catalog-content").replaceChildren();$("catalog").hidden=true;$("password").value="";$("login").disabled=false;
 message(text??"");
}
function renderProjects(){
 const container=$("projects");container.replaceChildren();
 for(const p of projects){
  const box=node("section",null,"card");box.append(node("h2",p.project_name),node("p","Rol asignado: "+({field:"Campo",coordinator:"Coordinación",monitoring:"MERA",manager:"Gerencia",director:"Dirección",auditor:"Auditoría"}[p.member_role]??"No reconocido")));
  const grid=node("div",null,"grid three");
  for(const [allowed,label,mode] of [[p.field_access,"Reporte de campo","field"],[p.coord_access,"Coordinación","coord"],[p.mera_access,"MERA","mera"]]){
   const card=node("div",null,"tile");card.append(node("h3",label),node("p",allowed?"Rol autorizado · circuito de pruebas":"Sin permiso para este módulo"),node("span",allowed?"Autorizado":"Restringido","tag "+(allowed?"green":"orange")));if(allowed&&p.project_code==="EDUCO-SANDBOX"){const b=node("button","Abrir módulo","btn");b.type="button";b.onclick=()=>openPilot(p.project_id,mode);card.append(b)}grid.append(card);
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

const rpc=(name,payload)=>api("/rest/v1/rpc/"+name,"POST",payload);
function dateLocal(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function fieldControl(label,type,opts=[]){
 const l=node("label",label),e=node(type==="select"?"select":type==="textarea"?"textarea":"input");
 if(type==="select"){for(const [v,t] of opts){const o=node("option",t);o.value=v;e.append(o)}}
 else if(type!=="textarea")e.type=type;
 if(type==="textarea")e.maxLength=1000;
 l.append(e);return {l,e};
}
function dataTable(headers,rows){
 const t=node("table"),head=node("thead"),h=node("tr"),body=node("tbody");
 headers.forEach(x=>h.append(node("th",x)));head.append(h);t.append(head,body);
 rows.forEach(row=>{const r=node("tr");row.forEach(x=>{const c=node("td");if(x instanceof Node)c.append(x);else c.textContent=String(x??"");r.append(c)});body.append(r)});
 const wrap=node("div",null,"scroll");wrap.append(t);return wrap;
}

/* Two optional activity-evidence photos. Re-encode in memory; do not keep original files or metadata. */
function evidencePicker(container){
 const doc=document, rows=[null,null], states=[], pending=[false,false];
 const el=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
 const grid=el("div",null,"grid"),notice=el("p","Solo imágenes de prueba, sin rostros, listas, nombres ni información personal. Máximo dos fotos JPEG, PNG o WebP. Cada imagen requiere una descripción.","section-caption");container.append(notice,grid);
 const encode=async file=>{
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)throw Error("Formato no admitido o archivo superior a 10 MB.");
  const url=URL.createObjectURL(file);
  try{
   const img=new Image();img.src=url;await img.decode();
   if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>40000000)throw Error("Imagen demasiado grande.");
   const canvas=doc.createElement("canvas");let scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));
   for(let i=0;i<5;i++){
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL("image/jpeg",0.75);
    if(data.startsWith("data:image/jpeg;base64,")&&data.length<=349000)return data;
    scale*=0.75;
   }
   throw Error("No se pudo reducir la imagen.");
  }finally{URL.revokeObjectURL(url)}
 };
 for(let i=0;i<2;i++){
  let epoch=0;const box=el("div",null,"upload evidence-slot"),img=el("img",null,"evidence-preview"),caption=el("input"),msg=el("p",null,"section-caption"),buttons=el("div",null,"actions");
  img.alt="Vista previa de evidencia "+(i+1);img.hidden=true;caption.placeholder="Descripción breve de la actividad";caption.maxLength=240;caption.setAttribute("aria-label","Descripción de foto "+(i+1));caption.hidden=true;
  const camera=el("input"),gallery=el("input");for(const inp of [camera,gallery]){inp.type="file";inp.accept="image/jpeg,image/png,image/webp";inp.hidden=true}camera.setAttribute("capture","environment");
  const pick=(text,inp)=>{const b=el("button",text,"btn secondary");b.type="button";b.onclick=()=>inp.click();return b};
  const clear=el("button","Quitar foto","btn secondary");clear.type="button";clear.hidden=true;
  const reset=()=>{epoch++;pending[i]=false;rows[i]=null;img.removeAttribute("src");img.hidden=true;caption.value="";caption.hidden=true;clear.hidden=true;msg.textContent="";camera.value=gallery.value=""};
  clear.onclick=reset;
  const load=async e=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;reset();const request=++epoch;pending[i]=true;msg.textContent="Preparando fotografía…";try{const data=await encode(file);if(request!==epoch)return;rows[i]=data;img.src=data;img.hidden=false;caption.hidden=false;clear.hidden=false;msg.textContent="Foto lista. Añade una descripción."}catch(err){if(request===epoch)msg.textContent=err.message||"No se pudo leer la foto."}finally{if(request===epoch)pending[i]=false}};
  camera.onchange=gallery.onchange=load;
  buttons.append(pick("Tomar foto",camera),pick("Adjuntar",gallery),clear);
  box.append(el("strong","Evidencia "+(i+1)),img,caption,buttons,camera,gallery,msg);grid.append(box);states.push({caption,reset});
 }
 return {clear:()=>states.forEach(s=>s.reset()),get:()=>{if(pending.some(Boolean))throw Error("Espera a que las fotografías estén listas.");return rows.flatMap((data,i)=>{if(!data)return [];const caption=states[i].caption.value.trim();if(!caption)throw Error("Añade una descripción a cada fotografía.");return [{jpeg:data.split(",")[1],caption}]})}};
}
async function appendEvidence(doc,photos){
 if(!photos.length)return;
 const h=document.createElement("h2");h.textContent="Evidencias fotográficas";doc.append(h);
 for(const p of photos){const figure=document.createElement("figure"),img=document.createElement("img"),cap=document.createElement("figcaption");figure.className="evidence-figure";img.src="data:image/jpeg;base64,"+(p.jpeg??p.jpeg_base64);img.alt=p.caption;cap.textContent=p.caption;figure.append(img,cap);doc.append(figure);try{await img.decode()}catch{img.remove();cap.textContent+=" (imagen no disponible)"}}
}

async function openPilot(project,mode){
 const epoch=authEpoch,pe=++panelEpoch,panel=$("pilot-panel");if(!accessToken)return;
 const alive=()=>epoch===authEpoch&&pe===panelEpoch&&!!accessToken;
 panel.replaceChildren(node("p","Cargando módulo…","status"));$("catalog").hidden=true;
 try{
  const access=await rpc("hh_my_access",{});if(!alive())return;
  const member=access.find(p=>p.project_id===project&&p.project_code==="EDUCO-SANDBOX");
  if(!member||!({field:member.field_access,coord:member.coord_access,mera:member.mera_access}[mode])){panel.replaceChildren(node("p","No tienes acceso activo a este módulo.","notice"));return}
  const section=node("section",null,"card"),output=node("div"),status=node("p",null,"status");
  section.append(node("h2",({field:"Reporte de campo · prueba persistente",coord:"Coordinación · revisión de reportes",mera:"MERA · sesiones validadas"})[mode]),node("p","SOLO PRUEBAS FICTICIAS. No ingreses nombres, listas ni fotografías de personas reales. Usa imágenes de materiales de prueba.","notice"));
  panel.replaceChildren(section);
  async function listReports(){
   const data=await rpc("hh_pilot_reports",{p_project:project});if(!alive())return;
   output.replaceChildren(node("h3",mode==="field"?"Mis reportes / reportes autorizados":"Reportes recibidos"));
   if(!data.length){output.append(node("p","No hay reportes registrados.","empty"));return}
   const rows=data.map(r=>{
    const detail=node("div");detail.append(node("p",r.strategy),node("p","Resultado: "+(r.achievements||"No informado")),node("p","Dificultades: "+(r.challenges||"No informadas")),node("p","Revisión: "+(r.review_note||"Sin observaciones")));
    const evidence=node("div");const show=node("button","Ver evidencias","btn secondary");show.type="button";show.onclick=async()=>{show.disabled=true;try{const photos=await rpc("hh_pilot_report_photos",{p_project:project,p_report:r.report_id});if(!alive())return;evidence.replaceChildren();if(photos.length)await appendEvidence(evidence,photos);else evidence.append(node("p","Sin fotografías adjuntas.","section-caption"))}catch{if(alive())evidence.textContent="No se pudieron consultar las evidencias."}finally{if(alive())show.disabled=false}};const pdf=node("button","Imprimir / PDF","btn secondary");pdf.type="button";pdf.onclick=async()=>{pdf.disabled=true;try{const photos=await rpc("hh_pilot_report_photos",{p_project:project,p_report:r.report_id});if(!alive())return;const doc=node("article",null,"print-only");doc.id="print-report";doc.append(node("h1","FUNDAINIL · HumanHub / Educo"),node("p","REPORTE DE PRUEBA · "+r.day+" · "+r.program_code+" · "+r.logical_code+" · "+r.phase),node("p","Estado: "+({review:"Pendiente",validated:"Validado",returned:"Devuelto"}[r.state]??r.state)),node("h2","Estrategia"),node("p",r.strategy),node("h2","Resultados"),node("p",r.achievements||"No informado"),node("h2","Dificultades"),node("p",r.challenges||"No informadas"),node("h2","Observaciones de revisión"),node("p",r.review_note||"Sin observaciones"));document.body.append(doc);try{await appendEvidence(doc,photos);if(alive())window.print()}finally{doc.remove()}}catch{if(alive())status.textContent="No se pudo preparar el informe para impresión."}finally{if(alive())pdf.disabled=false}};detail.append(show,pdf,evidence);
    const ctl=node("div");
    if(mode==="coord"&&r.can_review){
     const note=fieldControl("Observación de revisión (ficticia)","textarea");ctl.append(note.l);
     for(const [decision,label] of [["validated","Validar"],["returned","Devolver"]]){
      const b=node("button",label,decision==="validated"?"btn green":"btn secondary");b.type="button";
      b.onclick=async()=>{if(decision==="returned"&&!note.e.value.trim()){status.textContent="Indica el motivo de devolución.";return}if(!confirm("¿Confirmar "+label.toLowerCase()+" este reporte de prueba?"))return;b.disabled=true;try{await rpc("hh_pilot_review",{p_project:project,p_report:r.report_id,p_decision:decision,p_note:note.e.value});if(alive()){status.textContent="Revisión registrada en Supabase.";await listReports()}}catch{if(alive()){status.textContent="No fue posible registrar la revisión.";b.disabled=false}}};
      ctl.append(b);
     }
    }else ctl.textContent=r.own_report?"Reporte propio":"Sin acción disponible";
    return [r.day,r.program_code,r.logical_code,r.phase,({review:"Pendiente",validated:"Validado",returned:"Devuelto"})[r.state]??r.state,detail,ctl];
   });
   output.append(dataTable(["Fecha","Programa","Actividad","Fase","Estado","Detalle","Acción"],rows));
  }
  if(mode==="field"){
   const opts=await rpc("hh_pilot_options",{p_project:project});if(!alive())return;
   if(!opts.length){section.append(node("p","Catálogo no disponible.","notice"));return}
   const form=node("form"),grid=node("div",null,"grid");
   const activity=fieldControl("Actividad / fase del catálogo de prueba","select",opts.map((o,i)=>[String(i),o.program_label+" · "+o.logical_code+" · "+o.activity_label+" ("+o.phase+")"]));
   const day=fieldControl("Fecha","date");day.e.value=dateLocal();day.e.max=dateLocal();day.e.required=true;
   const shift=fieldControl("Turno","select",[["AM","Mañana"],["PM","Tarde"]]);
   const slot=fieldControl("Sesión del turno (1–20)","number");slot.e.min="1";slot.e.max="20";slot.e.value="1";slot.e.required=true;
   const strategy=fieldControl("Estrategia ficticia","textarea");strategy.e.required=true;
   const outcome=fieldControl("Resultado ficticio observado","textarea"),challenges=fieldControl("Dificultades ficticias","textarea");
   const consent=node("label",null,"check"),check=node("input");check.type="checkbox";check.required=true;consent.append(check,document.createTextNode(" Confirmo que todos los datos son inventados para la prueba."));
   grid.append(activity.l,day.l,shift.l,slot.l,strategy.l,outcome.l,challenges.l);
   const button=node("button","Enviar reporte a revisión","btn wide");button.type="submit";
   const photoBlock=node("section",null,"card");photoBlock.append(node("h3","Evidencias fotográficas (opcional)"));const picker=evidencePicker(photoBlock);form.append(node("p",opts[0].space_label),grid,photoBlock,consent,button);
   form.onsubmit=async e=>{e.preventDefault();if(!alive()||!check.checked)return;const o=opts[Number(activity.e.value)];let photos;try{photos=picker.get()}catch(err){status.textContent=err.message;return}button.disabled=true;try{await rpc("hh_pilot_submit_photos",{p_project:project,p_space:o.space_id,p_day:day.e.value,p_shift:shift.e.value,p_slot:Number(slot.e.value),p_phase:o.phase,p_program:o.program_code,p_activity:o.activity_key,p_logical:o.logical_code,p_strategy:strategy.e.value,p_outcome:outcome.e.value,p_challenges:challenges.e.value,p_photos:photos});if(alive()){picker.clear();strategy.e.value=outcome.e.value=challenges.e.value="";check.checked=false;status.textContent="Reporte guardado en PostgreSQL y enviado a coordinación.";await listReports()}}catch{if(alive())status.textContent="No se pudo guardar. Revisa el turno y número de sesión (no se admiten duplicados) o tus permisos."}finally{if(alive())button.disabled=false}};
   section.append(form,status,output);await listReports();
  }else if(mode==="coord"){section.append(status,output);await listReports()}
  else{
   const filters=node("div",null,"grid"),from=fieldControl("Desde","date"),to=fieldControl("Hasta","date");to.e.value=dateLocal();from.e.value=to.e.value.slice(0,8)+"01";const b=node("button","Consultar resultados validados","btn");b.type="button";filters.append(from.l,to.l);section.append(filters,b,status,output);
   async function load(){if(!from.e.value||!to.e.value||from.e.value>to.e.value){status.textContent="Selecciona un período válido.";return}b.disabled=true;try{
    const rows=await rpc("hh_pilot_mera",{p_project:project,p_from:from.e.value,p_to:to.e.value});if(!alive())return;
    output.replaceChildren(node("p","Sesiones de prueba validadas en el período: "+rows.reduce((n,r)=>n+Number(r.validated_period),0)),dataTable(["Programa","Actividad","Código","Fase","Meta","Período","Acumulado"],rows.map(r=>[r.program_code,r.activity_key,r.logical_code,r.phase,"N/D",r.validated_period,r.validated_accumulated])));
    status.textContent=rows.length?"Resultados consultados en PostgreSQL.":"No hay sesiones de prueba aprobadas para el corte.";
   }catch{if(alive())status.textContent="No se pudo consultar el agregado autorizado."}finally{if(alive())b.disabled=false}}
   b.onclick=load;await load();
  }
  if(alive())panel.scrollIntoView({block:"start",behavior:"smooth"});
 }catch(e){if(alive())panel.replaceChildren(node("p","No se pudo cargar el módulo autorizado. Verifica la sesión.","notice"))}
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
