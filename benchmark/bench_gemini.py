import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import os, time, statistics, json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv('ai-backend/.env')
from google import genai
from google.genai import types
import requests as req_lib

key = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=key)
MODEL = 'gemini-2.5-flash'

print("=" * 60)
print("  TEST 1: Gemini 2.5 Flash -- Direct API Latency")
print("=" * 60)

prompts = [
    ("Short Q&A (student question)",
     "Explain what a binary search tree is in 2 sentences, as a professor would."),
    ("Medium lecture paragraph",
     "Explain TCP three-way handshake in classroom style, 4-5 sentences."),
    ("Long lecture script (as IntelliClass /session uses)",
     "Topic: Database Normalization\nCourse materials:\nNormalization reduces redundancy and improves data integrity.\nGenerate a 3-paragraph teaching script as Professor Sharma, a warm Indian college professor.")
]

gemini_results = []
for label, prompt in prompts:
    print(f"\n  [{len(gemini_results)+1}] {label}")
    t0 = time.perf_counter()
    try:
        resp = client.models.generate_content(
            model=MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.75, max_output_tokens=512)
        )
        elapsed = (time.perf_counter() - t0) * 1000
        text = resp.text or ""
        word_count = len(text.split())
        chars = len(text)
        throughput = word_count / (elapsed / 1000)
        print("     Latency: %.1f ms   Chars: %d   Words: ~%d   Throughput: %.1f words/sec" % (elapsed, chars, word_count, throughput))
        gemini_results.append({"label": label, "latency_ms": round(elapsed, 1), "output_chars": chars, "output_words": word_count, "throughput_wps": round(throughput, 1)})
    except Exception as e:
        print("     ERROR: %s" % str(e)[:120])
        gemini_results.append({"label": label, "error": str(e)[:120]})
    time.sleep(0.5)

valid = [r for r in gemini_results if "latency_ms" in r]
if valid:
    avg = statistics.mean(r["latency_ms"] for r in valid)
    print("\n  Average Gemini latency: %.1f ms" % avg)

print()
print("=" * 60)
print("  TEST 2: text-embedding-004 -- Embedding Latency")
print("=" * 60)

test_texts = [
    "Binary search tree node insertion algorithm",
    "TCP three-way handshake SYN SYN-ACK ACK connection",
    "Database normalization first second third normal form",
    "Object oriented programming encapsulation inheritance",
    "Quick sort divide and conquer pivot partitioning"
]
print("\n  Embedding %d texts..." % len(test_texts))
embed_result = None
try:
    t0 = time.perf_counter()
    result = client.models.embed_content(model="text-embedding-004", contents=test_texts)
    elapsed = (time.perf_counter() - t0) * 1000
    dim = len(result.embeddings[0].values) if result.embeddings else 0
    per_text = elapsed / len(test_texts)
    print("  Total: %.1f ms   Dimension: %d   Per-text avg: %.1f ms" % (elapsed, dim, per_text))
    embed_result = {"total_ms": round(elapsed, 1), "per_text_ms": round(per_text, 1), "dimension": dim, "texts_count": len(test_texts)}
except Exception as e:
    print("  ERROR: %s" % str(e)[:120])
    embed_result = {"error": str(e)[:120]}

print()
print("=" * 60)
print("  TEST 3: AI Backend HTTP -- /health ping + /session E2E")
print("=" * 60)

AI_URL = "http://localhost:8000"
http_result = None
try:
    pings = []
    for _ in range(5):
        t0 = time.perf_counter()
        req_lib.get(AI_URL + "/health", timeout=5)
        pings.append((time.perf_counter() - t0) * 1000)
    avg_ping = statistics.mean(pings)
    print("\n  /health avg (5x): %.1f ms" % avg_ping)

    session_payload = {
        "courseId": "00000000-0000-0000-0000-000000000001",
        "sources": [],
        "topic": "Introduction to Binary Search Trees",
        "directText": (
            "A binary search tree (BST) is a node-based data structure. "
            "Each node has at most two children. "
            "Left subtree contains smaller keys; right subtree contains larger keys. "
            "Search and insert are O(log n) average time."
        ),
        "voice": "male"
    }
    print("  Testing /session endpoint...")
    t0 = time.perf_counter()
    resp = req_lib.post(AI_URL + "/session", json=session_payload, timeout=120)
    session_ms = (time.perf_counter() - t0) * 1000

    if resp.status_code == 200:
        data = resp.json()
        script = data.get("script", "")
        chunks = data.get("chunksUsed", 0)
        net_gemini = session_ms - avg_ping
        print("  /session total: %.1f ms (%.2f s)" % (session_ms, session_ms/1000))
        print("  Script length: %d chars   Chunks used: %d" % (len(script), chunks))
        print("  Net Gemini time (minus ping): ~%.1f ms" % net_gemini)
        http_result = {"health_ping_ms": round(avg_ping, 1), "session_total_ms": round(session_ms, 1), "net_gemini_ms": round(net_gemini, 1), "script_chars": len(script), "chunks_used": chunks}
    else:
        try:
            err_detail = resp.json().get("detail", resp.text[:200])
        except:
            err_detail = resp.text[:200]
        print("  /session HTTP %d: %s" % (resp.status_code, err_detail))
        http_result = {"error": "HTTP %d: %s" % (resp.status_code, err_detail)}
except Exception as e:
    print("  ERROR: %s" % str(e)[:120])
    http_result = {"error": str(e)[:120]}

print()
print("=" * 60)
print("  TEST 4: Bandwidth -- Mathematical Calculation (WAV PCM)")
print("=" * 60)
sample_rate = 24000
bit_depth = 16
channels = 1
bytes_per_sec = (sample_rate * bit_depth * channels) / 8
raw_kbps = (bytes_per_sec * 8) / 1000
overhead_kbps = raw_kbps * 1.07
viseme_kbps = (8 * 40 * 8) / 1000
total_kbps = overhead_kbps + viseme_kbps
video_kbps = 3250
reduction = ((video_kbps - total_kbps) / video_kbps) * 100
print("\n  WAV: %d Hz / %d-bit / Mono" % (sample_rate, bit_depth))
print("  Raw audio bitrate: %.1f kbps" % raw_kbps)
print("  With network overhead: %.1f kbps" % overhead_kbps)
print("  Viseme JSON: %.1f kbps" % viseme_kbps)
print("  TOTAL stream: %.1f kbps" % total_kbps)
print("  vs 1080p WebRTC (~%d kbps): %.1f%% reduction" % (video_kbps, reduction))
bw_result = {"raw_kbps": raw_kbps, "total_stream_kbps": round(total_kbps, 1), "video_kbps": video_kbps, "reduction_pct": round(reduction, 1)}

print()
print("=" * 60)
report = {
    "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S'),
    "gemini_generation": gemini_results,
    "embedding": embed_result,
    "http_backend": http_result,
    "bandwidth": bw_result
}
out = Path("benchmark/ai-backend-benchmark-result.json")
out.write_text(json.dumps(report, indent=2))
print("  Results saved to: %s" % out)
print("=" * 60)
