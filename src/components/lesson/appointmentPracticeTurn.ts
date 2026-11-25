export function isBriefAcknowledgment(transcript: string): boolean {
  const words = transcript.toLowerCase().replace(/[^a-z\s]/g, " ").trim().split(/\s+/);
  return words.length > 0 && words.every(word => ["uh", "um", "hmm", "mm", "mhm", "okay", "ok", "got", "it", "yeah", "yep", "right", "sure", "alright"].includes(word));
}

export function offersConsultation(transcript: string): boolean {
  const text = transcript.toLowerCase().replace(/\s+/g, " ");
  return /\b(?:can|could|would) you (?:come in|stop by|come by|meet|make it|do a consultation)\b/.test(text)
    || /\b(?:would you like to|are you open to|do you want to) (?:come in|stop by|come by|meet|schedule|book)\b/.test(text)
    || /\b(?:get|bring) you in\b/.test(text)
    || /\bhave you (?:come|stop) in\b/.test(text)
    || /\b(?:book|schedule|set up|hold) (?:you|a|your|the)\b/.test(text)
    || /\b(?:i|we) (?:have|can offer|could offer) (?:an? |some )?(?:opening|slot|availability|time)\b/.test(text)
    || /\b(?:would|does|could) (?:maybe )?(?:this |next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|\[[^\]]+\])\b.{0,60}\bwork(?: for you)?\b/.test(text)
    || /\b(?:how about|i have|we have) (?:this |next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)\b/.test(text)
    || /\b(?:do|would) (?:mornings?|afternoons?) or (?:mornings?|afternoons?) work better\b/.test(text)
    || /\b(?:what|which) (?:day|time|part of the day) (?:would |usually )?(?:work|be better|be good)\b/.test(text);
}
