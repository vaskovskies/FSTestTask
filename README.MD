# Lumana Test Task

Microservice-based product search & log aggregation platform.

## Architecture

```mermaid
graph TB
    FE[Angular Frontend<br/>port 4200] -->|HTTPS| DJ[dummyjson.com<br/>products/search]
    FE -.->|future| SA

    subgraph Docker ["docker compose"]
        SA[Service A<br/>NestJS<br/>:3000 HTTP / :50051 gRPC] --> M[(MongoDB<br/>:27017)]
        SA --> R[(Redis Stack<br/>:6379)]
        SA -->|gRPC| SB[Service B<br/>Go/Gin<br/>:8080 HTTP / :50052 gRPC]
        SB --> M
        SB -.->|Pub/Sub<br/>service_events| R
    end
```

**Intentional split:** The frontend queries [dummyjson.com](https://dummyjson.com/products) directly — it does not call Service A. The Docker stack (Mongo, Redis, Service A/B) operates as an independent data pipeline: Service A ingests/search products and publishes events to Redis Pub/Sub; Service B consumes those events, provides log querying, and generates PDF reports. The architecture is designed so the frontend can be switched to talk to Service A by changing the `environment` file.

## Services

### Service A — NestJS (`:3000`)
Ingestion, search, and event publishing microservice.
- `POST /api/products/fetch-and-save` — fetch from dummyjson, download as JSON/Excel
- `POST /api/products/upload-and-import` — upload JSON/Excel file, upsert to Mongo
- `GET /api/products/search` — full-text search with filters & pagination
- `GET /api/docs` — Swagger UI
- gRPC server on `:50051`

### Service B — Go/Gin (`:8080`)
Log aggregation and PDF report generation microservice.
- `GET /api/logs` — query logs with filters (service, action, level, date range, pagination)
- `GET /api/reports/pdf` — generate PDF report from Redis TimeSeries data
- `GET /api/health` — health check
- `GET /swagger/*any` — Swagger UI
- gRPC server on `:50052`
- Subscribes to Redis Pub/Sub channel `service_events` for log ingestion

### Shared Infrastructure
- **MongoDB** `:27017` — per-service databases (`lumana_service_a`, `lumana_service_b`)
- **Redis Stack** `:6379` — TimeSeries metrics & Pub/Sub event bus

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://root:examplesecret@mongodb:27017/lumana_db?authSource=admin` | MongoDB connection string |
| `MONGO_PORT` | `27017` | MongoDB host port |
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `SERVICE_A_PORT` | `3000` | Service A HTTP port |
| `SERVICE_A_GRPC_PORT` | `50051` | Service A gRPC port |
| `SERVICE_B_PORT` | `8080` | Service B HTTP port |
| `SERVICE_B_GRPC_PORT` | `50052` | Service B gRPC port |
| `SERVICE_A_MONGO_DB_NAME` | `lumana_service_a` | Service A database name |
| `SERVICE_B_MONGO_DB_NAME` | `lumana_service_b` | Service B database name |

Copy `.env.example` to `.env` and adjust as needed — defaults work for local dev.

## Quick Start

### Backend (Docker)

```bash
docker compose up --build
```

This starts MongoDB, Redis, Service A (`:3000`), and Service B (`:8080`).

### Frontend (separate terminal)

```bash
cd frontend/lumanataskv3
npm install
ng serve
```

Opens at `http://localhost:4200`.

## Smoke Test Checklist

After `docker compose up`:

- [ ] **Service A health** — `curl http://localhost:3000/api/products/search?q=phone` returns JSON with products
- [ ] **Service B health** — `curl http://localhost:8080/api/health` returns `{"status":"ok"}`
- [ ] **Swagger (A)** — open `http://localhost:3000/api/docs`
- [ ] **Swagger (B)** — open `http://localhost:8080/swagger/index.html`
- [ ] **Logs query** — `curl http://localhost:8080/api/logs` returns log entries (populated after search requests hit Service A)
- [ ] **Fetch & export** — `curl -X POST http://localhost:3000/api/products/fetch-and-save?format=json -o products.json`
- [ ] **Frontend** — `http://localhost:4200` loads and searches against dummyjson

## API Overview

### Service A

| Method | Path | Description |
|---|---|---|
| POST | `/api/products/fetch-and-save?format=json\|excel` | Fetch from dummyjson & download |
| POST | `/api/products/upload-and-import` | Upload file & upsert to Mongo |
| GET | `/api/products/search?q=&category=&minPrice=&maxPrice=&page=&limit=` | Search products |

### Service B

| Method | Path | Description |
|---|---|---|
| GET | `/api/logs?service=&action=&level=&start_date=&end_date=&page=&limit=` | Query logs |
| GET | `/api/reports/pdf?metric=&start=&end=` | Generate PDF report |
| GET | `/api/health` | Health check |

## Architecture Decision: FE ↔ Backend Split

The frontend currently calls `https://dummyjson.com` directly rather than Service A. This is a deliberate choice:

- The Docker stack focuses on the **backend pipeline** (ingestion → storage → event bus → log aggregation → reporting)
- The Angular client is a **separate consumer** that can be pointed at Service A by replacing `dummyJsonBaseUrl` in `src/environments/environment.ts` with `http://localhost:3000` and mapping the response shape (`{products, total, skip, limit}` ↔ `{data, total, page}`)