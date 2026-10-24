# Model selection, licence notes and dataset workflow

## Selected pretrained detector

Model repository: https://huggingface.co/ishaqinu/yolo26n-license-plate-detection

- File: `alpr_26n.onnx`, a plate-specific single-class YOLO26n detector.
- Pinned revision: `b9162ec575eae48a1c3c3d42cd24e87fea83214b`.
- Published model licence: **AGPL-3.0**.
- Model card's compatible loading example uses **Ultralytics 8.4.155**, pinned in requirements.
- ONNX input is 640×640; raw output has one plate class and uses postprocessing through Ultralytics.
- Downloaded detector SHA256 observed in this build: `f42b5d166a13ab0802973cd8ee04a08225dd102f98488424cccbfe0e7d4e624a`.

The setup script fetches the pinned export and records its hash. No detector weights are bundled in the source ZIP. A generic COCO detector is not used as a substitute. This checkpoint is a starting point, not an India-specific accuracy guarantee.

English OCR uses EasyOCR 1.7.2 with CPU execution. Its Reader/readtext behavior is documented at https://www.jaided.ai/easyocr/documentation/ . OCR and detector confidence are separate engine scores, not a guarantee of identity. Their published benchmark claims are not presented as this project's results.

## Dependency/licence notes

The selected model is published under AGPL-3.0 and Ultralytics offers AGPL-3.0/enterprise licensing: https://www.ultralytics.com/license . EasyOCR's upstream licence is Apache-2.0: https://github.com/JaidedAI/EasyOCR . Check the current dependency/model licences and your distribution obligations before publishing or commercialising the project. A permissive app label cannot remove the conditions of model/framework dependencies. The model's documented training dataset and attribution are linked on its model card; this archive does not relicense upstream assets.

No full dataset or real vehicle images are distributed in this source archive. Download from the source and retain its attribution/terms.

## Inspected dataset

A practical starting dataset containing Indian as well as other-region plates is **Car License Plate Detection**, by Andrew M. on Kaggle:

https://www.kaggle.com/datasets/andrewmvd/car-plate-detection

During this build, Kaggle's public dataset metadata reported **CC0: Public Domain**. The actual archive was downloaded and inspected before the importer was written. It contained:

```text
annotations/Cars0.xml
annotations/Cars1.xml
... 433 Pascal VOC XML files
images/Cars0.png
images/Cars1.png
... 433 PNG images
```

A sample XML used `filename`, `size`, `object/name` with label `licence`, and `object/bndbox` with xmin/ymin/xmax/ymax. It provided bounding boxes, **not OCR ground-truth plate strings**. It is not exclusively Indian, so use a relevant Indian subset or your own permitted captures for a representative evaluation. Recheck the dataset's current licence/version before use.

## Download and inspect on your machine

1. Open the Kaggle page, review its licence, and use its Download option (sign-in may be required by Kaggle). Extract it under `dataset/raw/car-plate-detection/`.
2. From project root, using the AI virtual environment:

```powershell
.\ai-service\.venv\Scripts\python.exe dataset\inspect_dataset.py dataset\raw\car-plate-detection --manifest dataset\manifest.json
```

The script prints actual extensions/sample paths and validates the inspected images/annotations layout. If your download has another layout, it stops instead of silently guessing. It exports image paths and annotated plate boxes. It does not import images into MongoDB, grant authorization or create owner records.

3. Choose a held-out subset and manually fill the `plate` field beside each bounding box. Leave it blank for unreadable text. Do not invent unreadable plate labels.
4. From `ai-service`:

```powershell
.\.venv\Scripts\python.exe evaluate.py ..\dataset\manifest.json --output evaluation.json
```

The manifest can also be created manually for permitted local photographs, using `{image: "absolute-image-path", plates: [{box: [xmin,ymin,xmax,ymax], plate: "ground-truth"}]}` entries inside an `items` array. Coordinates refer to the original image; evaluation rescales them to match the pipeline's image resize.

## Evaluation rules

Detection uses IoU ≥ 0.5 with one-to-one box matching to count TP/FP/FN and compute precision/recall. OCR exact-plate accuracy and character error rate are calculated only for manually labelled ground truth, before human correction. Images with known no-plate ground truth should have an empty plates array. The mean latency includes the first model initialization cost, preprocessing, detection, OCR and annotation, but excludes browser transfer, Express and MongoDB.

The supplied evaluator does not fine-tune the model. If you train later, split by vehicle/capture session before augmentation and keep the test data independent. A public pretrained checkpoint may have seen overlapping public images, so do not call a few public examples an independent benchmark. For your paper, use a held-out collection whose provenance and overlap limits you can describe.

## Future India-specific dataset option

Roboflow's Indian Number Plate Detection listing is labelled CC BY 4.0: https://universe.roboflow.com/bharani-ejlrn/indian-number-plate-detection . Its archive was not downloaded/inspected here, and the supplied Pascal VOC importer does not claim compatibility with it. Inspect an actual licensed export and its class/annotation format before adding an import/training path. Dataset plates must never be automatically authorised in the application.
