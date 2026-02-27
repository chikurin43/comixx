"use client";

import { useState } from "react";

type Tab = "chat" | "post" | "view";

const tabLabels: Record<Tab, string> = {
  chat: "チャット",
  post: "漫画投稿",
  view: "閲覧",
};

export default function PalettePage({ params }: { params: { paletteId: string } }) {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <main>
      <section className="panel">
        <h1>パレット：{params.paletteId}</h1>
        <p className="small">チャットで議論 → 投票 → 漫画投稿 の流れをこの画面で完結できます。</p>

        <div className="nav-links" style={{ marginBottom: "1rem" }}>
          {(Object.keys(tabLabels) as Tab[]).map((key) => (
            <button
              key={key}
              className={`button ${tab === key ? "" : "secondary"}`}
              onClick={() => setTab(key)}
              type="button"
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>

        {tab === "chat" && (
          <div className="card">
            <h2>チャット欄</h2>
            <p className="small">[仮UI] Supabase Realtime を想定したメッセージ表示領域</p>
            <div className="list">
              <p>🗨️ A: 次回は転校生を出したい！</p>
              <p>🗨️ B: 伏線回収を先にしたいので投票しましょう。</p>
            </div>
            <form><textarea placeholder="メッセージを入力" /><button type="button" className="button">送信</button></form>
          </div>
        )}

        {tab === "post" && (
          <div className="card">
            <h2>漫画投稿ページ</h2>
            <form>
              <label>話数タイトル<input type="text" placeholder="第4話：謎の転校生" /></label>
              <label>画像ファイル<input type="file" /></label>
              <label>補足メモ<textarea placeholder="あらすじや見どころ" /></label>
              <button type="button" className="button">投稿する</button>
            </form>
          </div>
        )}

        {tab === "view" && (
          <div className="card">
            <h2>漫画閲覧ページ</h2>
            <p>最新投稿：第3話「地下書庫の鍵」</p>
            <p className="small">[仮UI] 画像ビューアやページ送りは後続実装</p>
            <div style={{ height: 200, border: "1px dashed var(--border)", borderRadius: 10, display: "grid", placeItems: "center", color: "var(--muted)" }}>
              漫画プレビューエリア
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
