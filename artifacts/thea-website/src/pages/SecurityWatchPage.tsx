import React, { useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useGetWatchStatus,
  useListWatchCameras,
  useCreateWatchCamera,
  useUpdateWatchCamera,
  useDeleteWatchCamera,
  getListWatchCamerasQueryKey,
  useListWatchTargets,
  useCreateWatchTarget,
  useUpdateWatchTarget,
  useDeleteWatchTarget,
  getListWatchTargetsQueryKey,
  useListWatchSightings,
  useDeleteWatchSighting,
  getListWatchSightingsQueryKey,
  getGetWatchSightingSnapshotUrl,
  useListWatchVideoJobs,
  useUploadWatchVideo,
  getListWatchVideoJobsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Video, Target, ScanEye, Plus, Trash2, Loader2, Upload,
  AlertTriangle, Pause, Play, ImageOff, FileVideo,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type TargetType = "person" | "vehicle" | "object" | "plate";

const TYPE_BADGE: Record<string, string> = {
  person: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  vehicle: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  object: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  plate: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  online: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  offline: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  error: "bg-red-500/15 text-red-400 border-red-500/30",
};

const JOB_BADGE: Record<string, string> = {
  pending: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const inputCls = "bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500";
const selectTriggerCls = "bg-slate-950 border-slate-800 text-slate-200";
const selectContentCls = "bg-slate-900 border-slate-800 text-slate-200";

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtOffset(sec?: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function filesToBase64(files: FileList): Promise<string[]> {
  const out: string[] = [];
  for (const file of Array.from(files)) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    out.push(dataUrl.replace(/^data:[^;]+;base64,/, ""));
  }
  return out;
}

/* ------------------------------- Cameras tab ------------------------------ */

function CamerasTab() {
  const { data, isLoading } = useListWatchCameras<any>({ query: { queryKey: getListWatchCamerasQueryKey(), refetchInterval: 15_000 } });
  const createCamera = useCreateWatchCamera();
  const updateCamera = useUpdateWatchCamera();
  const deleteCamera = useDeleteWatchCamera();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [interval, setIntervalSec] = useState("3");

  const cameras = (data?.data || []) as any[];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListWatchCamerasQueryKey() });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !streamUrl.trim()) return;
    try {
      await createCamera.mutateAsync({
        data: {
          name: name.trim(),
          location: location.trim() || undefined,
          streamUrl: streamUrl.trim(),
          sampleIntervalSec: Math.max(2, Number(interval) || 3),
        },
      });
      setName(""); setLocation(""); setStreamUrl("");
      invalidate();
      toast({ title: "Camera registered" });
    } catch (err: any) {
      toast({ title: "Failed to register camera", description: err?.message, variant: "destructive" });
    }
  };

  const toggleActive = async (cam: any) => {
    try {
      await updateCamera.mutateAsync({ id: cam.id, data: { isActive: !cam.isActive } });
      invalidate();
      toast({ title: cam.isActive ? "Camera paused" : "Camera resumed" });
    } catch {
      toast({ title: "Failed to update camera", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCamera.mutateAsync({ id });
      invalidate();
      toast({ title: "Camera removed" });
    } catch {
      toast({ title: "Failed to remove camera", variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-100 text-base">Register Camera</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            RTSP or HTTP(S) stream URL. Frames are sampled every few seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Input placeholder="Camera name (e.g. Gate 1)" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} data-testid="input-camera-name" />
            <Input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} data-testid="input-camera-location" />
            <Input placeholder="rtsp://user:pass@host/stream" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} className={inputCls} data-testid="input-camera-url" />
            <div className="flex items-center gap-2">
              <Label className="text-slate-400 text-xs whitespace-nowrap">Sample every</Label>
              <Input type="number" min={2} max={3600} value={interval} onChange={(e) => setIntervalSec(e.target.value)} className={`${inputCls} w-24`} data-testid="input-camera-interval" />
              <span className="text-slate-400 text-xs">seconds</span>
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-500 w-full" disabled={createCamera.isPending || !name.trim() || !streamUrl.trim()} data-testid="button-add-camera">
              {createCamera.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Camera
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base">Cameras ({cameras.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />)}</div>
          ) : cameras.length === 0 ? (
            <p className="text-slate-500 text-sm px-2 py-6 text-center">No cameras registered yet.</p>
          ) : (
            <div className="space-y-2">
              {cameras.map((cam) => (
                <div key={cam.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5" data-testid={`row-camera-${cam.id}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-200 text-sm font-medium">{cam.name}</span>
                      <Badge variant="outline" className={STATUS_BADGE[cam.status] || STATUS_BADGE.offline}>{cam.status}</Badge>
                      {!cam.isActive && <Badge variant="outline" className="bg-slate-500/15 text-slate-400 border-slate-500/30">paused</Badge>}
                    </div>
                    <p className="text-slate-500 text-xs truncate max-w-[420px]">{cam.location ? `${cam.location} · ` : ""}{cam.streamUrl}</p>
                    <p className="text-slate-600 text-xs">
                      Every {cam.sampleIntervalSec}s · Last seen {fmtTime(cam.lastSeenAt)}
                      {cam.lastError && <span className="text-red-400/80"> · {cam.lastError}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200" onClick={() => toggleActive(cam)} title={cam.isActive ? "Pause sampling" : "Resume sampling"} data-testid={`button-toggle-camera-${cam.id}`}>
                      {cam.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-400" onClick={() => handleDelete(cam.id)} data-testid={`button-delete-camera-${cam.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Targets tab ------------------------------ */

function TargetsTab() {
  const { data, isLoading } = useListWatchTargets<any>();
  const createTarget = useCreateWatchTarget();
  const updateTarget = useUpdateWatchTarget();
  const deleteTarget = useDeleteWatchTarget();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [type, setType] = useState<TargetType>("person");
  const [plateText, setPlateText] = useState("");
  const [cooldown, setCooldown] = useState("300");
  const [chEmail, setChEmail] = useState(false);
  const [emails, setEmails] = useState("");
  const [chWebhook, setChWebhook] = useState(false);
  const [chSlack, setChSlack] = useState(false);
  const [chTeams, setChTeams] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileCount, setFileCount] = useState(0);

  const targets = (data?.data || []) as any[];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListWatchTargetsQueryKey() });

  const needsImages = type === "person" || type === "object";
  const canSubmit =
    name.trim().length > 0 &&
    (type !== "plate" || plateText.trim().length >= 4) &&
    (!needsImages || fileCount > 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      let images: string[] | undefined;
      if (fileRef.current?.files?.length) {
        images = await filesToBase64(fileRef.current.files);
      }
      const result: any = await createTarget.mutateAsync({
        data: {
          name: name.trim(),
          type,
          plateText: type === "plate" ? plateText.trim().toUpperCase() : undefined,
          cooldownSec: Math.max(10, Number(cooldown) || 300),
          alertChannels: {
            email: chEmail,
            emails: chEmail
              ? emails.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
            webhook: chWebhook,
            slack: chSlack,
            teams: chTeams,
          },
          images,
        },
      });
      setName(""); setPlateText(""); setFileCount(0);
      if (fileRef.current) fileRef.current.value = "";
      invalidate();
      const warnings: string[] = result?.warnings || [];
      toast({
        title: "Watch target created",
        description: warnings.length ? warnings.join(" ") : undefined,
        variant: warnings.length ? "destructive" : undefined,
      });
    } catch (err: any) {
      toast({ title: "Failed to create target", description: err?.message, variant: "destructive" });
    }
  };

  const toggleActive = async (t: any) => {
    try {
      await updateTarget.mutateAsync({ id: t.id, data: { isActive: !t.isActive } });
      invalidate();
      toast({ title: t.isActive ? "Target paused" : "Target activated" });
    } catch {
      toast({ title: "Failed to update target", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTarget.mutateAsync({ id });
      invalidate();
      toast({ title: "Target removed" });
    } catch {
      toast({ title: "Failed to remove target", variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-100 text-base">New Watch Target</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Upload reference photos or enter a plate number. The network is watched continuously.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <Input placeholder="Target name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} data-testid="input-target-name" />
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger className={selectTriggerCls} data-testid="select-target-type"><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="person">Person (face)</SelectItem>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="object">Object</SelectItem>
                <SelectItem value="plate">License plate</SelectItem>
              </SelectContent>
            </Select>
            {type === "plate" ? (
              <Input placeholder="Plate text (e.g. OMG77)" value={plateText} onChange={(e) => setPlateText(e.target.value)} className={inputCls} data-testid="input-target-plate" />
            ) : (
              <div className="flex flex-col gap-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => setFileCount(e.target.files?.length || 0)}
                  className="text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-200 file:text-xs hover:file:bg-slate-700 cursor-pointer"
                  data-testid="input-target-images"
                />
                <span className="text-slate-600 text-xs">
                  {needsImages ? "At least one reference photo required." : "Reference photos recommended."}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-slate-400 text-xs whitespace-nowrap">Alert cooldown</Label>
              <Input type="number" min={10} max={86400} value={cooldown} onChange={(e) => setCooldown(e.target.value)} className={`${inputCls} w-24`} data-testid="input-target-cooldown" />
              <span className="text-slate-400 text-xs">seconds</span>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-slate-800 p-3">
              <span className="text-slate-300 text-xs font-medium">Alert channels</span>
              <label className="flex items-center gap-2 text-slate-400 text-sm">
                <Checkbox checked={chEmail} onCheckedChange={(v) => setChEmail(v === true)} data-testid="checkbox-channel-email" /> Email
              </label>
              {chEmail && (
                <Input placeholder="Recipients, comma-separated" value={emails} onChange={(e) => setEmails(e.target.value)} className={inputCls} data-testid="input-channel-emails" />
              )}
              <label className="flex items-center gap-2 text-slate-400 text-sm">
                <Checkbox checked={chWebhook} onCheckedChange={(v) => setChWebhook(v === true)} data-testid="checkbox-channel-webhook" /> Webhook (org endpoints)
              </label>
              <label className="flex items-center gap-2 text-slate-400 text-sm">
                <Checkbox checked={chSlack} onCheckedChange={(v) => setChSlack(v === true)} data-testid="checkbox-channel-slack" /> Slack
              </label>
              <label className="flex items-center gap-2 text-slate-400 text-sm">
                <Checkbox checked={chTeams} onCheckedChange={(v) => setChTeams(v === true)} data-testid="checkbox-channel-teams" /> Microsoft Teams
              </label>
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-500 w-full" disabled={createTarget.isPending || !canSubmit} data-testid="button-add-target">
              {createTarget.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Target
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base">Watch Targets ({targets.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />)}</div>
          ) : targets.length === 0 ? (
            <p className="text-slate-500 text-sm px-2 py-6 text-center">No watch targets yet.</p>
          ) : (
            <div className="space-y-2">
              {targets.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5" data-testid={`row-target-${t.id}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-200 text-sm font-medium">{t.name}</span>
                      <Badge variant="outline" className={TYPE_BADGE[t.type] || TYPE_BADGE.object}>{t.type}</Badge>
                      {t.plateText && <Badge variant="outline" className="bg-slate-500/15 text-slate-300 border-slate-500/30 font-mono">{t.plateText}</Badge>}
                      {!t.isActive && <Badge variant="outline" className="bg-slate-500/15 text-slate-400 border-slate-500/30">paused</Badge>}
                    </div>
                    <p className="text-slate-600 text-xs">
                      {t.imageCount ?? 0} reference photo{(t.imageCount ?? 0) === 1 ? "" : "s"} · cooldown {t.cooldownSec}s
                      {(t.alertChannels?.email || t.alertChannels?.webhook || t.alertChannels?.slack || t.alertChannels?.teams) &&
                        ` · alerts: ${["email", "webhook", "slack", "teams"].filter((c) => t.alertChannels?.[c]).join(", ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200" onClick={() => toggleActive(t)} title={t.isActive ? "Pause" : "Activate"} data-testid={`button-toggle-target-${t.id}`}>
                      {t.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-red-400" onClick={() => handleDelete(t.id)} data-testid={`button-delete-target-${t.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------ Sightings tab ----------------------------- */

const PAGE_SIZE = 24;

function SightingsTab({ videoJobFilter, clearVideoJobFilter }: { videoJobFilter: string | null; clearVideoJobFilter: () => void }) {
  const [targetId, setTargetId] = useState("all");
  const [cameraId, setCameraId] = useState("all");
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: targetsData } = useListWatchTargets<any>();
  const { data: camerasData } = useListWatchCameras<any>();

  const params = useMemo(() => ({
    targetId: targetId !== "all" ? targetId : undefined,
    cameraId: cameraId !== "all" ? cameraId : undefined,
    videoJobId: videoJobFilter || undefined,
    limit: PAGE_SIZE,
    offset,
  }), [targetId, cameraId, videoJobFilter, offset]);

  const { data, isLoading } = useListWatchSightings<any>(params, { query: { queryKey: getListWatchSightingsQueryKey(params), refetchInterval: 15_000 } });
  const deleteSighting = useDeleteWatchSighting();

  const sightings = (data?.data || []) as any[];
  const total = data?.total ?? 0;

  const handleDelete = async (id: string) => {
    try {
      await deleteSighting.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListWatchSightingsQueryKey() });
      toast({ title: "Sighting deleted" });
    } catch {
      toast({ title: "Failed to delete sighting", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={targetId} onValueChange={(v) => { setTargetId(v); setOffset(0); }}>
          <SelectTrigger className={`${selectTriggerCls} w-52`} data-testid="select-filter-target"><SelectValue placeholder="All targets" /></SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="all">All targets</SelectItem>
            {((targetsData?.data || []) as any[]).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cameraId} onValueChange={(v) => { setCameraId(v); setOffset(0); }}>
          <SelectTrigger className={`${selectTriggerCls} w-52`} data-testid="select-filter-camera"><SelectValue placeholder="All cameras" /></SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="all">All cameras</SelectItem>
            {((camerasData?.data || []) as any[]).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {videoJobFilter && (
          <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/30 cursor-pointer" onClick={clearVideoJobFilter} data-testid="badge-video-filter">
            Video scan filter · click to clear
          </Badge>
        )}
        <span className="text-slate-500 text-xs ml-auto">{total} sighting{total === 1 ? "" : "s"}</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full bg-slate-800 rounded-lg" />)}
        </div>
      ) : sightings.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="py-12 text-center text-slate-500 text-sm">
            No sightings match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {sightings.map((s) => (
            <Card key={s.id} className="bg-slate-900 border-slate-800 overflow-hidden" data-testid={`card-sighting-${s.id}`}>
              <div className="aspect-video bg-slate-950 flex items-center justify-center">
                {s.hasSnapshot ? (
                  <img
                    src={getGetWatchSightingSnapshotUrl(s.id)}
                    alt={s.targetName || "sighting"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ImageOff className="w-6 h-6 text-slate-700" />
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={TYPE_BADGE[s.targetType || "object"] || TYPE_BADGE.object}>{s.matchType}</Badge>
                  {s.alerted && <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">alerted</Badge>}
                </div>
                <p className="text-slate-200 text-sm font-medium mt-1.5 truncate">{s.targetName || "Unknown target"}</p>
                <p className="text-slate-500 text-xs truncate">
                  {s.cameraName
                    ? s.cameraName
                    : s.videoJobId
                      ? `Video scan${s.videoOffsetSec != null ? ` @ ${fmtOffset(s.videoOffsetSec)}` : ""}`
                      : "—"}
                  {s.confidence != null && ` · ${(s.confidence * 100).toFixed(0)}%`}
                </p>
                {s.detail && <p className="text-slate-600 text-xs truncate">{s.detail}</p>}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-slate-600 text-xs">{fmtTime(s.createdAt)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-600 hover:text-red-400" onClick={() => handleDelete(s.id)} data-testid={`button-delete-sighting-${s.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" className="border-slate-800 text-slate-300" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} data-testid="button-prev-page">
            Previous
          </Button>
          <span className="text-slate-500 text-xs">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <Button variant="outline" size="sm" className="border-slate-800 text-slate-300" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)} data-testid="button-next-page">
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Videos tab ------------------------------- */

function VideosTab({ onViewSightings }: { onViewSightings: (jobId: string) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { data, isLoading } = useListWatchVideoJobs<any>({
    query: {
      queryKey: getListWatchVideoJobsQueryKey(),
      refetchInterval: (query: any) => {
        const jobs = (query?.state?.data?.data || []) as any[];
        return jobs.some((j) => j.status === "pending" || j.status === "processing") ? 4_000 : false;
      },
    },
  });
  const uploadVideo = useUploadWatchVideo();

  const jobs = (data?.data || []) as any[];

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    try {
      await uploadVideo.mutateAsync({ data: { file } });
      if (fileRef.current) fileRef.current.value = "";
      setSelectedName(null);
      queryClient.invalidateQueries({ queryKey: getListWatchVideoJobsQueryKey() });
      toast({ title: "Video queued for scanning" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-100 text-base">Scan a Recording</CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            Upload a DVR export or any video file (max 500&nbsp;MB). All active watch targets are matched against every sampled frame.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              onChange={(e) => setSelectedName(e.target.files?.[0]?.name || null)}
              className="text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-200 file:text-xs hover:file:bg-slate-700 cursor-pointer"
              data-testid="input-video-file"
            />
            <Button className="bg-blue-600 hover:bg-blue-500" disabled={uploadVideo.isPending || !selectedName} onClick={handleUpload} data-testid="button-upload-video">
              {uploadVideo.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload &amp; Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base">Scan Jobs</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />)}</div>
          ) : jobs.length === 0 ? (
            <p className="text-slate-500 text-sm px-2 py-6 text-center">No recordings scanned yet.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5" data-testid={`row-video-${job.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FileVideo className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-slate-200 text-sm font-medium truncate max-w-[280px]">{job.fileName}</span>
                        <Badge variant="outline" className={JOB_BADGE[job.status] || JOB_BADGE.pending}>{job.status}</Badge>
                      </div>
                      <p className="text-slate-600 text-xs mt-0.5">
                        {job.durationSec != null && `${fmtOffset(job.durationSec)} long · `}
                        {job.framesScanned} frame{job.framesScanned === 1 ? "" : "s"} scanned · {job.sightingsCount} sighting{job.sightingsCount === 1 ? "" : "s"} · {fmtTime(job.createdAt)}
                      </p>
                      {job.error && <p className="text-red-400/80 text-xs mt-0.5">{job.error}</p>}
                    </div>
                    {job.status === "completed" && job.sightingsCount > 0 && (
                      <Button variant="outline" size="sm" className="border-slate-800 text-slate-300 shrink-0" onClick={() => onViewSightings(job.id)} data-testid={`button-view-sightings-${job.id}`}>
                        View sightings
                      </Button>
                    )}
                  </div>
                  {(job.status === "processing" || job.status === "pending") && (
                    <Progress value={Math.round((job.progress || 0) * 100)} className="h-1.5 mt-2 bg-slate-800" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function SecurityWatchPage() {
  const { data: status } = useGetWatchStatus<any>();
  const [tab, setTab] = useState("cameras");
  const [videoJobFilter, setVideoJobFilter] = useState<string | null>(null);

  const viewJobSightings = (jobId: string) => {
    setVideoJobFilter(jobId);
    setTab("sightings");
  };

  return (
    <DashboardLayout title="Security Watch">
      <div className="flex flex-col gap-4">
        {status && !status.liveSamplingEnabled && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-400 text-sm" data-testid="banner-sampling-disabled">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Live camera sampling is disabled on this server{status.ffmpegAvailable ? "" : " (ffmpeg unavailable)"}. Offline video scanning still works.
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="cameras" className="data-[state=active]:bg-slate-800 text-slate-300" data-testid="tab-cameras">
              <Camera className="w-4 h-4 mr-1.5" /> Cameras
            </TabsTrigger>
            <TabsTrigger value="targets" className="data-[state=active]:bg-slate-800 text-slate-300" data-testid="tab-targets">
              <Target className="w-4 h-4 mr-1.5" /> Watch Targets
            </TabsTrigger>
            <TabsTrigger value="sightings" className="data-[state=active]:bg-slate-800 text-slate-300" data-testid="tab-sightings">
              <ScanEye className="w-4 h-4 mr-1.5" /> Sightings
            </TabsTrigger>
            <TabsTrigger value="videos" className="data-[state=active]:bg-slate-800 text-slate-300" data-testid="tab-videos">
              <Video className="w-4 h-4 mr-1.5" /> Video Scans
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cameras" className="mt-4"><CamerasTab /></TabsContent>
          <TabsContent value="targets" className="mt-4"><TargetsTab /></TabsContent>
          <TabsContent value="sightings" className="mt-4">
            <SightingsTab videoJobFilter={videoJobFilter} clearVideoJobFilter={() => setVideoJobFilter(null)} />
          </TabsContent>
          <TabsContent value="videos" className="mt-4"><VideosTab onViewSightings={viewJobSightings} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
