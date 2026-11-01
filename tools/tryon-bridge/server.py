"""ClosetIQ tryon-bridge: host-side FASHN VTON v1.5 inference service.

Binds 127.0.0.1 only, Bearer token, one inference at a time (short wait queue).
Person photos are processed in memory only: nothing is written to disk and no image
content is logged (one line per call: time, route, status, ms).
"""
import asyncio
import base64
import binascii
import hmac
import io
import json
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

HERE = Path(__file__).resolve().parent
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("DO_NOT_TRACK", "1")

import torch  # noqa: E402
import uvicorn  # noqa: E402
from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import JSONResponse, Response  # noqa: E402
from PIL import Image, ImageOps  # noqa: E402

cfg = {}
try:
    cfg = json.loads((HERE / "bridge.config.json").read_text(encoding="utf8"))
except Exception:
    pass

TOKEN = os.environ.get("TRYON_BRIDGE_TOKEN") or cfg.get("token", "")
PORT = int(os.environ.get("TRYON_BRIDGE_PORT") or cfg.get("port", 8766))
HOST = os.environ.get("TRYON_BRIDGE_HOST") or cfg.get("host", "127.0.0.1")
WEIGHTS = os.environ.get("TRYON_WEIGHTS_DIR") or str(HERE / "weights")
TIMEOUT_S = int(os.environ.get("TRYON_TIMEOUT_S", "180"))
TIMESTEPS = int(os.environ.get("TRYON_TIMESTEPS", "30"))
MAX_BYTES = 8 * 1024 * 1024
MAX_SIDE = 4096  # reject absurd dimensions before decoding into memory
MAX_QUEUE = 2
CATEGORIES = {"tops", "bottoms", "one-pieces"}

if len(TOKEN) < 32:
    sys.exit("[tryon-bridge] token missing or too short. Run: node tools/tryon-bridge/setup-token.mjs")
if HOST in ("0.0.0.0", "::"):
    sys.exit("[tryon-bridge] refusing to bind a wildcard address; use 127.0.0.1")

state = {"pipeline": None, "load_s": None, "busy": False, "waiting": 0}
infer_lock = threading.Lock()  # held until the worker thread really finishes (a timeout cannot kill it)


def log(route: str, status: int, ms: int, ok: bool):
    ts = time.strftime("%Y-%m-%dT%H:%M:%S")
    print(f"{ts} {route} {status} {'ok' if ok else 'fail'} {ms}ms", flush=True)


@asynccontextmanager
async def lifespan(_: FastAPI):
    from fashn_vton import TryOnPipeline

    t0 = time.time()
    state["pipeline"] = TryOnPipeline(weights_dir=WEIGHTS)
    state["load_s"] = round(time.time() - t0, 1)
    print(f"model loaded in {state['load_s']}s on {state['pipeline'].device}", flush=True)
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


def authed(req: Request) -> bool:
    h = req.headers.get("authorization", "")
    given = h[7:] if h.startswith("Bearer ") else ""
    return hmac.compare_digest(given.encode(), TOKEN.encode())


def decode_image(b64: str, name: str) -> Image.Image:
    try:
        raw = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError(f"{name}: bad base64")
    if not raw or len(raw) > MAX_BYTES:
        raise ValueError(f"{name}: empty or over 8MB")
    img = Image.open(io.BytesIO(raw))
    if img.format not in ("JPEG", "PNG", "WEBP"):
        raise ValueError(f"{name}: must be jpeg/png/webp")
    if max(img.size) > MAX_SIDE:
        raise ValueError(f"{name}: side over {MAX_SIDE}px")
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "LA", "P"):  # cutouts: flatten onto white (flat-lay product look)
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        bg.alpha_composite(img)
        img = bg
    return img.convert("RGB")


def run_inference(person, garment, category, seed):
    with infer_lock:
        state["busy"] = True
        try:
            out = state["pipeline"](
                person_image=person,
                garment_image=garment,
                category=category,
                garment_photo_type="flat-lay",
                num_samples=1,
                num_timesteps=TIMESTEPS,
                seed=seed,
            )
            return out.images[0]
        finally:
            state["busy"] = False


@app.get("/health")
async def health(req: Request):
    if not authed(req):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    ready = state["pipeline"] is not None
    return JSONResponse(
        {"ok": ready, "model": "fashn-vton-1.5", "busy": state["busy"], "loadSeconds": state["load_s"]},
        status_code=200 if ready else 503,
    )


@app.post("/tryon")
async def tryon(req: Request):
    t0 = time.time()

    def ms():
        return int((time.time() - t0) * 1000)

    if not authed(req):
        log("POST /tryon", 401, ms(), False)
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    if state["pipeline"] is None:
        return JSONResponse({"error": "loading"}, status_code=503)
    body = await req.body()
    if len(body) > MAX_BYTES * 3:
        log("POST /tryon", 413, ms(), False)
        return JSONResponse({"error": "too large"}, status_code=413)
    try:
        j = json.loads(body)
        category = str(j.get("category", ""))
        if category not in CATEGORIES:
            raise ValueError("category must be tops, bottoms or one-pieces")
        person = decode_image(str(j.get("person", "")), "person")
        garment = decode_image(str(j.get("garment", "")), "garment")
        seed = int(j.get("seed", 42))
    except Exception as e:  # noqa: BLE001
        log("POST /tryon", 400, ms(), False)
        return JSONResponse({"error": "bad request", "detail": str(e)[:120]}, status_code=400)
    del body

    if state["waiting"] >= MAX_QUEUE:
        log("POST /tryon", 429, ms(), False)
        return JSONResponse({"error": "busy"}, status_code=429)
    state["waiting"] += 1
    try:
        img = await asyncio.wait_for(asyncio.to_thread(run_inference, person, garment, category, seed), TIMEOUT_S)
    except asyncio.TimeoutError:
        log("POST /tryon", 504, ms(), False)
        return JSONResponse({"error": "timeout"}, status_code=504)
    except Exception as e:  # noqa: BLE001
        log("POST /tryon", 502, ms(), False)
        print(f"inference error: {type(e).__name__}", flush=True)  # type only, no content
        return JSONResponse({"error": "exec"}, status_code=502)
    finally:
        state["waiting"] -= 1
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    log("POST /tryon", 200, ms(), True)
    return Response(
        buf.getvalue(),
        media_type="image/png",
        headers={"X-Duration-Ms": str(ms()), "X-Width": str(img.width), "X-Height": str(img.height)},
    )


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning", access_log=False)
