import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ChatInterface from "./ChatInterface";

export default async function ChatPage() {
  const supabase = await createClient();

  // 1. Secure route: Check authorization on the server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch past conversation history from Supabase conversations table
  const { data: rawHistory, error } = await supabase
    .from("conversations")
    .select("role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true }) // oldest first to render sequentially
    .limit(50); // Fetch latest 50 messages to render initial viewport quickly

  if (error) {
    console.error("Fetch conversation history error:", error);
  }

  const history = (rawHistory || []).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
    created_at: msg.created_at,
  }));

  return <ChatInterface initialHistory={history} userEmail={user.email || ""} />;
}
