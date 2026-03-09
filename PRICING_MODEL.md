# Pricing Model

This document describes the pricing engine that powers the room-rate suggestions in the Hotel Revenue Management System (RMS). It covers the algorithm, data flow, architecture, and areas for future improvement.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Algorithm Deep Dive](#algorithm-deep-dive)
  - [Objective Function](#objective-function)
  - [Elasticity Model](#elasticity-model)
  - [Competitive Displacement](#competitive-displacement)
  - [Price Search](#price-search)
  - [Seasonal Adjustment](#seasonal-adjustment)
- [Data Inputs](#data-inputs)
- [Outputs](#outputs)
- [Decision Audit Trail](#decision-audit-trail)
- [Worked Example](#worked-example)
- [Next Steps and Improvement Suggestions](#next-steps-and-improvement-suggestions)
- [References](#references)

---

## Overview

The pricing engine is a **rule-based RevPAR optimiser** that suggests a nightly rate for each room type at each hotel. Its single objective is to maximise **Revenue Per Available Room (RevPAR)**, defined as:

```
RevPAR = Price × Occupancy Rate
```

The engine does not use machine learning directly. Instead, it consumes demand and occupancy **forecasts** produced by upstream Databricks pipelines and applies a microeconomic elasticity model to find the price point where the product of price and expected occupancy is highest.

Revenue managers see these suggestions in a calendar UI and can either **accept** them or **manually override** them. Every decision is recorded for audit and future model training.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Databricks Lakehouse                             │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  Spark Declarative Pipelines (Materialized Views)           │       │
│   │                                                             │       │
│   │  demand_forecast          occupancy_forecast                │       │
│   │  ─ demand_score           ─ predicted_occupancy_pct         │       │
│   │  ─ demand_level           ─ lower/upper_bound_pct           │       │
│   │  ─ expected_searches      ─ confidence                      │       │
│   │  ─ confidence             ─ predicted_rooms_sold            │       │
│   └──────────────────┬──────────────────────┬───────────────────┘       │
│                      │    Unity Catalog      │                          │
│   ┌─────────────┐    │    Delta Tables       │    ┌──────────────┐      │
│   │ competitor   │    │                      │    │ occupancy    │      │
│   │ _price       │    │                      │    │ _actuals     │      │
│   └──────┬───────┘    │                      │    └──────┬───────┘      │
│          │            │                      │           │              │
└──────────┼────────────┼──────────────────────┼───────────┼──────────────┘
           │            │   Lakebase Sync      │           │
           ▼            ▼                      ▼           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Lakebase (Managed PostgreSQL)                          │
│                                                                         │
│   hotel_rms schema (read-only synced tables)                            │
│   ┌────────────┐ ┌────────────────┐ ┌──────────────────┐ ┌───────────┐ │
│   │ competitor  │ │ demand         │ │ occupancy        │ │ occupancy │ │
│   │ _price      │ │ _forecast      │ │ _forecast        │ │ _actuals  │ │
│   └─────┬──────┘ └───────┬────────┘ └────────┬─────────┘ └─────┬─────┘ │
│         │                │                   │                 │       │
│         │   rms_app schema (writable)        │                 │       │
│         │   ┌──────────────┐ ┌────────────────────┐            │       │
│         │   │ room_price   │ │ pricing_decision   │            │       │
│         │   └──────────────┘ └────────────────────┘            │       │
└─────────┼────────────┼───────────────┼───────┼─────────────────┼───────┘
          │            │               │       ▲                 │
          ▼            ▼               ▼       │                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                                   │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                     pricing_engine.py                             │  │
│   │                                                                  │  │
│   │  Inputs:                              Output:                    │  │
│   │  ─ base_price                         ─ suggested_price          │  │
│   │  ─ current_occupancy                  ─ expected_revpar          │  │
│   │  ─ forecast_occupancy                 ─ expected_occupancy       │  │
│   │  ─ demand_score / forecast            ─ price_vs_competitor_pct  │  │
│   │  ─ competitor_avg                     ─ confidence               │  │
│   │  ─ room_count                                                    │  │
│   │                                                                  │  │
│   │  Algorithm: sweep 200 price candidates, maximise Price × Occ     │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                             │                                           │
│              GET /api/hotels/{id}/pricing                               │
│              GET /api/hotels/{id}/calendar                              │
│              GET /api/hotels/{id}/room-date-detail                      │
│              GET /api/opportunities                                     │
│                             │                                           │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         React Frontend                                   │
│                                                                         │
│   Pricing Calendar ─── Date Detail Panel ─── Accept / Override          │
│   Opportunities Table                                                   │
│                                                                         │
│   POST /api/hotels/{id}/pricing  ──▶  room_price + pricing_decision     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Summary

| Layer | Technology | Role |
|---|---|---|
| Forecasting Pipelines | Spark Declarative Pipelines (Materialized Views) | Produce 30-day demand and occupancy forecasts per hotel/room type |
| Data Storage | Unity Catalog Delta Tables | Source of truth for forecasts, competitor prices, actuals |
| Application Database | Lakebase (managed PostgreSQL) | Real-time query layer; synced read-only tables + writable app tables |
| Backend | FastAPI (Python) | Runs the pricing engine per-request, serves API endpoints |
| Pricing Engine | Pure Python (`pricing_engine.py`) | RevPAR-maximising heuristic — no external model serving calls |
| Frontend | React + Vite (TanStack Router) | Calendar UI for reviewing, accepting, or overriding suggestions |

---

## Algorithm Deep Dive

The core function is `suggest_price()` in `src/rms_app_ds/backend/pricing_engine.py`.

### Objective Function

The engine maximises RevPAR, the standard hotel performance metric:

```
RevPAR = candidate_price × expected_occupancy
```

This creates a natural trade-off: raising prices increases revenue per room sold but decreases the number of rooms sold. The optimal price sits at the peak of this curve.

### Elasticity Model

The engine models how occupancy responds to price changes using two forces:

**1. Base Elasticity** — general price sensitivity:

```
base_adjustment = 1.0 − 0.35 × (price_vs_competitor)
```

Where `price_vs_competitor = (candidate − competitor_avg) / competitor_avg`. A 10% premium above the market yields roughly a 3.5% occupancy reduction from this force alone.

| Parameter | Value | Meaning |
|---|---|---|
| `BASE_ELASTICITY` | 0.35 | Occupancy drops ~0.35 pp per 1% price increase relative to competitors |

**2. Competitive Displacement** — guest switching behaviour:

When the hotel is priced **above** competitors, guests actively switch to alternatives. This displacement accelerates non-linearly:

```
displacement = 0.60 × (price_vs_competitor ^ 2.0)
```

When priced **below** competitors, a small gain applies (30% of the competitive elasticity, linearly).

| Parameter | Value | Meaning |
|---|---|---|
| `COMPETITIVE_ELASTICITY` | 0.60 | Strength of the switching effect |
| `COMPETITIVE_ACCELERATION` | 2.0 | Displacement grows quadratically above competitors |

The combined occupancy multiplier is:

```
occ_multiplier = base_adjustment − displacement
occ_multiplier = clamp(occ_multiplier, 0.20, 1.15)
expected_occupancy = current_occupancy × occ_multiplier
```

### Competitive Displacement Curve

The quadratic acceleration is key. Small premiums above competitors have a modest effect, but the penalty grows rapidly:

| Price vs Competitors | Base Effect | Displacement | Combined Multiplier |
|---|---|---|---|
| −10% | +3.5% | +1.8% | ~1.05× |
| 0% (parity) | 0% | 0% | 1.00× |
| +5% | −1.8% | −0.2% | ~0.98× |
| +10% | −3.5% | −0.6% | ~0.96× |
| +15% | −5.3% | −1.4% | ~0.93× |

### Price Search

Rather than solving analytically, the engine performs a **brute-force grid search** over 200 evenly spaced price candidates:

1. **Floor:** 15% below competitor average (hard minimum: 70% of base price).
2. **Ceiling:** Up to `15% × (demand_score / 100)` above competitor average. At peak demand (score = 100) the maximum premium is 15%. At low demand (score = 30) it drops to ~4.5%.
3. **Selection:** The candidate that produces the highest `price × expected_occupancy` wins.

```
MAX_PREMIUM_PCT = 0.15
floor = competitor_avg × 0.85
ceiling = competitor_avg × (1.0 + 0.15 × demand_score / 100)
```

### Seasonal Adjustment

A separate `day_factor()` utility modulates base prices by time of year and day of week:

| Factor | Multiplier |
|---|---|
| Weekend (Fri–Sat) | 1.15× |
| Jan–Feb (low season) | 0.80–0.85× |
| Jun–Aug (peak season) | 1.20–1.25× |
| Dec (holidays) | 1.15× |
| Shoulder months | 0.90–1.10× |

This factor is applied to the base price before it enters the suggestion pipeline.

---

## Data Inputs

The pricing engine receives its inputs from several synced tables, aggregated by the backend router:

| Input | Source Table | Description |
|---|---|---|
| `base_price` | `hotel_rms.room_type` | Reference price per room type set by the hotel |
| `current_occupancy` | `hotel_rms.occupancy_actuals` | Actual occupancy rate for the date |
| `forecast_occupancy` | `hotel_rms.occupancy_forecast` | ML-predicted occupancy (30-day horizon) |
| `demand_score` | `hotel_rms.demand_forecast` | Demand intensity 0–100 (from forecast pipeline) |
| `forecast_demand_score` | `hotel_rms.demand_forecast` | Forward-looking demand score |
| `competitor_avg` | `hotel_rms.competitor_price` | Average competitor price for same room type and date |
| `room_count` | `hotel_rms.room_type` | Number of rooms of this type |
| `forecast_confidence` | `hotel_rms.occupancy_forecast` | Confidence score of the forecast (decays with lead time) |

When forecast data is available, it takes precedence over actuals. If forecasts are missing, the engine falls back to current actuals with a default confidence of 0.7.

---

## Outputs

The `suggest_price()` function returns a `PricingSuggestion` dataclass:

| Field | Type | Description |
|---|---|---|
| `suggested_price` | float | Optimal price rounded to 2 decimal places |
| `expected_revpar` | float | Projected RevPAR at the suggested price |
| `expected_occupancy` | float | Projected occupancy percentage |
| `price_vs_competitor_pct` | float | Suggested price position relative to competitor average (%) |
| `confidence` | float | Forecast confidence score (0.5–0.99) |

These outputs are surfaced through four API endpoints:

- **`GET /api/hotels/{id}/pricing`** — per room type/date pricing table
- **`GET /api/hotels/{id}/calendar`** — monthly calendar with daily averages
- **`GET /api/hotels/{id}/room-date-detail`** — detailed breakdown for a single date
- **`GET /api/opportunities`** — portfolio-wide view of hotels with highest RevPAR uplift potential

---

## Decision Audit Trail

When a revenue manager acts on a suggestion, the system records two things:

1. **`room_price`** (writable) — the new active price with a `price_source` of either `"suggestion"` or `"manual"`.
2. **`pricing_decision`** — an immutable audit record containing:
   - The system's `suggested_price`
   - The `accepted_price` (may differ for manual overrides)
   - The `decision` type (`"accepted"` or `"manual_override"`)
   - The `expected_revpar` at the time of suggestion
   - A timestamp

This audit trail is valuable for measuring model performance and training future ML models.

---

## Worked Example

**Scenario:** A Deluxe room on a summer Saturday with strong demand.

| Input | Value |
|---|---|
| Base price | $180 |
| Current occupancy | 72% |
| Forecast occupancy | 78% |
| Demand score | 82 |
| Competitor average | $195 |
| Room count | 40 |
| Forecast confidence | 0.91 |

**Step 1 — Determine search range:**

```
demand_fraction = 82 / 100 = 0.82
max_premium = 0.15 × 0.82 = 0.123 (12.3%)

floor  = $195 × 0.85 = $165.75
ceiling = $195 × 1.123 = $218.99

floor adjusted = max($165.75, $180 × 0.70) = $165.75
```

**Step 2 — Sweep 200 candidates** from $165.75 to $218.99 (~$0.27 per step).

**Step 3 — For a candidate of $200:**

```
price_vs_comp = (200 − 195) / 195 = +2.56%

base_adj = 1.0 − 0.35 × 0.0256 = 0.991
displacement = 0.60 × (0.0256)² = 0.0004
occ_multiplier = 0.991 − 0.0004 = 0.9906

expected_occ = 0.78 × 0.9906 = 0.7727 (77.3%)
revpar = $200 × 0.7727 = $154.54
```

**Step 4 — Compare all candidates**, return the one with the highest RevPAR. In this scenario the optimum sits slightly above competitor parity, reflecting the strong demand.

---

## Next Steps and Improvement Suggestions

### Short-Term Enhancements

1. **Replace the grid search with analytical optimisation.** The RevPAR function is smooth and unimodal for the current elasticity model. Golden-section search or Newton's method would find the optimum in ~20 iterations instead of 200, reducing latency for bulk pricing calls (e.g., the opportunities endpoint that prices every hotel).

2. **Make elasticity parameters configurable per hotel or region.** Currently `BASE_ELASTICITY`, `COMPETITIVE_ELASTICITY`, and `MAX_PREMIUM_PCT` are global constants. Hotels in different markets (luxury vs budget, urban vs resort) have different price sensitivities. Exposing these as per-hotel or per-segment configuration would improve accuracy.

3. **Add event-aware pricing.** The engine has no awareness of local events (conferences, concerts, holidays). Integrating an event calendar or demand-spike signal would allow the engine to raise ceilings during high-demand events and avoid aggressive pricing during cancellations.

4. **Implement A/B testing infrastructure.** Record which suggestions were generated by which parameter set or algorithm version, allowing controlled experiments to measure the real-world impact of pricing changes.

### Medium-Term Enhancements

5. **Train a learned elasticity model.** The `pricing_decision` audit trail captures accepted vs. overridden suggestions. Combined with actual booking outcomes, this data can train a regression or gradient-boosted model to learn hotel-specific price elasticity curves rather than relying on assumed constants.

6. **Incorporate time-series demand forecasting with real ML models.** The current forecasting pipeline uses deterministic hash-based synthetic data. Replacing this with a trained model (e.g., Prophet, LightGBM, or a Databricks AutoML time-series model) using real booking and search data would significantly improve forecast accuracy.

7. **Add multi-day and length-of-stay optimisation.** The current engine optimises each date independently. A guest's booking decision often spans multiple nights. Implementing stay-pattern-aware pricing (where a 3-night stay might accept a higher total even if one night is above the single-night optimum) could capture additional revenue.

8. **Introduce price change velocity constraints.** Large day-over-day price swings can erode guest trust. Adding a maximum change rate (e.g., no more than ±8% per day) would produce smoother pricing trajectories while still tracking demand.

### Long-Term Vision

9. **Deploy the pricing model as a Databricks Model Serving endpoint.** Moving the optimisation logic to a served model enables versioning, A/B deployment, automatic scaling, and monitoring through MLflow. The FastAPI backend would call the endpoint instead of running the algorithm in-process.

10. **Build a reinforcement learning (RL) pricing agent.** An RL agent could learn an optimal policy that accounts for multi-day interactions, competitor reactions, and long-term revenue maximisation rather than single-day myopic optimisation. The existing audit trail and booking data provide the reward signal.

11. **Real-time competitor price ingestion.** Replace batch-synced competitor data with a streaming pipeline (e.g., Spark Structured Streaming or Zerobus Ingest) that updates competitor prices in near real-time, enabling the engine to respond to market shifts within minutes rather than hours.

12. **Explainability layer.** Add a feature-attribution breakdown (e.g., "demand contributed +$12, competitor position contributed −$5") to each suggestion so revenue managers can understand *why* a price was suggested, increasing trust and adoption rates.

---

## References

### Revenue Management Fundamentals

- Cross, R.G. (1997). *Revenue Management: Hard-Core Tactics for Market Domination*. Broadway Books. — Foundational text on RM principles including RevPAR optimisation.
- Talluri, K.T. & Van Ryzin, G.J. (2004). *The Theory and Practice of Revenue Management*. Springer. — Comprehensive academic treatment of pricing and capacity allocation.

### Price Elasticity in Hospitality

- Becerra, M., Santaló, J., & Silva, R. (2013). "Being better vs. being different: Differentiation, competition, and pricing strategies in the Spanish hotel industry." *Tourism Management*, 34, 71–79.
- Abrate, G., Fraquelli, G., & Viglia, G. (2012). "Dynamic pricing strategies: Evidence from European hotels." *International Journal of Hospitality Management*, 31(1), 160–168.

### RevPAR Optimisation

- Ivanov, S. & Zhechev, V. (2012). "Hotel revenue management — a critical literature review." *Tourism Review*, 67(2), 3–18.
- STR Global. *Hotel Performance Metrics Glossary*. [str.com](https://str.com) — Industry-standard definitions for RevPAR, ADR, and occupancy.

### Machine Learning for Hotel Pricing

- Ye, Q., Law, R., & Gu, B. (2009). "The impact of online user reviews on hotel room sales." *International Journal of Hospitality Management*, 28(1), 180–182.
- Panagopoulos, A.A. et al. (2022). "Dynamic Pricing in the Hotel Industry: A Reinforcement Learning Approach." *Expert Systems with Applications*.

### Databricks Documentation

- [Databricks Model Serving](https://docs.databricks.com/en/machine-learning/model-serving/index.html) — for deploying pricing models as endpoints.
- [Spark Declarative Pipelines](https://docs.databricks.com/en/delta-live-tables/index.html) — the framework used for forecast materialized views.
- [MLflow Model Registry](https://docs.databricks.com/en/mlflow/model-registry.html) — for versioning and managing pricing model iterations.
- [Lakebase](https://docs.databricks.com/en/lakebase/index.html) — managed PostgreSQL used as the application database layer.
