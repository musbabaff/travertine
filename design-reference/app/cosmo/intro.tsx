"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, MousePointer2, X } from "lucide-react";
import type { CosmoPose } from "./mascot";
import CosmoStage from "./stage";
import { summonCosmo } from "./gaze";

export const COSMO_INTRO = "cosmo:intro";
const SEEN_KEY = "travertine-cosmo-intro-v3";

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
    text: "Travertine sistemine hoş geldiniz. Size her bölümü tek tek göstereceğim; istediğiniz an turu kapatabilirsiniz.",
    pose: "wave",
    action: "Tanıtıma başla",
  },
  {
    title: "Tarla İzleme",
    text: "Tarlalarınıza ve güncel durumlarına bu menüden ulaşırsınız. İlk olarak tarla listenizi açıyorum.",
    pose: "point",
    target: '[data-cosmo-tour="monitoring"]',
    route: "/monitoring",
    action: "Tarla İzleme'yi aç",
  },
  {
    title: "Tarla listeniz",
    text: "Ekili alan ve nem gibi temel göstergeler her tarla için burada özetlenir. Ayrıntıları görmek için bir tarla seçebilirsiniz.",
    pose: "point",
    target: ".field-list",
    route: "/monitoring",
    action: "Tarlaları incele",
  },
  {
    title: "Bir tarla seçelim",
    text: "Cosmo şimdi örnek olarak Üzüm Bağı'nı seçiyor. Seçimden sonra o tarlanın ayrıntıları açılacak.",
    pose: "point",
    target: ".field-list button:nth-of-type(2)",
    route: "/monitoring",
    clickSelector: ".field-list button:nth-of-type(2)",
    action: "Üzüm Bağı'nı seç",
  },
  {
    title: "Tarla ayrıntıları",
    text: "Alan, ağaç sayısı ve hasat ilerlemesi gibi bilgiler seçtiğiniz tarlaya göre burada güncellenir.",
    pose: "point",
    target: "#selected-field-detail",
    route: "/monitoring",
    action: "Hava Durumu'na geç",
  },
  {
    title: "Hava Durumu",
    text: "Sıcaklık, gün içindeki değişim ve hava koşullarını burada izleyebilirsiniz. Bu bilgiler saha planlamasına yardımcı olur.",
    pose: "point",
    target: ".weather-hero",
    route: "/weather",
    action: "Hava Durumu'nu incele",
  },
  {
    title: "Sulama",
    text: "Sulama planı ve alanların su durumuyla ilgili özetler bu ekranda yer alır. Kontrol kartları ilgili planı takip etmenizi sağlar.",
    pose: "point",
    target: ".irrigation-layout",
    route: "/irrigation",
    action: "Sulama'yı gör",
  },
  {
    title: "Üretim",
    text: "Ürün çeşitlerini, ekili alanları ve tarlalara göre üretim dağılımını bu bölümden takip edebilirsiniz.",
    pose: "point",
    target: ".production-rows",
    route: "/production",
    action: "Üretim'i incele",
  },
  {
    title: "Analiz Özeti",
    text: "Çiftliğin performansını bir arada görür; alan, eğilim ve temel göstergeleri aynı ekranda karşılaştırırsınız.",
    pose: "point",
    target: ".analysis-layout",
    route: "/analytics",
    action: "Analizlere geç",
  },
  {
    title: "Verim Analizi",
    text: "Verim eğilimlerini ve dönemler arasındaki farkları burada inceleyebilirsiniz. Böylece değişimleri daha kolay fark edersiniz.",
    pose: "point",
    target: ".yield-explorer",
    route: "/yield",
    action: "Verim'i gör",
  },
  {
    title: "Hasat",
    text: "Hasat takvimini, ilerlemeyi ve ürün bazındaki durumu bu bölümden takip edebilirsiniz.",
    pose: "point",
    target: ".harvest-list",
    route: "/harvest",
    action: "Hasat ekranını aç",
  },
  {
    title: "Raporlar",
    text: "Dönem ve tarla raporları, verileri daha düzenli incelemeniz için burada listelenir.",
    pose: "point",
    target: ".report-table",
    route: "/reports",
    action: "Raporları gör",
  },
  {
    title: "Bildirimler",
    text: "Çiftliğinizdeki son gelişmeler ve dikkat gerektiren durumlar bildirim akışında görünür.",
    pose: "point",
    target: ".notification-panel",
    route: "/notifications",
    action: "Bildirimlere bak",
  },
  {
    title: "Ayarlar",
    text: "Görünüm ve bildirim tercihlerinizi buradan düzenleyebilirsiniz. Tercihleriniz arayüz deneyimini şekillendirir.",
    pose: "point",
    target: ".settings-panel",
    route: "/settings",
    action: "Ayarları incele",
  },
  {
    title: "Profil",
    text: "Hesap ve çiftlik yöneticisi bilgileri profil ekranında bulunur.",
    pose: "point",
    target: ".profile-panel",
    route: "/profile",
    action: "Profili gör",
  },
  {
    title: "Arama",
    text: "Bir tarla ya da bölümü aradığınızda sonuçlara buradan ulaşırsınız.",
    pose: "point",
    target: ".search-page-results",
    route: "/search",
    action: "Aramayı gör",
  },
  {
    title: "Tarla Sağlığı",
    text: "Toprak bünyesi, kullanılabilir su ve saha göstergelerini bu özet ekranda birlikte inceleyebilirsiniz.",
    pose: "point",
    target: ".fs-summary-grid",
    route: "/field-summary",
    action: "Tarla Sağlığı'na geç",
  },
  {
    title: "Ekim Önerileri",
    text: "Su, gelir, toprak ve risk önceliklerinizi ayarlayıp farklı ürün seçeneklerini karşılaştırabilirsiniz.",
    pose: "point",
    target: ".fs-explore-layout",
    route: "/explore",
    action: "Keşif ekranını aç",
  },
  {
    title: "Ekim Planı",
    text: "Seçilen ürün sırası yıl yıl burada gösterilir. Planı yazdırabilir veya PDF olarak kaydedebilirsiniz.",
    pose: "point",
    target: ".fs-plan-head",
    route: "/rotation-plan",
    action: "Planı incele",
  },
  {
    title: "Veri ve Yöntem",
    text: "Kullanılan veri kaynaklarını ve yöntemin sınırlarını burada inceleyebilirsiniz.",
    pose: "point",
    target: ".fs-evidence-grid",
    route: "/evidence",
    action: "Kanıtı gör",
  },
  {
    title: "Tur tamamlandı",
    text: "Travertine'deki ana bölümleri birlikte gezdik. İstediğiniz sayfaya geçebilir veya Cosmo'ya soru sorabilirsiniz.",
    pose: "cheer",
    route: "/evidence",
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
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      setOpen(true);
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
  }, []);

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
        document.querySelector<HTMLButtonElement>(current.clickSelector!)?.click();
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
        router.push(nextRoute);
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
      {index === steps.length - 1 && <button className="cosmo-tour-ask" onClick={() => { finish(); summonCosmo(); }}>Cosmo'ya soru sor</button>}
    </div>
  );
}
