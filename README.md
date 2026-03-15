# ComixX

ComixX は、複数ユーザーで漫画の展開を議論・投票し、作画担当が作品化するサービスのプロトタイプです。

## Tech Stack

- Next.js (App Router)
- Supabase (Auth / DB / Realtime)
- Cloudflare deploy: OpenNext (`@opennextjs/cloudflare`) + Wrangler
- Unit tests: Vitest
- E2E tests: Playwright

## Local Setup

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

## Scripts

- `npm run dev`: Next.js dev server
- `npm run build`: Next.js production build (TypeScript/ESLint check含む)
- `npm run preview`: Cloudflare Workers相当でローカルプレビュー（OpenNext build + Wrangler preview）
- `npm run deploy`: Cloudflareへデプロイ（OpenNext build + Wrangler deploy）

補助:

- `npm run cf-typegen`: `wrangler.jsonc`から型定義を生成（`cloudflare-env.d.ts`）

## Env Vars

基本は `.env.local` に設定します（Next.js dev/buildで利用）。

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# R2 (S3 compatible API)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=your-r2-bucket

# 任意: 開発診断用 read table（デフォルト: profiles）
NEXT_PUBLIC_SUPABASE_PROBE_TABLE=profiles

# 任意（E2E用）
COMIXX_E2E_EMAIL=info@example.com
COMIXX_E2E_PASSWORD=00000000
```

Cloudflare側（Wrangler preview/deploy）でも同じ環境変数が必要です。
ローカルでは `.dev.vars` を使います。`.dev.vars.example` を参照してください。

## Supabase Schema

`supabase/schema.sql` を Supabase SQL Editor で実行してください。

対象テーブル:

- `palettes`
- `messages`
- `votes`

RLS ポリシーは以下の最小ルールです。

- 公開パレットは参照可能
- 本人データのみ作成/更新可能
- Realtime は `messages` と `votes` を publish

## Cloudflare Migration (Vercel -> Cloudflare)

このリポジトリは、Vercel専用アダプタではなく OpenNext を使って Cloudflare Workers へデプロイします。
Next.js のSSR/API Routesを維持する場合、Pagesの静的ホスティングだけでは完結しないため、Workersデプロイを採用しています。

主要ファイル:

- `wrangler.jsonc`: Workers設定（entryは `.open-next/worker.js`、静的アセットは `.open-next/assets`）
- `open-next.config.ts`: OpenNext設定（キャッシュは必要に応じて有効化）
- `public/_headers`: 静的アセットキャッシュ用ヘッダ

### Cloudflare側でやること

1. Cloudflareにログイン

- ローカル: `wrangler login`
- CI: `CLOUDFLARE_API_TOKEN` を用意（Workers Scripts編集権限が必要）

2. Worker名の決定

- `wrangler.jsonc` の `name` は Cloudflare上で一意である必要があります（必要なら変更してください）

3. 環境変数の設定

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

推奨: 秘密値は `wrangler secret put` で登録

4. デプロイ

```bash
npm run deploy
```

### 注意 (Windows)

OpenNextはWindowsで不安定になることがあります（`opennextjs-cloudflare build` が `spawn EPERM` で失敗する場合があります）。
安定させるには WSL（またはLinuxのCI）で `npm run preview` / `npm run deploy` を実行する運用を推奨します。

## Routing Notes (Next.js 15)

Next.js 15 では dynamic route の `params` が Promise として扱われるため、`page.tsx` はサーバー側の薄いラッパーにし、UI本体は `page.client.tsx` に置いています。
UI変更は基本的に `page.client.tsx` 側を編集してください。

## Screens

- `/` 初期ページ
- `/login` ログイン/新規登録（Supabase Auth）
- `/main` パレット作成・一覧
- `/palette/[paletteId]` チャット + 投票（Realtime同期）
- `/mypage` 自分のパレット・活動履歴
