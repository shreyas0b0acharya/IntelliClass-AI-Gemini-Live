from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from services.extractor import extract_pdf_text
from services.chunker import chunk_text
from services.embedder import generate_embeddings
from supabase import create_client, Client
import os
import base64
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = FastAPI(title="IntelliClass AI Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "ai-backend",
        "port": 8000,
        "version": "2.0.0"
    }

# Initialize Supabase Client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
if not supabase_url or not supabase_key:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
supabase: Client = create_client(supabase_url, supabase_key)

# ─── Request Models ────────────────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    fileUrl: str
    fileName: str
    courseId: str

class SourceSelection(BaseModel):
    fileName: str
    startPage: Optional[int] = None
    endPage: Optional[int] = None

class SessionRequest(BaseModel):
    courseId: str
    sources: List[SourceSelection]
    topic: str
    customPrompt: Optional[str] = None
    directText: Optional[str] = None
    voice: Optional[str] = "male"

class QuestionRequest(BaseModel):
    question: str
    courseId: str
    studentName: str
    currentLectureContext: Optional[str] = None
    sessionTopic: Optional[str] = None

class ExtractImagesRequest(BaseModel):
    fileUrl: str          # Supabase public URL of the PDF
    fileName: str         # Original file name (for labelling assets)
    courseId: str         # Course the assets belong to
    sessionId: Optional[str] = None  # Optional, to scope assets to a session

# ─── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "IntelliClass AI Backend v2.0"}

# ─── PDF Image Extraction ───────────────────────────────────────────────────────

@app.post("/extract-images")
async def extract_images(req: ExtractImagesRequest):
    import fitz          # PyMuPDF
    import requests as req_lib
    import io
    import uuid as uuid_lib

    print(f"🖼️ Extracting images from: {req.fileName} | Course: {req.courseId}")

    try:
        pdf_response = req_lib.get(req.fileUrl, timeout=60)
        if pdf_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Could not download PDF from URL: {pdf_response.status_code}"
            )
        pdf_bytes = pdf_response.content

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        extracted = []
        seen_xrefs = set()

        for page_index in range(len(doc)):
            page = doc[page_index]
            image_list = page.get_images(full=True)

            for img_index, img in enumerate(image_list):
                xref = img[0]
                if xref in seen_xrefs:
                    continue
                seen_xrefs.add(xref)

                try:
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image.get("image")
                    ext = base_image.get("ext", "png")

                    if not image_bytes:
                        continue

                    extracted.append({
                        "bytes": image_bytes,
                        "ext": ext,
                        "page": page_index + 1,
                        "img_index": img_index,
                    })
                except Exception as img_err:
                    print(f"  ⚠️ Could not extract xref={xref}: {img_err}")

        doc.close()
        
        if not extracted:
            return {
                "status": "no_images",
                "message": "No embedded images found in this PDF.",
                "assets": []
            }

        created_assets = []
        extracted_response_images = []
        base_label = req.fileName.rsplit(".", 1)[0]

        for item in extracted:
            # Skip tiny icons or spacer pixels
            if len(item["bytes"]) < 1024:
                continue

            asset_id = str(uuid_lib.uuid4())
            storage_path = f"{req.courseId}/media_assets/{asset_id}.{item['ext']}"
            label = f"{base_label} — Page {item['page']} (img {item['img_index'] + 1})"
            content_type = f"image/{'jpeg' if item['ext'] in ('jpg', 'jpeg') else item['ext']}"
            b64_str = base64.b64encode(item["bytes"]).decode("utf-8")

            extracted_response_images.append({
                "id": asset_id,
                "page": item["page"],
                "img_index": item["img_index"],
                "ext": item["ext"],
                "contentType": content_type,
                "base64": b64_str,
                "label": label,
                "fileName": req.fileName,
            })

            # Attempt direct service-role upload to course-files bucket if credentials permit
            try:
                upload_res = supabase.storage.from_("course-files").upload(
                    path=storage_path,
                    file=item["bytes"],
                    file_options={"content-type": content_type},
                )

                public_url = supabase.storage.from_("course-files").get_public_url(storage_path)

                insert_data: dict = {
                    "id": asset_id,
                    "course_id": req.courseId,
                    "type": "image",
                    "file_url": public_url,
                    "label": label,
                    "source": "pdf_extracted",
                }
                if req.sessionId:
                    insert_data["session_id"] = req.sessionId

                result = supabase.table("media_assets").insert(insert_data).execute()
                if result.data:
                    created_assets.append(result.data[0])

            except Exception as upload_err:
                err_msg = str(upload_err)
                if "row-level security" in err_msg.lower() or "403" in err_msg:
                    pass  # Next.js will perform authenticated upload
                else:
                    print(f"  ⚠️ Could not upload image {asset_id}: {upload_err}")

        return {
            "status": "success",
            "total": len(extracted_response_images),
            "message": f"Extracted {len(extracted_response_images)} visual diagram(s) from {req.fileName}.",
            "images": extracted_response_images,
            "assets": created_assets,
        }

    except Exception as e:
        print(f"❌ Image extraction error: {e}")
        return {"status": "error", "message": str(e), "images": [], "assets": []}

# ─── Process PDF ───────────────────────────────────────────────────────────────

@app.post("/process")
async def process(req: ProcessRequest):
    try:
        pages = extract_pdf_text(req.fileUrl)
        if not pages:
            return {"error": "Could not extract text from PDF."}

        chunks = []
        seen_content = set()

        for page_num, text in pages:
            if not text.strip():
                continue
            page_chunks = chunk_text(text)
            for chunk in page_chunks:
                fingerprint = chunk[:80]
                if fingerprint in seen_content:
                    continue
                seen_content.add(fingerprint)
                chunks.append({
                    "content": chunk,
                    "page": page_num,
                    "source": req.fileName,
                    "courseId": req.courseId
                })

        if not chunks:
            return {"totalChunks": 0, "message": "No text could be extracted."}

        chunks = chunks[:2000]
        texts_to_embed = [c["content"] for c in chunks]
        embeddings = []

        for i in range(0, len(texts_to_embed), 100):
            batch = texts_to_embed[i:i+100]
            batch_embeddings = generate_embeddings(batch)
            embeddings.extend(batch_embeddings)

        rows_to_insert = []
        for i, chunk in enumerate(chunks):
            rows_to_insert.append({
                "course_id": req.courseId,
                "content": chunk["content"],
                "embedding": embeddings[i],
                "metadata": {
                    "page": chunk["page"],
                    "source": chunk["source"]
                }
            })

        for i in range(0, len(rows_to_insert), 200):
            supabase.table("document_chunks").insert(rows_to_insert[i:i+200]).execute()

        return {
            "status": "success",
            "totalChunks": len(chunks),
            "message": f"Successfully processed {len(chunks)} chunks."
        }

    except Exception as e:
        print(f"❌ Process error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── Create Session (Generate Teaching Script) ─────────────────────────────────

INDIAN_PROFESSOR_SYSTEM = """You are Professor Sharma, a warm, experienced Indian college professor who has been teaching for over 20 years.
You speak in the way a real Indian professor teaches in a classroom — slightly formal but friendly and encouraging.

Your teaching style:
- Always start with: "Okay students," or "Alright class," or "Good morning everyone,"
- Use natural Indian teaching phrases: "Let me explain this step by step", "Are you following?", "Any doubts so far?", "This is very important — please note this down", "Now, let us understand this clearly", "Right? Yes. Good."
- Give simple, relatable Indian examples and analogies
- Break concepts into small steps, 2-4 sentences per idea
- Occasionally check for understanding: "Is this clear?", "Good. Moving on."
- Use natural transitions: "Now,", "So,", "You see,", "Basically,", "Right?"
- Do NOT use bullet points, headers, markdown, or formatting symbols
- Write ONLY natural spoken sentences — every word should sound natural when read aloud by TTS
- Insert [PAUSE] after important concepts
- Insert [ENGAGEMENT] where professor asks a quick check-in question
- Script should be very detailed and cover ~15-20 minutes of teaching.
- Expand significantly on every point. Do not be brief.
- Never cut off a sentence midway — always complete each thought fully"""

@app.post("/session")
async def create_session(req: SessionRequest):
    try:
        all_chunks = []

        if req.sources:
            source_names = [s.fileName for s in req.sources]
            response = supabase.table("document_chunks") \
                .select("content, metadata") \
                .eq("course_id", req.courseId) \
                .in_("metadata->>source", source_names) \
                .limit(200) \
                .execute()

            if response.data:
                selection_map = {s.fileName: s for s in req.sources}
                for row in response.data:
                    meta = row.get("metadata", {})
                    src_name = meta.get("source")
                    page = meta.get("page")
                    selection = selection_map.get(src_name)
                    if selection:
                        if selection.startPage is not None and (page is None or page < selection.startPage):
                            continue
                        if selection.endPage is not None and (page is None or page > selection.endPage):
                            continue
                        all_chunks.append(row["content"][:1200])

        if req.directText and req.directText.strip():
            all_chunks.append(req.directText)

        if not all_chunks:
            raise HTTPException(status_code=400, detail="No relevant content found.")

        selected_chunks = all_chunks[:40]
        context = "\n\n---\n\n".join(selected_chunks)

        user_prompt = f"Topic: {req.topic}\n\n"
        if req.customPrompt:
            user_prompt += f"Special instructions: {req.customPrompt}\n\n"
        user_prompt += f"Course materials:\n{context}\n\nPlease generate a VERY LONG teaching script:"

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=INDIAN_PROFESSOR_SYSTEM
        )
        
        response = model.generate_content(
            user_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.75,
                max_output_tokens=8192
            )
        )

        raw_script = response.text or ""
        clean_script = raw_script.replace("*", "").replace("#", "").replace("`", "").strip()

        return {
            "status": "success",
            "topic": req.topic,
            "script": clean_script,
            "chunksUsed": len(selected_chunks)
        }

    except Exception as e:
        print(f"❌ Session creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))