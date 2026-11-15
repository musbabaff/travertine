"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import type { CosmoPose } from "./mascot";
import { askCosmo, greeting, startersFor, type CosmoLink } from "./brain";
import { COSMO_ASK, useGaze } from "./gaze";
import { useCosmoSpeech } from "./speech";
import CosmoStage from "./stage";
import { COSMO_INTRO } from "./intro";

type Message = { id: number; from: "cosmo" | "user"; text: string; links?: CosmoLink[] };
type Delivery = { id: number; words: string[] };

const NUDGE_SEEN = "cosmo-nudge-seen";

export default function CosmoAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "cosmo", text: greeting }]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pose, setPose] = useState<CosmoPose>("idle");
  const [nudge, setNudge] = useState(false);
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  const dock = useGaze<HTMLDivElement>();
  const chat = useRef<HTMLElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const mouth = useRef<HTMLSpanElement>(null);
  const trail = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const nextId = useRef(1);
  const wasOpen = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const replyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const poseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deliveryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Olay dinleyicisi bir kez bağlanıyor; güncel yol ve durum buradan okunur.
  const live = useRef({ pathname, thinking });
  live.current = { pathname, thinking };
  const speech = useCosmoSpeech(send);

  function strike(next: CosmoPose, holdMs?: number) {
    clearTimeout(poseTimer.current);
    setPose(next);
    if (holdMs) poseTimer.current = setTimeout(() => setPose("idle"), holdMs);
  }

  function show() {
    setOpen(true);
    setNudge(false);
    strike("wave", 1800);
  }

  function dismiss() {
    speech.stop();
    setDelivery(null);
    setOpen(false);
  }

  function send(raw: string) {
    const question = raw.trim();
    if (!question || live.current.thinking) return;
    setMessages((list) => [...list, { id: nextId.current++, from: "user", text: question }]);
    setDraft("");
    setThinking(true);
    setDelivery(null);
    strike("think");

    const reply = askCosmo(question, live.current.pathname);
    replyTimer.current = setTimeout(
      () => {
        const answerId = nextId.current++;
        setThinking(false);
        setMessages((list) => [...list, { id: answerId, from: "cosmo", text: reply.text, links: reply.links }]);
        setDelivery({ id: answerId, words: reply.text.match(/\S+/g)?.slice(0, 5) ?? [] });
        clearTimeout(deliveryTimer.current);
        deliveryTimer.current = setTimeout(() => setDelivery(null), 1200);
        const settle = reply.pose === "sleep" ? undefined : reply.pose === "jump" ? 950 : 2400;
        strike(reply.pose ?? "idle", reply.pose ? settle : undefined);
        if (openRef.current) speech.speak(reply.text);
        speech.clearTranscript();
      },
      520 + Math.min(reply.text.length * 6, 700),
    );
  }

  useEffect(() => {
    function summoned(event: Event) {
      show();
      const question = (event as CustomEvent<string | undefined>).detail;
      if (question) send(question);
    }
    window.addEventListener(COSMO_ASK, summoned);

    let seen = true;
    try {
      seen = sessionStorage.getItem(NUDGE_SEEN) === "1";
      sessionStorage.setItem(NUDGE_SEEN, "1");
    } catch {}
    const nudgeTimer = seen ? undefined : setTimeout(() => setNudge(true), 3500);

    return () => {
      window.removeEventListener(COSMO_ASK, summoned);
      clearTimeout(nudgeTimer);
      clearTimeout(replyTimer.current);
      clearTimeout(poseTimer.current);
      clearTimeout(deliveryTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) fab.current?.focus();
      return;
    }
    wasOpen.current = true;
    input.current?.focus({ preventScroll: true });
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: delivery ? "auto" : "smooth" });
  }, [messages, thinking, open, delivery]);

  useLayoutEffect(() => {
    if (!delivery || !chat.current || !mouth.current || !trail.current) return;
    const destination = chat.current.querySelector<HTMLElement>(`[data-message-id="${delivery.id}"]`);
    if (!destination) return;

    if (log.current) log.current.scrollTop = log.current.scrollHeight;
    const chatBounds = chat.current.getBoundingClientRect();
    const mouthBounds = mouth.current.getBoundingClientRect();
    const bubbleBounds = destination.getBoundingClientRect();
    const startX = mouthBounds.left + mouthBounds.width / 2 - chatBounds.left;
    const startY = mouthBounds.top + mouthBounds.height / 2 - chatBounds.top;
    const endX = bubbleBounds.left + Math.min(bubbleBounds.width / 2, 90) - chatBounds.left;
    const endY = bubbleBounds.top + Math.min(bubbleBounds.height / 2, 24) - chatBounds.top;

    trail.current.style.left = `${startX}px`;
    trail.current.style.top = `${startY}px`;
    trail.current.style.setProperty("--flight-x", `${endX - startX}px`);
    trail.current.style.setProperty("--flight-y", `${endY - startY}px`);
  }, [delivery]);

  return (
    <div className="cosmo-dock" ref={dock}>
      {open && (
        <section className="cosmo-chat" ref={chat} role="dialog" aria-label="Cosmo ile sohbet">
          <header>
            <div>
              <strong>Cosmo</strong>
              <small>{speech.listening ? "Seni dinliyor" : thinking ? "Yanıtı hazırlıyor" : speech.speaking ? "Sesli yanıtlıyor" : "Travertine asistanı"}</small>
            </div>
            <button
              className="cosmo-audio-toggle"
              aria-label={speech.enabled ? "Sesli yanıtları kapat" : "Sesli yanıtları aç"}
              aria-pressed={speech.enabled}
              disabled={!speech.outputSupported}
              title={speech.outputSupported ? undefined : "Sesli yanıt bu tarayıcıda kullanılamıyor"}
              onClick={speech.toggleOutput}
            >
              {speech.enabled ? <Volume2 /> : <VolumeX />}
            </button>
            <button aria-label="Sohbeti kapat" onClick={dismiss}>
              <X />
            </button>
          </header>

          <div className={`cosmo-presence${speech.listening ? " is-listening" : ""}${thinking ? " is-thinking" : ""}${speech.speaking ? " is-speaking" : ""}`} aria-hidden="true">
            {(speech.listening || speech.speaking) && (
              <div className="cosmo-presence-waves">
                {Array.from({ length: 21 }, (_, position) => <i key={position} style={{ animationDelay: `${-position * 65}ms`, height: `${8 + (position * 11) % 31}px` }} />)}
              </div>
            )}
            <div className="cosmo-presence-mascot">
              <CosmoStage view="bust" pose={pose} listening={speech.listening} talking={speech.speaking || Boolean(delivery)} />
              <span className="cosmo-mouth-anchor" ref={mouth} />
            </div>
            {thinking && <span className="cosmo-thought">?</span>}
            <span className="cosmo-presence-label">{speech.listening ? "DİNLİYOR" : thinking ? "DÜŞÜNÜYOR" : speech.speaking ? "KONUŞUYOR" : "BURADAYIM"}</span>
          </div>

          <div className="cosmo-log" ref={log} role="log" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} data-message-id={message.id} className={`cosmo-msg from-${message.from}${delivery?.id === message.id ? " is-arriving" : ""}`}>
                <p>{message.text}</p>
                {message.links && (
                  <div className="cosmo-msg-links">
                    {message.links.map((link) => (
                      <Link key={link.href} href={link.href}>
                        {link.label}
                        <ArrowUpRight size={14} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {thinking && <p className="cosmo-thinking-note" role="status">Cosmo yanıtı hazırlıyor</p>}
          </div>

          <div className="cosmo-starters">
            <button onClick={() => { dismiss(); window.dispatchEvent(new Event(COSMO_INTRO)); }}>Sistemi tanıt</button>
            {startersFor(pathname).map((question) => (
              <button key={question} disabled={thinking} onClick={() => send(question)}>
                {question}
              </button>
            ))}
          </div>

          {(speech.listening || speech.speaking || speech.error || speech.transcript || !speech.inputSupported) && (
            <div className={`cosmo-voice-status${speech.listening ? " is-listening" : ""}${speech.speaking ? " is-speaking" : ""}`} role="status" aria-live="polite">
              {(speech.listening || speech.speaking) && (
                <span className="cosmo-voice-wave" aria-hidden="true">
                  {Array.from({ length: 19 }, (_, index) => <i key={index} style={{ height: `${8 + (index * 7) % 16}px`, animationDelay: `${-index * 47}ms` }} />)}
                </span>
              )}
              <span>
                {speech.error ||
                  (speech.listening ? (speech.transcript || "Dinliyorum… Konuşmaya başlayabilirsin.") :
                    speech.speaking ? "Cosmo sesli yanıtlıyor…" :
                    speech.transcript ? `Duyduğum: ${speech.transcript}` :
                    "Sesli giriş bu tarayıcıda kullanılamıyor; metin yazarak devam edebilirsin.")}
              </span>
            </div>
          )}

          <form
            className="cosmo-compose"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <input
              ref={input}
              value={draft}
              maxLength={160}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Cosmo'ya sor"
              aria-label="Cosmo'ya soru"
            />
            <button
              type="button"
              className={`cosmo-mic${speech.listening ? " is-listening" : ""}`}
              aria-label={speech.listening ? "Dinlemeyi durdur" : "Sesli soru sor"}
              aria-pressed={speech.listening}
              disabled={!speech.inputSupported || thinking}
              onClick={speech.toggleListening}
            >
              {speech.listening ? <MicOff /> : <Mic />}
            </button>
            <button type="submit" aria-label="Gönder" disabled={thinking || !draft.trim()}>
              <ArrowUp />
            </button>
          </form>
          {delivery && (
            <div className="cosmo-word-trail" ref={trail} aria-hidden="true">
              {delivery.words.map((word, index) => <span key={`${delivery.id}-${index}`} style={{ animationDelay: `${index * 90}ms` }}>{word}</span>)}
            </div>
          )}
        </section>
      )}

      {!open && nudge && (
        <div className="cosmo-nudge">
          <button onClick={show}>Takıldığın bir ekran olursa bana sor.</button>
          <button aria-label="Kapat" onClick={() => setNudge(false)}>
            <X />
          </button>
        </div>
      )}

      {!open && (
        <button className="cosmo-fab" ref={fab} aria-label="Cosmo'ya sor" onClick={show}>
          <CosmoStage pose={pose} />
        </button>
      )}
    </div>
  );
}
