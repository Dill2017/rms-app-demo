# Databricks notebook source
# MAGIC %md
# MAGIC # RMS Data Generation
# MAGIC
# MAGIC Generates all Unity Catalog Delta tables that power the Hotel Revenue Management System.
# MAGIC All data is deterministic (hash-based) to simulate production data pipelines.
# MAGIC
# MAGIC **Tables produced:**
# MAGIC - `hotel` — 808 hotels across 46 cities
# MAGIC - `room_type` — 5 room types per hotel
# MAGIC - `room_price_base` — 14-day forward system prices
# MAGIC - `demand_forecast` — 30-day demand scores per hotel
# MAGIC - `occupancy_forecast` — 30-day occupancy predictions per hotel/room
# MAGIC - `occupancy_actuals` — daily occupancy per hotel/room (30-day lookback + 14-day forward)
# MAGIC - `competitor_price` — daily competitor prices per hotel/room
# MAGIC - `web_traffic` — daily web traffic metrics per hotel

# COMMAND ----------

dbutils.widgets.text("catalog", "rms_hotel_demo", "UC Catalog")
dbutils.widgets.text("schema", "hotel_rms", "UC Schema")

CATALOG = dbutils.widgets.get("catalog")
SCHEMA = dbutils.widgets.get("schema")
FULL_SCHEMA = f"{CATALOG}.{SCHEMA}"

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {FULL_SCHEMA}")
print(f"Writing tables to {FULL_SCHEMA}")

# Clean up any orphaned materialized views from old SDP pipeline
for _mv_name in ["demand_forecast", "occupancy_forecast"]:
    _full = f"{FULL_SCHEMA}.{_mv_name}"
    for _stmt in [
        f"DROP MATERIALIZED VIEW IF EXISTS {_full}",
        f"DROP VIEW IF EXISTS {_full}",
    ]:
        try:
            spark.sql(_stmt)
            print(f"  Cleaned up: {_stmt}")
        except Exception as e:
            print(f"  Skipped ({_stmt}): {e}")

# COMMAND ----------

from pyspark.sql import functions as F
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType, DateType,
    TimestampType,
)

N_HOTELS = 808
FORECAST_HORIZON = 30
PRICE_HORIZON = 14
LOOKBACK_DAYS = 30
MODEL_VERSION = "v2.1.0"

ROOM_TYPES = ["Standard", "Superior", "Deluxe", "Executive Suite", "Family"]
ROOM_TYPE_MULTIPLIER = {"Standard": 1.00, "Superior": 1.25, "Deluxe": 1.55, "Executive Suite": 2.20, "Family": 1.35}
ROOM_TYPE_MAX_OCC = {"Standard": 2, "Superior": 2, "Deluxe": 3, "Executive Suite": 2, "Family": 4}
ROOM_TYPE_SHARE = {"Standard": 0.35, "Superior": 0.25, "Deluxe": 0.20, "Executive Suite": 0.08, "Family": 0.12}
ROOM_TYPE_BASE_OCC = {"Standard": 0.72, "Superior": 0.65, "Deluxe": 0.58, "Executive Suite": 0.45, "Family": 0.55}

COMPETITORS = ["Hilton", "Marriott", "Hyatt", "IHG", "Accor", "Wyndham", "Best Western", "Radisson", "Four Seasons"]

CITIES = [
    ("New York", "USA", "North America", 30, 1.45),
    ("Los Angeles", "USA", "North America", 22, 1.25),
    ("Chicago", "USA", "North America", 16, 1.10),
    ("Miami", "USA", "North America", 24, 1.30),
    ("San Francisco", "USA", "North America", 18, 1.40),
    ("Las Vegas", "USA", "North America", 28, 1.15),
    ("Boston", "USA", "North America", 12, 1.20),
    ("Washington DC", "USA", "North America", 14, 1.15),
    ("Seattle", "USA", "North America", 10, 1.15),
    ("Toronto", "Canada", "North America", 16, 1.10),
    ("Denver", "USA", "North America", 10, 1.05),
    ("Orlando", "USA", "North America", 14, 1.10),
    ("London", "UK", "Europe", 34, 1.50),
    ("Paris", "France", "Europe", 30, 1.45),
    ("Rome", "Italy", "Europe", 22, 1.20),
    ("Barcelona", "Spain", "Europe", 24, 1.15),
    ("Berlin", "Germany", "Europe", 18, 1.10),
    ("Amsterdam", "Netherlands", "Europe", 18, 1.25),
    ("Madrid", "Spain", "Europe", 14, 1.10),
    ("Vienna", "Austria", "Europe", 12, 1.15),
    ("Prague", "Czech Republic", "Europe", 12, 0.90),
    ("Dublin", "Ireland", "Europe", 10, 1.10),
    ("Lisbon", "Portugal", "Europe", 10, 0.95),
    ("Milan", "Italy", "Europe", 14, 1.20),
    ("Istanbul", "Turkey", "Europe", 16, 0.85),
    ("Zurich", "Switzerland", "Europe", 10, 1.55),
    ("Tokyo", "Japan", "Asia Pacific", 26, 1.35),
    ("Singapore", "Singapore", "Asia Pacific", 22, 1.40),
    ("Bangkok", "Thailand", "Asia Pacific", 24, 0.85),
    ("Sydney", "Australia", "Asia Pacific", 18, 1.25),
    ("Hong Kong", "China", "Asia Pacific", 22, 1.45),
    ("Seoul", "South Korea", "Asia Pacific", 16, 1.15),
    ("Shanghai", "China", "Asia Pacific", 18, 1.20),
    ("Bali", "Indonesia", "Asia Pacific", 16, 0.90),
    ("Mumbai", "India", "Asia Pacific", 18, 0.80),
    ("Kuala Lumpur", "Malaysia", "Asia Pacific", 12, 0.80),
    ("Dubai", "UAE", "Middle East", 34, 1.50),
    ("Abu Dhabi", "UAE", "Middle East", 18, 1.35),
    ("Doha", "Qatar", "Middle East", 12, 1.30),
    ("Riyadh", "Saudi Arabia", "Middle East", 10, 1.15),
    ("Cancun", "Mexico", "Latin America", 20, 1.05),
    ("Sao Paulo", "Brazil", "Latin America", 16, 0.85),
    ("Rio de Janeiro", "Brazil", "Latin America", 14, 0.90),
    ("Buenos Aires", "Argentina", "Latin America", 12, 0.80),
    ("Cape Town", "South Africa", "Africa", 12, 0.85),
    ("Marrakech", "Morocco", "Africa", 10, 0.75),
]

HOTEL_PREFIXES = [
    "Grand", "Royal", "Park", "City", "Harbor", "Riverside",
    "Heritage", "Crown", "Metropolitan", "Coastal", "Summit",
    "Regency", "Panorama", "Sapphire", "Amber", "Oasis",
    "Plaza", "Meridian", "Pacific", "Atlantic", "Imperial",
    "Continental", "Skyline", "Vista", "Azure", "Emerald",
]

HOTEL_SUFFIXES = [
    "Hotel", "Resort", "Inn", "Suites", "Lodge",
    "Palace", "Residences", "Tower", "House", "Gardens",
]


def _hash_col(seed_col, offset=0):
    """Deterministic float in [0, 1) from SHA-256 hash at a byte offset."""
    start = 1 + offset * 8
    return (
        F.conv(F.substring(F.sha2(seed_col, 256), start, 8), 16, 10).cast("double")
        / 4294967295.0
    )


def _day_factor_col(date_col):
    """Seasonal + day-of-week pricing factor as a Spark column expression."""
    dow = F.dayofweek(date_col)
    weekend_boost = F.when(dow.isin(1, 6, 7), 1.15).otherwise(1.0)
    month = F.month(date_col)
    seasonal = (
        F.when(month == 1, 0.80)
        .when(month == 2, 0.85)
        .when(month == 3, 0.95)
        .when(month == 4, 1.05)
        .when(month == 5, 1.10)
        .when(month == 6, 1.20)
        .when(month == 7, 1.25)
        .when(month == 8, 1.25)
        .when(month == 9, 1.10)
        .when(month == 10, 1.05)
        .when(month == 11, 0.90)
        .when(month == 12, 1.15)
        .otherwise(1.0)
    )
    return weekend_boost * seasonal


def _write_table(df, table_name, merge_keys=None):
    """Write a DataFrame to a UC Delta table with CDF enabled, using MERGE for idempotency."""
    full_name = f"{FULL_SCHEMA}.{table_name}"
    df.createOrReplaceTempView(f"_tmp_{table_name}")

    # Drop pre-existing views/MVs from old SDP pipeline, then create as Delta table
    try:
        spark.sql(f"DROP MATERIALIZED VIEW IF EXISTS {full_name}")
    except Exception:
        pass
    try:
        spark.sql(f"DROP VIEW IF EXISTS {full_name}")
    except Exception:
        pass

    spark.sql(f"""
        CREATE TABLE IF NOT EXISTS {full_name}
        USING DELTA
        TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
        AS SELECT * FROM _tmp_{table_name} WHERE 1=0
    """)

    try:
        spark.sql(f"ALTER TABLE {full_name} SET TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')")
    except Exception:
        pass

    if merge_keys:
        condition = " AND ".join([f"t.{k} = s.{k}" for k in merge_keys])
        cols = df.columns
        update_set = ", ".join([f"t.{c} = s.{c}" for c in cols if c not in merge_keys])
        insert_cols = ", ".join(cols)
        insert_vals = ", ".join([f"s.{c}" for c in cols])

        df.createOrReplaceTempView(f"_src_{table_name}")
        merge_sql = f"""
            MERGE INTO {full_name} t
            USING _src_{table_name} s
            ON {condition}
            WHEN MATCHED THEN UPDATE SET {update_set}
            WHEN NOT MATCHED THEN INSERT ({insert_cols}) VALUES ({insert_vals})
        """
        spark.sql(merge_sql)
    else:
        df.write.format("delta").mode("overwrite").saveAsTable(full_name)

    count = spark.table(full_name).count()
    print(f"  {full_name}: {count} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Hotel Reference Data

# COMMAND ----------

import hashlib

def _py_hash_float(seed_str):
    h = hashlib.sha256(seed_str.encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF

def _py_hash_int(seed_str, low, high):
    return low + int(_py_hash_float(seed_str) * (high - low + 1))

def _roman(n):
    vals = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    result = ""
    for v, s in vals:
        while n >= v:
            result += s
            n -= v
    return result

hotel_rows = []
idx = 0
for city, country, region, count, price_factor in CITIES:
    for i in range(count):
        hotel_id = f"HTL-{idx:04d}"
        seed = f"{city}:{i}"
        prefix = HOTEL_PREFIXES[_py_hash_int(f"{seed}:prefix", 0, len(HOTEL_PREFIXES) - 1)]
        suffix = HOTEL_SUFFIXES[_py_hash_int(f"{seed}:suffix", 0, len(HOTEL_SUFFIXES) - 1)]
        name = f"{prefix} {city} {suffix}" if i == 0 else f"{prefix} {city} {suffix} {_roman(i + 1)}"

        star_rating = _py_hash_int(f"{seed}:stars", 3, 5)
        base_rooms_map = {3: (80, 150), 4: (120, 300), 5: (150, 450)}
        lo, hi = base_rooms_map[star_rating]
        total_rooms = _py_hash_int(f"{seed}:rooms", lo, hi)

        hotel_rows.append((hotel_id, name, city, country, region, star_rating, total_rooms, price_factor))
        idx += 1

hotel_schema = StructType([
    StructField("id", StringType()),
    StructField("name", StringType()),
    StructField("city", StringType()),
    StructField("country", StringType()),
    StructField("region", StringType()),
    StructField("star_rating", IntegerType()),
    StructField("total_rooms", IntegerType()),
    StructField("price_factor", DoubleType()),
])

hotel_df = spark.createDataFrame(hotel_rows, schema=hotel_schema)
_write_table(hotel_df, "hotel", merge_keys=["id"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Room Types

# COMMAND ----------

room_type_rows = []
for h_id, _, _, _, _, star, total, pf in hotel_rows:
    star_base = {3: 95.0, 4: 155.0, 5: 260.0}
    for rt_name in ROOM_TYPES:
        rt_mult = ROOM_TYPE_MULTIPLIER[rt_name]
        rt_max_occ = ROOM_TYPE_MAX_OCC[rt_name]
        base_price = round(star_base.get(star, 130.0) * pf * rt_mult, 2)

        share = ROOM_TYPE_SHARE[rt_name]
        noise = 0.8 + _py_hash_float(f"{h_id}:{rt_name}:count") * 0.4
        room_count = max(2, int(total * share * noise))

        room_type_rows.append((h_id, rt_name, base_price, rt_max_occ, room_count))

rt_schema = StructType([
    StructField("hotel_id", StringType()),
    StructField("name", StringType()),
    StructField("base_price", DoubleType()),
    StructField("max_occupancy", IntegerType()),
    StructField("room_count", IntegerType()),
])

room_type_df = spark.createDataFrame(room_type_rows, schema=rt_schema)
_write_table(room_type_df, "room_type", merge_keys=["hotel_id", "name"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Base Room Prices (14-day forward)

# COMMAND ----------

from datetime import date, timedelta

today = date.today()
price_rows = []
for h_id, _, _, _, _, star, total, pf in hotel_rows:
    star_base = {3: 95.0, 4: 155.0, 5: 260.0}
    for rt_name in ROOM_TYPES:
        rt_mult = ROOM_TYPE_MULTIPLIER[rt_name]
        bp = round(star_base.get(star, 130.0) * pf * rt_mult, 2)
        for d in range(PRICE_HORIZON):
            target = today + timedelta(days=d)
            dow = target.weekday()
            weekend_boost = 1.15 if dow >= 4 else 1.0
            month = target.month
            seasonal_map = {1: 0.80, 2: 0.85, 3: 0.95, 4: 1.05, 5: 1.10, 6: 1.20, 7: 1.25, 8: 1.25, 9: 1.10, 10: 1.05, 11: 0.90, 12: 1.15}
            d_f = weekend_boost * seasonal_map.get(month, 1.0)
            noise = 0.95 + _py_hash_float(f"{h_id}:{rt_name}:{target.isoformat()}:price") * 0.10
            price = round(bp * d_f * noise, 2)
            price_rows.append((h_id, rt_name, target, price))

price_schema = StructType([
    StructField("hotel_id", StringType()),
    StructField("room_type_name", StringType()),
    StructField("date", DateType()),
    StructField("price", DoubleType()),
])

price_df = spark.createDataFrame(price_rows, schema=price_schema)
_write_table(price_df, "room_price_base", merge_keys=["hotel_id", "room_type_name", "date"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Demand Forecast (30-day forward)

# COMMAND ----------

def _hotel_base():
    return (
        spark.range(N_HOTELS)
        .withColumn("hotel_id", F.format_string("HTL-%04d", F.col("id")))
        .drop("id")
    )

def _date_range(horizon, col_name="forecast_date"):
    return (
        spark.range(horizon)
        .withColumn(col_name, F.date_add(F.current_date(), F.col("id").cast("int")))
        .withColumn("lead_time_days", F.col("id").cast("int"))
        .drop("id")
    )

def _add_seasonal_factors(df, date_col="forecast_date"):
    return (
        df.withColumn("_dow", F.dayofweek(date_col))
        .withColumn("_dow_factor", F.when(F.col("_dow").isin(1, 6, 7), 1.15).otherwise(1.0))
        .withColumn("_month", F.month(date_col))
        .withColumn(
            "_seasonal",
            F.when(F.col("_month").isin(6, 7, 8), 1.25)
            .when(F.col("_month") == 12, 1.15)
            .when(F.col("_month").isin(1, 2), 0.80)
            .otherwise(1.0),
        )
    )

base = _add_seasonal_factors(_hotel_base().crossJoin(_date_range(FORECAST_HORIZON)))
seed = F.concat_ws(":", "hotel_id", F.col("forecast_date").cast("string"))

demand_df = (
    base.withColumn("_h1", _hash_col(seed, 0))
    .withColumn("_h2", _hash_col(seed, 1))
    .withColumn("_h3", _hash_col(seed, 2))
    .withColumn("_h4", _hash_col(seed, 3))
    .withColumn("_base_demand", F.lit(45.0) + _hash_col(F.col("hotel_id")) * 30.0)
    .withColumn(
        "demand_score",
        F.round(F.least(F.lit(100.0), F.greatest(F.lit(0.0),
            F.col("_base_demand") * F.col("_dow_factor") * F.col("_seasonal")
            + (F.col("_h1") - 0.5) * 15.0)), 1),
    )
    .withColumn(
        "demand_level",
        F.when(F.col("demand_score") >= 80, "Very High")
        .when(F.col("demand_score") >= 60, "High")
        .when(F.col("demand_score") >= 40, "Medium")
        .otherwise("Low"),
    )
    .withColumn("expected_searches", (F.col("demand_score") * (2.0 + F.col("_h2")) + 50).cast("int"))
    .withColumn("expected_booking_attempts", (F.col("expected_searches") * (0.08 + F.col("_h3") * 0.07)).cast("int"))
    .withColumn("expected_bookings", (F.col("expected_booking_attempts") * (0.40 + F.col("_h4") * 0.35)).cast("int"))
    .withColumn("confidence", F.round(F.least(F.lit(0.99), F.greatest(F.lit(0.50),
        F.lit(0.95) - F.col("lead_time_days") * 0.012 + (F.col("_h1") - 0.5) * 0.05)), 3))
    .withColumn("model_version", F.lit(MODEL_VERSION))
    .withColumn("forecast_generated_at", F.current_timestamp())
    .select(
        "hotel_id", "forecast_date", "lead_time_days", "demand_score", "demand_level",
        "expected_searches", "expected_booking_attempts", "expected_bookings",
        "confidence", "model_version", "forecast_generated_at",
    )
)

_write_table(demand_df, "demand_forecast", merge_keys=["hotel_id", "forecast_date"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Occupancy Forecast (30-day forward per hotel/room type)

# COMMAND ----------

hotels_with_rooms = _hotel_base().withColumn(
    "_total_rooms", (F.lit(80) + _hash_col(F.col("hotel_id")) * 370).cast("int")
)
room_types_sdf = spark.createDataFrame([(rt,) for rt in ROOM_TYPES], ["room_type"])
occ_base = _add_seasonal_factors(
    hotels_with_rooms.crossJoin(room_types_sdf).crossJoin(_date_range(FORECAST_HORIZON))
)

occ_base = occ_base.withColumn(
    "total_rooms",
    F.when(F.col("room_type") == "Standard", F.col("_total_rooms") * 0.35)
    .when(F.col("room_type") == "Superior", F.col("_total_rooms") * 0.25)
    .when(F.col("room_type") == "Deluxe", F.col("_total_rooms") * 0.20)
    .when(F.col("room_type") == "Executive Suite", F.col("_total_rooms") * 0.08)
    .when(F.col("room_type") == "Family", F.col("_total_rooms") * 0.12)
    .cast("int"),
)

occ_seed = F.concat_ws(":", "hotel_id", "room_type", F.col("forecast_date").cast("string"))

occ_forecast_df = (
    occ_base.withColumn("_h1", _hash_col(occ_seed, 0))
    .withColumn("_h2", _hash_col(occ_seed, 1))
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
        F.round(F.least(F.lit(98.0), F.greatest(F.lit(5.0),
            F.col("_rt_base") * 100.0 * F.col("_dow_factor") * F.col("_seasonal")
            + (F.col("_h1") - 0.5) * 20.0)), 1),
    )
    .withColumn("predicted_rooms_sold",
        F.greatest(F.lit(0), (F.col("total_rooms") * F.col("predicted_occupancy_pct") / 100.0).cast("int")))
    .withColumn("_ci_width", F.col("lead_time_days") * 0.3 + F.col("_h2") * 3.0 + 2.0)
    .withColumn("lower_bound_pct", F.round(F.greatest(F.lit(0.0), F.col("predicted_occupancy_pct") - F.col("_ci_width")), 1))
    .withColumn("upper_bound_pct", F.round(F.least(F.lit(100.0), F.col("predicted_occupancy_pct") + F.col("_ci_width")), 1))
    .withColumn("confidence", F.round(F.least(F.lit(0.99), F.greatest(F.lit(0.50),
        F.lit(0.93) - F.col("lead_time_days") * 0.01 + (F.col("_h1") - 0.5) * 0.04)), 3))
    .withColumn("model_version", F.lit(MODEL_VERSION))
    .withColumn("forecast_generated_at", F.current_timestamp())
    .select(
        "hotel_id", "room_type", "forecast_date", "lead_time_days",
        "predicted_occupancy_pct", "predicted_rooms_sold", "total_rooms",
        "lower_bound_pct", "upper_bound_pct", "confidence", "model_version", "forecast_generated_at",
    )
)

_write_table(occ_forecast_df, "occupancy_forecast", merge_keys=["hotel_id", "room_type", "forecast_date"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Occupancy Actuals (30-day lookback + 14-day forward)

# COMMAND ----------

total_days = LOOKBACK_DAYS + PRICE_HORIZON

actual_dates = (
    spark.range(total_days)
    .withColumn("date", F.date_add(F.current_date(), (F.col("id") - LOOKBACK_DAYS).cast("int")))
    .drop("id")
)

hotels_base = (
    spark.createDataFrame(hotel_rows, schema=hotel_schema)
    .select(
        F.col("id").alias("hotel_id"),
        F.col("star_rating"),
        F.col("total_rooms").alias("hotel_total_rooms"),
    )
)

occ_actual_base = (
    hotels_base
    .crossJoin(room_types_sdf)
    .crossJoin(actual_dates)
)

occ_seed_actual = F.concat_ws(":", "hotel_id", "room_type", F.col("date").cast("string"), F.lit("occ"))

star_base_occ = (
    F.when(F.col("star_rating") == 3, 0.62)
    .when(F.col("star_rating") == 4, 0.70)
    .when(F.col("star_rating") == 5, 0.75)
    .otherwise(0.65)
)

rt_share_col = (
    F.when(F.col("room_type") == "Standard", 0.35)
    .when(F.col("room_type") == "Superior", 0.25)
    .when(F.col("room_type") == "Deluxe", 0.20)
    .when(F.col("room_type") == "Executive Suite", 0.08)
    .when(F.col("room_type") == "Family", 0.12)
)

occ_actual_df = (
    occ_actual_base
    .withColumn("_day_factor", _day_factor_col("date"))
    .withColumn("_noise", _hash_col(occ_seed_actual, 0))
    .withColumn("_base_occ", star_base_occ)
    .withColumn(
        "occupancy_pct",
        F.round(
            F.least(F.lit(98.0), F.greatest(F.lit(15.0),
                F.col("_base_occ") * F.col("_day_factor") * (0.85 + F.col("_noise") * 0.30) * 100.0
            )), 1
        ),
    )
    .withColumn("room_count", F.greatest(F.lit(2), (F.col("hotel_total_rooms") * rt_share_col).cast("int")))
    .withColumn("rooms_sold", F.greatest(F.lit(0), (F.col("room_count") * F.col("occupancy_pct") / 100.0).cast("int")))
    .select("hotel_id", "room_type", "date", "occupancy_pct", "room_count", "rooms_sold", "star_rating")
)

_write_table(occ_actual_df, "occupancy_actuals", merge_keys=["hotel_id", "room_type", "date"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 7. Competitor Prices

# COMMAND ----------

competitor_sdf = spark.createDataFrame([(c,) for c in COMPETITORS[:4]], ["competitor"])

price_dates = (
    spark.range(PRICE_HORIZON)
    .withColumn("date", F.date_add(F.current_date(), F.col("id").cast("int")))
    .drop("id")
)

room_type_base_prices = spark.createDataFrame(room_type_rows, schema=rt_schema).select(
    F.col("hotel_id"), F.col("name").alias("room_type"), F.col("base_price")
)

comp_base = (
    room_type_base_prices
    .crossJoin(competitor_sdf)
    .crossJoin(price_dates)
)

comp_seed = F.concat_ws(":", "hotel_id", "room_type", "competitor", F.col("date").cast("string"))

comp_df = (
    comp_base
    .withColumn("_day_factor", _day_factor_col("date"))
    .withColumn("_price_noise", 0.95 + _hash_col(F.concat_ws(":", "hotel_id", "room_type", F.col("date").cast("string"), F.lit("price")), 0) * 0.10)
    .withColumn("our_price", F.round(F.col("base_price") * F.col("_day_factor") * F.col("_price_noise"), 2))
    .withColumn("_deviation", (_hash_col(comp_seed, 0) - 0.5) * 0.30)
    .withColumn("competitor_price", F.round(F.col("our_price") * (1 + F.col("_deviation")), 2))
    .select("hotel_id", "room_type", "competitor", "date", "competitor_price", "our_price")
)

_write_table(comp_df, "competitor_price", merge_keys=["hotel_id", "room_type", "competitor", "date"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## 8. Web Traffic

# COMMAND ----------

traffic_dates = (
    spark.range(LOOKBACK_DAYS + PRICE_HORIZON)
    .withColumn("date", F.date_add(F.current_date(), (F.col("id") - LOOKBACK_DAYS).cast("int")))
    .drop("id")
)

traffic_base = hotels_base.crossJoin(traffic_dates)

traffic_seed = F.concat_ws(":", "hotel_id", F.col("date").cast("string"))

traffic_df = (
    traffic_base
    .withColumn("_base_searches", (F.col("hotel_total_rooms") * 2.5).cast("int"))
    .withColumn("_dow", F.dayofweek("date"))
    .withColumn("_day_mult",
        F.when(F.col("_dow").isin(2, 3), 1.3)
        .when(F.col("_dow").isin(1, 7), 0.7)
        .otherwise(1.0))
    .withColumn("_s_noise", _hash_col(F.concat_ws(":", traffic_seed, F.lit("s")), 0))
    .withColumn("searches", F.greatest(F.lit(10), (F.col("_base_searches") * F.col("_day_mult") * (0.8 + F.col("_s_noise") * 0.4)).cast("int")))
    .withColumn("page_views", (F.col("searches") * (1.5 + _hash_col(F.concat_ws(":", traffic_seed, F.lit("pv")), 0) * 1.0)).cast("int"))
    .withColumn("booking_attempts", (F.col("page_views") * (0.08 + _hash_col(F.concat_ws(":", traffic_seed, F.lit("ba")), 0) * 0.07)).cast("int"))
    .withColumn("bookings_completed", (F.col("booking_attempts") * (0.4 + _hash_col(F.concat_ws(":", traffic_seed, F.lit("bc")), 0) * 0.35)).cast("int"))
    .withColumn("conversion_rate", F.round(F.col("bookings_completed") / F.greatest(F.lit(1), F.col("searches")) * 100, 2))
    .select("hotel_id", "date", "searches", "page_views", "booking_attempts", "bookings_completed", "conversion_rate")
)

_write_table(traffic_df, "web_traffic", merge_keys=["hotel_id", "date"])

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary

# COMMAND ----------

print("\n=== Data Generation Complete ===")
for tbl in ["hotel", "room_type", "room_price_base", "demand_forecast", "occupancy_forecast", "occupancy_actuals", "competitor_price", "web_traffic"]:
    cnt = spark.table(f"{FULL_SCHEMA}.{tbl}").count()
    print(f"  {tbl}: {cnt:,} rows")
print(f"\nAll tables written to {FULL_SCHEMA} with CDF enabled.")
