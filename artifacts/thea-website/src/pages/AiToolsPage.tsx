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
import { Loader2, MessageSquare, Mic, FileText, Activity, Copy, Check, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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
      Download
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
  const [simResult, setSimResult] = useState("");
  const [simLoading, setSimLoading] = useState(false);

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
    try {
      const res = await llmChat.mutateAsync({
        data: {
          messages: [{
            role: "user",
            content: `You are a narrative intelligence analyst. Run a "what-if" scenario simulation.\n\nTopic: ${simTopic}\nScenario: ${simScenario || "escalation of public attention"}\n\nProvide:\n1. Predicted sentiment trajectory (24h, 7d, 30d)\n2. Key risk vectors\n3. Recommended response posture\n4. Stakeholder impact assessment`,
          }],
        },
      });
      setSimResult(res.content || "Simulation complete — no output returned.");
    } catch {
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
                        <DownloadButton text={dsResult} filename={`statement-draft.txt`} />
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
                  Model how a topic or narrative might evolve under different conditions. The AI projects sentiment trajectories, risk vectors, and recommended responses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form onSubmit={handleSimulate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Topic / Entity to Simulate *</Label>
                    <Input
                      placeholder="e.g. CEO resignation, product recall, data breach..."
                      value={simTopic}
                      onChange={(e) => setSimTopic(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-400 text-xs">Scenario / Hypothesis</Label>
                    <Textarea
                      placeholder="Describe the what-if scenario. e.g. 'A major news outlet publishes a critical investigative piece...'"
                      value={simScenario}
                      onChange={(e) => setSimScenario(e.target.value)}
                      rows={3}
                      className="bg-slate-950 border-slate-800 text-slate-200 resize-none"
                    />
                  </div>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-500 w-full" disabled={simLoading || !simTopic}>
                    {simLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Activity className="w-4 h-4 mr-2" />}
                    Run Simulation
                  </Button>
                </form>
                {simResult && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Simulation Output</span>
                      <div className="flex gap-2">
                        <CopyButton text={simResult} />
                        <DownloadButton text={simResult} filename={`simulation-${simTopic.replace(/\s+/g, "-")}.txt`} />
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-lg border border-purple-900/30 text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {simResult}
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
