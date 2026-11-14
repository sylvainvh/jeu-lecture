# ---- compilation du jeu ------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN ONNXRUNTIME_NODE_INSTALL=skip npm ci
COPY . .
RUN npm test && npm run build

# ---- voix de synthèse Piper (binaire + voix française) -------------------------
FROM debian:bookworm-slim AS piper
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz | tar -xz -C /opt
RUN mkdir -p /opt/piper-voices && cd /opt/piper-voices \
 && curl -fsSLO https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx \
 && curl -fsSLO https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json

# ---- image finale ---------------------------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    PIPER_BIN=/opt/piper/piper \
    PIPER_MODEL=/opt/piper-voices/fr_FR-siwis-medium.onnx
WORKDIR /app
COPY package.json package-lock.json ./
# onnxruntime-node (son syllabe par syllabe) embarque les binaires de toutes les plateformes : on ne garde que Linux x64
RUN ONNXRUNTIME_NODE_INSTALL=skip npm ci --omit=dev && npm cache clean --force \
 && rm -rf node_modules/onnxruntime-node/bin/napi-v6/darwin node_modules/onnxruntime-node/bin/napi-v6/win32 node_modules/onnxruntime-node/bin/napi-v6/linux/arm64
COPY --from=build /app/dist ./dist
COPY --from=piper /opt/piper /opt/piper
COPY --from=piper /opt/piper-voices /opt/piper-voices
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/info').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server/index.js"]
