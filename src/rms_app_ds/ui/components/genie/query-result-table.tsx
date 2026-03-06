import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TableIcon } from "lucide-react";

interface QueryResult {
  columns: string[];
  data: (string | number | null)[][];
  row_count: number;
}

function formatColumnName(col: string): string {
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bPct\b/i, "%")
    .replace(/\bAvg\b/i, "Avg.")
    .replace(/\bId\b/, "ID");
}

const CURRENCY_PATTERNS = /price|revenue|adr|revpar|cost|rate(?!.*pct)|amount|budget/i;
const PCT_PATTERNS = /pct|percent|occupancy_pct|confidence|conversion/i;

function formatCell(value: string | number | null, colName: string): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/50">—</span>;
  }

  if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)) && value.trim() !== "")) {
    const num = typeof value === "number" ? value : Number(value);

    if (PCT_PATTERNS.test(colName)) {
      return `${num.toFixed(1)}%`;
    }
    if (CURRENCY_PATTERNS.test(colName)) {
      return num >= 1000
        ? `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        : `$${num.toFixed(2)}`;
    }
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    return num.toFixed(2);
  }

  return String(value);
}

function isNumericColumn(data: (string | number | null)[][], colIndex: number): boolean {
  for (const row of data.slice(0, 20)) {
    const val = row[colIndex];
    if (val !== null && val !== undefined && val !== "") {
      if (typeof val === "number") return true;
      if (typeof val === "string" && !isNaN(Number(val))) return true;
      return false;
    }
  }
  return false;
}

export function QueryResultTable({ result }: { result: QueryResult }) {
  if (!result.columns.length || !result.data.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground italic py-2">
        <TableIcon className="h-4 w-4" />
        <span>No data returned.</span>
      </div>
    );
  }

  const displayRows = result.data.slice(0, 100);
  const numericCols = result.columns.map((_, i) => isNumericColumn(result.data, i));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] font-normal gap-1 px-2 py-0.5">
          <TableIcon className="h-3 w-3" />
          {result.row_count} row{result.row_count !== 1 ? "s" : ""}
          {result.row_count > 100 ? " (showing 100)" : ""}
        </Badge>
      </div>

      <ScrollArea className="rounded-lg border max-h-[400px] bg-background">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="bg-muted/70 hover:bg-muted/70 border-b">
              {result.columns.map((col, i) => (
                <TableHead
                  key={col}
                  className={`font-semibold text-[11px] tracking-wide text-foreground/80 whitespace-nowrap py-2.5 px-3 ${
                    numericCols[i] ? "text-right" : ""
                  }`}
                >
                  {formatColumnName(col)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, i) => (
              <TableRow
                key={i}
                className={`${
                  i % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                } hover:bg-primary/5 transition-colors`}
              >
                {row.map((cell, j) => (
                  <TableCell
                    key={j}
                    className={`text-xs whitespace-nowrap py-2 px-3 tabular-nums ${
                      numericCols[j] ? "text-right font-mono" : ""
                    }`}
                  >
                    {formatCell(cell, result.columns[j])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
