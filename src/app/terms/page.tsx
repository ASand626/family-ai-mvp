import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col py-12 px-6" style={{ background: "var(--background)" }}>
      <div
        className="w-full max-w-2xl mx-auto rounded-2xl p-8 sm:p-10 shadow-sm border"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >
        {/* Back Link */}
        <Link
          href="/"
          className="text-xs transition-opacity hover:opacity-70 font-semibold inline-flex items-center gap-1 mb-6"
          style={{ color: "var(--accent)" }}
        >
          ← トップに戻る
        </Link>

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight mb-8" style={{ color: "var(--foreground)" }}>
          利用規約
        </h1>

        <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
          <p>
            本利用規約（以下「本規約」といいます。）は、Family Compass（以下「本サービス」といいます。）の利用条件を定めるものです。本サービスをご利用になるすべてのユーザーは、本規約に同意したものとみなされます。
          </p>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              第1条（適用範囲）
            </h2>
            <p>
              本規約は、ユーザーと本サービス運営者（以下「運営」といいます。）との間の本サービスの利用に関わる一切の関係に適用されます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              第2条（サービスの内容と免責）
            </h2>
            <p>
              本サービスは、AI（人工知能）技術を用いて、家庭内の課題整理や思考の整理を支援する対話型システム（伴走システム）です。本サービスは以下の点について保証せず、免責されるものとします。
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>AIの回答の完全性、正確性、真実性、および特定の目的への適合性</li>
              <li>医師、公認心理師、弁護士等の専門家による助言・カウンセリングの代替となること（本サービスは診断や専門的判断を提供するものではありません）</li>
              <li>本サービスを利用したことによって生じたユーザーと第三者（家族メンバーを含む）との間のトラブル</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              第3条（利用料金）
            </h2>
            <p>
              本サービスはMVP（実証実験版）として提供されており、利用料金は無料です。将来的にサービス内容の変更や有料化を行う場合は、事前にユーザーに対して通知します。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              第4条（禁止事項）
            </h2>
            <p>
              ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>他人のメールアドレスを使用するなど、虚偽の情報を登録する行為</li>
              <li>本サービスのサーバーやネットワークに対する過度な負荷をかける行為</li>
              <li>嫌がらせ、脅迫、公序良俗に反するテキストをAIに入力する行為</li>
              <li>その他、運営が不適切と判断する行為</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              第5条（データの利用と制限）
            </h2>
            <p>
              本サービスで入力された情報は、プライバシーポリシーに従って適切に管理されます。また、AI処理のために外部のAPI（送信されたデータを学習しないポリシーのもの）にデータを送信することに同意するものとします。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              第6条（利用規約の変更）
            </h2>
            <p>
              運営は、必要と判断した場合には、ユーザーに事前通知することなくいつでも本規約を変更することができるものとします。変更後の規約は本サービス上に表示された時点から効力を生じます。
            </p>
          </section>
        </div>

        <p className="mt-8 text-xs text-right" style={{ color: "var(--muted)" }}>
          制定日：2025年6月3日
        </p>
      </div>
    </div>
  );
}
