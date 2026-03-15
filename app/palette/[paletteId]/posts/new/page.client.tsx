"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch, apiFetchForm } from "@/lib/api/client";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { ApiPostCategories, ApiPostCreate, MemberRole, Palette } from "@/lib/types";

type UploadFile = { file: File; url: string };

export default function PalettePostNewPage({ params }: { params: { paletteId: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [viewerRole, setViewerRole] = useState<MemberRole>("member");
  const isOwner = viewerRole === "owner" || user?.id === ownerId;
  const canModerate = viewerRole === "owner" || viewerRole === "moderator" || user?.id === ownerId;

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const finalCategory = useMemo(() => categories.find((c) => c.slug === "final") ?? null, [categories]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [isFinal, setIsFinal] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  const bootstrap = useCallback(async () => {
    try {
      await joinPalette(params.paletteId);
      const [paletteData, memberData] = await Promise.all([fetchPalette(params.paletteId), fetchPaletteMembers(params.paletteId)]);
      setPalette(paletteData);
      setOwnerId(memberData.ownerId);
      setViewerRole(memberData.members.find((m) => m.user_id === user?.id)?.role ?? "member");
    } catch (error) {
      const message = error instanceof Error ? error.message : "読み込みに失敗しました。";
      setErrorText(message);
    }
  }, [params.paletteId, user?.id]);

  const loadCategories = useCallback(async () => {
    const response = await apiFetch<ApiPostCategories>(`/api/palettes/${params.paletteId}/post-categories`, "GET");
    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }
    setCategories(response.data.categories);
  }, [params.paletteId]);

  useEffect(() => {
    void bootstrap();
    void loadCategories();
  }, [bootstrap, loadCategories]);

  useEffect(() => {
    if (!categories.length) return;
    if (categoryId) return;
    const first = categories.find((c) => c.slug !== "final") ?? categories[0];
    if (first) setCategoryId(first.id);
  }, [categories, categoryId]);

  useEffect(() => {
    if (isFinal && finalCategory) {
      setCategoryId(finalCategory.id);
    }
  }, [finalCategory, isFinal]);

  const canSubmit = useMemo(() => {
    if (!isOwner) return false;
    const hasImages = files.length > 0;
    if (hasImages) return !saving;
    return !saving && body.trim().length > 0;
  }, [body, files.length, isOwner, saving]);

  const removeFileAt = (idx: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const removed = next.splice(idx, 1)[0];
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  const onFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const next: UploadFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!file || file.size === 0) continue;
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  };

  const createCategory = async () => {
    if (!newCategoryName.trim() || creatingCategory) return;
    setCreatingCategory(true);
    const response = await apiFetch<ApiPostCategories>(`/api/palettes/${params.paletteId}/post-categories`, "POST", {
      name: newCategoryName.trim(),
    });
    setCreatingCategory(false);
    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    setNewCategoryName("");
    setShowCategoryModal(false);
    await loadCategories();
  };

  const submit = async () => {
    if (!isOwner) {
      setErrorText("オーナーのみ投稿できます。");
      return;
    }

    setSaving(true);
    setErrorText("");

    const form = new FormData();
    form.set("title", title);
    form.set("body", body);
    form.set("categoryId", categoryId);
    form.set("isFinal", isFinal ? "true" : "false");
    files.forEach((f) => form.append("images", f.file, f.file.name));

    const response = await apiFetchForm<ApiPostCreate>(`/api/palettes/${params.paletteId}/posts`, "POST", form);
    setSaving(false);
    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    router.push(`/palette/${params.paletteId}/posts`);
    router.refresh();
  };

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"} の新規投稿</h1>
              <p className="small">画像がある場合はタイトル/本文は省略できます。画像がない場合は本文が必須です。</p>
            </div>
            <Link className="button secondary" href={`/palette/${params.paletteId}/posts`}>
              戻る
            </Link>
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {!isOwner ? <p className="small">このページはオーナーのみ利用できます。</p> : null}

          <form
            className="post-new-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <label>
              タイトル（任意）
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </label>

            <label>
              本文（{files.length ? "任意" : "必須"}）
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} maxLength={20000} />
            </label>

            <div className="post-new-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isFinal}
                  onChange={(e) => setIsFinal(e.target.checked)}
                />
                完成版の漫画として扱う
              </label>
              {isFinal ? <p className="small">完成版の場合、カテゴリは「完成版」に固定されます。</p> : null}
            </div>

            <label>
              カテゴリ
              <select
                value={categoryId}
                disabled={isFinal}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__add__") {
                    setShowCategoryModal(true);
                    return;
                  }
                  setCategoryId(value);
                }}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} disabled={isFinal && c.slug !== "final"}>
                    {c.name}
                  </option>
                ))}
                <option value="__add__">+ カテゴリを追加</option>
              </select>
            </label>

            <label>
              画像（任意、最大10枚）
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => onFilesSelected(e.target.files)}
              />
            </label>

            {files.length ? (
              <div className="post-new-previews">
                {files.map((item, idx) => (
                  <div key={`${item.file.name}-${idx}`} className="post-new-preview">
                    <img src={item.url} alt={item.file.name} />
                    <button type="button" className="small action-link" onClick={() => removeFileAt(idx)}>
                      削除
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="post-new-actions">
              <button className="button" type="submit" disabled={!canSubmit}>
                {saving ? "アップロード中..." : "投稿する"}
              </button>
              <Link className="button secondary" href={`/palette/${params.paletteId}/posts`}>
                キャンセル
              </Link>
            </div>
          </form>
        </section>

        {showCategoryModal ? (
          <>
            <button
              type="button"
              className="channel-modal-backdrop"
              onClick={() => setShowCategoryModal(false)}
              aria-label="カテゴリ追加を閉じる"
            />
            <section className="channel-modal" role="dialog" aria-modal="true" aria-label="カテゴリ追加">
              <h3>カテゴリ追加</h3>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void createCategory();
                }}
              >
                <label>
                  カテゴリ名
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="例: ネーム"
                    minLength={1}
                    maxLength={40}
                    required
                  />
                </label>
                <div className="channel-modal-actions">
                  <button type="button" className="button secondary" onClick={() => setShowCategoryModal(false)}>
                    キャンセル
                  </button>
                  <button type="submit" className="button" disabled={creatingCategory}>
                    {creatingCategory ? "作成中..." : "作成"}
                  </button>
                </div>
              </form>
            </section>
          </>
        ) : null}
      </main>
    </AuthGate>
  );
}

