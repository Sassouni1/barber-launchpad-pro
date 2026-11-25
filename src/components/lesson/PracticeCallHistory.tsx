import type { PracticeCall } from "./usePracticeCallHistory";

type Props = {
  calls: PracticeCall[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  error: string | null;
};

export function PracticeCallHistory({ calls, selectedId, onSelect, onRefresh, error }: Props) {
  const selected = calls.find(call => call.id === selectedId) ?? calls[0];
  return <section aria-label="Saved practice calls" className="rounded-2xl border border-[#d4a944]/45 bg-[#141519] p-4 text-[#f8f2e9] sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-display text-2xl font-bold text-[#f2bf50]">Saved calls</h3>
      <button type="button" onClick={onRefresh} className="text-sm text-[#edc465] underline underline-offset-4">Refresh</button>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    {calls.length === 0 && !error && <p className="mt-3 text-sm text-[#c2b9a9]">Your future practice calls and transcripts will appear here.</p>}
    {selected && <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(210px,0.8fr)_minmax(0,1.5fr)]">
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {calls.map(call => <button key={call.id} type="button" onClick={() => onSelect(call.id)} className={`block w-full rounded-lg border p-3 text-left text-sm ${selected.id === call.id ? "border-[#f2bf50] bg-[#d4a944]/15" : "border-white/15 hover:border-[#d4a944]/60"}`}>
          <span className="block font-semibold">{new Date(call.started_at).toLocaleString()} · {call.difficulty}</span>
          <span className="mt-1 block text-xs text-[#c2b9a9]">{call.status === "in_progress" ? "In progress or interrupted" : call.status} · {call.transcript.length} turns</span>
        </button>)}
      </div>
      <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl border border-white/15 bg-[#0b0c0f] p-4" aria-label="Call transcript">
        {selected.transcript.length ? selected.transcript.map(turn => <p key={turn.itemId} className="text-sm leading-relaxed"><strong className={turn.speaker !== "You" ? "text-[#edc465]" : "text-white"}>{turn.speaker}:</strong> {turn.text}</p>)
          : <p className="text-sm text-[#c2b9a9]">No speech was transcribed for this call.</p>}
      </div>
    </div>}
  </section>;
}
