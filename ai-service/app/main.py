import os
import secrets
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from .pipeline import Pipeline
ROOT=Path(__file__).resolve().parents[1]
load_dotenv(ROOT/'.env')

def create_app(pipeline=None,key=None):
    secret=key or os.getenv('AI_SERVICE_KEY','')
    if len(secret)<24 or secret.startswith('REPLACE_'): raise RuntimeError('Set AI_SERVICE_KEY to the same random key as backend/.env (at least 24 characters).')
    model=Path(os.getenv('MODEL_PATH','models/alpr_26n.onnx'))
    if not model.is_absolute():model=ROOT/model
    engine=pipeline or Pipeline(model,ROOT/'models'/'easyocr')
    api=FastAPI(title='PlateWatch Recognition API',docs_url=None,redoc_url=None)
    @api.get('/health')
    def health():return {'ok':True,'modelPresent':model.is_file(),'imagesStored':False}
    @api.post('/recognize')
    def recognize(image:UploadFile=File(...),x_service_key:str=Header(default='')):
        if not secrets.compare_digest(x_service_key,secret): raise HTTPException(401,'Invalid service key.')
        if image.content_type not in ('image/jpeg','image/png','image/webp'): raise HTTPException(400,'Use JPEG, PNG or WebP.')
        raw=image.file.read(8*1024*1024+1)
        try:return engine.recognize(raw)
        except ValueError as exc:raise HTTPException(400,str(exc)) from exc
        except Exception as exc:raise HTTPException(503,'Recognition unavailable. Verify model download and OCR files in the server terminal.') from exc
        finally:image.file.close()
    return api

# Uvicorn uses --factory; importing tests does not require real credentials.
def app_factory():return create_app()
