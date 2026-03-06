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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetDashboardKpisSuspense,
  useGetRevenueTrendSuspense,
  useGetOccupancyByRegionSuspense,
  useGetPickupCurveSuspense,
  useListRegionsSuspense,
  useListHotelsSuspense,
} from "@/lib/api";
import selector from "@/lib/selector";
import {
  DollarSign,
  BedDouble,
  BarChart3,
  Users,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [region, setRegion] = useState("");
  const [days, setDays] = useState(30);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Revenue management overview across 800+ hotels
          </p>
        </div>

        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary onReset={reset} fallbackRender={() => null}>
              <Suspense
                fallback={
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-44" />
                    <Skeleton className="h-9 w-36" />
                  </div>
                }
              >
                <DashboardFilters
                  region={region}
                  onRegionChange={setRegion}
                  days={days}
                  onDaysChange={setDays}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </div>

      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ resetErrorBoundary }) => (
              <Card>
                <CardContent className="p-6">
                  <p className="text-destructive">
                    Failed to load dashboard data
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
            <Suspense fallback={<DashboardSkeleton />}>
              <DashboardContent region={region} days={days} />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  );
}

function DashboardFilters({
  region,
  onRegionChange,
  days,
  onDaysChange,
}: {
  region: string;
  onRegionChange: (v: string) => void;
  days: number;
  onDaysChange: (v: number) => void;
}) {
  const { data: regions } = useListRegionsSuspense(selector());

  return (
    <div className="flex items-center gap-2">
      <Select value={region} onValueChange={onRegionChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All Regions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tabs
        value={String(days)}
        onValueChange={(v) => onDaysChange(Number(v))}
      >
        <TabsList>
          <TabsTrigger value="7">7d</TabsTrigger>
          <TabsTrigger value="14">14d</TabsTrigger>
          <TabsTrigger value="30">30d</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function DashboardContent({
  region,
  days,
}: {
  region: string;
  days: number;
}) {
  const regionParam = region && region !== "all" ? region : undefined;

  const { data: kpis } = useGetDashboardKpisSuspense({
    params: { region: regionParam },
    ...selector(),
  });
  const { data: revenueTrend } = useGetRevenueTrendSuspense({
    params: { days, region: regionParam },
    ...selector(),
  });
  const { data: regionOccupancy } =
    useGetOccupancyByRegionSuspense(selector());

  const kpiCards = [
    {
      title: "Revenue MTD",
      value: `$${(kpis.total_revenue_mtd / 1_000_000).toFixed(1)}M`,
      change: kpis.revenue_change_pct,
      icon: DollarSign,
      description: "Month-to-date revenue",
    },
    {
      title: "Avg Occupancy",
      value: `${kpis.avg_occupancy_pct}%`,
      change: kpis.occupancy_change_pct,
      icon: BedDouble,
      description: "Across all properties",
    },
    {
      title: "RevPAR",
      value: `$${kpis.revpar.toFixed(0)}`,
      change: null,
      icon: BarChart3,
      description: "Revenue per available room",
    },
    {
      title: "Bookings MTD",
      value: kpis.total_bookings_mtd.toLocaleString(),
      change: null,
      icon: Users,
      description: `${kpis.avg_website_conversion}% website conversion`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-1">
                {kpi.change !== null && (
                  <>
                    {kpi.change >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-500" />
                    )}
                    <span
                      className={`text-xs font-medium ${kpi.change >= 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {Math.abs(kpi.change)}%
                    </span>
                  </>
                )}
                <span className="text-xs text-muted-foreground">
                  {kpi.description}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>
              Daily revenue over the last {days} days
              {regionParam ? ` in ${regionParam}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                revenue: { label: "Revenue", color: "var(--chart-1)" },
              }}
              className="h-64 w-full"
            >
              <AreaChart data={revenueTrend}>
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
                <YAxis
                  tickFormatter={(v: number) =>
                    `$${(v / 1_000_000).toFixed(1)}M`
                  }
                  className="text-xs"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) =>
                        `$${(Number(value) / 1_000_000).toFixed(2)}M`
                      }
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Occupancy by Region</CardTitle>
            <CardDescription>Average occupancy rate by region</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                avg_occupancy: {
                  label: "Avg Occupancy %",
                  color: "var(--chart-2)",
                },
              }}
              className="h-64 w-full"
            >
              <BarChart data={regionOccupancy} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis
                  type="category"
                  dataKey="region"
                  width={110}
                  className="text-xs"
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => `${Number(value).toFixed(1)}%`}
                    />
                  }
                />
                <Bar
                  dataKey="avg_occupancy"
                  fill="var(--chart-2)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <PickupCurveSection region={regionParam} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Regional Summary</CardTitle>
            <CardDescription>
              Hotel distribution and occupancy by region
            </CardDescription>
          </div>
          <Link
            to="/hotels"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all hotels <ArrowUpRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regionOccupancy.map((r) => (
              <div
                key={r.region}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <Globe className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">{r.region}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.hotel_count} hotels &middot;{" "}
                    {r.total_rooms.toLocaleString()} rooms
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{r.avg_occupancy}%</p>
                  <p className="text-xs text-muted-foreground">occupancy</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PickupCurveSection({ region }: { region?: string }) {
  const [mode, setMode] = useState<"region" | "hotel">("region");
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Booking Pickup Curve
            </CardTitle>
            <CardDescription>
              Occupancy build-up by lead time before stay date
            </CardDescription>
          </div>
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "region" | "hotel")}
          >
            <TabsList>
              <TabsTrigger value="region">Region Aggregate</TabsTrigger>
              <TabsTrigger value="hotel">Hotel Detail</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "hotel" && (
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary onReset={reset} fallbackRender={() => null}>
                <Suspense
                  fallback={
                    <div className="flex gap-2 mb-4">
                      <Skeleton className="h-9 w-64" />
                      <Skeleton className="h-9 w-44" />
                    </div>
                  }
                >
                  <HotelDateSelector
                    region={region}
                    hotelId={selectedHotelId}
                    onHotelChange={setSelectedHotelId}
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        )}

        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary
              onReset={reset}
              fallbackRender={({ resetErrorBoundary }) => (
                <div className="h-72 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-destructive text-sm">
                      Failed to load pickup curve
                    </p>
                    <button
                      onClick={resetErrorBoundary}
                      className="mt-1 text-xs underline"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            >
              <Suspense fallback={<Skeleton className="h-72" />}>
                <PickupCurveChart
                  mode={mode}
                  region={region}
                  hotelId={selectedHotelId}
                  targetDate={selectedDate}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </CardContent>
    </Card>
  );
}

function HotelDateSelector({
  region,
  hotelId,
  onHotelChange,
  date,
  onDateChange,
}: {
  region?: string;
  hotelId: string;
  onHotelChange: (v: string) => void;
  date: string;
  onDateChange: (v: string) => void;
}) {
  const { data: hotelList } = useListHotelsSuspense({
    params: { region: region || undefined, page_size: 50 },
    ...selector(),
  });

  const futureDates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split("T")[0];
  });

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Select value={hotelId} onValueChange={onHotelChange}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Select a hotel..." />
        </SelectTrigger>
        <SelectContent>
          {hotelList.hotels.map((h) => (
            <SelectItem key={h.hotel_id} value={h.hotel_id}>
              {h.name} ({h.city})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={date} onValueChange={onDateChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Select date..." />
        </SelectTrigger>
        <SelectContent>
          {futureDates.map((d) => (
            <SelectItem key={d} value={d}>
              {new Date(d + "T12:00:00").toLocaleDateString("en", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PickupCurveChart({
  mode,
  region,
  hotelId,
  targetDate,
}: {
  mode: "region" | "hotel";
  region?: string;
  hotelId: string;
  targetDate: string;
}) {
  const isHotelMode = mode === "hotel" && hotelId && targetDate;

  const { data: pickupData } = useGetPickupCurveSuspense({
    params: isHotelMode
      ? { hotel_id: hotelId, target_date: targetDate }
      : { region: region || undefined },
    ...selector(),
  });

  const chartData = pickupData.map((p) => ({
    ...p,
    label: `${p.lead_time_days}d`,
  }));

  if (mode === "hotel" && (!hotelId || !targetDate)) {
    return (
      <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
        Select a hotel and a future date to view its pickup curve
      </div>
    );
  }

  return (
    <ChartContainer
      config={{
        occupancy_pct: {
          label: "Occupancy %",
          color: "var(--chart-4)",
        },
      }}
      className="h-72 w-full"
    >
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="lead_time_days"
          reversed
          tickFormatter={(v: number) => `${v}d`}
          label={{
            value: "Days Before Stay",
            position: "insideBottom",
            offset: -5,
            className: "fill-muted-foreground text-xs",
          }}
          className="text-xs"
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          label={{
            value: "Occupancy",
            angle: -90,
            position: "insideLeft",
            className: "fill-muted-foreground text-xs",
          }}
          className="text-xs"
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `${Number(value).toFixed(1)}%`}
              labelFormatter={(label) => `${label} days before stay`}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="occupancy_pct"
          stroke="var(--chart-4)"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
