"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch } from "@/lib/api/client";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { ApiPalettePollCreate, Palette } from "@/lib/types";

export default function PaletteVoteCreatePage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const router = useRouter();

  const [palette, setPalette] = useState<Palette | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [optionsText, setOptionsText] = useState("Option A\nOption B");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const isOwner = user?.id === ownerId;

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await joinPalette(params.paletteId);

        const [paletteData, memberData] = await Promise.all([
          fetchPalette(params.paletteId),
          fetchPaletteMembers(params.paletteId),
        ]);

        setPalette(paletteData);
        setOwnerId(memberData.ownerId);
        setErrorText("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "読み込みに失敗しました。";
        setErrorText(message);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [params.paletteId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOwner) {
      setErrorText("オーナーのみ投票を作成できます。");
      return;
    }

    setSubmitting(true);

    const options = optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const response = await apiFetch<ApiPalettePollCreate>(`/api/palettes/${params.paletteId}/polls`, "POST", {
      title,
      description,
      options,
    });

    setSubmitting(false);

    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    router.push(`/palette/${params.paletteId}/votes`);
    router.refresh();
  };

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"} の投票作成</h1>
              <p className="small">オーナー専用ページです。</p>
            </div>
            <Link className="button secondary" href={`/palette/${params.paletteId}/votes`}>
              投票一覧へ
            </Link>
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} />

          {loading ? <p className="small">読み込み中...</p> : null}
          {!loading && !isOwner ? <p className="small error-text">このページはオーナーのみ利用できます。</p> : null}
          {errorText ? <p className="small error-text">{errorText}</p> : null}

          {isOwner ? (
            <form onSubmit={handleSubmit}>
              <label>
                投票タイトル
                <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={2} maxLength={120} required />
              </label>

              <label>
                説明
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={400} />
              </label>

              <label>
                選択肢（1行1件、2-8件）
                <textarea
                  value={optionsText}
                  onChange={(event) => setOptionsText(event.target.value)}
                  minLength={3}
                  maxLength={300}
                  rows={8}
                  required
                />
              </label>

              <button className="button" type="submit" disabled={submitting}>
                {submitting ? "作成中..." : "投票を作成"}
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </AuthGate>
  );
}
