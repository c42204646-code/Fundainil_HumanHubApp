"use strict";
const $=id=>document.getElementById(id), form=$("form");
const say=t=>{$("message").textContent=t};
const make=(tag,t="")=>{const e=document.createElement(tag);e.textContent=t;return e};
const add=(parent,...items)=>{parent.append(...items);return parent};
let catalog;
async function api(path,data){
 const r=await fetch("/api/educo/"+path,data===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json","X-HumanHub":"v2"},body:JSON.stringify(data)});
 const b=await r.json();if(!r.ok)throw Error(typeof b.detail==="string"?b.detail:JSON.stringify(b.detail));return b;
}
function num(name){const i=make("input");i.type="number";i.min="0";i.step="1";i.name=name;i.setAttribute("aria-label",name);return i}
function val(i){if(i.value==="")return null;const v=Number(i.value);if(!Number.isSafeInteger(v)||v<0)throw Error("Conteo inválido: "+i.name);return v}
function label(t,i){return add(make("label",t),i)}
function select(name,values){const e=make("select");e.name=name;for(const [v,t] of values){const o=make("option",t);o.value=v;e.append(o)}return e}
function fields(id,map){for(const [k,t] of Object.entries(map))$(id).append(label(t,num(id+"_"+k)))}
function readGroup(id){return Object.fromEntries([...$(id).querySelectorAll("input")].filter(i=>i.value!=="").map(i=>[i.name.slice(id.length+1),val(i)]))}
function rowFields(container,rows,keys){
 for(const [id,t] of rows){const tr=make("tr");tr.dataset.key=id;tr.append(make("td",t));for(const k of keys){const i=num(k);i.setAttribute("aria-label",t+" "+k);tr.append(add(make("td"),i))}container.append(tr)}
}
function readRows(id){return [...$(id).querySelectorAll("tr")].flatMap(tr=>{const inputs=[...tr.querySelectorAll("input")];if(inputs.every(i=>i.value===""))return [];if(inputs.some(i=>i.value===""))throw Error("Completa todos los campos de la fila "+tr.dataset.key+" o déjala vacía.");return [[tr.dataset.key,Object.fromEntries(inputs.map(i=>[i.name,val(i)]))]]})}
function total(){try{$("total").textContent="NNA únicos registrados: "+readRows("population").reduce((s,[,r])=>s+r.girls+r.boys+r.other,0)}catch{$("total").textContent="Completa el desglose para calcular el total."}}
function display(v,kind){return v===null||v===undefined?"N/D":v.toLocaleString("es-VE")+(kind==="rate"?" %":"")}
function phaseLabel(p){return {original:"VE3501",expansion:"Ampliación",integrated:"Integrado"}[p]||p}
function panel(id){for(const key of ["dash","record","review"])$(key).hidden=key!==id;if(id==="dash")dashboard().catch(e=>say(e.message));if(id==="review")history().catch(e=>say(e.message))}
document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>panel(b.dataset.panel)));
async function dashboard(){
 const phase=$("dash-phase").value,d=await api("dashboard?phase="+encodeURIComponent(phase));
 $("dashboard-note").textContent=d.note;
 $("csv").href="/api/educo/export.csv?phase="+encodeURIComponent(phase);
 $("kpis").replaceChildren(...["coverage","education","psychosocial","school_kits","menstrual_kits","ps_sessions"].map(id=>d.indicators.find(x=>x.id===id)).filter(Boolean).map(x=>{const div=make("div");div.className="metric";return add(div,make("small",x.label),make("strong",display(x.value,x.kind)),make("small","Meta de referencia: "+display(x.target,x.kind)))}));
 $("indicators").replaceChildren(...d.indicators.map(i=>{
 const tr=make("tr"),progress= i.target>0&&i.value!==null?Math.round(i.value/i.target*100):null;
 const bar=make("td",progress===null?"N/D":progress+" %");if(progress!==null){const p=make("progress");p.max=100;p.value=Math.min(progress,100);p.setAttribute("aria-label","Cumplimiento");bar.append(p)}
 return add(tr,add(make("td"),make("strong",i.code),make("div",i.label)),make("td",display(i.target,i.kind)),make("td",display(i.operational,i.kind)),make("td",display(i.value,i.kind)),bar,make("td",i.measurement?i.measurement.evidence+" · "+i.measurement.cutoff:i.evidence));
 }));
}
function setup(){
 $("warning").textContent=catalog.warning;
 $("community").replaceChildren(...catalog.communities.map(c=>{const o=make("option",c);o.value=c;return o}));
 const scope=form.elements.scope;
 function scopeChange(){const project=scope.value==="project";$("community").disabled=project;if(project){form.elements.space_code.value="CONSOLIDADO";form.elements.space_code.readOnly=true;form.elements.modality.value="Integrado";}else{form.elements.space_code.readOnly=false;if(form.elements.space_code.value==="CONSOLIDADO")form.elements.space_code.value="";}}
 scope.addEventListener("change",scopeChange);
 for(const [k,t] of Object.entries({agua:"Agua segura",lavamanos:"Lavamanos",privacidad:"Privacidad",accesibilidad:"Accesibilidad",saneamiento:"Saneamiento",evacuacion:"Ruta de evacuación"}))$("conditions").append(label(t,select(k,[["N/A","No evaluado"],["Sí","Sí"],["No","No"]])));
 rowFields($("population"),catalog.ages.map(x=>[x,x]),["girls","boys","other","disability"]);$("population").addEventListener("input",total);
 rowFields($("adults"),[["caregivers","Cuidadores"],["teachers","Docentes / facilitadores"],["leaders","Líderes / voluntarios"]],["women","men","other"]);
 fields("school",{regular:"Escolarizados regulares",intermitente:"Asistencia intermitente",fuera:"Fuera de escuela",no_informado:"Escolarización N.I."});
 fields("displacement",{desplazados:"Desplazados",residentes:"Residentes",no_informado:"Desplazamiento N.I."});
 fields("protection",{identified:"Casos identificados",referred:"Derivaciones activadas",followed:"Con seguimiento",feedback:"Quejas y sugerencias",resolved:"Resueltas"});
 for(const i of catalog.indicators){
  const d=make("details");d.className="measure";d.dataset.indicator=i.id;
  const check=make("input");check.type="checkbox";check.name="enabled";const checkboxLabel=label("Registrar medición",check);checkboxLabel.className="check";
  const grid=make("div");grid.className="grid";
  if(i.kind==="rate"){grid.append(label("N.º favorable",num("favorable")),label("N.º evaluado",num("evaluated")))}
  else{grid.append(label("Meta del período",num("planned")),label(i.kind==="stock"?"Unidades al cierre del período":"Real del período",num("real")),label(i.kind==="stock"?"Total funcional al corte":"Acumulado depurado",num("accumulated")))}
  const ref=make("input");ref.name="evidence";ref.maxLength=200;
  d.append(make("summary",i.code+" · "+i.label),make("p",i.evidence+" | Metas: original "+display(i.original,i.kind)+" / ampliación "+display(i.expansion,i.kind)),checkboxLabel,grid,label("Fuente de verificación",ref));$("measures").append(d);
 }
 $("add-activity").addEventListener("click",()=>{const a=make("div");a.className="activity grid";const day=make("input");day.type="date";day.name="day";day.required=true;const ref=make("input");ref.name="evidence";ref.required=true;ref.maxLength=200;
 const p=form.elements.phase.value, codes=p==="integrated"?[...catalog.activities.original,...catalog.activities.expansion]:catalog.activities[p];const del=make("button","Quitar");del.type="button";del.addEventListener("click",()=>a.remove());
 a.append(label("Fecha",day),label("Turno",select("shift",[["AM","AM"],["PM","PM"],["Ambos","Ambos"]])),label("Actividad",select("code",codes.map(c=>[c,c]))),label("Asistencias NNA",num("nna_attendance")),label("Asistencias adultos",num("adult_attendance")),label("FFVV",ref),del);$("activities").append(a)});
 form.elements.phase.addEventListener("change",()=>{if($("activities").children.length){say("Revisa los códigos de actividad tras cambiar de fase; el servidor validará.");}});
}
function payload(){
 const x=form.elements;
 const p={phase:x.phase.value,scope:x.scope.value,community:x.scope.value==="project"?null:x.community.value,modality:x.modality.value,period_type:x.period_type.value,space_status:x.space_status.value};
 for(const key of ["start","end","space_code","team_code","context","results","perception","challenges","next_steps","materials","evidence_ref"])p[key]=x[key].value.trim();
 p.conditions=Object.fromEntries([...$("conditions").querySelectorAll("select")].map(e=>[e.name,e.value]));
 p.population=readRows("population").map(([age,r])=>({age,...r}));
 p.adult_counts=Object.fromEntries(readRows("adults"));p.schooling=readGroup("school");p.displacement=readGroup("displacement");p.protection=readGroup("protection");
 for(const k of ["new_nna","previous_nna","nna_attendance"])p[k]=val(x[k]);
 p.activities=[...$("activities").children].map(a=>Object.fromEntries([...a.querySelectorAll("input,select")].map(e=>[e.name,e.type==="number"?val(e):e.value])));
 p.measurements=[...$("measures").children].filter(d=>d.querySelector("[name=enabled]").checked).map(d=>({indicator:d.dataset.indicator,...Object.fromEntries([...d.querySelectorAll("input:not([type=checkbox])")].map(e=>[e.name,e.type==="number"?val(e):e.value.trim()]))}));
 return p;
}
form.addEventListener("submit",async e=>{e.preventDefault();const b=form.querySelector("button[type=submit]")||form.lastElementChild;b.disabled=true;try{const result=await api("forms",payload());say("Ficha guardada para revisión: "+result.id);form.reset();$("activities").replaceChildren();form.elements.scope.dispatchEvent(new Event("change"));total();panel("review")}catch(err){say(err.message)}finally{b.disabled=false}});
async function history(){
 const rows=await api("forms");
 $("forms").replaceChildren(...rows.map(r=>{
  const p=r.payload,a=make("article"),d=make("details");
  d.append(make("summary","Consultar ficha completa"),make("pre",JSON.stringify(p,null,2)));
  a.append(make("h3",phaseLabel(r.phase)+" · "+(r.community||"Consolidado del proyecto")),make("p",r.start+" al "+r.end+" · "+r.state+" · "+r.space_code),d);
  if(r.state==="review"){const b=make("button","Validar ficha");b.addEventListener("click",async()=>{const note=prompt("Confirma que contrastaste los registros, fuentes y ausencia de duplicidades. Indica nota de revisión:");if(!note||!note.trim())return;b.disabled=true;try{await api("forms/"+encodeURIComponent(r.id)+"/review",{confirmed:true,note:note.trim()});say("Ficha validada.");await history()}catch(e){say(e.message);b.disabled=false}});a.append(b)}
  if(r.review_note)a.append(make("p","Revisión: "+r.review_note));return a;
 }));
 if(!rows.length)$("forms").textContent="No hay fichas registradas.";
}
$("dash-phase").addEventListener("change",()=>dashboard().catch(e=>say(e.message)));
$("reload").addEventListener("click",()=>history().catch(e=>say(e.message)));
(async()=>{try{catalog=await api("catalog");setup();await dashboard()}catch(e){say(e.message)}})();
