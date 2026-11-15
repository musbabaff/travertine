"use client";

import { useEffect, useRef, useState } from "react";

/** Follows the language toggle (html lang is set by the i18n provider). */
const speechLang = () => (typeof document !== "undefined" && document.documentElement.lang === "tr" ? "tr-TR" : "en-GB");

type TranscriptEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>;
};

type RecognitionError = { error: string };

type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: TranscriptEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

type VoiceWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition;
  webkitSpeechRecognition?: new () => BrowserRecognition;
};

const errors: Record<string, string> = {
  "not-allowed": "cosmo.speech.notAllowed",
  "audio-capture": "cosmo.speech.audioCapture",
  "no-speech": "cosmo.speech.noSpeech",
  network: "cosmo.speech.network",
};

type BraveNavigator = Navigator & { brave?: unknown };
const NOTE_SEEN = "cosmo-voice-note-seen";

/**
 * Speech recognition that can work here. Firefox has no SpeechRecognition; Brave exposes webkitSpeechRecognition but
 * blocks the Google service behind it, so every attempt ends in a network error. Both count as unsupported.
 */
export function voiceInputSupported(w: Window): boolean {
  const vw = w as VoiceWindow;
  if ((w.navigator as BraveNavigator).brave !== undefined) return false;
  return Boolean(vw.SpeechRecognition || vw.webkitSpeechRecognition);
}

export function useCosmoSpeech(onTranscript: (text: string) => void) {
  const receiver = useRef(onTranscript);

  useEffect(() => {
    receiver.current = onTranscript;
  }, [onTranscript]);

  const recognition = useRef<BrowserRecognition | null>(null);
  const listenTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const spokenReply = useRef(false);
  const handled = useRef(false);
  const failed = useRef(false);
  const [inputSupported, setInputSupported] = useState(false);
  const [outputSupported, setOutputSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [showUnsupportedNote, setShowUnsupportedNote] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const supported = voiceInputSupported(window);
      setInputSupported(supported);
      if (!supported) {
        try {
          setShowUnsupportedNote(localStorage.getItem(NOTE_SEEN) !== "1");
          localStorage.setItem(NOTE_SEEN, "1");
        } catch {
          setShowUnsupportedNote(true);
        }
      }
      setOutputSupported("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(listenTimer.current);
      recognition.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function stopListening() {
    clearTimeout(listenTimer.current);
    const current = recognition.current;
    recognition.current = null;
    current?.abort();
    setListening(false);
  }

  function stop() {
    stopListening();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setTranscript("");
    setError("");
  }

  function toggleListening() {
    if (listening) {
      stopListening();
      return;
    }

    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("cosmo.speech.unsupported");
      return;
    }

    stop();
    setError("");
    setTranscript("");
    setEnabled(outputSupported);
    spokenReply.current = outputSupported;
    handled.current = false;
    failed.current = false;

    const session = new Recognition();
    session.lang = speechLang();
    session.continuous = false;
    session.interimResults = true;
    session.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const heard = event.results[index][0].transcript.trim();
        setTranscript(heard);
        if (event.results[index].isFinal && heard && !handled.current) {
          clearTimeout(listenTimer.current);
          handled.current = true;
          receiver.current(heard);
        }
      }
    };
    session.onerror = (event) => {
      if (event.error === "aborted" || recognition.current !== session) return;
      clearTimeout(listenTimer.current);
      failed.current = true;
      setError(errors[event.error] ?? "cosmo.speech.generic");
      setListening(false);
    };
    session.onend = () => {
      if (recognition.current !== session) return;
      clearTimeout(listenTimer.current);
      if (!handled.current && !failed.current) setError("cosmo.speech.notHeard");
      setListening(false);
      recognition.current = null;
    };

    recognition.current = session;
    try {
      session.start();
      setListening(true);
      listenTimer.current = setTimeout(() => {
        if (recognition.current !== session || handled.current) return;
        setError("cosmo.speech.noneDetected");
        stopListening();
      }, 12000);
    } catch {
      recognition.current = null;
      setError("cosmo.speech.startFailed");
    }
  }

  function speak(text: string) {
    if (!spokenReply.current || !outputSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/\n/g, " "));
    utterance.lang = speechLang();
    utterance.rate = 0.96;
    utterance.pitch = 0.96;
    utterance.voice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith(speechLang().slice(0, 2))) ?? null;
    utterance.onstart = () => { setError(""); setSpeaking(true); };
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setError("cosmo.speech.playFailed"); };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  }

  function toggleOutput() {
    const next = !spokenReply.current;
    spokenReply.current = next;
    setEnabled(next);
    if (!next) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
  }

  return { inputSupported, showUnsupportedNote, outputSupported, listening, speaking, enabled, transcript, error, toggleListening, toggleOutput, speak, stop, clearTranscript: () => setTranscript("") };
}
