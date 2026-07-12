"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HeartPulse, ArrowLeft, Send, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// The opening line from the bot — same every time, no API call needed
const OPENING_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hey — I'm right here with you. First: take one slow, deep breath. In... and out.\n\nWhat's happening? Is this stress, boredom, habit, or are you actually hungry?",
};

export default function CravingPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([OPENING_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || ended) return;

    setError("");
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setSending(true);

    try {
      const res = await fetch("/api/craving-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  async function handleOutcome(outcome: "resisted" | "gave_in") {
    if (!sessionId) {
      // Just end locally if the chat never started properly
      setEnded(true);
      router.push("/dashboard");
      return;
    }
    try {
      const supabase = createClient();
      await supabase
        .from("crave_sessions")
        .update({
          outcome,
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      setEnded(true);
      // Small delay so the user sees the confirmation
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save outcome");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-primary/20 px-6 py-4 md:px-12">
        <Link
          href="/dashboard"
          className="rounded-full border-2 border-primary/40 p-2 text-lavender hover:border-primary hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-emergency" />
          <div>
            <h1 className="text-xl font-bold text-white">Crave Killer</h1>
            <p className="text-xs text-lavender/60">
              I&apos;m here to help you ride the wave
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-lavender/60">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-highlight" />
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-highlight"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-highlight"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span>Thinking...</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-emergency/50 bg-emergency/10 p-3 text-sm text-emergency">
            {error}
          </div>
        )}
        {ended && (
          <div className="rounded-xl border border-green-400/50 bg-green-400/10 p-4 text-center text-sm text-green-400">
            Thanks for showing up for yourself. Heading back to dashboard...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input and outcome buttons */}
      {!ended && (
        <div className="mx-auto w-full max-w-2xl border-t border-primary/20 px-6 py-4">
          {messages.length >= 3 && sessionId && (
            <div className="mb-3 flex items-center justify-center gap-3">
              <button
                onClick={() => handleOutcome("resisted")}
                className="inline-flex items-center gap-2 rounded-full border-2 border-green-400/60 bg-green-400/10 px-5 py-2 text-xs font-semibold tracking-widest text-green-400 hover:bg-green-400/20"
              >
                <Check className="h-3 w-3" />
                I RESISTED
              </button>
              <button
                onClick={() => handleOutcome("gave_in")}
                className="inline-flex items-center gap-2 rounded-full border-2 border-primary/40 px-5 py-2 text-xs font-semibold tracking-widest text-lavender/80 hover:border-primary hover:text-white"
              >
                <X className="h-3 w-3" />I GAVE IN
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type what you're feeling..."
              rows={2}
              disabled={sending}
              className="flex-1 resize-none rounded-xl border border-primary/40 bg-space/60 px-4 py-3 text-white placeholder:text-lavender/40 focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="rounded-xl bg-primary px-5 font-semibold text-white shadow-[0_0_20px_rgba(157,78,221,0.3)] hover:bg-highlight disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-primary/80 text-white"
            : "border border-primary/40 bg-card/60 text-lavender"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
