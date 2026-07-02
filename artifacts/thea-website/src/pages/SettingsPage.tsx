import React, { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  useListCrawlerSources,
  useListWebhooks,
  useListCollectionRuns,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  Bell,
  CreditCard,
  Database,
  Webhook,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  History,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const PLAN_FEATURES = [
  { label: "Monitored topics", value: "Unlimited" },
  { label: "Alert seats", value: "10" },
  { label: "Data retention", value: "24 months" },
  { label: "API access", value: "Included" },
  { label: "AI generations / month", value: "5,000" },
];

const NOTIFICATION_OPTIONS = [
  { id: "email_critical", label: "Critical alerts via email", defaultChecked: true },
  { id: "email_high", label: "High severity alerts via email", defaultChecked: true },
  { id: "email_digest", label: "Daily intelligence digest", defaultChecked: true },
  { id: "email_weekly", label: "Weekly trend summary", defaultChecked: false },
  { id: "push_critical", label: "Browser push for critical alerts", defaultChecked: true },
  { id: "slack_critical", label: "Slack notification for critical alerts", defaultChecked: false },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("My Organisation");
  const [orgDomain, setOrgDomain] = useState("");
  const [notifState, setNotifState] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_OPTIONS.map((o) => [o.id, o.defaultChecked]))
  );
  const [savingOrg, setSavingOrg] = useState(false);
  const [newTeamEmail, setNewTeamEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/settings/notifications", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body?.data?.whatsappPhoneNumber) {
          setWhatsappNumber(body.data.whatsappPhoneNumber);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveNotifications = async () => {
    setSavingNotif(true);
    try {
      const res = await fetch("/api/v1/settings/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappPhoneNumber: whatsappNumber.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: "Could not save preferences", description: body?.error ?? "Please try again.", variant: "destructive" });
        return;
      }
      toast({ title: "Notification preferences saved" });
    } catch {
      toast({ title: "Could not save preferences", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSavingNotif(false);
    }
  };

  const { data: sources, isLoading: loadingSources } = useListCrawlerSources<any>();
  const { data: webhooks, isLoading: loadingWebhooks } = useListWebhooks<any>();
  const { data: runs, isLoading: loadingRuns } = useListCollectionRuns<any>({ limit: 20 });

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    await new Promise((r) => setTimeout(r, 700));
    setSavingOrg(false);
    toast({ title: "Organisation profile saved" });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamEmail) return;
    toast({ title: `Invite sent to ${newTeamEmail}` });
    setNewTeamEmail("");
  };

  const teamMembers = [
    { name: user?.name || user?.email || "You", email: user?.email || "", role: "Owner", avatar: "" },
    { name: "Alex Chen", email: "alex@example.com", role: "Analyst", avatar: "" },
    { name: "Maria Santos", email: "maria@example.com", role: "Viewer", avatar: "" },
  ];

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-5xl">
        <Tabs defaultValue="org" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 mb-8 h-12 inline-flex flex-wrap gap-0">
            <TabsTrigger value="org" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-5 gap-2">
              <Building2 className="w-4 h-4" /> Org Profile
            </TabsTrigger>
            <TabsTrigger value="team" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-5 gap-2">
              <Users className="w-4 h-4" /> Team
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-5 gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-5 gap-2">
              <CreditCard className="w-4 h-4" /> Billing
            </TabsTrigger>
            <TabsTrigger value="sources" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-5 gap-2">
              <Database className="w-4 h-4" /> Sources
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 px-5 gap-2">
              <Webhook className="w-4 h-4" /> Webhooks
            </TabsTrigger>
          </TabsList>

          {/* Org Profile */}
          <TabsContent value="org">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Organisation Profile</CardTitle>
                <CardDescription className="text-slate-400">Manage your organisation's identity and branding settings.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveOrg} className="space-y-6 max-w-lg">
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-sm">Organisation Name</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-sm">Primary Domain</Label>
                    <Input
                      placeholder="e.g. example.com"
                      value={orgDomain}
                      onChange={(e) => setOrgDomain(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                    <p className="text-xs text-slate-600">Used for SSO and email domain verification.</p>
                  </div>
                  <Separator className="bg-slate-800" />
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-sm">Account Owner</Label>
                    <p className="text-slate-300 text-sm">{user?.name || user?.email || "—"}</p>
                    <p className="text-slate-600 text-xs">{user?.email}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-sm">Time Zone</Label>
                    <Select defaultValue="UTC">
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT/BST)</SelectItem>
                        <SelectItem value="Europe/Berlin">Central European Time</SelectItem>
                        <SelectItem value="Asia/Tokyo">Japan Standard Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-500" disabled={savingOrg}>
                    {savingOrg ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team */}
          <TabsContent value="team">
            <div className="space-y-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100">Team Members</CardTitle>
                  <CardDescription className="text-slate-400">Manage who has access to your THEA workspace.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {teamMembers.map((member, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-medium text-slate-300 border border-slate-700">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Select defaultValue={member.role.toLowerCase()}>
                          <SelectTrigger className="h-7 w-24 bg-slate-900 border-slate-700 text-slate-300 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="analyst">Analyst</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        {i > 0 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Invite Team Member</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleInvite} className="flex gap-3 max-w-md">
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={newTeamEmail}
                      onChange={(e) => setNewTeamEmail(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-500 shrink-0" disabled={!newTeamEmail}>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Invite
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Notification Preferences</CardTitle>
                <CardDescription className="text-slate-400">Configure when and how you receive intelligence alerts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-4">
                  {NOTIFICATION_OPTIONS.map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                      <Label htmlFor={opt.id} className="text-slate-300 cursor-pointer">{opt.label}</Label>
                      <Switch
                        id={opt.id}
                        checked={notifState[opt.id] ?? opt.defaultChecked}
                        onCheckedChange={(v) => setNotifState((s) => ({ ...s, [opt.id]: v }))}
                        className="data-[state=checked]:bg-blue-600"
                      />
                    </div>
                  ))}
                </div>
                <Separator className="bg-slate-800" />
                <div className="space-y-1.5 max-w-md">
                  <Label htmlFor="whatsapp-number" className="text-slate-400 text-sm">WhatsApp Alert Number</Label>
                  <Input
                    id="whatsapp-number"
                    type="tel"
                    inputMode="tel"
                    placeholder="+15551234567"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                  <p className="text-xs text-slate-600">
                    Instant crisis spike alerts are sent to this WhatsApp number via the THEA Business account. Use full international format (E.164), e.g. +15551234567. Leave blank to disable.
                  </p>
                </div>
                <Separator className="bg-slate-800" />
                <div className="space-y-3">
                  <Label className="text-slate-400 text-sm">Alert Digest Frequency</Label>
                  <Select defaultValue="daily">
                    <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                      <SelectItem value="realtime">Real-time (as alerts fire)</SelectItem>
                      <SelectItem value="hourly">Hourly batch</SelectItem>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly summary only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-500"
                  onClick={handleSaveNotifications}
                  disabled={savingNotif}
                >
                  {savingNotif ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing">
            <div className="space-y-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-slate-100">Current Plan</CardTitle>
                      <CardDescription className="text-slate-400">THEA Professional</CardDescription>
                    </div>
                    <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/20 text-sm px-4 py-1">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-900/20 to-slate-950 border border-blue-800/30">
                    <p className="text-slate-400 text-sm mb-1">Monthly cost</p>
                    <p className="text-3xl font-display font-bold text-white">$1,499 <span className="text-slate-500 text-lg font-normal">/ month</span></p>
                    <p className="text-xs text-slate-500 mt-2">Renews on Aug 01, 2026 · Billed annually</p>
                  </div>
                  <div className="space-y-2">
                    {PLAN_FEATURES.map((f, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                        <span className="text-slate-400 text-sm">{f.label}</span>
                        <span className="text-slate-200 text-sm font-medium">{f.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      Manage Billing
                    </Button>
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      Download Invoice
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base">Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-slate-500" />
                      <div>
                        <p className="text-slate-200 text-sm">Visa ending in 4242</p>
                        <p className="text-slate-500 text-xs">Expires 09/28</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-200">
                      Update
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Data Sources */}
          <TabsContent value="sources">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Ingestion Sources</CardTitle>
                <CardDescription className="text-slate-400">External APIs, RSS feeds, and scrapers feeding the THEA corpus.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSources ? (
                  <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />)}</div>
                ) : sources?.data?.length ? (
                  <div className="space-y-3">
                    {sources.data.map((src: any) => (
                      <div key={src.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-200">{src.name}</p>
                          <p className="text-sm text-slate-500 font-mono mt-1 truncate max-w-sm">{src.url}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700">{src.type}</Badge>
                          <Badge
                            variant="outline"
                            className={src.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-700/50 text-slate-500 border-slate-700"}
                          >
                            {src.isActive ? "Active" : "Paused"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <Database className="w-10 h-10 text-slate-700" />
                    <p className="text-slate-500">No active sources configured.</p>
                    <p className="text-slate-600 text-sm max-w-sm">Sources are configured by your THEA implementation team. Contact support to add new feeds.</p>
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                      <Plus className="w-4 h-4 mr-2" />
                      Request New Source
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            {!loadingRuns && runs?.data?.length > 0 && (
              <Card className="bg-slate-900 border-slate-800 mt-4">
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Recent Collection Runs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {runs.data.map((run: any) => (
                      <div key={run.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center text-sm">
                        <span className="text-slate-400 font-mono">{run.sourceType || "System"}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-500">{run.itemsCollected} items</span>
                          <Badge
                            variant="outline"
                            className={run.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-700/50 text-slate-400 border-slate-700"}
                          >
                            {run.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Webhook Endpoints</CardTitle>
                <CardDescription className="text-slate-400">Route intelligence and alerts to your own systems via HTTP POST.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingWebhooks ? (
                  <Skeleton className="h-16 w-full bg-slate-800 rounded-lg" />
                ) : webhooks?.data?.length ? (
                  <div className="space-y-3">
                    {webhooks.data.map((wh: any) => (
                      <div key={wh.id} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-200 font-mono text-sm truncate">{wh.url}</p>
                        <Button variant="ghost" size="icon" className="shrink-0 text-slate-600 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-12 text-center">
                    <Webhook className="w-10 h-10 text-slate-700" />
                    <p className="text-slate-500">No webhooks configured.</p>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <Input placeholder="https://your-system.com/webhook" className="bg-slate-950 border-slate-800 text-slate-200" />
                  <Button className="bg-blue-600 hover:bg-blue-500 shrink-0">
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Webhook
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
