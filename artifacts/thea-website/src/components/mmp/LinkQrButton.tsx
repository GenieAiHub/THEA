import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { QrCode, Download } from "lucide-react";

export function LinkQrButton({ url, name, code }: { url: string; name: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 512, margin: 2 }).then(setPng).catch(() => setPng(null));
    QRCode.toString(url, { type: "svg", margin: 2 }).then(setSvg).catch(() => setSvg(null));
  }, [open, url]);

  const download = (href: string, ext: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = `qr-${code}.${ext}`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Show QR code" data-testid={`button-qr-${code}`}>
          <QrCode className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code — {name}</DialogTitle>
          <DialogDescription className="break-all text-xs">{url}</DialogDescription>
        </DialogHeader>
        {png ? (
          <img src={png} alt={`QR code for ${name}`} className="w-64 h-64 mx-auto rounded-lg border" data-testid={`img-qr-${code}`} />
        ) : (
          <div className="w-64 h-64 mx-auto rounded-lg border flex items-center justify-center text-sm text-muted-foreground">
            Generating…
          </div>
        )}
        <div className="flex gap-2">
          <Button
            className="flex-1" variant="outline"
            disabled={!png}
            onClick={() => png && download(png, "png")}
            data-testid={`button-qr-png-${code}`}
          >
            <Download className="w-4 h-4 mr-2" /> PNG
          </Button>
          <Button
            className="flex-1" variant="outline"
            disabled={!svg}
            onClick={() => svg && download(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, "svg")}
            data-testid={`button-qr-svg-${code}`}
          >
            <Download className="w-4 h-4 mr-2" /> SVG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
