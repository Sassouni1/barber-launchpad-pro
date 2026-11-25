import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePracticeCallHistory } from "./usePracticeCallHistory";
import { PracticeCallHistory } from "./PracticeCallHistory";
import { isBriefAcknowledgment, offersConsultation } from "./appointmentPracticeTurn";

type Difficulty = "easy" | "medium" | "difficult";
type CallState = "idle" | "ringing" | "connecting" | "listening" | "speaking" | "saving" | "save_failed";

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
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const { history, historyError, saveError, refreshHistory, start: startSavedCall, receive: receiveTranscript, finish: finishSavedCall } = usePracticeCallHistory();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const timerRef = useRef<number | null>(null);
  const connectTimerRef = useRef<number | null>(null);
  const ringAudioRef = useRef<AudioContext | null>(null);
  const runRef = useRef(0);
  const endingRef = useRef(false);
  const greetingCompleteRef = useRef(false);
  const greetingFallbackRef = useRef<number | null>(null);
  const prospectName = difficulty === "medium" ? "David" : "Mark";

  const endPractice = useCallback((status: "completed" | "interrupted" = "completed") => {
    runRef.current += 1;
    endingRef.current = false;
    greetingCompleteRef.current = false;
    if (greetingFallbackRef.current !== null) window.clearTimeout(greetingFallbackRef.current);
    greetingFallbackRef.current = null;
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
    setCallState("saving");
    void finishSavedCall(status).then(saved => setCallState(saved ? "idle" : "save_failed"));
  }, [finishSavedCall]);

  useEffect(() => () => {
    runRef.current += 1;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (connectTimerRef.current !== null) window.clearTimeout(connectTimerRef.current);
    if (greetingFallbackRef.current !== null) window.clearTimeout(greetingFallbackRef.current);
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
    endingRef.current = false;
    greetingCompleteRef.current = false;
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
        endPractice("interrupted");
        setError("The voice connection timed out. Check microphone permission and try again.");
      }, 25000);
      const { data, error: sessionError } = await supabase.functions.invoke("appointment-practice-session", {
        body: { difficulty },
      });
      if (run !== runRef.current) return;
      if (sessionError || typeof data?.clientSecret !== "string" || (difficulty === "medium" && typeof data?.instructions !== "string")) {
        throw new Error(data?.error || "Voice practice is unavailable right now. Please try again.");
      }
      await startSavedCall(difficulty);
      if (run !== runRef.current) {
        await finishSavedCall("interrupted");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (run !== runRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      // Keep the caller's mic out of the Realtime session while the prospect says hello.
      stream.getAudioTracks().forEach(track => { track.enabled = false; });

      const finishGreeting = () => {
        if (run !== runRef.current || greetingCompleteRef.current || endingRef.current) return;
        greetingCompleteRef.current = true;
        if (greetingFallbackRef.current !== null) window.clearTimeout(greetingFallbackRef.current);
        greetingFallbackRef.current = null;
        stream.getAudioTracks().forEach(track => { track.enabled = true; });
        setCallState("listening");
      };

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
      const pendingMediumTurns: string[] = [];
      const handledMediumItems = new Set<string>();
      let responding = false;
      let bookingOffered = false;
      const respondToMediumTurn = () => {
        if (difficulty !== "medium" || responding || !greetingCompleteRef.current || channel.readyState !== "open") return;
        const transcript = pendingMediumTurns.shift();
        if (!transcript) return;
        const firstOffer = !bookingOffered && offersConsultation(transcript);
        if (firstOffer) bookingOffered = true;
        const stageDirections = firstOffer
          ? "The caller has just invited you to a consultation or offered a time. You are interested but a little hesitant. Briefly say you are pretty busy this week. Do not volunteer a time or ask for openings. Answer only this invitation and do not claim a real booking occurred."
          : bookingOffered
            ? "You have already hesitated once about booking. Do not repeat that objection. Answer the caller's current question briefly. If they offer workable specific times after addressing your concern, choose one naturally. Never claim a real booking or confirmation occurred."
            : null;
        responding = true;
        channel.send(JSON.stringify({ type: "response.create", response: stageDirections
          ? { instructions: `${data.instructions} ${stageDirections}` }
          : {} }));
      };
      channel.onopen = () => {
        if (run !== runRef.current) return;
        if (connectTimerRef.current !== null) window.clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
        setCallState("speaking");
        responding = true;
        channel.send(JSON.stringify({ type: "response.create", response: { instructions: "You just answered the phone. Say exactly one word: Hello. Then stop and wait for the caller." } }));
        timerRef.current = window.setTimeout(() => {
          endPractice("interrupted");
          setError("Practice ended after 15 minutes. Start another call whenever you're ready.");
        }, 15 * 60 * 1000);
      };
      channel.onmessage = event => {
        if (run !== runRef.current) return;
        try {
          const message = JSON.parse(event.data) as { type?: string; error?: { message?: string }; item_id?: string; item?: { id?: string }; transcript?: string };
          receiveTranscript(message);
          if (message.type === "output_audio_buffer.stopped" && !greetingCompleteRef.current) finishGreeting();
          if (message.type === "response.done" && !greetingCompleteRef.current && greetingFallbackRef.current === null) {
            greetingFallbackRef.current = window.setTimeout(finishGreeting, 3000);
          }
          if (!endingRef.current && (message.type === "response.created" || message.type === "response.output_audio.delta")) setCallState("speaking");
          if (!endingRef.current && greetingCompleteRef.current && (message.type === "response.done" || message.type === "input_audio_buffer.speech_started")) setCallState("listening");
          if (difficulty === "medium" && message.type === "conversation.item.input_audio_transcription.completed" && message.item_id && message.transcript?.trim() && !handledMediumItems.has(message.item_id)) {
            handledMediumItems.add(message.item_id);
            if (!isBriefAcknowledgment(message.transcript)) {
              pendingMediumTurns.push(message.transcript);
              respondToMediumTurn();
            }
          }
          if (message.type === "response.done") {
            responding = false;
            respondToMediumTurn();
          }
          if (message.type === "error") setError(message.error?.message || "The call had a problem. Please try again.");
        } catch {
          // Ignore non-JSON data channel messages.
        }
      };
      peer.onconnectionstatechange = () => {
        if (run !== runRef.current || peer.connectionState !== "failed") return;
        endPractice("interrupted");
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
      endPractice("interrupted");
      setError(cause instanceof Error ? cause.message : "Voice practice could not start.");
    }
  }, [callState, difficulty, endPractice, finishSavedCall, receiveTranscript, startSavedCall]);

  const toggleMicrophone = () => {
    if (callState === "idle") {
      void startPractice();
      return;
    }
    if (callState === "connecting" || callState === "ringing" || callState === "saving" || callState === "save_failed") return;
    const nextMuted = !muted;
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = !nextMuted; });
    setMuted(nextMuted);
  };

  const requestEndPractice = () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setCallState("saving");
    streamRef.current?.getAudioTracks().forEach(track => { track.enabled = false; });
    window.setTimeout(() => endPractice(), 1500);
  };

  const status = callState === "ringing" ? `Ringing ${prospectName}…`
    : callState === "connecting" ? `Connecting to ${prospectName}…`
    : callState === "saving" ? "Saving transcript…"
    : callState === "save_failed" ? "Save failed — retry below"
    : muted ? "Microphone muted"
    : callState === "speaking" ? `${prospectName} is speaking`
    : callState === "listening" ? `${prospectName} is listening`
    : "Ready to practice";

  return (
    <section aria-label="Appointment setting voice practice" className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#edc465]">Voice practice</p>
        <h2 className="mt-1 font-display text-3xl font-bold text-[#f2bf50] sm:text-4xl">Practice with {prospectName}</h2>
        <p className="mt-2 text-sm text-[#d6d0c6] sm:text-base">Have a real conversation with a prospective client before you make your next appointment-setting call.</p>
      </div>
      <div className="rounded-2xl border border-[#d4a944]/45 bg-[#141519] p-4 text-[#f8f2e9] sm:flex sm:items-center sm:gap-6 sm:p-5">
        <div className="flex shrink-0 items-center gap-2 text-[#f2bf50]"><Target className="h-5 w-5" /><h3 className="font-display text-xl font-bold">Scenario</h3></div>
        <p className="mt-2 text-sm leading-relaxed sm:mt-0 sm:text-base">{prospectName} is nervous about his thinning hair and unsure whether a hair system is right for him. <span className="text-[#bcb6ab]">He requested information but has not booked a free consultation.</span></p>
      </div>
      <div className="relative min-h-[1020px] overflow-hidden rounded-2xl border border-[#d4a944]/65 bg-[#101115] lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(310px,1fr)] lg:gap-4 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent">
        <figure className="absolute inset-0 overflow-hidden lg:relative lg:inset-auto lg:min-h-[600px] lg:rounded-2xl lg:border lg:border-white/15 lg:bg-[#101115] lg:p-5">
          <div className="absolute inset-0 lg:inset-5 lg:overflow-hidden lg:rounded-xl">
            <img src={`/lesson-assets/appointment-setting/${difficulty === "medium" ? "david" : "mark"}.png`} alt={`${prospectName}, the practice client with thinning hair`} className="h-[60%] w-full object-cover object-top lg:h-full lg:object-center" />
            <div aria-hidden="true" className="absolute inset-x-0 top-[45%] h-[25%] bg-gradient-to-b from-transparent to-[#101115] lg:hidden" />
          </div>
          <figcaption className="absolute left-1/2 top-[43%] z-10 -translate-x-1/2 rounded-xl border border-[#d4a944]/65 bg-[#111317]/90 px-6 py-2 text-center shadow-lg backdrop-blur-sm lg:bottom-9 lg:top-auto">
            <span className="block text-xl font-bold text-white">{prospectName}</span>
            <span className="block whitespace-nowrap text-xs text-[#d6d0c6]">Practice client</span>
          </figcaption>
        </figure>

        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col bg-gradient-to-b from-transparent via-[#0b0c0f]/90 to-[#0b0c0f] px-4 pb-5 pt-20 text-center sm:px-6 lg:static lg:rounded-2xl lg:border lg:border-white/15 lg:bg-[#101115] lg:bg-none lg:p-6">
          <div className="rounded-xl border border-white/25 bg-[#141519]/80 px-4 py-3 text-left backdrop-blur-sm lg:border-white/15 lg:bg-[#141519] lg:py-4 lg:backdrop-blur-none">
            <div className="flex items-start gap-3"><Target className="mt-0.5 h-5 w-5 shrink-0 text-[#f2bf50]" /><div><h3 className="font-semibold text-[#f2bf50]">Your goal</h3><p className="mt-1 text-sm leading-relaxed text-[#f8f2e9]">Understand his concern and invite him to a consultation.</p></div></div>
          </div>
          <div aria-hidden="true" className="mt-4 flex h-12 items-center justify-center gap-1 lg:mt-6 lg:h-14">
            {bars.map((height, index) => <span key={index} className={`w-1 rounded-full bg-[#e5b748] ${callState === "speaking" ? "animate-pulse" : ""}`} style={{ height }} />)}
          </div>
          <p role="status" className="mx-auto mt-2 rounded-full border border-[#d4a944]/40 bg-[#27261d]/90 px-4 py-1.5 text-sm text-[#f8f2e9] lg:mt-3">{status}</p>
          <button type="button" onClick={toggleMicrophone} disabled={callState === "connecting" || callState === "ringing" || callState === "saving" || callState === "save_failed"} aria-label={callState === "idle" ? "Start voice practice" : muted ? "Unmute microphone" : "Mute microphone"} className="mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#f8d176] bg-gradient-to-br from-[#f7cf67] to-[#bd8325] text-[#17110a] shadow-[0_0_35px_rgba(212,169,68,0.25)] transition hover:scale-105 disabled:cursor-wait disabled:opacity-60 lg:mt-5">
            {muted ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
          </button>
          <p className="mt-2 font-semibold text-[#f8f2e9]">{callState === "idle" ? "Speak to client" : callState === "saving" ? "Saving" : callState === "save_failed" ? "Save needed" : muted ? "Tap to unmute" : "Tap to mute"}</p>
          <div className="mt-4 border-t border-white/15 pt-4 lg:mt-5 lg:pt-5">
            <p id="practice-difficulty-label" className="font-semibold text-[#f8f2e9]">Difficulty</p>
            <div role="group" aria-labelledby="practice-difficulty-label" className="mt-3 grid grid-cols-3 gap-2">
              {levels.map(level => <button key={level.value} type="button" disabled={callState !== "idle"} aria-pressed={difficulty === level.value} onClick={() => setDifficulty(level.value)} className={`rounded-lg border px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${difficulty === level.value ? "border-[#f2bf50] bg-[#e5b748] text-[#17110a]" : "border-[#d4a944]/70 text-[#f8f2e9] hover:bg-[#d4a944]/15"}`}>{level.label}</button>)}
            </div>
          </div>
          {callState === "idle" ? <button type="button" onClick={() => void startPractice()} className="mt-5 hidden rounded-lg bg-[#e5b748] px-5 py-3 font-semibold text-[#17110a] transition hover:bg-[#f3cc73] lg:block">Start practice</button>
            : callState === "save_failed" ? <button type="button" onClick={() => { setCallState("saving"); void finishSavedCall().then(saved => setCallState(saved ? "idle" : "save_failed")); }} className="mt-4 rounded-lg bg-[#e5b748] px-5 py-3 font-semibold text-[#17110a]">Retry saving transcript</button>
            : callState === "saving" ? null
            : <button type="button" onClick={requestEndPractice} className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[#d4a944]/70 bg-[#101115]/70 px-5 py-3 font-semibold text-[#f8f2e9] transition hover:bg-[#d4a944]/15 lg:mt-5"><PhoneOff className="h-4 w-4" /> End practice</button>}
          <p className="mt-3 text-xs leading-relaxed text-[#c2b9a9] lg:text-[#9d968c]">This is a practice call. No real appointment is booked.</p>
          {error && <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-950/30 p-3 text-left text-sm text-red-200">{error}</p>}
          {saveError && <p role="alert" className="mt-3 rounded-lg border border-red-400/40 bg-red-950/30 p-3 text-left text-sm text-red-200">{saveError}</p>}
        </div>
      </div>
      <PracticeCallHistory calls={history} selectedId={selectedCallId} onSelect={setSelectedCallId} onRefresh={() => void refreshHistory()} error={historyError} />
    </section>
  );
}
