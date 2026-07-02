import React, { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGenerateTalkingPoints, useDraftStatement, useLlmChat } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Mic, FileText, Activity, Copy, Check, Download, RefreshCw, TrendingUp, AlertTriangle, Shield, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface SimReport {
  sentimentTrajectory: string;
  riskVectors: string;
  responsePosture: string;
  stakeholderImpact: string;
  raw: string;
}

const SIM_STEPS = [
  "Initializing simulation context…",
  "Analyzing live narrative signals…",
  "Generating sentiment trajectory…",
  "Building risk matrix…",
  "Compiling recommendations…",
  "Finalizing report…",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}
      className="border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800">
      {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleDownload}
      className="border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800">
      <Download className="w-3.5 h-3.5 mr-1.5" />
      .txt
    </Button>
  );
}

function DownloadDocxButton({ text, filename }: { text: string; filename: string }) {
  const handleDownload = () => {
    const htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${filename}</title><style>body{font-family:Calibri,sans-serif;font-size:12pt;line-height:1.6;margin:2cm;}h1{font-size:16pt;}p{margin-bottom:6pt;}</style></head><body>${text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>")
    }</body></html>`;
    const blob = new Blob(["\ufeff", htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/\.txt$/, "") + ".doc";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleDownload}
      className="border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800">
      <Download className="w-3.5 h-3.5 mr-1.5" />
      .doc
    </Button>
  );
}

export default function AiToolsPage() {
  const { toast } = useToast();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const generateTalkingPoints = useGenerateTalkingPoints();
  const draftStatement = useDraftStatement();
  const llmChat = useLlmChat();

  // Talking Points
  const [tpTopic, setTpTopic] = useState("");
  const [tpContext, setTpContext] = useState("");
  const [tpProvider, setTpProvider] = useState<"openai" | "gemini">("openai");
  const [tpResult, setTpResult] = useState("");

  // Draft Statement
  const [dsTopic, setDsTopic] = useState("");
  const [dsTone, setDsTone] = useState("professional");
  const [dsAudience, setDsAudience] = useState("media");
  const [dsProvider, setDsProvider] = useState<"openai" | "gemini">("openai");
  const [dsResult, setDsResult] = useState("");

  // Chat
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant" | "system"; content: string }[]>([]);

  // Simulator
  const [simTopic, setSimTopic] = useState("");
  const [simScenario, setSimScenario] = useState("");
  const [simScenarioType, setSimScenarioType] = useState("escalation");
  const [simResult, setSimResult] = useState<SimReport | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simStep, setSimStep] = useState(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleGenerateTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpTopic) return;
    try {
      const res = await generateTalkingPoints.mutateAsync({
        data: { topic: tpTopic, context: tpContext || undefined, provider: tpProvider },
      });
      setTpResult(res.talkingPoints || JSON.stringify(res, null, 2));
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    }
  };

  const handleDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dsTopic) return;
    try {
      const res = await draftStatement.mutateAsync({
        data: { topic: dsTopic, tone: dsTone, audience: dsAudience, provider: dsProvider },
      });
      setDsResult(res.statement || JSON.stringify(res, null, 2));
    } catch {
      toast({ title: "Drafting failed", variant: "destructive" });
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newHistory = [...chatHistory, { role: "user" as const, content: userMsg }];
    setChatHistory(newHistory);
    try {
      const res = await llmChat.mutateAsync({ data: { messages: newHistory } });
      if (res.content) {
        setChatHistory([...newHistory, { role: "assistant" as const, content: res.content }]);
      }
    } catch {
      toast({ title: "Chat failed", variant: "destructive" });
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simTopic) return;
    setSimLoading(true);
    setSimResult(null);
    setSimStep(0);

    const stepInterval = setInterval(() => {
      setSimStep((s) => Math.min(s + 1, SIM_STEPS.length - 1));
    }, 600);

    try {
      const res = await llmChat.mutateAsync({
        data: {
          messages: [{
            role: "user",
            content: `You are a narrative intelligence analyst. Produce a structured what-if scenario simulation report.

Topic: ${simTopic}
Scenario type: ${simScenarioType}
Hypothesis: ${simScenario || "escalation of public attention to this topic"}

Reply with EXACTLY these four labelled sections — no other text outside them:

SENTIMENT_TRAJECTORY:
Describe the predicted sentiment arc over 24h, 7 days, and 30 days. Include trajectory direction, peak risk window, and likely rebound point.

RISK_VECTORS:
List the 3-5 most significant risk vectors with brief explanation of each. Use a numbered list.

RESPONSE_POSTURE:
Recommend the optimal communications posture and key actions to take immediately, within 48h, and within 7 days.

STAKEHOLDER_IMPACT:
Assess the impact on each of: media, investors, employees, regulators/government, and general public. Rate each: Low / Medium / High.`,
          }],
        },
      });

      clearInterval(stepInterval);
      setSimStep(SIM_STEPS.length - 1);

      const raw = res.content || "";
      const extract = (key: string) => {
        const re = new RegExp(`${key}:\\n([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, "i");
        return raw.match(re)?.[1]?.trim() || "";
      };

      setSimResult({
        sentimentTrajectory: extract("SENTIMENT_TRAJECTORY"),
        riskVectors: extract("RISK_VECTORS"),
        responsePosture: extract("RESPONSE_POSTURE"),
        stakeholderImpact: extract("STAKEHOLDER_IMPACT"),
        raw,
      });
    } catch {
      clearInterval(stepInterval);
      toast({ title: "Simulation failed", variant: "destructive" });
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <DashboardLayout title="AI Response Intelligence">
      <div className="max-w-4xl mx-auto">
        <Tabs defaultValue="talking-points" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-900 border border-slate-800 mb-8 h-12">
            <TabsTrigger value="talking-points" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <Mic className="w-4 h-4 mr-2" /> Talking Points
            </TabsTrigger>
            <TabsTrigger value="statement" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <FileText className="w-4 h-4 mr-2" /> Statement
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <MessageSquare className="w-4 h-4 mr-2" /> Chat
            </TabsTrigger>
            <TabsTrigger value="simulator" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <Activity className="w-4 h-4 mr-2" /> What-If
            </TabsTrigger>
          </TabsList>

          {/* Talking Points */}
          <TabsContent value="talking-points">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Generate Talking Points</CardTitle>
                <CardDescription className="text-slate-400">Bullet-point responses for emerging narratives, optimised for communications teams.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleGenerateTP} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-slate-400 text-xs">Topic / Narrative *</Label>
                      <Input
                        placeholder="e.g. supply chain disruption"
                        value={tpTopic}
                        onChange={(e) => setTpTopic(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-200"
                      />
                    </div>
                    <div className="w-36 space-y-1.5">
                      <Label className="text-slate-400 text-xs">AI Provider</Label>
                      <Select value={tpProvider} onValueChange={(v: any) => setTpProvider(v)}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Additional Context (optional)</Label>
                    <Textarea
                      placeholder="Paste relevant background, previous statements, or audience notes..."
                      value={tpContext}
                      onChange={(e) => setTpContext(e.target.value)}
                      rows={3}
                      className="bg-slate-950 border-slate-800 text-slate-200 resize-none"
                    />
                  </div>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-500 w-full" disabled={generateTalkingPoints.isPending || !tpTopic}>
                    {generateTalkingPoints.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                    Generate Talking Points
                  </Button>
                </form>
                {tpResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Output</span>
                      <div className="flex gap-2">
                        <CopyButton text={tpResult} />
                        <DownloadButton text={tpResult} filename={`talking-points-${tpTopic.replace(/\s+/g, "-")}.txt`} />
                        <DownloadDocxButton text={tpResult} filename={`talking-points-${tpTopic.replace(/\s+/g, "-")}`} />
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {tpResult}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Draft Statement */}
          <TabsContent value="statement">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Draft Crisis Statement</CardTitle>
                <CardDescription className="text-slate-400">Context-aware press statement generation with tone and audience controls.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleDraft} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Topic or Alert Description *</Label>
                    <Input
                      placeholder="Describe the incident or topic requiring a statement..."
                      value={dsTopic}
                      onChange={(e) => setDsTopic(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">Tone</Label>
                      <Select value={dsTone} onValueChange={setDsTone}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="empathetic">Empathetic</SelectItem>
                          <SelectItem value="assertive">Assertive</SelectItem>
                          <SelectItem value="conciliatory">Conciliatory</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">Audience</Label>
                      <Select value={dsAudience} onValueChange={setDsAudience}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="investors">Investors</SelectItem>
                          <SelectItem value="employees">Employees</SelectItem>
                          <SelectItem value="general-public">General Public</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">AI Provider</Label>
                      <Select value={dsProvider} onValueChange={(v: any) => setDsProvider(v)}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-500 w-full" disabled={draftStatement.isPending || !dsTopic}>
                    {draftStatement.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                    Draft Statement
                  </Button>
                </form>
                {dsResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Draft</span>
                        <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-xs capitalize">{dsTone} · {dsAudience}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <CopyButton text={dsResult} />
                        <DownloadButton text={dsResult} filename="statement-draft.txt" />
                        <DownloadDocxButton text={dsResult} filename="statement-draft" />
                      </div>
                    </div>
                    <div className="p-6 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 whitespace-pre-wrap font-serif text-sm leading-relaxed">
                      {dsResult}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intelligence Chat */}
          <TabsContent value="chat">
            <Card className="bg-slate-900 border-slate-800 flex flex-col" style={{ height: 620 }}>
              <CardHeader className="border-b border-slate-800 pb-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-slate-100">Intelligence Chat</CardTitle>
                    <CardDescription className="text-slate-400">Query the THEA knowledge graph directly.</CardDescription>
                  </div>
                  {chatHistory.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setChatHistory([])}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
                    <MessageSquare className="w-10 h-10 opacity-40" />
                    <p className="text-sm">Ask about active trends, sentiment shifts, or specific entities.</p>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {["What are the top trends?", "Summarise recent alerts", "Which categories are surging?"].map((s) => (
                        <button
                          key={s}
                          onClick={() => setChatInput(s)}
                          className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors border border-slate-700"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] p-4 rounded-xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-slate-800 text-slate-200 rounded-bl-none"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {llmChat.isPending && (
                      <div className="flex justify-start">
                        <div className="p-4 rounded-xl bg-slate-800 text-slate-400 rounded-bl-none">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>
              <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                <form onSubmit={handleChat} className="flex gap-3">
                  <Input
                    placeholder="Ask the intelligence engine..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-slate-200"
                  />
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-500 shrink-0" disabled={llmChat.isPending || !chatInput.trim()}>
                    Send
                  </Button>
                </form>
              </div>
            </Card>
          </TabsContent>

          {/* What-If Simulator */}
          <TabsContent value="simulator">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  What-If Scenario Simulator
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Model how a narrative evolves under a chosen scenario. The engine runs a multi-stage analysis producing structured projections across sentiment, risk, response, and stakeholders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleSimulate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">Topic / Entity to Simulate *</Label>
                      <Input
                        placeholder="e.g. CEO resignation, product recall…"
                        value={simTopic}
                        onChange={(e) => setSimTopic(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-400 text-xs">Scenario Type</Label>
                      <Select value={simScenarioType} onValueChange={setSimScenarioType}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="escalation">Escalation</SelectItem>
                          <SelectItem value="viral-spread">Viral Spread</SelectItem>
                          <SelectItem value="media-investigation">Media Investigation</SelectItem>
                          <SelectItem value="regulatory-action">Regulatory Action</SelectItem>
                          <SelectItem value="competitor-attack">Competitor Attack</SelectItem>
                          <SelectItem value="social-backlash">Social Backlash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Hypothesis (optional)</Label>
                    <Textarea
                      placeholder="Describe the specific scenario, e.g. 'A major outlet publishes a critical exposé…'"
                      value={simScenario}
                      onChange={(e) => setSimScenario(e.target.value)}
                      rows={2}
                      className="bg-slate-950 border-slate-800 text-slate-200 resize-none"
                    />
                  </div>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-500 w-full" disabled={simLoading || !simTopic}>
                    {simLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                    Run Simulation
                  </Button>
                </form>

                {/* Multi-step progress */}
                {simLoading && (
                  <div className="space-y-3 p-4 bg-slate-950 rounded-lg border border-purple-900/30">
                    <p className="text-xs font-semibold uppercase tracking-widest text-purple-400 mb-3">Simulation in progress</p>
                    {SIM_STEPS.map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                          i < simStep ? "bg-purple-600" : i === simStep ? "bg-purple-600/40 ring-2 ring-purple-500/50" : "bg-slate-800"
                        }`}>
                          {i < simStep ? (
                            <Check className="w-3 h-3 text-white" />
                          ) : i === simStep ? (
                            <Loader2 className="w-3 h-3 text-purple-300 animate-spin" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <span className={`text-sm ${i <= simStep ? "text-slate-200" : "text-slate-600"}`}>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Structured report */}
                {simResult && !simLoading && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Simulation Report — {simTopic}</span>
                      <div className="flex gap-2">
                        <CopyButton text={simResult.raw} />
                        <DownloadButton text={simResult.raw} filename={`simulation-${simTopic.replace(/\s+/g, "-")}.txt`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sentiment Trajectory */}
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-blue-400">Sentiment Trajectory</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {simResult.sentimentTrajectory || simResult.raw}
                        </p>
                      </div>

                      {/* Risk Vectors */}
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Risk Vectors</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {simResult.riskVectors}
                        </p>
                      </div>

                      {/* Response Posture */}
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Response Posture</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {simResult.responsePosture}
                        </p>
                      </div>

                      {/* Stakeholder Impact */}
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-semibold uppercase tracking-wide text-purple-400">Stakeholder Impact</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {simResult.stakeholderImpact}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
