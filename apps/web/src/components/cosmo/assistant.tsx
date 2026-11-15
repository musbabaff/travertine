"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import type { CosmoPose } from "./mascot";
import { useQueryClient, type Query } from "@tanstack/react-query";
import { useI18n, type MessageKey, type Vars } from "@/i18n";
import type { Crop, Provenance, RotationExploreResponse } from "@/lib/api/types";
import { cropLabel } from "@/lib/localize-engine";
import { parseField } from "@/lib/url-state";
import { useHazards } from "@/features/field/use-hazards";
import { askField, fieldStarters, type FieldContext } from "./field-answers";

/** The engine responses Cosmo may quote, trimmed to what an answer needs. */
function compactContext(ctx: FieldContext | null) {
  if (!ctx) return {};
  const r = ctx.rotations;
  return {
    rotations: r?.rotations.slice(0, 3).map((x) => ({ sequence: x.sequence, scores: x.scores, yearly: x.yearly, explanation: x.explanation, reasoning: x.reasoning, vs_baseline: x.vs_baseline })),
    current_rotation: r?.baseline ? { sequence: r.baseline.sequence, scores: r.baseline.scores, yearly: r.baseline.yearly, rule_violations: r.baseline.rule_violations } : undefined,
    scenario: r?.scenario,
    validation: ctx.validation
      ? { correlation: ctx.validation.correlation, correlation_ci95: ctx.validation.correlation_ci95, n: ctx.validation.n, baseline: ctx.validation.baseline && { name: ctx.validation.baseline.name, correlation: ctx.validation.baseline.correlation, correlation_ci95: ctx.validation.baseline.correlation_ci95 }, difference_ci95: ctx.validation.difference_ci95, verdict: ctx.validation.verdict, caveats: ctx.validation.caveats }
      : undefined,
    hazards: ctx.hazards ? { median: ctx.hazards.median, years: ctx.hazards.years.length, caveats: ctx.hazards.caveats } : undefined,
    datasets: [...new Set((ctx.provenance ?? []).map((p) => p.dataset))],
  };
}
import { askCosmo, GREETING, startersFor, type CosmoLink } from "./brain";
import { COSMO_ASK, COSMO_PENDING, useGaze } from "./gaze";
import { useCosmoSpeech } from "./speech";
import CosmoStage from "./stage";
import { COSMO_INTRO } from "./intro";

/**
 * Cosmo messages hold a locale key with its values (shown in the current language) and, for answers about the field,
 * the engine's own sentences; user messages hold the typed text.
 */
type Message = { id: number; from: "cosmo" | "user"; text: string; vars?: Vars; lines?: string[]; links?: CosmoLink[]; generated?: boolean };
type Delivery = { id: number; words: string[] };

const NUDGE_SEEN = "cosmo-nudge-seen";

export default function CosmoAssistant() {
  const { t, n, locale } = useI18n();
  const tRef = useRef(t);
  useLayoutEffect(() => {
    tRef.current = t;
  }, [t]);
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const field = parseField(new URLSearchParams(query));
  const queries = useQueryClient();
  const [open, setOpen] = useState(false);
  const hazards = useHazards(field, open);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "cosmo", text: GREETING }]);
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
  const replyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const poseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const deliveryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** The engine responses already loaded for the field in the URL, newest first. */
  function fieldContext(): FieldContext | null {
    if (!field) return null;
    const forField = (q: Query) => q.queryKey[1] === field.lat && q.queryKey[2] === field.lon && q.state.data !== undefined;
    const loaded = queries
      .getQueryCache()
      .findAll()
      .filter(forField)
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
    const unwrapData = (q: Query | undefined) => {
      const d = q?.state.data as { data?: unknown } | undefined;
      return d && typeof d === "object" && "fromFixture" in d ? d.data : d;
    };
    const rotations = unwrapData(loaded.find((q) => q.queryKey[0] === "rotations" && q.queryKey.at(-1) === locale)) as RotationExploreResponse | undefined;
    const validation = unwrapData(loaded.find((q) => q.queryKey[0] === "validation")) as FieldContext["validation"];
    const provenance = loaded.flatMap((q) => ((unwrapData(q) as { provenance?: Provenance[] } | undefined)?.provenance ?? []));
    const crops = new Map((queries.getQueryData<Crop[]>(["crops"]) ?? []).map((c) => [c.id, c.name]));
    return {
      rotations,
      validation,
      hazards: hazards.data && !hazards.data.fromFixture ? hazards.data.data : undefined,
      provenance,
      cropName: (id) => cropLabel(id, crops.get(id) ?? id.replace(/_/g, " "), locale),
      n,
    };
  }

  // Olay dinleyicisi bir kez bağlanıyor; güncel yol ve durum buradan okunur.
  const live = useRef({ pathname, thinking, fieldContext, locale });
  const speech = useCosmoSpeech(send);

  useLayoutEffect(() => {
    openRef.current = open;
    live.current = { pathname, thinking, fieldContext, locale };
  });

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

    const ctx = live.current.fieldContext();
    const fixed: { text: MessageKey; vars?: Vars; lines?: string[]; links?: CosmoLink[]; pose?: CosmoPose } =
      (ctx && askField(question, ctx)) ?? askCosmo(question, live.current.pathname);
    const deliver = (generated: string | null) => {
        const answerId = nextId.current++;
        setThinking(false);
        const reply = generated ? { ...fixed, text: "cosmo.ui.generated" as MessageKey, vars: undefined, lines: undefined } : fixed;
        setMessages((list) => [
          ...list,
          generated
            ? { id: answerId, from: "cosmo", text: generated, links: fixed.links, generated: true }
            : { id: answerId, from: "cosmo", text: reply.text, vars: reply.vars, lines: reply.lines, links: reply.links },
        ]);
        const said = generated ?? [tRef.current(reply.text, reply.vars), ...(reply.lines ?? [])].join(" ");
        setDelivery({ id: answerId, words: said.match(/\S+/g)?.slice(0, 5) ?? [] });
        clearTimeout(deliveryTimer.current);
        deliveryTimer.current = setTimeout(() => setDelivery(null), 1200);
        const settle = reply.pose === "sleep" ? undefined : reply.pose === "jump" ? 950 : 2400;
        strike(reply.pose ?? "idle", reply.pose ? settle : undefined);
        if (openRef.current) speech.speak(said);
        speech.clearTranscript();
    };
    const started = Date.now();
    fetch("/api/cosmo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, language: live.current.locale, page: live.current.pathname, context: compactContext(ctx) }),
      signal: AbortSignal.timeout(16_000),
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ text?: string }>) : null))
      .catch(() => null)
      .then((d) => {
        const wait = Math.max(0, 520 - (Date.now() - started));
        replyTimer.current = setTimeout(() => deliver(d?.text ?? null), wait);
      });
  }

  useEffect(() => {
    function summoned(event: Event) {
      delete (window as unknown as Record<string, unknown>)[COSMO_PENDING];
      show();
      const question = (event as CustomEvent<string | undefined>).detail;
      if (question) send(question);
    }
    window.addEventListener(COSMO_ASK, summoned);
    const pending = (window as unknown as Record<string, unknown>)[COSMO_PENDING];
    if (pending) summoned(new CustomEvent(COSMO_ASK, { detail: typeof pending === "string" ? pending : undefined }));

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
    // Bu dinleyici bileşen ömrü boyunca tek kez bağlanır; güncel değerleri ref'lerden okur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Kapatma işlevi güncel ses oturumunu kullanır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <section className="cosmo-chat" ref={chat} role="dialog" aria-label={t("cosmo.ui.chat")}>
          <header>
            <div>
              <strong>Cosmo</strong>
              <small>{speech.listening ? t("cosmo.ui.listening") : thinking ? t("cosmo.ui.thinking") : speech.speaking ? t("cosmo.ui.speaking") : t("cosmo.ui.role")}</small>
            </div>
            <button
              className="cosmo-audio-toggle"
              aria-label={speech.enabled ? t("cosmo.ui.voiceOff") : t("cosmo.ui.voiceOn")}
              aria-pressed={speech.enabled}
              disabled={!speech.outputSupported}
              title={speech.outputSupported ? undefined : t("cosmo.ui.voiceUnsupported")}
              onClick={speech.toggleOutput}
            >
              {speech.enabled ? <Volume2 /> : <VolumeX />}
            </button>
            <button aria-label={t("cosmo.ui.closeChat")} onClick={dismiss}>
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
            <span className="cosmo-presence-label">{speech.listening ? t("cosmo.ui.tagListening") : thinking ? t("cosmo.ui.tagThinking") : speech.speaking ? t("cosmo.ui.tagSpeaking") : t("cosmo.ui.tagHere")}</span>
          </div>

          <div className="cosmo-log" ref={log} role="log" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} data-message-id={message.id} className={`cosmo-msg from-${message.from}${delivery?.id === message.id ? " is-arriving" : ""}`}>
                <p>{message.from === "cosmo" && !message.generated ? t(message.text as MessageKey, message.vars) : message.text}</p>
                {message.generated && <small className="cosmo-msg-generated">{t("cosmo.ui.generated")}</small>}
                {message.lines && message.lines.length > 0 && (
                  <ul className="cosmo-msg-lines">
                    {message.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {message.links && (
                  <div className="cosmo-msg-links">
                    {message.links.map((link) => (
                      <Link key={link.href} href={query ? `${link.href}?${query}` : link.href}>
                        {t(link.label)}
                        <ArrowUpRight size={14} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {thinking && <p className="cosmo-thinking-note" role="status">{t("cosmo.ui.preparing")}</p>}
          </div>

          <div className="cosmo-starters">
            <button onClick={() => { dismiss(); window.dispatchEvent(new Event(COSMO_INTRO)); }}>{t("cosmo.ui.tour")}</button>
            {[...fieldStarters(pathname, !!field), ...startersFor(pathname)].slice(0, 5).map((question) => (
              <button key={question} disabled={thinking} onClick={() => send(t(question))}>
                {t(question)}
              </button>
            ))}
          </div>

          {!speech.inputSupported && speech.showUnsupportedNote && <p className="cosmo-voice-note">{t("cosmo.ui.noMic")}</p>}
          {(speech.listening || speech.speaking || speech.error || speech.transcript) && (
            <div className={`cosmo-voice-status${speech.listening ? " is-listening" : ""}${speech.speaking ? " is-speaking" : ""}`} role="status" aria-live="polite">
              {(speech.listening || speech.speaking) && (
                <span className="cosmo-voice-wave" aria-hidden="true">
                  {Array.from({ length: 19 }, (_, index) => <i key={index} style={{ height: `${8 + (index * 7) % 16}px`, animationDelay: `${-index * 47}ms` }} />)}
                </span>
              )}
              <span>
                {(speech.error && t(speech.error as MessageKey)) ||
                  (speech.listening ? (speech.transcript || t("cosmo.ui.listeningHint")) :
                    speech.speaking ? t("cosmo.ui.speakingHint") :
                    speech.transcript ? t("cosmo.ui.heard", { text: speech.transcript }) : "")}
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
              placeholder={t("cosmo.ui.ask")}
              aria-label={t("cosmo.ui.question")}
            />
            {speech.inputSupported && (
              <button
                type="button"
                className={`cosmo-mic${speech.listening ? " is-listening" : ""}`}
                aria-label={speech.listening ? t("cosmo.ui.micStop") : t("cosmo.ui.micStart")}
                aria-pressed={speech.listening}
                disabled={thinking}
                onClick={speech.toggleListening}
              >
                {speech.listening ? <MicOff /> : <Mic />}
              </button>
            )}
            <button type="submit" aria-label={t("cosmo.ui.send")} disabled={thinking || !draft.trim()}>
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
          <button onClick={show}>{t("cosmo.ui.nudge")}</button>
          <button aria-label={t("cosmo.ui.close")} onClick={() => setNudge(false)}>
            <X />
          </button>
        </div>
      )}

      {!open && (
        <button className="cosmo-fab" ref={fab} onClick={show}>
          <span className="sr-only">{t("cosmo.ui.ask")}</span>
          <span aria-hidden="true" className="contents [&_text]:hidden">
            <CosmoStage view="full" pose={pose} />
          </span>
        </button>
      )}
    </div>
  );
}
