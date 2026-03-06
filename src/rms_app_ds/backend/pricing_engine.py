"""
RevPAR-optimizing pricing engine.

Computes a suggested price per room-type/date that maximizes
Revenue Per Available Room (RevPAR = Price × Occupancy Rate)
while staying competitive with market prices.

The model uses two forces:
  1. Base elasticity — higher prices reduce demand generally.
  2. Competitive displacement — guests switch to competitors when
     our price exceeds the market, with accelerating losses.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PricingSuggestion:
    suggested_price: float
    expected_revpar: float
    expected_occupancy: float
    price_vs_competitor_pct: float
    confidence: float


BASE_ELASTICITY = 0.35
"""General elasticity: occupancy drops ~0.35% per 1% price increase."""

COMPETITIVE_ELASTICITY = 0.60
"""Extra displacement when priced above competitors (applied on top of base)."""

COMPETITIVE_ACCELERATION = 2.0
"""Displacement accelerates quadratically the further above competitors."""

MAX_PREMIUM_PCT = 0.15
"""Hard cap: never suggest more than 15% above competitor avg, even in peak demand."""

PRICE_STEPS = 200


def suggest_price(
    base_price: float,
    current_occupancy: float,
    forecast_occupancy: float | None,
    demand_score: float,
    forecast_demand_score: float | None,
    competitor_avg: float,
    room_count: int,
    forecast_confidence: float | None = None,
) -> PricingSuggestion:
    """Find the price that maximizes RevPAR while staying competitive.

    The algorithm:
    1. Uses competitor_avg as the primary market reference.
    2. Allows a demand-driven premium up to MAX_PREMIUM_PCT above competitors.
    3. Sweeps candidates from 15% below to (demand-adjusted) above competitor avg.
    4. Applies both base elasticity AND competitive displacement to model
       guest switching when our price exceeds the market.
    5. Returns the price that maximizes candidate_price × expected_occupancy.
    """
    occ = (forecast_occupancy / 100.0) if forecast_occupancy is not None else current_occupancy
    occ = max(0.05, min(0.98, occ))
    demand = forecast_demand_score if forecast_demand_score is not None else demand_score
    conf = forecast_confidence if forecast_confidence is not None else 0.7

    comp_ref = competitor_avg if competitor_avg > 0 else base_price
    if comp_ref <= 0:
        comp_ref = 100.0

    demand_fraction = demand / 100.0
    max_premium = MAX_PREMIUM_PCT * demand_fraction
    floor_discount = 0.15

    lo = comp_ref * (1.0 - floor_discount)
    hi = comp_ref * (1.0 + max_premium)

    lo = max(lo, base_price * 0.70)
    hi = max(hi, lo + 1.0)

    step = (hi - lo) / PRICE_STEPS

    best_price = comp_ref
    best_revpar = 0.0
    best_occ = occ

    for i in range(PRICE_STEPS + 1):
        candidate = lo + step * i
        if candidate <= 0:
            continue

        price_vs_comp = (candidate - comp_ref) / comp_ref

        base_adj = 1.0 - BASE_ELASTICITY * price_vs_comp

        if price_vs_comp > 0:
            displacement = COMPETITIVE_ELASTICITY * (price_vs_comp ** COMPETITIVE_ACCELERATION)
        else:
            displacement = COMPETITIVE_ELASTICITY * price_vs_comp * 0.3

        occ_multiplier = max(0.20, min(1.15, base_adj - displacement))
        expected_occ = min(0.98, max(0.05, occ * occ_multiplier))

        revpar = candidate * expected_occ

        if revpar > best_revpar:
            best_revpar = revpar
            best_price = candidate
            best_occ = expected_occ

    price_vs_comp_pct = ((best_price - comp_ref) / comp_ref) * 100.0

    return PricingSuggestion(
        suggested_price=round(best_price, 2),
        expected_revpar=round(best_revpar, 2),
        expected_occupancy=round(best_occ * 100, 1),
        price_vs_competitor_pct=round(price_vs_comp_pct, 1),
        confidence=round(conf, 3),
    )
