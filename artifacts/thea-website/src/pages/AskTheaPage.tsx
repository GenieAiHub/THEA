import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useListAskTheaConversations,
  useGetAskTheaConversation,
  useDeleteAskTheaConversation,
} from "@workspace/api-client-react";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Loader2,
  ExternalLink,
  MessageSquare,
  Lock,
  ShieldAlert,
  TrendingUp,
  Newspaper,
  Activity,
} from "lucide-react";

interface Citation {
  marker: string;
  type: "content" | "alert" | "crisis" | "trend";
  id: string;
  title: string;
  url: string | null;
  platform: string | null;
  date: string | null;
  similarity: number | null;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
}

const SUGGESTIONS = [
  "What are the top trending topics this week?",
  "Are there any crisis risks I should know about?",
  "Summarize the alerts from the last 7 days",
  "What's the overall sentiment around our monitored keywords?",
];

function citationIcon(type: Citation["type"]) {
  switch (type) {
    case "alert":
      return <ShieldAlert className="w-3 h-3" />;
    case "crisis":
      return <Activity className="w-3 h-3" />;
    case "trend":
      return <TrendingUp className="w-3 h-3" />;
    default:
      return <Newspaper className="w-3 h-3" />;
  }
}

function CitationChip({ citation }: { citation: Citation }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 hover:bg-slate-700/80 transition-colors max-w-[260px]">
      <span className="text-blue-400 font-semibold shrink-0">{citation.marker}</span>
      {citationIcon(citation.type)}
      <span className="truncate">{citation.title}</span>
      {citation.url && <ExternalLink className="w-3 h-3 shrink-0 text-slate-500" />}
    </span>
  );
  if (citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`link-citation-${citation.marker}`}
      >
        {inner}
      </a>
    );
  }
  if (citation.type === "alert") {
    return (
      <Link href={`/alerts/${citation.id}`} data-testid={`link-citation-${citation.marker}`}>
        {inner}
      </Link>
    );
  }
  return inner;
}

/** Render answer text, turning [S1] markers into highlighted spans. */
function AnswerText({ content }: { content: string }) {
  const parts = content.split(/(\[S\d+\])/g);
  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^\[S\d+\]$/.test(part) ? (
          <span key={i} className="text-blue-400 font-medium text-xs align-super">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  );
}

function MessageBubble({ msg, streaming }: { msg: ChatMsg; streaming?: boolean }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] sm:max-w-[70%] bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-br-sm px-4 py-3 text-sm text-slate-100 whitespace-pre-wrap break-words">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] sm:max-w-[85%]">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-medium text-slate-400">THEA</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-slate-200">
          <AnswerText content={msg.content} />
          {streaming && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 mt-2" />}
        </div>
        {msg.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.citations.map((c) => (
              <CitationChip key={c.marker} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UpgradeGate() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-5">
        <Lock className="w-6 h-6 text-blue-400" />
      </div>
      <h2 className="text-xl font-semibold text-slate-100 mb-2">Ask THEA is a Pro feature</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        Chat with an AI analyst grounded in your collected intelligence — trends, alerts, crisis
        scores and monitored coverage, with citations for every claim.
      </p>
      <Link href="/pricing">
        <Button className="bg-blue-600 hover:bg-blue-500" data-testid="button-upgrade-pro">
          Upgrade to Pro
        </Button>
      </Link>
    </div>
  );
}

export default function AskTheaPage() {
  const { tier } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const hasPro = tier === "pro" || tier === "enterprise";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamCitations, setStreamCitations] = useState<Citation[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: convList } = useListAskTheaConversations<any>({
    query: { enabled: hasPro },
  } as any);
  const { data: convDetail, isLoading: detailLoading } = useGetAskTheaConversation<any>(
    selectedId ?? "",
    { query: { enabled: hasPro && !!selectedId } } as any,
  );
  const deleteConv = useDeleteAskTheaConversation<any>();

  const conversations: Array<{ id: string; title: string; updatedAt: string }> =
    convList?.data ?? [];
  const messages: ChatMsg[] = (convDetail?.messages ?? []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    citations: Array.isArray(m.citations) ? m.citations : [],
  }));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, streamText, pendingUser]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || isStreaming) return;
    setInput("");
    setPendingUser(q);
    setStreamText("");
    setStreamCitations([]);
    setIsStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/v1/ask-thea/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          ...(selectedId ? { conversationId: selectedId } : {}),
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        let msg = "Ask THEA request failed";
        try {
          const err = await res.json();
          msg = err.error || msg;
        } catch {
          /* not json */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finishedConversationId: string | null = null;

      const handleEvent = (event: string, dataRaw: string) => {
        let data: any = {};
        try {
          data = JSON.parse(dataRaw);
        } catch {
          return;
        }
        if (event === "meta" && data.conversationId) {
          // Don't select the new conversation yet — doing so mid-stream fetches
          // the just-persisted user message while the pending bubble is still
          // rendered, showing it twice. Selection happens after the stream ends.
          finishedConversationId = data.conversationId;
        } else if (event === "sources") {
          setStreamCitations(Array.isArray(data.citations) ? data.citations : []);
        } else if (event === "token" && typeof data.delta === "string") {
          setStreamText((prev) => prev + data.delta);
        } else if (event === "error") {
          toast({
            title: "Ask THEA failed",
            description: data.error || "The AI provider returned an error.",
            variant: "destructive",
          });
        }
      };

      // Parse the SSE frame stream
      // Each frame: optional "event: name" line + "data: {...}" line, blank-line separated.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let event = "message";
          const dataLines: string[] = [];
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length) handleEvent(event, dataLines.join("\n"));
        }
      }

      // Refresh persisted state now the stream is complete
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/v1/ask-thea/conversations"] }),
        queryClient.invalidateQueries(),
      ]);
      if (finishedConversationId) setSelectedId(finishedConversationId);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast({
          title: "Ask THEA failed",
          description: err?.message || "Request failed",
          variant: "destructive",
        });
      }
    } finally {
      setIsStreaming(false);
      setPendingUser(null);
      setStreamText("");
      setStreamCitations([]);
      abortRef.current = null;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConv.mutateAsync({ id } as any);
      if (selectedId === id) setSelectedId(null);
      queryClient.invalidateQueries();
    } catch {
      toast({ title: "Failed to delete conversation", variant: "destructive" });
    }
  };

  if (!hasPro) {
    return (
      <DashboardLayout title="Ask THEA">
        <UpgradeGate />
      </DashboardLayout>
    );
  }

  const showEmpty = !selectedId && !pendingUser && messages.length === 0;

  return (
    <DashboardLayout title="Ask THEA">
      <div className="flex gap-4 h-[calc(100dvh-8.5rem)] sm:h-[calc(100dvh-9.5rem)]">
        {/* Conversation list */}
        <div className="hidden lg:flex flex-col w-64 shrink-0 bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <Button
              variant="outline"
              className="w-full justify-start border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
              onClick={() => setSelectedId(null)}
              data-testid="button-new-conversation"
            >
              <Plus className="w-4 h-4 mr-2" />
              New conversation
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 && (
              <p className="text-xs text-slate-600 px-2 py-3">No conversations yet.</p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  selectedId === c.id
                    ? "bg-blue-600/10 text-blue-300"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
                onClick={() => setSelectedId(c.id)}
                data-testid={`item-conversation-${c.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id);
                  }}
                  data-testid={`button-delete-conversation-${c.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat pane */}
        <div className="flex-1 flex flex-col bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden min-w-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {showEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-5">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1.5">Ask THEA anything</h2>
                <p className="text-sm text-slate-500 max-w-md mb-6">
                  Answers are grounded in your collected intelligence — content, alerts, crisis
                  scores and trends — with citations for every claim.
                </p>
                <div className="grid sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="text-left text-xs text-slate-400 bg-slate-900 border border-slate-800 hover:border-slate-600 hover:text-slate-200 rounded-lg px-3 py-2.5 transition-colors"
                      onClick={() => ask(s)}
                      data-testid={`button-suggestion-${SUGGESTIONS.indexOf(s)}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {detailLoading && selectedId && !messages.length && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
                  </div>
                )}
                {messages.map((m) => (
                  <MessageBubble key={m.id} msg={m} />
                ))}
                {pendingUser && (
                  <MessageBubble
                    msg={{ id: "pending-user", role: "user", content: pendingUser, citations: [] }}
                  />
                )}
                {isStreaming && (
                  <MessageBubble
                    streaming={!streamText}
                    msg={{
                      id: "streaming",
                      role: "assistant",
                      content: streamText || "",
                      citations: streamText ? streamCitations : [],
                    }}
                  />
                )}
              </>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-slate-800 p-3 sm:p-4">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                placeholder="Ask about your trends, alerts, coverage…"
                rows={1}
                maxLength={4000}
                className="flex-1 resize-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 min-h-[46px] max-h-40"
                data-testid="input-ask-thea"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="bg-blue-600 hover:bg-blue-500 h-[46px] px-4"
                data-testid="button-send"
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">
              THEA answers only from your collected intelligence and cites its sources.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
