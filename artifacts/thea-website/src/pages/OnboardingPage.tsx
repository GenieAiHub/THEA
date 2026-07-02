import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Zap,
  Bell,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Building2,
  LayoutDashboard,
  Plus,
  X,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Welcome", icon: <Building2 className="w-5 h-5" /> },
  { id: 2, label: "Org Setup", icon: <Building2 className="w-5 h-5" /> },
  { id: 3, label: "Watchlist", icon: <Target className="w-5 h-5" /> },
  { id: 4, label: "Alerts", icon: <Bell className="w-5 h-5" /> },
  { id: 5, label: "Ready", icon: <CheckCircle2 className="w-5 h-5" /> },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [keywords, setKeywords] = useState<string[]>(["My Brand", "Competitor A"]);
  const [kwInput, setKwInput] = useState("");
  const [emailDigest, setEmailDigest] = useState(true);

  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords((ks) => [...ks, kw]);
    }
    setKwInput("");
  };

  const removeKeyword = (kw: string) => {
    setKeywords((ks) => ks.filter((k) => k !== kw));
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-[100dvh] bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-xl z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/logo.png`} alt="THEA" className="w-12 h-12" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => s.id < step && setStep(s.id)}
                className={`flex flex-col items-center gap-1 transition-all ${s.id <= step ? "opacity-100" : "opacity-30"} ${s.id < step ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  s.id < step
                    ? "bg-blue-600 border-blue-600"
                    : s.id === step
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-800 bg-transparent"
                }`}>
                  {s.id < step
                    ? <CheckCircle2 className="w-4 h-4 text-white" />
                    : <span className="text-xs font-bold text-slate-300">{s.id}</span>}
                </div>
                <span className="text-[10px] text-slate-500 hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-1 bg-slate-800 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-500"
                    style={{ width: step > s.id ? "100%" : "0%" }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="h-1 w-full bg-slate-800 rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step content */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
                <LayoutDashboard className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-white mb-3">Welcome to THEA</h1>
                <p className="text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Your Total Human Engagement Analytics platform is ready. Let's configure your workspace in 4 quick steps.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { icon: <Target className="w-4 h-4 text-blue-400" />, label: "Monitor topics & entities" },
                  { icon: <Bell className="w-4 h-4 text-orange-400" />, label: "Real-time alert inbox" },
                  { icon: <Zap className="w-4 h-4 text-purple-400" />, label: "AI response generation" },
                  { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, label: "Crisis probability scoring" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
                    {f.icon}
                    <span className="text-sm text-slate-300">{f.label}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12 text-base"
                onClick={() => setStep(2)}
              >
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Step 2: Org setup */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-1">Organisation Setup</h2>
                <p className="text-slate-400 text-sm">Tell THEA about your organisation.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-sm">Organisation Name *</Label>
                  <Input
                    placeholder="e.g. Acme Corporation"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-sm">Industry</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Technology", "Finance", "Healthcare", "Energy", "Retail", "Government", "Media", "Other"].map((ind) => (
                      <button
                        key={ind}
                        onClick={() => setIndustry(ind)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          industry === ind
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                        }`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1 text-slate-400 hover:text-slate-200" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                  onClick={() => setStep(3)}
                  disabled={!orgName}
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Watchlist keywords */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-1">Watchlist Keywords</h2>
                <p className="text-slate-400 text-sm">Define the entities, brands, and topics THEA should monitor.</p>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a keyword or entity..."
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                  <Button onClick={addKeyword} disabled={!kwInput.trim()} className="bg-slate-700 hover:bg-slate-600 shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800 min-h-[56px]">
                    {keywords.map((kw) => (
                      <Badge
                        key={kw}
                        variant="outline"
                        className="bg-blue-500/10 text-blue-300 border-blue-500/20 flex items-center gap-1.5 px-3 py-1"
                      >
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-600">
                  Tip: Add your brand name, key competitors, and product names. You can always add more later.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1 text-slate-400 hover:text-slate-200" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                  onClick={() => setStep(4)}
                  disabled={keywords.length === 0}
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Alert preferences */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-1">Alert Preferences</h2>
                <p className="text-slate-400 text-sm">Configure how THEA notifies you when intelligence triggers.</p>
              </div>
              <div className="space-y-3">
                {[
                  { id: "critical_realtime", label: "Immediate alerts for critical severity", checked: true, always: true },
                  { id: "email_digest", label: "Daily email intelligence digest", checked: emailDigest, toggle: () => setEmailDigest((v) => !v) },
                  { id: "weekly_summary", label: "Weekly trend summary report", checked: true, always: false },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                    <div>
                      <p className="text-sm text-slate-200">{item.label}</p>
                      {item.always && <p className="text-xs text-slate-600 mt-0.5">Always enabled for critical alerts</p>}
                    </div>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${
                      item.checked ? "bg-blue-600" : "bg-slate-700"
                    } ${item.always ? "opacity-60 cursor-not-allowed" : ""}`}
                    onClick={item.toggle}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        item.checked ? "translate-x-5" : "translate-x-0.5"
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" className="flex-1 text-slate-400 hover:text-slate-200" onClick={() => setStep(3)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-500"
                  onClick={() => setStep(5)}
                >
                  Finish Setup <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Ready */}
          {step === 5 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold text-white mb-2">You're all set!</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  <strong className="text-slate-200">{orgName || "Your organisation"}</strong> is configured with{" "}
                  <strong className="text-blue-400">{keywords.length} watchlist keywords</strong>. THEA is now monitoring the intelligence landscape for you.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 text-left">
                {[
                  { icon: <Target className="w-4 h-4 text-blue-400" />, label: "Watchlist configured", detail: `${keywords.length} keywords` },
                  { icon: <Bell className="w-4 h-4 text-orange-400" />, label: "Alert routing active", detail: "Critical: immediate" },
                  { icon: <Zap className="w-4 h-4 text-emerald-400" />, label: "Intelligence engine running", detail: "Live" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span className="text-sm text-slate-200">{item.label}</span>
                    </div>
                    <span className="text-xs text-slate-500">{item.detail}</span>
                  </div>
                ))}
              </div>
              <Link href="/dashboard">
                <Button className="w-full bg-blue-600 hover:bg-blue-500 h-12 text-base">
                  <LayoutDashboard className="w-5 h-5 mr-2" />
                  Enter Mission Control
                </Button>
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
