"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { saveProfile, saveFamilyMembers } from "./actions";
import { calculateAge } from "@/utils/age";

interface Profile {
  family_summary: string;
  concerns: string;
}

interface FamilyMember {
  id?: string;
  role: "parent" | "child";
  relationship?: string;
  nickname: string;
  birthdate: string;
  // Parent
  occupation?: string;
  recent_concern?: string;
  // Child
  school_status?: string;
  interests: string[];
  concerns: string[];
}

interface ProfileFormProps {
  initialProfile: Profile;
  initialMembers: any[];
}

const RELATIONSHIP_OPTIONS = ["本人", "子", "パートナー", "祖父", "祖母", "その他"];
const OCCUPATION_OPTIONS = ["フルタイム", "時短", "パート", "専業主婦/主夫", "育休中", "その他"];

// Returns the pulldown selection for a stored value: preset values map to themselves,
// any free text maps to "その他".
const toSelectValue = (value: string | undefined, options: string[]) => {
  if (!value) return "";
  return options.includes(value) ? value : "その他";
};

const toOtherText = (value: string | undefined, options: string[]) => {
  if (!value || options.includes(value)) return "";
  return value;
};


export default function ProfileForm({ initialProfile, initialMembers }: ProfileFormProps) {
  const [familySummary, setFamilySummary] = useState(initialProfile.family_summary || "");
  const [concerns, setConcerns] = useState(initialProfile.concerns || "");

  // Initialize members state. If no parent is present, provide a default parent.
  const [members, setMessages] = useState<FamilyMember[]>(() => {
    if (initialMembers.length === 0) {
      return [
        {
          role: "parent",
          relationship: "本人",
          nickname: "ママ",
          birthdate: "",
          occupation: "育休中",
          recent_concern: "",
          interests: [],
          concerns: [],
        },
      ];
    }
    return initialMembers.map((m) => ({
      id: m.id,
      role: m.role as "parent" | "child",
      relationship: m.relationship || (m.role === "parent" ? "本人" : "子"),
      nickname: m.nickname || "",
      birthdate: m.birthdate || "",
      occupation: m.occupation || "",
      recent_concern: m.recent_concern || "",
      school_status: m.school_status || "",
      interests: m.interests || [],
      concerns: m.concerns || [],
    }));
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/login");
      router.refresh();
    } catch (err: any) {
      console.error("Logout failed:", err);
      setError("ログアウトに失敗しました。もう一度お試しください。");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Add family member helper
  const addMember = () => {
    const newMember: FamilyMember = {
      role: "child",
      relationship: "子",
      nickname: "",
      birthdate: "",
      interests: [],
      concerns: [],
    };
    setMessages((prev) => [...prev, newMember]);
  };

  // Remove member helper
  const removeMember = (indexToRemove: number) => {
    setMessages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Update specific member fields helper
  const updateMember = (index: number, fields: Partial<FamilyMember>) => {
    setMessages((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, ...fields } as FamilyMember : m))
    );
  };

  // Update relationship and keep the parent/child role in sync with it
  const updateRelationship = (index: number, relationship: string) => {
    updateMember(index, {
      relationship,
      role: relationship === "子" ? "child" : "parent",
    });
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setShowSuccess(false);

    try {
      // 1. Save general profiles (family summary, general concerns)
      const profileFormData = new FormData();
      profileFormData.append("family_summary", familySummary);
      profileFormData.append("concerns", concerns);

      const profileResult = await saveProfile(profileFormData);
      if (profileResult?.error) {
        throw new Error(profileResult.error);
      }

      // 2. Save detailed family members
      const membersResult = await saveFamilyMembers(members);
      if (membersResult?.error) {
        throw new Error(membersResult.error);
      }

      setShowSuccess(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => {
        setShowSuccess(false);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "プロフィールの保存中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-12" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="px-6 py-5 flex items-center justify-between border-b shrink-0 shadow-sm"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <Link href="/" className="text-lg font-semibold tracking-tight hover:opacity-85 transition-opacity" style={{ color: "var(--accent)" }}>
          Family Compass
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-medium transition-colors border hover:opacity-90"
            style={{
              color: "var(--muted)",
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          >
            ホームに戻る
          </Link>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="text-xs px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg font-medium transition-colors border hover:opacity-90 cursor-pointer"
            style={{
              color: "var(--muted)",
              borderColor: "var(--border)",
              background: "var(--card)",
            }}
          >
            {isSigningOut ? "処理中..." : "ログアウト"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-10">
        <div className="space-y-8">
          {/* Title */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
              家庭プロフィールの編集
            </h1>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
              ご家族の情報やお悩みを詳しく登録することで、AI伴走パートナー（Claude）が
              あなたの家庭の状況をしっかりと理解し、毎回ゼロから説明させることなく、
              個別の事情に合わせた温かい伴走アドバイスを行えるようになります。
            </p>
          </div>

          {/* Messages */}
          {showSuccess && (
            <div
              className="p-4 rounded-xl text-sm border flex items-center justify-between animate-fade-in shadow-sm"
              style={{
                background: "var(--accent-light)",
                borderColor: "var(--border)",
                color: "var(--accent)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold">プロフィールと家族情報を保存しました！</span>
              </div>
              <button onClick={() => setShowSuccess(false)} className="text-xs font-bold px-1 opacity-70 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {error && (
            <div
              className="p-4 rounded-xl text-xs border flex items-start gap-2.5"
              style={{
                background: "#FFF0F1",
                borderColor: "#FAD4D6",
                color: "#E15256",
              }}
            >
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="leading-relaxed font-semibold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Family Summary & Concerns */}
            <div
              className="rounded-2xl p-6 border space-y-6 shadow-sm"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <h2 className="text-sm font-bold border-b pb-2 flex items-center gap-1.5" style={{ color: "var(--accent)", borderColor: "var(--border)" }}>
                <span>🏠</span> 家族全体の状況
              </h2>

              {/* Family Summary */}
              <div className="space-y-1.5">
                <label htmlFor="family_summary" className="block text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  家族構成（自由記入）
                </label>
                <textarea
                  id="family_summary"
                  rows={2}
                  value={familySummary}
                  onChange={(e) => setFamilySummary(e.target.value)}
                  disabled={isLoading}
                  placeholder="例：夫婦と4歳の長男、現在第2子育休中のママの3人暮らしです。"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 resize-none leading-relaxed"
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

              {/* Concerns */}
              <div className="space-y-1.5">
                <label htmlFor="concerns" className="block text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                  家族の最近の困りごと
                </label>
                <textarea
                  id="concerns"
                  rows={2}
                  value={concerns}
                  onChange={(e) => setConcerns(e.target.value)}
                  disabled={isLoading}
                  placeholder="例：平日はワンオペ気味で家事育児の負担が偏り、お互いにすれ違いを感じてイライラしてしまいます。"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200 resize-none leading-relaxed"
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
            </div>

            {/* Section 2: Family Members (Parents / Children) */}
            <div className="space-y-6">
              <h2 className="text-base font-bold tracking-tight px-1" style={{ color: "var(--foreground)" }}>
                👨‍👩‍👧‍👦 家族メンバーの詳細
              </h2>

              {members.map((member, index) => {
                const age = calculateAge(member.birthdate);
                const relationshipSelect = toSelectValue(member.relationship, RELATIONSHIP_OPTIONS);
                const isSelf = member.relationship === "本人";

                return (
                  <div
                    key={index}
                    className="rounded-2xl p-6 border space-y-5 shadow-sm transition-all duration-300 relative"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  >
                    {/* Remove button (not shown on the self card) */}
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => removeMember(index)}
                        className="absolute top-4 right-4 text-xs px-2.5 py-1 rounded-md transition-colors border hover:bg-red-50"
                        style={{
                          color: "var(--muted)",
                          borderColor: "var(--border)",
                          background: "var(--card)",
                        }}
                      >
                        ✕ カードを削除
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-lg">{member.role === "parent" ? "👩‍🦰" : "👶"}</span>
                      <h3 className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                        {isSelf ? "ご自身の情報" : `${member.nickname || `家族メンバー ${index}`}`}
                      </h3>
                    </div>

                    {/* Relationship */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          続柄
                        </label>
                        <select
                          required
                          value={relationshipSelect}
                          onChange={(e) => updateRelationship(index, e.target.value)}
                          disabled={isLoading}
                          className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border cursor-pointer"
                          style={{
                            background: "var(--background)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                          }}
                        >
                          <option value="" disabled>
                            選択してください
                          </option>
                          {RELATIONSHIP_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {relationshipSelect === "その他" && (
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            続柄（自由記入）
                          </label>
                          <input
                            type="text"
                            value={toOtherText(member.relationship, RELATIONSHIP_OPTIONS)}
                            onChange={(e) => updateRelationship(index, e.target.value || "その他")}
                            disabled={isLoading}
                            placeholder="例：叔父, いとこ など"
                            className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border"
                            style={{
                              background: "var(--background)",
                              borderColor: "var(--border)",
                              color: "var(--foreground)",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Nickname */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                          名前 (ニックネーム)
                        </label>
                        <input
                          type="text"
                          required
                          value={member.nickname}
                          onChange={(e) => updateMember(index, { nickname: e.target.value })}
                          disabled={isLoading}
                          placeholder={member.role === "parent" ? "ママ, パパ など" : "はると, 長男 など"}
                          className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border"
                          style={{
                            background: "var(--background)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>

                      {/* Birthdate */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            生年月日
                          </label>
                          {age && (
                            <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>
                              {age}
                            </span>
                          )}
                        </div>
                        <input
                          type="date"
                          value={member.birthdate}
                          onChange={(e) => updateMember(index, { birthdate: e.target.value })}
                          disabled={isLoading}
                          className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border text-gray-600"
                          style={{
                            background: "var(--background)",
                            borderColor: "var(--border)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Role-specific fields */}
                    {member.role === "parent" ? (
                      /* Parent Specific UI */
                      <div className="space-y-4 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                        {/* Occupation pulldown */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                              勤務状況
                            </label>
                            <select
                              value={toSelectValue(member.occupation, OCCUPATION_OPTIONS)}
                              onChange={(e) => updateMember(index, { occupation: e.target.value })}
                              disabled={isLoading}
                              className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border cursor-pointer"
                              style={{
                                background: "var(--background)",
                                borderColor: "var(--border)",
                                color: "var(--foreground)",
                              }}
                            >
                              <option value="" disabled>
                                選択してください
                              </option>
                              {OCCUPATION_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>

                          {toSelectValue(member.occupation, OCCUPATION_OPTIONS) === "その他" && (
                            <div className="space-y-1">
                              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                勤務状況（自由記入）
                              </label>
                              <input
                                type="text"
                                value={toOtherText(member.occupation, OCCUPATION_OPTIONS)}
                                onChange={(e) =>
                                  updateMember(index, { occupation: e.target.value || "その他" })
                                }
                                disabled={isLoading}
                                placeholder="例：自営業, フリーランス など"
                                className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border"
                                style={{
                                  background: "var(--background)",
                                  borderColor: "var(--border)",
                                  color: "var(--foreground)",
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Parent specific concern */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            最近の困りごと
                          </label>
                          <input
                            type="text"
                            value={member.recent_concern || ""}
                            onChange={(e) => updateMember(index, { recent_concern: e.target.value })}
                            disabled={isLoading}
                            placeholder="例：夜泣きが続いて睡眠が足りず、疲れ気味です。"
                            className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border"
                            style={{
                              background: "var(--background)",
                              borderColor: "var(--border)",
                              color: "var(--foreground)",
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Child Specific UI */
                      <div className="space-y-4 pt-1 border-t" style={{ borderColor: "var(--border)" }}>
                        {/* Child Interests Free Input */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            好きなこと・興味 (自由入力)
                          </label>
                          <input
                            type="text"
                            value={member.interests.join(", ")}
                            onChange={(e) => {
                              const val = e.target.value;
                              const interestsArr = val.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                              updateMember(index, { interests: interestsArr });
                            }}
                            disabled={isLoading}
                            placeholder="例：電車やお絵描き、歌やダンスなど"
                            className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border"
                            style={{
                              background: "var(--background)",
                              borderColor: "var(--border)",
                              color: "var(--foreground)",
                            }}
                          />
                        </div>

                        {/* Child Concerns Free Input */}
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                            気になること・悩み (自由入力)
                          </label>
                          <input
                            type="text"
                            value={member.concerns.join(", ")}
                            onChange={(e) => {
                              const val = e.target.value;
                              const concernsArr = val.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                              updateMember(index, { concerns: concernsArr });
                            }}
                            disabled={isLoading}
                            placeholder="例：偏食やかんしゃく、お友達関係など"
                            className="w-full px-3.5 py-2 rounded-xl text-sm outline-none border"
                            style={{
                              background: "var(--background)",
                              borderColor: "var(--border)",
                              color: "var(--foreground)",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Dynamic Member Adder Button */}
              <button
                type="button"
                onClick={addMember}
                disabled={isLoading}
                className="w-full py-4 rounded-2xl text-sm border-2 border-dashed transition-all duration-300 flex items-center justify-center gap-2 hover:bg-[var(--accent-light)] cursor-pointer font-semibold"
                style={{
                  color: "var(--accent)",
                  borderColor: "var(--border)",
                  background: "var(--card)",
                }}
              >
                <span>➕</span> 家族メンバーのカードを追加する
              </button>
            </div>

            {/* Final Save Button */}
            <div className="pt-4 shrink-0">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl text-sm font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-md cursor-pointer"
                style={{
                  background: "var(--accent)",
                  opacity: isLoading ? 0.75 : 1,
                }}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>保存しています...</span>
                  </>
                ) : (
                  "この構成で家族プロフィールを保存する"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

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
