"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ChatInterfaceProps {
  initialHistory: Message[];
  initialSessions: ChatSession[];
  activeSessionId: string | null;
  userEmail: string;
  isAnonymous: boolean;
}

export default function ChatInterface({
  initialHistory,
  initialSessions,
  activeSessionId,
  userEmail,
  isAnonymous,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialHistory);
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingSessionId, setIsDeletingSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localIsAnonymous, setLocalIsAnonymous] = useState(isAnonymous);
  const [localUserEmail, setLocalUserEmail] = useState(userEmail);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [promoEmail, setPromoEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoStep, setPromoStep] = useState<"email" | "otp">("email");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isPromoLoading, setIsPromoLoading] = useState(false);

  const handleStartPromo = () => {
    setPromoEmail("");
    setPromoCode("");
    setPromoStep("email");
    setPromoError(null);
    setIsPromoModalOpen(true);
  };

  const handleSendPromoEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoEmail.trim()) return;
    setIsPromoLoading(true);
    setPromoError(null);

    try {
      const { linkEmailToAnonymous } = await import("@/app/login/actions");
      const res = await linkEmailToAnonymous(promoEmail);
      if (res?.error) {
        setPromoError(res.error);
      } else {
        setPromoStep("otp");
      }
    } catch (err) {
      console.error(err);
      setPromoError("接続エラーが発生しました。");
    } finally {
      setIsPromoLoading(false);
    }
  };

  const handleVerifyPromoOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoEmail || !promoCode) return;
    setIsPromoLoading(true);
    setPromoError(null);

    try {
      const { verifyAndLinkOtp } = await import("@/app/login/actions");
      const res = await verifyAndLinkOtp(promoEmail, promoCode);
      if (res?.error) {
        setPromoError(res.error);
      } else {
        setLocalIsAnonymous(false);
        setLocalUserEmail(promoEmail);
        setIsPromoModalOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setPromoError("認証中にエラーが発生しました。");
    } finally {
      setIsPromoLoading(false);
    }
  };

  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync props to state when they change
  useEffect(() => {
    setMessages(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

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

  const handleSend = async (messageText: string) => {
    const trimmedMessage = messageText.trim();
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
        body: JSON.stringify({
          message: trimmedMessage,
          sessionId: activeSessionId,
        }),
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

      // 4. Handle new session redirection/state update
      if (!activeSessionId && data.sessionId) {
        // This was a new session! Add it to list and redirect
        const newSession: ChatSession = {
          id: data.sessionId,
          title: data.title || "新しい相談",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setSessions((prev) => [newSession, ...prev]);
        router.push(`/chat?session_id=${data.sessionId}`);
      } else if (activeSessionId) {
        // Existing session: Update updated_at of the active session and move to top
        setSessions((prev) => {
          const targetIndex = prev.findIndex((s) => s.id === activeSessionId);
          if (targetIndex === -1) return prev;
          
          const updated = [...prev];
          updated[targetIndex] = {
            ...updated[targetIndex],
            updated_at: new Date().toISOString(),
          };
          // Sort to put the most recently updated session at the top
          return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "接続に失敗しました。少し時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setIsSidebarOpen(false);
    setError(null);
    router.push("/chat");
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("この相談履歴を削除しますか？\n削除された履歴は元に戻せません。")) {
      return;
    }

    setIsDeletingSessionId(sessionId);
    try {
      const response = await fetch("/api/chat/sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "削除に失敗しました。");
      }

      // Remove from UI list
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // If deleted session was the active one, redirect to new chat
      if (activeSessionId === sessionId) {
        router.push("/chat");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "エラーが発生しました。");
    } finally {
      setIsDeletingSessionId(null);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
      return "";
    }
  };

  // Quick suggestion prompts for empty chats
  const quickPrompts = [
    {
      emoji: "⚖️",
      title: "家事の分担",
      prompt: "平日の家事や育児の分担が夫婦間で偏っているように感じていて、不満が溜まっています。どのように役割分担を整理し、話し合うのが良いでしょうか？"
    },
    {
      emoji: "⏰",
      title: "仕事と育児の両立",
      prompt: "仕事から帰宅した後のスケジュールが慌ただしく、気持ちの余裕がありません。タスクを整理して、少しでも穏やかに過ごすための工夫を知りたいです。"
    },
    {
      emoji: "🗣️",
      title: "パートナーへの相談",
      prompt: "育児のやり方や方針について、パートナーにうまく自分の意見を伝えられません。お互いに感情的にならずに建設的に話すためのコツを教えてください。"
    }
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/35 z-40 sm:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:static sm:z-auto sm:flex sm:flex-col shrink-0 border-r transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        }`}
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        {/* Sidebar Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">🧭</span>
            <span className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
              相談履歴
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="sm:hidden p-1.5 rounded-lg border hover:bg-gray-50 transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={handleNewChat}
            className="w-full py-3 px-4 rounded-xl text-white font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, var(--accent), #D48C9E)",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新しい相談を始める
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {sessions.length === 0 ? (
            <div className="text-center py-8 px-4 text-xs space-y-2" style={{ color: "var(--muted)" }}>
              <p>過去の相談はまだありません。</p>
              <p>メッセージを送信すると、ここに自動で履歴が追加されます。</p>
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isDeleting = isDeletingSessionId === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setError(null);
                    router.push(`/chat?session_id=${session.id}`);
                  }}
                  className={`group relative rounded-xl p-3 flex flex-col gap-1.5 cursor-pointer border transition-all duration-200 select-none ${
                    isActive
                      ? "shadow-sm"
                      : "hover:bg-[var(--accent-light)]/50 hover:border-[var(--border)] border-transparent"
                  }`}
                  style={{
                    background: isActive ? "var(--accent-light)" : "transparent",
                    borderColor: isActive ? "var(--border)" : "transparent",
                  }}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-3 bottom-3 w-1 rounded-r-lg"
                      style={{ background: "var(--accent)" }}
                    />
                  )}

                  {/* Title & Delete Icon */}
                  <div className="flex justify-between items-start gap-2 pl-1">
                    <span
                      className={`text-xs font-semibold line-clamp-2 pr-4 transition-colors duration-150 ${
                        isActive ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                      }`}
                    >
                      {session.title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      disabled={isDeleting}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 sm:absolute sm:right-2 sm:top-2 p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 cursor-pointer sm:opacity-0 sm:group-hover:opacity-100"
                      title="相談を削除"
                    >
                      {isDeleting ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Updated Time */}
                  <span className="text-[10px] pl-1 font-medium" style={{ color: "var(--muted)" }}>
                    {formatDate(session.updated_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t flex flex-col gap-2.5" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] truncate max-w-[150px] font-medium" style={{ color: "var(--muted)" }}>
              {localUserEmail}
            </span>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-[10px] text-red-400 hover:text-red-600 transition-colors font-semibold cursor-pointer"
            >
              {isSigningOut ? "処理中..." : "ログアウト"}
            </button>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="flex-1 text-center text-xs py-2 rounded-lg font-medium border transition-all duration-200 hover:bg-gray-50"
              style={{ color: "var(--muted)", borderColor: "var(--border)", background: "var(--card)" }}
            >
              ホーム
            </Link>
            <Link
              href="/profile"
              className="flex-1 text-center text-xs py-2 rounded-lg font-medium border transition-all duration-200 hover:bg-gray-50"
              style={{ color: "var(--accent)", borderColor: "var(--accent)", background: "var(--card)" }}
            >
              プロフィール
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Main Header */}
        <header
          className="px-6 py-4 flex items-center justify-between border-b shrink-0 shadow-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="sm:hidden p-1.5 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-lg font-semibold tracking-tight truncate max-w-[200px] sm:max-w-md" style={{ color: "var(--foreground)" }}>
              {activeSession ? activeSession.title : "新しい相談室"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs px-3 py-2 rounded-lg font-medium border transition-colors hover:opacity-90 hidden sm:inline-block"
              style={{
                color: "var(--muted)",
                borderColor: "var(--border)",
                background: "var(--card)",
              }}
            >
              ホーム
            </Link>
            <Link
              href="/profile"
              className="text-xs px-3 py-2 rounded-lg font-medium border transition-colors hover:opacity-95"
              style={{
                color: "var(--accent)",
                borderColor: "var(--accent)",
                background: "var(--card)",
              }}
            >
              プロフィール
            </Link>
          </div>
        </header>

        {/* Guest Warning Banner */}
        {localIsAnonymous && (
          <div
            className="px-6 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in text-xs font-medium shrink-0"
            style={{
              background: "var(--accent-light)",
              borderColor: "var(--border)",
              color: "var(--accent)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>
                <strong>ゲストモードで利用中です。</strong> ブラウザの履歴クリアやシークレットモードでは相談履歴が消去されます。
              </span>
            </div>
            <button
              onClick={handleStartPromo}
              className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg text-white font-semibold shadow-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer text-center whitespace-nowrap"
              style={{ background: "var(--accent)" }}
            >
              メールアドレスを登録してデータを保存する
            </button>
          </div>
        )}

        {/* Chat Feed */}
        <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          <div className="max-w-2xl mx-auto space-y-6">
            
            {messages.length === 0 ? (
              /* Welcome Guide when history is empty */
              <div className="py-8 px-6 sm:py-12 sm:px-8 rounded-2xl border text-center space-y-6 shadow-sm animate-fade-in" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "var(--accent-light)" }}>
                  <span className="text-3xl">🤝</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
                    Family Compass 相談室
                  </h3>
                  <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--muted)" }}>
                    日々の家事、育児、パートナーのこと、仕事との両立など、
                    頭の中でこんがらがっていることを何でも話してください。
                    あなたの家庭事情に寄り添いながら一緒に整理します。
                  </p>
                </div>
                
                {/* Quick Prompts Suggestions */}
                <div className="grid grid-cols-1 gap-3 max-w-lg mx-auto pt-2 text-left">
                  <p className="text-xs font-semibold px-1" style={{ color: "var(--accent)" }}>💡 例えばこのような相談から始められます：</p>
                  {quickPrompts.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputValue(item.prompt);
                        handleSend(item.prompt);
                      }}
                      className="p-3.5 rounded-xl border text-xs text-left leading-relaxed transition-all duration-300 hover:shadow-md hover:bg-[var(--accent-light)]/20 cursor-pointer flex items-start gap-2.5 active:scale-[0.99]"
                      style={{ background: "var(--card)", borderColor: "var(--border)" }}
                    >
                      <span className="text-base shrink-0">{item.emoji}</span>
                      <div>
                        <p className="font-semibold mb-0.5" style={{ color: "var(--foreground)" }}>{item.title}</p>
                        <p className="line-clamp-2" style={{ color: "var(--muted)" }}>{item.prompt}</p>
                      </div>
                    </button>
                  ))}
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
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs border font-semibold shadow-sm"
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
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs border font-semibold"
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="max-w-2xl mx-auto flex gap-3"
          >
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

      {/* Promotion (Email Linking) Modal */}
      {isPromoModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-xl border animate-scale-up"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                相談データを保存する
              </h3>
              <button
                onClick={() => setIsPromoModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                style={{ color: "var(--muted)" }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {promoStep === "email" ? (
              /* Step 1: Input Email */
              <form onSubmit={handleSendPromoEmail} className="space-y-4">
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  現在の相談履歴（プロフィールやこれまでの会話）を引き継いだまま、メールアドレスと紐づけます。次回以降、同じメールアドレスでログインすれば、いつでもどこからでも履歴の続きから再開できます。
                </p>

                {promoError && (
                  <div
                    className="p-3.5 rounded-xl text-xs border flex items-start gap-2"
                    style={{
                      background: "#FFF0F1",
                      borderColor: "#FAD4D6",
                      color: "#E15256",
                    }}
                  >
                    <span className="font-semibold">{promoError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="promo-email"
                    className="block text-[11px] font-semibold tracking-wider uppercase"
                    style={{ color: "var(--muted)" }}
                  >
                    メールアドレス
                  </label>
                  <input
                    id="promo-email"
                    type="email"
                    required
                    placeholder="example@email.com"
                    value={promoEmail}
                    onChange={(e) => setPromoEmail(e.target.value)}
                    disabled={isPromoLoading}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
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
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPromoModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                    style={{
                      color: "var(--muted)",
                      borderColor: "var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isPromoLoading || !promoEmail}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      background: "var(--accent)",
                      opacity: isPromoLoading || !promoEmail ? 0.6 : 1,
                    }}
                  >
                    {isPromoLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "認証メールを送信"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Input Verification Code */
              <form onSubmit={handleVerifyPromoOtp} className="space-y-4 animate-fade-in">
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  入力されたメールアドレス（<span className="font-semibold" style={{ color: "var(--foreground)" }}>{promoEmail}</span>）宛に、認証コードを送信しました。メールに記載の認証コードを入力してください。
                </p>

                {promoError && (
                  <div
                    className="p-3.5 rounded-xl text-xs border flex items-start gap-2"
                    style={{
                      background: "#FFF0F1",
                      borderColor: "#FAD4D6",
                      color: "#E15256",
                    }}
                  >
                    <span className="font-semibold">{promoError}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-center">
                  <label
                    htmlFor="promo-code"
                    className="block text-[11px] font-semibold tracking-wider uppercase text-left"
                    style={{ color: "var(--muted)" }}
                  >
                    認証コード
                  </label>
                  <input
                    id="promo-code"
                    type="text"
                    required
                    maxLength={8}
                    placeholder="8桁のコード"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    disabled={isPromoLoading}
                    className="w-full px-4 py-3 rounded-xl text-center tracking-[4px] text-lg font-bold outline-none transition-all duration-200"
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
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPromoStep("email");
                      setPromoCode("");
                      setPromoError(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                    style={{
                      color: "var(--muted)",
                      borderColor: "var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    メールを変更
                  </button>
                  <button
                    type="submit"
                    disabled={isPromoLoading || promoCode.length < 6}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    style={{
                      background: "var(--accent)",
                      opacity: isPromoLoading || promoCode.length < 6 ? 0.6 : 1,
                    }}
                  >
                    {isPromoLoading ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "認証して登録"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
