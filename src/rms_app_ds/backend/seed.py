"""
Initialization: populates writable rms_app.room_price from synced hotel_rms.room_price_base.

In production, reference data (hotels, room types, forecasts, analytics) comes from
UC → Lakebase synced tables in the hotel_rms schema. This module only handles the
writable room_price table that the app can modify.

In dev mode (no synced tables), falls back to generating all data locally.
"""

from __future__ import annotations

import hashlib
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any, AsyncGenerator

from fastapi import FastAPI
from sqlmodel import Session, select, text

from .core._base import LifespanDependency
from .core._config import logger
from .models import (
    APP_SCHEMA,
    SYNCED_SCHEMA,
    Hotel,
    RoomPrice,
    RoomPriceBase,
    RoomType,
)


def _hash_float(seed_str: str) -> float:
    h = hashlib.sha256(seed_str.encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _init_room_prices_from_synced(session: Session) -> None:
    """Copy base prices from synced hotel_rms.room_price_base to writable rms_app.room_price.

    Only inserts rows that don't already exist in room_price (by hotel_id + room_type_name + date).
    """
    existing_count = session.exec(
        select(RoomPrice).limit(1)
    ).first()

    if existing_count is not None:
        new_rows_sql = text(f"""
            INSERT INTO {APP_SCHEMA}.room_price (hotel_id, room_type_name, date, price, price_source)
            SELECT b.hotel_id, b.room_type_name, b.date, b.price, 'system'
            FROM {SYNCED_SCHEMA}.room_price_base b
            LEFT JOIN {APP_SCHEMA}.room_price rp
                ON b.hotel_id = rp.hotel_id
                AND b.room_type_name = rp.room_type_name
                AND b.date = rp.date
            WHERE rp.id IS NULL
        """)
        result = session.connection().execute(new_rows_sql)
        if result.rowcount and result.rowcount > 0:
            logger.info(f"Added {result.rowcount} new price rows from synced base prices")
        else:
            logger.info("Room prices up to date — no new dates to add")
    else:
        copy_sql = text(f"""
            INSERT INTO {APP_SCHEMA}.room_price (hotel_id, room_type_name, date, price, price_source)
            SELECT hotel_id, room_type_name, date, price, 'system'
            FROM {SYNCED_SCHEMA}.room_price_base
        """)
        result = session.connection().execute(copy_sql)
        logger.info(f"Initialized {result.rowcount} room prices from synced base prices")

    session.commit()


# ── Dev-mode fallback: generate data locally when synced tables are unavailable ──

CITIES: list[tuple[str, str, str, int, float]] = [
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

ROOM_TYPES: list[tuple[str, float, int]] = [
    ("Standard", 1.00, 2), ("Superior", 1.25, 2), ("Deluxe", 1.55, 3),
    ("Executive Suite", 2.20, 2), ("Family", 1.35, 4),
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

ROOM_TYPE_BASE_OCC = {"Standard": 0.72, "Superior": 0.65, "Deluxe": 0.58, "Executive Suite": 0.45, "Family": 0.55}
ROOM_TYPE_SHARES = {"Standard": 0.35, "Superior": 0.25, "Deluxe": 0.20, "Executive Suite": 0.08, "Family": 0.12}


def _hash_int(seed_str: str, low: int, high: int) -> int:
    return low + int(_hash_float(seed_str) * (high - low + 1))


def _roman(n: int) -> str:
    vals = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    result = ""
    for v, s in vals:
        while n >= v:
            result += s
            n -= v
    return result


def _day_factor(target_date: date) -> float:
    dow = target_date.weekday()
    weekend_boost = 1.15 if dow >= 4 else 1.0
    month = target_date.month
    seasonal = {1: 0.80, 2: 0.85, 3: 0.95, 4: 1.05, 5: 1.10, 6: 1.20, 7: 1.25, 8: 1.25, 9: 1.10, 10: 1.05, 11: 0.90, 12: 1.15}
    return weekend_boost * seasonal.get(month, 1.0)


def _seed_dev_all_schemas(session: Session) -> None:
    """Dev-mode fallback: generate all data into both schemas locally."""
    from .models import (
        CompetitorPrice,
        DemandForecast,
        OccupancyActual,
        OccupancyForecast,
        RoomPriceBase,
        WebTrafficRecord,
    )

    today = date.today()
    hotels: list[Hotel] = []
    room_types: list[RoomType] = []
    base_prices: list[RoomPriceBase] = []
    active_prices: list[RoomPrice] = []

    DEV_MAX_HOTELS_PER_CITY = 2

    idx = 0
    for city, country, region, count, price_factor in CITIES:
        for i in range(min(count, DEV_MAX_HOTELS_PER_CITY)):
            hotel_id = f"HTL-{idx:04d}"
            seed = f"{city}:{i}"
            prefix = HOTEL_PREFIXES[_hash_int(f"{seed}:prefix", 0, len(HOTEL_PREFIXES) - 1)]
            suffix = HOTEL_SUFFIXES[_hash_int(f"{seed}:suffix", 0, len(HOTEL_SUFFIXES) - 1)]
            name = f"{prefix} {city} {suffix}" if i == 0 else f"{prefix} {city} {suffix} {_roman(i + 1)}"
            star_rating = _hash_int(f"{seed}:stars", 3, 5)
            base_rooms = {3: (80, 150), 4: (120, 300), 5: (150, 450)}
            total_rooms = _hash_int(f"{seed}:rooms", *base_rooms[star_rating])

            hotels.append(Hotel(
                id=hotel_id, name=name, city=city, country=country,
                region=region, star_rating=star_rating,
                total_rooms=total_rooms, price_factor=price_factor,
            ))

            star_base = {3: 95.0, 4: 155.0, 5: 260.0}
            for rt_name, rt_mult, rt_max_occ in ROOM_TYPES:
                bp = round(star_base.get(star_rating, 130.0) * price_factor * rt_mult, 2)
                share = ROOM_TYPE_SHARES.get(rt_name, 0.2)
                noise = 0.8 + _hash_float(f"{hotel_id}:{rt_name}:count") * 0.4
                rc = max(2, int(total_rooms * share * noise))

                room_types.append(RoomType(
                    hotel_id=hotel_id, name=rt_name, base_price=bp,
                    max_occupancy=rt_max_occ, room_count=rc,
                ))

                for d in range(14):
                    target = today + timedelta(days=d)
                    d_f = _day_factor(target)
                    p_noise = 0.95 + _hash_float(f"{hotel_id}:{rt_name}:{target.isoformat()}:price") * 0.10
                    price = round(bp * d_f * p_noise, 2)
                    base_prices.append(RoomPriceBase(
                        hotel_id=hotel_id, room_type_name=rt_name, date=target, price=price,
                    ))
                    active_prices.append(RoomPrice(
                        hotel_id=hotel_id, room_type_name=rt_name, date=target, price=price,
                    ))
            idx += 1

    logger.info(f"Dev seed: {len(hotels)} hotels, {len(room_types)} room types")
    session.add_all(hotels)
    session.flush()
    session.add_all(room_types)
    session.flush()

    batch = 5000
    for i in range(0, len(base_prices), batch):
        session.add_all(base_prices[i:i + batch])
        session.flush()
    for i in range(0, len(active_prices), batch):
        session.add_all(active_prices[i:i + batch])
        session.flush()
    session.commit()

    # Seed occupancy actuals, competitor prices, web traffic, forecasts
    _seed_dev_analytics(session, hotels)
    _seed_dev_forecasts(session, hotels)
    logger.info("Dev database seeding complete")


def _seed_dev_analytics(session: Session, hotels: list[Hotel]) -> None:
    from .models import CompetitorPrice, OccupancyActual, WebTrafficRecord

    today = date.today()
    competitors = ["Hilton", "Marriott", "Hyatt", "IHG"]
    occ_rows: list[OccupancyActual] = []
    comp_rows: list[CompetitorPrice] = []
    traffic_rows: list[WebTrafficRecord] = []

    for h in hotels:
        star_base_occ = {3: 0.62, 4: 0.70, 5: 0.75}
        base_occ = star_base_occ.get(h.star_rating, 0.65)

        for d in range(-30, 14):
            target = today + timedelta(days=d)
            d_f = _day_factor(target)

            for rt_name in ROOM_TYPE_SHARES:
                occ_noise = _hash_float(f"{h.id}:{rt_name}:{target.isoformat()}:occ")
                occ_pct = min(98.0, max(15.0, round(base_occ * d_f * (0.85 + occ_noise * 0.30) * 100.0, 1)))
                share = ROOM_TYPE_SHARES[rt_name]
                rc = max(2, int(h.total_rooms * share))
                sold = max(0, int(rc * occ_pct / 100.0))

                occ_rows.append(OccupancyActual(
                    hotel_id=h.id, room_type=rt_name, date=target,
                    occupancy_pct=occ_pct, room_count=rc, rooms_sold=sold,
                    star_rating=h.star_rating,
                ))

            # Competitor prices (14-day forward only)
            if d >= 0:
                star_base = {3: 95.0, 4: 155.0, 5: 260.0}
                for rt_name, rt_mult, _ in ROOM_TYPES:
                    bp = round(star_base.get(h.star_rating, 130.0) * h.price_factor * rt_mult, 2)
                    p_noise = 0.95 + _hash_float(f"{h.id}:{rt_name}:{target.isoformat()}:price") * 0.10
                    our_price = round(bp * d_f * p_noise, 2)
                    for comp in competitors:
                        dev = (_hash_float(f"{h.id}:{rt_name}:{comp}:{target.isoformat()}") - 0.5) * 0.30
                        cp = round(our_price * (1 + dev), 2)
                        comp_rows.append(CompetitorPrice(
                            hotel_id=h.id, room_type=rt_name, competitor=comp,
                            date=target, competitor_price=cp, our_price=our_price,
                        ))

            # Web traffic
            seed_base = f"{h.id}:{target.isoformat()}"
            base_searches = int(h.total_rooms * 2.5)
            dow = target.weekday()
            day_mult = 1.3 if dow < 2 else (0.7 if dow >= 5 else 1.0)
            searches = max(10, int(base_searches * day_mult * (0.8 + _hash_float(f"{seed_base}:s") * 0.4)))
            page_views = int(searches * (1.5 + _hash_float(f"{seed_base}:pv") * 1.0))
            booking_attempts = int(page_views * (0.08 + _hash_float(f"{seed_base}:ba") * 0.07))
            bookings_completed = int(booking_attempts * (0.4 + _hash_float(f"{seed_base}:bc") * 0.35))
            conversion = round(bookings_completed / max(1, searches) * 100, 2)

            traffic_rows.append(WebTrafficRecord(
                hotel_id=h.id, date=target, searches=searches, page_views=page_views,
                booking_attempts=booking_attempts, bookings_completed=bookings_completed,
                conversion_rate=conversion,
            ))

    batch = 5000
    for i in range(0, len(occ_rows), batch):
        session.add_all(occ_rows[i:i + batch])
        session.flush()
    for i in range(0, len(comp_rows), batch):
        session.add_all(comp_rows[i:i + batch])
        session.flush()
    for i in range(0, len(traffic_rows), batch):
        session.add_all(traffic_rows[i:i + batch])
        session.flush()
    session.commit()
    logger.info(f"Dev analytics: {len(occ_rows)} occupancy, {len(comp_rows)} competitor, {len(traffic_rows)} traffic rows")


def _seed_dev_forecasts(session: Session, hotels: list[Hotel]) -> None:
    from datetime import datetime as _dt
    from .models import DemandForecast, OccupancyForecast

    today = date.today()
    generated_at = _dt(today.year, today.month, today.day, 6, 0, 0)
    MODEL_VERSION = "v2.1.0"

    demand_rows: list[DemandForecast] = []
    occ_rows: list[OccupancyForecast] = []

    for hotel in hotels:
        base_demand = 45.0 + _hash_float(hotel.id) * 30.0
        for d in range(30):
            target = today + timedelta(days=d)
            d_f = _day_factor(target)
            noise = _hash_float(f"{hotel.id}:{target.isoformat()}:demand_fc")
            score = min(100.0, max(0.0, round(base_demand * d_f + (noise - 0.5) * 15.0, 1)))
            level = "Very High" if score >= 80 else "High" if score >= 60 else "Medium" if score >= 40 else "Low"
            h2 = _hash_float(f"{hotel.id}:{target.isoformat()}:fc_h2")
            h3 = _hash_float(f"{hotel.id}:{target.isoformat()}:fc_h3")
            h4 = _hash_float(f"{hotel.id}:{target.isoformat()}:fc_h4")
            searches = int(score * (2.0 + h2) + 50)
            attempts = int(searches * (0.08 + h3 * 0.07))
            bookings = int(attempts * (0.40 + h4 * 0.35))
            conf = min(0.99, max(0.50, round(0.95 - d * 0.012 + (noise - 0.5) * 0.05, 3)))

            demand_rows.append(DemandForecast(
                hotel_id=hotel.id, forecast_date=target, lead_time_days=d,
                demand_score=score, demand_level=level, expected_searches=searches,
                expected_booking_attempts=attempts, expected_bookings=bookings,
                confidence=conf, model_version=MODEL_VERSION, forecast_generated_at=generated_at,
            ))

            for rt_name in ROOM_TYPE_SHARES:
                rt_base_occ = ROOM_TYPE_BASE_OCC[rt_name]
                total_rooms_rt = max(2, int(hotel.total_rooms * ROOM_TYPE_SHARES[rt_name]))
                rt_noise = _hash_float(f"{hotel.id}:{rt_name}:{target.isoformat()}:occ_fc")
                rt_noise2 = _hash_float(f"{hotel.id}:{rt_name}:{target.isoformat()}:occ_fc2")
                pred_occ = min(98.0, max(5.0, round(rt_base_occ * 100.0 * d_f + (rt_noise - 0.5) * 20.0, 1)))
                pred_sold = max(0, int(total_rooms_rt * pred_occ / 100.0))
                ci_width = d * 0.3 + rt_noise2 * 3.0 + 2.0
                lower = round(max(0.0, pred_occ - ci_width), 1)
                upper = round(min(100.0, pred_occ + ci_width), 1)
                occ_conf = min(0.99, max(0.50, round(0.93 - d * 0.01 + (rt_noise - 0.5) * 0.04, 3)))

                occ_rows.append(OccupancyForecast(
                    hotel_id=hotel.id, room_type=rt_name, forecast_date=target,
                    lead_time_days=d, predicted_occupancy_pct=pred_occ,
                    predicted_rooms_sold=pred_sold, total_rooms=total_rooms_rt,
                    lower_bound_pct=lower, upper_bound_pct=upper, confidence=occ_conf,
                    model_version=MODEL_VERSION, forecast_generated_at=generated_at,
                ))

    batch = 5000
    for i in range(0, len(demand_rows), batch):
        session.add_all(demand_rows[i:i + batch])
        session.flush()
    for i in range(0, len(occ_rows), batch):
        session.add_all(occ_rows[i:i + batch])
        session.flush()
    session.commit()
    logger.info(f"Dev forecasts: {len(demand_rows)} demand, {len(occ_rows)} occupancy")


def _clear_all_data(session: Session) -> None:
    """Remove stale data from both schemas so a fresh seed can proceed."""
    for schema, table in [
        (APP_SCHEMA, "pricing_decision"),
        (APP_SCHEMA, "room_price"),
        (SYNCED_SCHEMA, "web_traffic"),
        (SYNCED_SCHEMA, "competitor_price"),
        (SYNCED_SCHEMA, "occupancy_forecast"),
        (SYNCED_SCHEMA, "occupancy_actuals"),
        (SYNCED_SCHEMA, "demand_forecast"),
        (SYNCED_SCHEMA, "room_price_base"),
        (SYNCED_SCHEMA, "room_type"),
        (SYNCED_SCHEMA, "hotel"),
    ]:
        try:
            session.connection().execute(text(f"DELETE FROM {schema}.{table}"))
        except Exception:
            pass
    session.commit()
    logger.info("Cleared stale data from all tables before re-seeding")


# ── Lifespan dependency: auto-seed on startup if empty ──


class _SeedDependency(LifespanDependency):
    @asynccontextmanager
    async def lifespan(self, app: FastAPI) -> AsyncGenerator[None, None]:
        engine = app.state.engine
        synced_available = getattr(app.state, "synced_tables_available", False)

        with Session(engine) as session:
            if synced_available:
                logger.info("Synced tables available — initializing writable room prices")
                try:
                    _init_room_prices_from_synced(session)
                except Exception as e:
                    logger.error(
                        f"Failed to init prices from synced tables: {e}. "
                        "The app will start without writable room prices."
                    )
                    session.rollback()
            else:
                logger.info("No synced tables — using dev-mode local seeding")
                existing = session.exec(select(Hotel).limit(1)).first()
                if existing is None:
                    _clear_all_data(session)
                    _seed_dev_all_schemas(session)
                else:
                    logger.info("Data already seeded, skipping")
        yield

    @staticmethod
    def __call__(*args: Any, **kwargs: Any) -> None:
        pass
