import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/memos/[id]
// メモ内容を更新する
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content は必須です。" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("session_memos")
    .update({
      content: content.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id) // RLSの二重確認
    .select("id, content, memo_date, created_at, updated_at")
    .single();

  if (error) {
    console.error("Update memo error:", error);
    return NextResponse.json({ error: "メモの更新に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ memo: data });
}

// DELETE /api/memos/[id]
// メモを削除する
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from("session_memos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // RLSの二重確認

  if (error) {
    console.error("Delete memo error:", error);
    return NextResponse.json({ error: "メモの削除に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
