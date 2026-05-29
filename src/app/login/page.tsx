"use client";

import Link from "next/link";
import { useState } from "react";
import { signInWithOtp } from "./actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("email", email);

      const result = await signInWithOtp(formData);

      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setIsSent(true);
      }
    } catch (err) {
      console.error(err);
      setError("接続エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 transition-colors duration-500"
      style={{ background: "var(--background)" }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-sm border transition-all duration-300 hover:shadow-md"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <span
              className="text-xl font-semibold tracking-tight"
              style={{ color: "var(--accent)" }}
            >
              家族AI
            </span>
          </Link>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            ログインして相談を始める
          </p>
        </div>

        {isSent ? (
          /* Success State UI */
          <div className="space-y-6 text-center animate-fade-in">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-transform scale-100 hover:scale-105 duration-300"
              style={{ background: "var(--accent-light)" }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: "var(--accent)" }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-base" style={{ color: "var(--foreground)" }}>
                ログインメールを送信しました
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                入力されたメールアドレス宛に、ログイン用のリンク（Magic Link）をお送りしました。
                メール内のボタンをクリックしてログインを完了してください。
              </p>
            </div>
            <div
              className="p-3.5 rounded-lg text-xs"
              style={{ background: "var(--background)", color: "var(--muted)" }}
            >
              送信先：<span className="font-medium" style={{ color: "var(--foreground)" }}>{email}</span>
            </div>
            <button
              onClick={() => setIsSent(false)}
              className="text-xs font-medium transition-opacity hover:opacity-70 mt-2 block w-full text-center"
              style={{ color: "var(--accent)" }}
            >
              メールアドレスを入力し直す
            </button>
          </div>
        ) : (
          /* Form State UI */
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div
                className="p-4 rounded-xl text-xs border flex items-start gap-2.5"
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
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-semibold tracking-wider uppercase"
                style={{ color: "var(--muted)" }}
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
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

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 mt-4 hover:shadow-sm"
              style={{
                background: "var(--accent)",
                opacity: isLoading || !email ? 0.6 : 1,
                cursor: isLoading || !email ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>送信中...</span>
                </>
              ) : (
                "ログイン用メールを送信"
              )}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            補足
          </span>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        {/* Info Text */}
        <p className="text-center text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          パスワードは不要です。登録されたメールアドレス宛に届くリンクから、安全にワンクリックでログイン・新規登録が完了します。
        </p>
      </div>

      {/* Back link */}
      <Link
        href="/"
        className="mt-6 text-xs transition-opacity hover:opacity-70 font-medium"
        style={{ color: "var(--muted)" }}
      >
        ← トップに戻る
      </Link>
    </div>
  );
}
