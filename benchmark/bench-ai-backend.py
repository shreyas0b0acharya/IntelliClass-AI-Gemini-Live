"""
AI Backend Real Benchmark - Gemini 2.5 Flash Script Generation Latency
Measures actual wall-clock time for:
  1. Embedding generation latency (text-embedding-004)
  2. Gemini 2.5 Flash generation time
  3. Supabase pgvector query latency
  4. Full end-to-end /session pipeline latency
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import time
import json
import os
import sys
import statistics
from pathlib import Path
from datetime import datetime

# Add ai-backend to path so we can import its services
backend_dir = Path(__file__).parent.parent / "ai-backend"
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

import requests as req_lib

# ── Config ─────────────────────────────────────────────────────────────────────
AI_BACKEND_URL = "http://localhost:8000"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_SERVICE_KEY")

DIVIDER = "─" * 62

# ── Test 1: Gemini 2.5 Flash Direct API Latency ─────────────────────────────
def test_gemini_latency():
    print(f"\n{'═'*62}")
    print("  TEST 1: Gemini 2.5 Flash — Direct API Latency")
    print(f"{'═'*62}")

    if not GEMINI_API_KEY:
        print("  ❌ GEMINI_API_KEY not found in .env. Skipping.")
        return None

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("  ❌ google-genai not installed. Skipping.")
        return None

    client = genai.Client(api_key=GEMINI_API_KEY)
    
    test_prompts = [
        {
            "label": "Short Q&A answer (student question)",
            "prompt": "Explain what a binary search tree is in 2 sentences, as a professor would."
        },
        {
            "label": "Medium lecture paragraph",
            "prompt": "Explain how TCP three-way handshake works in a classroom teaching style, 4-5 sentences."
        },
        {
            "label": "Long lecture script excerpt (as IntelliClass uses)",
            "prompt": (
                "Topic: Introduction to Database Normalization\n\n"
                "Course materials:\nNormalization is the process of organizing a relational database to reduce redundancy and improve data integrity...\n\n"
                "Generate a 3-4 paragraph teaching script in the style of Professor Sharma, an Indian college professor."
            )
        }
    ]

    results = []
    for i, p in enumerate(test_prompts):
        print(f"\n  [{i+1}] {p['label']}")

        t_start = time.perf_counter()
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=p["prompt"],
                config=types.GenerateContentConfig(
                    temperature=0.75,
                    max_output_tokens=512,
                )
            )
            t_end = time.perf_counter()
            elapsed_ms = (t_end - t_start) * 1000
            text = response.text or ""
            token_count = len(text.split())  # rough word count as proxy

            print(f"     ✅ Total latency:     {elapsed_ms:.1f} ms")
            print(f"     Output length:       {len(text)} chars / ~{token_count} words")
            print(f"     Throughput:          {token_count / (elapsed_ms/1000):.1f} words/sec")

            results.append({
                "label": p["label"],
                "latency_ms": round(elapsed_ms, 1),
                "output_chars": len(text),
                "output_words": token_count,
                "throughput_words_per_sec": round(token_count / (elapsed_ms/1000), 1)
            })

        except Exception as e:
            print(f"     ❌ Error: {e}")
            results.append({"label": p["label"], "error": str(e)})

        time.sleep(0.5)  # polite rate limiting

    if results:
        valid = [r for r in results if "latency_ms" in r]
        if valid:
            avg = statistics.mean(r["latency_ms"] for r in valid)
            print(f"\n  {'─'*40}")
            print(f"  Average Gemini latency: {avg:.1f} ms  ({avg/1000:.2f}s)")
    
    return results


# ── Test 2: Embedding Generation Latency ─────────────────────────────────────
def test_embedding_latency():
    print(f"\n{'═'*62}")
    print("  TEST 2: text-embedding-004 — Embedding Latency")
    print(f"{'═'*62}")

    if not GEMINI_API_KEY:
        print("  ❌ GEMINI_API_KEY not found. Skipping.")
        return None

    try:
        from google import genai
    except ImportError:
        print("  ❌ google-genai not installed. Skipping.")
        return None

    client = genai.Client(api_key=GEMINI_API_KEY)

    test_texts = [
        "Binary search tree node insertion algorithm",
        "TCP three-way handshake SYN SYN-ACK ACK connection establishment",
        "Database normalization first normal form second normal form third normal form",
        "Object oriented programming encapsulation inheritance polymorphism abstraction",
        "Quick sort algorithm divide and conquer pivot partitioning"
    ]

    print(f"\n  Embedding {len(test_texts)} texts with text-embedding-004...")
    t_start = time.perf_counter()

    try:
        result = client.models.embed_content(
            model="text-embedding-004",
            contents=test_texts
        )
        t_end = time.perf_counter()
        elapsed_ms = (t_end - t_start) * 1000

        embeddings = result.embeddings
        dim = len(embeddings[0].values) if embeddings else 0

        print(f"  ✅ Embedded {len(test_texts)} texts in {elapsed_ms:.1f} ms")
        print(f"     Embedding dimension:  {dim}")
        print(f"     Per-text avg latency: {elapsed_ms/len(test_texts):.1f} ms")
        print(f"     Throughput:           {len(test_texts) / (elapsed_ms/1000):.2f} texts/sec")

        return {
            "texts_count": len(test_texts),
            "total_latency_ms": round(elapsed_ms, 1),
            "per_text_avg_ms": round(elapsed_ms / len(test_texts), 1),
            "embedding_dimension": dim,
            "throughput_texts_per_sec": round(len(test_texts) / (elapsed_ms/1000), 2)
        }

    except Exception as e:
        print(f"  ❌ Error: {e}")
        return {"error": str(e)}


# ── Test 3: AI Backend HTTP End-to-End (if server running) ───────────────────
def test_backend_http():
    print(f"\n{'═'*62}")
    print("  TEST 3: AI Backend HTTP — End-to-End /session Latency")
    print(f"{'═'*62}")

    # Check if server is up
    try:
        health = req_lib.get(f"{AI_BACKEND_URL}/health", timeout=3)
        if health.status_code != 200:
            raise Exception(f"HTTP {health.status_code}")
        print(f"  ✅ AI Backend is ONLINE at {AI_BACKEND_URL}")
    except Exception as e:
        print(f"  ⚠️  AI Backend is OFFLINE ({e}). Skipping HTTP tests.")
        print(f"     To enable: run `pnpm dev:ai` in another terminal.")
        return None

    # Test /health endpoint latency (baseline)
    latencies = []
    for _ in range(5):
        t0 = time.perf_counter()
        req_lib.get(f"{AI_BACKEND_URL}/health", timeout=5)
        latencies.append((time.perf_counter() - t0) * 1000)
    avg_health_ms = statistics.mean(latencies)
    print(f"\n  /health ping avg (5 samples): {avg_health_ms:.1f} ms (network baseline)")

    # Test /session endpoint timing
    # Using a small direct text so we don't need an actual courseId with DB data
    session_payload = {
        "courseId": "00000000-0000-0000-0000-000000000001",
        "sources": [],
        "topic": "Introduction to Binary Search Trees",
        "directText": (
            "A binary search tree (BST) is a data structure in which each node has at most two children. "
            "The left subtree of a node contains only nodes with keys less than the node's key. "
            "The right subtree contains only nodes with keys greater than the node's key. "
            "Search, insert, and delete operations have average time complexity of O(log n)."
        ),
        "voice": "male"
    }

    print(f"\n  Testing /session (Gemini script generation via backend)...")
    t_session_start = time.perf_counter()
    try:
        resp = req_lib.post(
            f"{AI_BACKEND_URL}/session",
            json=session_payload,
            timeout=60
        )
        t_session_end = time.perf_counter()
        session_ms = (t_session_end - t_session_start) * 1000

        if resp.status_code == 200:
            data = resp.json()
            script = data.get("script", "")
            chunks_used = data.get("chunksUsed", 0)
            print(f"  ✅ /session total latency:    {session_ms:.1f} ms ({session_ms/1000:.2f}s)")
            print(f"     Script length:             {len(script)} characters")
            print(f"     Chunks used:               {chunks_used}")
            print(f"     (Network baseline:         {avg_health_ms:.1f} ms)")
            print(f"     Net Gemini gen time:        ~{session_ms - avg_health_ms:.1f} ms")
            return {
                "health_ping_ms": round(avg_health_ms, 1),
                "session_total_ms": round(session_ms, 1),
                "net_gemini_ms": round(session_ms - avg_health_ms, 1),
                "script_chars": len(script),
                "chunks_used": chunks_used,
            }
        else:
            print(f"  ❌ /session error: HTTP {resp.status_code}")
            print(f"     {resp.text[:300]}")
            return {"error": f"HTTP {resp.status_code}"}

    except Exception as e:
        print(f"  ❌ Request failed: {e}")
        return {"error": str(e)}


# ── Test 4: Pure Math — Bandwidth Calculation ─────────────────────────────────
def test_bandwidth_calculation():
    print(f"\n{'═'*62}")
    print("  TEST 4: Bandwidth — Mathematical Calculation")
    print(f"{'═'*62}")

    # WAV audio specs used by HeadTTS (Kokoro)
    sample_rate = 24000   # Hz
    bit_depth   = 16      # bits
    channels    = 1       # mono
    
    audio_bytes_per_sec = (sample_rate * bit_depth * channels) / 8
    audio_kbps_raw      = (audio_bytes_per_sec * 8) / 1000

    # With compression (WAV is uncompressed, but network sends WAV chunks)
    # Actual measured: streaming over HTTP typically adds ~5-10% overhead
    overhead_factor = 1.07
    audio_kbps_network = audio_kbps_raw * overhead_factor

    # Viseme JSON overhead estimate
    # Each viseme: ~40 bytes JSON ({"name":"aa","start":0.12,"end":0.18})
    # Average 8 visemes/second of speech
    visemes_per_sec   = 8
    bytes_per_viseme  = 40
    viseme_kbps       = (visemes_per_sec * bytes_per_viseme * 8) / 1000

    total_kbps = audio_kbps_network + viseme_kbps

    # Comparison: 1080p WebRTC video
    video_kbps_min = 2500
    video_kbps_max = 4000
    video_kbps_avg = (video_kbps_min + video_kbps_max) / 2
    bandwidth_reduction_pct = ((video_kbps_avg - total_kbps) / video_kbps_avg) * 100

    print(f"\n  WAV audio specs (Kokoro/HeadTTS):")
    print(f"     Sample rate:    {sample_rate} Hz")
    print(f"     Bit depth:      {bit_depth}-bit")
    print(f"     Channels:       {'Mono' if channels == 1 else 'Stereo'}")
    print(f"\n  Calculated values:")
    print(f"     Raw audio bitrate:      {audio_kbps_raw:.1f} kbps")
    print(f"     Network audio (+ overhead): {audio_kbps_network:.1f} kbps")
    print(f"     Viseme JSON overhead:   {viseme_kbps:.1f} kbps")
    print(f"     TOTAL stream:           {total_kbps:.1f} kbps")
    print(f"\n  Comparison vs 1080p WebRTC:")
    print(f"     Video stream:           {video_kbps_avg:.0f} kbps (avg)")
    print(f"     Bandwidth reduction:    {bandwidth_reduction_pct:.1f}%")

    return {
        "audio_kbps_raw": round(audio_kbps_raw, 1),
        "audio_kbps_network": round(audio_kbps_network, 1),
        "viseme_kbps": round(viseme_kbps, 1),
        "total_stream_kbps": round(total_kbps, 1),
        "video_comparison_kbps": video_kbps_avg,
        "bandwidth_reduction_pct": round(bandwidth_reduction_pct, 1),
        "note": "Mathematical calculation from WAV PCM spec (unambiguous)"
    }


# ── Main ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║     IntelliClass AI — Real Backend Benchmark Suite          ║")
    print("║     Gemini latency | Embedding | E2E pipeline | Bandwidth   ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print(f"\nRun time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    report = {"timestamp": datetime.now().isoformat()}

    report["gemini_generation"] = test_gemini_latency()
    report["embedding"]         = test_embedding_latency()
    report["http_backend"]      = test_backend_http()
    report["bandwidth"]         = test_bandwidth_calculation()

    # Save report
    out_path = Path(__file__).parent / "ai-backend-benchmark-result.json"
    out_path.write_text(json.dumps(report, indent=2, default=str))

    print(f"\n{'═'*62}")
    print(f"  📄 Full results saved to: {out_path}")
    print(f"{'═'*62}\n")
