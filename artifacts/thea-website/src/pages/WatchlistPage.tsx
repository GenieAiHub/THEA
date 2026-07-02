import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListWatchlistKeywords, useCreateWatchlistKeyword, useDeleteWatchlistKeyword, getListWatchlistKeywordsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function WatchlistPage() {
  const { data: keywordsData, isLoading } = useListWatchlistKeywords<any>();
  const createKeyword = useCreateWatchlistKeyword();
  const deleteKeyword = useDeleteWatchlistKeyword();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<"keyword" | "brand" | "person" | "competitor">("keyword");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    try {
      await createKeyword.mutateAsync({ data: { keyword, type, category: "general" } });
      setKeyword("");
      queryClient.invalidateQueries({ queryKey: getListWatchlistKeywordsQueryKey() });
      toast({ title: "Keyword added to watchlist" });
    } catch (err) {
      toast({ title: "Failed to add keyword", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKeyword.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListWatchlistKeywordsQueryKey() });
      toast({ title: "Keyword removed" });
    } catch (err) {
      toast({ title: "Failed to remove keyword", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout title="Watchlist">
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Add to Watchlist</CardTitle>
            <CardDescription className="text-slate-400">Track specific entities, brands, or topics.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Input 
                  placeholder="Enter keyword (e.g. Acme Corp)" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500"
                />
              </div>
              <div className="w-48 space-y-2">
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="brand">Brand</SelectItem>
                    <SelectItem value="person">Person</SelectItem>
                    <SelectItem value="competitor">Competitor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-500" disabled={createKeyword.isPending || !keyword.trim()}>
                {createKeyword.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Add
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100">Active Watchlist</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />)}
              </div>
            ) : keywordsData?.data?.length ? (
              <div className="space-y-3">
                {keywordsData.data.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-slate-200">{item.keyword}</p>
                        <p className="text-xs text-slate-500 capitalize">{item.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Active</Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-slate-500 hover:text-red-400 hover:bg-red-400/10">
                        {deleteKeyword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-slate-500">Your watchlist is empty.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}