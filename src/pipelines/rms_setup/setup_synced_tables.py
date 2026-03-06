# Databricks notebook source
# MAGIC %md
# MAGIC # Set Up Synced Tables (UC → Lakebase)
# MAGIC
# MAGIC Creates TRIGGERED synced tables that sync Unity Catalog Delta tables
# MAGIC into the Lakebase PostgreSQL instance used by the RMS app.
# MAGIC
# MAGIC This notebook is idempotent — it skips tables that already exist.

# COMMAND ----------

dbutils.widgets.text("uc_catalog", "rms_hotel_demo", "Source UC Catalog")
dbutils.widgets.text("uc_schema", "hotel_rms", "UC Schema")
dbutils.widgets.text("lakebase_instance_name", "rms-app-ds", "Lakebase Instance Name")
dbutils.widgets.text("lakebase_catalog", "rms_app_ds_lakebase", "Lakebase UC Catalog")

UC_CATALOG = dbutils.widgets.get("uc_catalog")
UC_SCHEMA = dbutils.widgets.get("uc_schema")
LAKEBASE_INSTANCE = dbutils.widgets.get("lakebase_instance_name")
LAKEBASE_CATALOG = dbutils.widgets.get("lakebase_catalog")

print(f"Source: {UC_CATALOG}.{UC_SCHEMA}")
print(f"Lakebase instance: {LAKEBASE_INSTANCE}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Install latest Databricks SDK (needed for database service)

# COMMAND ----------

# MAGIC %pip install --upgrade databricks-sdk
# MAGIC dbutils.library.restartPython()

# COMMAND ----------

# Re-read widgets after Python restart
UC_CATALOG = dbutils.widgets.get("uc_catalog")
UC_SCHEMA = dbutils.widgets.get("uc_schema")
LAKEBASE_INSTANCE = dbutils.widgets.get("lakebase_instance_name")
LAKEBASE_CATALOG = dbutils.widgets.get("lakebase_catalog")

from databricks.sdk import WorkspaceClient

w = WorkspaceClient()

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verify Lakebase Catalog

# COMMAND ----------

lakebase_catalog = LAKEBASE_CATALOG
print(f"Lakebase UC catalog: {lakebase_catalog}")

instance = w.database.get_database_instance(LAKEBASE_INSTANCE)
print(f"Instance state: {instance.state}")
print(f"Instance DNS: {instance.read_write_dns}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Create Synced Tables

# COMMAND ----------

try:
    from databricks.sdk.service.database import (
        SyncedDatabaseTable,
        SyncedTableSpec,
        SyncedTableSchedulingPolicy,
    )
    USE_SDK = True
    print("Using SDK for synced table creation")
except ImportError:
    USE_SDK = False
    print("SDK database module not available, will use REST API")

import json
import requests

TABLES_TO_SYNC = [
    ("hotel", ["id"]),
    ("room_type", ["hotel_id", "name"]),
    ("room_price_base", ["hotel_id", "room_type_name", "date"]),
    ("demand_forecast", ["hotel_id", "forecast_date"]),
    ("occupancy_forecast", ["hotel_id", "room_type", "forecast_date"]),
    ("occupancy_actuals", ["hotel_id", "room_type", "date"]),
    ("competitor_price", ["hotel_id", "room_type", "competitor", "date"]),
    ("web_traffic", ["hotel_id", "date"]),
]

TARGET_SCHEMA = "hotel_rms"

results = []
for table_name, pk_cols in TABLES_TO_SYNC:
    source_full = f"{UC_CATALOG}.{UC_SCHEMA}.{table_name}"
    target_full = f"{lakebase_catalog}.{TARGET_SCHEMA}.{table_name}"

    print(f"\n--- {table_name} ---")
    print(f"  Source: {source_full}")
    print(f"  Target: {target_full}")
    print(f"  PK:     {pk_cols}")

    # Check if already exists
    try:
        existing = w.database.get_synced_database_table(name=target_full)
        state = existing.data_synchronization_status.detailed_state if existing.data_synchronization_status else "UNKNOWN"
        print(f"  Already exists (state: {state}) — skipping")
        results.append((table_name, "EXISTING", str(state)))
        continue
    except Exception:
        pass

    # Create synced table
    try:
        if USE_SDK:
            synced = w.database.create_synced_database_table(
                SyncedDatabaseTable(
                    name=target_full,
                    database_instance_name=LAKEBASE_INSTANCE,
                    spec=SyncedTableSpec(
                        source_table_full_name=source_full,
                        primary_key_columns=pk_cols,
                        scheduling_policy=SyncedTableSchedulingPolicy.TRIGGERED,
                    ),
                )
            )
            print(f"  Created synced table: {synced.name}")
        else:
            # Fallback: use REST API
            host = w.config.host.rstrip("/")
            token = w.config.token
            resp = requests.post(
                f"{host}/api/2.0/database/synced-tables",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={
                    "name": target_full,
                    "database_instance_name": LAKEBASE_INSTANCE,
                    "spec": {
                        "source_table_full_name": source_full,
                        "primary_key_columns": pk_cols,
                        "scheduling_policy": "TRIGGERED",
                    },
                },
            )
            resp.raise_for_status()
            print(f"  Created synced table via REST: {target_full}")
        results.append((table_name, "CREATED", "PENDING"))
    except Exception as e:
        print(f"  ERROR: {e}")
        results.append((table_name, "ERROR", str(e)[:100]))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary

# COMMAND ----------

print("\n=== Synced Tables Summary ===")
print(f"{'Table':<25} {'Status':<12} {'State'}")
print("-" * 70)
for name, status, state in results:
    print(f"{name:<25} {status:<12} {state}")

print(f"\nTarget Lakebase catalog: {lakebase_catalog}")
print(f"Target PostgreSQL schema: {TARGET_SCHEMA}")
