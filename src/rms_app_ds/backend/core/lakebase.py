"""Lakebase (Databricks Database) integration: config, engine, session, and dependency.

Supports dual-schema architecture:
  - hotel_rms: read-only tables synced from Unity Catalog via synced tables
  - rms_app: writable tables managed by the application
"""

from __future__ import annotations

import os
from collections.abc import Generator
from contextlib import asynccontextmanager
from typing import Annotated, Any, AsyncGenerator, TypeAlias

from databricks.sdk import WorkspaceClient
from databricks.sdk.errors import NotFound
from fastapi import FastAPI, Request
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Engine, create_engine, event, inspect
from sqlmodel import Session, SQLModel, text

from ._base import LifespanDependency
from ._config import logger

from ..models import APP_SCHEMA, SYNCED_SCHEMA


# --- Database Config ---


class DatabaseConfig(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="")

    port: int = Field(
        description="The port of the database", default=5432, validation_alias="PGPORT"
    )
    database_name: str = Field(
        description="The name of the database", default="databricks_postgres"
    )
    instance_name: str = Field(
        description="The name of the database instance", validation_alias="PGAPPNAME"
    )


# --- Engine creation ---


def _get_dev_db_port() -> int | None:
    """Check for APX_DEV_DB_PORT environment variable for local development."""
    port = os.environ.get("APX_DEV_DB_PORT")
    return int(port) if port else None


def _build_engine_url(
    db_config: DatabaseConfig, ws: WorkspaceClient, dev_port: int | None
) -> str:
    """Build the database engine URL for dev or production mode."""
    if dev_port:
        logger.info(f"Using local dev database at localhost:{dev_port}")
        username = "postgres"
        password = os.environ.get("APX_DEV_DB_PWD")
        if password is None:
            raise ValueError(
                "APX server didn't provide a password, please check the dev server logs"
            )
        return f"postgresql+psycopg://{username}:{password}@localhost:{dev_port}/postgres?sslmode=disable"

    # Production mode: use Databricks Database
    logger.info(f"Using Databricks database instance: {db_config.instance_name}")
    instance = ws.database.get_database_instance(db_config.instance_name)
    prefix = "postgresql+psycopg"
    host = instance.read_write_dns
    port = db_config.port
    database = db_config.database_name
    username = (
        ws.config.client_id if ws.config.client_id else ws.current_user.me().user_name
    )
    return f"{prefix}://{username}:@{host}:{port}/{database}"


def create_db_engine(db_config: DatabaseConfig, ws: WorkspaceClient) -> Engine:
    """
    Create a SQLAlchemy engine.

    In dev mode: no SSL, no password callback.
    In production: require SSL and use Databricks credential callback.
    """
    dev_port = _get_dev_db_port()
    engine_url = _build_engine_url(db_config, ws, dev_port)

    engine_kwargs: dict[str, Any] = {
        "pool_size": 4,
        "pool_recycle": 45 * 60,
        "pool_pre_ping": True,
    }

    if not dev_port:
        engine_kwargs["connect_args"] = {"sslmode": "require", "prepare_threshold": None}
    else:
        engine_kwargs["connect_args"] = {"prepare_threshold": None}

    engine = create_engine(engine_url, **engine_kwargs)

    def before_connect(dialect, conn_rec, cargs, cparams):
        cred = ws.database.generate_database_credential(
            instance_names=[db_config.instance_name]
        )
        cparams["password"] = cred.token

    if not dev_port:
        event.listens_for(engine, "do_connect")(before_connect)

    return engine


def validate_db(engine: Engine, db_config: DatabaseConfig) -> None:
    """Validate that the database connection works."""
    dev_port = _get_dev_db_port()

    if dev_port:
        logger.info(f"Validating local dev database connection at localhost:{dev_port}")
    else:
        logger.info(
            f"Validating database connection to instance {db_config.instance_name}"
        )
        try:
            ws = WorkspaceClient()
            ws.database.get_database_instance(db_config.instance_name)
        except NotFound:
            raise ValueError(
                f"Database instance {db_config.instance_name} does not exist"
            )

    try:
        engine.dispose()
        with Session(engine) as session:
            session.connection().execute(text("SELECT 1"))
            session.close()
    except Exception:
        raise ConnectionError("Failed to connect to the database")

    if dev_port:
        logger.info("Local dev database connection validated successfully")
    else:
        logger.info(
            f"Database connection to instance {db_config.instance_name} validated successfully"
        )


def _synced_tables_available(engine: Engine) -> bool:
    """Check whether the synced hotel_rms schema exists and has data."""
    try:
        insp = inspect(engine)
        schemas = insp.get_schema_names()
        if SYNCED_SCHEMA not in schemas:
            return False
        tables = insp.get_table_names(schema=SYNCED_SCHEMA)
        if "hotel" not in tables:
            return False
        with Session(engine) as session:
            row_count = session.execute(
                text(f"SELECT COUNT(*) FROM {SYNCED_SCHEMA}.hotel")
            ).scalar()
            return row_count is not None and row_count > 0
    except Exception:
        return False


def initialize_models(engine: Engine) -> None:
    """Create the writable app schema and tables.

    Synced tables (hotel_rms schema) are managed by the Databricks synced table
    pipeline — we never create or modify them here. In dev mode (local Postgres),
    we create ALL schemas/tables so the app can function without synced tables.
    """
    dev_port = _get_dev_db_port()
    logger.info("Initializing database models")

    with Session(engine) as session:
        session.connection().execute(
            text(f"CREATE SCHEMA IF NOT EXISTS {APP_SCHEMA}")
        )
        session.commit()
    logger.info(f"Schema '{APP_SCHEMA}' ensured")

    if dev_port:
        with Session(engine) as session:
            session.connection().execute(
                text(f"CREATE SCHEMA IF NOT EXISTS {SYNCED_SCHEMA}")
            )
            session.commit()
        SQLModel.metadata.create_all(engine)
    else:
        _create_app_tables_only(engine)

    _apply_migrations(engine)

    # Verify the app schema is actually usable with a direct query
    try:
        with Session(engine) as session:
            session.execute(
                text(f"SELECT COUNT(*) FROM {APP_SCHEMA}.room_price")
            ).scalar()
        logger.info(f"Schema '{APP_SCHEMA}' verified — tables are accessible")
    except Exception as e:
        logger.error(
            f"Schema '{APP_SCHEMA}' created but not accessible: {e}. "
            "Check Lakebase permissions for the app service principal."
        )
        raise

    logger.info("Database models initialized successfully")


def _create_app_tables_only(engine: Engine) -> None:
    """Create only the writable app tables (rms_app schema), skip synced tables."""
    from ..models import RoomPrice, PricingDecision

    app_tables = []
    for model in [RoomPrice, PricingDecision]:
        tbl = model.__table__  # type: ignore[attr-defined]
        if tbl is not None:
            app_tables.append(tbl)

    SQLModel.metadata.create_all(engine, tables=app_tables)


def _apply_migrations(engine: Engine) -> None:
    """Add columns that create_all won't add to existing tables."""
    migrations = [
        f"ALTER TABLE {APP_SCHEMA}.room_price ADD COLUMN IF NOT EXISTS price_source VARCHAR DEFAULT 'system'",
    ]
    with Session(engine) as session:
        for stmt in migrations:
            try:
                session.connection().execute(text(stmt))
            except Exception:
                pass
        session.commit()


# --- Dependency ---


class _LakebaseDependency(LifespanDependency):
    @asynccontextmanager
    async def lifespan(self, app: FastAPI) -> AsyncGenerator[None, None]:
        db_config = DatabaseConfig()  # ty: ignore[missing-argument]
        ws = app.state.workspace_client

        engine = create_db_engine(db_config, ws)
        validate_db(engine, db_config)
        initialize_models(engine)

        synced_ok = _synced_tables_available(engine)
        app.state.synced_tables_available = synced_ok
        if synced_ok:
            logger.info(f"Synced tables available in schema '{SYNCED_SCHEMA}'")
        else:
            logger.warning(
                f"Synced tables NOT found in schema '{SYNCED_SCHEMA}'. "
                "The app will fall back to seeding data locally."
            )

        app.state.engine = engine
        yield
        engine.dispose()

    @staticmethod
    def __call__(request: Request) -> Generator[Session, None, None]:
        with Session(bind=request.app.state.engine) as session:
            yield session


LakebaseDependency: TypeAlias = Annotated[Session, _LakebaseDependency.depends()]
