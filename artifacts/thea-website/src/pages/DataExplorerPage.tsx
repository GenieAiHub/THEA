import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListContent, getListContentQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

export default function DataExplorerPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: contentData, isLoading } = useListContent(
    { search: activeQuery, page, limit },
    { query: { enabled: true, queryKey: ["/api/v1/content", { search: activeQuery, page, limit }] } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setActiveQuery(searchQuery);
  };

  return (
    <DashboardLayout title="Data Explorer">
      <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
        <form onSubmit={handleSearch} className="flex gap-4 shrink-0">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input 
              placeholder="Search raw content corpus..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <Button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
            Search
          </Button>
        </form>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="bg-slate-950 sticky top-0 z-10 border-b border-slate-800">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="text-slate-400 font-medium">Content / Title</TableHead>
                  <TableHead className="text-slate-400 font-medium w-32">Platform</TableHead>
                  <TableHead className="text-slate-400 font-medium w-24">Sentiment</TableHead>
                  <TableHead className="text-slate-400 font-medium w-48 text-right">Collected At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-800/50 hover:bg-slate-800/50">
                      <TableCell><Skeleton className="h-4 w-3/4 bg-slate-800" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 bg-slate-800" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 bg-slate-800" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 bg-slate-800 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : contentData?.data?.length ? (
                  contentData.data.map((item: any) => (
                    <TableRow key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 cursor-pointer">
                      <TableCell className="text-slate-300 max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="truncate block font-medium">{item.title || "Untitled"}</span>
                          {item.sourceUrl && (
                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-400 hover:text-blue-300">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <span className="truncate block text-xs text-slate-500 mt-1">{item.body}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-950 text-slate-400 border-slate-800">{item.platform || "Unknown"}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${item.sentimentScore > 0 ? 'text-emerald-400' : item.sentimentScore < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                          {item.sentimentScore?.toFixed(2) || "0.00"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-500">
                        {new Date(item.collectedAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="border-none hover:bg-transparent">
                    <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                      No data found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          <div className="h-14 border-t border-slate-800 bg-slate-950 flex items-center justify-between px-4 shrink-0">
            <span className="text-sm text-slate-500">
              Page {page}
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => p + 1)}
                disabled={!contentData?.data?.length || contentData.data.length < limit || isLoading}
                className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}