import type { ApiResponse } from "@/lib/api/response";

export type AuthStatus = "unauthenticated" | "authenticated" | "loading";
export type FetchStatus = "idle" | "loading" | "ready" | "error";
export type SendStatus = "idle" | "sending" | "failed";
export type MemberRole = "owner" | "moderator" | "member";

export type UserProfile = {
  id: string;
  public_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  notifications: "all" | "vote-only" | "none" | null;
  visibility: "public" | "private" | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Palette = {
  id: string;
  title: string;
  genre: string;
  description: string | null;
  owner_id: string;
  is_public: boolean;
  created_at: string;
  owner_profile?: UserProfile | null;
};

export type PaletteMember = {
  palette_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile: UserProfile | null;
};

export type PaletteChannel = {
  id: string;
  palette_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string;
  created_at: string;
};

export type PalettePollOption = {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
};

export type PalettePoll = {
  id: string;
  palette_id: string;
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
  active: boolean;
  options: PalettePollOption[];
};

export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type Message = {
  id: string;
  palette_id: string;
  channel_id: string | null;
  user_id: string;
  content: string;
  parent_message_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  profile: UserProfile | null;
};

export type ModerationLog = {
  id: string;
  palette_id: string;
  message_id: string;
  actor_id: string;
  action: string;
  reason: string | null;
  created_at: string;
  actor_profile: UserProfile | null;
  message: {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
  } | null;
};

export type Vote = {
  id: string;
  palette_id: string;
  poll_id: string | null;
  user_id: string;
  topic: string;
  option_key: string;
  created_at: string;
};

export type PaletteListPayload = {
  palettes: Palette[];
};

export type PaletteDetailPayload = {
  palette: Palette;
};

export type PaletteMembersPayload = {
  members: PaletteMember[];
  ownerId: string;
};

export type PaletteChannelsPayload = {
  channels: PaletteChannel[];
};

export type PalettePollsPayload = {
  polls: PalettePoll[];
};

export type MessageListPayload = {
  messages: Message[];
  reactions: MessageReaction[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ModerationLogsPayload = {
  logs: ModerationLog[];
};

export type VoteListPayload = {
  votes: Vote[];
};

export type ProfilePayload = {
  profile: UserProfile;
};

export type UserPagePayload = {
  profile: UserProfile;
  paletteCount: number;
  messageCount: number;
};

export type ApiPaletteList = ApiResponse<PaletteListPayload>;
export type ApiPaletteCreate = ApiResponse<{ palette: Palette }>;
export type ApiPaletteDetail = ApiResponse<PaletteDetailPayload>;
export type ApiPaletteMembers = ApiResponse<PaletteMembersPayload>;
export type ApiPaletteChannels = ApiResponse<PaletteChannelsPayload>;
export type ApiPaletteChannelCreate = ApiResponse<{ channel: PaletteChannel }>;
export type ApiPalettePolls = ApiResponse<PalettePollsPayload>;
export type ApiPalettePollCreate = ApiResponse<{ poll: PalettePoll }>;

export type ApiMessageList = ApiResponse<MessageListPayload>;
export type ApiMessageCreate = ApiResponse<{ message: Message }>;

export type ApiModerationLogs = ApiResponse<ModerationLogsPayload>;

export type ApiVoteList = ApiResponse<VoteListPayload>;
export type ApiVoteCreate = ApiResponse<{ vote: Vote }>;

export type ApiProfile = ApiResponse<ProfilePayload>;
export type ApiUserPage = ApiResponse<UserPagePayload>;

export type PostCategory = {
  id: string;
  palette_id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
};

export type PalettePost = {
  id: string;
  palette_id: string;
  author_id: string;
  title: string | null;
  body: string | null;
  category_id: string | null;
  is_final: boolean;
  created_at: string;
  updated_at: string;
};

export type PostImage = {
  id: string;
  post_id: string;
  sort_order: number;
  r2_key: string;
  content_type: string;
  bytes: number;
  created_at: string;
};

export type TimelinePostCard = {
  post: PalettePost;
  category: { id: string; name: string; slug: string } | null;
  images: Array<Pick<PostImage, "id" | "sort_order" | "bytes" | "content_type">>;
  author_profile: UserProfile | null;
};

export type GalleryImage = {
  image: Pick<PostImage, "id" | "sort_order" | "bytes" | "content_type">;
  post_id: string;
  palette_id: string;
  created_at: string;
  category: { id: string; name: string; slug: string } | null;
};

export type PostCategoriesPayload = { categories: Array<Pick<PostCategory, "id" | "name" | "slug">> };
export type PostListPayload =
  | { view: "timeline"; posts: TimelinePostCard[]; nextCursor: string | null; hasMore: boolean }
  | { view: "gallery"; images: GalleryImage[]; nextCursor: string | null; hasMore: boolean };

export type ApiPostCategories = ApiResponse<PostCategoriesPayload>;
export type ApiPostList = ApiResponse<PostListPayload>;
export type ApiPostCreate = ApiResponse<{ postId: string }>;
