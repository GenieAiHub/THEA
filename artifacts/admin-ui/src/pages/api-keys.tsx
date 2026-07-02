import { useState } from "react";
import { useAdminConfigs, useAdminUpsertConfig } from "@/hooks/use-admin";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";

const CATEGORY_ORDER = [
  "llm",
  "news",
  "social",
  "crawler",
  "payments",
  "crypto",
  "email",
  "notifications",
  "simulation",
  "disinformation",
  "general",
];
const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM / AI",
  news: "News & Ingestion Feeds",
  social: "Social Media",
  crawler: "Web Crawler",
  payments: "Payments",
  crypto: "Crypto Payments",
  email: "Email Delivery",
  notifications: "Notifications",
  simulation: "What-If Simulation",
  disinformation: "Disinformation",
  general: "General",
};

// Keys bound once at process boot — an admin edit needs a server restart to apply.
// Everything else resolves DB-first with a ~5-min cache, so edits take effect
// within minutes without a restart.
const RESTART_REQUIRED_KEYS = new Set<string>(["telegram_bot_token"]);

function ConfigRow({ config, onSave }: { config: any; onSave: (key: string, value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [showValue, setShowValue] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(config.key, value);
      setValue("");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm(`Clear value for "${config.label}"?`)) return;
    setSaving(true);
    try {
      await onSave(config.key, "");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0">
            {config.hasValue ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground/40" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-foreground">{config.label}</span>
              {config.isSecret && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded-sm text-muted-foreground">
                  SECRET
                </span>
              )}
              {RESTART_REQUIRED_KEYS.has(config.key) && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-500/15 text-amber-500 rounded-sm">
                  RESTART REQUIRED
                </span>
              )}
            </div>
            <div className="text-xs font-mono text-muted-foreground/60 mt-0.5 truncate">
              {config.key}
              {config.description ? ` — ${config.description}` : ""}
            </div>
            {!config.isSecret && config.hasValue && config.value && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xs font-mono text-primary/80">
                  {showValue ? config.value : "•".repeat(Math.min(config.value.length, 20))}
                </span>
                <button
                  onClick={() => setShowValue((v) => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showValue ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {config.hasValue && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="text-xs font-mono text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setEditing((e) => !e)}
            className="flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
          >
            {editing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {config.hasValue ? "Update" : "Set"}
          </button>
        </div>
      </div>

      {editing && (
        <div className="px-4 pb-4 pt-1 bg-muted/5 border-t border-border/30">
          <div className="flex gap-2 mt-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={config.isSecret ? "Paste secret value..." : "Enter value..."}
              className="flex-1 bg-background border border-border rounded-sm px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-mono rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setValue(""); }}
              className="px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground border border-border rounded-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiKeysPage() {
  const { data, isLoading, refetch } = useAdminConfigs();
  const upsert = useAdminUpsertConfig();

  const configs: any[] = data ?? [];

  // Render known categories first, then any category present in the data that we
  // don't have an explicit order for — so a config is never silently hidden.
  const extraCats = Array.from(new Set(configs.map((c: any) => c.category as string))).filter(
    (c) => !CATEGORY_ORDER.includes(c),
  );
  const orderedCats = [...CATEGORY_ORDER, ...extraCats];

  const grouped = orderedCats.reduce<Record<string, any[]>>((acc, cat) => {
    acc[cat] = configs.filter((c: any) => c.category === cat);
    return acc;
  }, {});

  const configuredCount = configs.filter((c: any) => c.hasValue).length;

  const handleSave = async (key: string, value: string) => {
    await upsert.mutateAsync({ key, value });
    await refetch();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground">Platform API Keys</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {configuredCount} / {configs.length} configured — values are AES-256-GCM encrypted at rest
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs font-mono text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          {orderedCats.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            const catConfigured = items.filter((c: any) => c.hasValue).length;
            return (
              <div key={cat} className="border border-border rounded-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                  <span className="text-xs font-mono text-primary/70">
                    {catConfigured}/{items.length}
                  </span>
                </div>
                <div>
                  {items.map((config: any) => (
                    <ConfigRow key={config.key} config={config} onSave={handleSave} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
