import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import create_app
from app.pipeline import decode,valid,normalize,Pipeline
KEY='test-service-key-with-more-than-24-characters'
def image_bytes():
    stream=io.BytesIO();Image.new('RGB',(200,100),'white').save(stream,format='PNG');return stream.getvalue()
class StubPipeline:
    def recognize(self,raw):
        decode(raw)
        return {'candidates':[],'code':'NO_PLATE','annotatedImage':None}
def test_formats():
    assert valid(normalize('PB 10 AB-1234')) and valid('22BH1234AA')
    assert not valid('KLO1CA2555')
def test_rejects_invalid_bytes():
    with pytest.raises(ValueError):decode(b'not-image')
def test_rejects_large_pixel_image():
    f=io.BytesIO();Image.new('RGB',(5000,4000)).save(f,format='PNG')
    with pytest.raises(ValueError):decode(f.getvalue())
def test_api_requires_key_and_checks_mime():
    client=TestClient(create_app(StubPipeline(),KEY))
    assert client.post('/recognize',files={'image':('x.png',image_bytes(),'image/png')}).status_code==401
    assert client.post('/recognize',headers={'X-Service-Key':KEY},files={'image':('x.txt',b'hello','text/plain')}).status_code==400
    assert client.post('/recognize',headers={'X-Service-Key':KEY},files={'image':('x.png',b'fake','image/png')}).status_code==400
def test_no_plate_is_truthful_response():
    client=TestClient(create_app(StubPipeline(),KEY));r=client.post('/recognize',headers={'X-Service-Key':KEY},files={'image':('x.png',image_bytes(),'image/png')})
    assert r.status_code==200 and r.json()['code']=='NO_PLATE' and r.json()['candidates']==[]
def test_missing_model_fails_gracefully(tmp_path):
    client=TestClient(create_app(Pipeline(tmp_path/'missing.onnx',tmp_path/'ocr'),KEY))
    r=client.post('/recognize',headers={'X-Service-Key':KEY},files={'image':('x.png',image_bytes(),'image/png')})
    assert r.status_code==503
