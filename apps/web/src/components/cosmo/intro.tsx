"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Turun konumu ve konuşma animasyonu DOM ölçümünden sonra eşitlenir. */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, MousePointer2, X } from "lucide-react";
import type { CosmoPose } from "./mascot";
import CosmoStage from "./stage";
import { summonCosmo } from "./gaze";

export const COSMO_INTRO = "cosmo:intro";
const SEEN_KEY = "travertine-cosmo-intro-v4";

// `step`, Cosmo'nun en son hangi adım için yerine vardığını tutar; yürürken -1'dir.
type Guide = { x: number; y: number; ms: number; walking: boolean; facing: number; step: number };
// Cosmo'nun söylediği cümle: kelimeler ağzından çıkıp balondaki yerine oturur.
type Speech = { id: number; words: string[]; left: number; top: number; mouthX: number; mouthY: number };
const WORD_MS = 75;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

type TourStep = {
  title: string;
  text: string;
  pose: CosmoPose;
  target?: string;
  route?: string;
  clickSelector?: string;
  action: string;
};

const steps: TourStep[] = [
  {
    title: "Merhaba, ben Cosmo!",
    text: "Travertine sistemine hoş geldiniz. Size gerçek tarla verilerinin ve ekim önerilerinin nerede olduğunu göstereceğim.",
    pose: "wave",
    action: "Tanıtıma başla",
  },
  {
    title: "Genel Bakış",
    text: "Burada seçili tarlanın iklim, toprak ve su bilgilerini tek bakışta görürsünüz. Örnek tarla etiketine de dikkat edin.",
    pose: "point",
    target: ".tv-dashboard-grid",
    route: "/",
    action: "İklimi incele",
  },
  {
    title: "İklim geçmişi",
    text: "Bu değer bugünün havası değil, seçili konumdaki yılların ortalama sıcaklığıdır. Kaynağı canlı motor veya örnek veri etiketi gösterir.",
    pose: "point",
    target: ".tv-climate",
    route: "/",
    action: "Toprağa geç",
  },
  {
    title: "Tarla sağlığı",
    text: "NDVI bitki örtüsünü, yanındaki ölçüler toprak yapısını ve pH değerini özetler. Ayrıntılı analiz tarla ekranında.",
    pose: "point",
    target: ".tv-soil",
    route: "/",
    action: "Su dengesini gör",
  },
  {
    title: "Su dengesi",
    text: "Yıllık yağış ile bitkinin su talebini anlamak için kullanılan buharlaşma değerini burada karşılaştırabilirsiniz.",
    pose: "point",
    target: ".tv-water",
    route: "/",
    action: "Tarla görünümüne geç",
  },
  {
    title: "Tarla görünümü",
    text: "Görselin üstündeki değerler seçili tarlanın analizinden gelir. Haritayı açarak konumu değiştirebilirsiniz.",
    pose: "point",
    target: ".tv-field-hero",
    route: "/",
    action: "Tarla İzleme'yi aç",
  },
  {
    title: "Tarla İzleme",
    text: "Şimdi buraya tıklayıp haritada tarla seçmeyi göstereceğim.",
    pose: "point",
    target: '[data-cosmo-tour="field-nav"]',
    route: "/",
    clickSelector: '[data-cosmo-tour="field-nav"]',
    action: "Haritaya geç",
  },
  {
    title: "Harita",
    text: "Yer arayabilir, bir nokta koyabilir veya tarla sınırı çizebilirsiniz. Konum adres çubuğunda saklanır ve paylaşılabilir.",
    pose: "point",
    target: '[data-testid="field-map"]',
    route: "/app",
    action: "Örnek tarla ile dene",
  },
  {
    title: "Örnek tarlayı seçelim",
    text: "Cosmo şimdi örnek konumu seçiyor. Gerçek tarlanızı daha sonra aynı yerden değiştirebilirsiniz.",
    pose: "point",
    target: '[data-cosmo-tour="demo-field"]',
    route: "/app",
    clickSelector: '[data-cosmo-tour="demo-field"]',
    action: "Örnek tarlayı seç",
  },
  {
    title: "Tarla özeti",
    text: "İklim geçmişi, toprak özellikleri ve bitki örtüsü burada veri kaynaklarıyla birlikte gösterilir.",
    pose: "point",
    target: "#main",
    route: "/app",
    action: "Ekim önerilerini aç",
  },
  {
    title: "Ekim Önerileri",
    text: "Bu sayfada farklı yıllara yayılan ürün sıralamaları ve her seçeneğin puanı vardır.",
    pose: "point",
    target: ".tv-page-banner",
    route: "/app/explore",
    action: "Öncelikleri incele",
  },
  {
    title: "Öncelikleriniz",
    text: "Su, gelir, toprak sağlığı ve risk kaydırıcıları değişince sıralama yeniden hesaplanır.",
    pose: "point",
    target: "#prio-title",
    route: "/app/explore",
    action: "Sonuçları gör",
  },
  {
    title: "Sıralanmış seçenekler",
    text: "Her kartta yıllara göre ürünler, puanlar ve su ihtiyacı bulunur. İki seçeneği yan yana karşılaştırabilirsiniz.",
    pose: "point",
    target: "#results-title",
    route: "/app/explore",
    action: "Veri ve Yöntem'e geç",
  },
  {
    title: "Veri ve Yöntem",
    text: "Şimdi sonuçların hangi geçmiş kayıtlarla sınandığını göstereceğim.",
    pose: "point",
    target: '[data-cosmo-tour="evidence-nav"]',
    route: "/app/explore",
    clickSelector: '[data-cosmo-tour="evidence-nav"]',
    action: "Kanıt ekranını aç",
  },
  {
    title: "Model doğrulaması",
    text: "Grafik, modellenen su stresi ile uydunun gördüğü bitki örtüsünü yıllara göre karşılaştırır.",
    pose: "point",
    target: "#chart-title",
    route: "/app/evidence",
    action: "Yöntemi incele",
  },
  {
    title: "Yöntem ve sınırlar",
    text: "Verinin çözünürlüğü, model varsayımları ve belirsizlikler burada açıkça yazılıdır. Karar verirken bu sınırları da okuyun.",
    pose: "point",
    target: "#method-title",
    route: "/app/evidence",
    action: "Turu tamamla",
  },
  {
    title: "Tur tamamlandı",
    text: "Ana bölümleri birlikte gezdik. Cosmo'ya bulunduğunuz ekranı sorabilir veya tanıtımı yeniden başlatabilirsiniz.",
    pose: "cheer",
    route: "/app/evidence",
    action: "Turu bitir",
  },
];

export default function CosmoIntro() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<DOMRect | null>(null);
  const [clicking, setClicking] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<{ pathname: string; index: number } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const panel = useRef<HTMLElement>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const standing = useRef<{ x: number; y: number } | null>(null);
  const stride = useRef<ReturnType<typeof setTimeout>>(undefined);
  const entrance = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [said, setSaid] = useState<Speech | null>(null);
  const [dropped, setDropped] = useState<Speech | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const saying = useRef<Speech | null>(null);
  const bubble = useRef<HTMLParagraphElement>(null);
  const hush = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sweep = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (pathname === "/") {
      try {
        if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
      } catch {
        setOpen(true);
      }
    }

    const reopen = () => {
      clearTimeout(timer.current);
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(COSMO_INTRO, reopen);
    return () => {
      window.removeEventListener(COSMO_INTRO, reopen);
      clearTimeout(timer.current);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const target = steps[index].target;
    if (!target) {
      setTargetBox(null);
      return;
    }

    let frame = 0;
    const update = () => {
      const element = Array.from(document.querySelectorAll<HTMLElement>(target)).find((node) => {
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && node.getBoundingClientRect().width > 0;
      });
      if (!element) {
        setTargetBox(null);
        return;
      }

      const box = element.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight) element.scrollIntoView({ block: "center", behavior: "smooth" });
      setTargetBox(box);
    };

    frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, index, pathname]);

  // Cosmo anlattığı bölümün yanına yürür; gösterecek bir yer yoksa kartın üst kenarında durur.
  useEffect(() => {
    if (!open) {
      standing.current = null;
      clearTimeout(stride.current);
      setGuide(null);
      return;
    }

    function walkTo(patient = true) {
      const card = panel.current?.getBoundingClientRect();
      if (!card) return;
      // Hedef kutusu bir kare sonra ölçülür; ölçülmeden karar verilirse Cosmo
      // kartın başında konuşmaya başlayıp sonra yürür. Hedef hiç çıkmazsa beklemeyi bırakır.
      if (patient && steps[index].target && !targetBox && standing.current) {
        entrance.current = setTimeout(() => walkTo(false), 900);
        return;
      }
      const [width, height] = innerWidth <= 760 ? [150, 220] : [240, 352];
      let x = card.left + 14;
      let y = card.top - height + 46;
      if (y < 8) y = card.bottom + 4;
      let facing = 0;

      if (targetBox) {
        const beside = targetBox.right + 10;
        const nearX = clamp(beside + width <= innerWidth - 8 ? beside : targetBox.right - width * 0.45, 8, innerWidth - width - 8);
        const nearY = clamp(targetBox.top + targetBox.height / 2 - height * 0.55, 8, innerHeight - height - 8);
        const coversCard = nearX < card.right && nearX + width > card.left && nearY + height > card.top && nearY < card.bottom;
        if (!coversCard) {
          x = nearX;
          y = nearY;
        }
        facing = targetBox.left + targetBox.width / 2 < x + width / 2 ? -0.4 : 0.4;
      }

      if (!standing.current) {
        // İlk girişte ekranın sağ kenarının dışından başlar.
        standing.current = { x: innerWidth + 24, y };
        setGuide({ ...standing.current, ms: 0, walking: true, facing: -1.15, step: -1 });
        entrance.current = setTimeout(walkTo, 60);
        return;
      }

      const distance = Math.hypot(x - standing.current.x, y - standing.current.y);
      if (distance < 6) {
        setGuide((now) => (now && !now.walking ? { ...now, facing, step: index } : now));
        return;
      }
      const ms = clamp(distance / 0.3, 500, 2400);
      const heading = x > standing.current.x ? 1.15 : -1.15;
      standing.current = { x, y };
      setGuide({ x, y, ms, walking: true, facing: heading, step: -1 });
      clearTimeout(stride.current);
      stride.current = setTimeout(() => setGuide((now) => now && { ...now, walking: false, facing, step: index }), ms);
    }

    // Yürüyüşün bitiş zamanlayıcısı burada temizlenmez: hedef kutusu kaydırmayla
    // sık sık yenilenir, temizlenirse Cosmo yürüme pozunda kalır.
    entrance.current = setTimeout(walkTo, standing.current ? 0 : 420);
    const onResize = () => walkTo();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(entrance.current);
      window.removeEventListener("resize", onResize);
    };
  }, [open, index, targetBox]);

  useEffect(
    () => () => {
      clearTimeout(stride.current);
      clearTimeout(hush.current);
      clearTimeout(sweep.current);
    },
    [],
  );

  // Cosmo yerine varınca konuşur; adım değişince ya da yürümeye başlayınca
  // söylediği kelimeler aşağı düşer.
  const arrived = Boolean(guide && !guide.walking && guide.step === index);
  useEffect(() => {
    if (!open || !arrived || !standing.current) return;
    const narrow = innerWidth <= 760;
    const [width, height] = narrow ? [150, 220] : [240, 352];
    const bubbleWidth = narrow ? 210 : 300;
    const { x, y } = standing.current;
    let left = x + width - 18;
    if (left + bubbleWidth > innerWidth - 8) left = x - bubbleWidth + 18;
    const words = steps[index].text.split(" ");
    const speech: Speech = {
      id: index,
      words,
      left: clamp(left, 8, innerWidth - bubbleWidth - 8),
      top: clamp(y + height * 0.08, 8, innerHeight - 170),
      mouthX: x + width * 0.5,
      mouthY: y + height * 0.45,
    };
    saying.current = speech;
    setSaid(speech);
    setSpeaking(true);
    hush.current = setTimeout(() => setSpeaking(false), words.length * WORD_MS + 500);

    return () => {
      clearTimeout(hush.current);
      setSpeaking(false);
      if (saying.current) {
        setDropped(saying.current);
        clearTimeout(sweep.current);
        sweep.current = setTimeout(() => setDropped(null), 1100);
      }
      saying.current = null;
      setSaid(null);
    };
  }, [open, index, arrived]);

  // Her kelime kendi yerinden ağza olan uzaklığı bilir; uçuş oradan başlar.
  useLayoutEffect(() => {
    if (!said || !bubble.current) return;
    for (const word of bubble.current.children as HTMLCollectionOf<HTMLElement>) {
      const box = word.getBoundingClientRect();
      word.style.setProperty("--from-x", `${said.mouthX - (box.left + box.width / 2)}px`);
      word.style.setProperty("--from-y", `${said.mouthY - (box.top + box.height / 2)}px`);
    }
  }, [said]);

  useEffect(() => {
    if (!pendingRoute || pathname !== pendingRoute.pathname) return;
    setIndex(pendingRoute.index);
    setPendingRoute(null);
    setClicking(false);
  }, [pathname, pendingRoute]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  function finish() {
    clearTimeout(timer.current);
    try {
      localStorage.setItem(SEEN_KEY, "seen");
    } catch {}
    setOpen(false);
    setClicking(false);
    setPendingRoute(null);
  }

  function advance() {
    if (index === steps.length - 1) {
      finish();
      return;
    }

    const current = steps[index];
    if (current.clickSelector) {
      setClicking(true);
      timer.current = setTimeout(() => {
        Array.from(document.querySelectorAll<HTMLElement>(current.clickSelector!))
          .find((element) => element.getBoundingClientRect().width > 0)?.click();
        setIndex(index + 1);
        setClicking(false);
      }, 450);
      return;
    }

    const nextIndex = index + 1;
    const nextRoute = steps[nextIndex].route;
    if (nextRoute && pathname !== nextRoute) {
      setClicking(true);
      timer.current = setTimeout(() => {
        setPendingRoute({ pathname: nextRoute, index: nextIndex });
        router.push(`${nextRoute}${window.location.search}`);
      }, 450);
      return;
    }
    setIndex(nextIndex);
  }

  if (!open) return null;
  const step = steps[index];
  const box = targetBox;
  const focusStyle = box ? { top: box.top - 7, left: box.left - 7, width: box.width + 14, height: box.height + 14 } : undefined;
  const cursorStyle: CSSProperties | undefined = box ? { top: box.top + Math.min(box.height / 2, 32), left: box.left + Math.min(box.width / 2, 70) } : undefined;

  return (
    <div className="cosmo-tour" role="presentation">
      {box ? <div className="cosmo-tour-focus" style={focusStyle} /> : <div className="cosmo-tour-dim" />}
      {box && <MousePointer2 className={`cosmo-tour-cursor${clicking ? " is-clicking" : ""}`} style={cursorStyle} aria-hidden="true" />}
      {guide && (
        <div className="cosmo-tour-guide" style={{ transform: `translate(${guide.x}px, ${guide.y}px)`, transitionDuration: `${guide.ms}ms` }}>
          <CosmoStage pose={guide.walking ? "walk" : step.pose} facing={guide.facing} talking={speaking} />
        </div>
      )}
      {said && (
        <p className="cosmo-tour-speech" ref={bubble} key={said.id} style={{ left: said.left, top: said.top }} aria-hidden="true">
          {said.words.map((word, order) => (
            <span key={order} style={{ "--order": order } as CSSProperties}>{word}</span>
          ))}
        </p>
      )}
      {dropped && (
        <p className="cosmo-tour-speech is-falling" key={`drop-${dropped.id}`} style={{ left: dropped.left, top: dropped.top }} aria-hidden="true">
          {dropped.words.map((word, order) => (
            <span key={order} style={{ "--order": order, "--tilt": ((order * 37) % 21) - 10 } as CSSProperties}>{word}</span>
          ))}
        </p>
      )}
      <section className="cosmo-tour-panel is-content-step" ref={panel} role="dialog" aria-label="Cosmo ile sistem tanıtımı" aria-describedby="cosmo-tour-description">
        <div className="cosmo-tour-copy" key={index}>
          <span className="cosmo-tour-count">SİSTEM TURU · {index + 1}/{steps.length}</span>
          <h2>{step.title}</h2>
          <p id="cosmo-tour-description" className="cosmo-tour-transcript">{step.text}</p>
          <div className="cosmo-tour-progress" aria-hidden="true"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
          <div className="cosmo-tour-actions">
            <button className="cosmo-tour-skip" onClick={finish}>Turu geç</button>
            <button className="cosmo-tour-next" onClick={advance} disabled={clicking}>{step.action} <ArrowRight size={16} /></button>
          </div>
        </div>
        <button className="cosmo-tour-close" ref={closeButton} onClick={finish} aria-label="Tanıtımı kapat"><X size={18} /></button>
      </section>
      {index === steps.length - 1 && <button className="cosmo-tour-ask" onClick={() => { finish(); summonCosmo(); }}>Cosmo&apos;ya soru sor</button>}
    </div>
  );
}
