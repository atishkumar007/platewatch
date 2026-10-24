"""Held-out detection/OCR evaluation from dataset/inspect_dataset.py manifests."""
import argparse
import json
import time
from pathlib import Path
from app.pipeline import Pipeline,normalize

def distance(a,b):
    row=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        new=[i]
        for j,y in enumerate(b,1):new.append(min(new[-1]+1,row[j]+1,row[j-1]+(x!=y)))
        row=new
    return row[-1]
def iou(a,b):
    area=lambda x:max(0,x[2]-x[0])*max(0,x[3]-x[1])
    inter=area([max(a[0],b[0]),max(a[1],b[1]),min(a[2],b[2]),min(a[3],b[3])])
    return inter/max(1,area(a)+area(b)-inter)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('manifest');p.add_argument('--output',default='evaluation.json');a=p.parse_args()
    root=Path(__file__).resolve().parent;engine=Pipeline(root/'models/alpr_26n.onnx',root/'models/easyocr')
    data=json.loads(Path(a.manifest).read_text());rows=[];tp=fp=fn=exact=labelled=errors=characters=0
    for item in data['items']:
        file=Path(item['image']);raw=file.read_bytes()
        from PIL import Image
        with Image.open(file) as im:scale=min(1,1600/max(im.size))
        t=time.perf_counter();result=engine.recognize(raw);ms=(time.perf_counter()-t)*1000
        unmatched=set(range(len(result['candidates'])));predictions=result['candidates']
        for truth in item['plates']:
            box=[v*scale for v in truth['box']];match=max(unmatched,key=lambda j:iou(box,predictions[j]['box']),default=None)
            good=match is not None and iou(box,predictions[match]['box'])>=.5
            if good:tp+=1;unmatched.remove(match)
            else:fn+=1
            if truth.get('plate'):
                target=normalize(truth['plate']);prediction=predictions[match]['registrationNumber'] if good else ''
                labelled+=1;exact+=target==prediction;errors+=distance(target,prediction);characters+=len(target)
        fp+=len(unmatched);rows.append({'image':str(file),'latencyMs':round(ms,1),'candidates':predictions})
    report={'images':len(rows),'iouThreshold':.5,'precision':tp/(tp+fp) if tp+fp else None,'recall':tp/(tp+fn) if tp+fn else None,'ocrLabelledPlates':labelled,'exactPlateAccuracy':exact/labelled if labelled else None,'characterErrorRate':errors/characters if characters else None,'meanLatencyMs':sum(r['latencyMs'] for r in rows)/len(rows) if rows else None,'coldStartIncluded':True,'results':rows}
    Path(a.output).write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
