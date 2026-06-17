import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/chat/sessions/[id]
// セッションのモードやタイトルを更新する
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, mode } = body;

    const updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateFields.title = title.trim();
    if (mode !== undefined) updateFields.mode = mode;

    const { data, error } = await supabase
      .from("chat_sessions")
      .update(updateFields)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, title, mode, created_at, updated_at")
      .single();

    if (error) {
      console.error("Update chat session error:", error);
      return NextResponse.json({ error: "セッションの更新に失敗しました。" }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch (error: any) {
    console.error("API Chat Session PATCH Route error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
