from fastapi.testclient import TestClient
from server.main import app
from server.educo_catalog import CATALOG

AUTH=("gerencia","test-password-very-long-123")
H={"X-HumanHub":"v2"}

def client(monkeypatch,tmp_path):
    monkeypatch.setenv("HH_DB",str(tmp_path/"educo.sqlite3"))
    monkeypatch.setenv("HH_MANAGER_USER",AUTH[0])
    monkeypatch.setenv("HH_MANAGER_PASSWORD",AUTH[1])
    return TestClient(app)

def form(scope="project"):
    return dict(phase="expansion",scope=scope,community=None if scope=="project" else "Naiguatá",
      modality="Integrado",period_type="Semanal",start="2026-11-25",end="2026-11-28",
      team_code="A",space_code="CONSOLIDADO" if scope=="project" else "N01",space_status="Operativo",
      population=[dict(age="6-9",girls=2,boys=3,other=0,disability=1)],
      schooling={"regular":5},new_nna=3,previous_nna=2,nna_attendance=8,
      measurements=[dict(indicator="coverage",real=5,accumulated=5,evidence="FFVV-1"),
                    dict(indicator="sio1",favorable=3,evaluated=4,evidence="FFVV-2")],
      evidence_ref="FFVV-1")

def submit(c,p):
    r=c.post("/api/educo/forms",json=p,auth=AUTH,headers=H)
    assert r.status_code==200,r.text
    return r.json()["id"]

def approve(c,fid):
    r=c.post(f"/api/educo/forms/{fid}/review",json={"confirmed":True,"note":"Contrastado"},auth=AUTH,headers=H)
    assert r.status_code==200,r.text

def value(c,key):
    r=c.get("/api/educo/dashboard?phase=expansion",auth=AUTH)
    assert r.status_code==200,r.text
    return next(i for i in r.json()["indicators"] if i["id"]==key)["value"]

def test_no_unverified_or_double_count(monkeypatch,tmp_path):
    c=client(monkeypatch,tmp_path)
    assert c.get("/api/educo/forms").status_code==401
    fid=submit(c,form("community"))
    approve(c,fid)
    assert value(c,"coverage") is None
    fid=submit(c,form())
    assert value(c,"coverage") is None
    approve(c,fid)
    assert value(c,"coverage")==5
    assert value(c,"sio1")==75
    revised=form();revised["measurements"][0]["accumulated"]=6
    approve(c,submit(c,revised))
    assert value(c,"coverage")==6
    assert c.get("/api/educo/export.csv",auth=AUTH).status_code==200

def test_reconciliation(monkeypatch,tmp_path):
    c=client(monkeypatch,tmp_path)
    for key,new in [("schooling",{"regular":6}),("new_nna",5),("nna_attendance",4)]:
        p=form();p[key]=new
        assert c.post("/api/educo/forms",json=p,auth=AUTH,headers=H).status_code==422
    p=form();p["measurements"][1]["favorable"]=5
    assert c.post("/api/educo/forms",json=p,auth=AUTH,headers=H).status_code==422
    assert CATALOG["school_kits"]["expansion"]==600
    assert CATALOG["indirect"]["expansion"] is None

def test_atlas_evidence_minimized(monkeypatch,tmp_path):
    from server.main import db
    from server.educo import evidence_for_period
    c=client(monkeypatch,tmp_path)
    p=form();p["context"]="Internal context not sent";approve(c,submit(c,p))
    with db() as con:
        data=evidence_for_period(con,"expansion","2026-11-01","2026-11-30")
        assert len(data["indicators"])==2
        assert "Internal context not sent" not in str(data)
        assert evidence_for_period(con,"original","2026-11-01","2026-11-30") is None
