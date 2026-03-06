import type { ApiResponse } from "@/lib/api/response";

export type AuthStatus = "unauthenticated" | "authenticated" | "loading";

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
  role: "owner" | "member";
  joined_at: string;
  profile: UserProfile | null;
};

export type PaletteChannel = {
  id: string;
  palette_id: string;
  name: string;
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
  reply_to_id: string | null;
  created_at: string;
  profile: UserProfile | null;
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

export type ApiVoteList = ApiResponse<VoteListPayload>;
export type ApiVoteCreate = ApiResponse<{ vote: Vote }>;

export type ApiProfile = ApiResponse<ProfilePayload>;
export type ApiUserPage = ApiResponse<UserPagePayload>;
