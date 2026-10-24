"""Explicit one-time model setup. Does not run during an image upload."""
import hashlib
import json
from pathlib import Path
from huggingface_hub import hf_hub_download
import easyocr
ROOT=Path(__file__).resolve().parent
REVISION='b9162ec575eae48a1c3c3d42cd24e87fea83214b'
if __name__=='__main__':
    target=ROOT/'models';target.mkdir(exist_ok=True)
    file=hf_hub_download(repo_id='ishaqinu/yolo26n-license-plate-detection',filename='alpr_26n.onnx',revision=REVISION,local_dir=target)
    digest=hashlib.sha256(Path(file).read_bytes()).hexdigest()
    expected='f42b5d166a13ab0802973cd8ee04a08225dd102f98488424cccbfe0e7d4e624a'
    if digest!=expected:
        Path(file).rename(Path(file).with_suffix('.rejected'))
        raise RuntimeError('Detector checksum differs from the verified pinned export; download rejected.')
    (target/'download-info.json').write_text(json.dumps({'repo':'ishaqinu/yolo26n-license-plate-detection','revision':REVISION,'file':'alpr_26n.onnx','sha256':digest,'license':'AGPL-3.0'},indent=2))
    easyocr.Reader(['en'],gpu=False,model_storage_directory=str(target/'easyocr'),download_enabled=True,verbose=False)
    print('Detector and English OCR models ready. Detector SHA256:',digest)
