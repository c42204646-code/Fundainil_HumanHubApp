import json
from fastapi.testclient import TestClient
from server.main import app, artifact, db

AUTH=("gerencia","test-password-very-long-123")
H={"X-HumanHub":"v2"}
def setup_env(monkeypatch,tmp_path):
    monkeypatch.setenv("HH_DB",str(tmp_path/"db.sqlite3"))
    monkeypatch.setenv("HH_MANAGER_USER",AUTH[0])
    monkeypatch.setenv("HH_MANAGER_PASSWORD",AUTH[1])
    monkeypatch.delenv("OPENAI_API_KEY",raising=False)
    return TestClient(app)
def sample():
    return {"project":"EDUCO","reports":[{"id":"r1","fecha":"2026-11-25","sector":"Educación","actividad":"Taller","poblacion":[{"grupo":"6-11","f_nor":2,"f_r":1,"m_nor":3,"m_r":0}],"totalAlcanzado":6}]}
def test_import_and_auth(monkeypatch,tmp_path):
    c=setup_env(monkeypatch,tmp_path)
    assert c.get("/api/projects").status_code==401
    assert c.post("/api/import",json=sample(),auth=AUTH).status_code==403
    assert c.post("/api/import",json=sample(),auth=AUTH,headers=H).json()["inserted"]==1
    assert c.post("/api/import",json=sample(),auth=AUTH,headers=H).json()["inserted"]==0
    data=sample();data["reports"][0]["totalAlcanzado"]=7
    assert c.post("/api/import",json=data,auth=AUTH,headers=H).status_code==422
    assert c.get("/api/projects",auth=AUTH).json()==[{"project":"EDUCO","records":1}]
def test_no_fake_ai_or_mail(monkeypatch,tmp_path):
    c=setup_env(monkeypatch,tmp_path)
    job={"agent":"ATLAS","project":"EDUCO","start":"2026-11-01","end":"2026-11-30","task":"informe"}
    assert c.post("/api/jobs",json=job,auth=AUTH,headers=H).status_code==503
    assert c.get("/api/jobs",auth=AUTH).json()==[]
def test_artifacts():
    row={"project":"EDUCO","agent":"ATLAS","state":"review","spec":json.dumps({"start":"2026-11-01","end":"2026-11-30"}),"evidence":json.dumps({"asistencias":6,"actividades":1,"desagregados":{"f_nor":2,"f_r":1,"m_nor":3,"m_r":0},"edades":{"6-11":{"f_nor":2,"f_r":1,"m_nor":3,"m_r":0}},"sectores":{"Educación":6},"nota":"Asistencias"}),"narrative":"Resultados\nSin testimonios registrados."}
    assert artifact(row,"pdf")[0].startswith(b"%PDF")
    assert artifact(row,"docx")[0].startswith(b"PK")
    assert artifact(row,"xlsx")[0].startswith(b"PK")
