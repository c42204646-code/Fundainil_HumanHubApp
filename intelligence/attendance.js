"use strict";
const $=id=>document.getElementById(id), make=(tag,text="")=>{const e=document.createElement(tag);e.textContent=text;return e};
const say=text=>{$("message").textContent=text};
let config, generation=0;
async function request(path,options={}){
 const r=await fetch("/api/educo/attendance/"+path,options);
 if(!r.ok){let msg="Error "+r.status;try{const b=await r.json();msg=typeof b.detail==="string"?b.detail:msg}catch{}throw Error(msg)}
 return r.json();
}
const post=(path,data)=>request(path,{method:"POST",headers:{"Content-Type":"application/json","X-HumanHub":"v2"},body:JSON.stringify(data)});
function clearImage(){
 generation++;$("preview").width=1;$("preview").height=1;$("preview").hidden=true;
 $("camera").value="";$("gallery").value="";$("transcription").value="";$("scan").disabled=true;
}
function fillSelect(id,values){$(id).replaceChildren(...values.map(v=>{const o=make("option",v);o.value=v;return o}))}
async function loadImage(input){
 const file=input.files[0];if(!file)return;
 const g=++generation;
 $("transcription").value="";$("codes").value="";$("batch").elements.checked_rows.checked=false;updateCount();
 $("scan").disabled=true;$("preview").hidden=true;
 try{
 if(file.size>25_000_000)throw Error("Imagen demasiado grande; use una fotografía de menor tamaño.");
 const img=await createImageBitmap(file);
 if(g!==generation){img.close();return}
 const scale=Math.min(1,2400/Math.max(img.width,img.height));
 const c=$("preview");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
 c.getContext("2d").drawImage(img,0,0,c.width,c.height);img.close();c.hidden=false;
 $("scan").disabled=!config.enabled||!config.ocr_local;say("Foto preparada. Puede transcribirla o corregir manualmente.");
 }catch(e){say("No fue posible abrir la imagen. Use JPG, PNG o WEBP. "+e.message)}
}
for(const id of ["camera","gallery"])$(id).addEventListener("change",()=>loadImage($(id)));
$("clear").addEventListener("click",clearImage);
$("scan").addEventListener("click",async()=>{
 const g=generation,b=$("scan");b.disabled=true;say("Transcribiendo en el servidor local…");
 try{
 let blob=await new Promise(resolve=>$("preview").toBlob(resolve,"image/jpeg",.86));
 if(blob&&blob.size>1_900_000)blob=await new Promise(resolve=>$("preview").toBlob(resolve,"image/jpeg",.60));
 if(!blob||blob.size>1_900_000)throw Error("Foto demasiado grande. Reduzca su resolución.");
 const data=await request("ocr",{method:"POST",headers:{"Content-Type":"image/jpeg","X-HumanHub":"v2"},body:blob});
 if(g!==generation)return;
 $("transcription").value=data.text;$("codes").value=data.codes.join("\n");
 $("batch").elements.checked_rows.checked=false;updateCount();say(data.warning);
 }catch(e){if(g===generation)say(e.message)}finally{if(g===generation)b.disabled=!config.enabled||!config.ocr_local}
});
$("extract").addEventListener("click",()=>{
 const codes=$("transcription").value.toUpperCase().match(/\bHH-[A-F0-9]{12}\b/g)||[];
 $("codes").value=codes.join("\n");$("batch").elements.checked_rows.checked=false;updateCount();
 say("Códigos extraídos: "+codes.length+". Compare todas las filas con la lista, incluso las no reconocidas.");
});
function readCodes(){return $("codes").value.toUpperCase().split(/\s+/).filter(Boolean)}
function updateCount(){const a=readCodes();$("count").textContent=a.length+" filas · "+new Set(a).size+" códigos distintos · "+(a.length-new Set(a).size)+" repetidos en esta lista"}
$("codes").addEventListener("input",()=>{$("batch").elements.checked_rows.checked=false;updateCount()});
function submit(id,fn){$(id).addEventListener("submit",async e=>{e.preventDefault();const b=$(id).querySelector("button");b.disabled=true;try{await fn($(id))}catch(e){say(e.message)}finally{b.disabled=!config?.enabled&&id!=="summary"}})}
submit("register",async f=>{
 const data=await post("participants",{category:f.elements.category.value,confirmed_new:f.elements.confirmed_new.checked});
 $("issued").textContent="Código emitido: "+data.code+". Vincúlelo en el padrón protegido y reutilícelo.";f.reset();say("Código creado. No se registró asistencia.");
});
submit("batch",async f=>{
 const x=f.elements,codes=readCodes();
 if(codes.length!==new Set(codes).size)throw Error("Hay filas duplicadas. Corrija y vuelva a validar.");
 if(codes.some(c=>!/^HH-[A-F0-9]{12}$/.test(c)))throw Error("Solo códigos HH válidos; no introduzca nombres ni cédulas.");
 if(!x.checked_rows.checked)throw Error("La revisión de filas es obligatoria.");
 const session={phase:x.phase.value,community:x.community.value,space:x.space.value.trim().toUpperCase(),day:x.day.value,shift:x.shift.value,slot:Number(x.slot.value),service:x.service.value};
 const result=await post("batches",{session,codes,evidence_ref:x.evidence_ref.value.trim()});
 clearImage();$("codes").value="";x.checked_rows.checked=false;updateCount();say("Borrador guardado: "+result.id+". Aún no cuenta como asistencia.");if(config.role==="review")await history();
});
async function history(){
 const rows=await request("batches");
 $("batches").replaceChildren(...rows.map(r=>{
 const a=make("article"),p=r.payload,s=p.session;
 a.append(make("h3",s.community+" · "+s.day+" · "+s.shift+" / "+s.slot),make("p",s.service+" | "+s.phase+" | "+p.evidence_ref+" | "+r.state+" | "+p.codes.length+" códigos"));
 const d=make("details");d.append(make("summary","Revisar códigos"),make("pre",p.codes.join("\n")));a.append(d);
 if(r.state==="review"&&config.enabled){
 for(const [action,label] of [["approve","Aprobar e incorporar"],["discard","Descartar borrador"]]){
 const b=make("button",label);b.type="button";b.addEventListener("click",async()=>{if(!confirm(action==="approve"?"¿Contrastaste todos los códigos con la lista original y el padrón?":"¿Descartar este borrador?"))return;b.disabled=true;try{const res=await post("batches/"+encodeURIComponent(r.id)+"/"+action,{confirmed:true});say(action==="approve"?"Incorporadas: "+res.inserted+" · Ya registradas: "+res.repeated:"Borrador descartado.");await history()}catch(e){say(e.message);b.disabled=false}});a.append(b);
 }}
 if(r.state==="validated")a.append(make("p","Nuevas asistencias: "+r.inserted+" · Repetidas omitidas: "+r.repeated));return a;
 }));
 if(!rows.length)$("batches").textContent="Sin listas registradas.";
}
submit("summary",async f=>{
 const q=new URLSearchParams(new FormData(f)),res=await request("summary?"+q.toString()),d=res.data;
 const el=$("summary-result");el.replaceChildren();
 if(!d){el.textContent="No hay listas validadas para ese período.";return}
 el.append(make("h3",d.people+" personas únicas · "+d.attendances+" asistencias · "+d.sessions+" sesiones"),make("p",d.note));
 for(const row of d.categories)el.append(make("p",row.category+": "+row.people+" personas únicas / "+row.attendances+" asistencias"));
 for(const row of d.services)el.append(make("p",row.service+" · "+row.category+": "+row.people+" personas únicas / "+row.attendances+" asistencias"));
});
$("refresh").addEventListener("click",()=>history().catch(e=>say(e.message)));
window.addEventListener("pagehide",()=>{clearImage();$("codes").value="";$("issued").textContent=""});
(async()=>{try{
 config=await request("config");fillSelect("community",config.communities);fillSelect("service",config.services);
 const reviewing=config.role==="review";
 for(const id of ["register-panel","review-panel","summary-panel","back-mera"])$(id).hidden=!reviewing;
 for(const id of ["capture-panel","draft-panel"])$(id).hidden=reviewing;
 $("availability").textContent=(reviewing?"Revisión":"Captura")+" · "+(config.enabled?"Piloto habilitado":"Piloto desactivado por defecto")+" · OCR local "+(config.ocr_local?"instalado":"pendiente");
 for(const id of ["register","batch"])$(id).querySelector("button").disabled=!config.enabled;
 if(reviewing)await history();updateCount();
 }catch(e){say(e.message)}})();
