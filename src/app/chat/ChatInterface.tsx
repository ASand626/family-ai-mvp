"use client";

import Link from "next/link";
import { useState, useRef, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface ChatSession {
  id: string;
  title: string;
  mode: string;
  created_at: string;
  updated_at: string;
  has_memos: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface SessionMemo {
  id: string;
  content: string;
  memo_date: string;
  created_at: string;
  updated_at: string;
}

interface SessionAction {
  id: string;
  session_id: string;
  title: string;
  status: "todo" | "done";
  reflection: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatInterfaceProps {
  initialHistory: Message[];
  initialSessions: ChatSession[];
  activeSessionId: string | null;
  userEmail: string;
  isAnonymous: boolean;
}

function AssistantAvatar() {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm animate-fade-in"
      style={{ background: "var(--accent-light)", borderColor: "var(--border)" }}
      title="Family Compass 伴走パートナー"
    >
      <svg
        className="w-4.5 h-4.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" style={{ stroke: "var(--accent)" }} />
        <polygon
          points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"
          style={{ fill: "var(--accent)", stroke: "var(--accent)" }}
        />
      </svg>
    </div>
  );
}

function parseInlineStyles(text: string) {
  if (!text) return "";
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function formatMessageTime(createdAt?: string) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(createdAt?: string) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

function renderMessageContent(content: string, role: "user" | "assistant") {
  const lines = content.split("\n");
  const isUser = role === "user";
  
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2];
          const sizeClass = level === 1 ? "text-base" : level === 2 ? "text-[15px]" : "text-sm";
          return (
            <div
              key={index}
              className={`font-bold mt-3 mb-1.5 first:mt-0 flex items-center gap-1.5 ${sizeClass}`}
              style={{ color: isUser ? "inherit" : "var(--accent)" }}
            >
              <span className="text-xs">◆</span>
              <span>{parseInlineStyles(text)}</span>
            </div>
          );
        }

        return (
          <div key={index} className="min-h-[1.5rem] break-words">
            {parseInlineStyles(line)}
          </div>
        );
      })}
    </div>
  );
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

  // ── タブ状態 ──
  const [activeTab, setActiveTab] = useState<"chat" | "memo" | "action">("chat");

  // ── メモ機能の状態 ──
  const [memos, setMemos] = useState<SessionMemo[]>([]);
  const [isMemosLoading, setIsMemosLoading] = useState(false);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [newMemoContent, setNewMemoContent] = useState("");
  const [isAddingMemo, setIsAddingMemo] = useState(false);
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);

  // ── アクションプラン（PDCA）の状態 ──
  const [actions, setActions] = useState<SessionAction[]>([]);
  const [isActionsLoading, setIsActionsLoading] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingActionTitle, setEditingActionTitle] = useState("");
  const [editingReflectionId, setEditingReflectionId] = useState<string | null>(null);
  const [editingReflectionContent, setEditingReflectionContent] = useState("");
  const [newActionTitle, setNewActionTitle] = useState("");
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [newSessionMode, setNewSessionMode] = useState<"counsel" | "solution">("counsel");

  // Fetch actions when action tab is active
  useEffect(() => {
    if (activeTab === "action" && activeSessionId) {
      fetchActions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeSessionId]);

  const fetchActions = async () => {
    if (!activeSessionId) return;
    setIsActionsLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/actions?session_id=${activeSessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActions(data.actions || []);
    } catch (err: any) {
      setActionError(err.message || "アクションの取得に失敗しました。");
    } finally {
      setIsActionsLoading(false);
    }
  };

  const handleAddAction = async () => {
    if (!newActionTitle.trim() || !activeSessionId) return;
    setIsSavingAction(true);
    setActionError(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSessionId,
          title: newActionTitle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActions((prev) => [...prev, data.action]);
      setNewActionTitle("");
    } catch (err: any) {
      setActionError(err.message || "アクションの作成に失敗しました。");
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleToggleActionStatus = async (actionId: string, currentStatus: "todo" | "done") => {
    setActionError(null);
    const nextStatus = currentStatus === "todo" ? "done" : "todo";
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? data.action : a))
      );
      
      if (nextStatus === "done") {
        setEditingReflectionId(actionId);
        const action = actions.find(a => a.id === actionId);
        setEditingReflectionContent(action?.reflection || "");
      }
    } catch (err: any) {
      setActionError(err.message || "ステータスの更新に失敗しました。");
    }
  };

  const handleSaveReflection = async (actionId: string) => {
    setIsSavingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reflection: editingReflectionContent.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? data.action : a))
      );
      setEditingReflectionId(null);
      setEditingReflectionContent("");
    } catch (err: any) {
      setActionError(err.message || "振り返りの保存に失敗しました。");
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleUpdateActionTitle = async (actionId: string) => {
    if (!editingActionTitle.trim()) return;
    setIsSavingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editingActionTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? data.action : a))
      );
      setEditingActionId(null);
      setEditingActionTitle("");
    } catch (err: any) {
      setActionError(err.message || "アクションの更新に失敗しました。");
    } finally {
      setIsSavingAction(false);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm("このアクションプランを削除しますか？")) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/actions/${actionId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setActions((prev) => prev.filter((a) => a.id !== actionId));
    } catch (err: any) {
      setActionError(err.message || "アクションの削除に失敗しました。");
    }
  };

  const handleSwitchSessionMode = async (targetMode: "counsel" | "solution") => {
    if (!activeSessionId) {
      setNewSessionMode(targetMode);
      return;
    }
    setIsChangingMode(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/sessions/${activeSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, mode: targetMode } : s
        )
      );

      if (targetMode === "counsel" && activeTab === "action") {
        setActiveTab("chat");
      }
    } catch (err: any) {
      setError(err.message || "モードの変更に失敗しました。");
    } finally {
      setIsChangingMode(false);
    }
  };

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
  const chatScrollRef = useRef<HTMLElement>(null);
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleChatScroll = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 400);
  };

  const scrollChatToTop = () => {
    chatScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 入力内容に合わせてテキストエリアの高さを自動調整する
  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "46px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  useEffect(() => {
    autoResizeTextarea(inputTextareaRef.current);
  }, [inputValue]);

  // ── ストリーミング表示を読める速度に制御するためのタイプライター用バッファ ──
  const revealQueueRef = useRef("");
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const REVEAL_CHARS_PER_TICK = 1;
  const REVEAL_INTERVAL_MS = 50;

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    };
  }, []);

  const startRevealTimer = () => {
    if (revealTimerRef.current) return;
    revealTimerRef.current = setInterval(() => {
      if (revealQueueRef.current.length === 0) {
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }
        return;
      }
      const nextChars = revealQueueRef.current.slice(0, REVEAL_CHARS_PER_TICK);
      revealQueueRef.current = revealQueueRef.current.slice(REVEAL_CHARS_PER_TICK);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, content: last.content + nextChars };
        return updated;
      });
    }, REVEAL_INTERVAL_MS);
  };

  // Sync props to state when they change
  useEffect(() => {
    setMessages(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // メモタブに切り替えた時にメモを取得する
  useEffect(() => {
    if (activeTab === "memo" && activeSessionId) {
      fetchMemos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeSessionId]);

  const fetchMemos = async () => {
    if (!activeSessionId) return;
    setIsMemosLoading(true);
    setMemoError(null);
    try {
      const res = await fetch(`/api/memos?session_id=${activeSessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos(data.memos || []);
    } catch (err: any) {
      setMemoError(err.message || "メモの取得に失敗しました。");
    } finally {
      setIsMemosLoading(false);
    }
  };

  const handleAddMemo = async () => {
    if (!newMemoContent.trim() || !activeSessionId) return;
    setIsSavingMemo(true);
    setMemoError(null);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSessionId,
          content: newMemoContent.trim(),
          memo_date: today,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos((prev) => [data.memo, ...prev]);
      setNewMemoContent("");
      setIsAddingMemo(false);
      // サイドバーのhas_memosフラグを更新
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, has_memos: true } : s
        )
      );
    } catch (err: any) {
      setMemoError(err.message || "メモの作成に失敗しました。");
    } finally {
      setIsSavingMemo(false);
    }
  };

  const handleUpdateMemo = async (memoId: string) => {
    if (!editingContent.trim()) return;
    setIsSavingMemo(true);
    setMemoError(null);
    try {
      const res = await fetch(`/api/memos/${memoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMemos((prev) =>
        prev.map((m) => (m.id === memoId ? data.memo : m))
      );
      setEditingMemoId(null);
      setEditingContent("");
    } catch (err: any) {
      setMemoError(err.message || "メモの更新に失敗しました。");
    } finally {
      setIsSavingMemo(false);
    }
  };

  const handleDeleteMemo = async (memoId: string) => {
    if (!confirm("このメモを削除しますか？")) return;
    setMemoError(null);
    try {
      const res = await fetch(`/api/memos/${memoId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const remaining = memos.filter((m) => m.id !== memoId);
      setMemos(remaining);
      // メモが0件になったらhas_memosをfalseに
      if (remaining.length === 0) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId ? { ...s, has_memos: false } : s
          )
        );
      }
    } catch (err: any) {
      setMemoError(err.message || "メモの削除に失敗しました。");
    }
  };

  // メモを日付でグループ化するヘルパー
  const groupMemosByDate = (memoList: SessionMemo[]) => {
    const groups: { date: string; memos: SessionMemo[] }[] = [];
    const map = new Map<string, SessionMemo[]>();
    for (const memo of memoList) {
      const existing = map.get(memo.memo_date) || [];
      existing.push(memo);
      map.set(memo.memo_date, existing);
    }
    // 日付降順
    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    for (const date of sortedDates) {
      groups.push({ date, memos: map.get(date)! });
    }
    return groups;
  };

  const formatMemoDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
      return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
    } catch {
      return dateStr;
    }
  };

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
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // 2. Post to our API route (the response body is a text stream)
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          sessionId: activeSessionId,
          mode: !activeSessionId ? newSessionMode : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "通信エラーが発生しました。");
      }

      // Session metadata is sent via response headers
      const newSessionId = response.headers.get("X-Session-Id");
      const rawTitle = response.headers.get("X-Session-Title");
      const newSessionTitle = rawTitle ? decodeURIComponent(rawTitle) : null;

      // 3. Read the streaming body and render the AI reply in real time
      if (!response.body) {
        throw new Error("通信エラーが発生しました。");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantStarted = false;
      revealQueueRef.current = "";

      const appendChunk = (chunk: string) => {
        if (!chunk) return;
        if (!assistantStarted) {
          assistantStarted = true;
          setMessages((prev) => [...prev, { role: "assistant", content: "", created_at: new Date().toISOString() }]);
        }
        revealQueueRef.current += chunk;
        startRevealTimer();
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendChunk(decoder.decode(value, { stream: true }));
      }
      appendChunk(decoder.decode());

      // 4. Handle new session redirection/state update
      if (!activeSessionId && newSessionId) {
        // This was a new session! Add it to list and redirect
        const newSession: ChatSession = {
          id: newSessionId,
          title: newSessionTitle || "新しい相談",
          mode: newSessionMode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          has_memos: false,
        };
        setSessions((prev) => [newSession, ...prev]);
        router.push(`/chat?session_id=${newSessionId}`);
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
    <div className="flex h-dvh overflow-hidden" style={{ background: "var(--background)" }}>
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/35 z-40 sm:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col sm:static sm:z-auto shrink-0 border-r transition-transform duration-300 ease-in-out ${
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

                  {/* Updated Time & Memo indicator */}
                  <div className="flex items-center justify-between pl-1">
                    <span className="text-[10px] font-medium" style={{ color: "var(--muted)" }}>
                      {formatDate(session.updated_at)}
                    </span>
                    {session.has_memos && (
                      <span
                        title="メモあり"
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5"
                        style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        メモ
                      </span>
                    )}
                  </div>
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
          <div className="flex justify-center gap-3.5 text-[10px] font-medium pt-1" style={{ color: "var(--muted)" }}>
            <Link href="/terms" className="hover:underline" target="_blank">
              利用規約
            </Link>
            <Link href="/privacy" className="hover:underline" target="_blank">
              プライバシーポリシー
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        
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
            <span className="text-lg font-semibold tracking-tight truncate max-w-[200px] sm:max-w-xs" style={{ color: "var(--foreground)" }}>
              {activeSession ? activeSession.title : "新しい相談室"}
            </span>
            {activeSession && (
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => handleSwitchSessionMode(activeSession.mode === "counsel" ? "solution" : "counsel")}
                  disabled={isChangingMode}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border hover:shadow-sm"
                  style={{
                    background: activeSession.mode === "solution" ? "var(--accent)" : "transparent",
                    borderColor: "var(--accent)",
                    color: activeSession.mode === "solution" ? "#ffffff" : "var(--accent)",
                    opacity: isChangingMode ? 0.7 : 1,
                  }}
                  title="クリックして相談モード/解決モードを切り替え"
                >
                  {activeSession.mode === "solution" ? (
                    <>
                      <span>🧭 解決モード</span>
                      <span className="opacity-75 text-[9px]">→ 相談</span>
                    </>
                  ) : (
                    <>
                      <span>🕯️ 相談モード</span>
                      <span className="opacity-75 text-[9px]">→ 解決</span>
                    </>
                  )}
                </button>
              </div>
            )}
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

        {/* チャット / メモ / アクション タブ（セッションがある場合のみ表示） */}
        {activeSessionId && (
          <div
            className="flex border-b shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            {(activeSession?.mode === "solution"
              ? (["chat", "memo", "action"] as const)
              : (["chat", "memo"] as const)
            ).map((tab) => (
              <button
                key={tab}
                id={`tab-${tab}`}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === "memo") {
                    setIsAddingMemo(false);
                    setEditingMemoId(null);
                    setNewMemoContent("");
                  } else if (tab === "action") {
                    setNewActionTitle("");
                    setEditingActionId(null);
                    setEditingReflectionId(null);
                  }
                }}
                className="flex-1 py-2.5 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                style={{
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  color: activeTab === tab ? "var(--accent)" : "var(--muted)",
                  background: "transparent",
                }}
              >
                {tab === "chat" ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    チャット
                  </>
                ) : tab === "memo" ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    メモ
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    アクション
                  </>
                )}
              </button>
            ))}
          </div>
        )}

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

        {/* ── メモタブ ── */}
        {activeTab === "memo" && activeSessionId && (
          <main className="flex-1 overflow-y-auto px-5 py-6" style={{ background: "var(--background)" }}>
            <div className="max-w-2xl mx-auto space-y-5">

              {/* 説明文 */}
              <div
                className="p-4 rounded-xl text-xs leading-relaxed flex items-start gap-2.5"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>
                  トライしたこと、そのときの気持ち、気になっていること…<br />
                  思ったことを自由に残しておきましょう。
                </span>
              </div>

              {/* メモエラー */}
              {memoError && (
                <div className="p-3 rounded-xl text-xs border" style={{ background: "#FFF0F1", borderColor: "#FAD4D6", color: "#E15256" }}>
                  {memoError}
                </div>
              )}

              {/* ＋ メモを追加 */}
              {!isAddingMemo ? (
                <button
                  id="btn-add-memo"
                  onClick={() => setIsAddingMemo(true)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold border-2 border-dashed transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ borderColor: "var(--border)", color: "var(--muted)", background: "transparent" }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  メモを追加
                </button>
              ) : (
                <div
                  className="rounded-xl border p-4 space-y-3 animate-fade-in"
                  style={{ background: "var(--card)", borderColor: "var(--accent)" }}
                >
                  <textarea
                    id="new-memo-textarea"
                    autoFocus
                    rows={4}
                    value={newMemoContent}
                    onChange={(e) => setNewMemoContent(e.target.value)}
                    placeholder="ここに書いてみましょう…"
                    className="w-full text-sm leading-relaxed outline-none resize-none"
                    style={{ background: "transparent", color: "var(--foreground)" }}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setIsAddingMemo(false); setNewMemoContent(""); }}
                      className="text-xs px-3.5 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer"
                      style={{ color: "var(--muted)", borderColor: "var(--border)", background: "var(--card)" }}
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleAddMemo}
                      disabled={!newMemoContent.trim() || isSavingMemo}
                      className="text-xs px-3.5 py-1.5 rounded-lg font-semibold text-white transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
                      style={{ background: "var(--accent)", opacity: !newMemoContent.trim() || isSavingMemo ? 0.6 : 1 }}
                    >
                      {isSavingMemo ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "保存"}
                    </button>
                  </div>
                </div>
              )}

              {/* メモ一覧（日付グループ） */}
              {isMemosLoading ? (
                <div className="flex justify-center py-10">
                  <span className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
                </div>
              ) : groupMemosByDate(memos).length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: "var(--muted)" }}>
                  まだメモはありません。
                </div>
              ) : (
                groupMemosByDate(memos).map(({ date, memos: dateMemos }) => (
                  <div key={date} className="space-y-2">
                    {/* 日付ラベル */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                        {formatMemoDate(date)}
                      </span>
                      <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                    </div>

                    {/* その日のメモカード */}
                    {dateMemos.map((memo) => (
                      <div
                        key={memo.id}
                        className="rounded-xl border p-4 space-y-2 transition-shadow duration-200 hover:shadow-sm"
                        style={{ background: "var(--card)", borderColor: "var(--border)" }}
                      >
                        {editingMemoId === memo.id ? (
                          /* 編集モード */
                          <div className="space-y-3">
                            <textarea
                              autoFocus
                              rows={4}
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full text-sm leading-relaxed outline-none resize-none"
                              style={{ background: "transparent", color: "var(--foreground)" }}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => { setEditingMemoId(null); setEditingContent(""); }}
                                className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors cursor-pointer"
                                style={{ color: "var(--muted)", borderColor: "var(--border)", background: "var(--card)" }}
                              >
                                キャンセル
                              </button>
                              <button
                                onClick={() => handleUpdateMemo(memo.id)}
                                disabled={!editingContent.trim() || isSavingMemo}
                                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all cursor-pointer"
                                style={{ background: "var(--accent)", opacity: !editingContent.trim() || isSavingMemo ? 0.6 : 1 }}
                              >
                                {isSavingMemo ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : "更新"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 表示モード */
                          <>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--foreground)" }}>
                              {memo.content}
                            </p>
                            <div className="flex justify-end gap-1.5 pt-1">
                              <button
                                onClick={() => { setEditingMemoId(memo.id); setEditingContent(memo.content); }}
                                title="編集"
                                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--accent-light)] cursor-pointer"
                                style={{ color: "var(--muted)" }}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteMemo(memo.id)}
                                title="削除"
                                className="p-1.5 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
                                style={{ color: "var(--muted)" }}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </main>
        )}

        {/* ── アクションプランタブ ── */}
        {activeTab === "action" && activeSessionId && (
          <main className="flex-1 overflow-y-auto px-5 py-6" style={{ background: "var(--background)" }}>
            <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">

              {/* 説明文 */}
              <div
                className="p-4 rounded-xl text-xs leading-relaxed flex items-start gap-2.5"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <span>
                  チャットで話したことから、今日から試してみたい「小さな一歩」を登録しましょう。<br />
                  実行できたらチェックを入れて、振り返りを残しておくと成長を実感しやすくなります。
                </span>
              </div>

              {/* アクションエラー */}
              {actionError && (
                <div className="p-3 rounded-xl text-xs border" style={{ background: "#FFF0F1", borderColor: "#FAD4D6", color: "#E15256" }}>
                  {actionError}
                </div>
              )}

              {/* アクション追加フォーム */}
              <div
                className="rounded-xl border p-4 space-y-3"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex gap-2">
                  <input
                    id="new-action-input"
                    type="text"
                    value={newActionTitle}
                    onChange={(e) => setNewActionTitle(e.target.value)}
                    placeholder="例：今日パートナーに『ありがとう』と伝える、夜10分間お風呂でゆっくりする…"
                    className="flex-1 text-sm outline-none px-3 py-2 rounded-lg border focus:border-[var(--accent)]"
                    style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddAction();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddAction}
                    disabled={!newActionTitle.trim() || isSavingAction}
                    className="text-xs px-4 py-2 rounded-lg font-semibold text-white transition-all cursor-pointer whitespace-nowrap"
                    style={{ background: "var(--accent)", opacity: !newActionTitle.trim() || isSavingAction ? 0.6 : 1 }}
                  >
                    追加
                  </button>
                </div>
              </div>

              {/* アクションプラン一覧 */}
              {isActionsLoading ? (
                <div className="flex justify-center py-10">
                  <span className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
                </div>
              ) : actions.length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: "var(--muted)" }}>
                  まだアクションプランはありません。チャットで話し合ったアイデアを登録してみましょう！
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-xl border p-4 space-y-3 transition-shadow duration-200 hover:shadow-sm"
                      style={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                        opacity: action.status === "done" ? 0.85 : 1
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {/* チェックボックス */}
                          <button
                            onClick={() => handleToggleActionStatus(action.id, action.status)}
                            className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                            style={{
                              borderColor: action.status === "done" ? "var(--accent)" : "var(--border)",
                              background: action.status === "done" ? "var(--accent)" : "transparent",
                            }}
                          >
                            {action.status === "done" && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {editingActionId === action.id ? (
                            /* 編集入力 */
                            <div className="flex-1 flex gap-2">
                              <input
                                autoFocus
                                type="text"
                                value={editingActionTitle}
                                onChange={(e) => setEditingActionTitle(e.target.value)}
                                className="flex-1 text-sm outline-none px-2 py-1 rounded border"
                                style={{ borderColor: "var(--border)", background: "transparent", color: "var(--foreground)" }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleUpdateActionTitle(action.id);
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleUpdateActionTitle(action.id)}
                                className="text-xs px-2.5 py-1 rounded bg-gray-100 hover:bg-gray-200 border transition-colors cursor-pointer"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingActionId(null)}
                                className="text-xs px-2.5 py-1 rounded text-gray-500 hover:bg-gray-50 border transition-colors cursor-pointer"
                              >
                                キャンセル
                              </button>
                            </div>
                          ) : (
                            /* タイトル表示 */
                            <span
                              className={`text-sm font-medium break-words leading-relaxed ${
                                action.status === "done" ? "line-through" : ""
                              }`}
                              style={{ color: action.status === "done" ? "var(--muted)" : "var(--foreground)" }}
                            >
                              {action.title}
                            </span>
                          )}
                        </div>

                        {/* アクション操作（編集・削除） */}
                        {editingActionId !== action.id && (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setEditingActionId(action.id);
                                setEditingActionTitle(action.title);
                              }}
                              title="編集"
                              className="p-1 rounded-lg transition-colors hover:bg-[var(--accent-light)] cursor-pointer"
                              style={{ color: "var(--muted)" }}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteAction(action.id)}
                              title="削除"
                              className="p-1 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500 cursor-pointer"
                              style={{ color: "var(--muted)" }}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 振り返りセクション */}
                      {action.status === "done" && (
                        <div
                          className="mt-2.5 p-3 rounded-lg border text-xs space-y-2"
                          style={{
                            background: "rgba(194, 119, 138, 0.05)",
                            borderColor: "var(--border)",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1" style={{ color: "var(--accent)" }}>
                              <span>💭</span> 振り返り・気づいたこと
                            </span>
                            {editingReflectionId !== action.id && (
                              <button
                                onClick={() => {
                                  setEditingReflectionId(action.id);
                                  setEditingReflectionContent(action.reflection || "");
                                }}
                                className="text-[10px] underline hover:text-[var(--accent)] font-semibold transition-colors cursor-pointer"
                                style={{ color: "var(--muted)" }}
                              >
                                {action.reflection ? "編集する" : "振り返りを書く"}
                              </button>
                            )}
                          </div>

                          {editingReflectionId === action.id ? (
                            /* 振り返り編集入力 */
                            <div className="space-y-2 pt-1">
                              <textarea
                                autoFocus
                                rows={3}
                                value={editingReflectionContent}
                                onChange={(e) => setEditingReflectionContent(e.target.value)}
                                placeholder="実際にやってみてどうでしたか？（気持ちの変化や工夫できたことなど）"
                                className="w-full text-xs leading-relaxed outline-none resize-none p-2 rounded-lg border bg-white"
                                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingReflectionId(null);
                                    setEditingReflectionContent("");
                                  }}
                                  className="px-2.5 py-1 rounded border font-medium bg-white hover:bg-gray-50 text-[10px] cursor-pointer"
                                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                                >
                                  キャンセル
                                </button>
                                <button
                                  onClick={() => handleSaveReflection(action.id)}
                                  disabled={isSavingAction}
                                  className="px-2.5 py-1 rounded text-white font-semibold text-[10px] hover:opacity-90 cursor-pointer"
                                  style={{ background: "var(--accent)" }}
                                >
                                  保存
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* 振り返り表示 */
                            <p className="leading-relaxed" style={{ color: "var(--foreground)" }}>
                              {action.reflection ? (
                                <span className="whitespace-pre-wrap">{action.reflection}</span>
                              ) : (
                                <span className="italic" style={{ color: "var(--muted)" }}>
                                  振り返りがまだありません。「振り返りを書く」から記録を残しましょう。
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </main>
        )}

        {/* Chat Feed */}
        <main
          ref={chatScrollRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto px-6 py-8 space-y-6 transition-colors duration-500"
          style={{
            display: activeTab !== "chat" ? "none" : undefined,
            background:
              (activeSession?.mode ?? newSessionMode) === "solution"
                ? "var(--chat-bg-solution)"
                : "var(--chat-bg-counsel)",
          }}
        >
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

                {/* Mode Selector Card */}
                <div className="space-y-3 max-w-lg mx-auto text-left pt-2">
                  <p className="text-xs font-semibold px-1" style={{ color: "var(--accent)" }}>🛡️ 相談モードを選択してください：</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={() => handleSwitchSessionMode("counsel")}
                      className="p-4 rounded-xl border text-xs text-left leading-relaxed transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col gap-1.5 active:scale-[0.99]"
                      style={{
                        background: newSessionMode === "counsel" ? "var(--accent-counsel-light)" : "var(--card)",
                        borderColor: newSessionMode === "counsel" ? "var(--accent-counsel)" : "var(--border)",
                      }}
                    >
                      <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>🕯️ 相談モード (傾聴優先)</span>
                      <span className="leading-normal" style={{ color: "var(--muted)", fontSize: "11px" }}>
                        お気持ちや悩みをとにかく吐き出したい時に。AIが優しく傾聴し、頭の整理に伴走します。
                      </span>
                    </button>
                    <button
                      onClick={() => handleSwitchSessionMode("solution")}
                      className="p-4 rounded-xl border text-xs text-left leading-relaxed transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col gap-1.5 active:scale-[0.99]"
                      style={{
                        background: newSessionMode === "solution" ? "var(--accent-solution-light)" : "var(--card)",
                        borderColor: newSessionMode === "solution" ? "var(--accent-solution)" : "var(--border)",
                      }}
                    >
                      <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>🧭 解決モード (課題整理)</span>
                      <span className="leading-normal" style={{ color: "var(--muted)", fontSize: "11px" }}>
                        課題解決に向けて動きたい時に。小さな一歩を決めて、少しずつ前に進みます。
                      </span>
                    </button>
                  </div>
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
                        <p className="sm:line-clamp-2" style={{ color: "var(--muted)" }}>{item.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Render Messages */
              messages.map((msg, index) => {
                const timeLabel = formatMessageTime(msg.created_at);
                const dateDivider = formatDateDivider(msg.created_at);
                const prevDateDivider = index > 0 ? formatDateDivider(messages[index - 1].created_at) : null;
                const showDateDivider = dateDivider !== null && dateDivider !== prevDateDivider;
                return (
                <Fragment key={index}>
                  {showDateDivider && (
                    <div className="flex items-center justify-center py-1">
                      <span
                        className="text-[11px] font-medium px-3 py-1 rounded-full border"
                        style={{ background: "var(--card)", color: "var(--muted)", borderColor: "var(--border)" }}
                      >
                        {dateDivider}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex items-end gap-3.5 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                  >
                    {/* AI Avatar */}
                    {msg.role === "assistant" && (
                      <AssistantAvatar />
                    )}

                    {/* Timestamp (LINE style: to the left of own message) */}
                    {msg.role === "user" && timeLabel && (
                      <span
                        className="text-[10px] shrink-0 whitespace-nowrap pb-0.5"
                        style={{ color: "var(--muted)" }}
                      >
                        {timeLabel}
                      </span>
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
                      <div className="text-sm leading-relaxed font-medium">
                        {renderMessageContent(msg.content, msg.role)}
                      </div>
                    </div>

                    {/* Timestamp (LINE style: to the right of received message) */}
                    {msg.role === "assistant" && timeLabel && (
                      <span
                        className="text-[10px] shrink-0 whitespace-nowrap pb-0.5"
                        style={{ color: "var(--muted)" }}
                      >
                        {timeLabel}
                      </span>
                    )}
                  </div>
                </Fragment>
                );
              })
            )}

            {/* AI is thinking/typing indicator (hidden once the reply starts streaming in) */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3.5 justify-start animate-pulse">
                <AssistantAvatar />
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

        {/* Scroll to top button */}
        {activeTab === "chat" && showScrollTop && (
          <button
            type="button"
            onClick={scrollChatToTop}
            title="一番上のチャットに戻る"
            className="absolute right-5 bottom-24 sm:bottom-28 z-10 w-10 h-10 rounded-full flex items-center justify-center border shadow-md transition-all duration-200 hover:shadow-lg active:scale-95 cursor-pointer animate-fade-in"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--accent)" }}
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}

        {/* Input Area (Sticky Footer) */}
        {activeTab === "chat" && (
          <footer
            className="px-6 py-4 border-t shrink-0 animate-fade-in"
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
                ref={inputTextareaRef}
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
        )}
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

                <div className="p-3 rounded-xl border leading-relaxed text-[11px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted)" }}>
                  🔒 <strong>プライバシー保護</strong>
                  <br />
                  登録されたデータは暗号化され、AIのモデル学習には利用されません。詳細は<Link href="/privacy" className="underline hover:opacity-85 mx-0.5" target="_blank">プライバシーポリシー</Link>をご確認ください。
                </div>

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
