"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { SupabaseProbeCard } from "@/components/SupabaseProbeCard";
import { apiFetch } from "@/lib/api/client";
import type { ApiPaletteList, Palette } from "@/lib/types";

const defaultPalettes: Palette[] = [];

export default function MainPage() {
  const [palettes, setPalettes] = useState<Palette[]>(defaultPalettes);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPalettes = async () => {
    setLoading(true);
    const response = await apiFetch<ApiPaletteList>("/api/palettes", "GET");

    if (!response.success) {
      setErrorText(response.error.message);
      setLoading(false);
      return;
    }

    setPalettes(response.data.palettes);
    setErrorText("");
    setLoading(false);
  };

  useEffect(() => {
    void loadPalettes();
  }, []);

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <h2>公開中のパレット一覧</h2>
            <Link className="button" href="/palette/new">
              パレット作成
            </Link>
          </div>
          <details>
            <summary>Supabase診断（開発用）</summary>
            <SupabaseProbeCard />
          </details>
          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {loading ? <p className="small">読み込み中...</p> : null}
          <div className="list">
            {palettes.map((palette) => (
              <article className="card" key={palette.id}>
                <h3>{palette.title}</h3>
                <p className="small">ジャンル: {palette.genre}</p>
                <p className="small">{palette.description || "説明なし"}</p>
                <Link className="button secondary" href={`/palette/${palette.id}`}>
                  参加する
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
