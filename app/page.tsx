import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Collaborative Manga Studio</p>
        <h1>みんなで漫画を育てる、共創プラットフォーム</h1>
        <p>
          ComixX は、複数ユーザーがチャット形式で展開を議論し、投票で方向性を決め、クリエイターが漫画として形にしていくサービスです。
        </p>
        <p className="small">MVPでは導線とSupabase疎通確認を優先し、認証本実装は後続フェーズで行います。</p>
        <Link className="button" href="/login">
          ログインしてはじめる
        </Link>
      </section>
    </main>
  );
}
