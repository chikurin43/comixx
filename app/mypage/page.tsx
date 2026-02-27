import Link from "next/link";

const joined = [
  { id: "gakuen-sf", name: "学園SFミステリー", role: "ストーリー議論 + 投票" },
  { id: "deepsea", name: "深海コロニー冒険記", role: "漫画作画担当" },
];

export default function MyPage() {
  return (
    <main className="split">
      <section className="panel">
        <h1>参加中のパレット</h1>
        <div className="list">
          {joined.map((item) => (
            <article className="card" key={item.id}>
              <h3>{item.name}</h3>
              <p className="small">あなたの役割：{item.role}</p>
              <Link className="button secondary" href={`/palette/${item.id}`}>開く</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>アカウント管理</h2>
        <form>
          <label>表示名<input type="text" defaultValue="comixx_user01" /></label>
          <label>プロフィール<textarea placeholder="得意ジャンルや自己紹介" /></label>
          <label>メール通知設定<select><option>すべて受け取る</option><option>投票開始のみ受け取る</option><option>受け取らない</option></select></label>
          <button className="button" type="button">保存する</button>
        </form>
      </section>
    </main>
  );
}
