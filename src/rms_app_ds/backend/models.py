from __future__ import annotations

import datetime as dt

from pydantic import BaseModel
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from .. import __version__


# ── Schema names ──

SYNCED_SCHEMA = "hotel_rms"  # read-only tables synced from Unity Catalog
APP_SCHEMA = "rms_app"       # writable tables managed by the application


# ── Read-only synced tables (populated by UC → Lakebase synced tables) ──


class Hotel(SQLModel, table=True):
    __tablename__ = "hotel"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    id: str = Field(primary_key=True)
    name: str
    city: str
    country: str
    region: str
    star_rating: int
    total_rooms: int
    price_factor: float = 1.0


class RoomType(SQLModel, table=True):
    __tablename__ = "room_type"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    hotel_id: str = Field(primary_key=True)
    name: str = Field(primary_key=True)
    base_price: float
    max_occupancy: int
    room_count: int


class RoomPriceBase(SQLModel, table=True):
    __tablename__ = "room_price_base"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    hotel_id: str = Field(primary_key=True)
    room_type_name: str = Field(primary_key=True)
    date: dt.date = Field(primary_key=True)
    price: float


class DemandForecast(SQLModel, table=True):
    __tablename__ = "demand_forecast"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    hotel_id: str = Field(primary_key=True)
    forecast_date: dt.date = Field(primary_key=True, index=True)
    lead_time_days: int
    demand_score: float
    demand_level: str
    expected_searches: int
    expected_booking_attempts: int
    expected_bookings: int
    confidence: float
    model_version: str
    forecast_generated_at: dt.datetime


class OccupancyForecast(SQLModel, table=True):
    __tablename__ = "occupancy_forecast"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    hotel_id: str = Field(primary_key=True)
    room_type: str = Field(primary_key=True)
    forecast_date: dt.date = Field(primary_key=True, index=True)
    lead_time_days: int
    predicted_occupancy_pct: float
    predicted_rooms_sold: int
    total_rooms: int
    lower_bound_pct: float
    upper_bound_pct: float
    confidence: float
    model_version: str
    forecast_generated_at: dt.datetime


class OccupancyActual(SQLModel, table=True):
    __tablename__ = "occupancy_actuals"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    hotel_id: str = Field(primary_key=True)
    room_type: str = Field(primary_key=True)
    date: dt.date = Field(primary_key=True, index=True)
    occupancy_pct: float
    room_count: int
    rooms_sold: int
    star_rating: int


class CompetitorPrice(SQLModel, table=True):
    __tablename__ = "competitor_price"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    hotel_id: str = Field(primary_key=True)
    room_type: str = Field(primary_key=True)
    competitor: str = Field(primary_key=True)
    date: dt.date = Field(primary_key=True, index=True)
    competitor_price: float
    our_price: float


class WebTrafficRecord(SQLModel, table=True):
    __tablename__ = "web_traffic"
    __table_args__ = {"schema": SYNCED_SCHEMA}

    hotel_id: str = Field(primary_key=True)
    date: dt.date = Field(primary_key=True, index=True)
    searches: int
    page_views: int
    booking_attempts: int
    bookings_completed: int
    conversion_rate: float


# ── Writable app tables (managed by the application) ──


class RoomPrice(SQLModel, table=True):
    __tablename__ = "room_price"
    __table_args__ = (
        UniqueConstraint("hotel_id", "room_type_name", "date", name="uq_room_price"),
        {"schema": APP_SCHEMA},
    )

    id: int | None = Field(default=None, primary_key=True)
    hotel_id: str = Field(index=True)
    room_type_name: str
    date: dt.date = Field(index=True)
    price: float
    price_source: str = Field(default="system")
    updated_at: dt.datetime | None = Field(default=None)


class PricingDecision(SQLModel, table=True):
    __tablename__ = "pricing_decision"
    __table_args__ = {"schema": APP_SCHEMA}

    id: int | None = Field(default=None, primary_key=True)
    hotel_id: str = Field(index=True)
    room_type_name: str
    date: dt.date
    suggested_price: float
    accepted_price: float
    decision: str  # "accepted" | "manual_override"
    expected_revpar: float
    decided_at: dt.datetime


# ── Pydantic API response models ──


class VersionOut(BaseModel):
    version: str

    @classmethod
    def from_metadata(cls):
        return cls(version=__version__)


class HotelSummary(BaseModel):
    hotel_id: str
    name: str
    city: str
    country: str
    region: str
    star_rating: int
    total_rooms: int
    occupancy_pct: float
    adr: float
    revpar: float


class HotelListOut(BaseModel):
    hotels: list[HotelSummary]
    total: int
    page: int
    page_size: int


class RoomTypeInfo(BaseModel):
    name: str
    base_price: float
    max_occupancy: int
    room_count: int


class HotelDetail(BaseModel):
    hotel_id: str
    name: str
    city: str
    country: str
    region: str
    star_rating: int
    total_rooms: int
    room_types: list[RoomTypeInfo]
    occupancy_pct: float
    adr: float
    revpar: float
    revenue_mtd: float


class RoomPricingRow(BaseModel):
    date: str
    room_type: str
    current_price: float
    base_price: float
    competitor_avg: float
    occupancy_pct: float
    demand_score: float
    suggested_price: float
    expected_revpar: float
    expected_occupancy: float
    price_vs_competitor_pct: float
    suggestion_confidence: float
    price_source: str
    forecast_demand_score: float | None = None
    forecast_demand_level: str | None = None
    forecast_occupancy_pct: float | None = None
    forecast_occupancy_lower: float | None = None
    forecast_occupancy_upper: float | None = None
    forecast_confidence: float | None = None


class PricingDecisionIn(BaseModel):
    room_type: str
    date: str
    suggested_price: float
    accepted_price: float
    decision: str
    expected_revpar: float


class PricingDecisionOut(BaseModel):
    success: bool
    hotel_id: str
    room_type: str
    date: str
    old_price: float
    new_price: float
    decision: str
    expected_revpar: float


class OccupancyRow(BaseModel):
    date: str
    room_type: str
    total_rooms: int
    rooms_sold: int
    occupancy_pct: float


class CompetitorPriceRow(BaseModel):
    competitor_name: str
    room_type: str
    price: float
    diff_pct: float


class WebTrafficRow(BaseModel):
    date: str
    searches: int
    page_views: int
    booking_attempts: int
    bookings_completed: int
    conversion_rate: float


class DashboardKPIs(BaseModel):
    total_revenue_mtd: float
    avg_occupancy_pct: float
    revpar: float
    adr: float
    total_bookings_mtd: int
    avg_website_conversion: float
    revenue_change_pct: float
    occupancy_change_pct: float


class RevenueTrendPoint(BaseModel):
    date: str
    revenue: float
    rooms_sold: int


class OccupancyByRegion(BaseModel):
    region: str
    avg_occupancy: float
    hotel_count: int
    total_rooms: int


class PickupCurvePoint(BaseModel):
    lead_time_days: int
    occupancy_pct: float


class DemandForecastRow(BaseModel):
    forecast_date: str
    lead_time_days: int
    demand_score: float
    demand_level: str
    expected_searches: int
    expected_booking_attempts: int
    expected_bookings: int
    confidence: float
    model_version: str


class OccupancyForecastRow(BaseModel):
    forecast_date: str
    room_type: str
    lead_time_days: int
    predicted_occupancy_pct: float
    predicted_rooms_sold: int
    total_rooms: int
    lower_bound_pct: float
    upper_bound_pct: float
    confidence: float
    model_version: str


class CalendarDaySummary(BaseModel):
    date: str
    avg_price: float
    avg_suggested_price: float
    occupancy_pct: float
    pickup_rooms: int
    total_rooms: int
    rooms_sold: int
    rooms_left: int
    booking_status: str
    event_name: str | None = None


class RoomDateDetail(BaseModel):
    room_type: str
    current_price: float
    suggested_price: float
    base_price: float
    price_yesterday: float | None = None
    price_7_days_ago: float | None = None
    competitor_avg: float
    occupancy_pct: float
    demand_score: float
    expected_revpar: float
    expected_occupancy: float
    price_vs_competitor_pct: float
    suggestion_confidence: float
    price_source: str
    room_count: int
    rooms_sold: int
    rooms_left: int
    market_factor_pct: float
    occupancy_factor_pct: float
    adjustment_pct: float


class OpportunityRow(BaseModel):
    hotel_id: str
    hotel_name: str
    city: str
    region: str
    star_rating: int
    current_revpar: float
    suggested_revpar: float
    revpar_uplift: float
    revpar_uplift_pct: float
    avg_current_price: float
    avg_suggested_price: float
    avg_competitor_price: float
    price_vs_competitor_pct: float
    occupancy_pct: float
    displacement_risk: str
    confidence: float
    top_room_type: str
    top_room_uplift: float


# ── Genie models ──


class GenieAskIn(BaseModel):
    question: str
    conversation_id: str | None = None


class GenieQueryResult(BaseModel):
    columns: list[str]
    data: list[list[str | float | int | None]]
    row_count: int


class GenieAskOut(BaseModel):
    conversation_id: str
    message_id: str
    status: str
    text: str | None = None
    sql: str | None = None
    query_result: GenieQueryResult | None = None
    suggested_questions: list[str] | None = None
    error: str | None = None
