import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  DoorOpen,
  Loader2,
  Mail,
  Phone,
  Plus,
  ScanFace,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CameraCapture } from "@/components/CameraCapture";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MemberDetail() {
  const { canManage } = useAuth();
  const [, params] = useRoute("/members/:id");
  const [, navigate] = useLocation();
  const id = params?.id ?? "";
  const qc = useQueryClient();

  const member = useQuery({
    queryKey: ["member", id],
    queryFn: () => api.getMember(id),
    enabled: !!id,
  });
  const points = useQuery({ queryKey: ["points"], queryFn: api.listPoints });
  const grants = useQuery({
    queryKey: ["grants", { memberId: id }],
    queryFn: () => api.listGrants({ memberId: id }),
    enabled: !!id,
  });

  const [cameraOpen, setCameraOpen] = useState(false);
  const [grantPoint, setGrantPoint] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const enroll = useMutation({
    mutationFn: (base64: string) => api.enrollFace(id, base64),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["member", id] });
      void qc.invalidateQueries({ queryKey: ["members"] });
      setCameraOpen(false);
      toast.success("Face enrolled");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't enroll face.",
      );
    },
  });

  const removeFace = useMutation({
    mutationFn: (faceId: string) => api.deleteFace(id, faceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["member", id] });
      toast.success("Face removed");
    },
  });

  const addGrant = useMutation({
    mutationFn: (accessPointId: string) =>
      api.createGrant({ memberId: id, accessPointId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["grants", { memberId: id }] });
      setGrantPoint("");
      toast.success("Access granted");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't add access."),
  });

  const removeGrant = useMutation({
    mutationFn: (grantId: string) => api.deleteGrant(grantId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["grants", { memberId: id }] });
      toast.success("Access removed");
    },
  });

  const del = useMutation({
    mutationFn: () => api.deleteMember(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member deleted");
      navigate("/members");
    },
  });

  const grantedPointIds = new Set((grants.data ?? []).map((g) => g.accessPointId));
  const availablePoints = (points.data ?? []).filter(
    (p) => !grantedPointIds.has(p.id),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/members"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        data-testid="link-back-members"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Members
      </Link>

      {member.isLoading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : member.data ? (
        <>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-lg font-semibold text-primary">
              {initials(member.data.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">
                {member.data.fullName}
              </h1>
              <Badge
                variant={member.data.status === "active" ? "outline" : "secondary"}
                className="mt-1 capitalize"
              >
                {member.data.status}
              </Badge>
            </div>
          </div>

          {(member.data.email || member.data.phone) && (
            <div className="space-y-2">
              {member.data.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {member.data.email}
                </div>
              )}
              {member.data.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {member.data.phone}
                </div>
              )}
            </div>
          )}

          {/* Faces */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Enrolled faces ({member.data.faces.length})
              </h2>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                  data-testid="button-enroll-face"
                >
                  <Camera className="mr-2 h-4 w-4" /> Enroll
                </Button>
              )}
            </div>
            {member.data.faces.length > 0 ? (
              <div className="space-y-2">
                {member.data.faces.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    data-testid={`face-${f.id}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                      <ScanFace className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Enrolled {format(new Date(f.createdAt), "MMM d, yyyy")}
                      </p>
                      {f.quality != null && (
                        <p className="text-xs text-muted-foreground">
                          Quality {(f.quality * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeFace.mutate(f.id)}
                        disabled={removeFace.isPending}
                        data-testid={`button-remove-face-${f.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No faces enrolled. Add one so this member can be recognized.
              </p>
            )}
          </section>

          {/* Grants */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Access ({grants.data?.length ?? 0})
            </h2>
            {canManage && availablePoints.length > 0 && (
              <div className="mb-3 flex gap-2">
                <Select value={grantPoint} onValueChange={setGrantPoint}>
                  <SelectTrigger data-testid="select-grant-point">
                    <SelectValue placeholder="Grant access to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePoints.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  onClick={() => grantPoint && addGrant.mutate(grantPoint)}
                  disabled={!grantPoint || addGrant.isPending}
                  data-testid="button-add-grant"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            )}
            {grants.data && grants.data.length > 0 ? (
              <div className="space-y-2">
                {grants.data.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    data-testid={`grant-${g.id}`}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                      <DoorOpen className="h-4.5 w-4.5 text-accent-foreground" />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {g.accessPointName ?? "Access point"}
                    </p>
                    {canManage && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeGrant.mutate(g.id)}
                        disabled={removeGrant.isPending}
                        data-testid={`button-remove-grant-${g.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No access granted yet.
              </p>
            )}
          </section>

          {canManage && (
            <Button
              variant="outline"
              className="w-full text-destructive"
              onClick={() => setConfirmDelete(true)}
              data-testid="button-delete-member"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete member
            </Button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Member not found.</p>
      )}

      <CameraCapture
        open={cameraOpen}
        busy={enroll.isPending}
        title="Enroll a face"
        hint="Capture a clear, front-facing photo"
        onClose={() => setCameraOpen(false)}
        onCapture={(base64) => enroll.mutate(base64)}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this member?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {member.data?.fullName}, their enrolled
              faces, and all access grants. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate()}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-member"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
