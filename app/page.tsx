import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <h1>みんなで漫画を育てる、共創プラットフォーム</h1>
        <p>
          ComixX は、複数ユーザーがチャット形式で展開を議論し、投票で方向性を決め、クリエイターが漫画として形にしていくサービスです。
        </p>
        <p className="small">Supabase連携前の簡易実装として、主要画面をNext.jsで構成しています。</p>
        <Link className="button" href="/login">
          ログインしてはじめる
        </Link>
      </section>
    </main>
  );
}
