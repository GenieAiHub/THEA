import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAdminConfigs, useAdminUpsertConfig } from "@/hooks/use-admin";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, Copy, Check, ExternalLink } from "lucide-react";

const LINKS = [
  { key: "mobile_app_android_url", label: "Android (Play Store / APK)" },
  { key: "mobile_app_ios_url", label: "iOS (App Store / TestFlight)" },
];

function LinkCard({ configKey, label }: { configKey: string; label: string }) {
  const { data: configs } = useAdminConfigs();
  const upsert = useAdminUpsertConfig();
  const { toast } = useToast();
  const cfg = (configs ?? []).find((c: any) => c.key === configKey);
  const savedValue: string = cfg?.value ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const value = draft ?? savedValue;
  const dirty = draft !== null && draft !== savedValue;

  const save = () => {
    const v = (draft ?? "").trim();
    upsert.mutate(
      { key: configKey, value: v },
      {
        onSuccess: () => { setDraft(null); toast({ title: "Link saved" }); },
        onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
      },
    );
  };

  const copy = async () => {
    if (!savedValue) return;
    await navigator.clipboard.writeText(savedValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isValidUrl = /^https?:\/\/.+/i.test(savedValue);

  return (
    <div className="border border-border rounded-sm p-5 space-y-4 bg-card/40">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-primary" />
        <span className="text-sm font-mono font-bold">{label}</span>
      </div>

      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://..."
          className="flex-1 px-3 py-2 text-xs font-mono bg-background border border-border rounded-sm text-foreground placeholder:text-muted-foreground/50"
          data-testid={`input-${configKey}`}
        />
        <button
          onClick={save}
          disabled={upsert.isPending || !dirty}
          className="px-3 py-2 text-xs font-mono bg-primary text-primary-foreground rounded-sm hover:opacity-90 disabled:opacity-50"
          data-testid={`button-save-${configKey}`}
        >
          Save
        </button>
      </div>

      {isValidUrl ? (
        <div className="flex items-center gap-5">
          <div className="bg-white p-2 rounded-sm shrink-0">
            <QRCodeSVG value={savedValue} size={104} data-testid={`qr-${configKey}`} />
          </div>
          <div className="space-y-2 min-w-0">
            <a
              href={savedValue}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-mono text-primary hover:underline truncate"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{savedValue}</span>
            </a>
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono border border-border rounded-sm hover:bg-muted transition-colors"
              data-testid={`button-copy-${configKey}`}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[11px] font-mono text-muted-foreground">
          {savedValue ? "Enter a valid http(s) URL to generate a QR code." : "No link set yet — paste a download URL and save."}
        </p>
      )}
    </div>
  );
}

export default function MobileAppPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-mono font-bold text-foreground flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" /> Mobile App
        </h1>
        <p className="text-xs font-mono text-muted-foreground mt-1">
          Download links for THEA Access — share the QR code or copy the URL
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {LINKS.map((l) => (
          <LinkCard key={l.key} configKey={l.key} label={l.label} />
        ))}
      </div>
    </div>
  );
}
