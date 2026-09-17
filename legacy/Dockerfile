FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    STREAMLIT_BROWSER_GATHER_USAGE_STATS=false

WORKDIR /app

ARG PIP_INDEX_URL=https://pypi.org/simple

COPY requirements.txt ./
RUN pip install --no-cache-dir --index-url "$PIP_INDEX_URL" --requirement requirements.txt \
    && useradd --create-home --shell /usr/sbin/nologin appuser

COPY --chown=appuser:appuser app.py agent_core.py kb_tools.py ./
COPY --chown=appuser:appuser rag/ ./rag/
COPY --chown=appuser:appuser knowledge_base/ ./knowledge_base/

USER appuser

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8501/_stcore/health', timeout=3)" || exit 1

CMD ["streamlit", "run", "app.py", "--server.address=0.0.0.0", "--server.port=8501", "--server.headless=true"]
