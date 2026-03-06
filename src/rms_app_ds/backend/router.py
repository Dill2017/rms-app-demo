from __future__ import annotations

import datetime as dt
from collections import defaultdict
from datetime import date, timedelta

from databricks.sdk.service.iam import User as UserOut
from fastapi import HTTPException
from sqlmodel import func, select, text

from .analytics import day_factor
from .core import Dependencies, create_router
from .models import (
    CalendarDaySummary,
    CompetitorPrice,
    CompetitorPriceRow,
    DashboardKPIs,
    DemandForecast,
    DemandForecastRow,
    Hotel,
    HotelDetail,
    HotelListOut,
    HotelSummary,
    OccupancyActual,
    OccupancyByRegion,
    OccupancyForecast,
    OccupancyForecastRow,
    OccupancyRow,
    OpportunityRow,
    PickupCurvePoint,
    PricingDecision,
    PricingDecisionIn,
    PricingDecisionOut,
    RevenueTrendPoint,
    RoomDateDetail,
    RoomPrice,
    RoomPricingRow,
    RoomType,
    RoomTypeInfo,
    VersionOut,
    WebTrafficRecord,
    WebTrafficRow,
)
from .pricing_engine import suggest_price

router = create_router()


# ── Helpers for querying synced tables ──


def _get_occupancy(session, hotel_id: str, room_type: str, target_date: date) -> float:
    """Get occupancy fraction (0-1) from the occupancy_actuals synced table."""
    row = session.exec(
        select(OccupancyActual.occupancy_pct).where(
            OccupancyActual.hotel_id == hotel_id,
            OccupancyActual.room_type == room_type,
            OccupancyActual.date == target_date,
        )
    ).first()
    return float(row) / 100.0 if row is not None else 0.65


def _get_avg_occupancy(session, hotel_id: str, target_date: date) -> float:
    """Average occupancy across all room types for a hotel on a date."""
    result = session.exec(
        select(func.avg(OccupancyActual.occupancy_pct)).where(
            OccupancyActual.hotel_id == hotel_id,
            OccupancyActual.date == target_date,
        )
    ).one()
    return float(result) / 100.0 if result is not None else 0.65


def _get_demand_score(session, hotel_id: str, target_date: date) -> float:
    """Get demand score from the demand_forecast synced table (used as demand proxy)."""
    row = session.exec(
        select(DemandForecast.demand_score).where(
            DemandForecast.hotel_id == hotel_id,
            DemandForecast.forecast_date == target_date,
        )
    ).first()
    return float(row) if row is not None else 50.0


def _get_competitor_avg(session, hotel_id: str, room_type: str, target_date: date) -> float:
    """Average competitor price from the competitor_price synced table."""
    result = session.exec(
        select(func.avg(CompetitorPrice.competitor_price)).where(
            CompetitorPrice.hotel_id == hotel_id,
            CompetitorPrice.room_type == room_type,
            CompetitorPrice.date == target_date,
        )
    ).one()
    return float(result) if result is not None else 0.0


def _get_web_traffic(session, hotel_id: str, target_date: date) -> dict:
    """Get web traffic record from the synced table."""
    row = session.exec(
        select(WebTrafficRecord).where(
            WebTrafficRecord.hotel_id == hotel_id,
            WebTrafficRecord.date == target_date,
        )
    ).first()
    if row:
        return {
            "searches": row.searches,
            "page_views": row.page_views,
            "booking_attempts": row.booking_attempts,
            "bookings_completed": row.bookings_completed,
            "conversion_rate": row.conversion_rate,
        }
    return {"searches": 0, "page_views": 0, "booking_attempts": 0, "bookings_completed": 0, "conversion_rate": 0.0}


# ── Basic routes ──


@router.get("/version", response_model=VersionOut, operation_id="version")
async def version():
    return VersionOut.from_metadata()


@router.get("/debug/db-info", response_model=dict, operation_id="debugDbInfo")
def debug_db_info(session: Dependencies.Session):
    """Diagnostic endpoint: confirms queries go to Lakebase (PostgreSQL), not Delta tables."""
    conn = session.connection()
    pg_version = conn.execute(text("SELECT version()")).scalar()
    db_name = conn.execute(text("SELECT current_database()")).scalar()
    schemas = conn.execute(
        text("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name")
    ).scalars().all()
    hotel_count = session.exec(select(func.count()).select_from(Hotel)).one()
    synced_tables = conn.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'hotel_rms' ORDER BY table_name"
        )
    ).scalars().all()
    app_tables = conn.execute(
        text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'rms_app' ORDER BY table_name"
        )
    ).scalars().all()
    engine_url = str(session.bind.url) if session.bind else "unknown"
    driver = engine_url.split("://")[0] if "://" in engine_url else "unknown"

    return {
        "database_backend": "PostgreSQL (Lakebase)" if "postgresql" in driver else driver,
        "driver": driver,
        "pg_version": pg_version,
        "database_name": db_name,
        "schemas": schemas,
        "synced_tables_hotel_rms": synced_tables,
        "app_tables_rms_app": app_tables,
        "hotel_count": hotel_count,
        "note": "All queries use PostgreSQL wire protocol via SQLAlchemy — no Spark or Delta table access.",
    }


@router.get("/current-user", response_model=UserOut, operation_id="currentUser")
def me(user_ws: Dependencies.UserClient):
    return user_ws.current_user.me()


@router.get("/regions", response_model=list[str], operation_id="listRegions")
def list_regions(session: Dependencies.Session):
    rows = session.exec(select(Hotel.region).distinct().order_by(Hotel.region))
    return list(rows)


# ── Hotel routes ──


@router.get("/hotels", response_model=HotelListOut, operation_id="listHotels")
def list_hotels(
    session: Dependencies.Session,
    search: str = "",
    region: str = "",
    page: int = 1,
    page_size: int = 20,
):
    today = date.today()
    stmt = select(Hotel)
    if search:
        q = f"%{search}%"
        stmt = stmt.where(Hotel.name.ilike(q) | Hotel.city.ilike(q))  # type: ignore[union-attr]
    if region:
        stmt = stmt.where(Hotel.region == region)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = session.exec(count_stmt).one()

    stmt = stmt.order_by(Hotel.id).offset((page - 1) * page_size).limit(page_size)
    hotels = session.exec(stmt).all()

    summaries: list[HotelSummary] = []
    for h in hotels:
        occ = _get_avg_occupancy(session, h.id, today)
        price_stmt = select(func.avg(RoomPrice.price)).where(
            RoomPrice.hotel_id == h.id, RoomPrice.date == today
        )
        adr_val = session.exec(price_stmt).one()
        adr = float(adr_val) if adr_val else 0.0
        summaries.append(HotelSummary(
            hotel_id=h.id, name=h.name, city=h.city, country=h.country,
            region=h.region, star_rating=h.star_rating, total_rooms=h.total_rooms,
            occupancy_pct=round(occ * 100, 1), adr=round(adr, 2),
            revpar=round(adr * occ, 2),
        ))

    return HotelListOut(hotels=summaries, total=total, page=page, page_size=page_size)


@router.get("/hotels/{hotel_id}", response_model=HotelDetail, operation_id="getHotel")
def get_hotel(hotel_id: str, session: Dependencies.Session):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        raise HTTPException(status_code=404, detail="Hotel not found")

    today = date.today()
    room_types_db = session.exec(
        select(RoomType).where(RoomType.hotel_id == hotel_id)
    ).all()

    room_types = [
        RoomTypeInfo(name=rt.name, base_price=rt.base_price,
                     max_occupancy=rt.max_occupancy, room_count=rt.room_count)
        for rt in room_types_db
    ]

    total_revenue = 0.0
    total_occ = 0.0
    occ_count = 0
    for rt in room_types_db:
        for d in range(30):
            target = today - timedelta(days=d)
            occ = _get_occupancy(session, hotel_id, rt.name, target)
            price_row = session.exec(
                select(RoomPrice.price).where(
                    RoomPrice.hotel_id == hotel_id,
                    RoomPrice.room_type_name == rt.name,
                    RoomPrice.date == target,
                )
            ).first()
            price = float(price_row) if price_row else rt.base_price
            total_revenue += price * rt.room_count * occ
            total_occ += occ
            occ_count += 1

    avg_occ = total_occ / max(1, occ_count)
    price_stmt = select(func.avg(RoomPrice.price)).where(
        RoomPrice.hotel_id == hotel_id, RoomPrice.date == today
    )
    adr_val = session.exec(price_stmt).one()
    adr = float(adr_val) if adr_val else 0.0

    return HotelDetail(
        hotel_id=hotel.id, name=hotel.name, city=hotel.city,
        country=hotel.country, region=hotel.region,
        star_rating=hotel.star_rating, total_rooms=hotel.total_rooms,
        room_types=room_types, occupancy_pct=round(avg_occ * 100, 1),
        adr=round(adr, 2), revpar=round(adr * avg_occ, 2),
        revenue_mtd=round(total_revenue, 2),
    )


# ── Pricing routes ──


@router.get(
    "/hotels/{hotel_id}/pricing",
    response_model=list[RoomPricingRow],
    operation_id="getHotelPricing",
)
def get_hotel_pricing(
    hotel_id: str,
    session: Dependencies.Session,
    start_date: str | None = None,
    end_date: str | None = None,
    room_type: str | None = None,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today
    ed = date.fromisoformat(end_date) if end_date else today + timedelta(days=13)

    stmt = select(RoomPrice).where(
        RoomPrice.hotel_id == hotel_id,
        RoomPrice.date >= sd,
        RoomPrice.date <= ed,
    )
    if room_type:
        stmt = stmt.where(RoomPrice.room_type_name == room_type)
    stmt = stmt.order_by(RoomPrice.date).order_by(RoomPrice.room_type_name)  # ty: ignore[invalid-argument-type]
    price_rows = session.exec(stmt).all()

    rt_base: dict[str, float] = {}
    rt_rooms: dict[str, int] = {}
    for rt in session.exec(select(RoomType).where(RoomType.hotel_id == hotel_id)).all():
        rt_base[rt.name] = rt.base_price
        rt_rooms[rt.name] = rt.room_count

    demand_fc_map: dict[date, DemandForecast] = {}
    dfc_rows = session.exec(
        select(DemandForecast).where(
            DemandForecast.hotel_id == hotel_id,
            DemandForecast.forecast_date >= sd,
            DemandForecast.forecast_date <= ed,
        )
    ).all()
    for dfc in dfc_rows:
        demand_fc_map[dfc.forecast_date] = dfc

    occ_fc_map: dict[tuple[date, str], OccupancyForecast] = {}
    ofc_rows = session.exec(
        select(OccupancyForecast).where(
            OccupancyForecast.hotel_id == hotel_id,
            OccupancyForecast.forecast_date >= sd,
            OccupancyForecast.forecast_date <= ed,
        )
    ).all()
    for ofc in ofc_rows:
        occ_fc_map[(ofc.forecast_date, ofc.room_type)] = ofc

    rows: list[RoomPricingRow] = []
    for pr in price_rows:
        occ = _get_occupancy(session, hotel_id, pr.room_type_name, pr.date)
        demand = _get_demand_score(session, hotel_id, pr.date)
        comp_avg = _get_competitor_avg(session, hotel_id, pr.room_type_name, pr.date)

        dfc = demand_fc_map.get(pr.date)
        ofc = occ_fc_map.get((pr.date, pr.room_type_name))

        suggestion = suggest_price(
            base_price=rt_base.get(pr.room_type_name, 0.0),
            current_occupancy=occ,
            forecast_occupancy=ofc.predicted_occupancy_pct if ofc else None,
            demand_score=demand,
            forecast_demand_score=dfc.demand_score if dfc else None,
            competitor_avg=comp_avg,
            room_count=rt_rooms.get(pr.room_type_name, 1),
            forecast_confidence=ofc.confidence if ofc else None,
        )

        rows.append(RoomPricingRow(
            date=pr.date.isoformat(),
            room_type=pr.room_type_name,
            current_price=pr.price,
            base_price=rt_base.get(pr.room_type_name, 0.0),
            competitor_avg=round(comp_avg, 2),
            occupancy_pct=round(occ * 100, 1),
            demand_score=demand,
            suggested_price=suggestion.suggested_price,
            expected_revpar=suggestion.expected_revpar,
            expected_occupancy=suggestion.expected_occupancy,
            price_vs_competitor_pct=suggestion.price_vs_competitor_pct,
            suggestion_confidence=suggestion.confidence,
            price_source=pr.price_source,
            forecast_demand_score=dfc.demand_score if dfc else None,
            forecast_demand_level=dfc.demand_level if dfc else None,
            forecast_occupancy_pct=ofc.predicted_occupancy_pct if ofc else None,
            forecast_occupancy_lower=ofc.lower_bound_pct if ofc else None,
            forecast_occupancy_upper=ofc.upper_bound_pct if ofc else None,
            forecast_confidence=ofc.confidence if ofc else None,
        ))
    return rows


@router.post(
    "/hotels/{hotel_id}/pricing",
    response_model=PricingDecisionOut,
    operation_id="updateHotelPricing",
)
def update_hotel_pricing(
    hotel_id: str,
    body: PricingDecisionIn,
    session: Dependencies.Session,
):
    target = date.fromisoformat(body.date)
    price_row = session.exec(
        select(RoomPrice).where(
            RoomPrice.hotel_id == hotel_id,
            RoomPrice.room_type_name == body.room_type,
            RoomPrice.date == target,
        )
    ).first()

    if not price_row:
        raise HTTPException(status_code=404, detail="Price row not found for that date/room type")

    old_price = price_row.price
    price_row.price = body.accepted_price
    price_row.price_source = "suggestion" if body.decision == "accepted" else "manual"
    price_row.updated_at = dt.datetime.now(dt.timezone.utc)
    session.add(price_row)

    decision_row = PricingDecision(
        hotel_id=hotel_id,
        room_type_name=body.room_type,
        date=target,
        suggested_price=body.suggested_price,
        accepted_price=body.accepted_price,
        decision=body.decision,
        expected_revpar=body.expected_revpar,
        decided_at=dt.datetime.now(dt.timezone.utc),
    )
    session.add(decision_row)
    session.commit()

    return PricingDecisionOut(
        success=True, hotel_id=hotel_id, room_type=body.room_type,
        date=body.date, old_price=old_price, new_price=body.accepted_price,
        decision=body.decision, expected_revpar=body.expected_revpar,
    )


# ── Occupancy routes ──


@router.get(
    "/hotels/{hotel_id}/occupancy",
    response_model=list[OccupancyRow],
    operation_id="getHotelOccupancy",
)
def get_hotel_occupancy(
    hotel_id: str,
    session: Dependencies.Session,
    start_date: str | None = None,
    end_date: str | None = None,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today - timedelta(days=29)
    ed = date.fromisoformat(end_date) if end_date else today

    occ_rows = session.exec(
        select(OccupancyActual).where(
            OccupancyActual.hotel_id == hotel_id,
            OccupancyActual.date >= sd,
            OccupancyActual.date <= ed,
        ).order_by(OccupancyActual.date, OccupancyActual.room_type)  # ty: ignore[invalid-argument-type]
    ).all()

    return [
        OccupancyRow(
            date=r.date.isoformat(), room_type=r.room_type,
            total_rooms=r.room_count, rooms_sold=r.rooms_sold,
            occupancy_pct=r.occupancy_pct,
        )
        for r in occ_rows
    ]


# ── Calendar routes ──


HOLIDAY_MAP: dict[tuple[int, int], str] = {
    (1, 1): "New Year's Day",
    (2, 14): "Valentine's Day",
    (3, 17): "St. Patrick's Day",
    (3, 19): "Saint Joseph's Day",
    (3, 29): "Good Friday",
    (3, 31): "Easter Sunday",
    (5, 1): "May Day",
    (7, 4): "Independence Day",
    (10, 31): "Halloween",
    (12, 24): "Christmas Eve",
    (12, 25): "Christmas Day",
    (12, 31): "New Year's Eve",
}


@router.get(
    "/hotels/{hotel_id}/calendar",
    response_model=list[CalendarDaySummary],
    operation_id="getHotelCalendar",
)
def get_hotel_calendar(
    hotel_id: str,
    session: Dependencies.Session,
    month: str | None = None,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    today = date.today()
    if month:
        parts = month.split("-")
        year, mo = int(parts[0]), int(parts[1])
    else:
        year, mo = today.year, today.month

    first_day = date(year, mo, 1)
    if mo == 12:
        last_day = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(year, mo + 1, 1) - timedelta(days=1)

    room_types_db = session.exec(
        select(RoomType).where(RoomType.hotel_id == hotel_id)
    ).all()
    if not room_types_db:
        return []

    rt_base: dict[str, float] = {rt.name: rt.base_price for rt in room_types_db}
    total_rooms = sum(rt.room_count for rt in room_types_db)

    # Bulk-load prices for the month
    price_rows = session.exec(
        select(RoomPrice).where(
            RoomPrice.hotel_id == hotel_id,
            RoomPrice.date >= first_day,
            RoomPrice.date <= last_day,
        )
    ).all()
    price_by_date: dict[date, list[RoomPrice]] = defaultdict(list)
    for pr in price_rows:
        price_by_date[pr.date].append(pr)

    # Bulk-load occupancy actuals
    occ_actuals = session.exec(
        select(OccupancyActual).where(
            OccupancyActual.hotel_id == hotel_id,
            OccupancyActual.date >= first_day - timedelta(days=1),
            OccupancyActual.date <= last_day,
        )
    ).all()
    occ_by_date_rt: dict[tuple[date, str], OccupancyActual] = {}
    for oa in occ_actuals:
        occ_by_date_rt[(oa.date, oa.room_type)] = oa

    # Bulk-load forecasts
    demand_fc_map: dict[date, DemandForecast] = {}
    for dfc in session.exec(
        select(DemandForecast).where(
            DemandForecast.hotel_id == hotel_id,
            DemandForecast.forecast_date >= first_day,
            DemandForecast.forecast_date <= last_day,
        )
    ).all():
        demand_fc_map[dfc.forecast_date] = dfc

    occ_fc_map: dict[tuple[date, str], OccupancyForecast] = {}
    for ofc in session.exec(
        select(OccupancyForecast).where(
            OccupancyForecast.hotel_id == hotel_id,
            OccupancyForecast.forecast_date >= first_day,
            OccupancyForecast.forecast_date <= last_day,
        )
    ).all():
        occ_fc_map[(ofc.forecast_date, ofc.room_type)] = ofc

    # Bulk-load competitor prices and compute averages in Python
    comp_rows_raw = session.exec(
        select(CompetitorPrice).where(
            CompetitorPrice.hotel_id == hotel_id,
            CompetitorPrice.date >= first_day,
            CompetitorPrice.date <= last_day,
        )
    ).all()
    comp_sums: dict[tuple[date, str], list[float]] = defaultdict(list)
    for cr in comp_rows_raw:
        comp_sums[(cr.date, cr.room_type)].append(cr.competitor_price)
    comp_avg_map: dict[tuple[date, str], float] = {
        k: sum(v) / len(v) for k, v in comp_sums.items()
    }

    summaries: list[CalendarDaySummary] = []
    current = first_day
    while current <= last_day:
        day_prices = price_by_date.get(current, [])
        if day_prices:
            avg_price = sum(p.price for p in day_prices) / len(day_prices)
        else:
            avg_price = sum(rt_base.values()) / max(1, len(rt_base))

        occ_total = 0.0
        occ_count = 0
        total_sold = 0
        for rt in room_types_db:
            oa = occ_by_date_rt.get((current, rt.name))
            occ = oa.occupancy_pct / 100.0 if oa else 0.65
            occ_total += occ
            occ_count += 1
            total_sold += int(rt.room_count * occ)

        avg_occ = occ_total / max(1, occ_count)

        yesterday = current - timedelta(days=1)
        yesterday_sold = 0
        for rt in room_types_db:
            oa_y = occ_by_date_rt.get((yesterday, rt.name))
            occ_y = oa_y.occupancy_pct / 100.0 if oa_y else 0.65
            yesterday_sold += int(rt.room_count * occ_y)
        pickup = max(0, total_sold - yesterday_sold)

        avg_suggested = avg_price
        suggested_prices = []
        for rt in room_types_db:
            ofc = occ_fc_map.get((current, rt.name))
            dfc = demand_fc_map.get(current)
            oa = occ_by_date_rt.get((current, rt.name))
            occ_val = oa.occupancy_pct / 100.0 if oa else 0.65
            demand = dfc.demand_score if dfc else 50.0
            comp_avg = comp_avg_map.get((current, rt.name), rt_base[rt.name])

            suggestion = suggest_price(
                base_price=rt_base[rt.name],
                current_occupancy=occ_val,
                forecast_occupancy=ofc.predicted_occupancy_pct if ofc else None,
                demand_score=demand,
                forecast_demand_score=dfc.demand_score if dfc else None,
                competitor_avg=comp_avg,
                room_count=rt.room_count,
                forecast_confidence=ofc.confidence if ofc else None,
            )
            suggested_prices.append(suggestion.suggested_price)
        if suggested_prices:
            avg_suggested = sum(suggested_prices) / len(suggested_prices)

        rooms_left = total_rooms - total_sold
        occ_pct = round(avg_occ * 100, 1)

        if occ_pct >= 90:
            booking_status = "high"
        elif occ_pct < 40:
            booking_status = "low"
        else:
            booking_status = "normal"

        event_name = HOLIDAY_MAP.get((current.month, current.day))

        summaries.append(CalendarDaySummary(
            date=current.isoformat(),
            avg_price=round(avg_price, 0),
            avg_suggested_price=round(avg_suggested, 0),
            occupancy_pct=occ_pct,
            pickup_rooms=pickup,
            total_rooms=total_rooms,
            rooms_sold=total_sold,
            rooms_left=rooms_left,
            booking_status=booking_status,
            event_name=event_name,
        ))
        current += timedelta(days=1)

    return summaries


@router.get(
    "/hotels/{hotel_id}/room-date-detail",
    response_model=list[RoomDateDetail],
    operation_id="getRoomDateDetail",
)
def get_room_date_detail(
    hotel_id: str,
    target_date: str,
    session: Dependencies.Session,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    td = date.fromisoformat(target_date)
    room_types_db = session.exec(
        select(RoomType).where(RoomType.hotel_id == hotel_id)
    ).all()

    demand_fc = session.exec(
        select(DemandForecast).where(
            DemandForecast.hotel_id == hotel_id,
            DemandForecast.forecast_date == td,
        )
    ).first()

    rows: list[RoomDateDetail] = []
    for rt in room_types_db:
        price_row = session.exec(
            select(RoomPrice).where(
                RoomPrice.hotel_id == hotel_id,
                RoomPrice.room_type_name == rt.name,
                RoomPrice.date == td,
            )
        ).first()
        current_price = price_row.price if price_row else rt.base_price
        price_source = price_row.price_source if price_row else "system"

        yesterday_price_row = session.exec(
            select(RoomPrice.price).where(
                RoomPrice.hotel_id == hotel_id,
                RoomPrice.room_type_name == rt.name,
                RoomPrice.date == td - timedelta(days=1),
            )
        ).first()
        week_ago_price_row = session.exec(
            select(RoomPrice.price).where(
                RoomPrice.hotel_id == hotel_id,
                RoomPrice.room_type_name == rt.name,
                RoomPrice.date == td - timedelta(days=7),
            )
        ).first()

        occ = _get_occupancy(session, hotel_id, rt.name, td)
        demand = _get_demand_score(session, hotel_id, td)
        comp_avg = _get_competitor_avg(session, hotel_id, rt.name, td)

        ofc = session.exec(
            select(OccupancyForecast).where(
                OccupancyForecast.hotel_id == hotel_id,
                OccupancyForecast.room_type == rt.name,
                OccupancyForecast.forecast_date == td,
            )
        ).first()

        suggestion = suggest_price(
            base_price=rt.base_price,
            current_occupancy=occ,
            forecast_occupancy=ofc.predicted_occupancy_pct if ofc else None,
            demand_score=demand,
            forecast_demand_score=demand_fc.demand_score if demand_fc else None,
            competitor_avg=comp_avg,
            room_count=rt.room_count,
            forecast_confidence=ofc.confidence if ofc else None,
        )

        d_f = day_factor(td)
        base_adj = rt.base_price * d_f
        market_diff = suggestion.suggested_price - base_adj
        market_pct = round((market_diff / max(1, base_adj)) * 100, 1) if base_adj > 0 else 0
        occ_contrib = suggestion.suggested_price * (occ - 0.5) * 0.3
        occ_pct = round((occ_contrib / max(1, suggestion.suggested_price)) * 100, 1)
        adj_pct = 0.0
        if price_source == "manual":
            adj_pct = round(((current_price - suggestion.suggested_price) / max(1, suggestion.suggested_price)) * 100, 1)

        rooms_sold = int(rt.room_count * occ)

        rows.append(RoomDateDetail(
            room_type=rt.name,
            current_price=current_price,
            suggested_price=suggestion.suggested_price,
            base_price=round(base_adj, 0),
            price_yesterday=float(yesterday_price_row) if yesterday_price_row else None,
            price_7_days_ago=float(week_ago_price_row) if week_ago_price_row else None,
            competitor_avg=round(comp_avg, 2),
            occupancy_pct=round(occ * 100, 1),
            demand_score=demand,
            expected_revpar=suggestion.expected_revpar,
            expected_occupancy=suggestion.expected_occupancy,
            price_vs_competitor_pct=suggestion.price_vs_competitor_pct,
            suggestion_confidence=suggestion.confidence,
            price_source=price_source,
            room_count=rt.room_count,
            rooms_sold=rooms_sold,
            rooms_left=rt.room_count - rooms_sold,
            market_factor_pct=market_pct,
            occupancy_factor_pct=occ_pct,
            adjustment_pct=adj_pct,
        ))

    return rows


# ── Forecast routes (from synced tables) ──


@router.get(
    "/hotels/{hotel_id}/demand-forecast",
    response_model=list[DemandForecastRow],
    operation_id="getHotelDemandForecast",
)
def get_hotel_demand_forecast(
    hotel_id: str,
    session: Dependencies.Session,
    start_date: str | None = None,
    end_date: str | None = None,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today
    ed = date.fromisoformat(end_date) if end_date else today + timedelta(days=29)

    stmt = select(DemandForecast).where(
        DemandForecast.hotel_id == hotel_id,
        DemandForecast.forecast_date >= sd,
        DemandForecast.forecast_date <= ed,
    ).order_by(DemandForecast.forecast_date)  # ty: ignore[invalid-argument-type]
    fc_rows = session.exec(stmt).all()

    return [
        DemandForecastRow(
            forecast_date=r.forecast_date.isoformat(),
            lead_time_days=r.lead_time_days,
            demand_score=r.demand_score,
            demand_level=r.demand_level,
            expected_searches=r.expected_searches,
            expected_booking_attempts=r.expected_booking_attempts,
            expected_bookings=r.expected_bookings,
            confidence=r.confidence,
            model_version=r.model_version,
        )
        for r in fc_rows
    ]


@router.get(
    "/hotels/{hotel_id}/occupancy-forecast",
    response_model=list[OccupancyForecastRow],
    operation_id="getHotelOccupancyForecast",
)
def get_hotel_occupancy_forecast(
    hotel_id: str,
    session: Dependencies.Session,
    start_date: str | None = None,
    end_date: str | None = None,
    room_type: str | None = None,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today
    ed = date.fromisoformat(end_date) if end_date else today + timedelta(days=29)

    stmt = select(OccupancyForecast).where(
        OccupancyForecast.hotel_id == hotel_id,
        OccupancyForecast.forecast_date >= sd,
        OccupancyForecast.forecast_date <= ed,
    )
    if room_type:
        stmt = stmt.where(OccupancyForecast.room_type == room_type)
    stmt = stmt.order_by(OccupancyForecast.forecast_date).order_by(OccupancyForecast.room_type)  # ty: ignore[invalid-argument-type]
    fc_rows = session.exec(stmt).all()

    return [
        OccupancyForecastRow(
            forecast_date=r.forecast_date.isoformat(),
            room_type=r.room_type,
            lead_time_days=r.lead_time_days,
            predicted_occupancy_pct=r.predicted_occupancy_pct,
            predicted_rooms_sold=r.predicted_rooms_sold,
            total_rooms=r.total_rooms,
            lower_bound_pct=r.lower_bound_pct,
            upper_bound_pct=r.upper_bound_pct,
            confidence=r.confidence,
            model_version=r.model_version,
        )
        for r in fc_rows
    ]


# ── Competitor routes (from synced tables) ──


@router.get(
    "/hotels/{hotel_id}/competitors",
    response_model=list[CompetitorPriceRow],
    operation_id="getHotelCompetitors",
)
def get_hotel_competitors(
    hotel_id: str,
    session: Dependencies.Session,
    target_date: str | None = None,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    dt_target = date.fromisoformat(target_date) if target_date else date.today()

    price_map: dict[str, float] = {}
    for rt in session.exec(select(RoomType).where(RoomType.hotel_id == hotel_id)).all():
        pr = session.exec(
            select(RoomPrice.price).where(
                RoomPrice.hotel_id == hotel_id,
                RoomPrice.room_type_name == rt.name,
                RoomPrice.date == dt_target,
            )
        ).first()
        price_map[rt.name] = float(pr) if pr else rt.base_price

    comp_rows = session.exec(
        select(CompetitorPrice).where(
            CompetitorPrice.hotel_id == hotel_id,
            CompetitorPrice.date == dt_target,
        ).order_by(CompetitorPrice.competitor, CompetitorPrice.room_type)
    ).all()

    rows: list[CompetitorPriceRow] = []
    for cr in comp_rows:
        our_price = price_map.get(cr.room_type, 0.0)
        diff = round((cr.competitor_price - our_price) / our_price * 100, 1) if our_price else 0
        rows.append(CompetitorPriceRow(
            competitor_name=cr.competitor, room_type=cr.room_type,
            price=cr.competitor_price, diff_pct=diff,
        ))
    return rows


# ── Web Traffic routes (from synced tables) ──


@router.get(
    "/hotels/{hotel_id}/web-traffic",
    response_model=list[WebTrafficRow],
    operation_id="getHotelWebTraffic",
)
def get_hotel_web_traffic(
    hotel_id: str,
    session: Dependencies.Session,
    start_date: str | None = None,
    end_date: str | None = None,
):
    hotel = session.get(Hotel, hotel_id)
    if not hotel:
        return []

    today = date.today()
    sd = date.fromisoformat(start_date) if start_date else today - timedelta(days=29)
    ed = date.fromisoformat(end_date) if end_date else today

    wt_rows = session.exec(
        select(WebTrafficRecord).where(
            WebTrafficRecord.hotel_id == hotel_id,
            WebTrafficRecord.date >= sd,
            WebTrafficRecord.date <= ed,
        ).order_by(WebTrafficRecord.date)  # ty: ignore[invalid-argument-type]
    ).all()

    return [
        WebTrafficRow(
            date=r.date.isoformat(), searches=r.searches, page_views=r.page_views,
            booking_attempts=r.booking_attempts, bookings_completed=r.bookings_completed,
            conversion_rate=r.conversion_rate,
        )
        for r in wt_rows
    ]


# ── Dashboard routes ──


@router.get("/dashboard/kpis", response_model=DashboardKPIs, operation_id="getDashboardKpis")
def get_dashboard_kpis(session: Dependencies.Session, region: str = ""):
    today = date.today()
    days_into_month = today.day
    prev_month_end = today.replace(day=1) - timedelta(days=1)
    prev_period_start = prev_month_end.replace(day=1)
    prev_period_end = prev_period_start + timedelta(days=min(days_into_month, prev_month_end.day) - 1)

    hotel_stmt = select(Hotel).order_by(Hotel.id)
    if region:
        hotel_stmt = hotel_stmt.where(Hotel.region == region)
    hotel_stmt = hotel_stmt.limit(80)
    sample_hotels = session.exec(hotel_stmt).all()

    count_stmt = select(func.count()).select_from(Hotel)
    if region:
        count_stmt = count_stmt.where(Hotel.region == region)
    total_count: int = session.exec(count_stmt).one()
    scale = float(total_count) / max(1, len(sample_hotels))

    total_rev = 0.0
    prev_rev = 0.0
    total_occ = 0.0
    prev_occ = 0.0
    total_bookings = 0
    occ_count = 0
    prev_occ_count = 0

    for h in sample_hotels:
        room_types_db = session.exec(
            select(RoomType).where(RoomType.hotel_id == h.id)
        ).all()
        for rt in room_types_db:
            current = today.replace(day=1)
            while current <= today:
                occ = _get_occupancy(session, h.id, rt.name, current)
                pr = session.exec(
                    select(RoomPrice.price).where(
                        RoomPrice.hotel_id == h.id,
                        RoomPrice.room_type_name == rt.name,
                        RoomPrice.date == current,
                    )
                ).first()
                price = float(pr) if pr else rt.base_price
                total_rev += price * rt.room_count * occ
                total_occ += occ
                occ_count += 1
                total_bookings += int(rt.room_count * occ)
                current += timedelta(days=1)

            prev_cur = prev_period_start
            while prev_cur <= prev_period_end:
                occ = _get_occupancy(session, h.id, rt.name, prev_cur)
                prev_rev += rt.base_price * rt.room_count * occ
                prev_occ += occ
                prev_occ_count += 1
                prev_cur += timedelta(days=1)

    total_rev *= scale
    prev_rev *= scale
    total_bookings = int(total_bookings * scale)

    avg_occ = total_occ / max(1, occ_count)
    prev_avg_occ = prev_occ / max(1, prev_occ_count)

    adr_val = session.exec(
        select(func.avg(RoomPrice.price)).where(RoomPrice.date == today)
    ).one()
    adr = float(adr_val) if adr_val else 0.0
    revpar = adr * avg_occ

    first_hotel = sample_hotels[0] if sample_hotels else None
    avg_conv = 0.0
    if first_hotel:
        conv_total = 0.0
        for d in range(7):
            wt = _get_web_traffic(session, first_hotel.id, today - timedelta(days=d))
            conv_total += wt["conversion_rate"]
        avg_conv = conv_total / 7

    rev_change = round((total_rev - prev_rev) / max(1, prev_rev) * 100, 1) if prev_rev else 0.0
    occ_change = round((avg_occ - prev_avg_occ) / max(0.01, prev_avg_occ) * 100, 1) if prev_avg_occ else 0.0

    return DashboardKPIs(
        total_revenue_mtd=round(total_rev, 0), avg_occupancy_pct=round(avg_occ * 100, 1),
        revpar=round(revpar, 2), adr=round(adr, 2), total_bookings_mtd=total_bookings,
        avg_website_conversion=round(avg_conv, 2),
        revenue_change_pct=rev_change, occupancy_change_pct=occ_change,
    )


@router.get(
    "/dashboard/revenue-trend",
    response_model=list[RevenueTrendPoint],
    operation_id="getRevenueTrend",
)
def get_revenue_trend(session: Dependencies.Session, days: int = 30, region: str = ""):
    today = date.today()
    hotel_stmt = select(Hotel).order_by(Hotel.id)
    if region:
        hotel_stmt = hotel_stmt.where(Hotel.region == region)
    hotel_stmt = hotel_stmt.limit(50)
    sample = session.exec(hotel_stmt).all()

    count_stmt = select(func.count()).select_from(Hotel)
    if region:
        count_stmt = count_stmt.where(Hotel.region == region)
    total_hotels: int = session.exec(count_stmt).one()
    scale = float(total_hotels) / max(1, len(sample))

    rt_cache: dict[str, list[RoomType]] = {}
    for h in sample:
        rts = session.exec(select(RoomType).where(RoomType.hotel_id == h.id)).all()
        rt_cache[h.id] = list(rts)

    points: list[RevenueTrendPoint] = []
    for d in range(days - 1, -1, -1):
        target = today - timedelta(days=d)
        day_rev = 0.0
        day_rooms = 0
        for h in sample:
            for rt in rt_cache[h.id]:
                occ = _get_occupancy(session, h.id, rt.name, target)
                pr = session.exec(
                    select(RoomPrice.price).where(
                        RoomPrice.hotel_id == h.id,
                        RoomPrice.room_type_name == rt.name,
                        RoomPrice.date == target,
                    )
                ).first()
                price = float(pr) if pr else rt.base_price
                day_rev += price * rt.room_count * occ
                day_rooms += int(rt.room_count * occ)

        points.append(RevenueTrendPoint(
            date=target.isoformat(),
            revenue=round(day_rev * scale, 0),
            rooms_sold=int(day_rooms * scale),
        ))
    return points


@router.get(
    "/dashboard/occupancy-by-region",
    response_model=list[OccupancyByRegion],
    operation_id="getOccupancyByRegion",
)
def get_occupancy_by_region(session: Dependencies.Session):
    today = date.today()
    hotels = session.exec(select(Hotel)).all()

    region_occ: dict[str, float] = defaultdict(float)
    region_count: dict[str, int] = defaultdict(int)
    region_hotels: dict[str, int] = defaultdict(int)
    region_rooms: dict[str, int] = defaultdict(int)

    for h in hotels:
        r = h.region
        region_hotels[r] += 1
        region_rooms[r] += h.total_rooms
        occ = _get_occupancy(session, h.id, "Standard", today)
        region_occ[r] += occ
        region_count[r] += 1

    return [
        OccupancyByRegion(
            region=region,
            avg_occupancy=round(region_occ[region] / max(1, region_count[region]) * 100, 1),
            hotel_count=region_hotels[region],
            total_rooms=region_rooms[region],
        )
        for region in sorted(region_hotels.keys())
    ]


@router.get(
    "/opportunities",
    response_model=list[OpportunityRow],
    operation_id="getOpportunities",
)
def get_opportunities(
    session: Dependencies.Session,
    region: str = "",
    limit: int = 10,
):
    """Top hotels where adjusting price could improve RevPAR and reduce competitor displacement."""
    today = date.today()

    hotel_stmt = select(Hotel).order_by(Hotel.id)
    if region:
        hotel_stmt = hotel_stmt.where(Hotel.region == region)
    hotels = session.exec(hotel_stmt).all()

    opportunities: list[OpportunityRow] = []
    for h in hotels:
        room_types_db = session.exec(
            select(RoomType).where(RoomType.hotel_id == h.id)
        ).all()
        if not room_types_db:
            continue

        total_current_revpar = 0.0
        total_suggested_revpar = 0.0
        total_current_price = 0.0
        total_suggested_price = 0.0
        total_comp_avg = 0.0
        total_occ = 0.0
        total_conf = 0.0
        rt_count = 0
        best_rt_name = ""
        best_rt_uplift = 0.0

        for rt in room_types_db:
            price_row = session.exec(
                select(RoomPrice).where(
                    RoomPrice.hotel_id == h.id,
                    RoomPrice.room_type_name == rt.name,
                    RoomPrice.date == today,
                )
            ).first()
            current_price = price_row.price if price_row else rt.base_price

            occ = _get_occupancy(session, h.id, rt.name, today)
            demand = _get_demand_score(session, h.id, today)
            comp_avg = _get_competitor_avg(session, h.id, rt.name, today)

            dfc = session.exec(
                select(DemandForecast).where(
                    DemandForecast.hotel_id == h.id,
                    DemandForecast.forecast_date == today,
                )
            ).first()
            ofc = session.exec(
                select(OccupancyForecast).where(
                    OccupancyForecast.hotel_id == h.id,
                    OccupancyForecast.room_type == rt.name,
                    OccupancyForecast.forecast_date == today,
                )
            ).first()

            suggestion = suggest_price(
                base_price=rt.base_price,
                current_occupancy=occ,
                forecast_occupancy=ofc.predicted_occupancy_pct if ofc else None,
                demand_score=demand,
                forecast_demand_score=dfc.demand_score if dfc else None,
                competitor_avg=comp_avg,
                room_count=rt.room_count,
                forecast_confidence=ofc.confidence if ofc else None,
            )

            current_revpar = current_price * occ
            rt_uplift = suggestion.expected_revpar - current_revpar

            total_current_revpar += current_revpar
            total_suggested_revpar += suggestion.expected_revpar
            total_current_price += current_price
            total_suggested_price += suggestion.suggested_price
            total_comp_avg += comp_avg
            total_occ += occ
            total_conf += suggestion.confidence
            rt_count += 1

            if rt_uplift > best_rt_uplift:
                best_rt_uplift = rt_uplift
                best_rt_name = rt.name

        if rt_count == 0:
            continue

        avg_current_revpar = total_current_revpar / rt_count
        avg_suggested_revpar = total_suggested_revpar / rt_count
        uplift = avg_suggested_revpar - avg_current_revpar
        uplift_pct = (uplift / max(1, avg_current_revpar)) * 100
        avg_price = total_current_price / rt_count
        avg_sugg = total_suggested_price / rt_count
        avg_comp = total_comp_avg / rt_count
        price_vs_comp = ((avg_price - avg_comp) / max(1, avg_comp)) * 100
        avg_occ = total_occ / rt_count
        avg_conf = total_conf / rt_count

        if price_vs_comp > 10:
            risk = "high"
        elif price_vs_comp > 3:
            risk = "moderate"
        else:
            risk = "low"

        opportunities.append(OpportunityRow(
            hotel_id=h.id,
            hotel_name=h.name,
            city=h.city,
            region=h.region,
            star_rating=h.star_rating,
            current_revpar=round(avg_current_revpar, 2),
            suggested_revpar=round(avg_suggested_revpar, 2),
            revpar_uplift=round(uplift, 2),
            revpar_uplift_pct=round(uplift_pct, 1),
            avg_current_price=round(avg_price, 2),
            avg_suggested_price=round(avg_sugg, 2),
            avg_competitor_price=round(avg_comp, 2),
            price_vs_competitor_pct=round(price_vs_comp, 1),
            occupancy_pct=round(avg_occ * 100, 1),
            displacement_risk=risk,
            confidence=round(avg_conf, 3),
            top_room_type=best_rt_name,
            top_room_uplift=round(best_rt_uplift, 2),
        ))

    opportunities.sort(key=lambda o: o.revpar_uplift, reverse=True)
    return opportunities[:limit]


@router.get(
    "/dashboard/pickup-curve",
    response_model=list[PickupCurvePoint],
    operation_id="getPickupCurve",
)
def get_pickup_curve(
    session: Dependencies.Session,
    region: str = "",
    hotel_id: str = "",
    target_date: str = "",
):
    """Occupancy vs lead-time pickup curve derived from occupancy actuals."""
    max_lead = 30

    if hotel_id and target_date:
        hotel = session.get(Hotel, hotel_id)
        if not hotel:
            return []
        td = date.fromisoformat(target_date)
        final_occ = _get_occupancy(session, hotel.id, "Standard", td)
        points: list[PickupCurvePoint] = []
        for lt in range(max_lead, -1, -1):
            if lt <= 0:
                captured = final_occ
            else:
                t = 1.0 - min(lt, max_lead) / max_lead
                captured = final_occ * (0.15 + 0.85 * (t ** 1.8))
            points.append(PickupCurvePoint(lead_time_days=lt, occupancy_pct=round(captured * 100, 1)))
        return points

    hotel_stmt = select(Hotel).order_by(Hotel.id)
    if region:
        hotel_stmt = hotel_stmt.where(Hotel.region == region)
    hotel_stmt = hotel_stmt.limit(40)
    hotels = session.exec(hotel_stmt).all()
    if not hotels:
        return []

    tomorrow = date.today() + timedelta(days=1)
    td = date.fromisoformat(target_date) if target_date else tomorrow

    lead_sums: dict[int, float] = defaultdict(float)
    for lt in range(max_lead, -1, -1):
        for h in hotels:
            final_occ = _get_occupancy(session, h.id, "Standard", td)
            if lt <= 0:
                captured = final_occ
            else:
                t = 1.0 - min(lt, max_lead) / max_lead
                captured = final_occ * (0.15 + 0.85 * (t ** 1.8))
            lead_sums[lt] += captured
        lead_sums[lt] /= len(hotels)

    return [
        PickupCurvePoint(lead_time_days=lt, occupancy_pct=round(lead_sums[lt] * 100, 1))
        for lt in range(max_lead, -1, -1)
    ]
