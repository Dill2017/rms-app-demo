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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  useGetOpportunitiesSuspense,
  useListRegionsSuspense,
} from "@/lib/api";
import selector from "@/lib/selector";
import {
  TrendingUp,
  ArrowUpRight,
  Shield,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/opportunities")({
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const [region, setRegion] = useState("");

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Pricing Opportunities
          </h1>
          <p className="text-muted-foreground">
            Hotels ranked by RevPAR improvement potential
          </p>
        </div>

        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary onReset={reset} fallbackRender={() => null}>
              <Suspense fallback={<Skeleton className="h-9 w-44" />}>
                <RegionFilter region={region} onRegionChange={setRegion} />
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
                    Failed to load opportunities
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
            <Suspense fallback={<OpportunitiesSkeleton />}>
              <OpportunitiesContent region={region} />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  );
}

function RegionFilter({
  region,
  onRegionChange,
}: {
  region: string;
  onRegionChange: (v: string) => void;
}) {
  const { data: regions } = useListRegionsSuspense(selector());

  return (
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
  );
}

function OpportunitiesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function OpportunitiesContent({ region }: { region: string }) {
  const regionParam = region && region !== "all" ? region : undefined;

  const { data: opportunities } = useGetOpportunitiesSuspense({
    params: { region: regionParam, limit: 10 },
    ...selector(),
  });

  if (opportunities.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No opportunities found</h3>
          <p className="text-muted-foreground mt-1">
            Try selecting a different region or check back later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalUplift = opportunities.reduce(
    (sum, o) => sum + o.revpar_uplift,
    0,
  );
  const avgUpliftPct =
    opportunities.reduce((sum, o) => sum + o.revpar_uplift_pct, 0) /
    opportunities.length;
  const highRiskCount = opportunities.filter(
    (o) => o.displacement_risk === "high",
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total RevPAR Uplift
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              +${totalUplift.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across top {opportunities.length} hotels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Improvement
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              +{avgUpliftPct.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average RevPAR improvement per hotel
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Displacement Risk
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {highRiskCount}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {opportunities.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hotels at high competitor risk
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Opportunities</CardTitle>
          <CardDescription>
            Click any hotel to view its full pricing analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead className="text-right">RevPAR Now</TableHead>
                <TableHead className="text-right">Potential</TableHead>
                <TableHead className="text-right">Uplift</TableHead>
                <TableHead className="text-center">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.map((opp, idx) => (
                <TableRow key={opp.hotel_id} className="group">
                  <TableCell className="text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/hotels/$hotelId"
                      params={{ hotelId: opp.hotel_id }}
                      className="group-hover:text-primary transition-colors"
                    >
                      <div className="font-medium flex items-center gap-1.5">
                        {opp.hotel_name}
                        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {opp.city} · {opp.region}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${opp.current_revpar.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${opp.suggested_revpar.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-emerald-500">
                      +${opp.revpar_uplift.toFixed(2)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      (+{opp.revpar_uplift_pct.toFixed(1)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <RiskBadge risk={opp.displacement_risk} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === "high") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        High
      </Badge>
    );
  }
  if (risk === "moderate") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
      >
        <AlertTriangle className="h-3 w-3" />
        Moderate
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    >
      <CheckCircle className="h-3 w-3" />
      Low
    </Badge>
  );
}
