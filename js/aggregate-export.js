const button=document.getElementById("hh-export-aggregate");
button?.addEventListener("click",()=>{
 try {
  const rows=JSON.parse(localStorage.getItem("humanhub_bd_reportes")||"[]");
  if(!Array.isArray(rows))throw Error("Formato local inválido.");
  if(!rows.length)throw Error("No hay registros locales para exportar.");
  const result=rows.map(r=>({id:String(r.id),fecha:r.fecha,sector:String(r.sectorNombre||r.sectorId||""),actividad:String(r.actividad||""),poblacion:r.poblacion.map(p=>({grupo:String(p.grupo),f_nor:p.f_nor,f_r:p.f_r,m_nor:p.m_nor,m_r:p.m_r})),totalAlcanzado:r.totalAlcanzado}));
  if(!confirm("Comprueba que sector y actividad no contienen datos personales. Se excluyen fotos, GPS, nombres, testimonios y casos. Los registros no están validados por coordinación. ¿Exportar?"))return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="humanhub-agregados.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){alert("No se pudo exportar: "+e.message);}
});