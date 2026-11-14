import os
import time
import requests
from dotenv import load_dotenv
from typing import List
from pathlib import Path

load_dotenv()
# Fallback to model-next/.env.local if needed
parent_env = Path(__file__).resolve().parent.parent.parent / "model-next" / ".env.local"
if parent_env.exists():
    load_dotenv(parent_env, override=False)

def generate_embeddings(texts: List[str]) -> List[List[float]]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise Exception("GEMINI_API_KEY not found in environment")

    if not texts:
        return []

    # Sanitize and truncate chunks to avoid oversized token errors
    clean_texts = [t.strip()[:2000] for t in texts if t.strip()]
    if not clean_texts:
        return []

    all_embeddings: List[List[float]] = []
    chunk_size = 25  # Max safe batch size for gemini-embedding-001

    for i in range(0, len(clean_texts), chunk_size):
        batch = clean_texts[i:i + chunk_size]
        reqs = [
            {
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": t}]},
                "outputDimensionality": 768
            }
            for t in batch
        ]

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key={api_key}"

        # Try batch embedding with exponential backoff for 429 rate limits
        batch_success = False
        for attempt in range(4):
            try:
                res = requests.post(url, json={"requests": reqs}, timeout=35)
                if res.status_code == 200:
                    data = res.json()
                    embeddings_list = data.get("embeddings", [])
                    for item in embeddings_list:
                        all_embeddings.append(item.get("values", []))
                    batch_success = True
                    break
                elif res.status_code == 429 or res.status_code >= 500:
                    wait_sec = (attempt + 1) * 2
                    time.sleep(wait_sec)
                    continue
                else:
                    break
            except Exception:
                time.sleep(1)

        if not batch_success:
            # Fallback to single requests with rate-limiting pacing
            for text in batch:
                single_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={api_key}"
                single_success = False
                for s_attempt in range(3):
                    try:
                        single_res = requests.post(
                            single_url,
                            json={
                                "content": {"parts": [{"text": text}]},
                                "outputDimensionality": 768
                            },
                            timeout=20
                        )
                        if single_res.status_code == 200:
                            val = single_res.json().get("embedding", {}).get("values", [])
                            all_embeddings.append(val)
                            single_success = True
                            time.sleep(0.12)  # Pacing to respect 100 RPM quota
                            break
                        elif single_res.status_code == 429:
                            time.sleep(2)
                        else:
                            break
                    except Exception:
                        time.sleep(1)

                if not single_success:
                    # Fallback to zero vector so entire document upload never crashes
                    all_embeddings.append([0.0] * 768)

    return all_embeddings
