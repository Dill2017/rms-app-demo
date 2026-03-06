import { Suspense, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type {
  CompetitorPriceRow,
  WebTrafficRow,
  DemandForecastRow,
  OccupancyForecastRow,
} from "@/lib/api";
import {
  useGetHotelSuspense,
  useGetHotelCompetitorsSuspense,
  useGetHotelWebTrafficSuspense,
  useGetHotelDemandForecastSuspense,
  useGetHotelOccupancyForecastSuspense,
} from "@/lib/api";
import selector from "@/lib/selector";
import {
  ArrowLeft,
  Star,
  MapPin,
  BedDouble,
  DollarSign,
  BarChart3,
  TrendingUp,
  Brain,
  Target,
} from "lucide-react";
import { PricingCalendar } from "@/components/calendar/pricing-calendar";

export const Route = createFileRoute("/hotels/$hotelId")({
  component: HotelDetailPage,
});

function HotelDetailPage() {
  const { hotelId } = Route.useParams();

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <Link
        to="/hotels"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Hotels
      </Link>

      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ resetErrorBoundary }) => (
              <Card>
                <CardContent className="p-6">
                  <p className="text-destructive">
                    Failed to load hotel details
                  </p>
                  <button
                    onClick={resetErrorBoundary}
                    className="mt-2 text-sm underline"
                  >
                    Try again
                  </button>
                </CardContent>
              </Card>
            )}
          >
            <Suspense fallback={<HotelDetailSkeleton />}>
              <HotelDetailContent hotelId={hotelId} />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  );
}

function HotelDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40" />
      <Skeleton className="h-10 w-96" />
      <Skeleton className="h-96" />
    </div>
  );
}

function HotelDetailContent({ hotelId }: { hotelId: string }) {
  const { data: hotel } = useGetHotelSuspense({
    params: { hotel_id: hotelId },
    ...selector(),
  });

  return (
    <div className="space-y-6">
      {/* Hotel Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{hotel.name}</h1>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: hotel.star_rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {hotel.city}, {hotel.country} &middot; {hotel.region}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm py-1">
                <BedDouble className="h-3.5 w-3.5 mr-1" />
                {hotel.total_rooms} rooms
              </Badge>
              <Badge variant="outline" className="text-sm py-1">
                {hotel.room_types.length} room types
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <KpiMini
              icon={BedDouble}
              label="Occupancy"
              value={`${hotel.occupancy_pct}%`}
            />
            <KpiMini
              icon={DollarSign}
              label="ADR"
              value={`$${hotel.adr.toFixed(0)}`}
            />
            <KpiMini
              icon={BarChart3}
              label="RevPAR"
              value={`$${hotel.revpar.toFixed(0)}`}
            />
            <KpiMini
              icon={TrendingUp}
              label="Revenue MTD"
              value={`$${(hotel.revenue_mtd / 1000).toFixed(0)}K`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Calendar View — Primary */}
      <PricingCalendar hotelId={hotelId} />

      {/* Additional Tabs */}
      <Tabs defaultValue="forecasts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="traffic">Web Traffic</TabsTrigger>
        </TabsList>

        <TabsContent value="forecasts">
          <ErrorWrapper>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <ForecastsTab hotelId={hotelId} />
            </Suspense>
          </ErrorWrapper>
        </TabsContent>

        <TabsContent value="competitors">
          <ErrorWrapper>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <CompetitorsTab hotelId={hotelId} />
            </Suspense>
          </ErrorWrapper>
        </TabsContent>

        <TabsContent value="traffic">
          <ErrorWrapper>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <WebTrafficTab hotelId={hotelId} />
            </Suspense>
          </ErrorWrapper>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ErrorWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <Card>
              <CardContent className="p-6">
                <p className="text-destructive">Error loading data</p>
                <button
                  onClick={resetErrorBoundary}
                  className="text-sm underline"
                >
                  Retry
                </button>
              </CardContent>
            </Card>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function KpiMini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function DemandBadge({ score }: { score: number }) {
  if (score >= 75)
    return (
      <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] px-1.5 py-0">
        High {score.toFixed(0)}
      </Badge>
    );
  if (score >= 50)
    return (
      <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[10px] px-1.5 py-0">
        Med {score.toFixed(0)}
      </Badge>
    );
  return (
    <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] px-1.5 py-0">
      Low {score.toFixed(0)}
    </Badge>
  );
}

// ── Forecasts Tab ──

function ForecastsTab({ hotelId }: { hotelId: string }) {
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("all");

  const { data: demandForecast } = useGetHotelDemandForecastSuspense({
    params: { hotel_id: hotelId },
    ...selector(),
  });

  const { data: occForecast } = useGetHotelOccupancyForecastSuspense({
    params: {
      hotel_id: hotelId,
      room_type: roomTypeFilter === "all" ? undefined : roomTypeFilter,
    },
    ...selector(),
  });

  const roomTypes = [
    ...new Set(occForecast.map((r: OccupancyForecastRow) => r.room_type)),
  ];

  const dailyOccAgg = occForecast.reduce(
    (
      acc: Record<
        string,
        {
          date: string;
          predicted: number;
          lower: number;
          upper: number;
          count: number;
        }
      >,
      row: OccupancyForecastRow
    ) => {
      if (!acc[row.forecast_date])
        acc[row.forecast_date] = {
          date: row.forecast_date,
          predicted: 0,
          lower: 0,
          upper: 0,
          count: 0,
        };
      acc[row.forecast_date].predicted += row.predicted_occupancy_pct;
      acc[row.forecast_date].lower += row.lower_bound_pct;
      acc[row.forecast_date].upper += row.upper_bound_pct;
      acc[row.forecast_date].count += 1;
      return acc;
    },
    {}
  );

  const occChartData = Object.values(dailyOccAgg).map((d) => ({
    date: d.date,
    predicted: Math.round(d.predicted / d.count),
    lower: Math.round(d.lower / d.count),
    upper: Math.round(d.upper / d.count),
  }));

  const avgDemand =
    demandForecast.length > 0
      ? demandForecast.reduce(
          (s: number, r: DemandForecastRow) => s + r.demand_score,
          0
        ) / demandForecast.length
      : 0;

  const avgOcc =
    occChartData.length > 0
      ? occChartData.reduce(
          (s: number, r: { predicted: number }) => s + r.predicted,
          0
        ) / occChartData.length
      : 0;

  const avgConf =
    demandForecast.length > 0
      ? demandForecast.reduce(
          (s: number, r: DemandForecastRow) => s + r.confidence,
          0
        ) / demandForecast.length
      : 0;

  const totalBookings = demandForecast.reduce(
    (s: number, r: DemandForecastRow) => s + r.expected_bookings,
    0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Avg Demand Score
              </p>
            </div>
            <p className="text-2xl font-bold mt-1">{avgDemand.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">30-day average</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Avg Forecast Occupancy
              </p>
            </div>
            <p className="text-2xl font-bold mt-1">{avgOcc.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Predicted average</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Model Confidence
              </p>
            </div>
            <p className="text-2xl font-bold mt-1">
              {(avgConf * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {demandForecast[0]?.model_version ?? "–"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Expected Bookings
              </p>
            </div>
            <p className="text-2xl font-bold mt-1">
              {totalBookings.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">30-day total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Demand Forecast</CardTitle>
          <CardDescription>
            30-day forward demand score from ML pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              demand_score: {
                label: "Demand Score",
                color: "var(--chart-1)",
              },
              expected_bookings: {
                label: "Expected Bookings",
                color: "var(--chart-2)",
              },
            }}
            className="h-64 w-full"
          >
            <AreaChart data={demandForecast}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
              />
              <XAxis
                dataKey="forecast_date"
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })
                }
                className="text-xs"
              />
              <YAxis domain={[0, 100]} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="demand_score"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {demandForecast.slice(0, 8).map((r: DemandForecastRow) => (
              <div
                key={r.forecast_date}
                className="p-2 rounded-md border text-center"
              >
                <p className="text-xs text-muted-foreground">
                  {new Date(r.forecast_date).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <DemandBadge score={r.demand_score} />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {r.expected_bookings} bookings
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Occupancy Forecast</CardTitle>
              <CardDescription>
                Predicted occupancy with confidence bands
              </CardDescription>
            </div>
            <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Room Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Room Types</SelectItem>
                {roomTypes.map((rt: string) => (
                  <SelectItem key={rt} value={rt}>
                    {rt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              predicted: {
                label: "Predicted %",
                color: "var(--chart-3)",
              },
              lower: {
                label: "Lower Bound",
                color: "var(--chart-3)",
              },
              upper: {
                label: "Upper Bound",
                color: "var(--chart-3)",
              },
            }}
            className="h-72 w-full"
          >
            <AreaChart data={occChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })
                }
                className="text-xs"
              />
              <YAxis domain={[0, 100]} className="text-xs" />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(v) => `${v}%`} />
                }
              />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="transparent"
                fill="var(--chart-3)"
                fillOpacity={0.08}
                strokeWidth={0}
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="transparent"
                fill="var(--background)"
                fillOpacity={1}
                strokeWidth={0}
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="var(--chart-3)"
                fill="var(--chart-3)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>

          <div className="mt-6">
            <h4 className="font-medium mb-3">By Room Type (Next 7 Days)</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead className="text-right">
                      Predicted Occ.
                    </TableHead>
                    <TableHead className="text-right">Range</TableHead>
                    <TableHead className="text-right">Rooms Sold</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occForecast
                    .filter(
                      (r: OccupancyForecastRow) => r.lead_time_days < 7
                    )
                    .map((r: OccupancyForecastRow) => (
                      <TableRow
                        key={`${r.forecast_date}:${r.room_type}`}
                      >
                        <TableCell className="font-mono text-sm">
                          {new Date(r.forecast_date).toLocaleDateString(
                            "en",
                            { month: "short", day: "numeric", weekday: "short" }
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.room_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              r.predicted_occupancy_pct > 85
                                ? "text-red-500 font-medium"
                                : r.predicted_occupancy_pct > 70
                                  ? "text-amber-500"
                                  : ""
                            }
                          >
                            {r.predicted_occupancy_pct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {r.lower_bound_pct}–{r.upper_bound_pct}%
                        </TableCell>
                        <TableCell className="text-right">
                          {r.predicted_rooms_sold}/{r.total_rooms}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            {(r.confidence * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Competitors Tab ──

function CompetitorsTab({ hotelId }: { hotelId: string }) {
  const { data: competitors } = useGetHotelCompetitorsSuspense({
    params: { hotel_id: hotelId },
    ...selector(),
  });

  const byCompetitor = competitors.reduce(
    (acc: Record<string, CompetitorPriceRow[]>, row: CompetitorPriceRow) => {
      if (!acc[row.competitor_name]) acc[row.competitor_name] = [];
      acc[row.competitor_name].push(row);
      return acc;
    },
    {}
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitor Pricing</CardTitle>
        <CardDescription>
          Today&apos;s pricing comparison with competing hotels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {Object.entries(byCompetitor).map(([name, rows]) => (
            <div key={name}>
              <h4 className="font-medium mb-2">{name}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Type</TableHead>
                    <TableHead className="text-right">Their Price</TableHead>
                    <TableHead className="text-right">Diff %</TableHead>
                    <TableHead className="text-right">Position</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r: CompetitorPriceRow) => (
                    <TableRow key={`${name}-${r.room_type}`}>
                      <TableCell>{r.room_type}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${r.price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            r.diff_pct > 5
                              ? "text-emerald-500"
                              : r.diff_pct < -5
                                ? "text-red-500"
                                : "text-muted-foreground"
                          }
                        >
                          {r.diff_pct > 0 ? "+" : ""}
                          {r.diff_pct.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.diff_pct > 5 ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500">
                            Cheaper
                          </Badge>
                        ) : r.diff_pct < -5 ? (
                          <Badge className="bg-red-500/10 text-red-500">
                            Pricier
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Aligned</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Web Traffic Tab ──

function WebTrafficTab({ hotelId }: { hotelId: string }) {
  const { data: traffic } = useGetHotelWebTrafficSuspense({
    params: { hotel_id: hotelId },
    ...selector(),
  });

  const totals = traffic.reduce(
    (acc: { searches: number; views: number; attempts: number; bookings: number }, r: WebTrafficRow) => ({
      searches: acc.searches + r.searches,
      views: acc.views + r.page_views,
      attempts: acc.attempts + r.booking_attempts,
      bookings: acc.bookings + r.bookings_completed,
    }),
    { searches: 0, views: 0, attempts: 0, bookings: 0 }
  );
  const avgConversion =
    totals.searches > 0 ? (totals.bookings / totals.searches) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Website Traffic & Conversions</CardTitle>
        <CardDescription>30-day website engagement metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground">Total Searches</p>
            <p className="text-xl font-bold">
              {totals.searches.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground">Page Views</p>
            <p className="text-xl font-bold">
              {totals.views.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground">Bookings</p>
            <p className="text-xl font-bold">
              {totals.bookings.toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg border">
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
            <p className="text-xl font-bold">{avgConversion.toFixed(1)}%</p>
          </div>
        </div>

        <ChartContainer
          config={{
            searches: { label: "Searches", color: "var(--chart-1)" },
            bookings_completed: {
              label: "Bookings",
              color: "var(--chart-2)",
            },
          }}
          className="h-64 w-full"
        >
          <LineChart data={traffic}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) =>
                new Date(v).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })
              }
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="searches"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="bookings_completed"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>

        <ChartContainer
          config={{
            conversion_rate: {
              label: "Conversion %",
              color: "var(--chart-4)",
            },
          }}
          className="h-48 w-full mt-6"
        >
          <AreaChart data={traffic}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) =>
                new Date(v).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })
              }
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => `${Number(v).toFixed(2)}%`}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="conversion_rate"
              stroke="var(--chart-4)"
              fill="var(--chart-4)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
