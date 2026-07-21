import React, { useState } from "react";
import { useTestWatchDvr, useImportWatchDvr } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, PlugZap, CheckCircle2, XCircle, HardDrive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const inputCls = "bg-slate-950 border-slate-800 text-slate-200 focus:border-blue-500";
const selectTriggerCls = "bg-slate-950 border-slate-800 text-slate-200";
const selectContentCls = "bg-slate-900 border-slate-800 text-slate-200";

const BRANDS = [
  { value: "hikvision", label: "Hikvision (incl. Hilook, Annke)" },
  { value: "dahua", label: "Dahua (incl. Lorex, IC Realtime)" },
  { value: "amcrest", label: "Amcrest" },
  { value: "uniview", label: "Uniview (UNV)" },
  { value: "reolink", label: "Reolink" },
  { value: "generic", label: "Other / custom RTSP template" },
] as const;

/** Parses "1-8" / "1,2,5" / "1-4,7" into a sorted unique channel list. */
function parseChannels(text: string): number[] {
  const out = new Set<number>();
  for (const part of text.split(",").map((s) => s.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const lo = Number(range[1]);
      const hi = Number(range[2]);
      if (lo >= 1 && hi >= lo && hi - lo < 64) for (let c = lo; c <= hi; c++) out.add(c);
    } else if (/^\d+$/.test(part)) {
      out.add(Number(part));
    }
  }
  return [...out].filter((c) => c >= 1 && c <= 64).sort((a, b) => a - b);
}

interface DvrConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function DvrConnectDialog({ open, onClose, onImported }: DvrConnectDialogProps) {
  const testDvr = useTestWatchDvr();
  const importDvr = useImportWatchDvr();
  const { toast } = useToast();

  const [brand, setBrand] = useState<string>("hikvision");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("554");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [quality, setQuality] = useState<"main" | "sub">("sub");
  const [urlPattern, setUrlPattern] = useState("");
  const [channelsText, setChannelsText] = useState("1-4");
  const [namePrefix, setNamePrefix] = useState("");
  const [location, setLocation] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; url?: string } | null>(null);

  const isGeneric = brand === "generic";
  const channels = parseChannels(channelsText);
  const canTest = isGeneric ? urlPattern.trim().includes("{channel}") : host.trim().length > 0;
  const canImport = canTest && channels.length > 0 && channels.length <= 32;

  const commonBody = () => ({
    brand: brand as any,
    host: host.trim() || undefined,
    port: Math.min(65535, Math.max(1, Number(port) || 554)),
    username: username.trim() || undefined,
    password: password || undefined,
    quality,
    urlPattern: isGeneric ? urlPattern.trim() : undefined,
  });

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result: any = await testDvr.mutateAsync({
        data: { ...commonBody(), channel: channels[0] ?? 1 },
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ ok: false, error: err?.response?.data?.error || err?.message || "Test failed" });
    }
  };

  const handleImport = async () => {
    try {
      const result: any = await importDvr.mutateAsync({
        data: {
          ...commonBody(),
          channels,
          namePrefix: namePrefix.trim() || undefined,
          location: location.trim() || undefined,
        },
      });
      toast({ title: `Imported ${result?.total ?? channels.length} camera${channels.length === 1 ? "" : "s"} from DVR` });
      onImported();
      handleClose();
    } catch (err: any) {
      toast({
        title: "DVR import failed",
        description: err?.response?.data?.error || err?.message,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setTestResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-200 max-w-lg" data-testid="dialog-dvr-connect">
        <DialogHeader>
          <DialogTitle className="text-slate-100 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-400" /> Connect DVR / NVR
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Import recorder channels as cameras. Sub-stream is recommended — most recorders limit concurrent full-quality connections.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-1.5">
            <Label className="text-slate-400 text-xs">Brand</Label>
            <Select value={brand} onValueChange={(v) => { setBrand(v); setTestResult(null); }}>
              <SelectTrigger className={selectTriggerCls} data-testid="select-dvr-brand"><SelectValue /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                {BRANDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isGeneric ? (
            <div className="grid grid-cols-1 gap-1.5">
              <Label className="text-slate-400 text-xs">RTSP URL template — use {"{channel}"} where the channel number goes</Label>
              <Input placeholder="rtsp://user:pass@192.168.1.100:554/ch{channel}/sub" value={urlPattern} onChange={(e) => setUrlPattern(e.target.value)} className={inputCls} data-testid="input-dvr-pattern" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 grid gap-1.5">
                  <Label className="text-slate-400 text-xs">Host / IP address</Label>
                  <Input placeholder="192.168.1.100" value={host} onChange={(e) => setHost(e.target.value)} className={inputCls} data-testid="input-dvr-host" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-slate-400 text-xs">RTSP port</Label>
                  <Input type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} className={inputCls} data-testid="input-dvr-port" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label className="text-slate-400 text-xs">Username</Label>
                  <Input placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} autoComplete="off" data-testid="input-dvr-username" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-slate-400 text-xs">Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" data-testid="input-dvr-password" />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-slate-400 text-xs">Channels (e.g. 1-8 or 1,3,5)</Label>
              <Input value={channelsText} onChange={(e) => setChannelsText(e.target.value)} className={inputCls} data-testid="input-dvr-channels" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-400 text-xs">Stream quality</Label>
              <Select value={quality} onValueChange={(v) => setQuality(v as "main" | "sub")}>
                <SelectTrigger className={selectTriggerCls} data-testid="select-dvr-quality"><SelectValue /></SelectTrigger>
                <SelectContent className={selectContentCls}>
                  <SelectItem value="sub">Sub-stream (recommended)</SelectItem>
                  <SelectItem value="main">Main stream (full quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label className="text-slate-400 text-xs">Name prefix (optional)</Label>
              <Input placeholder="Warehouse DVR" value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)} className={inputCls} data-testid="input-dvr-prefix" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-slate-400 text-xs">Location (optional)</Label>
              <Input placeholder="Main building" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} data-testid="input-dvr-location" />
            </div>
          </div>

          {channels.length > 32 && (
            <p className="text-red-400 text-xs">At most 32 channels per import.</p>
          )}

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
              data-testid="text-dvr-test-result"
            >
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="font-medium">{testResult.ok ? "Connection successful — a frame was captured." : "Connection failed."}</p>
                {testResult.error && <p className="mt-0.5 break-words opacity-90">{testResult.error}</p>}
                {testResult.url && <p className="mt-0.5 break-all opacity-70">{testResult.url}</p>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="border-slate-700 text-slate-300"
            onClick={handleTest}
            disabled={!canTest || testDvr.isPending}
            data-testid="button-dvr-test"
          >
            {testDvr.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlugZap className="w-4 h-4 mr-2" />}
            Test channel {channels[0] ?? 1}
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500"
            onClick={handleImport}
            disabled={!canImport || importDvr.isPending}
            data-testid="button-dvr-import"
          >
            {importDvr.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Import {channels.length || ""} channel{channels.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
