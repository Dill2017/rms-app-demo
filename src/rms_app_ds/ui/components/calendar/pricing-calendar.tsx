import { Suspense, useState } from "react";
import { QueryErrorResetBoundary, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CalendarDaySummary,
  RoomDateDetail,
} from "@/lib/api";
import {
  useGetHotelCalendarSuspense,
  useGetRoomDateDetailSuspense,
  useUpdateHotelPricing,
} from "@/lib/api";
import selector from "@/lib/selector";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  BedDouble,
  DollarSign,
  TrendingUp,
  Check,
  Save,
  X,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Building2,
  Minus,
} from "lucide-react";

// ── Date utilities ──

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
}

const DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ── Main Calendar Component ──

interface PricingCalendarProps {
  hotelId: string;
}

export function PricingCalendar({ hotelId }: PricingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [viewMode, setViewMode] = useState<"prices" | "occupancy">("prices");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const prevMonth = () =>
    setCurrentMonth((p) => {
      if (p.month === 0) return { year: p.year - 1, month: 11 };
      return { ...p, month: p.month - 1 };
    });

  const nextMonth = () =>
    setCurrentMonth((p) => {
      if (p.month === 11) return { year: p.year + 1, month: 0 };
      return { ...p, month: p.month + 1 };
    });

  const goToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
  };

  const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentMonth={currentMonth}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onCurrentMonth={goToCurrentMonth}
      />

      <div className={cn("flex gap-6 transition-all duration-300")}>
        <div className={cn("min-w-0 transition-all duration-300", selectedDate ? "w-[58%]" : "w-full")}>
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary }) => (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-destructive">Failed to load calendar data</p>
                      <Button variant="link" onClick={resetErrorBoundary} className="mt-2">
                        Retry
                      </Button>
                    </CardContent>
                  </Card>
                )}
              >
                <Suspense fallback={<CalendarGridSkeleton />}>
                  <CalendarGrid
                    hotelId={hotelId}
                    monthStr={monthStr}
                    currentMonth={currentMonth}
                    viewMode={viewMode}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </div>

        {selectedDate && (
          <div className="w-[42%] min-w-[380px]">
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary
                  onReset={reset}
                  fallbackRender={({ resetErrorBoundary }) => (
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-destructive">Failed to load details</p>
                        <Button variant="link" onClick={resetErrorBoundary}>
                          Retry
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                >
                  <Suspense fallback={<DetailPanelSkeleton />}>
                    <DateDetailPanel
                      hotelId={hotelId}
                      date={selectedDate}
                      onClose={() => setSelectedDate(null)}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar Header ──

function CalendarHeader({
  currentMonth,
  viewMode,
  onViewModeChange,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
}: {
  currentMonth: { year: number; month: number };
  viewMode: "prices" | "occupancy";
  onViewModeChange: (mode: "prices" | "occupancy") => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
}) {
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("en", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">{monthName}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onCurrentMonth}>
            Current Month
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted p-0.5">
          <button
            onClick={() => onViewModeChange("prices")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "prices"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <DollarSign className="h-3.5 w-3.5" />
            Prices
          </button>
          <button
            onClick={() => onViewModeChange("occupancy")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "occupancy"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BedDouble className="h-3.5 w-3.5" />
            Occupancy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar Grid ──

function CalendarGrid({
  hotelId,
  monthStr,
  currentMonth,
  viewMode,
  selectedDate,
  onSelectDate,
}: {
  hotelId: string;
  monthStr: string;
  currentMonth: { year: number; month: number };
  viewMode: "prices" | "occupancy";
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const { data: calendarData } = useGetHotelCalendarSuspense({
    params: { hotel_id: hotelId, month: monthStr },
    ...selector(),
  });

  const dayMap = new Map(calendarData.map((d: CalendarDaySummary) => [d.date, d]));
  const daysInMonth = getDaysInMonth(currentMonth.year, currentMonth.month);
  const firstDayOffset = getFirstDayOfWeek(currentMonth.year, currentMonth.month);

  const avgOcc =
    calendarData.length > 0
      ? Math.round(calendarData.reduce((s: number, d: CalendarDaySummary) => s + d.occupancy_pct, 0) / calendarData.length)
      : 0;

  return (
    <Card>
      <CardContent className="p-4">
        {viewMode === "occupancy" && (
          <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{avgOcc}%</strong> Occupancy
            </span>
            <span className="text-muted-foreground">|</span>
            <div className="flex items-center gap-4 ml-auto">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                Not Enough Bookings
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                Too Many Bookings
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b pb-2 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`pad-${i}`} className="border-b border-r border-transparent min-h-[90px]" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(currentMonth.year, currentMonth.month, day);
            const data = dayMap.get(dateStr);

            return (
              <CalendarCell
                key={dateStr}
                date={dateStr}
                day={day}
                data={data}
                viewMode={viewMode}
                isSelected={selectedDate === dateStr}
                isWeekendDay={isWeekend(currentMonth.year, currentMonth.month, day)}
                onClick={() => onSelectDate(dateStr)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Calendar Cell ──

function CalendarCell({
  date,
  day,
  data,
  viewMode,
  isSelected,
  isWeekendDay,
  onClick,
}: {
  date: string;
  day: number;
  data: CalendarDaySummary | undefined;
  viewMode: "prices" | "occupancy";
  isSelected: boolean;
  isWeekendDay: boolean;
  onClick: () => void;
}) {
  const today = isToday(date);

  const occPct = data?.occupancy_pct ?? 0;
  const bgColor = getOccupancyBackground(occPct, data?.booking_status, viewMode);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start p-2 min-h-[90px] border-b border-r text-left transition-all hover:bg-accent/50 cursor-pointer",
        isSelected && "ring-2 ring-primary ring-inset bg-primary/5",
        today && "border-primary/50",
        bgColor,
      )}
    >
      <div className="flex items-center justify-between w-full mb-1">
        <span
          className={cn(
            "text-xs font-medium",
            today && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center",
            isWeekendDay && !today && "text-red-500",
          )}
        >
          {day}
        </span>
        {data?.event_name && (
          <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">{data.event_name}</span>
        )}
      </div>

      {data && viewMode === "prices" && (
        <div className="flex flex-col gap-0.5 mt-auto w-full">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold">${data.avg_price}</span>
            {data.avg_suggested_price !== data.avg_price && (
              <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                ${data.avg_suggested_price}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between w-full">
            <OccupancyIndicator pct={occPct} size="sm" />
          </div>
        </div>
      )}

      {data && viewMode === "occupancy" && (
        <div className="flex flex-col gap-0.5 mt-auto w-full">
          {data.pickup_rooms > 0 && (
            <span className="text-[10px] text-muted-foreground">{data.pickup_rooms} Pickup</span>
          )}
          {data.pickup_rooms === 0 && (
            <span className="text-[10px] text-muted-foreground">0 Pickup</span>
          )}
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium">${data.avg_price}</span>
            <OccupancyIndicator pct={occPct} size="sm" />
          </div>
        </div>
      )}
    </button>
  );
}

function OccupancyIndicator({ pct, size = "sm" }: { pct: number; size?: "sm" | "lg" }) {
  const color =
    pct >= 85
      ? "text-red-500"
      : pct >= 70
        ? "text-violet-600 dark:text-violet-400"
        : pct >= 50
          ? "text-amber-500"
          : pct >= 30
            ? "text-emerald-500"
            : "text-red-400";

  return (
    <span className={cn("font-bold", color, size === "sm" ? "text-[11px]" : "text-sm")}>
      {pct}%
    </span>
  );
}

function getOccupancyBackground(
  pct: number,
  status: string | undefined,
  viewMode: "prices" | "occupancy",
): string {
  if (viewMode !== "occupancy") return "";
  if (status === "high" || pct >= 85) return "bg-violet-100/60 dark:bg-violet-950/30";
  if (status === "low" || pct < 35) return "bg-red-50/60 dark:bg-red-950/20";
  if (pct >= 70) return "bg-violet-50/40 dark:bg-violet-950/15";
  return "";
}

// ── Date Detail Panel ──

function DateDetailPanel({
  hotelId,
  date,
  onClose,
}: {
  hotelId: string;
  date: string;
  onClose: () => void;
}) {
  const { data: roomDetails } = useGetRoomDateDetailSuspense({
    params: { hotel_id: hotelId, target_date: date },
    ...selector(),
  });

  const [selectedRoomType, setSelectedRoomType] = useState<string>(
    roomDetails[0]?.room_type ?? "",
  );
  const [activeTab, setActiveTab] = useState<"overview" | "edit" | "all">("overview");

  const selectedRoom = roomDetails.find((r: RoomDateDetail) => r.room_type === selectedRoomType);

  const totalRoomsSold = roomDetails.reduce((s: number, r: RoomDateDetail) => s + r.rooms_sold, 0);
  const totalRooms = roomDetails.reduce((s: number, r: RoomDateDetail) => s + r.room_count, 0);
  const propertyOccPct = totalRooms > 0 ? Math.round((totalRoomsSold / totalRooms) * 100) : 0;
  const roomsLeft = totalRooms - totalRoomsSold;

  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">{formatDisplayDate(date)}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-0.5 mt-3">
          {(["overview", "edit", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {tab === "overview" ? "Overview" : tab === "edit" ? "Edit Prices" : "All Room Types"}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select room type" />
          </SelectTrigger>
          <SelectContent>
            {roomDetails.map((r: RoomDateDetail) => (
              <SelectItem key={r.room_type} value={r.room_type}>
                {r.room_type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeTab === "overview" && selectedRoom && (
          <OverviewTab
            room={selectedRoom}
            propertyOccPct={propertyOccPct}
            roomsLeft={roomsLeft}
            hotelId={hotelId}
            date={date}
          />
        )}

        {activeTab === "edit" && selectedRoom && (
          <EditPricesTab room={selectedRoom} hotelId={hotelId} date={date} />
        )}

        {activeTab === "all" && <AllRoomTypesTab roomDetails={roomDetails} />}
      </CardContent>
    </Card>
  );
}

// ── Overview Tab ──

function OverviewTab({
  room,
  propertyOccPct,
  roomsLeft,
  hotelId,
  date,
}: {
  room: RoomDateDetail;
  propertyOccPct: number;
  roomsLeft: number;
  hotelId: string;
  date: string;
}) {
  const queryClient = useQueryClient();

  const { mutate: submitDecision, isPending } = useUpdateHotelPricing({
    mutation: {
      onSuccess: (result) => {
        const action = result.data.decision === "accepted" ? "Accepted" : "Set manually";
        toast.success(`${action}: ${result.data.room_type} on ${result.data.date} → $${result.data.new_price}`);
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}/pricing"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}/room-date-detail"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}/calendar"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}"] });
      },
      onError: () => toast.error("Failed to update price"),
    },
  });

  const handleAccept = () => {
    submitDecision({
      params: { hotel_id: hotelId },
      data: {
        room_type: room.room_type,
        date,
        suggested_price: room.suggested_price,
        accepted_price: room.suggested_price,
        decision: "accepted",
        expected_revpar: room.expected_revpar,
      },
    });
  };

  const priceDiff = room.suggested_price - room.current_price;
  const alreadyMatches = Math.abs(priceDiff) < 0.01;

  return (
    <div className="space-y-4">
      {/* Recommended Price */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
        <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">${room.suggested_price.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Recommended Price</p>
        </div>
      </div>

      {/* Price Breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between py-1">
          <span className="text-muted-foreground">Base Price (adj. for inflation)</span>
          <span className="font-medium">${room.base_price.toFixed(0)}</span>
        </div>

        <PriceFactorRow label="Market Factor" pct={room.market_factor_pct} basePrice={room.base_price} />
        <PriceFactorRow
          label="Occupancy/Pickup Factor"
          pct={room.occupancy_factor_pct}
          basePrice={room.base_price}
        />

        {room.adjustment_pct !== 0 && (
          <PriceFactorRow label="Your Adjustments" pct={room.adjustment_pct} basePrice={room.suggested_price} />
        )}
        {room.adjustment_pct === 0 && (
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1">
              Your Adjustments
              <ArrowRight className="h-3 w-3" />
            </span>
            <span className="text-muted-foreground">—</span>
          </div>
        )}

        <div className="border-t pt-2 mt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Price in Channel Manager</span>
            <span className="font-medium">${room.current_price.toFixed(0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Price Yesterday</span>
            <span className="font-medium">
              {room.price_yesterday != null ? `$${room.price_yesterday.toFixed(0)}` : "n.A"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Price 7 Days Ago</span>
            <span className="font-medium">
              {room.price_7_days_ago != null ? `$${room.price_7_days_ago.toFixed(0)}` : "n.A"}
            </span>
          </div>
        </div>
      </div>

      {/* Property Summary */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Property</p>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <Building2 className="h-4 w-4 text-primary mb-1" />
            <span className="text-lg font-bold">{propertyOccPct}%</span>
            <span className="text-[10px] text-muted-foreground">Occupancy</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <span className="text-lg font-bold">{roomsLeft}</span>
            <span className="text-[10px] text-muted-foreground">Rooms Left</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <span className="text-lg font-bold">0</span>
            <span className="text-[10px] text-muted-foreground">Rooms Closed</span>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Events</p>
        <p className="text-sm text-muted-foreground">No Events</p>
      </div>

      {/* Notes */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
        <textarea
          placeholder="Add a note"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        {alreadyMatches ? (
          <Badge className="bg-emerald-500/10 text-emerald-600 text-xs py-1 px-3">
            <Check className="h-3 w-3 mr-1" />
            Price Applied
          </Badge>
        ) : (
          <Button onClick={handleAccept} disabled={isPending} className="flex-1 bg-violet-600 hover:bg-violet-700">
            Upload Prices
          </Button>
        )}
      </div>
    </div>
  );
}

function PriceFactorRow({
  label,
  pct,
  basePrice,
}: {
  label: string;
  pct: number;
  basePrice: number;
}) {
  const isUp = pct > 0;
  const absoluteValue = Math.abs(Math.round(basePrice * (pct / 100)));
  const Icon = isUp ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const color = isUp ? "text-emerald-600" : pct < 0 ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("flex items-center gap-1 font-medium", color)}>
        <Icon className="h-3 w-3" />
        {pct > 0 ? "+" : ""}
        {pct.toFixed(0)}% {absoluteValue > 0 && `$${absoluteValue}`}
      </span>
    </div>
  );
}

// ── Edit Prices Tab ──

function EditPricesTab({
  room,
  hotelId,
  date,
}: {
  room: RoomDateDetail;
  hotelId: string;
  date: string;
}) {
  const queryClient = useQueryClient();
  const [overrideValue, setOverrideValue] = useState(room.current_price.toString());

  const { mutate: submitDecision, isPending } = useUpdateHotelPricing({
    mutation: {
      onSuccess: (result) => {
        toast.success(`Price updated: ${result.data.room_type} → $${result.data.new_price}`);
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}/pricing"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}/room-date-detail"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}/calendar"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hotels/{hotel_id}"] });
      },
      onError: () => toast.error("Failed to update price"),
    },
  });

  const handleAccept = () => {
    submitDecision({
      params: { hotel_id: hotelId },
      data: {
        room_type: room.room_type,
        date,
        suggested_price: room.suggested_price,
        accepted_price: room.suggested_price,
        decision: "accepted",
        expected_revpar: room.expected_revpar,
      },
    });
  };

  const handleOverride = () => {
    const price = parseFloat(overrideValue);
    if (isNaN(price) || price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    submitDecision({
      params: { hotel_id: hotelId },
      data: {
        room_type: room.room_type,
        date,
        suggested_price: room.suggested_price,
        accepted_price: price,
        decision: "manual_override",
        expected_revpar: room.expected_revpar,
      },
    });
  };

  const alreadyMatches = Math.abs(room.current_price - room.suggested_price) < 0.01;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="text-xs text-muted-foreground">Current Price</p>
            <p className="text-xl font-bold">${room.current_price.toFixed(2)}</p>
          </div>
          <SourceBadge source={room.price_source} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
          <div>
            <p className="text-xs text-muted-foreground">Suggested Price</p>
            <p className="text-xl font-bold text-violet-600 dark:text-violet-400">
              ${room.suggested_price.toFixed(2)}
            </p>
          </div>
          {!alreadyMatches && (
            <Button size="sm" onClick={handleAccept} disabled={isPending}>
              <Check className="h-3.5 w-3.5 mr-1" />
              Accept
            </Button>
          )}
          {alreadyMatches && (
            <Badge className="bg-emerald-500/10 text-emerald-600 text-xs">
              <Check className="h-3 w-3 mr-0.5" />
              Applied
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Override Price</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={overrideValue}
            onChange={(e) => setOverrideValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleOverride();
            }}
            className="flex-1"
            placeholder="Enter price..."
          />
          <Button onClick={handleOverride} disabled={isPending} variant="outline">
            <Save className="h-3.5 w-3.5 mr-1" />
            Set
          </Button>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">Pricing Metrics</p>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Expected RevPAR" value={`$${room.expected_revpar.toFixed(0)}`} />
          <MetricCard label="Expected Occupancy" value={`${room.expected_occupancy.toFixed(0)}%`} />
          <MetricCard label="Competitor Avg" value={`$${room.competitor_avg.toFixed(0)}`} />
          <MetricCard label="Confidence" value={`${(room.suggestion_confidence * 100).toFixed(0)}%`} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-md border text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "suggestion")
    return <Badge className="bg-emerald-500/10 text-emerald-600 text-xs">via suggestion</Badge>;
  if (source === "manual")
    return <Badge className="bg-amber-500/10 text-amber-600 text-xs">manual</Badge>;
  return <Badge variant="secondary" className="text-xs">system</Badge>;
}

// ── All Room Types Tab ──

function AllRoomTypesTab({ roomDetails }: { roomDetails: RoomDateDetail[] }) {
  return (
    <div className="space-y-2">
      {roomDetails.map((r: RoomDateDetail) => {
        const priceDiff = r.suggested_price - r.current_price;
        const priceDiffPct = r.current_price > 0 ? (priceDiff / r.current_price) * 100 : 0;

        return (
          <div
            key={r.room_type}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.room_type}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{r.rooms_sold}/{r.room_count} rooms</span>
                <span>&middot;</span>
                <OccupancyIndicator pct={r.occupancy_pct} size="sm" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">${r.current_price.toFixed(0)}</p>
              {Math.abs(priceDiff) > 0.01 && (
                <span
                  className={cn(
                    "text-[10px] flex items-center justify-end gap-0.5",
                    priceDiff > 0 ? "text-amber-600" : "text-blue-600",
                  )}
                >
                  {priceDiff > 0 ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                  {priceDiffPct > 0 ? "+" : ""}
                  {priceDiffPct.toFixed(1)}% → ${r.suggested_price.toFixed(0)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Skeletons ──

function CalendarGridSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-[90px]" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailPanelSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  );
}
