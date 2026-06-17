import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/actions?session_id=xxx
// セッションに紐づくアクション一覧を取得
export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("session_actions")
    .select("id, session_id, title, status, reflection, created_at, updated_at")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Fetch actions error:", error);
    return NextResponse.json({ error: "アクションの取得に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ actions: data || [] });
}

// POST /api/actions
// アクションを新規作成する
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { session_id, title } = body;

  if (!session_id || !title?.trim()) {
    return NextResponse.json({ error: "session_id と title は必須です。" }, { status: 400 });
  }

  // セッションがこのユーザーのものか確認
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません。" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("session_actions")
    .insert({
      session_id,
      user_id: user.id,
      title: title.trim(),
      status: "todo",
    })
    .select("id, session_id, title, status, reflection, created_at, updated_at")
    .single();

  if (error) {
    console.error("Create action error:", error);
    return NextResponse.json({ error: "アクションの作成に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ action: data }, { status: 201 });
}
