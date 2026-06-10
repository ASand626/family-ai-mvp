import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET /api/memos?session_id=xxx
// セッションに紐づくメモ一覧を日付降順で返す
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
    .from("session_memos")
    .select("id, content, memo_date, created_at, updated_at")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("memo_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch memos error:", error);
    return NextResponse.json({ error: "メモの取得に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ memos: data || [] });
}

// POST /api/memos
// メモを新規作成する
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { session_id, content, memo_date } = body;

  if (!session_id || !content?.trim()) {
    return NextResponse.json({ error: "session_id と content は必須です。" }, { status: 400 });
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

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const { data, error } = await supabase
    .from("session_memos")
    .insert({
      session_id,
      user_id: user.id,
      content: content.trim(),
      memo_date: memo_date || today,
    })
    .select("id, content, memo_date, created_at, updated_at")
    .single();

  if (error) {
    console.error("Create memo error:", error);
    return NextResponse.json({ error: "メモの作成に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ memo: data }, { status: 201 });
}
