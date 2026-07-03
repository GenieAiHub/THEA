import { useState } from "react";
import {
  useAdminOrgs,
  useAdminOrg,
  useAdminSetOrgTier,
  useAdminPauseOrg,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, X, Ban, CheckCircle2, Package } from "lucide-react";

const TIERS = ["starter", "pro", "enterprise"];

const tierStyles: Record<string, string> = {
  starter: "text-muted-foreground border-border bg-muted/30",
  pro: "text-primary border-primary/30 bg-primary/10",
  enterprise: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  focus: string | null;
  tier: string;
  subscriptionStatus: string;
  memberCount: number;
  isPaused: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

function OrgDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading } = useAdminOrg(id);
  const org = data as any;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-border rounded-sm bg-card p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono font-bold">
            {isLoading ? "Loading..." : org?.name}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-detail">
            <X className="h-4 w-4" />
          </button>
        </div>

        {org && (
          <>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <Field label="Slug" value={org.slug} />
              <Field label="Focus" value={org.focus ?? "—"} />
              <Field label="Tier" value={org.subscription?.tier ?? "starter"} />
              <Field label="Subscription" value={org.subscription?.status ?? "none"} />
              <Field label="Paused" value={org.pausedAt ? "yes" : "no"} />
              <Field label="Onboarding" value={org.onboardingCompletedAt ? "complete" : "pending"} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-mono font-bold">
                  Members ({org.members?.length ?? 0})
                </span>
              </div>
              <div className="border border-border rounded-sm overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-3 py-2 text-muted-foreground font-normal">Name</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-normal">Email</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-normal">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(org.members ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">No members</td>
                      </tr>
                    ) : (
                      org.members.map((m: any) => (
                        <tr key={m.id} className="border-b border-border/50">
                          <td className="px-3 py-2 text-foreground">{m.name ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{m.email}</td>
                          <td className="px-3 py-2 text-primary">{m.role}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}

export default function OrgsPage() {
  const { data, isLoading } = useAdminOrgs();
  const setTier = useAdminSetOrgTier();
  const pauseOrg = useAdminPauseOrg();
  const { toast } = useToast();
  const [detailId, setDetailId] = useState<string | null>(null);
  const orgs: AdminOrg[] = data ?? [];

  const handleTier = (org: AdminOrg, tier: string) => {
    if (tier === org.tier) return;
    setTier.mutate(
      { id: org.id, tier },
      {
        onSuccess: () => toast({ title: `${org.name} → ${tier}`, description: "Package updated" }),
        onError: (e: any) => toast({ title: "Failed to update package", description: e.message, variant: "destructive" }),
      },
    );
  };

  const handlePause = (org: AdminOrg) => {
    const paused = !org.isPaused;
    if (paused && !window.confirm(`Suspend "${org.name}"? Members will lose access until reactivated.`)) return;
    pauseOrg.mutate(
      { id: org.id, paused },
      {
        onSuccess: () => toast({ title: paused ? `${org.name} suspended` : `${org.name} reactivated` }),
        onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground">Users &amp; Organizations</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {orgs.length} registered organization{orgs.length !== 1 ? "s" : ""} — manage packages &amp; access
          </p>
        </div>
      </div>

      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Name</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Slug</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Package</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Status</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Members</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Created</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Building2 className="h-8 w-8 opacity-30" />
                    <span>No organizations yet.</span>
                  </div>
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-org-${org.id}`}>
                  <td className="px-4 py-3 text-foreground font-semibold">{org.name}</td>
                  <td className="px-4 py-3 text-primary">{org.slug}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <select
                        value={org.tier}
                        onChange={(e) => handleTier(org, e.target.value)}
                        disabled={setTier.isPending}
                        className={`px-2 py-1 text-[11px] font-mono rounded-sm border uppercase tracking-wider bg-background ${tierStyles[org.tier] ?? ""}`}
                        data-testid={`select-tier-${org.id}`}
                      >
                        {TIERS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {org.isPaused ? (
                      <span className="px-2 py-0.5 border rounded-sm uppercase text-[10px] tracking-wider text-destructive border-destructive/30 bg-destructive/10">
                        suspended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 border rounded-sm uppercase text-[10px] tracking-wider text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                        active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">{org.memberCount}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setDetailId(org.id)}
                        title="View members"
                        className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`button-detail-${org.id}`}
                      >
                        <Users className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handlePause(org)}
                        disabled={pauseOrg.isPending}
                        title={org.isPaused ? "Reactivate" : "Suspend"}
                        className={`p-1.5 transition-colors ${org.isPaused ? "text-muted-foreground hover:text-emerald-400" : "text-muted-foreground hover:text-destructive"}`}
                        data-testid={`button-pause-${org.id}`}
                      >
                        {org.isPaused ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detailId && <OrgDetailModal id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
