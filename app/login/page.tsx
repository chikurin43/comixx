export default function LoginPage() {
  return (
    <main className="split">
      <section className="panel">
        <h1>ログイン</h1>
        <form>
          <label>メールアドレス<input type="email" placeholder="you@example.com" /></label>
          <label>パスワード<input type="password" placeholder="••••••••" /></label>
          <button className="button" type="button">ログイン</button>
        </form>
      </section>

      <section className="panel">
        <h2>アカウント作成</h2>
        <form>
          <label>ユーザー名<input type="text" placeholder="ComixXユーザー" /></label>
          <label>メールアドレス<input type="email" placeholder="new@example.com" /></label>
          <label>パスワード<input type="password" placeholder="8文字以上" /></label>
          <button className="button secondary" type="button">新規登録</button>
        </form>
      </section>
    </main>
  );
}
