# Dataset workspace

Keep downloaded images here under raw/. They are for recognition evaluation, not vehicle authorization.

The inspected Kaggle export contains images/*.png and annotations/*.xml (Pascal VOC), 433 of each. Read docs/model-and-data.md for the actual inspection, licence source, download instructions, manual OCR labelling and held-out evaluation.

From root:

```powershell
.\ai-service\.venv\Scripts\python.exe dataset\inspect_dataset.py dataset\raw\car-plate-detection --manifest dataset\manifest.json
```

No dataset is bundled. The script stops on a different layout and never creates MongoDB vehicle records.
