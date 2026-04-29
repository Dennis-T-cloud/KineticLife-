from fastapi import FastAPI

app = FastAPI(title="KineticLife API", version="0.3.0")


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}
