import io, shutil
from fastapi.testclient import TestClient
from PIL import Image
from server.main import app
from server.attendance import local_ocr

AUTH=("gerencia","test-password-very-long-123")
CAPTURE=("campo","test-capture-password-long-456")
H={"X-HumanHub":"v2"}
BASE="/api/educo/attendance/"
def setup(monkeypatch,tmp_path):
    monkeypatch.setenv("HH_DB",str(tmp_path/"attendance.sqlite3"))
    monkeypatch.setenv("HH_MANAGER_USER",AUTH[0])
    monkeypatch.setenv("HH_MANAGER_PASSWORD",AUTH[1])
    monkeypatch.setenv("HH_ATTENDANCE_ENABLED","1")
    monkeypatch.setenv("HH_CAPTURE_USER",CAPTURE[0])
    monkeypatch.setenv("HH_CAPTURE_PASSWORD",CAPTURE[1])
    return TestClient(app)
def post(c,path,p):
    return c.post(BASE+path,json=p,auth=CAPTURE if path=="batches" else AUTH,headers=H)
def make_batch(codes,day="2026-11-25",phase="original",community="Naiguatá"):
    return {"session":{"phase":phase,"community":community,"space":"S1","day":day,"shift":"AM","slot":1,"service":"Educación"},"codes":codes,"evidence_ref":"LISTA-01"}
def draft(c,p):
    r=post(c,"batches",p)
    assert r.status_code==200,r.text
    return r.json()["id"]
def approve(c,id):
    r=post(c,"batches/"+id+"/approve",{"confirmed":True})
    assert r.status_code==200,r.text
    return r.json()
def stats(c,phase="integrated"):
    r=c.get(BASE+"summary?start=2026-11-01&end=2026-11-30&phase="+phase,auth=AUTH)
    assert r.status_code==200,r.text
    return r.json()["data"]

def test_dedup_across_lists_sites_and_phases(monkeypatch,tmp_path):
    c=setup(monkeypatch,tmp_path)
    assert c.get(BASE+"config").status_code==401
    a=post(c,"participants",{"category":"NNA","confirmed_new":True}).json()["code"]
    b=post(c,"participants",{"category":"NNA","confirmed_new":True}).json()["code"]
    assert post(c,"batches",make_batch([a,a])).status_code==422
    assert post(c,"batches",make_batch(["HH-000000000000"])).status_code==422
    first=draft(c,make_batch([a,b]))
    assert c.post(BASE+"batches/"+first+"/approve",json={"confirmed":True},auth=CAPTURE,headers=H).status_code==403
    assert c.post(BASE+"batches",json=make_batch([a]),auth=AUTH,headers=H).status_code==403
    assert stats(c) is None
    assert approve(c,first)["inserted"]==2
    assert post(c,"batches/"+first+"/approve",{"confirmed":True}).status_code==409
    dup=approve(c,draft(c,make_batch([a,b])))
    assert dup["inserted"]==0 and dup["repeated"]==2
    assert post(c,"batches",make_batch([a],phase="expansion")).status_code==409
    approve(c,draft(c,make_batch([a],day="2026-11-26",phase="expansion",community="Caricuao")))
    assert stats(c)["people"]==2 and stats(c)["attendances"]==3
    assert stats(c,"expansion")["people"]==1
    discard=draft(c,make_batch([b],day="2026-11-27"))
    assert post(c,"batches/"+discard+"/discard",{"confirmed":True}).status_code==200
    assert stats(c)["attendances"]==3

def test_flag_and_image_validation(monkeypatch,tmp_path):
    c=setup(monkeypatch,tmp_path)
    monkeypatch.setenv("HH_ATTENDANCE_ENABLED","0")
    assert post(c,"participants",{"category":"NNA","confirmed_new":True}).status_code==503
    monkeypatch.setenv("HH_ATTENDANCE_ENABLED","1")
    assert c.post(BASE+"ocr",content=b"bad",headers={**H,"Content-Type":"image/jpeg"},auth=CAPTURE).status_code==422

def test_real_local_ocr():
    import pytest
    from PIL import ImageDraw, ImageFont
    if not shutil.which("tesseract"):
        pytest.skip("Local OCR engine not installed")
    image=Image.new("RGB",(1200,400),"white")
    font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",64)
    ImageDraw.Draw(image).text((50,120),"HH-ABCDEF123456",fill="black",font=font)
    buf=io.BytesIO();image.save(buf,format="PNG")
    result=local_ocr(buf.getvalue())
    assert "HH-ABCDEF123456" in result["codes"]
