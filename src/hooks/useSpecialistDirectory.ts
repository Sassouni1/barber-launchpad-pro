import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SpecialistListing {
  id: string;
  user_id: string;
  business_name: string;
  first_name: string | null;
  last_name: string | null;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  hero_photo_url: string | null;
  instagram_handle: string | null;
  booking_url: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  approved: boolean;
  approved_at: string | null;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpecialistSearchResult {
  id: string;
  business_name: string;
  first_name: string | null;
  last_name: string | null;
  city: string;
  state: string;
  hero_photo_url: string | null;
  instagram_handle: string | null;
  booking_url: string | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  distance_miles: number;
}

export function useMyListing(userId: string | undefined) {
  return useQuery({
    queryKey: ["specialist-listing", userId],
    enabled: !!userId,
    staleTime: 300000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialist_directory")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as SpecialistListing | null;
    },
  });
}

export function useUpsertListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SpecialistListing> & { user_id: string; business_name: string; city: string; state: string; zip_code: string }) => {
      const { data, error } = await supabase
        .from("specialist_directory")
        .upsert(payload as any, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["specialist-listing"] }),
  });
}

export function useAllListings() {
  return useQuery({
    queryKey: ["all-specialist-listings"],
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialist_directory")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SpecialistListing[];
    },
  });
}

export function useApproveListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase
        .from("specialist_directory")
        .update({
          approved,
          approved_at: approved ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-specialist-listings"] }),
  });
}

export async function searchSpecialists(zip: string, radius = 50): Promise<SpecialistSearchResult[]> {
  // Geocode the ZIP first
  const geo = await supabase.functions.invoke("geocode-zip", { body: { zip } });
  if (geo.error) throw new Error(geo.error.message);
  const { latitude, longitude } = geo.data;

  const { data, error } = await supabase.rpc("search_specialists", {
    search_lat: latitude,
    search_lng: longitude,
    radius_miles: radius,
  });
  if (error) throw error;
  return (data || []) as SpecialistSearchResult[];
}
