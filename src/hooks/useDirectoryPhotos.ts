import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DirectoryPhoto {
  id: string;
  user_id: string;
  listing_id: string | null;
  file_url: string;
  file_path: string;
  is_hero: boolean;
  is_proof: boolean;
  caption: string | null;
  order_index: number;
  created_at: string;
}

export function useDirectoryPhotos(userId: string | undefined) {
  return useQuery({
    queryKey: ["directory-photos", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directory_photos")
        .select("*")
        .eq("user_id", userId!)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as DirectoryPhoto[];
    },
  });
}

export async function uploadDirectoryPhoto(opts: {
  userId: string;
  file: File;
  listingId?: string | null;
  isProof?: boolean;
  isHero?: boolean;
  caption?: string;
}): Promise<DirectoryPhoto> {
  const ext = opts.file.name.split(".").pop() || "jpg";
  const path = `${opts.userId}/${opts.isProof ? "proof" : "gallery"}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("specialist-directory")
    .upload(path, opts.file, { upsert: false, cacheControl: "3600" });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("specialist-directory").getPublicUrl(path);

  const { data, error } = await supabase
    .from("directory_photos")
    .insert({
      user_id: opts.userId,
      listing_id: opts.listingId ?? null,
      file_url: pub.publicUrl,
      file_path: path,
      is_hero: !!opts.isHero,
      is_proof: !!opts.isProof,
      caption: opts.caption ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DirectoryPhoto;
}

export function useDeleteDirectoryPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photo: DirectoryPhoto) => {
      await supabase.storage.from("specialist-directory").remove([photo.file_path]);
      const { error } = await supabase.from("directory_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory-photos"] }),
  });
}

export function useSetHeroPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, photoId }: { userId: string; photoId: string }) => {
      // unset all
      await supabase
        .from("directory_photos")
        .update({ is_hero: false })
        .eq("user_id", userId);
      const { error } = await supabase
        .from("directory_photos")
        .update({ is_hero: true })
        .eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory-photos"] }),
  });
}
