import os
import requests
from dotenv import load_dotenv
from typing import List

load_dotenv()

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY not found in environment")

    if not texts:
        return []

    all_embeddings: List[List[float]] = []
    chunk_size = 25  # Safe batch size

    for i in range(0, len(texts), chunk_size):
        batch = texts[i:i + chunk_size]
        reqs = [
            {
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": t}]},
                "outputDimensionality": 768
            }
            for t in batch
        ]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={api_key}"
        res = requests.post(url, json={"requests": reqs}, timeout=45)

        if res.status_code == 200:
            data = res.json()
            embeddings_list = data.get("embeddings", [])
            for item in embeddings_list:
                all_embeddings.append(item.get("values", []))
        else:
            # Fallback to single requests if batch fails
            for text in batch:
                single_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={api_key}"
                single_res = requests.post(
                    single_url,
                    json={
                        "content": {"parts": [{"text": text}]},
                        "outputDimensionality": 768
                    },
                    timeout=25
                )
                if single_res.status_code == 200:
                    val = single_res.json().get("embedding", {}).get("values", [])
                    all_embeddings.append(val)
                else:
                    raise Exception(f"Embedding failed ({single_res.status_code}): {single_res.text}")

    return all_embeddings