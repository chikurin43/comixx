import { apiGet, apiPost } from "@/lib/api/client";
import type {
  ApiPaletteChannels,
  ApiPaletteDetail,
  ApiPaletteMembers,
  ApiPalettePolls,
  Palette,
  PaletteChannel,
  PaletteMember,
  PalettePoll,
} from "@/lib/types";

export async function fetchPalette(paletteId: string): Promise<Palette> {
  const response = await apiGet<ApiPaletteDetail>(`/api/palettes/${paletteId}`);
  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data.palette;
}

export async function fetchPaletteMembers(paletteId: string): Promise<{ members: PaletteMember[]; ownerId: string }> {
  const response = await apiGet<ApiPaletteMembers>(`/api/palettes/${paletteId}/members`);
  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export function joinPalette(paletteId: string) {
  return apiPost(`/api/palettes/${paletteId}/members`);
}

export async function fetchPaletteChannels(paletteId: string): Promise<PaletteChannel[]> {
  const response = await apiGet<ApiPaletteChannels>(`/api/palettes/${paletteId}/channels`);
  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data.channels;
}

export async function fetchPalettePolls(paletteId: string): Promise<PalettePoll[]> {
  const response = await apiGet<ApiPalettePolls>(`/api/palettes/${paletteId}/polls`);
  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data.polls;
}
