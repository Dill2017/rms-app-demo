"""
RMS Forecasting Pipeline — synthetic demand and occupancy forecasts.

Generates two materialized views in dilshad_shawki.hotel_rms:
  - demand_forecast:    per-hotel, 30-day demand scores with expected traffic
  - occupancy_forecast: per-hotel per-room-type, 30-day occupancy predictions

Data is deterministic (hash-based) so each refresh produces consistent results
for the same date window, simulating production ML model outputs.
"""

from pyspark import pipelines as dp
from pyspark.sql import functions as F

N_HOTELS = 808
FORECAST_HORIZON = 30
MODEL_VERSION = "v2.1.0"
ROOM_TYPES = ["Standard", "Superior", "Deluxe", "Executive Suite", "Family"]


def _hash_col(seed_col, offset=0):
    """Extract a deterministic float in [0, 1) from a SHA-256 hash at a byte offset."""
    start = 1 + offset * 8
    return (
        F.conv(F.substring(F.sha2(seed_col, 256), start, 8), 16, 10).cast("double")
        / 4294967295.0
    )


def _hotel_base():
    return (
        spark.range(N_HOTELS)
        .withColumn("hotel_id", F.format_string("HTL-%04d", F.col("id")))
        .drop("id")
    )


def _date_base():
    return (
        spark.range(FORECAST_HORIZON)
        .withColumn(
            "forecast_date", F.date_add(F.current_date(), F.col("id").cast("int"))
        )
        .withColumn("lead_time_days", F.col("id").cast("int"))
        .drop("id")
    )


def _add_seasonal_factors(df):
    """Attach day-of-week and monthly seasonal multipliers."""
    return (
        df.withColumn("_dow", F.dayofweek("forecast_date"))
        .withColumn(
            "_dow_factor", F.when(F.col("_dow").isin(1, 6, 7), 1.15).otherwise(1.0)
        )
        .withColumn("_month", F.month("forecast_date"))
        .withColumn(
            "_seasonal",
            F.when(F.col("_month").isin(6, 7, 8), 1.25)
            .when(F.col("_month") == 12, 1.15)
            .when(F.col("_month").isin(1, 2), 0.80)
            .otherwise(1.0),
        )
    )


# ---------------------------------------------------------------------------
# Demand Forecast
# ---------------------------------------------------------------------------


@dp.materialized_view(
    name="demand_forecast",
    comment="30-day demand forecast per hotel — refreshed daily by pipeline",
    cluster_by=["hotel_id", "forecast_date"],
)
def demand_forecast():
    base = _add_seasonal_factors(_hotel_base().crossJoin(_date_base()))

    seed = F.concat_ws(":", "hotel_id", F.col("forecast_date").cast("string"))

    return (
        base.withColumn("_h1", _hash_col(seed, 0))
        .withColumn("_h2", _hash_col(seed, 1))
        .withColumn("_h3", _hash_col(seed, 2))
        .withColumn("_h4", _hash_col(seed, 3))
        # Per-hotel baseline demand (stable across dates)
        .withColumn("_base_demand", F.lit(45.0) + _hash_col(F.col("hotel_id")) * 30.0)
        .withColumn(
            "demand_score",
            F.round(
                F.least(
                    F.lit(100.0),
                    F.greatest(
                        F.lit(0.0),
                        F.col("_base_demand")
                        * F.col("_dow_factor")
                        * F.col("_seasonal")
                        + (F.col("_h1") - 0.5) * 15.0,
                    ),
                ),
                1,
            ),
        )
        .withColumn(
            "demand_level",
            F.when(F.col("demand_score") >= 80, "Very High")
            .when(F.col("demand_score") >= 60, "High")
            .when(F.col("demand_score") >= 40, "Medium")
            .otherwise("Low"),
        )
        .withColumn(
            "expected_searches",
            (F.col("demand_score") * (2.0 + F.col("_h2")) + 50).cast("int"),
        )
        .withColumn(
            "expected_booking_attempts",
            (F.col("expected_searches") * (0.08 + F.col("_h3") * 0.07)).cast("int"),
        )
        .withColumn(
            "expected_bookings",
            (F.col("expected_booking_attempts") * (0.40 + F.col("_h4") * 0.35)).cast(
                "int"
            ),
        )
        # Confidence decays with lead time
        .withColumn(
            "confidence",
            F.round(
                F.least(
                    F.lit(0.99),
                    F.greatest(
                        F.lit(0.50),
                        F.lit(0.95)
                        - F.col("lead_time_days") * 0.012
                        + (F.col("_h1") - 0.5) * 0.05,
                    ),
                ),
                3,
            ),
        )
        .withColumn("model_version", F.lit(MODEL_VERSION))
        .withColumn("forecast_generated_at", F.current_timestamp())
        .select(
            "hotel_id",
            "forecast_date",
            "lead_time_days",
            "demand_score",
            "demand_level",
            "expected_searches",
            "expected_booking_attempts",
            "expected_bookings",
            "confidence",
            "model_version",
            "forecast_generated_at",
        )
    )


# ---------------------------------------------------------------------------
# Occupancy Forecast
# ---------------------------------------------------------------------------

ROOM_TYPE_SHARE = {
    "Standard": 0.35,
    "Superior": 0.25,
    "Deluxe": 0.20,
    "Executive Suite": 0.08,
    "Family": 0.12,
}

ROOM_TYPE_BASE_OCC = {
    "Standard": 0.72,
    "Superior": 0.65,
    "Deluxe": 0.58,
    "Executive Suite": 0.45,
    "Family": 0.55,
}


@dp.materialized_view(
    name="occupancy_forecast",
    comment="30-day occupancy forecast per hotel and room type — refreshed daily by pipeline",
    cluster_by=["hotel_id", "forecast_date"],
)
def occupancy_forecast():
    hotels = _hotel_base().withColumn(
        "_total_rooms", (F.lit(80) + _hash_col(F.col("hotel_id")) * 370).cast("int")
    )

    room_types_df = spark.createDataFrame(
        [(rt,) for rt in ROOM_TYPES], ["room_type"]
    )

    base = _add_seasonal_factors(
        hotels.crossJoin(room_types_df).crossJoin(_date_base())
    )

    # Derive room count per type from hotel total
    base = base.withColumn(
        "total_rooms",
        F.when(F.col("room_type") == "Standard", F.col("_total_rooms") * 0.35)
        .when(F.col("room_type") == "Superior", F.col("_total_rooms") * 0.25)
        .when(F.col("room_type") == "Deluxe", F.col("_total_rooms") * 0.20)
        .when(F.col("room_type") == "Executive Suite", F.col("_total_rooms") * 0.08)
        .when(F.col("room_type") == "Family", F.col("_total_rooms") * 0.12)
        .cast("int"),
    )

    seed = F.concat_ws(
        ":", "hotel_id", "room_type", F.col("forecast_date").cast("string")
    )

    return (
        base.withColumn("_h1", _hash_col(seed, 0))
        .withColumn("_h2", _hash_col(seed, 1))
        .withColumn(
            "_rt_base",
            F.when(F.col("room_type") == "Standard", 0.72)
            .when(F.col("room_type") == "Superior", 0.65)
            .when(F.col("room_type") == "Deluxe", 0.58)
            .when(F.col("room_type") == "Executive Suite", 0.45)
            .when(F.col("room_type") == "Family", 0.55),
        )
        .withColumn(
            "predicted_occupancy_pct",
            F.round(
                F.least(
                    F.lit(98.0),
                    F.greatest(
                        F.lit(5.0),
                        F.col("_rt_base")
                        * 100.0
                        * F.col("_dow_factor")
                        * F.col("_seasonal")
                        + (F.col("_h1") - 0.5) * 20.0,
                    ),
                ),
                1,
            ),
        )
        .withColumn(
            "predicted_rooms_sold",
            F.greatest(
                F.lit(0),
                (F.col("total_rooms") * F.col("predicted_occupancy_pct") / 100.0).cast(
                    "int"
                ),
            ),
        )
        # Confidence interval widens with lead time
        .withColumn(
            "_ci_width", F.col("lead_time_days") * 0.3 + F.col("_h2") * 3.0 + 2.0
        )
        .withColumn(
            "lower_bound_pct",
            F.round(
                F.greatest(
                    F.lit(0.0),
                    F.col("predicted_occupancy_pct") - F.col("_ci_width"),
                ),
                1,
            ),
        )
        .withColumn(
            "upper_bound_pct",
            F.round(
                F.least(
                    F.lit(100.0),
                    F.col("predicted_occupancy_pct") + F.col("_ci_width"),
                ),
                1,
            ),
        )
        .withColumn(
            "confidence",
            F.round(
                F.least(
                    F.lit(0.99),
                    F.greatest(
                        F.lit(0.50),
                        F.lit(0.93)
                        - F.col("lead_time_days") * 0.01
                        + (F.col("_h1") - 0.5) * 0.04,
                    ),
                ),
                3,
            ),
        )
        .withColumn("model_version", F.lit(MODEL_VERSION))
        .withColumn("forecast_generated_at", F.current_timestamp())
        .select(
            "hotel_id",
            "room_type",
            "forecast_date",
            "lead_time_days",
            "predicted_occupancy_pct",
            "predicted_rooms_sold",
            "total_rooms",
            "lower_bound_pct",
            "upper_bound_pct",
            "confidence",
            "model_version",
            "forecast_generated_at",
        )
    )
