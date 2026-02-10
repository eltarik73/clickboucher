"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, X, ShoppingCart, CheckCircle } from "lucide-react";
import { useCart } from "@/lib/hooks/use-cart";

// ── Types ────────────────────────────────────────

type ChatAction =
  | {
      type: "add_to_cart";
      productId: string;
      productName: string;
      shopId: string;
      shopName: string;
      shopSlug: string;
      priceCents: number;
      unit: string;
      quantity: number;
      weightGrams?: number;
    }
  | { type: "go_to_checkout" };

type Message = {
  role: "user" | "assistant";
  content: string;
  actions?: ChatAction[];
};

// ── Constants ────────────────────────────────────

const WELCOME_MSG =
  "Salut ! \uD83D\uDC4B Je suis ton assistant boucherie. Dis-moi ce qu'il te faut — je m'occupe de tout, même de remplir ton panier !";

const SUGGESTIONS = [
  "\uD83E\uDD69 BBQ 6 personnes",
  "\uD83D\uDC11 Couscous agneau",
  "\uD83D\uDD25 Promos du moment",
  "\uD83C\uDFEA Boucherie la + rapide",
];

// ── Parse hidden actions from bot response ──────

const ACTION_REGEX = /<!--ACTION:(.*?)-->/g;

function parseActions(raw: string): { clean: string; actions: ChatAction[] } {
  const actions: ChatAction[] = [];
  let match: RegExpExecArray | null;

  while ((match = ACTION_REGEX.exec(raw)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      actions.push(parsed as ChatAction);
    } catch {
      // malformed JSON — skip
    }
  }

  // Reset regex lastIndex
  ACTION_REGEX.lastIndex = 0;

  const clean = raw.replace(ACTION_REGEX, "").trim();
  return { clean, actions };
}

// ── Butcher SVG Icon ─────────────────────────────

function ButcherIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="12" y="4" width="16" height="6" rx="3" fill="white" />
      <rect x="14" y="8" width="12" height="4" rx="1" fill="white" />
      <circle cx="20" cy="18" r="7" fill="#FDDCB5" />
      <circle cx="17" cy="17" r="1.2" fill="#333" />
      <circle cx="23" cy="17" r="1.2" fill="#333" />
      <path d="M17 20.5 Q20 23 23 20.5" stroke="#333" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M13 25 Q20 24 27 25 L28 36 Q20 37 12 36 Z" fill="white" />
      <line x1="20" y1="26" x2="20" y2="35" stroke="#ddd" strokeWidth="0.8" />
      <rect x="29" y="20" width="2" height="10" rx="0.5" fill="#888" />
      <rect x="28" y="19" width="4" height="3" rx="1" fill="#654321" />
      <polygon points="29,30 31,30 30,34" fill="#aaa" />
    </svg>
  );
}

// ── Typing dots ──────────────────────────────────

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Action Confirmations ─────────────────────────

function CartConfirmation({ name }: { name: string }) {
  return (
    <div className="flex justify-start">
      <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-green-700 text-xs flex items-center gap-2">
        <CheckCircle size={14} className="shrink-0" />
        <span className="font-medium">{name} ajouté au panier</span>
      </div>
    </div>
  );
}

function CheckoutButton({ prepTime }: { prepTime?: number }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => router.push("/panier")}
        className="bg-[#DC2626] text-white rounded-xl py-3 px-6 font-semibold text-sm w-full text-center hover:bg-[#b91c1c] transition-colors flex items-center justify-center gap-2"
      >
        <ShoppingCart size={16} />
        Commander{prepTime ? ` · Retrait en ~${prepTime} min` : ""}
      </button>
      <button
        onClick={() => router.push("/panier")}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
      >
        Modifier ma commande
      </button>
    </div>
  );
}

// ── Main Widget ──────────────────────────────────

export function ChatWidget() {
  const router = useRouter();
  const { addItem } = useCart();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MSG },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore open state from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("klikgo-chat-open");
    if (saved === "true") setOpen(true);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("klikgo-chat-open", String(open));
  }, [open]);

  // Listen for custom event from BottomNav
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("klikgo:open-chat", handler);
    return () => window.removeEventListener("klikgo:open-chat", handler);
  }, []);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, isLoading, open, scrollToBottom]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Execute actions from bot response
  const executeActions = useCallback(
    (actions: ChatAction[]) => {
      for (const action of actions) {
        if (action.type === "add_to_cart") {
          addItem(
            {
              id: action.productId,
              productId: action.productId,
              name: action.productName,
              imageUrl: "",
              unit: (action.unit || "KG") as "KG" | "PIECE" | "BARQUETTE",
              priceCents: action.priceCents,
              quantity: action.quantity || 1,
              weightGrams: action.weightGrams,
            },
            {
              id: action.shopId,
              name: action.shopName,
              slug: action.shopSlug || action.shopId,
            }
          );
        }
        // go_to_checkout is handled by rendering a button — no immediate action
      }
    },
    [addItem]
  );

  // Send message
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
        body: JSON.stringify({
          messages: updated.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Erreur serveur");
      }

      const data = await res.json();
      const { clean, actions } = parseActions(data.content);

      // Execute cart actions
      if (actions.length > 0) {
        executeActions(actions);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: clean, actions },
      ]);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Erreur de connexion";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `D\u00e9sol\u00e9, une erreur est survenue : ${errorMsg}. R\u00e9essaie dans un instant.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {/* ═══ CHAT PANEL ═══ */}
      <div
        className={`fixed bottom-24 right-4 z-50 flex flex-col bg-white rounded-[20px] shadow-[0_12px_48px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-300 origin-bottom-right ${
          open
            ? "scale-100 opacity-100 pointer-events-auto"
            : "scale-90 opacity-0 pointer-events-none"
        } w-[calc(100vw-32px)] sm:w-[360px] h-[70vh] sm:h-[480px]`}
      >
        {/* Header */}
        <div className="shrink-0 bg-[#DC2626] px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <ButcherIcon size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Assistant Klik&Go</p>
            <p className="text-xs text-white/80">
              En ligne &bull; Commande directe
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/70 hover:text-white transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-[#f8f6f3] px-4 py-4 space-y-3"
        >
          {messages.map((msg, i) => (
            <div key={i}>
              {/* Message bubble */}
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[#DC2626] text-white rounded-2xl rounded-br-sm"
                      : "bg-white border border-gray-100 text-gray-900 rounded-2xl rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>

              {/* Action confirmations */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.actions.map((action, j) => {
                    if (action.type === "add_to_cart") {
                      return (
                        <CartConfirmation
                          key={`cart-${i}-${j}`}
                          name={action.productName}
                        />
                      );
                    }
                    if (action.type === "go_to_checkout") {
                      return <CheckoutButton key={`checkout-${i}-${j}`} />;
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Suggestions */}
          {showSuggestions && messages.length === 1 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 text-xs font-medium border border-[#DC2626] text-[#DC2626] rounded-full hover:bg-[#DC2626] hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {isLoading && <TypingDots />}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
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
              placeholder="Ex: 1kg d'entrecôte..."
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm outline-none focus:border-[#DC2626] transition-colors placeholder:text-gray-400"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 bg-[#DC2626] rounded-full flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#b91c1c] transition-colors shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ FLOATING BUBBLE ═══ */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-50 w-[60px] h-[60px] rounded-full bg-[#DC2626] flex items-center justify-center shadow-[0_6px_24px_rgba(220,38,38,0.4)] hover:scale-[1.08] transition-transform duration-200 ${
          open ? "scale-0 opacity-0" : "scale-100 opacity-100"
        }`}
        aria-label="Ouvrir le chat"
      >
        <span className="absolute inset-0 rounded-full bg-[#DC2626] animate-ping opacity-20" />
        <div className="relative z-10">
          <ButcherIcon size={32} />
        </div>
      </button>
    </>
  );
}
