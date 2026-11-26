"use strict";
const $=id=>document.getElementById(id);
const say=msg=>{$("message").textContent=msg;};
async function api(path,data){
 const options=data===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json","X-HumanHub":"v2"},body:JSON.stringify(data)};
 const res=await fetch("/api/"+path,options);
 const body=await res.json();
 if(!res.ok)throw Error(typeof body.detail==="string"?body.detail:JSON.stringify(body.detail||body));
 return body;
}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el}
function tasks(){const list=$("agent").value==="ATLAS"?[["informe","Informe narrativo"],["seguimiento","Seguimiento"]]:[["convocatorias","Convocatorias"],["elegibilidad","Elegibilidad"]];$("task").replaceChildren(...list.map(([v,t])=>{const e=node("option",t);e.value=v;return e}))}
$("agent").addEventListener("change",tasks);tasks();
async function refresh(){
 const [status,projects,jobs]=await Promise.all([api("status"),api("projects"),api("jobs")]);
 $("status").textContent="IA: "+(status.ai?"configurada":"pendiente")+" · Correo: "+(status.mail?"configurado":"pendiente");
 $("projects").textContent=projects.map(p=>p.project+": "+p.records+" registros").join(" · ")||"Sin registros importados.";
 $("jobs").replaceChildren(...jobs.map(j=>{
 const a=node("article","");a.append(node("h3",j.agent+" · "+j.project+" · "+j.spec.task),node("p","Estado: "+j.state+" | "+j.created));
 if(j.narrative){const details=node("details","");details.append(node("summary","Revisar narrativa y evidencia"),node("pre",j.narrative),node("pre",JSON.stringify(j.evidence,null,2)));a.append(details);
 for(const fmt of j.agent==="ATLAS"?["pdf","docx","xlsx"]:["pdf","docx"]){const l=node("a",fmt.toUpperCase());l.className="download";l.href="/api/jobs/"+encodeURIComponent(j.id)+"/files/"+fmt;a.append(l);}
 if(["review","approved"].includes(j.state)){const b=node("button","Preparar correo");b.className="secondary";b.addEventListener("click",()=>{const f=$("mail");f.elements.jid.value=j.id;f.elements.recipient.value=j.recipient||"";f.elements.subject.value=j.subject||"HumanHub | "+j.project+" | "+j.spec.task;f.elements.body.value=j.body||"Estimado equipo:\n\nSe adjunta el documento correspondiente para su conocimiento y seguimiento.\n\nSaludos cordiales,\nFUNDAINIL";f.elements.confirmed.checked=false;$("mailpanel").hidden=false;$("mailpanel").scrollIntoView();});a.append(b);}}
 return a;
 }));
}
function run(form,fn){form.addEventListener("submit",async e=>{e.preventDefault();const btn=form.querySelector("button");btn.disabled=true;say("Procesando…");try{await fn(form);await refresh()}catch(err){say(err.message)}finally{btn.disabled=false}})}
run($("import"),async f=>{const data=JSON.parse(await f.elements.file.files[0].text());if(!Array.isArray(data))throw Error("El archivo debe contener una lista de registros agregados.");const result=await api("import",{project:f.elements.project.value,reports:data});say("Registros nuevos: "+result.inserted+" de "+result.received);});
run($("job"),async f=>{const data=Object.fromEntries(new FormData(f));const j=await api("jobs",data);say("Trabajo generado para revisión: "+j.id)});
run($("mail"),async f=>{const data=Object.fromEntries(new FormData(f));const jid=data.jid;delete data.jid;data.confirmed=f.elements.confirmed.checked;await api("jobs/"+encodeURIComponent(jid)+"/approve",data);await api("jobs/"+encodeURIComponent(jid)+"/send",{});$("mailpanel").hidden=true;say("El servidor SMTP aceptó el correo.");});
$("refresh").addEventListener("click",()=>refresh().catch(e=>say(e.message)));refresh().catch(e=>say(e.message));