"""
Retained utility: day_factor for the pricing engine.

All other analytics computations (occupancy, demand, competitors, web traffic)
are now served from Unity Catalog synced tables in the hotel_rms schema.
"""

from __future__ import annotations

from datetime import date


def day_factor(target_date: date) -> float:
    """Seasonal + day-of-week pricing factor."""
    dow = target_date.weekday()
    weekend_boost = 1.15 if dow >= 4 else 1.0
    month = target_date.month
    seasonal = {
        1: 0.80, 2: 0.85, 3: 0.95, 4: 1.05, 5: 1.10, 6: 1.20,
        7: 1.25, 8: 1.25, 9: 1.10, 10: 1.05, 11: 0.90, 12: 1.15,
    }
    return weekend_boost * seasonal.get(month, 1.0)
