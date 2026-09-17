from fastapi import FastAPI


app = FastAPI(
    title="企业知识库 RAG 智能助手 API",
    description="企业知识库问答与方案生成助手的最小 API 服务。",
    version="0.1.0",
)


@app.get("/")
def read_root() -> dict[str, str]:
    """Return basic project information."""
    return {
        "project": "enterprise-rag-assistant",
        "name": "企业知识库 RAG 智能助手",
        "status": "running",
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    """Return service health status."""
    return {"status": "ok"}
