"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatInterfaceProps {
  initialHistory: Message[];
  userEmail: string;
}

export default function ChatInterface({ initialHistory, userEmail }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialHistory);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }
      router.push("/login");
      router.refresh();
    } catch (err: any) {
      console.error("Logout failed:", err);
      setError("ログアウトに失敗しました。もう一度お試しください。");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Auto-scroll to the bottom of the chat list smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedMessage = inputValue.trim();
    if (!trimmedMessage || isLoading) return;

    setInputValue("");
    setError(null);
    setIsLoading(true);

    // 1. Add user message locally for instant UI update
    const userMessage: Message = {
      role: "user",
      content: trimmedMessage,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // 2. Post to our API route
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "通信エラーが発生しました。");
      }

      // 3. Add AI's reply to the message history
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "接続に失敗しました。少し時間をおいて再度お試しください。");
      // Remove the last unsaved user message if communication failed, or keep it and show error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between border-b shrink-0 shadow-sm"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight hover:opacity-85 transition-opacity" style={{ color: "var(--accent)" }}>
            家族AI
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full border hidden sm:inline" style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--background)" }}>
            相談室
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/profile"
            className="text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-medium transition-colors border hover:opacity-95"
            style={{
              color: "var(--accent)",
              borderColor: "var(--accent)",
              background: "var(--card)",
            }}
          >
            プロフィール
          </Link>
          <Link
            href="/"
            className="text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-medium transition-colors border hover:opacity-90"
            style={{
              color: "var(--muted)",
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          >
            ホーム
          </Link>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-medium transition-colors border hover:opacity-90 cursor-pointer"
            style={{
              color: "var(--muted)",
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          >
            {isSigningOut ? "処理中..." : "ログアウト"}
          </button>
        </div>
      </header>

      {/* Main Chat Feed */}
      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {messages.length === 0 ? (
            /* Welcome Guide when history is empty */
            <div className="py-12 px-8 rounded-2xl border text-center space-y-6 shadow-sm animate-fade-in" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "var(--accent-light)" }}>
                <span className="text-3xl">🤝</span>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
                  家族AI 相談室へようこそ
                </h3>
                <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--muted)" }}>
                  日々の家事、育児、パートナーとのこと、仕事との両立など、
                  頭の中でこんがらがっていることを何でも話してください。
                  正解を押し付けず、あなたの家庭事情に寄り添いながら一緒に整理します。
                </p>
              </div>
              <div className="p-4 rounded-xl text-xs text-left space-y-2 max-w-sm mx-auto" style={{ background: "var(--background)", color: "var(--muted)" }}>
                <p className="font-semibold" style={{ color: "var(--accent)" }}>💡 話し方のヒント</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>「平日のスケジュール調整がうまくいかなくて…」</li>
                  <li>「家事の分担について、少し言い合いになりました」</li>
                  <li>「仕事も育児も中途半端に感じて疲れています」</li>
                </ul>
              </div>
            </div>
          ) : (
            /* Render Messages */
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3.5 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
              >
                {/* AI Avatar */}
                {msg.role === "assistant" && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm border font-semibold shadow-sm"
                    style={{ background: "var(--accent-light)", borderColor: "var(--border)", color: "var(--accent)" }}
                  >
                    AI
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[82%] px-4 py-3 shadow-sm border transition-shadow duration-200 hover:shadow-md ${
                    msg.role === "user"
                      ? "rounded-2xl rounded-tr-none text-white"
                      : "rounded-2xl rounded-tl-none"
                  }`}
                  style={{
                    background: msg.role === "user" ? "var(--accent)" : "var(--card)",
                    borderColor: msg.role === "user" ? "var(--accent)" : "var(--border)",
                    color: msg.role === "user" ? "#ffffff" : "var(--foreground)",
                  }}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {msg.content}
                  </p>
                </div>
              </div>
            ))
          )}

          {/* AI is thinking/typing indicator */}
          {isLoading && (
            <div className="flex gap-3.5 justify-start animate-pulse">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm border font-semibold"
                style={{ background: "var(--accent-light)", borderColor: "var(--border)", color: "var(--accent)" }}
              >
                AI
              </div>
              <div
                className="rounded-2xl rounded-tl-none px-5 py-3.5 border shadow-sm flex items-center gap-1.5"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--accent)", animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              className="p-4 rounded-xl text-xs border flex items-start gap-2.5 max-w-md mx-auto"
              style={{
                background: "var(--accent-light)",
                borderColor: "var(--border)",
                color: "var(--accent)",
              }}
            >
              <svg
                className="w-4 h-4 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="leading-relaxed font-semibold">{error}</span>
            </div>
          )}

          {/* Scroll Target */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area (Sticky Footer) */}
      <footer
        className="px-6 py-4 border-t shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-3">
          <textarea
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              // Send message on Enter key press without Shift key
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="AIに相談する（長文も歓迎です。Shift+Enterで改行します）..."
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 resize-none h-[46px] max-h-[120px] overflow-y-auto leading-relaxed"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-light)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="w-12 h-[46px] rounded-xl flex items-center justify-center text-white transition-all duration-300 hover:shadow-sm"
            style={{
              background: "var(--accent)",
              opacity: isLoading || !inputValue.trim() ? 0.6 : 1,
              cursor: isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
            }}
          >
            <svg
              className="w-5 h-5 transform rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
