import pymupdf as fitz
import requests
import tempfile
import os

def extract_pdf_text(file_url: str):
    response = requests.get(file_url, stream=True)

    if response.status_code != 200:
        raise Exception(f"Download failed: {response.status_code}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        for chunk in response.iter_content(chunk_size=8192):
            tmp.write(chunk)

        tmp_path = tmp.name

    try:
        doc = fitz.open(tmp_path)

        pages = []

        for i, page in enumerate(doc):
            text = page.get_text("text") or ""
            pages.append((i + 1, text))

        doc.close()
        return pages

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)