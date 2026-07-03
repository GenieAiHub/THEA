import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DoorOpen,
  MapPin,
  ScanFace,
  ShieldCheck,
  ShieldX,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CameraCapture } from "@/components/CameraCapture";
import { api } from "@/lib/api";
import { reasonLabel, type IdentifyResult } from "@/lib/types";
import {
  formatCoords,
  getCurrentLocation,
  GeoError,
  type Coordinates,
} from "@/lib/geolocation";

export default function Scan() {
  const qc = useQueryClient();
  const points = useQuery({ queryKey: ["points"], queryFn: api.listPoints });
  const [pointId, setPointId] = useState<string>("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);

  const activePoints = (points.data ?? []).filter((p) => p.isActive);
  const selectedPoint =
    activePoints.find((p) => p.id === pointId) ?? activePoints[0];

  const identify = useMutation({
    mutationFn: (base64: string) =>
      api.identify(base64, selectedPoint!.id),
    onSuccess: (res) => {
      setResult(res);
      setCameraOpen(false);
      void qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const captureLocation = async () => {
    setGeoError(null);
    setGeoBusy(true);
    try {
      setCoords(await getCurrentLocation());
    } catch (err) {
      setGeoError(
        err instanceof GeoError ? err.message : "Couldn't get your location.",
      );
    } finally {
      setGeoBusy(false);
    }
  };

  if (points.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activePoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
        <DoorOpen className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No active access points</p>
        <p className="mb-4 mt-1 max-w-xs text-sm text-muted-foreground">
          Create an access point before you can verify entries.
        </p>
        <Link href="/access-points">
          <Button data-testid="button-goto-points">Add access point</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scan</h1>
        <p className="text-sm text-muted-foreground">
          Verify a face at an access point
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Access point</label>
        <Select
          value={selectedPoint?.id}
          onValueChange={(v) => {
            setPointId(v);
            setResult(null);
          }}
        >
          <SelectTrigger data-testid="select-access-point">
            <SelectValue placeholder="Select an access point" />
          </SelectTrigger>
          <SelectContent>
            {activePoints.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location verification (on-device) */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
            <MapPin className="h-4.5 w-4.5 text-accent-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Location</p>
            {coords ? (
              <p
                className="truncate text-xs text-muted-foreground"
                data-testid="text-coords"
              >
                {formatCoords(coords)} · ±{Math.round(coords.accuracy)}m
              </p>
            ) : geoError ? (
              <p className="truncate text-xs text-destructive">{geoError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Optionally confirm where this scan happens
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={captureLocation}
            disabled={geoBusy}
            data-testid="button-capture-location"
          >
            {geoBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : coords ? (
              "Refresh"
            ) : (
              "Verify"
            )}
          </Button>
        </div>
      </div>

      <Button
        size="lg"
        className="h-16 w-full rounded-2xl text-base font-semibold"
        onClick={() => {
          setResult(null);
          setCameraOpen(true);
        }}
        disabled={!selectedPoint}
        data-testid="button-start-scan"
      >
        <ScanFace className="mr-2 h-6 w-6" />
        Start face scan
      </Button>

      {result && (
        <ResultCard result={result} onDismiss={() => setResult(null)} />
      )}

      <CameraCapture
        open={cameraOpen}
        busy={identify.isPending}
        title="Scan a member's face"
        hint={`Verifying at ${selectedPoint?.name ?? ""}`}
        onClose={() => setCameraOpen(false)}
        onCapture={(base64) => identify.mutate(base64)}
      />
    </div>
  );
}

function ResultCard({
  result,
  onDismiss,
}: {
  result: IdentifyResult;
  onDismiss: () => void;
}) {
  const granted = result.decision === "granted";
  return (
    <div
      className={
        granted
          ? "rounded-2xl border border-success/30 bg-success/10 p-5"
          : "rounded-2xl border border-destructive/30 bg-destructive/10 p-5"
      }
      data-testid="card-scan-result"
    >
      <div className="flex items-center gap-4">
        <div
          className={
            granted
              ? "flex h-14 w-14 items-center justify-center rounded-2xl bg-success text-white"
              : "flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive text-white"
          }
        >
          {granted ? (
            <ShieldCheck className="h-7 w-7" />
          ) : (
            <ShieldX className="h-7 w-7" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={
              granted
                ? "text-lg font-bold text-success"
                : "text-lg font-bold text-destructive"
            }
          >
            {granted ? "Access granted" : "Access denied"}
          </p>
          <p className="truncate text-sm text-foreground">
            {result.member?.fullName ?? reasonLabel(result.reason)}
          </p>
          <p className="text-xs text-muted-foreground">
            {result.accessPoint.name}
            {result.distance != null &&
              ` · match ${(1 - result.distance).toFixed(2)}`}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        className="mt-4 w-full"
        onClick={onDismiss}
        data-testid="button-dismiss-result"
      >
        Scan again
      </Button>
    </div>
  );
}
