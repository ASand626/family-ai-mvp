import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/actions/[id]
// アクションのステータス、振り返り、内容を更新する
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
  const { title, status, reflection } = body;

  const updateFields: any = {
    updated_at: new Date().toISOString(),
  };

  if (title !== undefined) updateFields.title = title.trim();
  if (status !== undefined) updateFields.status = status;
  // reflection can be null, so check undefined
  if (reflection !== undefined) updateFields.reflection = reflection;

  const { data, error } = await supabase
    .from("session_actions")
    .update(updateFields)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, session_id, title, status, reflection, created_at, updated_at")
    .single();

  if (error) {
    console.error("Update action error:", error);
    return NextResponse.json({ error: "アクションの更新に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ action: data });
}

// DELETE /api/actions/[id]
// アクションを削除する
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
    .from("session_actions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Delete action error:", error);
    return NextResponse.json({ error: "アクションの削除に失敗しました。" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
