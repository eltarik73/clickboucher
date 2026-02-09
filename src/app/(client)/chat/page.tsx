"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };

const WELCOME_MSG =
  "Salut ! 👋 Je suis l'assistant Klik&Go. Je peux t'aider à trouver de la viande, te conseiller sur les quantités, ou te recommander une boucherie. Qu'est-ce qui te ferait plaisir ?";

const SUGGESTIONS = [
  "🥩 Que me conseilles-tu pour un BBQ 6 personnes ?",
  "🐑 Je cherche de l'agneau pour un couscous",
  "🔥 Quelles sont les promos du moment ?",
  "🏪 Quelle boucherie est la plus rapide ?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MSG },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scrollToBottom() {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setShowSuggestions(false);
    setInput("");

    const userMsg: Message = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erreur serveur");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content },
      ]);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Erreur de connexion";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Désolé, une erreur est survenue : ${errorMsg}. Réessaie dans un instant.` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f8f6f3] dark:bg-[#1a1814]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#2a2520] border-b border-gray-100 dark:border-[#3a3530] shrink-0">
        <Link
          href="/decouvrir"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3530] transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-[#f8f6f3]">
              Assistant Klik&Go
            </h1>
            <p className="text-[11px] text-green-600 dark:text-green-400 font-medium">
              En ligne
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-2"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#DC2626] text-white rounded-2xl rounded-br-md"
                  : "bg-white dark:bg-[#2a2520] text-gray-900 dark:text-[#f8f6f3] rounded-2xl rounded-bl-md shadow-sm border border-gray-100 dark:border-[#3a3530]"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Suggestions */}
        {showSuggestions && messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-3 py-2 text-[13px] font-medium bg-white dark:bg-[#2a2520] text-gray-700 dark:text-gray-300 rounded-xl border border-gray-200 dark:border-[#3a3530] hover:border-[#DC2626] hover:text-[#DC2626] dark:hover:border-[#DC2626] dark:hover:text-[#DC2626] transition-colors shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#2a2520] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-gray-100 dark:border-[#3a3530]">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-3 bg-white dark:bg-[#2a2520] border-t border-gray-100 dark:border-[#3a3530] mb-[env(safe-area-inset-bottom)] pb-16">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Demande-moi conseil..."
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-[#1a1814] text-gray-900 dark:text-[#f8f6f3] rounded-full text-[15px] outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#DC2626]/30 transition-shadow"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-full bg-[#DC2626] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#b91c1c] transition-colors shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
