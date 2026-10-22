# claude-bridge

Host-side service that lets the `closet-api` container run clothing photo recognition through the
account holder's own Claude subscription (`claude -p`). Account holder only: the subscription must
never serve other users (Anthropic ToS), so the API gates it with `AI_ALLOWED_USER_IDS`.

## How it works

```
closet-api (container) --HTTP, Bearer--> host 127.0.0.1:8765 (bridge.js) --stdin stream-json--> claude.exe (--safe-mode, no tools)
```

- Listens on `127.0.0.1` only. Docker Desktop forwards `host.docker.internal` to host loopback
  (verified 2026-10-22: a container reached a service bound to 127.0.0.1, with and without
  `--add-host=host.docker.internal:host-gateway`). The bridge refuses to start on `0.0.0.0`.
- `POST /analyze` `{ "image": "<base64 jpeg|png|webp, max 3MB>" }` returns `{ text, model, usage, durationMs }`.
  `GET /health` is the ping the API uses. Both need `Authorization: Bearer <token>`.
- The image is sent as an image content block over stdin. The model gets **no tools at all**
  (`--tools ''` plus a full `--disallowed-tools` list), so text hidden inside a photo cannot make it read
  host files. `--safe-mode` keeps the global CLAUDE.md, memory, skills and hooks out of the request
  (verified: a fact that only exists in the global CLAUDE.md is answered UNKNOWN).
- `claude.exe` is spawned with `shell:false` (the `.cmd` shim with `shell:true` silently mangles CJK/JSON args).
  `ANTHROPIC_API_KEY` is removed from the child env so billing never silently leaves the subscription.
- Concurrency 1 (up to 3 waiting, then 429), 90 s timeout, one log line per call
  (time, route, status, ms) in `bridge.log`; no image and no response content is logged.
- Node with zero dependencies: the host already has Node (the claude CLI ships on it) and the repo is Node.

## Setup (once)

```
node tools/claude-bridge/setup-token.mjs        # writes bridge.config.json and ../../.env.ai, never prints the secret
node tools/claude-bridge/bridge.js              # or use run-hidden.vbs, see below
```

Both files are gitignored. `--rotate` makes a new secret (restart the bridge and recreate the api container).

API side (`.env.ai`, not in git): `CLAUDE_BRIDGE_TOKEN` (written by the script) and
`AI_ALLOWED_USER_IDS=<your ClosetIQ user id>`. Compose passes `AI_PROVIDER` (default `auto`) and
`CLAUDE_BRIDGE_URL` (default `http://host.docker.internal:8765`). With `auto`, an Anthropic API key wins
over the bridge; set `AI_PROVIDER=bridge` to force the subscription.

## Start at logon (not registered by the worker)

`run-hidden.vbs` launches `start-bridge.ps1` with a hidden window. Register it with Task Scheduler as
`wscript.exe run-hidden.vbs` (see `register-task.ps1.txt`), never as a direct `powershell.exe` task
(that flashes a black console window). The bridge being down is safe: the app hides the AI step.
