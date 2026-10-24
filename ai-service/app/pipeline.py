import base64
import io
import re
import threading
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError

PATTERN=re.compile(r'^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|\d{2}BH\d{4}[A-Z]{1,2})$')
def normalize(text): return re.sub(r'[^A-Z0-9]','',text.upper())
def valid(text): return bool(PATTERN.fullmatch(text))

def decode(raw):
    if not raw or len(raw)>8*1024*1024: raise ValueError('Image must be between 1 byte and 8 MB.')
    try:
        with Image.open(io.BytesIO(raw)) as im:
            if im.format not in ('JPEG','PNG','WEBP'): raise ValueError('Unsupported image format.')
            if im.width*im.height>16_000_000: raise ValueError('Image exceeds 16 megapixels.')
            im.verify()
    except (UnidentifiedImageError,OSError,Image.DecompressionBombError) as exc: raise ValueError('Invalid image.') from exc
    image=cv2.imdecode(np.frombuffer(raw,np.uint8),cv2.IMREAD_COLOR)
    if image is None: raise ValueError('Could not decode image.')
    h,w=image.shape[:2]
    if max(h,w)>1600:image=cv2.resize(image,None,fx=1600/max(h,w),fy=1600/max(h,w))
    return image

class Pipeline:
    def __init__(self,model_path,ocr_dir,detector=None,reader=None):
        self.model_path=Path(model_path);self.ocr_dir=Path(ocr_dir)
        self.detector=detector;self.reader=reader;self.lock=threading.Lock()

    def load(self):
        if self.detector is None:
            if not self.model_path.is_file(): raise RuntimeError('Model missing. Run python download_models.py first.')
            if self.model_path.suffix.lower()!='.onnx': raise RuntimeError('Use the selected ONNX detector export.')
            from ultralytics import YOLO
            self.detector=YOLO(str(self.model_path),task='detect')
        if self.reader is None:
            import easyocr
            self.reader=easyocr.Reader(['en'],gpu=False,model_storage_directory=str(self.ocr_dir),download_enabled=False)

    def ocr(self,crop):
        gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY)
        scale=min(3.,max(1.,90/max(gray.shape[0],1)))
        gray=cv2.resize(gray,None,fx=scale,fy=scale,interpolation=cv2.INTER_CUBIC)
        versions=[gray,cv2.createCLAHE(clipLimit=2,tileGridSize=(8,8)).apply(gray)]
        best=('',None)
        for version in versions:
            words=self.reader.readtext(version,allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',detail=1,paragraph=False)
            if not words:continue
            # Cluster into rows to support two-line plates, then order left to right.
            median=max(1,float(np.median([max(p[1] for p in box)-min(p[1] for p in box) for box,_,_ in words])))
            words.sort(key=lambda r:min(p[1] for p in r[0]))
            rows=[]
            for item in words:
                y=min(p[1] for p in item[0])
                if not rows or abs(y-rows[-1][0])>median*.65:rows.append((y,[item]))
                else:rows[-1][1].append(item)
            ordered=[item for _,row in rows for item in sorted(row,key=lambda r:min(p[0] for p in r[0]))]
            # Ignore a separate IND country label; retain characters as recognised.
            parts=[(normalize(text),float(conf)) for _,text,conf in ordered if normalize(text) not in ('IND','INDIA')]
            for i in range(len(parts)):
                for j in range(i+1,min(i+5,len(parts))+1):
                    group=parts[i:j];text=''.join(s for s,_ in group)
                    confidence=sum(len(s)*c for s,c in group)/max(1,sum(len(s) for s,_ in group))
                    if (valid(text),confidence)>(valid(best[0]),best[1] or 0):best=(text,confidence)
        return best

    def recognize(self,raw):
        image=decode(raw)
        with self.lock:
            self.load()
            result=self.detector.predict(image,imgsz=640,conf=.25,device='cpu',verbose=False)[0]
            candidates=[];h,w=image.shape[:2];annotated=image.copy()
            for b in result.boxes:
                name=str(result.names[int(b.cls.item())]).lower()
                if 'plate' not in name:continue
                x1,y1,x2,y2=map(int,b.xyxy[0].tolist());x1=max(0,x1);y1=max(0,y1);x2=min(w,x2);y2=min(h,y2)
                if x2<=x1 or y2<=y1:continue
                pad=4;crop=image[max(0,y1-pad):min(h,y2+pad),max(0,x1-pad):min(w,x2+pad)]
                text,confidence=self.ocr(crop)
                candidates.append({'registrationNumber':text,'ocrConfidence':round(confidence,4) if confidence is not None else None,'detectorConfidence':round(float(b.conf.item()),4),'validFormat':valid(text),'box':[x1,y1,x2,y2]})
                cv2.rectangle(annotated,(x1,y1),(x2,y2),(80,220,120),2)
                cv2.putText(annotated,text or 'Unreadable',(x1,max(22,y1-8)),cv2.FONT_HERSHEY_SIMPLEX,.65,(80,220,120),2)
                if len(candidates)>=20:break
            candidates.sort(key=lambda r:(r['validFormat'],r['ocrConfidence'] or 0),reverse=True)
            ok,jpeg=cv2.imencode('.jpg',annotated,[cv2.IMWRITE_JPEG_QUALITY,80])
            return {'candidates':candidates,'code':'OK' if any(c['validFormat'] for c in candidates) else ('OCR_UNCERTAIN' if candidates else 'NO_PLATE'),'annotatedImage':'data:image/jpeg;base64,'+base64.b64encode(jpeg).decode() if ok else None}
