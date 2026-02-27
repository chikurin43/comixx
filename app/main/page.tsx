import Link from "next/link";

const palettes = [
  { id: "gakuen-sf", title: "学園SFミステリー", stats: "参加者 12名 / 最新投票: 主人公の正体" },
  { id: "kansai-hero", title: "関西弁ヒーロー日常譚", stats: "参加者 8名 / 最新投票: 新キャラ登場回" },
  { id: "deepsea", title: "深海コロニー冒険記", stats: "参加者 20名 / 最新投票: 第3話ラストの展開" },
];

export default function MainPage() {
  return (
    <main className="split">
      <section className="panel">
        <h1>パレットを作成</h1>
        <form>
          <label>パレット名<input type="text" placeholder="例：学園SF編" /></label>
          <label>ジャンル<select><option>バトル</option><option>ラブコメ</option><option>SF</option><option>ホラー</option></select></label>
          <label>説明<textarea placeholder="このパレットで作りたい作品の方向性" /></label>
          <button className="button" type="button">作成する</button>
        </form>
      </section>
      <section className="panel">
        <h2>公開中のパレット一覧</h2>
        <div className="list">
          {palettes.map((palette) => (
            <article className="card" key={palette.id}>
              <h3>{palette.title}</h3>
              <p className="small">{palette.stats}</p>
              <Link className="button secondary" href={`/palette/${palette.id}`}>参加する</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
