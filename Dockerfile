# ============================================================
# Etapa 1: compilar el cliente React (Vite) a client/dist
# ============================================================
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ============================================================
# Etapa 2: servidor FastAPI (sirve la API, el WS y client/dist)
# ============================================================
FROM python:3.13-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Código del backend
COPY main.py world.py components.py systems.py world_serializer.py terrain_generator.py ./

# Cliente compilado desde la etapa 1
COPY --from=client-build /app/client/dist ./client/dist

# Carpeta de guardados (efímera en la mayoría de PaaS gratuitos)
RUN mkdir -p saves

EXPOSE 8000

# $PORT lo inyectan Render/HF/Fly; localmente usa 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
