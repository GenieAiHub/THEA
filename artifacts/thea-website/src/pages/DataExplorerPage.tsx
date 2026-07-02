import React, { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListContent, useListCategories } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ExternalLink, ChevronLeft, ChevronRight, Download, X, Filter, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";

const PLATFORMS = ["all", "twitter", "reddit", "news", "blog", "facebook", "instagram", "other"];
const LANGUAGES = ["all", "en", "es", "fr", "de", "pt", "zh", "ar", "ja", "ko", "ru", "it"];

function exportCSV(data: any[]) {
  const headers = ["id", "title", "platform", "body", "author", "language", "sentimentScore", "engagementScore", "geoCountry", "sourceUrl", "collectedAt"];
  const rows = data.map((item) =>
    headers.map((h) => JSON.stringify(item[h] ?? "")).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `thea-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const columnHelper = createColumnHelper<any>();

function SentimentCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const color = value > 0.1 ? "text-emerald-400" : value < -0.1 ? "text-red-400" : "text-slate-400";
  const dot = value > 0.1 ? "bg-emerald-400" : value < -0.1 ? "bg-red-400" : "bg-slate-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className={`text-sm font-mono ${color}`}>{value.toFixed(2)}</span>
    </div>
  );
}

export default function DataExplorerPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [language, setLanguage] = useState("all");
  const [category, setCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sentimentMin, setSentimentMin] = useState<number>(-1);
  const [sentimentMax, setSentimentMax] = useState<number>(1);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { toast } = useToast();
  const limit = 50;

  const { data: categoriesData } = useListCategories<any>();
  const allCategories = ["all", ...(categoriesData?.data || [])];

  const queryParams = useMemo(() => ({
    search: activeQuery || undefined,
    platform: platform !== "all" ? platform : undefined,
    category: category !== "all" ? category : undefined,
    language: language !== "all" ? language : undefined,
    startDate: dateFrom || undefined,
    endDate: dateTo || undefined,
    minSentiment: sentimentMin > -1 ? sentimentMin : undefined,
    maxSentiment: sentimentMax < 1 ? sentimentMax : undefined,
    page,
    limit,
  } as any), [activeQuery, platform, category, language, dateFrom, dateTo, sentimentMin, sentimentMax, page, limit]);

  const { data: contentData, isLoading } = useListContent(
    queryParams,
    { query: { enabled: true, queryKey: ["/api/v1/content", queryParams] } }
  );

  const rawData: any[] = useMemo(() => contentData?.data || [], [contentData]);

  const columns = useMemo<ColumnDef<any, any>[]>(() => [
    columnHelper.accessor("title", {
      header: "Content / Title",
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="max-w-xs">
            <div className="flex items-center gap-1.5">
              <span className="truncate block font-medium text-sm text-slate-200">{row.title || "Untitled"}</span>
              {row.sourceUrl && (
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-400 hover:text-blue-300 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <span className="truncate block text-xs text-slate-500 mt-0.5">{row.body?.slice(0, 80)}</span>
          </div>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor("platform", {
      header: "Platform",
      cell: (info) => (
        <Badge variant="outline" className="bg-slate-950 text-slate-400 border-slate-800 text-xs capitalize">
          {info.getValue() || "unknown"}
        </Badge>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor("sentimentScore", {
      header: "Sentiment",
      cell: (info) => <SentimentCell value={info.getValue()} />,
      enableSorting: true,
    }),
    columnHelper.accessor((row) => {
      const sentiment = Math.abs(row.sentimentScore ?? 0);
      const bodyLen = (row.body?.length ?? 0) / 1000;
      return Math.round(Math.min(100, sentiment * 60 + bodyLen * 20 + (row.author ? 15 : 0)));
    }, {
      id: "engagementScore",
      header: "Eng. Score",
      cell: (info) => {
        const val = info.getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${val >= 60 ? "bg-blue-500" : val >= 30 ? "bg-amber-500" : "bg-slate-600"}`}
                style={{ width: `${val}%` }}
              />
            </div>
            <span className="font-mono text-xs text-slate-400">{val}</span>
          </div>
        );
      },
      enableSorting: true,
    }),
    columnHelper.accessor("geoCountry", {
      header: "Country",
      cell: (info) => <span className="text-sm text-slate-500 uppercase">{info.getValue() || "—"}</span>,
      enableSorting: true,
    }),
    columnHelper.accessor("collectedAt", {
      header: "Collected At",
      cell: (info) => (
        <span className="text-xs text-slate-500">
          {info.getValue() ? new Date(info.getValue()).toLocaleString() : "—"}
        </span>
      ),
      enableSorting: true,
    }),
  ], []);

  const table = useReactTable({
    data: rawData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveQuery(searchQuery);
  };

  const handleReset = () => {
    setSearchQuery("");
    setActiveQuery("");
    setPlatform("all");
    setLanguage("all");
    setCategory("all");
    setDateFrom("");
    setDateTo("");
    setSentimentMin(-1);
    setSentimentMax(1);
    setPage(1);
  };

  const handleExport = () => {
    if (!rawData.length) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    exportCSV(rawData);
    toast({ title: `Exported ${rawData.length} rows as CSV` });
  };

  const hasActiveFilters =
    activeQuery || platform !== "all" || language !== "all" || category !== "all" ||
    dateFrom || dateTo || sentimentMin > -1 || sentimentMax < 1;

  return (
    <DashboardLayout title="Data Explorer">
      <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 8rem)" }}>

        {/* Search + controls */}
        <div className="flex flex-wrap gap-3 shrink-0">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search raw content corpus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <Button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shrink-0">
              Search
            </Button>
          </form>
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowFilters(!showFilters)}
            className={`border-slate-800 shrink-0 ${showFilters ? "bg-blue-600/10 border-blue-600/40 text-blue-400" : "bg-slate-900 text-slate-300 hover:bg-slate-800"}`}
          >
            <Filter className="w-4 h-4 mr-1.5" />
            Filters {hasActiveFilters && <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full inline-block" />}
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isLoading || !rawData.length}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white shrink-0"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shrink-0 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-slate-400 text-xs shrink-0">Platform</Label>
                <Select value={platform} onValueChange={(v) => { setPlatform(v); setPage(1); }}>
                  <SelectTrigger className="w-32 bg-slate-950 border-slate-700 text-slate-200 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p === "all" ? "All" : p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-slate-400 text-xs shrink-0">Language</Label>
                <Select value={language} onValueChange={(v) => { setLanguage(v); setPage(1); }}>
                  <SelectTrigger className="w-24 bg-slate-950 border-slate-700 text-slate-200 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l} className="uppercase">{l === "all" ? "All" : l.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-slate-400 text-xs shrink-0">Category</Label>
                <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
                  <SelectTrigger className="w-36 bg-slate-950 border-slate-700 text-slate-200 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    {allCategories.map((c: string) => (
                      <SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date range */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <Label className="text-slate-400 text-xs shrink-0">From</Label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-8 px-2 text-sm rounded-md bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-slate-400 text-xs shrink-0">To</Label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="h-8 px-2 text-sm rounded-md bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sentiment range slider */}
            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-3">
                <Label className="text-slate-400 text-xs shrink-0">Sentiment Min</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={sentimentMin}
                    onChange={(e) => { setSentimentMin(parseFloat(e.target.value)); setPage(1); }}
                    className="w-28 accent-blue-500"
                  />
                  <span className={`font-mono text-xs w-10 ${sentimentMin < -0.1 ? "text-red-400" : sentimentMin > 0.1 ? "text-emerald-400" : "text-slate-400"}`}>
                    {sentimentMin > 0 ? "+" : ""}{sentimentMin.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-slate-400 text-xs shrink-0">Sentiment Max</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={sentimentMax}
                    onChange={(e) => { setSentimentMax(parseFloat(e.target.value)); setPage(1); }}
                    className="w-28 accent-blue-500"
                  />
                  <span className={`font-mono text-xs w-10 ${sentimentMax < -0.1 ? "text-red-400" : sentimentMax > 0.1 ? "text-emerald-400" : "text-slate-400"}`}>
                    {sentimentMax > 0 ? "+" : ""}{sentimentMax.toFixed(2)}
                  </span>
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-500 hover:text-slate-300 h-8">
                  <X className="w-3.5 h-3.5 mr-1" /> Reset All
                </Button>
              )}
            </div>
          </div>
        )}

        {/* TanStack Table */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-none">
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={`flex items-center gap-1 ${header.column.getCanSort() ? "cursor-pointer select-none hover:text-slate-200" : ""}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && (
                              header.column.getIsSorted() === "asc" ? <ArrowUp className="w-3 h-3" /> :
                              header.column.getIsSorted() === "desc" ? <ArrowDown className="w-3 h-3" /> :
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
                            )}
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/50">
                      {columns.map((_, ci) => (
                        <td key={ci} className="px-4 py-3">
                          <Skeleton className="h-4 w-full bg-slate-800" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedItem(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-32 text-center text-slate-500">
                      No data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="h-14 border-t border-slate-800 bg-slate-950 flex items-center justify-between px-4 shrink-0">
            <span className="text-sm text-slate-500">
              Page {page} · {rawData.length} rows
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!rawData.length || rawData.length < limit || isLoading}
                className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Detail modal */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-slate-100 pr-8">{selectedItem?.title || "Content Detail"}</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 capitalize">{selectedItem.platform}</Badge>
                  {selectedItem.language && <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{selectedItem.language.toUpperCase()}</Badge>}
                  {selectedItem.geoCountry && <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{selectedItem.geoCountry}</Badge>}
                  <Badge className={`${selectedItem.sentimentScore > 0.1 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : selectedItem.sentimentScore < -0.1 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                    Sentiment: {selectedItem.sentimentScore?.toFixed(3) ?? "N/A"}
                  </Badge>
                </div>
                {selectedItem.author && <p className="text-xs text-slate-500">By {selectedItem.author}</p>}
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                  {selectedItem.body || "No content available."}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{selectedItem.collectedAt ? new Date(selectedItem.collectedAt).toLocaleString() : ""}</span>
                  {selectedItem.sourceUrl && (
                    <a href={selectedItem.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
                      Source <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
