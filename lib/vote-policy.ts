import type { Vote } from "@/lib/types";

export function hasUserVoted(votes: Vote[], userId: string, topic: string) {
  return votes.some((vote) => vote.user_id === userId && vote.topic === topic);
}

export function summarizeVotes(votes: Vote[], topic: string) {
  return votes
    .filter((vote) => vote.topic === topic)
    .reduce<Record<string, number>>((acc, vote) => {
      acc[vote.option_key] = (acc[vote.option_key] || 0) + 1;
      return acc;
    }, {});
}
