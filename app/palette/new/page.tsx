"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { apiFetch } from "@/lib/api/client";
import type { ApiPaletteCreate } from "@/lib/types";

export default function NewPalettePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setErrorText("");

    const formData = new FormData(form);
    const body = {
      title: String(formData.get("title") ?? ""),
      genre: String(formData.get("genre") ?? ""),
      description: String(formData.get("description") ?? ""),
    };

    try {
      const response = await apiFetch<ApiPaletteCreate>("/api/palettes", "POST", body);

      if (!response.success) {
        setErrorText(response.error.message);
        return;
      }

      router.push(`/palette/${response.data.palette.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <h1>新しいパレットを作成</h1>
          </div>
          <p className="small">作成後はそのままパレット詳細画面へ遷移します。</p>
          <form onSubmit={handleCreate}>
            <label>
              パレット名
              <input name="title" type="text" placeholder="例：学園SF編" minLength={2} maxLength={120} required />
            </label>
            <label>
              ジャンル
              <select name="genre" defaultValue="SF" required>
                <option>バトル</option>
                <option>ラブコメ</option>
                <option>SF</option>
                <option>ホラー</option>
              </select>
            </label>
            <label>
              説明
              <textarea name="description" placeholder="このパレットで作りたい作品の方向性" maxLength={800} />
            </label>
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? "作成中..." : "作成する"}
            </button>
          </form>
          {errorText ? <p className="small error-text">{errorText}</p> : null}
        </section>
      </main>
    </AuthGate>
  );
}
