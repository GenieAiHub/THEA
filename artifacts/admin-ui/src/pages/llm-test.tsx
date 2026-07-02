import { useState, useRef, useEffect } from "react";
import { adminFetch } from "@/hooks/use-admin";
import { Send, Trash2 } from "lucide-react";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  meta?: { model?: string; tokens?: number; ms?: number; error?: boolean };
};

const PROVIDERS = ["openai", "gemini"] as const;
type Provider = typeof PROVIDERS[number];

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
};

export default function LlmTestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState(DEFAULT_MODELS["openai"]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleProviderChange = (p: Provider) => {
    setProvider(p);
    setModel(DEFAULT_MODELS[p]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    const start = Date.now();
    try {
      const chatMessages = [...messages, userMsg]
        .filter((m) => m.role !== "system")
        .map(({ role, content }) => ({ role, content }));

      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const raw = await fetch(`${base}/api/v1/intelligence/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, messages: chatMessages }),
      });
      if (!raw.ok) throw new Error(await raw.text());
      const res = await raw.json();

      const ms = Date.now() - start;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.reply ?? res.content ?? "(no response)",
          meta: {
            model: res.model ?? model,
            tokens: res.usage?.total_tokens ?? res.totalTokens,
            ms,
          },
        },
      ]);
    } catch (err: any) {
      const ms = Date.now() - start;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: err?.message ?? "Request failed. Check that the API key is configured.",
          meta: { error: true, ms },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-mono font-bold text-foreground">LLM Playground</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Test AI providers live using platform-configured API keys</p>
        </div>
        <button
          onClick={() => setMessages([])}
          disabled={messages.length === 0}
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex gap-1 border border-border rounded-sm overflow-hidden">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                provider === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="model name..."
          className="flex-1 bg-background border border-border rounded-sm px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
        />
      </div>

      <div className="flex-1 border border-border rounded-sm overflow-y-auto bg-card/30 p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground/40 text-center leading-relaxed">
            Send a message to test {provider === "openai" ? "OpenAI (GPT)" : "Google Gemini"}.<br />
            Responses use live platform API keys.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-sm px-4 py-2.5 text-sm font-mono ${
                  msg.role === "user"
                    ? "bg-primary/15 text-foreground border border-primary/20"
                    : msg.meta?.error
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "bg-muted/40 text-foreground border border-border/50"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                {msg.meta && (
                  <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    {msg.meta.model && <span>{msg.meta.model}</span>}
                    {msg.meta.tokens && <span>{msg.meta.tokens} tokens</span>}
                    {msg.meta.ms && <span>{msg.meta.ms}ms</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/40 border border-border/50 rounded-sm px-4 py-2.5 text-sm font-mono text-muted-foreground">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={loading}
          className="flex-1 bg-background border border-border rounded-sm px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-mono rounded-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Send className="h-3.5 w-3.5" />
          Send
        </button>
      </div>
    </div>
  );
}
