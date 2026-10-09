"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // Lets column definitions carry alignment/width classes for both header and cells.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
  }
}

/** Radix Select can't use "" as an item value, so "no filter" gets a sentinel. */
const ALL_OPTION = "__all__";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** A dropdown that filters one column to an exact value. */
export type SelectFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Client-side table with a text search across all columns, optional dropdown filters,
 * click-to-sort headers, and pagination. Fine for hundreds of rows; past that, filter, sort,
 * and paginate in the query instead.
 */
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Search…",
  selectFilters = [],
  initialSorting = [],
  hiddenColumnIds = [],
  emptyMessage = "No results.",
  initialPageSize = PAGE_SIZE_OPTIONS[0],
  tableClassName,
  rowClassName,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchPlaceholder?: string;
  selectFilters?: SelectFilter[];
  initialSorting?: SortingState;
  /** Columns that exist only to be filtered on, not shown. */
  hiddenColumnIds?: string[];
  emptyMessage?: string;
  initialPageSize?: number;
  /** e.g. a min-width, so fixed-width columns scroll instead of squashing on small screens. */
  tableClassName?: string;
  /** Fixed row height (e.g. "h-14") so every page, padded to a full page, has the same height. */
  rowClassName?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // TanStack Table v8 returns non-memoizable functions; harmless here since React Compiler is off.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    initialState: {
      columnVisibility: Object.fromEntries(hiddenColumnIds.map((columnId) => [columnId, false])),
      pagination: { pageIndex: 0, pageSize: initialPageSize },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Page index resets to the first page whenever search, filters, or sorting change.
    getPaginationRowModel: getPaginationRowModel(),
  });
  const visibleRows = table.getRowModel().rows; // current page only
  const matchingRowCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const firstRowShown = matchingRowCount ? pageIndex * pageSize + 1 : 0;
  const lastRowShown = Math.min((pageIndex + 1) * pageSize, matchingRowCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search table"
          className="max-w-xs"
        />
        {selectFilters.map((filter) => {
          const column = table.getColumn(filter.columnId);
          return (
            <Select
              key={filter.columnId}
              value={(column?.getFilterValue() as string | undefined) ?? ALL_OPTION}
              onValueChange={(value) =>
                column?.setFilterValue(value === ALL_OPTION ? undefined : value)
              }
            >
              <SelectTrigger aria-label={`Filter by ${filter.label}`} className="w-auto min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>All {filter.label.toLowerCase()}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
      </div>

      {/* Pager sits above the table so its buttons don't move as page heights differ. */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground tabular-nums" aria-live="polite">
          Showing {firstRowShown}–{lastRowShown} of {matchingRowCount}
          {matchingRowCount !== data.length && ` (filtered from ${data.length})`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger aria-label="Rows per page" className="w-20" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground w-24 text-right tabular-nums">
            Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Fixed layout: column widths come from the column definitions, not each page's content. */}
        <Table className={cn("table-fixed", tableClassName)}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortDirection = header.column.getIsSorted();
                  const headerContent = flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  );
                  return (
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.className}
                      aria-sort={
                        sortDirection === "asc"
                          ? "ascending"
                          : sortDirection === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "hover:text-foreground inline-flex items-center gap-1",
                            header.column.columnDef.meta?.className?.includes("text-right") &&
                              "flex-row-reverse"
                          )}
                        >
                          {headerContent}
                          {sortDirection === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sortDirection === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="text-muted-foreground size-3.5" />
                          )}
                        </button>
                      ) : (
                        headerContent
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {visibleRows.length
              ? visibleRows.map((row) => (
                  <TableRow key={row.id} className={rowClassName}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
            {/* Pad short pages to a full page so content below the table doesn't jump. */}
            {visibleRows.length > 0 &&
              table.getPageCount() > 1 &&
              Array.from({ length: pageSize - visibleRows.length }, (_, index) => (
                <TableRow
                  key={`filler-${index}`}
                  aria-hidden
                  className={cn(rowClassName, "border-0 hover:bg-transparent")}
                >
                  <TableCell colSpan={table.getVisibleLeafColumns().length} />
                </TableRow>
              ))}
            {visibleRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="text-muted-foreground h-16 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
