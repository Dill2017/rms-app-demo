# Hotel Revenue Management System (RMS)

A full-stack Hotel Revenue Management System built on [Databricks](https://databricks.com) using the [apx](https://github.com/databricks-solutions/apx) framework. The app provides revenue managers with real-time pricing optimization, demand forecasting, occupancy analytics, competitor benchmarking, and natural language data exploration — all powered by Databricks Lakebase, Unity Catalog, and Genie Spaces.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Deployed Resources](#deployed-resources)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [Deploy to Databricks](#deploy-to-databricks)
- [Configuration](#configuration)
- [Tech Stack](#tech-stack)

---

## Features

- **Portfolio Dashboard** — KPI cards (total revenue, average occupancy, RevPAR, ADR), revenue trends, occupancy by region, and pickup curves with region/time filters.
- **Pricing Optimization** — RevPAR-maximizing pricing engine that suggests per-room-type daily prices based on demand forecasts, occupancy predictions, and competitor rates. Revenue managers can accept suggestions or set manual overrides.
- **Pricing Calendar** — Interactive monthly calendar view showing prices and occupancy per room type per date, with one-click accept/override pricing workflows.
- **Demand & Occupancy Forecasts** — 30-day forward demand scores and per-room-type occupancy predictions with confidence intervals.
- **Competitor Benchmarking** — Side-by-side comparison of your prices vs. competitors (Hilton, Marriott, Hyatt, IHG) across all room types.
- **Web Traffic Analytics** — Daily searches, page views, booking attempts, completed bookings, and conversion rates per hotel.
- **Pricing Opportunities** — Ranked list of hotels with the highest RevPAR uplift potential, filterable by region and risk level.
- **Natural Language Data Explorer** — Chat-based interface powered by a Databricks Genie Space that translates natural language questions into SQL and returns tabular results.
- **808 Hotels, 46 Cities, 6 Regions** — Realistic synthetic data generated via deterministic hash-based pipelines.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              Databricks Workspace                                    │
│                                                                                      │
│  ┌─────────────────────────────┐    ┌──────────────────────────────────────────────┐ │
│  │   Databricks Jobs           │    │         Databricks App (rms-app-ds)          │ │
│  │                             │    │                                              │ │
│  │  ┌───────────────────────┐  │    │  ┌────────────┐       ┌─────────────────┐   │ │
│  │  │ RMS Data Generation   │  │    │  │  React UI  │──────▶│  FastAPI Backend │   │ │
│  │  │ (daily, generates UC  │  │    │  │ (shadcn/ui │  /api │  (uvicorn, 2w)  │   │ │
│  │  │  Delta tables)        │  │    │  │  Recharts) │       │                 │   │ │
│  │  └──────────┬────────────┘  │    │  └────────────┘       └───────┬─────────┘   │ │
│  │             │               │    │                               │             │ │
│  │             ▼               │    └───────────────────────────────┼─────────────┘ │
│  │  ┌───────────────────────┐  │                                    │               │
│  │  │  Unity Catalog        │  │                     ┌──────────────┼──────────┐    │
│  │  │  (rms_hotel_demo.     │  │                     │              │          │    │
│  │  │   hotel_rms)          │◀─┼─── Synced Tables ───│  Lakebase PostgreSQL   │    │
│  │  │                       │  │    (UC → Lakebase)   │  (rms-app-ds)          │    │
│  │  │  8 Delta tables:      │  │                     │                        │    │
│  │  │  • hotel              │  │                     │  hotel_rms schema      │    │
│  │  │  • room_type          │  │                     │  (read-only, synced)   │    │
│  │  │  • room_price_base    │  │                     │                        │    │
│  │  │  • demand_forecast    │  │                     │  rms_app schema        │    │
│  │  │  • occupancy_forecast │  │                     │  (writable)            │    │
│  │  │  • occupancy_actuals  │  │                     │  • room_price          │    │
│  │  │  • competitor_price   │  │                     │  • pricing_decision    │    │
│  │  │  • web_traffic        │  │                     └────────────────────────┘    │
│  │  └───────────────────────┘  │                                                    │
│  │                             │    ┌──────────────────────────────────────────────┐ │
│  │  ┌───────────────────────┐  │    │           Genie Space                        │ │
│  │  │ App State Sync        │  │    │  (Natural language → SQL over hotel_rms)     │ │
│  │  │ (every 15min,         │  │    │  Used by the Explore page in the app         │ │
│  │  │  Lakebase → UC)       │  │    └──────────────────────────────────────────────┘ │
│  │  └───────────────────────┘  │                                                    │
│  │                             │    ┌──────────────────────────────────────────────┐ │
│  │  ┌───────────────────────┐  │    │        Synced Tables Setup Job               │ │
│  │  │ Synced Tables Setup   │  │    │  (one-time: creates UC → Lakebase syncs)     │ │
│  │  │ (one-time job)        │  │    └──────────────────────────────────────────────┘ │
│  │  └───────────────────────┘  │                                                    │
│  └─────────────────────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Data Generation Job** runs daily and writes 8 Delta tables to Unity Catalog (`rms_hotel_demo.hotel_rms`) with deterministic synthetic data for 808 hotels.
2. **Synced Tables Setup Job** (one-time) creates triggered synced tables that replicate the 8 UC Delta tables into the Lakebase PostgreSQL instance under the `hotel_rms` schema.
3. The **Databricks App** reads analytics/reference data from the `hotel_rms` schema (synced, read-only) and writes pricing decisions to the `rms_app` schema (writable).
4. **App State Sync Job** runs every 15 minutes and merges user pricing decisions and overridden room prices back from Lakebase into Unity Catalog.
5. The **Genie Space** is configured over the `hotel_rms` tables and provides natural language SQL access via the app's Explore page.

---

## Deployed Resources

This project is deployed as a [Databricks Asset Bundle (DAB)](https://docs.databricks.com/en/dev-tools/bundles/index.html) and provisions the following resources:

### Databricks App

| Resource | Description |
|----------|-------------|
| **rms-app-ds** | Full-stack Databricks App (FastAPI + React) served via uvicorn with 2 workers. Has `sql` user API scope and connects to Lakebase with `CAN_CONNECT_AND_CREATE` permission. |

### Lakebase PostgreSQL Database

| Resource | Description |
|----------|-------------|
| **rms-app-ds** (instance) | Managed Lakebase PostgreSQL instance (`CU_1` capacity) that serves both reads and writes for the app. |
| **hotel_rms** schema | Read-only schema populated via synced tables from Unity Catalog. Contains: `hotel`, `room_type`, `room_price_base`, `demand_forecast`, `occupancy_forecast`, `occupancy_actuals`, `competitor_price`, `web_traffic`. |
| **rms_app** schema | Writable schema managed by the app. Contains: `room_price` (active prices with manual overrides), `pricing_decision` (audit trail of accept/override decisions). |

### Databricks Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| **RMS Data Generation** | Daily at 05:00 UTC (paused) | Generates all 8 Unity Catalog Delta tables with deterministic synthetic data for 808 hotels, 46 cities, 5 room types. Runs on a 2-worker cluster. |
| **RMS Synced Tables Setup** | One-time (manual) | Creates 8 triggered synced tables that replicate UC Delta tables into the Lakebase PostgreSQL `hotel_rms` schema. Idempotent — skips tables that already exist. |
| **RMS App State Sync** | Every 15 minutes (paused) | Reads `pricing_decision` and user-modified `room_price` rows from Lakebase and merges them back into Unity Catalog Delta tables via MERGE INTO. |

### Genie Space

| Resource | Description |
|----------|-------------|
| **Hotel RMS Genie Space** | Configured over the `hotel_rms` tables in Unity Catalog. Powers the app's "Explore" page where users ask natural language questions that get translated to SQL and return tabular results. |

---

## Project Structure

```
rms_app_demo/
├── databricks.yml                          # DAB bundle config (app, jobs, variables, targets)
├── app.yml                                 # App runtime command (uvicorn)
├── pyproject.toml                          # Python project, apx config, UI registries
├── package.json                            # Frontend dependencies (bun)
├── resources/                              # DAB job definitions
│   ├── rms_data_generation_job.yml         #   Data generation job
│   ├── rms_synced_tables_setup_job.yml     #   Synced tables setup job
│   └── rms_app_state_sync_job.yml          #   App state sync job
├── src/
│   ├── pipelines/                          # Databricks job notebooks
│   │   ├── rms_data_generation/
│   │   │   └── generate_all_data.py        #   Generates 8 UC Delta tables
│   │   ├── rms_setup/
│   │   │   └── setup_synced_tables.py      #   Creates UC → Lakebase synced tables
│   │   ├── rms_app_state_sync/
│   │   │   └── sync_to_uc.py              #   Syncs Lakebase → UC (pricing decisions)
│   │   └── rms_forecasting/
│   │       └── transformations/
│   │           └── forecasts.py            #   Spark Declarative Pipeline (materialized views)
│   └── rms_app_ds/                         # Main app package
│       ├── backend/                        # FastAPI backend
│       │   ├── app.py                      #   Entry point, mounts routers
│       │   ├── router.py                   #   Main API routes (hotels, pricing, dashboard)
│       │   ├── genie_router.py             #   Genie Space integration
│       │   ├── models.py                   #   SQLModel tables + Pydantic API models
│       │   ├── pricing_engine.py           #   RevPAR-optimizing pricing algorithm
│       │   ├── analytics.py                #   Seasonal/day-of-week factors
│       │   ├── seed.py                     #   DB seeding (synced tables or dev fallback)
│       │   └── core/                       #   App factory, DI, Lakebase, config
│       │       ├── _config.py              #     AppConfig + logging
│       │       ├── _factory.py             #     create_app() / create_router()
│       │       ├── dependencies.py         #     Typed FastAPI dependencies
│       │       ├── lakebase.py             #     PostgreSQL engine, sessions, migrations
│       │       └── ...
│       └── ui/                             # React frontend
│           ├── main.tsx                    #   Entry: QueryClient + TanStack Router
│           ├── lib/
│           │   ├── api.ts                  #   Auto-generated OpenAPI client + React Query hooks
│           │   ├── utils.ts                #   Utility functions
│           │   └── selector.ts             #   Response unwrapping helper
│           ├── routes/
│           │   ├── __root.tsx              #   Root layout (nav, theme)
│           │   ├── index.tsx               #   Welcome / landing page
│           │   ├── guide.tsx               #   Getting started guide
│           │   ├── dashboard.tsx           #   Portfolio dashboard (KPIs, charts)
│           │   ├── opportunities.tsx       #   Pricing opportunities table
│           │   ├── hotels.index.tsx        #   Hotel list (search, filter, paginate)
│           │   ├── hotels.$hotelId.tsx     #   Hotel detail (calendar, forecasts, competitors)
│           │   └── explore.tsx             #   Genie natural language explorer
│           └── components/
│               ├── calendar/               #   Pricing calendar component
│               ├── genie/                  #   Chat UI, query results, hooks
│               ├── ui/                     #   shadcn/ui primitives
│               └── apx/                    #   Theme, navbar, logo
└── .build/                                 # Production build output (generated)
```

---

## Prerequisites

Before deploying this project, ensure you have:

### Tools

- **[Databricks CLI](https://docs.databricks.com/en/dev-tools/cli/index.html)** v0.230+ — configured with a workspace profile
- **Python 3.11+** with **[uv](https://docs.astral.sh/uv/)** package manager
- **[Bun](https://bun.sh/)** v1.0+ — for frontend dependency management
- **[apx CLI](https://github.com/databricks-solutions/apx)** — for local development (`uv tool install apx`)

### Databricks Workspace

- **Unity Catalog** enabled on your workspace
- **A UC catalog** for generated data (default: `rms_hotel_demo`). Create it if it doesn't exist:
  ```sql
  CREATE CATALOG IF NOT EXISTS rms_hotel_demo;
  CREATE SCHEMA IF NOT EXISTS rms_hotel_demo.hotel_rms;
  ```
- **A UC catalog for Lakebase** (default: `rms_app_ds_lakebase`) — this is automatically created when the Lakebase instance is provisioned
- **Lakebase (managed PostgreSQL)** enabled on your workspace — the bundle provisions a `CU_1` instance
- **Genie Spaces** access — you need to create a Genie Space over the `hotel_rms` tables and update the `GENIE_SPACE_ID` in `src/rms_app_ds/backend/genie_router.py`
- **Serverless compute** or a cluster with access to Unity Catalog for running the data generation and sync jobs
- **Databricks CLI profile** configured for your workspace:
  ```bash
  databricks configure --profile <your-profile>
  ```

### Permissions

- `CAN_MANAGE` on the target UC catalog/schema (to create tables)
- `CAN_MANAGE` on the Lakebase instance (provisioned by the bundle)
- Permission to create and run Databricks Jobs
- Permission to deploy Databricks Apps

---

## Getting Started

### Local Development

Local development uses apx dev servers that run the FastAPI backend, React frontend, and OpenAPI client watcher concurrently. In dev mode, the app seeds a local PostgreSQL database with synthetic data (no Databricks connection needed for the core experience).

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Dill2017/rms-app-demo.git
   cd rms-app-demo
   ```

2. **Install dependencies:**
   ```bash
   uv sync                    # Python dependencies
   bun install                # Frontend dependencies
   ```

3. **Start development servers:**
   ```bash
   uv run apx dev start
   ```
   This starts the FastAPI backend, Vite dev server, and OpenAPI client watcher. The app will be available at the URL printed in the terminal (typically `http://localhost:8001`).

   > **Note:** In dev mode, the app automatically detects that synced tables are unavailable and falls back to generating all data locally in the dev PostgreSQL database. The Genie explorer page requires a Databricks workspace connection and will not be functional in fully local mode.

4. **View logs and check status:**
   ```bash
   uv run apx dev logs        # View all logs
   uv run apx dev logs -f     # Stream logs in real-time
   uv run apx dev status      # Check server status
   ```

5. **Run type checking:**
   ```bash
   uv run apx dev check       # TypeScript + Python type checks
   ```

6. **Stop servers:**
   ```bash
   uv run apx dev stop
   ```

### Deploy to Databricks

Deploy the full application with all resources (app, jobs, Lakebase database) to your Databricks workspace.

1. **Update bundle variables** in `databricks.yml` if you want to use different catalog/schema names:
   ```yaml
   variables:
     lakebase_instance_name:
       default: "rms-app-ds"           # Lakebase instance name
     forecast_catalog:
       default: "rms_hotel_demo"       # UC catalog for generated data
     forecast_schema:
       default: "hotel_rms"            # UC schema for generated data
     lakebase_catalog:
       default: "rms_app_ds_lakebase"  # UC catalog mapped to Lakebase
   ```

2. **Update the workspace profile** in `databricks.yml` under the target you want to deploy to:
   ```yaml
   targets:
     prod:
       workspace:
         profile: <your-databricks-cli-profile>
   ```

3. **Create the Genie Space** in your Databricks workspace:
   - Go to the Genie section in your workspace
   - Create a new Genie Space over the `hotel_rms` tables in your UC catalog
   - Copy the Genie Space ID and update `GENIE_SPACE_ID` in `src/rms_app_ds/backend/genie_router.py`

4. **Deploy the bundle:**
   ```bash
   databricks bundle deploy -t prod
   ```
   This provisions the Lakebase instance, deploys the app, and creates all three jobs.

5. **Run the data generation job** (first time):
   ```bash
   databricks bundle run rms_data_generation_job -t prod
   ```
   This creates the 8 Delta tables in Unity Catalog with synthetic data.

6. **Run the synced tables setup job** (first time):
   ```bash
   databricks bundle run rms_synced_tables_setup_job -t prod
   ```
   This creates triggered synced tables that replicate UC data into Lakebase.

7. **Unpause the recurring jobs** (optional):
   - **RMS Data Generation** — regenerates data daily at 05:00 UTC
   - **RMS App State Sync** — syncs pricing decisions from Lakebase to UC every 15 minutes

   You can unpause these from the Databricks Jobs UI or via CLI.

8. **Access the app** — navigate to the app URL shown in the Databricks Apps UI.

---

## Configuration

### Bundle Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `lakebase_instance_name` | `rms-app-ds` | Name of the Lakebase PostgreSQL instance |
| `forecast_catalog` | `rms_hotel_demo` | Unity Catalog catalog for generated data |
| `forecast_schema` | `hotel_rms` | UC schema for generated data |
| `lakebase_catalog` | `rms_app_ds_lakebase` | UC catalog mapped to the Lakebase instance |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PGAPPNAME` | PostgreSQL application name (set in `.env`) |
| `APX_DEV_DB_PORT` | Dev-mode PostgreSQL port (set automatically by apx) |
| `APX_DEV_DB_PWD` | Dev-mode PostgreSQL password (set automatically by apx) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TanStack Router, TanStack Query, shadcn/ui, Recharts, Tailwind CSS |
| **Backend** | Python 3.11+, FastAPI, SQLModel, psycopg3 |
| **Database** | Databricks Lakebase (managed PostgreSQL) |
| **Data Platform** | Databricks Unity Catalog, Delta Lake |
| **NL Explorer** | Databricks Genie Spaces |
| **Build** | apx, Vite, Hatch, uv |
| **Deployment** | Databricks Asset Bundles (DABs) |
| **API Client** | Auto-generated TypeScript from OpenAPI schema |

---

<p align="center">Built with <a href="https://github.com/databricks-solutions/apx">apx</a> on <a href="https://databricks.com">Databricks</a></p>
