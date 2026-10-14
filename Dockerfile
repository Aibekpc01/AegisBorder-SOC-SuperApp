FROM node:24-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS frontend
WORKDIR /frontend
ARG VITE_PUBLIC_OFFICIAL_EMBLEMS=true
ENV VITE_PUBLIC_OFFICIAL_EMBLEMS=$VITE_PUBLIC_OFFICIAL_EMBLEMS
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/src ./src
RUN npm run build

FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
WORKDIR /code
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY requirements.lock-linux.txt .
RUN pip install --no-cache-dir -r requirements.lock-linux.txt
COPY app ./app
COPY --from=frontend /frontend/dist ./app/web
COPY migrations ./migrations
COPY alembic.ini .
EXPOSE 8000
CMD ["sh","-c","alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers"]
