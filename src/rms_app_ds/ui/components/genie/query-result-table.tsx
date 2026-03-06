import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface QueryResult {
  columns: string[];
  data: (string | number | null)[][];
  row_count: number;
}

export function QueryResultTable({ result }: { result: QueryResult }) {
  if (!result.columns.length || !result.data.length) {
    return (
      <p className="text-sm text-muted-foreground italic">No data returned.</p>
    );
  }

  const displayRows = result.data.slice(0, 100);

  return (
    <div className="space-y-2">
      <ScrollArea className="rounded-md border max-h-[360px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {result.columns.map((col) => (
                <TableHead key={col} className="font-semibold text-xs whitespace-nowrap">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j} className="text-xs whitespace-nowrap py-1.5">
                    {cell === null ? (
                      <span className="text-muted-foreground">null</span>
                    ) : typeof cell === "number" ? (
                      Number.isInteger(cell) ? cell.toLocaleString() : cell.toFixed(2)
                    ) : (
                      String(cell)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <p className="text-xs text-muted-foreground">
        {result.row_count} row{result.row_count !== 1 ? "s" : ""} returned
        {result.row_count > 100 ? " (showing first 100)" : ""}
      </p>
    </div>
  );
}
