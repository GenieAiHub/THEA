import { useEffect, useRef } from "react";

/**
 * A self-contained, GPU-light rotating "intelligence" globe drawn on a 2D
 * canvas. Points are distributed on a Fibonacci sphere, rotated around the
 * Y axis each frame, and only the front hemisphere is drawn so it reads as a
 * spinning planet. A handful of "hot" points glow/pulse (live data hits) and
 * a few satellites trace orbital light trails around it. No external data,
 * no network, no dependencies. Honours prefers-reduced-motion.
 */
export function IntelGlobe({ size = 360 }: { size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.4;

    const N = 1500;
    const pts: { x: number; y: number; z: number; hot: boolean }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      pts.push({
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        hot: Math.random() < 0.06,
      });
    }

    const sats = [0, 1, 2].map((i) => ({
      tilt: (i * Math.PI) / 3 + 0.4,
      speed: 0.5 + i * 0.22,
      phase: Math.random() * Math.PI * 2,
      rx: R * 1.3,
      ry: R * 0.4,
    }));

    let angle = 0;
    let t = 0;
    let raf = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // outer atmospheric glow
      const glow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.6);
      glow.addColorStop(0, "rgba(37,99,235,0.22)");
      glow.addColorStop(0.55, "rgba(29,78,216,0.07)");
      glow.addColorStop(1, "rgba(2,6,23,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // sphere body
      const body = ctx.createRadialGradient(
        cx - R * 0.35,
        cy - R * 0.35,
        R * 0.1,
        cx,
        cy,
        R,
      );
      body.addColorStop(0, "rgba(17,35,71,0.95)");
      body.addColorStop(1, "rgba(4,10,24,0.98)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      for (const p of pts) {
        const x = p.x * cosA - p.z * sinA;
        const z = p.x * sinA + p.z * cosA;
        if (z < 0) continue; // back hemisphere hidden
        const sx = cx + x * R;
        const sy = cy - p.y * R;
        if (p.hot) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3 + p.x * 12);
          ctx.beginPath();
          ctx.fillStyle = `rgba(56,189,248,${0.12 * z})`;
          ctx.arc(sx, sy, 5 + 3 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = `rgba(165,243,252,${0.55 + 0.45 * z})`;
          ctx.arc(sx, sy, 1.5 + 1.3 * z + pulse, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.fillStyle = `rgba(96,165,250,${0.16 + 0.5 * z})`;
          ctx.arc(sx, sy, 0.6 + 1.1 * z, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // rim light
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(96,165,250,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // orbital trails ("starlink" lights)
      for (const s of sats) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(s.tilt);
        ctx.beginPath();
        ctx.ellipse(0, 0, s.rx, s.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(96,165,250,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        const a = s.phase + t * s.speed;
        const px = Math.cos(a) * s.rx;
        const py = Math.sin(a) * s.ry;
        ctx.beginPath();
        ctx.fillStyle = "rgba(125,211,252,0.25)";
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = "rgba(224,242,254,0.95)";
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (!reduce) {
        angle += 0.0035;
        t += 0.016;
        raf = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%" }}
      className="block"
      aria-hidden="true"
    />
  );
}
