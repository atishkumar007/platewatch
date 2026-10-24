"""Inspect data and export an evaluation manifest. Never creates vehicle records."""
import argparse
import json
from collections import Counter
from pathlib import Path
import xml.etree.ElementTree as ET
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--manifest',default='manifest.json');a=p.parse_args()
    root=Path(a.directory).resolve()
    if not root.is_dir():raise SystemExit('Choose an extracted dataset directory.')
    files=[x for x in root.rglob('*') if x.is_file()]
    print('Extensions:',dict(Counter(x.suffix.lower() for x in files)))
    print('Sample paths:',[str(x.relative_to(root)) for x in files[:15]])
    if not (root/'images').is_dir() or not (root/'annotations').is_dir():raise SystemExit('Different dataset layout detected. Inspect files and use a matching annotation reader.')
    entries=[]
    for xml in sorted((root/'annotations').glob('*.xml')):
        if xml.stat().st_size>1024*1024:raise SystemExit('Unexpectedly large annotation: '+str(xml))
        doc=ET.parse(xml).getroot();name=doc.findtext('filename')
        if not name or Path(name).name!=name:raise SystemExit('Unsafe annotation filename')
        image=root/'images'/name
        if not image.is_file():raise SystemExit('Image missing: '+str(image))
        boxes=[]
        for obj in doc.findall('object'):
            b=obj.find('bndbox')
            if b is not None:boxes.append({'box':[int(b.findtext(k)) for k in ('xmin','ymin','xmax','ymax')],'plate':''})
        entries.append({'image':str(image),'plates':boxes})
    Path(a.manifest).write_text(json.dumps({'datasetRoot':str(root),'items':entries},indent=2))
    print('Wrote',len(entries),'images. Plate strings are blank: detection annotations do not contain OCR ground truth. Label before OCR evaluation.')
