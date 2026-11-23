import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Difficulty = "easy" | "medium" | "difficult";
type CallState = "idle" | "ringing" | "connecting" | "listening" | "speaking";

const levels: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "difficult", label: "Difficult" },
];

const bars = [8, 12, 18, 11, 28, 39, 20, 13, 33, 49, 24, 15, 35, 18, 11, 7];

export function AppointmentSettingPractice() {
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [callState, setCallState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const timerRef = useRef<number | null>(null);
  const connectTimerRef = useRef<number | null>(null);
  const ringAudioRef = useRef<AudioContext | null>(null);
  const runRef = useRef(0);

  const endPractice = useCallback(() => {
    runRef.current += 1;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    if (connectTimerRef.current !== null) window.clearTimeout(connectTimerRef.current);
    connectTimerRef.current = null;
    if (ringAudioRef.current) void ringAudioRef.current.close();
    ringAudioRef.current = null;
    channelRef.current?.close();
    channelRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current.remove();
    }
    audioRef.current = null;
    setMuted(false);
    setCallState("idle");
  }, []);

  useEffect(() => () => {
    runRef.current += 1;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (connectTimerRef.current !== null) window.clearTimeout(connectTimerRef.current);
    if (ringAudioRef.current) void ringAudioRef.current.close();
    channelRef.current?.close();
    peerRef.current?.close();
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.srcObject = null;
    audioRef.current?.remove();
  }, []);

  const startPractice = useCallback(async () => {
    if (callState !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      setError("This browser cannot start a voice conversation. Try a current browser with microphone access.");
      return;
    }

    const run = ++runRef.current;
    setError(null);
    setCallState("ringing");
    try {
      const ringAudio = new AudioContext();
      ringAudioRef.current = ringAudio;
      await ringAudio.resume();
      const now = ringAudio.currentTime;
      for (const offset of [0, 1.15]) {
        const gain = ringAudio.createGain();
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.03);
        gain.gain.setValueAtTime(0.12, now + offset + 0.66);
        gain.gain.linearRampToValueAtTime(0, now + offset + 0.73);
        gain.connect(ringAudio.destination);
        for (const frequency of [440, 480]) {
          const oscillator = ringAudio.createOscillator();
          oscillator.frequency.value = frequency;
          oscillator.connect(gain);
          oscillator.start(now + offset);
          oscillator.stop(now + offset + 0.74);
        }
      }
      await new Promise(resolve => window.setTimeout(resolve, 2100));
      if (run !== runRef.current) return;
      await ringAudio.close();
      ringAudioRef.current = null;
      setCallState("connecting");
      connectTimerRef.current = window.setTimeout(() => {
        if (run !== runRef.current) return;
        endPractice();
        setError("The voice connection timed out. Check microphone permission and try again.");
      }, 25000);
      const { data, error: sessionError } = await supabase.functions.invoke("appointment-practice-session", {
        body: { difficulty },
      });
      if (run !== runRef.current) return;
      if (sessionError || typeof data?.clientSecret !== "string") {
        throw new Error(data?.error || "Voice practice is unavailable right now. Please try again.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (run !== runRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioRef.current = audio;
      peer.ontrack = event => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => setError("Tap the microphone again to allow audio playback."));
      };
      stream.getAudioTracks().forEach(track => peer.addTrack(track, stream));

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        if (run !== runRef.current) return;
        if (connectTimerRef.current !== null) window.clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
        setCallState("listening");
        channel.send(JSON.stringify({ type: "response.create", response: { instructions: "You just answered the phone. Say exactly one word: Hello. Then stop and wait for the caller." } }));
        timerRef.current = window.setTimeout(() => {
          endPractice();
          setError("Practice ended after 15 minutes. Start another call whenever you're ready.");
        }, 15 * 60 * 1000);
      };
      channel.onmessage = event => {
        if (run !== runRef.current) return;
        try {
          const message = JSON.parse(event.data) as { type?: string; error?: { message?: string } };
          if (message.type === "response.created" || message.type === "response.output_audio.delta") setCallState("speaking");
          if (message.type === "response.done" || message.type === "input_audio_buffer.speech_started") setCallState("listening");
          if (message.type === "error") setError(message.error?.message || "The call had a problem. Please try again.");
        } catch {
          // Ignore non-JSON data channel messages.
        }
      };
      peer.onconnectionstatechange = () => {
        if (run !== runRef.current || peer.connectionState !== "failed") return;
        endPractice();
        setError("The voice connection dropped. Please start a new practice call.");
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answer = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.clientSecret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!answer.ok) throw new Error("The voice connection could not start. Please try again.");
      const sdp = await answer.text();
      if (run !== runRef.current) return;
      await peer.setRemoteDescription({ type: "answer", sdp });
    } catch (cause) {
      if (run !== runRef.current) return;
      endPractice();
      setError(cause instanceof Error ? cause.message : "Voice practice could not start.");
    }
  }, [callState, difficulty, endPractice]);

  const toggleMicrophone = () => {
    if (callState === "idle") {
      void startPractice();
      return;
    }
    if (callState === "connecting" || callState === "ringing") return;
    const nextMuted = !muted;
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  };

  const status = callState === "ringing" ? "Ringing Mark…"
    : callState === "connecting" ? "Connecting to Mark…"
    : muted ? "Microphone muted"
    : callState === "speaking" ? "Mark is speaking"
    : callState === "listening" ? "Mark is listening"
    : "Ready to practice";

  return (
    <section aria-label="Appointment setting voice practice" className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#edc465]">Voice practice</p>
        <h2 className="mt-1 font-display text-3xl font-bold text-[#f2bf50] sm:text-4xl">Practice with Mark</h2>
        <p className="mt-2 text-sm text-[#d6d0c6] sm:text-base">Have a real conversation with a prospective client before you make your next appointment-setting call.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(310px,1fr)]">
        <div className="grid gap-4 rounded-2xl border border-white/15 bg-[#101115] p-4 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] sm:p-5">
          <div className="flex flex-col rounded-xl border border-white/15 bg-[#141519] p-5">
            <div className="flex items-center gap-2 text-[#f2bf50]"><Target className="h-5 w-5" /><h3 className="font-display text-xl font-bold">Scenario</h3></div>
            <p className="mt-4 text-base leading-relaxed text-[#f8f2e9]">Mark is nervous about his thinning hair and unsure whether a hair system is right for him.</p>
            <p className="mt-5 text-sm leading-relaxed text-[#bcb6ab]">He requested information but has not booked a free consultation.</p>
          </div>
          <figure className="relative min-h-[360px] overflow-hidden rounded-xl bg-[#222] sm:min-h-[440px]">
            <img src="/lesson-assets/appointment-setting/mark.png" alt="Mark, the practice client with thinning hair" className="h-full w-full object-cover object-center" />
            <figcaption className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl border border-[#d4a944]/65 bg-[#111317]/90 px-6 py-2 text-center shadow-lg backdrop-blur-sm">
              <span className="block text-xl font-bold text-white">Mark</span>
              <span className="block whitespace-nowrap text-xs text-[#d6d0c6]">Practice client</span>
            </figcaption>
          </figure>
        </div>

        <div className="flex flex-col rounded-2xl border border-white/15 bg-[#101115] p-5 text-center sm:p-6">
          <div className="rounded-xl border border-white/15 bg-[#141519] px-4 py-4 text-left">
            <div className="flex items-start gap-3"><Target className="mt-0.5 h-5 w-5 shrink-0 text-[#f2bf50]" /><div><h3 className="font-semibold text-[#f2bf50]">Your goal</h3><p className="mt-1 text-sm leading-relaxed text-[#f8f2e9]">Understand his concern and invite him to a consultation.</p></div></div>
          </div>
          <div aria-hidden="true" className="mt-6 flex h-14 items-center justify-center gap-1">
            {bars.map((height, index) => <span key={index} className={`w-1 rounded-full bg-[#e5b748] ${callState === "speaking" ? "animate-pulse" : ""}`} style={{ height }} />)}
          </div>
          <p role="status" className="mx-auto mt-3 rounded-full border border-[#d4a944]/40 bg-[#27261d] px-4 py-1.5 text-sm text-[#f8f2e9]">{status}</p>
          <button type="button" onClick={toggleMicrophone} disabled={callState === "connecting" || callState === "ringing"} aria-label={callState === "idle" ? "Start voice practice" : muted ? "Unmute microphone" : "Mute microphone"} className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#f8d176] bg-gradient-to-br from-[#f7cf67] to-[#bd8325] text-[#17110a] shadow-[0_0_35px_rgba(212,169,68,0.25)] transition hover:scale-105 disabled:cursor-wait disabled:opacity-60">
            {muted ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
          </button>
          <p className="mt-2 font-semibold text-[#f8f2e9]">{callState === "idle" ? "Speak to client" : muted ? "Tap to unmute" : "Tap to mute"}</p>
          <div className="mt-5 border-t border-white/15 pt-5">
            <p id="practice-difficulty-label" className="font-semibold text-[#f8f2e9]">Difficulty</p>
            <div role="group" aria-labelledby="practice-difficulty-label" className="mt-3 grid grid-cols-3 gap-2">
              {levels.map(level => <button key={level.value} type="button" disabled={callState !== "idle"} aria-pressed={difficulty === level.value} onClick={() => setDifficulty(level.value)} className={`rounded-lg border px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${difficulty === level.value ? "border-[#f2bf50] bg-[#e5b748] text-[#17110a]" : "border-[#d4a944]/70 text-[#f8f2e9] hover:bg-[#d4a944]/15"}`}>{level.label}</button>)}
            </div>
          </div>
          {callState === "idle" ? <button type="button" onClick={() => void startPractice()} className="mt-5 rounded-lg bg-[#e5b748] px-5 py-3 font-semibold text-[#17110a] transition hover:bg-[#f3cc73]">Start practice</button>
            : <button type="button" onClick={endPractice} className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-[#d4a944]/70 px-5 py-3 font-semibold text-[#f8f2e9] transition hover:bg-[#d4a944]/15"><PhoneOff className="h-4 w-4" /> End practice</button>}
          <p className="mt-3 text-xs leading-relaxed text-[#9d968c]">This is a practice call. No real appointment is booked.</p>
          {error && <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-950/30 p-3 text-left text-sm text-red-200">{error}</p>}
        </div>
      </div>
    </section>
  );
}
