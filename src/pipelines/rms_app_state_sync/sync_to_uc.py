# Databricks notebook source
# MAGIC %md
# MAGIC # App State Sync (Lakebase → Unity Catalog)
# MAGIC
# MAGIC Reads application-written tables from Lakebase PostgreSQL and syncs them back
# MAGIC to Unity Catalog Delta tables. This covers:
# MAGIC
# MAGIC - **pricing_decision** — user pricing decisions made in the app
# MAGIC - **room_price** — active room prices (including manual overrides)
# MAGIC
# MAGIC Scheduled to run periodically (e.g. every 15 minutes) to keep UC in sync
# MAGIC with the app's operational state.

# COMMAND ----------

dbutils.widgets.text("uc_catalog", "rms_hotel_demo", "Target UC Catalog")
dbutils.widgets.text("uc_schema", "hotel_rms", "Target UC Schema")
dbutils.widgets.text("lakebase_instance_name", "rms-app-ds", "Lakebase Instance Name")

UC_CATALOG = dbutils.widgets.get("uc_catalog")
UC_SCHEMA = dbutils.widgets.get("uc_schema")
LAKEBASE_INSTANCE = dbutils.widgets.get("lakebase_instance_name")
FULL_SCHEMA = f"{UC_CATALOG}.{UC_SCHEMA}"

print(f"Syncing app state from Lakebase '{LAKEBASE_INSTANCE}' → {FULL_SCHEMA}")

# COMMAND ----------

import uuid
from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

instance = w.database.get_database_instance(LAKEBASE_INSTANCE)
host = instance.read_write_dns

cred = w.database.generate_database_credential(
    request_id=str(uuid.uuid4()),
    instance_names=[LAKEBASE_INSTANCE],
)
username = w.current_user.me().user_name

jdbc_url = f"jdbc:postgresql://{host}:5432/databricks_postgres?sslmode=require"

jdbc_props = {
    "user": username,
    "password": cred.token,
    "driver": "org.postgresql.Driver",
    "sslmode": "require",
}

print(f"JDBC host: {host}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Sync pricing_decision

# COMMAND ----------

APP_SCHEMA = "rms_app"

try:
    pricing_df = (
        spark.read.jdbc(
            url=jdbc_url,
            table=f"{APP_SCHEMA}.pricing_decision",
            properties=jdbc_props,
        )
    )

    row_count = pricing_df.count()
    print(f"Read {row_count} pricing decisions from Lakebase")

    if row_count > 0:
        target_table = f"{FULL_SCHEMA}.pricing_decision"

        spark.sql(f"""
            CREATE TABLE IF NOT EXISTS {target_table} (
                id BIGINT,
                hotel_id STRING,
                room_type_name STRING,
                date DATE,
                suggested_price DOUBLE,
                accepted_price DOUBLE,
                decision STRING,
                expected_revpar DOUBLE,
                decided_at TIMESTAMP
            )
            USING DELTA
            TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
        """)

        pricing_df.createOrReplaceTempView("_src_pricing_decision")

        spark.sql(f"""
            MERGE INTO {target_table} t
            USING _src_pricing_decision s
            ON t.id = s.id
            WHEN MATCHED THEN UPDATE SET
                t.hotel_id = s.hotel_id,
                t.room_type_name = s.room_type_name,
                t.date = s.date,
                t.suggested_price = s.suggested_price,
                t.accepted_price = s.accepted_price,
                t.decision = s.decision,
                t.expected_revpar = s.expected_revpar,
                t.decided_at = s.decided_at
            WHEN NOT MATCHED THEN INSERT *
        """)

        final_count = spark.table(target_table).count()
        print(f"  {target_table}: {final_count} rows after sync")
    else:
        print("  No pricing decisions to sync")

except Exception as e:
    if "relation" in str(e).lower() and "does not exist" in str(e).lower():
        print("  pricing_decision table doesn't exist in Lakebase yet (no decisions made)")
    else:
        print(f"  Error syncing pricing_decision: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Sync room_price (user-modified prices only)

# COMMAND ----------

try:
    room_price_df = (
        spark.read.jdbc(
            url=jdbc_url,
            table=f"(SELECT * FROM {APP_SCHEMA}.room_price WHERE price_source != 'system') AS rp",
            properties=jdbc_props,
        )
    )

    row_count = room_price_df.count()
    print(f"Read {row_count} user-modified room prices from Lakebase")

    if row_count > 0:
        target_table = f"{FULL_SCHEMA}.room_price_active"

        spark.sql(f"""
            CREATE TABLE IF NOT EXISTS {target_table} (
                id BIGINT,
                hotel_id STRING,
                room_type_name STRING,
                date DATE,
                price DOUBLE,
                price_source STRING,
                updated_at TIMESTAMP
            )
            USING DELTA
            TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true')
        """)

        room_price_df.createOrReplaceTempView("_src_room_price_active")

        spark.sql(f"""
            MERGE INTO {target_table} t
            USING _src_room_price_active s
            ON t.hotel_id = s.hotel_id AND t.room_type_name = s.room_type_name AND t.date = s.date
            WHEN MATCHED THEN UPDATE SET
                t.id = s.id,
                t.price = s.price,
                t.price_source = s.price_source,
                t.updated_at = s.updated_at
            WHEN NOT MATCHED THEN INSERT *
        """)

        final_count = spark.table(target_table).count()
        print(f"  {target_table}: {final_count} rows after sync")
    else:
        print("  No user-modified prices to sync")

except Exception as e:
    if "relation" in str(e).lower() and "does not exist" in str(e).lower():
        print("  room_price table doesn't exist in Lakebase yet (app hasn't started)")
    else:
        print(f"  Error syncing room_price: {e}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary

# COMMAND ----------

print("\n=== App State Sync Complete ===")
print(f"Source: Lakebase instance '{LAKEBASE_INSTANCE}', schema '{APP_SCHEMA}'")
print(f"Target: {FULL_SCHEMA}")
