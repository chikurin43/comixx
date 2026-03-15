"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ModalImage = {
  id: string;
  alt?: string;
};

type Props = {
  open: boolean;
  images: ModalImage[];
  initialIndex: number;
  onClose: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function PostImageModal({ open, images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const count = images.length;
  const current = images[clamp(index, 0, Math.max(0, count - 1))] ?? null;

  const canPrev = index > 0;
  const canNext = index < count - 1;

  const imageUrl = useMemo(() => {
    if (!current) return "";
    return `/api/post-images/${current.id}`;
  }, [current]);

  useEffect(() => {
    if (!open) return;
    setIndex(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft") {
        setIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }

      if (event.key === "ArrowRight") {
        setIndex((prev) => (prev < count - 1 ? prev + 1 : prev));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="post-image-modal" role="dialog" aria-modal="true" aria-label="画像プレビュー">
      <button className="post-image-modal-backdrop" type="button" onClick={onClose} aria-label="閉じる" />
      <div
        className="post-image-modal-panel"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          startRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchMove={(event) => {
          const start = startRef.current;
          const touch = event.touches[0];
          if (!start || !touch) return;

          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dy) > 40) return;

          if (dx > 70 && canPrev) {
            startRef.current = null;
            setIndex((prev) => prev - 1);
          } else if (dx < -70 && canNext) {
            startRef.current = null;
            setIndex((prev) => prev + 1);
          }
        }}
        onTouchEnd={() => {
          startRef.current = null;
        }}
      >
        <div className="post-image-modal-head">
          <span className="small">
            {count ? `${index + 1} / ${count}` : "0 / 0"}
          </span>
          <button className="button secondary" type="button" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="post-image-modal-body">
          {canPrev ? (
            <button
              type="button"
              className="post-image-modal-nav left"
              aria-label="前の画像"
              onClick={() => setIndex((prev) => prev - 1)}
            >
              ‹
            </button>
          ) : null}

          <button
            type="button"
            className="post-image-modal-tap left"
            aria-label="前の画像"
            onClick={() => canPrev && setIndex((prev) => prev - 1)}
          />
          <button
            type="button"
            className="post-image-modal-tap right"
            aria-label="次の画像"
            onClick={() => canNext && setIndex((prev) => prev + 1)}
          />

          {current ? <img className="post-image-modal-image" src={imageUrl} alt={current.alt ?? ""} /> : null}

          {canNext ? (
            <button
              type="button"
              className="post-image-modal-nav right"
              aria-label="次の画像"
              onClick={() => setIndex((prev) => prev + 1)}
            >
              ›
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

