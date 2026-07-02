import React from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, ShieldAlert, Zap, ArrowRight, LayoutDashboard, Target } from "lucide-react";

export default function OnboardingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#020617] text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-background to-background pointer-events-none"></div>
      
      <div className="w-full max-w-2xl z-10">
        <div className="mb-8 flex justify-center">
          <img src={`${import.meta.env.BASE_URL || ""}/logo.svg`} alt="THEA Logo" className="w-16 h-16" />
        </div>
        
        <h1 className="text-4xl font-display font-bold text-center text-white mb-4 tracking-tight">Welcome to THEA</h1>
        <p className="text-center text-slate-400 mb-12 text-lg">Your intelligence engine is initialized and ready for configuration.</p>

        <div className="space-y-4 mb-12">
          
          <Card className="bg-slate-900/80 border-slate-800 hover:border-blue-500/50 transition-colors group">
            <CardContent className="p-6 flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Target className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-100 text-lg mb-1">1. Add Watchlist Keywords</h3>
                <p className="text-slate-400 text-sm">Define the entities, competitors, and topics THEA should monitor directly.</p>
              </div>
              <Link href="/watchlist">
                <Button variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 shrink-0">
                  Configure <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800 hover:border-emerald-500/50 transition-colors group">
            <CardContent className="p-6 flex items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-100 text-lg mb-1">2. Review Settings</h3>
                <p className="text-slate-400 text-sm">Connect specific data sources and set up webhooks for external routing.</p>
              </div>
              <Link href="/settings">
                <Button variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 shrink-0">
                  Configure <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

        </div>

        <div className="flex justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-12 h-14 text-lg w-full sm:w-auto font-medium">
              <LayoutDashboard className="w-5 h-5 mr-2" />
              Enter Mission Control
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}