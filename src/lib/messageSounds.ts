// Lightweight WebAudio chimes for the private support chat.
// Mobile browsers block audio that starts outside a user gesture, so
// primeMessageSounds() must be called from a real tap/keypress first.

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return audioContext;
}

export function primeMessageSounds() {
  const context = getContext();
  if (context && context.state === 'suspended') {
    context.resume().catch(() => undefined);
  }
}

function playTone(frequency: number, duration: number, volume: number) {
  const context = getContext();
  if (!context || context.state !== 'running') return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  } catch {
    // Audio is a nicety; never let it break messaging.
  }
}

export function playMessageSentSound() {
  playTone(660, 0.12, 0.05);
}

export function playMessageReceivedSound() {
  playTone(440, 0.16, 0.05);
}
