/** Browser voice helpers for Maple assistant */

export type SpeechRecognitionCtor = new () => SpeechRecognition;

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition,
  );
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = "en-CA";
  rec.maxAlternatives = 1;
  return rec;
}

let speakToken = 0;

export function speakMaple(text: string, onEnd?: () => void): () => void {
  if (!speechSynthesisSupported()) return () => undefined;

  const token = ++speakToken;
  window.speechSynthesis.cancel();

  const spoken = text
    .replace(/\n+/g, ". ")
    .replace(/\s*•\s*/g, ", ")
    .replace(/\s*◦\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const utter = new SpeechSynthesisUtterance(spoken);
  utter.lang = "en-CA";
  utter.rate = 1;
  utter.pitch = 1;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /en-CA|en-US|Google UK English Female/i.test(v.name));
  if (preferred) utter.voice = preferred;

  utter.onend = () => {
    if (token === speakToken) onEnd?.();
  };

  window.speechSynthesis.speak(utter);

  return () => {
    if (token === speakToken) window.speechSynthesis.cancel();
  };
}

export function stopSpeaking(): void {
  speakToken++;
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}
