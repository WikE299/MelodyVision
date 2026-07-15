FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/home/user/.cache/huggingface \
    CLAP_DEVICE=cpu \
    CLAP_PRELOAD=1 \
    CLAP_DISABLED=0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 user

WORKDIR /home/user/app

COPY --chown=user:user requirements.txt ./requirements.txt
RUN python -m pip install --index-url https://download.pytorch.org/whl/cpu torch==2.9.1 \
    && python -m pip install -r requirements.txt

COPY --chown=user:user app ./app
COPY --chown=user:user evaluation ./evaluation

USER user

RUN python -c "from transformers import AutoProcessor, ClapModel; name='laion/clap-htsat-fused'; AutoProcessor.from_pretrained(name); ClapModel.from_pretrained(name)"

EXPOSE 7860

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
