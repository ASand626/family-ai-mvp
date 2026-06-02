import Link from "next/link";

export default function PrivacyPage() {
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
          プライバシーポリシー
        </h1>

        <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
          <p>
            Family Compass（以下「本サービス」といいます。）は、ユーザーの皆様のプライバシーならびに個人情報の重要性を深く認識し、その保護のために細心の注意を払っております。本サービスにおける個人情報の取り扱いについて、以下の通りプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
          </p>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              1. 取得する情報
            </h2>
            <p>
              本サービスでは、以下の情報を取得および利用することがあります。
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>ゲスト利用時のランダムな識別符号（匿名サインイン用UUID）</li>
              <li>登録されたメールアドレス</li>
              <li>登録されたプロフィール情報（家族構成、お子様の生年月、お悩み内容）</li>
              <li>チャット相談時に入力された相談テキストおよび会話データ</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              2. 情報の利用目的
            </h2>
            <p>
              本サービスが取得した情報は、以下の目的のみに利用します。
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>ユーザーの文脈に沿った、適切なAIによる相談・伴走サービスの提供</li>
              <li>ユーザー認証（ログイン）およびデータの引き継ぎ</li>
              <li>本サービスに関するお問い合わせへの回答・トラブル対応</li>
              <li>サービス改善のための利用状況の集計・分析</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              3. セキュリティおよびデータ管理
            </h2>
            <p>
              本サービスは、取得したデータの安全性確保のために以下の措置を講じています。
            </p>
            <ul className="list-disc list-inside pl-2 space-y-1" style={{ color: "var(--muted)" }}>
              <li>**SSL/TLSによる通信の暗号化**: すべてのデータ送受信は強固に暗号化されます。</li>
              <li>**厳格なアクセス制御（RLS）**: データベース上のチャット履歴は、認証されたユーザー本人（または本人のブラウザ）以外からはアクセスできないように制御されています。</li>
              <li>**開発者アクセス制限**: データベース管理画面へのアクセス権限は極限された開発メンバーのみに限定され、多要素認証（2FA）を用いて厳重に管理されています。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              4. 第三者提供およびAIモデルAPIとの連携
            </h2>
            <p>
              本ポリシーで定める場合を除き、原則として取得した情報を第三者に開示・提供することはありません。
            </p>
            <p>
              本サービスは相談の処理に外部のAI API（Anthropic社等）を使用します。APIを通じた通信においては以下のセキュリティが保証されています。
            </p>
            <div className="p-4 rounded-xl border font-semibold my-2" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
              🔒 送信された相談データはAIの「公開学習モデル」のトレーニング・再学習に利用されることは一切ありません。データはプライベートかつ一時的な推論にのみ使用されます。
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              5. ユーザーデータの破棄
            </h2>
            <p>
              ユーザーがアカウントの削除（退会）を希望される場合、紐付くすべてのメールアドレス、プロフィール情報、会話履歴はデータベースから物理的に即時かつ安全に削除されます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold text-base" style={{ color: "var(--accent)" }}>
              6. 本ポリシーの変更
            </h2>
            <p>
              運営は、法令等の変更または本サービスの機能拡張に伴い、本ポリシーを予告なく変更することがあります。変更した場合は、本サービス上に掲載した時点より適用されるものとします。
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
