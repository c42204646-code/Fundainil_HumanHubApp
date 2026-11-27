"""Local OCR and reviewed coded attendance. Never persist images or raw transcription."""
import io, os, re, shutil, subprocess, uuid, warnings, hmac
from datetime import date, datetime, timezone
from typing import Literal
from fastapi import Depends, HTTPException, Request, Header
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .educo_catalog import COMMUNITIES

CODE = re.compile(r"^HH-[A-F0-9]{12}$")
SERVICES = ["Educación","Apoyo psicosocial","Protección","WASH","Orientación familiar","Formación comunitaria","Autocuidado","Otro"]
MAX_IMAGE=1_900_000
MAX_PIXELS=12_000_000

def timestamp():
    return datetime.now(timezone.utc).isoformat()

def init(con):
    con.execute("""CREATE TABLE IF NOT EXISTS educo_participants (
        code TEXT PRIMARY KEY, category TEXT NOT NULL, created TEXT NOT NULL)""")
    con.execute("""CREATE TABLE IF NOT EXISTS educo_sessions (
        id TEXT PRIMARY KEY, phase TEXT NOT NULL, community TEXT NOT NULL,
        space TEXT NOT NULL, day TEXT NOT NULL, shift TEXT NOT NULL, slot INTEGER NOT NULL,
        service TEXT NOT NULL, UNIQUE(community,space,day,shift,slot))""")
    con.execute("""CREATE TABLE IF NOT EXISTS educo_attendance_batches (
        id TEXT PRIMARY KEY, created TEXT NOT NULL, state TEXT NOT NULL,
        payload TEXT NOT NULL, reviewed_at TEXT, inserted INTEGER, repeated INTEGER)""")
    con.execute("""CREATE TABLE IF NOT EXISTS educo_attendance (
        session_id TEXT NOT NULL, code TEXT NOT NULL, batch_id TEXT NOT NULL,
        PRIMARY KEY(session_id,code),
        FOREIGN KEY(session_id) REFERENCES educo_sessions(id),
        FOREIGN KEY(code) REFERENCES educo_participants(code),
        FOREIGN KEY(batch_id) REFERENCES educo_attendance_batches(id))""")

class Strict(BaseModel):
    model_config=ConfigDict(extra="forbid")
class Register(Strict):
    category: Literal["NNA","Adulto"]
    confirmed_new: Literal[True]
class Session(Strict):
    phase: Literal["original","expansion","shared"]
    community: str
    space: str=Field(pattern=r"^[A-Z0-9_-]{1,40}$")
    day: date
    shift: Literal["AM","PM"]
    slot: int=Field(ge=1,le=20,strict=True)
    service: str
    @model_validator(mode="after")
    def check(self):
        if self.community not in COMMUNITIES or self.service not in SERVICES:
            raise ValueError("Comunidad o servicio inválido")
        return self

class Batch(Strict):
    session: Session
    codes: list[str]=Field(min_length=1,max_length=250)
    evidence_ref: str=Field(pattern=r"^[A-Za-z0-9_-]{1,100}$")
    @model_validator(mode="after")
    def check(self):
        if any(not CODE.fullmatch(c) for c in self.codes):
            raise ValueError("Código inválido: formato HH-XXXXXXXXXXXX")
        if len(set(self.codes))!=len(self.codes):
            raise ValueError("Código repetido en lista; corrige antes de guardar")
        return self

class Review(Strict):
    confirmed: Literal[True]

def validate_codes(con,codes):
    found={r["code"] for r in con.execute("SELECT code FROM educo_participants WHERE code IN ("+",".join("?" for _ in codes)+")",codes)}
    missing=set(codes)-found
    if missing:
        raise HTTPException(422,"Hay códigos no registrados. Verifique el padrón y no invente identificadores.")

def same_session(con,s):
    return con.execute("""SELECT * FROM educo_sessions WHERE community=? AND space=? AND day=? AND shift=? AND slot=?""",
        (s.community,s.space,s.day.isoformat(),s.shift,s.slot)).fetchone()

def check_session(row,s):
    if row and (row["phase"]!=s.phase or row["service"]!=s.service):
        raise HTTPException(409,"Ese espacio, fecha, turno y número ya corresponden a otra fase o servicio. Revise la sesión existente.")

def aggregate(con,start,end,phase="integrated"):
    exists=con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='educo_attendance'").fetchone()
    if not exists: return None
    args=[start,end]
    condition="s.day BETWEEN ? AND ?"
    if phase!="integrated":
        # Shared activity is included only in integrated, avoiding invented funding attribution.
        condition+=" AND s.phase=?";args.append(phase)
    base=" FROM educo_attendance a JOIN educo_sessions s ON s.id=a.session_id JOIN educo_participants p ON p.code=a.code WHERE "+condition
    total=con.execute("SELECT COUNT(*) AS attendances,COUNT(DISTINCT a.code) AS people,COUNT(DISTINCT s.id) AS sessions"+base,args).fetchone()
    if not total["attendances"]: return None
    categories=[dict(r) for r in con.execute("SELECT p.category,COUNT(*) AS attendances,COUNT(DISTINCT a.code) AS people"+base+" GROUP BY p.category",args)]
    services=[dict(r) for r in con.execute("SELECT s.service,p.category,COUNT(*) AS attendances,COUNT(DISTINCT a.code) AS people"+base+" GROUP BY s.service,p.category",args)]
    return {"phase":phase,"start":start,"end":end,**dict(total),"categories":categories,"services":services,
        "note":"Solo listas aprobadas y registradas en este módulo. Personas distintas por código estable; no sumar servicios ni fases. No equivale a cobertura contractual completa."}

def local_ocr(data):
    if len(data)>MAX_IMAGE or not data:
        raise HTTPException(413,"Imagen vacía o demasiado grande")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error",Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as img:
                if img.format not in ("JPEG","PNG","WEBP") or img.width*img.height>MAX_PIXELS:
                    raise HTTPException(422,"Formato o resolución no admitida")
                clean=ImageOps.autocontrast(ImageOps.grayscale(ImageOps.exif_transpose(img)))
                clean.thumbnail((2500,2500))
                buf=io.BytesIO();clean.save(buf,format="PNG")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422,"Imagen no legible")
    if not shutil.which("tesseract"):
        raise HTTPException(503,"OCR local no instalado. Puede transcribir manualmente.")
    # stdin/stdout only; no photos, filenames, or full OCR text in the DB or external APIs.
    try:
        p=subprocess.run(["tesseract","stdin","stdout","-l","spa+eng","--psm","6"],
                         input=buf.getvalue(),capture_output=True,timeout=30,check=True,
                         env={**os.environ,"OMP_THREAD_LIMIT":"1"})
    except (subprocess.TimeoutExpired,subprocess.CalledProcessError,OSError):
        raise HTTPException(503,"No se pudo transcribir localmente. Revise el motor OCR o use captura manual.")
    text=p.stdout.decode("utf-8",errors="replace")[:30000]
    codes=re.findall(r"\bHH-[A-F0-9]{12}\b",text.upper())
    return {"text":text,"codes":codes,"warning":"Transcripción preliminar. Compare cada fila con la foto; no se registró asistencia."}

def install(app,db,manager,mutation,log,root):
    basic=HTTPBasic()
    def access(c:HTTPBasicCredentials=Depends(basic)):
        # Dedicated capture account; managerial credentials stay separate.
        u,p=os.getenv("HH_MANAGER_USER"),os.getenv("HH_MANAGER_PASSWORD")
        cu,cp=os.getenv("HH_CAPTURE_USER"),os.getenv("HH_CAPTURE_PASSWORD")
        def match(user,password):
            return bool(user and password and len(password)>=20 and
                hmac.compare_digest(c.username.encode(),user.encode()) and
                hmac.compare_digest(c.password.encode(),password.encode()))
        if match(u,p): return {"actor":u,"role":"review"}
        if cu!=u and cp!=p and match(cu,cp): return {"actor":cu,"role":"capture"}
        raise HTTPException(401,"Acceso no autorizado",headers={"WWW-Authenticate":"Basic"})
    def allowed(auth=Depends(access),x_humanhub:str=Header(default="")):
        if x_humanhub!="v2": raise HTTPException(403,"Cabecera de seguridad requerida")
        if os.getenv("HH_ATTENDANCE_ENABLED")!="1":
            raise HTTPException(503,"Piloto desactivado; habilitar solo para pruebas autorizadas.")
        return auth
    def capture(auth=Depends(allowed)):
        if auth["role"]!="capture": raise HTTPException(403,"Use la cuenta separada de captura.")
        return auth["actor"]
    def reviewer(auth=Depends(allowed)):
        if auth["role"]!="review": raise HTTPException(403,"Se requiere cuenta de revisión.")
        return auth["actor"]
    @app.get("/educo/asistencia")
    def page(auth=Depends(access)):
        return FileResponse(root/"intelligence"/"attendance.html")
    @app.get("/intelligence/attendance.js")
    def script(auth=Depends(access)):
        return FileResponse(root/"intelligence"/"attendance.js",media_type="text/javascript")
    @app.get("/intelligence/attendance-style.css")
    def attendance_style(auth=Depends(access)):
        return FileResponse(root/"intelligence"/"style.css",media_type="text/css")
    @app.get("/intelligence/attendance-extra.css")
    def attendance_extra(auth=Depends(access)):
        return FileResponse(root/"intelligence"/"educo.css",media_type="text/css")
    @app.get("/api/educo/attendance/config")
    def config(auth=Depends(access)):
        return {"communities":COMMUNITIES,"services":SERVICES,"ocr_local":bool(shutil.which("tesseract")),
                "enabled":os.getenv("HH_ATTENDANCE_ENABLED")=="1","role":auth["role"]}
    @app.post("/api/educo/attendance/ocr")
    async def ocr(request:Request,actor=Depends(capture)):
        from starlette.concurrency import run_in_threadpool
        if request.headers.get("content-type","") not in ("image/jpeg","image/png","image/webp"):
            raise HTTPException(415,"Formato de imagen no admitido")
        data=await request.body()
        return await run_in_threadpool(local_ocr,data)
    @app.post("/api/educo/attendance/participants")
    def register(data:Register,actor=Depends(reviewer)):
        code="HH-"+uuid.uuid4().hex[:12].upper()
        with db() as con:
            init(con)
            con.execute("INSERT INTO educo_participants VALUES(?,?,?)",(code,data.category,timestamp()))
            log(con,actor,"educo_participant_code_created",code)
        return {"code":code,"category":data.category}
    @app.post("/api/educo/attendance/batches")
    def draft(data:Batch,actor=Depends(capture)):
        bid=str(uuid.uuid4())
        with db() as con:
            init(con);con.execute("BEGIN IMMEDIATE")
            validate_codes(con,data.codes)
            row=same_session(con,data.session);check_session(row,data.session)
            con.execute("INSERT INTO educo_attendance_batches(id,created,state,payload) VALUES(?,?,?,?)",
                        (bid,timestamp(),"review",data.model_dump_json()))
            log(con,actor,"educo_attendance_draft",bid)
        return {"id":bid,"state":"review"}
    @app.get("/api/educo/attendance/batches")
    def batches(auth=Depends(access)):
        if auth["role"]!="review": return []
        with db() as con:
            init(con)
            return [dict(id=r["id"],state=r["state"],created=r["created"],reviewed_at=r["reviewed_at"],
                         inserted=r["inserted"],repeated=r["repeated"],payload=json.loads(r["payload"]))
                    for r in con.execute("SELECT * FROM educo_attendance_batches ORDER BY created DESC LIMIT 100")]
    @app.post("/api/educo/attendance/batches/{bid}/discard")
    def discard(bid:str,data:Review,actor=Depends(reviewer)):
        with db() as con:
            init(con)
            changed=con.execute("UPDATE educo_attendance_batches SET state='discarded' WHERE id=? AND state='review'",(bid,)).rowcount
            if not changed: raise HTTPException(409,"Solo se descartan borradores pendientes")
            log(con,actor,"educo_attendance_discarded",bid)
        return {"state":"discarded"}
    @app.post("/api/educo/attendance/batches/{bid}/approve")
    def approve(bid:str,data:Review,actor=Depends(reviewer)):
        with db() as con:
            init(con);con.execute("BEGIN IMMEDIATE")
            row=con.execute("SELECT * FROM educo_attendance_batches WHERE id=?",(bid,)).fetchone()
            if not row or row["state"]!="review": raise HTTPException(409,"Lote no disponible para aprobación")
            batch=Batch.model_validate_json(row["payload"]);s=batch.session
            validate_codes(con,batch.codes)
            session=same_session(con,s);check_session(session,s)
            sid=session["id"] if session else str(uuid.uuid4())
            if not session:
                con.execute("INSERT INTO educo_sessions VALUES(?,?,?,?,?,?,?,?)",
                            (sid,s.phase,s.community,s.space,s.day.isoformat(),s.shift,s.slot,s.service))
            inserted=0
            for code in batch.codes:
                inserted+=con.execute("INSERT INTO educo_attendance(session_id,code,batch_id) VALUES(?,?,?) ON CONFLICT(session_id,code) DO NOTHING",(sid,code,bid)).rowcount
            repeated=len(batch.codes)-inserted
            con.execute("UPDATE educo_attendance_batches SET state='validated',reviewed_at=?,inserted=?,repeated=? WHERE id=?",
                        (timestamp(),inserted,repeated,bid))
            log(con,actor,"educo_attendance_validated",bid)
        return {"state":"validated","inserted":inserted,"repeated":repeated}
    @app.get("/api/educo/attendance/summary")
    def summary(start:date,end:date,phase:Literal["original","expansion","integrated"]="integrated",actor=Depends(manager)):
        if start>end: raise HTTPException(422,"Período inválido")
        with db() as con:
            data=aggregate(con,start.isoformat(),end.isoformat(),phase)
        return {"data":data}
