"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch } from "@/lib/api/client";
import { formatDisplayName, formatPublicId } from "@/lib/chat/format";
import { fetchPalette, fetchPaletteMembers, fetchPalettePolls, joinPalette } from "@/lib/palette/client";
import type { ApiVoteCreate, ApiVoteList, Palette, PalettePoll, Vote } from "@/lib/types";

export default function PaletteVotesPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [polls, setPolls] = useState<PalettePoll[]>([]);
  const [votesByPoll, setVotesByPoll] = useState<Record<string, Vote[]>>({});
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const isOwner = user?.id === ownerId;

  const loadVotesForPolls = useCallback(
    async (pollList: PalettePoll[]) => {
      const pairs = await Promise.all(
        pollList.map(async (poll) => {
          const response = await apiFetch<ApiVoteList>(`/api/votes?paletteId=${params.paletteId}&pollId=${poll.id}`, "GET");
          return [poll.id, response.success ? response.data.votes : []] as const;
        }),
      );

      const map = Object.fromEntries(pairs);
      setVotesByPoll(map);
    },
    [params.paletteId],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await joinPalette(params.paletteId);

        const [paletteData, memberData, pollData] = await Promise.all([
          fetchPalette(params.paletteId),
          fetchPaletteMembers(params.paletteId),
          fetchPalettePolls(params.paletteId),
        ]);

        setPalette(paletteData);
        setOwnerId(memberData.ownerId);
        setPolls(pollData);

        await loadVotesForPolls(pollData);
        setErrorText("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "読み込みに失敗しました。";
        setErrorText(message);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [loadVotesForPolls, params.paletteId]);

  const voteSummaries = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};

    polls.forEach((poll) => {
      const votes = votesByPoll[poll.id] ?? [];
      const summary = votes.reduce<Record<string, number>>((acc, vote) => {
        acc[vote.option_key] = (acc[vote.option_key] ?? 0) + 1;
        return acc;
      }, {});
      result[poll.id] = summary;
    });

    return result;
  }, [polls, votesByPoll]);

  const myVotes = useMemo(() => {
    const mapping: Record<string, string> = {};

    Object.entries(votesByPoll).forEach(([pollId, votes]) => {
      const mine = votes.find((vote) => vote.user_id === user?.id);
      if (mine) {
        mapping[pollId] = mine.option_key;
      }
    });

    return mapping;
  }, [votesByPoll, user?.id]);

  const submitVote = async (pollId: string, optionKey: string) => {
    const response = await apiFetch<ApiVoteCreate>("/api/votes", "POST", {
      paletteId: params.paletteId,
      pollId,
      optionKey,
    });

    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    const refreshed = await apiFetch<ApiVoteList>(`/api/votes?paletteId=${params.paletteId}&pollId=${pollId}`, "GET");
    if (!refreshed.success) {
      setErrorText(refreshed.error.message);
      return;
    }

    setVotesByPoll((prev) => ({ ...prev, [pollId]: refreshed.data.votes }));
  };

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"} の投票</h1>
              <p className="small">投票はユーザーごとに1票。再投票で上書きされます。</p>
            </div>
            {isOwner ? (
              <Link className="button" href={`/palette/${params.paletteId}/votes/new`}>
                投票を作成
              </Link>
            ) : null}
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {loading ? <p className="small">読み込み中...</p> : null}

          <div className="list">
            {polls.map((poll) => {
              const summary = voteSummaries[poll.id] ?? {};
              const myVote = myVotes[poll.id];
              const owner = poll.created_by === ownerId;

              return (
                <article className="card" key={poll.id}>
                  <h3>{poll.title}</h3>
                  <p className="small">{poll.description || "説明なし"}</p>
                  <p className="small">{poll.active ? "状態: 受付中" : "状態: 終了"}</p>
                  <p className="small">作成者: {owner ? "オーナー" : formatDisplayName(null, formatPublicId(null, poll.created_by))}</p>
                  <div className="list">
                    {poll.options.map((option) => {
                      const voted = myVote === option.label;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className="button secondary"
                          data-active={voted}
                          disabled={!poll.active}
                          onClick={() => void submitVote(poll.id, option.label)}
                        >
                          {option.label} ({summary[option.label] ?? 0}票){voted ? " ← あなた" : ""}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
