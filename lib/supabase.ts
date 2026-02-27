// Supabase接続用のプレースホルダー。
// 次フェーズで @supabase/supabase-js を導入して実装する。
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
