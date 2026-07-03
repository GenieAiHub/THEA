import { useState } from "react";
import {
  useAdminPlans,
  useAdminCreatePlan,
  useAdminUpdatePlan,
  useAdminDeletePlan,
  type AdminPlan,
  type PlanInput,
} from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Trash2, Pencil, X } from "lucide-react";

const TIERS = ["starter", "pro", "enterprise"];

const tierStyles: Record<string, string> = {
  starter: "text-muted-foreground border-border bg-muted/30",
  pro: "text-primary border-primary/30 bg-primary/10",
  enterprise: "text-amber-400 border-amber-400/30 bg-amber-400/10",
};

const emptyForm: PlanInput = {
  key: "",
  name: "",
  description: "",
  tier: "pro",
  priceMonthly: 0,
  priceAnnual: 0,
  features: [],
  active: true,
  sortOrder: 0,
};

function PlanForm({ initial, onClose }: { initial?: AdminPlan; onClose: () => void }) {
  const create = useAdminCreatePlan();
  const update = useAdminUpdatePlan();
  const { toast } = useToast();
  const isEdit = !!initial;

  const [key, setKey] = useState(initial?.key ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tier, setTier] = useState(initial?.tier ?? "pro");
  const [priceMonthly, setPriceMonthly] = useState(initial?.priceMonthly ?? 0);
  const [priceAnnual, setPriceAnnual] = useState(initial?.priceAnnual ?? 0);
  const [featuresText, setFeaturesText] = useState((initial?.features ?? []).join("\n"));
  const [active, setActive] = useState(initial?.active ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);

  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (!key.trim() || !name.trim()) {
      toast({ title: "Key and name are required", variant: "destructive" });
      return;
    }
    const features = featuresText.split("\n").map((f) => f.trim()).filter(Boolean);
    const payload: PlanInput = {
      key: key.trim(),
      name: name.trim(),
      description: description.trim() || null,
      tier,
      priceMonthly: Number(priceMonthly) || 0,
      priceAnnual: Number(priceAnnual) || 0,
      features,
      active,
      sortOrder: Number(sortOrder) || 0,
    };

    if (isEdit) {
      update.mutate(
        { id: initial!.id, ...payload },
        {
          onSuccess: () => { toast({ title: "Plan updated" }); onClose(); },
          onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => { toast({ title: "Plan created" }); onClose(); },
        onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
      });
    }
  };

  return (
    <div className="border border-primary/30 rounded-sm p-5 space-y-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-mono font-bold">{isEdit ? `Edit — ${initial!.name}` : "New Plan"}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-plan-form">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Key (unique slug)</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. professional"
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
            data-testid="input-plan-key"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Professional"
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
            data-testid="input-plan-name"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Description</label>
        <textarea
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Who this plan is for"
          rows={2}
          className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm resize-none"
          data-testid="input-plan-description"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Tier granted</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm uppercase"
            data-testid="select-plan-tier"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Monthly ($)</label>
          <input
            type="number"
            min={0}
            value={priceMonthly}
            onChange={(e) => setPriceMonthly(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
            data-testid="input-plan-monthly"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Annual ($/mo)</label>
          <input
            type="number"
            min={0}
            value={priceAnnual}
            onChange={(e) => setPriceAnnual(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
            data-testid="input-plan-annual"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Sort order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm"
            data-testid="input-plan-sort"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Features (one per line)</label>
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          placeholder={"Up to 25 tracked keywords\n10 categories\n90 days of history"}
          rows={4}
          className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm resize-none"
          data-testid="input-plan-features"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            data-testid="checkbox-plan-active"
          />
          Active (visible &amp; grantable)
        </label>
        <button
          onClick={submit}
          disabled={pending}
          className="px-4 py-2 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
          data-testid="button-submit-plan"
        >
          {pending ? "Saving..." : isEdit ? "Save changes" : "Create plan"}
        </button>
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { data, isLoading } = useAdminPlans();
  const deletePlan = useAdminDeletePlan();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const plans: AdminPlan[] = data ?? [];

  const handleDelete = (p: AdminPlan) => {
    if (!window.confirm(`Delete plan "${p.name}"? This only removes it from the catalogue — orgs already on this tier keep their access.`)) return;
    deletePlan.mutate(p.id, {
      onSuccess: () => toast({ title: "Plan deleted" }),
      onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground">Plan Catalogue</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {plans.length} plan{plans.length !== 1 ? "s" : ""} — manage packages, pricing &amp; features. Checkout charges are unaffected.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowCreate((s) => !s); }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono border border-border rounded-sm hover:bg-muted transition-colors"
          data-testid="button-new-plan"
        >
          <Plus className="h-3.5 w-3.5" />
          New Plan
        </button>
      </div>

      {showCreate && !editing && <PlanForm onClose={() => setShowCreate(false)} />}
      {editing && <PlanForm initial={editing} onClose={() => setEditing(null)} />}

      <div className="border border-border rounded-sm overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Plan</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Key</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Tier</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Monthly</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Annual/mo</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Features</th>
              <th className="text-left px-4 py-2.5 text-muted-foreground font-normal">Status</th>
              <th className="text-right px-4 py-2.5 text-muted-foreground font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            ) : plans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8 opacity-30" />
                    <span>No plans yet. Create one to build your catalogue.</span>
                  </div>
                </td>
              </tr>
            ) : (
              plans.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors align-top" data-testid={`row-plan-${p.id}`}>
                  <td className="px-4 py-3">
                    <div className="text-foreground font-semibold">{p.name}</div>
                    {p.description && <div className="text-muted-foreground mt-0.5 max-w-xs">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-primary">{p.key}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 border rounded-sm uppercase text-[10px] tracking-wider ${tierStyles[p.tier] ?? ""}`}>
                      {p.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground">${p.priceMonthly}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">${p.priceAnnual}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">
                    {p.features.length === 0 ? "—" : (
                      <ul className="space-y-0.5">
                        {p.features.map((f, i) => (
                          <li key={i} className="truncate">• {f}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.active ? (
                      <span className="px-2 py-0.5 border rounded-sm uppercase text-[10px] tracking-wider text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
                        active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 border rounded-sm uppercase text-[10px] tracking-wider text-muted-foreground border-border bg-muted/30">
                        hidden
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setShowCreate(false); setEditing(p); }}
                        title="Edit plan"
                        className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`button-edit-${p.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        title="Delete plan"
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        data-testid={`button-delete-${p.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
