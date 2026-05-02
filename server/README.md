# KineticLife Server

FastAPI backend workspace for post-set action submissions, DTW summary reports, persistence, and async coaching advice.

Current demo builds around local heuristic feedback in the browser. The server path is for summary-time DTW analysis after the client has segmented reps and submitted joint-angle sequences.

## Quick Start

```bash
uv sync
uv run uvicorn app.main:app --reload
```

The action submission and data contracts are defined in `../docs/04_Interface_Contracts.md`.
