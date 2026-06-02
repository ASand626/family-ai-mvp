'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DailyMessageCardProps {
  isAnonymous: boolean
}

const GUEST_MESSAGES = [
  "今日もお疲れ様です。がんばりすぎず、ご自身のペースでゆっくり進んでいきましょう。",
  "完璧でなくても大丈夫。今日できることを、できる分だけ進めていきましょう。",
  "少し肩の力を抜いて、温かい飲み物でも飲みながら、ほっと一息ついてくださいね。",
  "日々の小さな積み重ねが、家族の温かい毎日に繋がっています。いつもお疲れ様です。",
  "自分のための時間も大切に。今日はどんな小さな「心地よい瞬間」を見つけられますか？",
  "誰かのために動くあなたを応援しています。まずは自分自身をたくさん労わってくださいね。",
  "今日起こる良いことも、そうでないことも、すべてはあなたの歩みの一部です。のんびりいきましょう。",
  "時には立ち止まり、深呼吸を。今日という日が、あなたにとって優しい一日になりますように。",
  "日々の努力は目に見えなくても、確実に届いています。今日もお疲れ様でした。",
  "心が少し疲れたときは、休むことが最善の一歩です。ゆっくり休んでくださいね。",
  "今日もお疲れ様です。まずは深呼吸をして、少しだけ肩の力を抜いてみませんか。",
  "周りと比べず、あなたのペースで大丈夫。今日できることをゆっくり進めていきましょう。"
]

export default function DailyMessageCard({ isAnonymous }: DailyMessageCardProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (isAnonymous) {
      const options = { timeZone: 'Asia/Tokyo', day: 'numeric' } as const
      const dayStr = new Intl.DateTimeFormat('ja-JP', options).format(new Date())
      const dayInt = parseInt(dayStr, 10) || 1
      const msg = GUEST_MESSAGES[dayInt % GUEST_MESSAGES.length]
      setMessage(msg)
      setLoading(false)
      return
    }

    async function fetchMessage() {
      try {
        const res = await fetch('/api/daily-message')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (data.isGuest) {
          setMessage(null)
        } else {
          setMessage(data.message || null)
        }
      } catch (err) {
        console.error('Error fetching daily message:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchMessage()
  }, [isAnonymous])

  // 1. Loading State (Skeleton Shimmer)
  if (loading) {
    return (
      <div 
        className="w-full max-w-xl mx-auto p-6 rounded-2xl border animate-pulse"
        style={{
          background: 'rgba(255, 251, 252, 0.65)',
          borderColor: 'var(--border)',
          boxShadow: '0 8px 32px 0 rgba(194, 119, 138, 0.04)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded-full bg-pink-200/50" />
          <div className="h-4 w-32 bg-pink-100/60 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-stone-100 rounded" />
          <div className="h-4 w-5/6 bg-stone-100 rounded" />
        </div>
      </div>
    )
  }

  // 2. Error State (Fallback message)
  if (error || !message) {
    return (
      <div 
        className="w-full max-w-xl mx-auto p-6 rounded-2xl border"
        style={{
          background: 'rgba(255, 251, 252, 0.65)',
          borderColor: 'var(--border)',
          boxShadow: '0 8px 32px 0 rgba(194, 119, 138, 0.04)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base" style={{ color: 'var(--accent)' }}>✨</span>
          <h3 className="text-xs font-semibold tracking-wider" style={{ color: 'var(--accent)' }}>
            きょうのメッセージ
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-left font-medium" style={{ color: 'var(--foreground)' }}>
          今日もお疲れ様です。がんばりすぎず、ご自身のペースでゆっくり進んでいきましょう。
        </p>
      </div>
    )
  }

  // 3. Success State (Encouraging Daily Message)
  return (
    <div 
      className="w-full max-w-xl mx-auto p-7 rounded-2xl border transition-all duration-500 hover:-translate-y-0.5 hover:shadow-md text-left relative overflow-hidden"
      style={{
        background: 'rgba(255, 251, 252, 0.70)',
        borderColor: 'rgba(240, 217, 220, 0.8)',
        boxShadow: '0 10px 35px 0 rgba(194, 119, 138, 0.06)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Background soft decorative glow */}
      <div 
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full filter blur-2xl opacity-15 pointer-events-none"
        style={{
          background: 'var(--accent)',
        }}
      />
      
      <div className="flex items-center gap-2 mb-3.5 relative z-10">
        <span className="text-base animate-pulse" style={{ color: 'var(--accent)' }}>✨</span>
        <h3 className="text-xs font-semibold tracking-wider" style={{ color: 'var(--accent)' }}>
          きょうのメッセージ
        </h3>
      </div>
      
      <p 
        className="text-[14px] sm:text-[15px] leading-relaxed relative z-10 font-medium whitespace-pre-wrap" 
        style={{ color: 'var(--foreground)' }}
      >
        {message}
      </p>
      
      <div className="mt-4 pt-3 border-t flex justify-between items-center relative z-10" style={{ borderColor: 'rgba(240, 217, 220, 0.3)' }}>
        {isAnonymous ? (
          <Link href="/login" className="text-[10px] hover:underline" style={{ color: 'var(--accent)' }}>
            アカウント登録するとあなたに寄り添ったメッセージに変わります
          </Link>
        ) : (
          <span />
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
          Family Compass
        </span>
      </div>
    </div>
  )
}
