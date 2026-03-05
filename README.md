# ComixX (Next.js Beta MVP)

ComixX は、複数ユーザーで漫画の展開を議論・投票し、作画担当が作品化するサービスのプロトタイプです。

## セットアップ

```bash
npm install
npm run dev
```

品質チェック:

```bash
npm run lint
npm run test
npm run build
```

## 環境変数

`.env.local` に以下を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# 開発時のみ有効: Figmaキャプチャスクリプトを挿入
NEXT_PUBLIC_ENABLE_FIGMA_CAPTURE=false
# 任意: 開発診断用 read table（デフォルト: profiles）
NEXT_PUBLIC_SUPABASE_PROBE_TABLE=profiles
```

## Supabase スキーマ適用

`supabase/schema.sql` を SQL Editor で実行してください。

対象テーブル:

- `palettes`
- `messages`
- `votes`

RLS ポリシーは以下の最小ルールです。

- 公開パレットは参照可能
- 本人データのみ作成/更新可能
- Realtime は `messages` と `votes` を publish

## API 契約

すべて `success + error` の共通レスポンスを返します。

- `GET /api/palettes` パレット一覧
- `POST /api/palettes` パレット作成（認証必須）
- `GET /api/messages?paletteId=...` メッセージ一覧
- `POST /api/messages` メッセージ投稿（認証必須）
- `GET /api/votes?paletteId=...&topic=...` 投票一覧
- `POST /api/votes` 投票送信（認証必須、同一トピックは上書き）

## 画面

- `/` 初期ページ
- `/login` ログイン/新規登録（Supabase Auth 連携）
- `/main` パレット作成・一覧
- `/palette/[paletteId]` チャット + 投票（Realtime同期）
- `/mypage` 自分のパレット・活動履歴

## テスト

- Unit: `test/unit/*.test.ts`（バリデーション、投票ルール）
- E2E: `test/e2e/*.spec.ts`（画面導線、未認証ガード）
- CI: `.github/workflows/ci.yml` で `lint + unit + build + e2e`
