import { describe, expect, it } from "vitest";
import { hasUserVoted, summarizeVotes } from "@/lib/vote-policy";
import type { Vote } from "@/lib/types";

const votes: Vote[] = [
  {
    id: "1",
    palette_id: "p1",
    user_id: "u1",
    topic: "story_direction",
    option_key: "A",
    created_at: "2026-03-05T00:00:00.000Z",
  },
  {
    id: "2",
    palette_id: "p1",
    user_id: "u2",
    topic: "story_direction",
    option_key: "B",
    created_at: "2026-03-05T00:00:01.000Z",
  },
  {
    id: "3",
    palette_id: "p1",
    user_id: "u3",
    topic: "story_direction",
    option_key: "A",
    created_at: "2026-03-05T00:00:02.000Z",
  },
];

describe("vote-policy", () => {
  it("checks duplicate vote by user and topic", () => {
    expect(hasUserVoted(votes, "u1", "story_direction")).toBe(true);
    expect(hasUserVoted(votes, "u9", "story_direction")).toBe(false);
  });

  it("summarizes vote counts", () => {
    expect(summarizeVotes(votes, "story_direction")).toEqual({ A: 2, B: 1 });
  });
});
