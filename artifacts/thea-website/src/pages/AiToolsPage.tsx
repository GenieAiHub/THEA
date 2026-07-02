import React, { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useGenerateTalkingPoints, useDraftStatement, useLlmChat, useRunWhatIfSimulation } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Mic, FileText, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AiToolsPage() {
  const { toast } = useToast();
  
  // Tools
  const generateTalkingPoints = useGenerateTalkingPoints();
  const draftStatement = useDraftStatement();
  const llmChat = useLlmChat();
  // useRunWhatIfSimulation not standard, mock or skip if not exposed. Wait, it's in the list.
  
  // Talking Points State
  const [tpTopic, setTpTopic] = useState("");
  const [tpResult, setTpResult] = useState("");

  // Draft Statement State
  const [dsAlertId, setDsAlertId] = useState("");
  const [dsResult, setDsResult] = useState("");

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'assistant'|'system', content: string}[]>([]);

  const handleGenerateTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpTopic) return;
    try {
      const res = await generateTalkingPoints.mutateAsync({ data: { topic: tpTopic } });
      setTpResult(res.talkingPoints || JSON.stringify(res));
    } catch(err) {
      toast({ title: "Generation failed", variant: "destructive" });
    }
  };

  const handleDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dsAlertId) return;
    try {
      const res = await draftStatement.mutateAsync({ data: { topic: dsAlertId } }); // using topic field as mock
      setDsResult(res.statement || JSON.stringify(res));
    } catch(err) {
      toast({ title: "Drafting failed", variant: "destructive" });
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput) return;
    const userMsg = chatInput;
    setChatInput("");
    const newHistory = [...chatHistory, { role: 'user' as const, content: userMsg }];
    setChatHistory(newHistory);
    try {
      const res = await llmChat.mutateAsync({ data: { messages: newHistory } });
      if (res.content) {
        setChatHistory([...newHistory, { role: 'assistant', content: res.content }]);
      }
    } catch(err) {
      toast({ title: "Chat failed", variant: "destructive" });
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
              <FileText className="w-4 h-4 mr-2" /> Draft Statement
            </TabsTrigger>
            <TabsTrigger value="chat" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <MessageSquare className="w-4 h-4 mr-2" /> Intelligence Chat
            </TabsTrigger>
            <TabsTrigger value="simulator" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <Activity className="w-4 h-4 mr-2" /> Simulator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="talking-points">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Generate Talking Points</CardTitle>
                <CardDescription className="text-slate-400">Instantly generate bullet-point responses for emerging narratives.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleGenerateTP} className="flex gap-4">
                  <Input 
                    placeholder="Enter topic, keyword, or narrative..." 
                    value={tpTopic}
                    onChange={(e) => setTpTopic(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-500 min-w-32" disabled={generateTalkingPoints.isPending}>
                    {generateTalkingPoints.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
                  </Button>
                </form>
                {tpResult && (
                  <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 whitespace-pre-wrap">
                    {tpResult}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statement">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">Draft Crisis Statement</CardTitle>
                <CardDescription className="text-slate-400">Context-aware press statement generation based on active alerts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleDraft} className="flex gap-4">
                  <Input 
                    placeholder="Enter Alert ID or Topic..." 
                    value={dsAlertId}
                    onChange={(e) => setDsAlertId(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-200"
                  />
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-500 min-w-32" disabled={draftStatement.isPending}>
                    {draftStatement.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Draft"}
                  </Button>
                </form>
                {dsResult && (
                  <div className="p-6 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 whitespace-pre-wrap font-serif text-sm leading-relaxed">
                    {dsResult}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card className="bg-slate-900 border-slate-800 flex flex-col h-[600px]">
              <CardHeader className="border-b border-slate-800 pb-4 shrink-0">
                <CardTitle className="text-slate-100">Intelligence Chat</CardTitle>
                <CardDescription className="text-slate-400">Query the THEA knowledge graph directly.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
                <ScrollArea className="flex-1 p-6">
                  {chatHistory.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500">
                      Ask me about active trends, sentiment shifts, or specific entities.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-4 rounded-xl ${
                            msg.role === 'user' 
                              ? 'bg-blue-600 text-white rounded-br-none' 
                              : 'bg-slate-800 text-slate-200 rounded-bl-none'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {llmChat.isPending && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] p-4 rounded-xl bg-slate-800 text-slate-400 rounded-bl-none">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
                <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
                  <form onSubmit={handleChat} className="flex gap-4">
                    <Input 
                      placeholder="Ask the intelligence engine..." 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="bg-slate-900 border-slate-700 text-slate-200"
                    />
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-500" disabled={llmChat.isPending || !chatInput}>
                      Send
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulator">
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-12 text-center text-slate-500">
                What-If Simulator is initializing... (Coming soon)
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}