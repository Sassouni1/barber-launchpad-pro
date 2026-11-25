import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PracticeDifficulty = "easy" | "medium" | "difficult";
export type PracticeTurn = { itemId: string; speaker: "You" | "Mark" | "David"; text: string; order: number };
export type PracticeCall = {
  id: string;
  difficulty: PracticeDifficulty;
  started_at: string;
  ended_at: string | null;
  status: "in_progress" | "completed" | "interrupted";
  transcript: PracticeTurn[];
};

// The generated Database type is refreshed after the new migration is deployed.
const practiceDb = supabase as unknown as SupabaseClient;

export function usePracticeCallHistory() {
  const [history, setHistory] = useState<PracticeCall[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activeId = useRef<string | null>(null);
  const activeDifficulty = useRef<PracticeDifficulty>("medium");
  const turns = useRef<Map<string, PracticeTurn>>(new Map());
  const itemOrder = useRef<Map<string, number>>(new Map());
  const nextOrder = useRef(0);
  const saveQueue = useRef<Promise<boolean>>(Promise.resolve(true));

  const refreshHistory = useCallback(async () => {
    const calls: PracticeCall[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await practiceDb.from("appointment_practice_calls")
        .select("id, difficulty, started_at, ended_at, status, transcript")
        .order("started_at", { ascending: false }).range(offset, offset + 99);
      if (error) {
        setHistoryError("Could not load saved calls.");
        return;
      }
      calls.push(...((data ?? []) as PracticeCall[]));
      if (!data || data.length < 100) break;
    }
    setHistory(calls);
    setHistoryError(null);
  }, []);

  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  const start = useCallback(async (difficulty: PracticeDifficulty) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error("Sign in to save your practice call.");
    const { data, error } = await practiceDb.from("appointment_practice_calls")
      .insert({ user_id: userData.user.id, difficulty })
      .select("id").single();
    if (error || !data?.id) throw new Error("Could not save this call. Please try again before practicing.");
    activeId.current = data.id as string;
    activeDifficulty.current = difficulty;
    turns.current = new Map();
    itemOrder.current = new Map();
    nextOrder.current = 0;
    saveQueue.current = Promise.resolve(true);
    setSaveError(null);
    await refreshHistory();
  }, [refreshHistory]);

  const orderFor = useCallback((itemId: string) => {
    let order = itemOrder.current.get(itemId);
    if (order === undefined) {
      order = nextOrder.current++;
      itemOrder.current.set(itemId, order);
    }
    return order;
  }, []);

  const save = useCallback((status?: "completed" | "interrupted") => {
    const id = activeId.current;
    if (!id) return Promise.resolve(true);
    const transcript = [...turns.current.values()].sort((a, b) => a.order - b.order);
    const changes = status ? { transcript, status, ended_at: new Date().toISOString() } : { transcript };
    setSaving(true);
    saveQueue.current = saveQueue.current.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await practiceDb.from("appointment_practice_calls")
          .update(changes).eq("id", id).select("id").single();
        if (!error && data?.id === id) {
          setSaveError(null);
          return true;
        }
        if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 500 * (attempt + 1)));
      }
      setSaveError("This call has unsaved dialogue. Check your connection and retry saving.");
      return false;
    }).catch(() => {
      setSaveError("This call has unsaved dialogue. Check your connection and retry saving.");
      return false;
    }).finally(() => setSaving(false));
    return saveQueue.current;
  }, []);

  const receive = useCallback((event: {
    type?: string;
    item_id?: string;
    item?: { id?: string };
    transcript?: string;
  }) => {
    if (!activeId.current) return;
    if (event.type === "conversation.item.created" && event.item?.id) {
      orderFor(event.item.id);
      return;
    }
    const speaker = event.type === "conversation.item.input_audio_transcription.completed" ? "You"
      : event.type === "response.output_audio_transcript.done" ? (activeDifficulty.current === "medium" ? "David" : "Mark") : null;
    if (!speaker || !event.item_id || !event.transcript?.trim()) return;
    turns.current.set(event.item_id, {
      itemId: event.item_id,
      speaker,
      text: event.transcript.trim(),
      order: orderFor(event.item_id),
    });
    void save();
  }, [orderFor, save]);

  const finish = useCallback(async (status: "completed" | "interrupted" = "completed") => {
    if (!activeId.current) return true;
    const saved = await save(status);
    if (!saved) return false;
    activeId.current = null;
    await refreshHistory();
    return true;
  }, [refreshHistory, save]);

  return { history, historyError, saveError, saving, refreshHistory, start, receive, finish };
}
