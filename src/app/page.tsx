import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signOut, signInAnonymouslyAction } from "./login/actions";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAnonymous = user?.is_anonymous ?? false;
  const userDisplayName = isAnonymous ? "ゲストユーザー" : user?.email || "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="px-6 py-5 flex items-center justify-between border-b"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <Link href="/" className="text-lg font-semibold tracking-tight hover:opacity-85 transition-opacity" style={{ color: "var(--accent)" }}>
          Family Compass
        </Link>

        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-xs hidden sm:inline" style={{ color: "var(--muted)" }}>
              {userDisplayName}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="text-xs px-3.5 py-2 rounded-lg font-medium transition-colors cursor-pointer border hover:opacity-90"
                style={{
                  color: "var(--muted)",
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
              >
                ログアウト
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-lg font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--accent)", border: "1px solid var(--accent)" }}
          >
            ログイン
          </Link>
        )}
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-widest uppercase" style={{ color: "var(--accent)" }}>
              Family Compass
            </p>
            <h1
              className="text-4xl font-semibold leading-snug tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              家族のことを、<br />
              ゆっくり整理しよう。
            </h1>
          </div>

          {user ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                おかえりなさい、{userDisplayName} さん。
              </p>
              <p className="text-base leading-relaxed" style={{ color: "var(--muted)" }}>
                {isAnonymous
                  ? "現在ゲストモードで利用中です。新しい相談を始めたり、これまでの記録を振り返ることができます。"
                  : "前回お話しした内容を元に、新しい相談を始めたり、これまでの記録を振り返ることができます。"}
              </p>
            </div>
          ) : (
            <p className="text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              子育て、夫婦関係、日々の疲れ。<br />
              頭の中でこんがらがっていることを、<br />
              AIと一緒に少しずつ整理していきます。
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {user ? (
              <>
                <Link
                  href="/chat"
                  className="w-full sm:w-auto px-8 py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ background: "var(--accent)" }}
                >
                  相談ダッシュボードへ
                </Link>
                <Link
                  href="/profile"
                  className="w-full sm:w-auto px-8 py-3 rounded-lg text-sm font-medium transition-colors border hover:opacity-95"
                  style={{
                    color: "var(--accent)",
                    borderColor: "var(--accent)",
                    background: "var(--card)",
                  }}
                >
                  プロフィールを編集する
                </Link>
              </>
            ) : (
              <>
                <form action={signInAnonymouslyAction} className="w-full sm:w-auto">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                    style={{ background: "var(--accent)" }}
                  >
                    はじめる（登録不要）
                  </button>
                </form>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3 rounded-lg text-sm font-medium transition-colors hover:underline text-center"
                  style={{ color: "var(--muted)" }}
                >
                  ログインして続ける
                </Link>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="px-6 py-16 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <FeatureCard
              icon="🤝"
              title="安心して話せる"
              description="正解を押しつけず、あなたの家庭の事情に寄り添いながら会話します。"
            />
            <FeatureCard
              icon="🧩"
              title="頭が整理される"
              description="漠然とした悩みが、少しずつ形になっていく感覚を体験できます。"
            />
            <FeatureCard
              icon="📝"
              title="記憶が続く"
              description="話したことを覚えておくので、毎回ゼロから説明する必要がありません。"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="px-6 py-6 text-center text-xs border-t"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        © 2025 Family Compass
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center space-y-3">
      <div className="text-2xl">{icon}</div>
      <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        {description}
      </p>
    </div>
  );
}
