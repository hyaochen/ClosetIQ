# tryon-bridge

Host-side GPU service for the "virtual try-on" PoC (T-CL-022). The `closet-api` container sends a
full-body photo plus a garment image; FASHN VTON v1.5 (Apache-2.0, 972M parameters, runs locally) returns
a composite PNG. Nothing leaves the machine. Allowlisted accounts only (`AI_ALLOWED_USER_IDS`).

```
closet-api --HTTP, Bearer--> host 127.0.0.1:8766 (server.py, FastAPI + uvicorn) --> fashn_vton TryOnPipeline (CUDA)
```

- Same conventions as `tools/claude-bridge`: binds `127.0.0.1` only (refuses `0.0.0.0`), Docker Desktop forwards
  `host.docker.internal` to host loopback, shared Bearer secret (constant-time compare), `GET /health` is the ping.
- `POST /tryon` JSON `{ "person": "<base64 jpeg|png|webp>", "garment": "<base64>", "category": "tops|bottoms|one-pieces", "seed"?: 42 }`
  returns `image/png` (576x864; headers `X-Duration-Ms`, `X-Width`, `X-Height`). Each image up to 8 MB / 4096 px.
  A transparent cutout garment is flattened onto white (the pipeline is run with `garment_photo_type="flat-lay"`).
- The model stays resident (about 4.7 GB VRAM idle, about 5.5 GB reserved while running; torch peak allocation 3.2 GB).
  One inference at a time, up to 2 in flight (then 429), 570 s timeout (504, `TRYON_TIMEOUT_S`). `GET /health` also reports `busy` and `waiting` (in flight, including the running one). A timed-out job cannot be killed
  mid-flight, so it keeps the lock until it finishes; the next request queues behind it.
- Privacy: person photos exist only in memory. No file is written, no image content is logged
  (one line per call: time, route, status, ms; plus tqdm progress). HF telemetry is disabled
  (`HF_HUB_DISABLE_TELEMETRY=1`, `DO_NOT_TRACK=1`). The FASHN source has no network code besides weight download.
- API side routes (T-CL-023, submit + poll): `GET /api/tryon/status`; `POST /api/tryon` (multipart `itemId` + `file`) validates and answers
  **202 `{ jobId, quota }`** at once; `GET /api/tryon/jobs/:id` -> `{ status: queued|running|done|failed, error?, queuePosition?, elapsedMs }`;
  `GET /api/tryon/jobs/:id/result` -> the PNG (409 until done). Another user's, unknown or expired job is 404. One job in flight per user (409),
  jobs run one at a time across users (up to `TRYON_MAX_QUEUED`=4 waiting, then 503). Jobs and PNGs live in api memory only, `TRYON_JOB_TTL_MS`
  (15 min) after they end; an api restart loses them. The api waits up to `TRYON_JOB_TIMEOUT_MS` (10 min) per job; it talks to the bridge on
  the host, not through the Cloudflare tunnel, so the 100 s limit only applies to the short polling requests. Categories:
  TOP and OUTERWEAR -> tops, BOTTOM -> bottoms, DRESS -> one-pieces; everything else is 400.
  Daily limit `TRYON_DAILY_LIMIT` (default 20, counted in `AiUsage` under day `tryon:YYYY-MM-DD`, no migration), counted when the job is accepted
  and refunded if the bridge call fails.

## Setup (once, about 6 GB disk: venv 3.6 GB, weights 2.1 GB, human parser 0.25 GB in the HF cache)

Run from the repo root (PowerShell or Git Bash). The venv needs a CUDA build of torch. Match the driver:
`nvidia-smi` showed CUDA 13.3, so the cu130 wheels were used. With cu128 torch, `onnxruntime-gpu` 1.31 cannot
find `cublasLt64_13.dll` and DWPose silently falls back to CPU (slower). `server.py` imports torch before
fashn_vton on purpose so onnxruntime picks up torch's CUDA 13 DLLs.

```
python -m venv tools/tryon-bridge/.venv
tools/tryon-bridge/.venv/Scripts/python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu130
git clone https://github.com/fashn-AI/fashn-vton-1.5.git <somewhere-outside-the-repo>   # tested at commit 7c0f10a
tools/tryon-bridge/.venv/Scripts/python.exe -m pip install <that-clone> fastapi uvicorn
tools/tryon-bridge/.venv/Scripts/python.exe <that-clone>/scripts/download_weights.py --weights-dir tools/tryon-bridge/weights
node tools/tryon-bridge/setup-token.mjs        # writes bridge.config.json and ../../.env.ai (TRYON_BRIDGE_TOKEN), never prints it
```

`requirements.lock.txt` is the `pip freeze` of the working venv (minus the local fashn-vton install).
venv, weights, `bridge.config.json` and `bridge.log` are gitignored.

## Run

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools/tryon-bridge/start-bridge.ps1   # foreground, appends stdout+stderr to bridge.log
# the script hands the redirection to cmd.exe: Windows PowerShell 5.1 turns python's stderr INFO lines into NativeCommandError and would exit
```

Model load takes about 6-11 s. Not registered as a logon task (the worker does not touch Windows settings);
if you want it at logon, copy the `tools/claude-bridge/run-hidden.vbs` pattern (never a direct powershell task).
The bridge being down is safe: `/api/tryon/status` reports `enabled:false` within 60 s and the item page hides the button.
Add your ClosetIQ user id to `AI_ALLOWED_USER_IDS` in `.env.ai` (shared with the AI bridge) and recreate the api container.

## Measured on RTX 4070 Ti SUPER 16 GB (2026-11-01)

- Output 576x864 (the model's working size, whatever the input size).
- 30 diffusion steps: about 23-29 s per image when the GPU is otherwise free; 80-200 s when other processes
  keep it at 90%+ utilisation (this host runs other GPU jobs). 20 steps (`TRYON_TIMESTEPS=20`) is roughly one third faster.
- Cloudflare's tunnel gives up on a response after 100 s (error 524), so `/api/tryon` is submit + poll (T-CL-023); the long wait
  happens between api and bridge on the same host. A job that times out still keeps the GPU lock until it finishes (cannot be aborted).
