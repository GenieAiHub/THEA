import { motion, useReducedMotion } from "framer-motion";
import {
  Cctv,
  ScanFace,
  Car,
  FileVideo,
  BellRing,
  ShieldCheck,
  Eye,
  ChevronRight,
  Camera,
  Crosshair,
  Zap,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Seo } from "@/components/Seo";
import { CtaSection } from "@/components/marketing/CtaSection";
import { breadcrumbJsonLd } from "@/lib/seo";

import heroControlRoom from "@assets/generated_videos/security_control_room_ai.mp4";
import heroVehiclePlate from "@assets/generated_videos/cctv_vehicle_plate_detection.mp4";
import heroPersonTracking from "@assets/generated_videos/walkway_person_tracking.mp4";

import imgOpsCenter from "@assets/generated_images/watch_ops_center.png";
import imgVehiclePlate from "@assets/generated_images/watch_vehicle_plate.png";
import imgPersonMatch from "@assets/generated_images/watch_person_match.png";
import imgMobileAlert from "@assets/generated_images/watch_mobile_alert.png";

function HeroVideo({
  src,
  poster,
  label,
  className = "",
  delay = 0,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-[0_0_40px_rgba(59,130,246,0.12)] ${className}`}
    >
      <video
        src={src}
        poster={poster}
        autoPlay={!reducedMotion}
        controls={!!reducedMotion}
        muted
        loop
        playsInline
        preload={reducedMotion ? "none" : "metadata"}
        className="h-full w-full object-cover"
        aria-label={label}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wider text-white/80">{label}</span>
      </div>
    </motion.div>
  );
}

const steps = [
  {
    image: imgOpsCenter,
    alt: "Security operations center with a wall of AI-monitored camera feeds",
    eyebrow: "Step 1 — Connect",
    title: "Plug in the cameras you already own",
    desc: "Register any RTSP or HTTP camera — lobby, gate, parking, warehouse — and THEA starts sampling frames on your schedule. No new hardware, no proprietary NVR. Your whole network becomes one searchable, intelligent grid.",
    icon: <Camera className="h-5 w-5 text-blue-400" />,
  },
  {
    image: imgPersonMatch,
    alt: "Camera feed with AI detection boxes tracking people, one confirmed match highlighted",
    eyebrow: "Step 2 — Watch",
    title: "Tell THEA who and what to look for",
    desc: "Create watch targets from reference photos: a person of interest, a specific vehicle, or a license plate number. THEA builds a visual signature for each target and quietly compares it against every sampled frame across every camera.",
    icon: <Crosshair className="h-5 w-5 text-blue-400" />,
  },
  {
    image: imgVehiclePlate,
    alt: "CCTV frame with a vehicle detection box and highlighted license plate",
    eyebrow: "Step 3 — Detect",
    title: "Faces, vehicles, and plates — read automatically",
    desc: "On-platform recognition matches faces against your targets, identifies vehicles by visual similarity, and reads license plates straight off the frame — tolerant of the glare, angles, and grain of real-world CCTV.",
    icon: <Zap className="h-5 w-5 text-blue-400" />,
  },
  {
    image: imgMobileAlert,
    alt: "Security professional receiving a sighting alert with a snapshot on their phone",
    eyebrow: "Step 4 — Act",
    title: "Instant alerts with photographic proof",
    desc: "The moment a target is sighted, the right people get notified — email, Slack, Teams, or webhook — with the matched snapshot, camera, confidence score, and timestamp attached. Smart cooldowns stop alert storms without missing new events.",
    icon: <BellRing className="h-5 w-5 text-blue-400" />,
  },
];

const features = [
  {
    icon: <Cctv className="h-6 w-6 text-blue-400" />,
    title: "Live Camera Monitoring",
    desc: "Continuous frame sampling across your entire camera network with per-camera health tracking, so you know instantly when a feed goes dark.",
  },
  {
    icon: <ScanFace className="h-6 w-6 text-blue-400" />,
    title: "Face Matching",
    desc: "Enroll persons of interest with a few reference photos. THEA matches them across cameras with tunable confidence thresholds you control.",
  },
  {
    icon: <Car className="h-6 w-6 text-blue-400" />,
    title: "Vehicle & Plate Recognition",
    desc: "Spot a specific vehicle by appearance or plate number. Plate reading is built for real CCTV — ambiguous characters and partial reads included.",
  },
  {
    icon: <FileVideo className="h-6 w-6 text-blue-400" />,
    title: "Offline Video Scan",
    desc: "Upload recorded footage — up to 500 MB per file — and THEA scans it frame by frame for your targets, pinpointing the exact second of each sighting.",
  },
  {
    icon: <BellRing className="h-6 w-6 text-blue-400" />,
    title: "Multi-Channel Alerts",
    desc: "Sighting alerts flow to email, Slack, Microsoft Teams, or any webhook — each with the snapshot and match details your team needs to respond.",
  },
  {
    icon: <ShieldCheck className="h-6 w-6 text-blue-400" />,
    title: "Private by Design",
    desc: "Everything runs inside your THEA workspace: role-based access, org-scoped data, authenticated snapshots, and automatic retention pruning.",
  },
];

const stats = [
  { value: "24/7", label: "Continuous monitoring across every connected camera" },
  { value: "3-in-1", label: "Faces, vehicles, and license plates in one engine" },
  { value: "< 1 min", label: "From sighting to alert in your team's channels" },
];

export default function SecurityPage() {
  return (
    <PublicLayout>
      <Seo
        title="THEA Security Watch — AI Visual Search & Alerts for Your Camera Network"
        description="Turn the cameras you already own into an intelligent watch grid. THEA Security Watch finds people, vehicles, and license plates across live feeds and recorded footage — and alerts your team the moment a target appears."
        path="/security"
        jsonLd={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Security Watch", path: "/security" },
        ])}
      />

      {/* Hero with live video wall */}
      <section className="relative overflow-hidden px-6 pt-40 pb-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-14 max-w-4xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">
              <Eye className="h-4 w-4" />
              THEA Security Watch
            </div>
            <h1 className="mb-6 bg-gradient-to-br from-white via-white to-blue-200 bg-clip-text font-display text-4xl font-bold leading-[1.1] tracking-tight text-transparent md:text-6xl">
              Your cameras, finally watching for you
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Security Watch turns any camera network into an AI-powered watch grid — finding the
              people, vehicles, and license plates that matter, across live feeds and recorded
              footage, and alerting your team with photographic proof the moment they appear.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" className="h-12 bg-blue-600 px-8 text-white hover:bg-blue-500" asChild>
                <Link href="/sign-up">Start Watching</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 border-white/10 bg-black/20 px-8 hover:bg-white/5"
                asChild
              >
                <Link href="/pricing">See Plans</Link>
              </Button>
            </div>
          </motion.div>

          {/* Video wall */}
          <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
            <HeroVideo
              src={heroControlRoom}
              poster={imgOpsCenter}
              label="Operations Center"
              className="aspect-video md:col-span-2 md:row-span-2 md:aspect-auto"
              delay={0.15}
            />
            <HeroVideo
              src={heroVehiclePlate}
              poster={imgVehiclePlate}
              label="Vehicle + Plate Lock"
              className="aspect-video"
              delay={0.3}
            />
            <HeroVideo
              src={heroPersonTracking}
              poster={imgPersonMatch}
              label="Person Tracking"
              className="aspect-video"
              delay={0.45}
            />
          </div>

          {/* Stats strip */}
          <div className="mt-14 grid gap-6 border-t border-white/5 pt-10 sm:grid-cols-3">
            {stats.map((s, i) => (
              <motion.div
                key={s.value}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-display text-3xl font-bold text-white md:text-4xl">{s.value}</div>
                <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — image steps */}
      <section className="border-y border-white/5 bg-black/40 px-6 py-24 backdrop-blur-md">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">
              From camera feed to confirmed sighting
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Four steps between "we have cameras" and "we know the moment they arrive."
            </p>
          </div>

          <div className="space-y-24">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
                  i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                  <img src={step.image} alt={step.alt} className="w-full object-cover" loading="lazy" />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
                </div>
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">
                    {step.icon}
                    {step.eyebrow}
                  </div>
                  <h3 className="mb-4 font-display text-2xl font-bold text-white md:text-3xl">
                    {step.title}
                  </h3>
                  <p className="text-lg leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">
              Everything a modern watch desk needs
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Built into the same THEA workspace your team already uses — no separate VMS contract,
              no per-camera analytics fees.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-7 transition-all hover:border-blue-500/50 hover:bg-white/[0.04]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-14 flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-blue-400" />
            Recorded footage from before you set up a target? Upload it — Security Watch scans the
            past as easily as the present.
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/platform"
              className="inline-flex items-center gap-2 font-medium text-blue-400 hover:text-blue-300"
            >
              See the full THEA platform <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <CtaSection
        title="Know the moment they appear"
        description="Connect your cameras, set your watch targets, and let THEA Security Watch keep eyes on every feed — day and night."
        primaryLabel="Start Watching"
        primaryHref="/sign-up"
        secondaryLabel="Talk to Us"
        secondaryHref="/pricing"
      />
    </PublicLayout>
  );
}
