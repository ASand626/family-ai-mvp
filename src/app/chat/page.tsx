import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ChatInterface from "./ChatInterface";

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function ChatPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // 1. Secure route: Check authorization on the server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const activeSessionId = resolvedSearchParams.session_id;

  // 2. Fetch all chat sessions for this user, sorted by updated_at descending (latest first)
  const { data: rawSessions, error: sessionsError } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at, session_memos(id)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (sessionsError) {
    console.error("Fetch chat sessions error:", sessionsError);
  }

  const sessions = (rawSessions || []).map((s) => ({
    id: s.id,
    title: s.title,
    created_at: s.created_at,
    updated_at: s.updated_at,
    has_memos: Array.isArray(s.session_memos) && s.session_memos.length > 0,
  }));


  // 3. Fetch past conversation history for the active session, if specified
  let history: { role: "user" | "assistant"; content: string; created_at?: string }[] = [];

  if (activeSessionId) {
    const { data: rawHistory, error: historyError } = await supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .eq("session_id", activeSessionId)
      .order("created_at", { ascending: true }) // oldest first to render sequentially
      .limit(50); // Fetch latest 50 messages to render initial viewport quickly

    if (historyError) {
      console.error("Fetch conversation history error:", historyError);
    }

    history = (rawHistory || []).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
      created_at: msg.created_at,
    }));
  }

  const isAnonymous = user.is_anonymous || false;
  const userEmail = isAnonymous ? "ゲストユーザー" : user.email || "";

  return (
    <ChatInterface
      initialHistory={history}
      initialSessions={sessions}
      activeSessionId={activeSessionId || null}
      userEmail={userEmail}
      isAnonymous={isAnonymous}
    />
  );
}
