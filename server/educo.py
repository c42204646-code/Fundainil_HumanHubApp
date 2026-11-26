"""Educo MERA: reviewed snapshots, never sum unique people across spaces or phases."""
import json, uuid, csv, io
from datetime import date, datetime, timezone
from typing import Literal
from fastapi import Depends, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .educo_catalog import CATALOG, AGES, COMMUNITIES, ACTIVITIES

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")

Count = int
class Demography(Strict):
    age: Literal["3-5","6-9","10-13","14-17","18"]
    girls: int = Field(ge=0, strict=True)
    boys: int = Field(ge=0, strict=True)
    other: int = Field(ge=0, strict=True)
    disability: int = Field(ge=0, strict=True)
    @model_validator(mode="after")
    def check(self):
        if self.disability > self.girls+self.boys+self.other:
            raise ValueError("Discapacidad es subconjunto de NNA")
        return self

class Measurement(Strict):
    indicator: str
    real: int | None = Field(default=None, ge=0, strict=True)
    accumulated: int | None = Field(default=None, ge=0, strict=True)
    planned: int | None = Field(default=None, ge=0, strict=True)
    favorable: int | None = Field(default=None, ge=0, strict=True)
    evaluated: int | None = Field(default=None, gt=0, strict=True)
    evidence: str = Field(min_length=1,max_length=200)
    @model_validator(mode="after")
    def check(self):
        i=CATALOG.get(self.indicator)
        if not i: raise ValueError("Indicador desconocido")
        if i["kind"]=="rate":
            if self.favorable is None or self.evaluated is None or self.favorable>self.evaluated:
                raise ValueError("Porcentaje requiere favorable y evaluado válidos")
            if any(x is not None for x in (self.real,self.accumulated,self.planned)):
                raise ValueError("No mezclar conteos y porcentaje")
            if self.indicator=="route_rate" and self.evaluated!=4:
                raise ValueError("El denominador de SO.1 es cuatro espacios fijos")
        else:
            if self.real is None and self.accumulated is None:
                raise ValueError("Ingrese valor medido; vacío no equivale a cero")
            if self.favorable is not None or self.evaluated is not None:
                raise ValueError("Conteo no admite denominador")
            if i["kind"]!="stock" and self.real is not None and self.accumulated is not None and self.accumulated<self.real:
                raise ValueError("Acumulado no puede ser menor al real")
        return self

class Activity(Strict):
    day: date
    shift: Literal["AM","PM","Ambos"]
    code: str
    nna_attendance: int = Field(ge=0,strict=True)
    adult_attendance: int = Field(ge=0,strict=True)
    evidence: str = Field(min_length=1,max_length=200)

class Form(Strict):
    phase: Literal["original","expansion","integrated"]
    scope: Literal["community","project"]
    community: str | None = None
    modality: Literal["Fijo","Itinerante","Integrado"]
    period_type: Literal["Jornada","Semanal","Mensual","Corte"]
    start: date
    end: date
    team_code: str = Field(min_length=1,max_length=60)
    space_code: str = Field(min_length=1,max_length=60)
    space_status: Literal["Operativo","Parcial","No operativo","Por habilitar","No aplica"]
    conditions: dict[str,Literal["Sí","No","N/A"]] = Field(default_factory=dict,max_length=6)
    population: list[Demography] = Field(default_factory=list,max_length=5)
    schooling: dict[Literal["regular","intermitente","fuera","no_informado"],int] = Field(default_factory=dict)
    displacement: dict[Literal["desplazados","residentes","no_informado"],int] = Field(default_factory=dict)
    adult_counts: dict[Literal["caregivers","teachers","leaders"],dict[Literal["women","men","other"],int]] = Field(default_factory=dict)
    new_nna: int | None = Field(default=None,ge=0,strict=True)
    previous_nna: int | None = Field(default=None,ge=0,strict=True)
    nna_attendance: int | None = Field(default=None,ge=0,strict=True)
    activities: list[Activity] = Field(default_factory=list,max_length=200)
    measurements: list[Measurement] = Field(min_length=1,max_length=38)
    protection: dict[Literal["identified","referred","followed","feedback","resolved"],int] = Field(default_factory=dict)
    context: str = Field(default="",max_length=1500)
    results: str = Field(default="",max_length=1500)
    perception: str = Field(default="",max_length=1500)
    challenges: str = Field(default="",max_length=1500)
    next_steps: str = Field(default="",max_length=1500)
    materials: str = Field(default="",max_length=1000)
    evidence_ref: str = Field(min_length=1,max_length=200)
    @model_validator(mode="after")
    def reconcile(self):
        if self.start>self.end: raise ValueError("Período inválido")
        if self.scope=="community" and self.community not in COMMUNITIES:
            raise ValueError("Seleccione comunidad")
        if self.scope=="project" and self.community is not None:
            raise ValueError("Consolidado de proyecto no tiene comunidad")
        if len({x.indicator for x in self.measurements})!=len(self.measurements):
            raise ValueError("Indicador duplicado")
        if len({p.age for p in self.population})!=len(self.population):
            raise ValueError("Edad duplicada")
        if any(k not in ("agua","lavamanos","privacidad","accesibilidad","saneamiento","evacuacion") for k in self.conditions):
            raise ValueError("Condición desconocida")
        total=sum(p.girls+p.boys+p.other for p in self.population)
        for group in [self.schooling,self.displacement,self.protection,*self.adult_counts.values()]:
            if any(type(v) is not int or v<0 for v in group.values()):
                raise ValueError("Los conteos deben ser enteros no negativos")
        for group in (self.schooling,self.displacement):
            if group and (not self.population or sum(group.values())!=total):
                raise ValueError("Escolarización/desplazamiento deben cuadrar con NNA únicos")
        if (self.new_nna is None)!=(self.previous_nna is None):
            raise ValueError("Indicar nuevos y previamente atendidos juntos")
        if self.new_nna is not None and (not self.population or self.new_nna+self.previous_nna!=total):
            raise ValueError("Nuevos + previamente atendidos deben cuadrar con NNA únicos")
        if self.nna_attendance is not None and self.nna_attendance<total:
            raise ValueError("Asistencias no pueden ser inferiores a personas únicas")
        if self.protection.get("referred",0)>self.protection.get("identified",0) or self.protection.get("followed",0)>self.protection.get("identified",0) or self.protection.get("resolved",0)>self.protection.get("feedback",0):
            raise ValueError("Verifique los subconjuntos de protección y retroalimentación")
        for a in self.activities:
            allowed=ACTIVITIES["original"]+ACTIVITIES["expansion"] if self.phase=="integrated" else ACTIVITIES[self.phase]
            if a.code not in allowed or not self.start<=a.day<=self.end:
                raise ValueError("Código de actividad o fecha fuera de la fase/período")
        if self.activities and self.nna_attendance is not None and sum(a.nna_attendance for a in self.activities)!=self.nna_attendance:
            raise ValueError("Asistencias de actividades no coinciden con total reportado")
        m={x.indicator:x for x in self.measurements}
        if self.population:
            for key in ("coverage","education","psychosocial"):
                if key in m and m[key].real is not None and m[key].real>total:
                    raise ValueError("Indicador de personas supera total NNA del período")
            if "coverage" in m and m["coverage"].real is not None and m["coverage"].real!=total:
                raise ValueError("Cobertura debe coincidir con desglose NNA")
        for k,base in (("women_leaders","leaders"),("women_leaders","women")):
            if k in m and base in m:
                for f in ("real","accumulated"):
                    a,b=getattr(m[k],f),getattr(m[base],f)
                    if a is not None and b is not None and a>b: raise ValueError("Lideresas son subconjunto")
        if all(k in m for k in ("ps_sessions","ps_group","pap")):
            for f in ("real","accumulated"):
                a,b,c=(getattr(m[k],f) for k in ("ps_sessions","ps_group","pap"))
                if None not in (a,b,c) and a!=b+c: raise ValueError("Sesiones PS deben conciliar grupales e individuales")
        return self

class Review(Strict):
    confirmed: Literal[True]
    note: str = Field(min_length=1,max_length=500)

def install(app,db,manager,mutation,log,root):
    def init(con):
        con.execute("""CREATE TABLE IF NOT EXISTS educo_forms (
            id TEXT PRIMARY KEY, created TEXT NOT NULL, phase TEXT NOT NULL,
            scope TEXT NOT NULL, community TEXT, space_code TEXT NOT NULL,
            start TEXT NOT NULL,end TEXT NOT NULL,state TEXT NOT NULL,
            payload TEXT NOT NULL,review_note TEXT)""")
    def view(row):
        d=dict(row);d["payload"]=json.loads(d["payload"]);return d
    @app.get("/educo")
    def page(actor=Depends(manager)):
        return FileResponse(root/"intelligence"/"educo.html")
    @app.get("/intelligence/educo.js")
    def script(actor=Depends(manager)):
        return FileResponse(root/"intelligence"/"educo.js",media_type="text/javascript")
    @app.get("/api/educo/catalog")
    def catalog(actor=Depends(manager)):
        return {"indicators":list(CATALOG.values()),"ages":AGES,"communities":COMMUNITIES,"activities":ACTIVITIES,
                "warning":"Metas de ampliación son propuestas; aprobación contractual no verificada. Plan operativo 25/11–30/12 independiente. No sumar fases o comunidades como personas únicas."}
    @app.post("/api/educo/forms")
    def save(form:Form,actor=Depends(mutation)):
        fid=str(uuid.uuid4())
        with db() as con:
            init(con)
            con.execute("INSERT INTO educo_forms VALUES(?,?,?,?,?,?,?,?,?,?,NULL)",(
                fid,datetime.now(timezone.utc).isoformat(),form.phase,form.scope,form.community,
                form.space_code,form.start.isoformat(),form.end.isoformat(),"review",form.model_dump_json()))
            log(con,actor,"educo_form_created",fid)
        return {"id":fid,"state":"review"}
    @app.get("/api/educo/forms")
    def forms(actor=Depends(manager)):
        with db() as con:
            init(con)
            return [view(r) for r in con.execute("SELECT * FROM educo_forms ORDER BY created DESC LIMIT 200")]
    @app.post("/api/educo/forms/{fid}/review")
    def review(fid:str,data:Review,actor=Depends(mutation)):
        with db() as con:
            init(con)
            con.execute("BEGIN IMMEDIATE")
            r=con.execute("SELECT * FROM educo_forms WHERE id=? AND state='review'",(fid,)).fetchone()
            if not r: raise HTTPException(409,"Ficha no disponible para revisión")
            # A revised report for the exact same scope/period replaces its prior approved version.
            con.execute("""UPDATE educo_forms SET state='superseded' WHERE state='validated'
                AND phase=? AND scope=? AND community IS ? AND space_code=? AND start=? AND end=?""",
                (r["phase"],r["scope"],r["community"],r["space_code"],r["start"],r["end"]))
            con.execute("UPDATE educo_forms SET state='validated',review_note=? WHERE id=?",(data.note,fid))
            log(con,actor,"educo_form_validated",fid)
        return {"id":fid,"state":"validated"}
    @app.get("/api/educo/dashboard")
    def dashboard(phase:Literal["original","expansion","integrated"]="expansion",actor=Depends(manager)):
        with db() as con:
            init(con)
            # Use explicit project-wide deduplicated snapshots only. Do not sum communities or phases.
            rows=[view(r) for r in con.execute("""SELECT * FROM educo_forms
                WHERE state='validated' AND phase=? AND scope='project'
                ORDER BY end DESC, created DESC""",(phase,))]
        observed={}
        for r in rows:
            for m in r["payload"]["measurements"]:
                if m["indicator"] not in observed:
                    observed[m["indicator"]]=dict(m,cutoff=r["end"],form_id=r["id"])
        result=[]
        for code,i in CATALOG.items():
            obs=observed.get(code)
            target=i.get(phase)
            value=None
            if obs:
                if i["kind"]=="rate": value=round(100*obs["favorable"]/obs["evaluated"],2)
                else: value=obs["accumulated"]
            result.append(dict(i,target=target,value=value,measurement=obs))
        return {"phase":phase,"indicators":result,"note":"Último consolidado validado por indicador. Sin consolidado acumulado: no disponible. Los cortes pueden diferir; no se agregan espacios ni fases."}
    @app.get("/api/educo/export.csv")
    def export(phase:Literal["original","expansion","integrated"]="expansion",actor=Depends(manager)):
        data=dashboard(phase,actor)
        buf=io.StringIO(); w=csv.writer(buf)
        w.writerow(["Fase","Código","Indicador","Tipo","Meta referencia","Valor validado","Fecha corte","Fuente verificación"])
        def safe(s):
            return "'"+s if isinstance(s,str) and s.lstrip().startswith(("=","+","-","@")) else s
        for row in data["indicators"]:
            m=row["measurement"] or {}
            w.writerow([safe(x) for x in (phase,row["code"],row["label"],row["kind"],row["target"],row["value"],m.get("cutoff"),m.get("evidence"))])
        return Response("\ufeff"+buf.getvalue(),media_type="text/csv",headers={"Content-Disposition":"attachment; filename=educo-indicadores.csv"})
