# KineticLife Server

FastAPI backend workspace for post-set action submissions, template-based DTW summary reports, in-memory demo history, and coaching-analysis helper code.

Current demo builds around local heuristic feedback in the browser. The server path is for summary-time DTW analysis after the client has segmented reps and submitted joint-angle sequences.

Current public routes:

- `GET /health`
- `GET /api/templates`
- `POST /api/actions`
- `GET /api/history/{action_id}`

There is no durable database in the active code path; submitted actions are stored in process memory.

## Quick Start

```bash
uv sync
uv run uvicorn app.main:app --reload
```

The action submission and data contracts are defined in `../docs/04_Interface_Contracts.md`.
