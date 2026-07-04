import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createAccessPoint,
  deleteAccessPoint,
  listAccessPoints,
  updateAccessPoint,
  ApiError,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeHeader } from "@/components/native/NativeHeader";
import { Pressable } from "@/components/native/Pressable";
import { BottomSheet } from "@/components/native/BottomSheet";
import { PullToRefresh } from "@/components/native/PullToRefresh";
import { staggerContainer, staggerItem } from "@/components/native/motion";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

export default function AccessPoints() {
  const { canManage } = useAuth();
  const qc = useQueryClient();
  const points = useQuery({
    queryKey: ["points"],
    queryFn: () => listAccessPoints().then((r) => r.data),
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createAccessPoint({
        name: name.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["points"] });
      setOpen(false);
      setName("");
      setDescription("");
      setError(null);
      toast.success("Access point created");
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't create."),
  });

  const toggle = useMutation({
    mutationFn: (p: { id: string; isActive: boolean }) =>
      updateAccessPoint(p.id, { isActive: p.isActive }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["points"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAccessPoint(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["points"] });
      toast.success("Access point deleted");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete."),
  });

  return (
    <PullToRefresh onRefresh={() => points.refetch()}>
      <div className="space-y-5">
        <NativeHeader
          title="Access points"
          subtitle={`${points.data?.length ?? 0} configured`}
          action={
            canManage ? (
              <Pressable
                hapticPattern="tap"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                onClick={() => setOpen(true)}
                data-testid="button-add-point"
              >
                <Plus className="h-5 w-5" />
              </Pressable>
            ) : undefined
          }
        />

        {points.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : points.data && points.data.length > 0 ? (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {points.data.map((p) => (
              <motion.div
                key={p.id}
                variants={staggerItem}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                data-testid={`point-${p.id}`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <DoorOpen className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.description ?? (p.isActive ? "Active" : "Inactive")}
                  </p>
                </div>
                {canManage ? (
                  <>
                    <Switch
                      checked={p.isActive}
                      onCheckedChange={(v) => {
                        haptic("select");
                        toggle.mutate({ id: p.id, isActive: v });
                      }}
                      data-testid={`switch-point-${p.id}`}
                    />
                    <Pressable
                      hapticPattern="warning"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-destructive disabled:opacity-50"
                      onClick={() => del.mutate(p.id)}
                      disabled={del.isPending}
                      data-testid={`button-delete-point-${p.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Pressable>
                  </>
                ) : (
                  <span
                    className={
                      p.isActive
                        ? "text-xs font-medium text-success"
                        : "text-xs font-medium text-muted-foreground"
                    }
                  >
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                )}
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
            <DoorOpen className="mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No access points yet</p>
            {canManage && (
              <Button className="mt-4" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add access point
              </Button>
            )}
          </div>
        )}

        <BottomSheet open={open} onOpenChange={setOpen} title="New access point">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main entrance"
                data-testid="input-point-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Description (optional)</Label>
              <Input
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ground floor lobby"
                data-testid="input-point-desc"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="h-12 w-full"
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
              data-testid="button-save-point"
            >
              {create.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </div>
        </BottomSheet>
      </div>
    </PullToRefresh>
  );
}
