import { Suspense, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useListHotelsSuspense } from "@/lib/api";
import selector from "@/lib/selector";
import {
  Search,
  Star,
  MapPin,
  BedDouble,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const REGIONS = [
  "All Regions",
  "North America",
  "Europe",
  "Asia Pacific",
  "Middle East",
  "Latin America",
  "Africa",
];

export const Route = createFileRoute("/hotels/")({
  component: HotelsPage,
});

function HotelsPage() {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [page, setPage] = useState(1);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hotels</h1>
        <p className="text-muted-foreground">
          Manage pricing across your hotel portfolio
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search hotels by name or city..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={region || "all"}
          onValueChange={(v) => {
            setRegion(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Regions" />
          </SelectTrigger>
          <SelectContent>
            {REGIONS.map((r) => (
              <SelectItem key={r} value={r === "All Regions" ? "all" : r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ resetErrorBoundary }) => (
              <Card>
                <CardContent className="p-6">
                  <p className="text-destructive">Failed to load hotels</p>
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
            <Suspense
              fallback={
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-48" />
                  ))}
                </div>
              }
            >
              <HotelsList
                search={search}
                region={region}
                page={page}
                onPageChange={setPage}
              />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </div>
  );
}

function HotelsList({
  search,
  region,
  page,
  onPageChange,
}: {
  search: string;
  region: string;
  page: number;
  onPageChange: (p: number) => void;
}) {
  const pageSize = 18;
  const { data } = useListHotelsSuspense({
    params: { search, region, page, page_size: pageSize },
    ...selector(),
  });

  const totalPages = Math.ceil(data.total / pageSize);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Showing {data.hotels.length} of {data.total} hotels
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.hotels.map((hotel) => (
          <Link
            key={hotel.hotel_id}
            to="/hotels/$hotelId"
            params={{ hotelId: hotel.hotel_id }}
            className="block"
          >
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{hotel.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {hotel.city}, {hotel.country}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 ml-2">
                    {Array.from({ length: hotel.star_rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Occupancy</p>
                    <p className="text-lg font-bold">
                      {hotel.occupancy_pct}
                      <span className="text-xs font-normal">%</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ADR</p>
                    <p className="text-lg font-bold">
                      ${hotel.adr.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">RevPAR</p>
                    <p className="text-lg font-bold">
                      ${hotel.revpar.toFixed(0)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <BedDouble className="h-3.5 w-3.5" />
                    {hotel.total_rooms} rooms
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {hotel.region}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
