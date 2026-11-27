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
 authEpoch++;panelEpoch++;phaseRegistry=[];accessToken=null;projects=[];clearTimeout(expiryTimer);
 if($("pilot-panel"))$("pilot-panel").replaceChildren();$("staff-panel").replaceChildren();$("staff-panel").hidden=true;$("enrollment").hidden=true;$("signup-password").value="";$("signup-repeat").value="";$("signup-submit").disabled=false;$("workspace").hidden=true;$("signin").hidden=false;$("projects").replaceChildren();$("catalog-content").replaceChildren();$("catalog").hidden=true;$("password").value="";$("login").disabled=false;
 message(text??"");
}
function renderProjects(){
 const container=$("projects");container.replaceChildren();
 for(const p of projects){
  const box=node("section",null,"card institutional-project");const welcome=node("div",null,"welcome");const logo=node("img",null,"educo-logo");logo.src="/intelligence/educo-logo.svg";logo.alt="Educo";welcome.append(logo,node("h1","¿Qué deseas realizar?"),node("p","Selecciona tu área de trabajo."));box.append(welcome,node("p","Rol asignado: "+({field:"Campo",coordinator:"Coordinación",monitoring:"MERA",manager:"Gerencia",director:"Dirección",auditor:"Auditoría"}[p.member_role]??"No reconocido")));
  const grid=node("div",null,"project-grid");
  for(const [allowed,label,mode] of [[p.field_access,"Reporte de campo","field"],[p.coord_access,"Coordinación","coord"],[p.mera_access,"MERA","mera"]]){
   const card=node("div",null,"tile");card.append(node("span",({field:"✎",coord:"▤",mera:"▥"})[mode],"symbol"),node("h2",label),node("p",({field:"Registro diario de actividades y evidencias",coord:"Supervisión, validación e informes",mera:"Monitoreo de metas y resultados"})[mode]),node("span",allowed?"Acceso autorizado":"Sin permiso","tag "+(allowed?"green":"orange")));if(allowed&&p.project_code==="EDUCO-SANDBOX"){const b=node("button","Abrir módulo","btn");b.type="button";b.onclick=()=>openPilot(p.project_id,mode);card.append(b)}grid.append(card);
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
const phaseShort=phase=>({original:"Educo · Proyecto original",expansion:"Educo · Proyecto de ampliación",shared:"Educo · Atribución compartida"}[phase]??"Educo · Fase no definida");
let phaseRegistry=[];
const projectPhase=phase=>{const p=phaseRegistry.find(x=>x.phase===phase);return p?(p.reference_code?p.reference_code+" · ":"")+p.title+(p.document_status==="proposed"?" (propuesta)":""):phaseShort(phase)};
async function renderStaff(metadata={}){
 const epoch=authEpoch,panel=$("staff-panel");panel.hidden=false;panel.replaceChildren();
 const rows=await rpc("hh_my_staff_profile",{});if(epoch!==authEpoch)return;
 let profile=rows[0];
 if(!projects.length&&(profile?.state==="pending"||(!profile&&metadata.hh_name&&metadata.hh_specialty&&metadata.hh_title))){
  const details=profile?{p_name:profile.full_name,p_specialty:profile.specialty,p_title:profile.job_title}:{p_name:metadata.hh_name,p_specialty:metadata.hh_specialty,p_title:metadata.hh_title};
  try{await rpc("hh_request_staff_access",details);if(epoch!==authEpoch)return;projects=await rpc("hh_my_access",{});if(epoch!==authEpoch)return;renderProjects();profile=(await rpc("hh_my_staff_profile",{}))[0];if(epoch!==authEpoch)return;message(projects.length?"Cuenta activa. Ya puedes ingresar a tu módulo.":"Acceso no habilitado. Contacta a gerencia.");}catch{if(epoch===authEpoch)message("No se pudo activar la cuenta. Comprueba tu perfil o contacta a gerencia.")}
 }
 if(profile){panel.append(node("h2","Mi perfil institucional"),node("p",profile.full_name+" · "+profile.specialty+" · "+profile.job_title),node("p","Estado: "+(projects.length?"Activo":profile.state==="rejected"?"Acceso rechazado":"Sin acceso activo")))}
 else if(!projects.length){
  const form=node("form"),name=fieldControl("Nombres y apellidos","text"),specialty=fieldControl("Profesión o especialidad","text"),title=fieldControl("Cargo en FUNDAINIL","text");
  for(const [x,min,max] of [[name,3,160],[specialty,2,120],[title,2,120]]){x.e.required=true;x.e.minLength=min;x.e.maxLength=max}
  const btn=node("button","Activar mi cuenta","btn wide");btn.type="submit";
  form.append(name.l,specialty.l,title.l,btn);panel.append(node("h2","Completa tu perfil profesional"),node("p","El acceso de campo se activa automáticamente con tu correo confirmado."),form);
  form.onsubmit=async e=>{e.preventDefault();btn.disabled=true;try{await rpc("hh_request_staff_access",{p_name:name.e.value,p_specialty:specialty.e.value,p_title:title.e.value});if(epoch!==authEpoch)return;projects=await rpc("hh_my_access",{});if(epoch!==authEpoch)return;renderProjects();await renderStaff();message(projects.length?"Cuenta activa.":"Sin acceso activo. Contacta a gerencia.")}catch{if(epoch===authEpoch){message("No se pudo activar la cuenta.");btn.disabled=false}}};
 }
 if(!projects.length){const btn=node("button","Actualizar estado de acceso","btn secondary");btn.type="button";btn.onclick=async()=>{try{const fresh=await rpc("hh_my_access",{});if(epoch!==authEpoch)return;projects=fresh;renderProjects();await renderStaff()}catch{if(epoch===authEpoch)message("No se pudo consultar el estado.")}};panel.append(btn)}
 for(const p of projects.filter(x=>x.member_role==="manager"&&x.project_code==="EDUCO-SANDBOX")){
  const admin=node("section",null,"card"),out=node("div"),load=node("button","Actualizar directorio","btn secondary");load.type="button";
  const registrationURL="https://humanhub-sandbox.vercel.app/registro",link=node("a","Abrir registro de profesionales","btn secondary"),copy=node("button","Copiar enlace para el equipo","btn");link.href=registrationURL;link.target="_blank";link.rel="noopener noreferrer";copy.type="button";copy.onclick=async()=>{try{await navigator.clipboard.writeText(registrationURL);message("Enlace de registro copiado.")}catch{message("Comparte este enlace: "+registrationURL)}};
  const invite=node("div",null,"actions");invite.append(copy,link);
  admin.append(node("h2","Administración de profesionales"),node("p","Las cuentas con correo confirmado se activan automáticamente como Campo. Cambia roles o suspende accesos desde este directorio; se conserva el historial."),invite,load,out);panel.append(admin);
  async function list(){load.disabled=true;try{
   const req=await rpc("hh_staff_directory",{p_project:p.project_id});if(epoch!==authEpoch)return;out.replaceChildren();
   if(!req.length){out.append(node("p","Aún no hay otros perfiles registrados."));return}
   for(const r of req){const box=node("div",null,"card");box.append(node("h3",r.full_name),node("p",r.email),node("p",r.specialty+" · "+r.job_title),node("p",r.active?"Acceso activo":r.member_role?"Acceso suspendido":"Sin acceso activo"));
    if(["field","coordinator","monitoring"].includes(r.member_role)){
     const role=fieldControl("Perfil autorizado","select",[["field","Profesional de campo"],["coordinator","Coordinación"],["monitoring","MERA"]]);role.e.value=r.member_role;box.append(role.l);
     const controls=node("div",null,"actions");
     for(const [active,label] of [[r.active,"Guardar rol"],[!r.active,r.active?"Suspender acceso":"Reactivar acceso"]]){
      const btn=node("button",label,"btn secondary");btn.type="button";btn.onclick=async()=>{if(!confirm(label+" para "+r.full_name+"?"))return;btn.disabled=true;try{await rpc("hh_manage_staff_access",{p_project:p.project_id,p_user:r.user_id,p_role:role.e.value,p_active:active});if(epoch===authEpoch){message("Permisos actualizados.");await list()}}catch{if(epoch===authEpoch){message("No se pudieron actualizar los permisos.");btn.disabled=false}}};controls.append(btn)
     }box.append(controls)
    }out.append(box)
   }
  }catch{if(epoch===authEpoch)out.textContent="No se pudo consultar el directorio."}finally{if(epoch===authEpoch)load.disabled=false}}
  load.onclick=list;await list();
 }
}

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
 const grid=el("div",null,"grid"),notice=el("p","Adjunta hasta dos fotografías de materiales o recursos, sin rostros, listas, nombres ni información personal. Formatos JPEG, PNG o WebP. Añade una descripción a cada imagen.","section-caption");container.append(notice,grid);
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

function metricCards(items){const box=node("div",null,"metrics");for(const [label,value] of items){const card=node("div",null,"metric");card.append(node("small",label),node("strong",String(value)));box.append(card)}return box}
function programBars(counts,title){const box=node("section",null,"card");box.append(node("h2",title));const entries=Object.entries(counts),max=Math.max(1,...entries.map(([,v])=>v));if(!entries.length){box.append(node("p","Sin registros para la selección.","muted"));return box}for(const [key,v] of entries){const row=node("div",null,"bar-row"),track=node("div",null,"bar-track"),meter=node("meter");meter.max=max;meter.value=v;meter.setAttribute("aria-label",key+": "+v);track.append(meter);row.append(node("span",({EDU:"Educación",PROT:"Protección",WASH:"WASH"})[key]??key),track,node("strong",String(v)));box.append(row)}return box}
async function openPilot(project,mode){
 const epoch=authEpoch,pe=++panelEpoch,panel=$("pilot-panel");if(!accessToken)return;
 const alive=()=>epoch===authEpoch&&pe===panelEpoch&&!!accessToken;
 panel.replaceChildren(node("p","Cargando módulo…","status"));$("catalog").hidden=true;
 try{
  const access=await rpc("hh_my_access",{});if(!alive())return;
  const member=access.find(p=>p.project_id===project&&p.project_code==="EDUCO-SANDBOX");
  if(!member||!({field:member.field_access,coord:member.coord_access,mera:member.mera_access}[mode])){panel.replaceChildren(node("p","No tienes acceso activo a este módulo.","notice"));return}
  const phaseRows=await rpc("hh_project_phases",{p_project:project});if(!alive())return;phaseRegistry=Array.isArray(phaseRows)?phaseRows:[];
  const section=node("section",null,"card"),output=node("div"),status=node("p",null,"status");const nav=node("nav",null,"scope no-print");for(const [key,label,allowed] of [["field","Reporte de campo",member.field_access],["coord","Coordinación",member.coord_access],["mera","MERA",member.mera_access]]){if(!allowed)continue;const b=node("button",label,key===mode?"btn":"btn secondary");b.type="button";b.onclick=()=>openPilot(project,key);nav.append(b)}section.append(nav);
  section.append(node("h1",({field:"Reporte de campo",coord:"Centro de coordinación",mera:"MERA | Seguimiento de resultados"})[mode]),node("p",({field:"Registro y envío de actividades a revisión",coord:"Supervisión de actividades y resultados",mera:"Sesiones validadas por período y acumulado"})[mode],"muted"),node("p","Validación operativa: utiliza registros simulados. El padrón de beneficiarios y las metas contractuales aún no están integrados. No introduzcas datos personales de participantes ni imágenes identificables.","notice"));
  panel.replaceChildren(section);
  let reportFilter=null;
  async function listReports(){
   const all=await rpc("hh_pilot_reports",{p_project:project});if(!alive())return;
   const data=reportFilter?all.filter(r=>(!reportFilter.from.e.value||r.day>=reportFilter.from.e.value)&&(!reportFilter.to.e.value||r.day<=reportFilter.to.e.value)&&(!reportFilter.phase.e.value||r.phase===reportFilter.phase.e.value)&&(!reportFilter.program.e.value||r.program_code===reportFilter.program.e.value)&&(!reportFilter.state.e.value||r.state===reportFilter.state.e.value)):all;
   output.replaceChildren(node("h3",mode==="field"?"Mis reportes / reportes autorizados":"Reportes recibidos"));
   if(mode==="coord"){output.append(metricCards([["Reportes consultados",data.length],["Validados",data.filter(r=>r.state==="validated").length],["Pendientes",data.filter(r=>r.state==="review").length],["Devueltos",data.filter(r=>r.state==="returned").length]]));output.append(node("p","Participantes únicos y asistencias: no disponibles hasta integrar el registro de beneficiarios. Consulta limitada a los 200 reportes más recientes autorizados.","section-caption"));output.append(programBars(data.filter(r=>r.state==="validated").reduce((a,r)=>(a[r.program_code]=(a[r.program_code]||0)+1,a),{}),"Actividades validadas por área"));}
   if(!data.length){output.append(node("p","No hay reportes registrados.","empty"));return}
   const rows=data.map(r=>{
    const detail=node("div");detail.append(node("p",r.strategy),node("p","Resultado: "+(r.achievements||"No informado")),node("p","Dificultades: "+(r.challenges||"No informadas")),node("p","Revisión: "+(r.review_note||"Sin observaciones")));
    const evidence=node("div");const show=node("button","Ver evidencias","btn secondary");show.type="button";show.onclick=async()=>{show.disabled=true;try{const photos=await rpc("hh_pilot_report_photos",{p_project:project,p_report:r.report_id});if(!alive())return;evidence.replaceChildren();if(photos.length)await appendEvidence(evidence,photos);else evidence.append(node("p","Sin fotografías adjuntas.","section-caption"))}catch{if(alive())evidence.textContent="No se pudieron consultar las evidencias."}finally{if(alive())show.disabled=false}};const pdf=node("button","Imprimir / PDF","btn secondary");pdf.type="button";pdf.onclick=async()=>{pdf.disabled=true;try{const photos=await rpc("hh_pilot_report_photos",{p_project:project,p_report:r.report_id});if(!alive())return;const doc=node("article",null,"print-only");doc.id="print-report";doc.append(node("h1","FUNDAINIL · HumanHub / Educo"),node("h2",projectPhase(r.phase)),node("p","Informe de actividades · "+r.day+" · "+r.program_code+" · "+r.logical_code),node("p","Documento de validación operativa — no acredita ejecución real ni cumplimiento contractual."),node("p","Estado: "+({review:"Pendiente",validated:"Validado",returned:"Devuelto"}[r.state]??r.state)),node("h2","Estrategia"),node("p",r.strategy),node("h2","Resultados"),node("p",r.achievements||"No informado"),node("h2","Dificultades"),node("p",r.challenges||"No informadas"),node("h2","Observaciones de revisión"),node("p",r.review_note||"Sin observaciones"));document.body.append(doc);try{await appendEvidence(doc,photos);if(alive())window.print()}finally{doc.remove()}}catch{if(alive())status.textContent="No se pudo preparar el informe para impresión."}finally{if(alive())pdf.disabled=false}};detail.append(show,pdf,evidence);
    const ctl=node("div");
    if(mode==="coord"&&r.can_review){
     const note=fieldControl("Observaciones de coordinación","textarea");ctl.append(note.l);
     for(const [decision,label] of [["validated","Validar"],["returned","Devolver"]]){
      const b=node("button",label,decision==="validated"?"btn green":"btn secondary");b.type="button";
      b.onclick=async()=>{if(decision==="returned"&&!note.e.value.trim()){status.textContent="Indica el motivo de devolución.";return}if(!confirm("¿Confirmar "+label.toLowerCase()+" este reporte?"))return;b.disabled=true;try{await rpc("hh_pilot_review",{p_project:project,p_report:r.report_id,p_decision:decision,p_note:note.e.value});if(alive()){status.textContent="Revisión registrada en Supabase.";await listReports()}}catch{if(alive()){status.textContent="No fue posible registrar la revisión.";b.disabled=false}}};
      ctl.append(b);
     }
    }else ctl.textContent=r.own_report?"Reporte propio":"Sin acción disponible";
    return [r.day,r.program_code,r.logical_code,projectPhase(r.phase),({review:"Pendiente",validated:"Validado",returned:"Devuelto"})[r.state]??r.state,detail,ctl];
   });
   output.append(dataTable(["Fecha","Programa","Actividad","Fase","Estado","Detalle","Acción"],rows));
  }
  if(mode==="field"){
   const opts=await rpc("hh_pilot_options",{p_project:project});if(!alive())return;
   if(!opts.length){section.append(node("p","Catálogo no disponible.","notice"));return}
   const form=node("form"),grid=node("div",null,"grid");
   const phase=fieldControl("Proyecto al que corresponde el reporte","select",[["","Selecciona el proyecto"],...phaseRegistry.filter(p=>p.phase==="original"||p.phase==="expansion").map(p=>[p.phase,projectPhase(p.phase)])]);phase.e.required=true;
   const activity=fieldControl("Actividad del marco lógico","select",[]);activity.e.required=true;const phaseInfo=node("p", "Selecciona un proyecto para vincular su título al reporte.","section-caption");
   function updateActivities(){activity.e.replaceChildren();const blank=node("option","Selecciona una actividad");blank.value="";activity.e.append(blank);opts.forEach((o,i)=>{if(o.phase===phase.e.value){const x=node("option",o.program_label+" · "+o.logical_code+" · "+o.activity_label);x.value=String(i);activity.e.append(x)}});activity.e.disabled=!phase.e.value;phaseInfo.textContent=phase.e.value?projectPhase(phase.e.value):"Selecciona el proyecto para continuar.";}
   phase.e.onchange=updateActivities;updateActivities();
   const day=fieldControl("Fecha","date");day.e.value=dateLocal();day.e.max=dateLocal();day.e.required=true;
   const shift=fieldControl("Turno","select",[["AM","Mañana"],["PM","Tarde"]]);
   const slot=fieldControl("Sesión del turno (1–20)","number");slot.e.min="1";slot.e.max="20";slot.e.value="1";slot.e.required=true;
   const strategy=fieldControl("Estrategia de intervención","textarea");strategy.e.required=true;
   const outcome=fieldControl("Resultados observados","textarea"),challenges=fieldControl("Dificultades y limitaciones","textarea");
   const consent=node("label",null,"check"),check=node("input");check.type="checkbox";check.required=true;consent.append(check,document.createTextNode(" Confirmo que este registro corresponde a un ejercicio de validación y no contiene datos personales de participantes."));
   grid.append(phase.l,phaseInfo,activity.l,day.l,shift.l,slot.l,strategy.l,outcome.l,challenges.l);
   const button=node("button","Enviar reporte a revisión","btn wide");button.type="submit";
   const photoBlock=node("section",null,"card");photoBlock.append(node("h3","Evidencias fotográficas (opcional)"));const picker=evidencePicker(photoBlock);form.append(node("p","Espacio de validación · sede territorial pendiente de configuración","section-caption"),grid,photoBlock,consent,button);
   form.onsubmit=async e=>{e.preventDefault();if(!alive()||!check.checked)return;const o=opts[Number(activity.e.value)];if(!phase.e.value||activity.e.value===""||!o||o.phase!==phase.e.value){status.textContent="Selecciona el proyecto y su actividad.";return}let photos;try{photos=picker.get()}catch(err){status.textContent=err.message;return}button.disabled=true;try{await rpc("hh_pilot_submit_photos",{p_project:project,p_space:o.space_id,p_day:day.e.value,p_shift:shift.e.value,p_slot:Number(slot.e.value),p_phase:o.phase,p_program:o.program_code,p_activity:o.activity_key,p_logical:o.logical_code,p_strategy:strategy.e.value,p_outcome:outcome.e.value,p_challenges:challenges.e.value,p_photos:photos});if(alive()){picker.clear();strategy.e.value=outcome.e.value=challenges.e.value="";check.checked=false;status.textContent="Reporte guardado en PostgreSQL y enviado a coordinación.";await listReports()}}catch{if(alive())status.textContent="No se pudo guardar. Revisa el turno y número de sesión (no se admiten duplicados) o tus permisos."}finally{if(alive())button.disabled=false}};
   section.append(form,status,output);await listReports();
  }else if(mode==="coord"){
   const filterBox=node("section",null,"card"),grid=node("div",null,"grid");
   const from=fieldControl("Desde","date"),to=fieldControl("Hasta","date"),phase=fieldControl("Proyecto","select",[["","Todos"],...phaseRegistry.map(p=>[p.phase,phaseShort(p.phase)])]),program=fieldControl("Área de intervención","select",[["","Todas"],["EDU","Educación"],["PROT","Protección"],["WASH","WASH"]]),state=fieldControl("Estado","select",[["","Todos"],["review","Pendiente"],["validated","Validado"],["returned","Devuelto"]]);
   reportFilter={from,to,phase,program,state};grid.append(from.l,to.l,phase.l,program.l,state.l);const refresh=node("button","Consultar reportes","btn"),clear=node("button","Restablecer filtros","btn secondary");refresh.type=clear.type="button";
   const refreshList=async()=>{if(from.e.value&&to.e.value&&from.e.value>to.e.value){status.textContent="El período no es válido.";return}refresh.disabled=true;try{await listReports();if(alive())status.textContent="Consulta actualizada."}catch{if(alive())status.textContent="No se pudieron consultar los reportes."}finally{if(alive())refresh.disabled=false}};
   refresh.onclick=refreshList;clear.onclick=()=>{for(const f of Object.values(reportFilter))f.e.value="";refreshList()};const actions=node("div",null,"actions");actions.append(refresh,clear);filterBox.append(node("h2","Filtros de seguimiento"),grid,actions);section.append(filterBox,status,output);await listReports()
  }
  else{
   const filters=node("div",null,"grid"),from=fieldControl("Desde","date"),to=fieldControl("Hasta","date");to.e.value=dateLocal();from.e.value=to.e.value.slice(0,8)+"01";const b=node("button","Consultar resultados validados","btn");b.type="button";filters.append(from.l,to.l);section.append(filters,b,status,output);
   async function load(){if(!from.e.value||!to.e.value||from.e.value>to.e.value){status.textContent="Selecciona un período válido.";return}b.disabled=true;try{
    const rows=await rpc("hh_pilot_mera",{p_project:project,p_from:from.e.value,p_to:to.e.value});if(!alive())return;
    output.replaceChildren(metricCards([["Sesiones validadas · período",rows.reduce((n,r)=>n+Number(r.validated_period),0)],["Sesiones validadas · acumulado",rows.reduce((n,r)=>n+Number(r.validated_accumulated),0)],["Beneficiarios únicos","N/D"],["Asistencias","N/D"]]),programBars(rows.reduce((a,r)=>(a[r.program_code]=(a[r.program_code]||0)+Number(r.validated_period),a),{}),"Sesiones validadas por área"),node("p","Metas contractuales y alcance de participantes: pendientes de integración. No se estiman ni se sustituyen por cifras de ejemplo.","section-caption"),dataTable(["Programa","Actividad","Código","Fase","Meta","Período","Acumulado"],rows.map(r=>[r.program_code,r.activity_key,r.logical_code,projectPhase(r.phase),"N/D",r.validated_period,r.validated_accumulated])));
    status.textContent=rows.length?"Resultados consultados en PostgreSQL.":"No hay sesiones validadas para el período seleccionado.";
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
  if(!Array.isArray(rows))throw Error("Invalid access result");
  projects=rows;
  $("signin").hidden=true;$("enrollment").hidden=true;$("workspace").hidden=false;renderProjects();message(rows.length?"Sesión autenticada.":"Cuenta autenticada. Activando tu perfil.");await renderStaff(data.user?.user_metadata??{});if(epoch!==authEpoch)return;
  const requested=({campo:"field",coordinacion:"coord",mera:"mera"})[location.pathname.split("/").filter(Boolean).pop()];if(requested){const p=projects.find(x=>x.project_code==="EDUCO-SANDBOX"&&({field:x.field_access,coord:x.coord_access,mera:x.mera_access}[requested]));if(p)await openPilot(p.project_id,requested);else message("Tu cuenta no tiene permiso para este módulo.")}
  const duration=Math.min(15*60,Math.max(1,Number(data.expires_in)||60));expiryTimer=setTimeout(()=>reset("La sesión ha expirado. Vuelve a ingresar."),duration*1000);
 }catch(e){if(epoch===authEpoch)reset("No se pudo iniciar sesión o verificar los permisos. Revisa tus credenciales o contacta a administración.")}
});
$("show-signup").onclick=()=>{$("enrollment").hidden=false;$("signin").hidden=true;message("");$("signup-email").focus()};
$("show-login").onclick=()=>{$("enrollment").hidden=true;$("signin").hidden=false;$("signup-password").value="";$("signup-repeat").value="";message("")};
$("signup-form").addEventListener("submit",async e=>{
 e.preventDefault();const pass=$("signup-password").value,repeat=$("signup-repeat").value,email=$("signup-email").value.trim(),b=$("signup-submit");
 if(pass!==repeat||pass.length<12){message("Las contraseñas deben coincidir y tener al menos 12 caracteres.");return}
 b.disabled=true;
 try{
  await api("/auth/v1/signup?redirect_to="+encodeURIComponent("https://humanhub-sandbox.vercel.app/acceso"),"POST",{email,password:pass,data:{hh_name:$("signup-name").value.trim(),hh_specialty:$("signup-specialty").value.trim(),hh_title:$("signup-title").value.trim()}},null);
  $("signup-password").value=$("signup-repeat").value="";$("email").value=email;$("enrollment").hidden=true;$("signin").hidden=false;
  message("Cuenta solicitada. Confirma el correo e inicia sesión; tu acceso de campo se activará automáticamente. Si no llega, usa Reenviar confirmación.");
 }catch{message("No se pudo completar el registro. La cuenta puede existir o la configuración de correo puede requerir revisión. Contacta a administración.")}finally{b.disabled=false}
});
$("resend-confirmation").onclick=async()=>{const email=$("email").value.trim();if(!email||!$("email").checkValidity()){message("Introduce el correo de tu cuenta.");return}const b=$("resend-confirmation");b.disabled=true;try{await api("/auth/v1/resend?redirect_to="+encodeURIComponent("https://humanhub-sandbox.vercel.app/acceso"),"POST",{type:"signup",email},null);message("Solicitud de reenvío enviada. Revisa tu correo y spam.")}catch{message("No se pudo reenviar. Puede existir una restricción de envío; contacta a administración.")}finally{b.disabled=false}};
if(location.hash){history.replaceState(null,"",location.pathname+location.search);message("Si confirmaste tu correo, inicia sesión con tu contraseña.")}else if(location.pathname.replace(/\/+$/,"")==="/registro"){$("show-signup").click()}
$("logout").addEventListener("click",async()=>{const old=accessToken;reset("Sesión local cerrada.");if(old){try{await api("/auth/v1/logout","POST",undefined,old)}catch{message("Sesión local cerrada. No se pudo confirmar la revocación remota.")}}});
window.addEventListener("pagehide",()=>{reset("")});
