"use client";

import { useId, type ReactNode } from "react";

export type CosmoPose = "idle" | "walk" | "wave" | "point" | "cheer" | "jump" | "think" | "sleep";

const frames = {
  full: "0 -26 400 586",
  head: "95 105 210 195",
  chat: "84 -26 232 324",
  star: "111 -30 70 70",
  eye: "124 150 68 68",
  patch: "226 296 56 56",
  boot: "116 450 96 100",
  tail: "232 394 130 146",
};
export type CosmoFrame = keyof typeof frames;

const SKULL =
  "M200 88 C262 88 304 128 305 188 C306 250 262 288 200 288 C138 288 94 250 95 188 C96 128 138 88 200 88 Z";
const BODY =
  "M170 268 C150 288 122 338 122 386 C122 428 156 450 200 450 C244 450 278 428 278 386 C278 338 250 288 230 268 Z";
const VEST_PANEL =
  "M168 272 C152 276 138 288 132 304 C122 332 118 370 120 403 C136 411 156 409 171 401 C172 368 174 334 180 304 C182 290 178 276 168 272 Z";
const TAIL_BASE = "M250 404 C278 408 300 430 316 456 L296 480 C282 466 266 458 246 452 Z";
const TAIL_TIP =
  "M316 456 C332 478 344 500 350 518 C352 527 343 531 337 524 C324 508 310 492 296 480 Z";
const TOE =
  "M126 526 C126 512 142 505 162 505 C180 505 198 510 199 524 C199 536 180 540 160 540 C140 540 126 536 126 526 Z";
const SHAFT = "M143 470 L195 470 L197 512 C194 524 178 528 166 527 C150 526 140 520 141 512 Z";
const MOUTH = "M182 229 Q200 239 218 229 Q215 250 200 252 Q185 250 182 229 Z";

const mirror = "translate(400 0) scale(-1 1)";
const yarn = ["#6f45b8", "#8a3fae", "#a5409c", "#5340a8"];

function starPoints(outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 ? inner : outer;
    return `${(Math.cos(angle) * r).toFixed(1)},${(Math.sin(angle) * r).toFixed(1)}`;
  }).join(" ");
}
const starCup = starPoints(17.5, 9.4);
const starFace = starPoints(12.6, 5.8);

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));

// Oyuncaktaki mor alanlar düz boya değil, tek tek mor ilmek. Burada da ilmek
// ızgarasına oturan küçük halkalar üretiliyor; tohum sabit olduğu için sunucu
// ve tarayıcı aynı çizimi çıkarır.
function knit([x0, y0, x1, y1]: number[], density: (x: number, y: number) => number, seed: number) {
  const rand = seeded(seed);
  const strands = ["", "", "", ""];
  for (let row = 0, y = y0; y < y1; y += 3.8, row++) {
    for (let x = x0 + (row % 2 ? 4.5 : 0); x < x1; x += 9) {
      const roll = rand();
      const hue = rand();
      const wobble = rand();
      if (roll > density(x, y)) continue;
      const strand = Math.min(3, Math.floor((Math.sin(x * 0.07 + y * 0.05) + 1) * 1.1 + hue * 1.8));
      const rx = 3.4 + wobble * 0.6;
      const ry = 2.5 + hue * 0.5;
      const cx = x + wobble - 0.5;
      strands[strand] += `M${(cx - rx).toFixed(1)} ${y.toFixed(1)}a${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(rx * 2).toFixed(1)} 0a${rx.toFixed(1)} ${ry.toFixed(1)} 0 1 0 ${(-rx * 2).toFixed(1)} 0`;
    }
  }
  return strands;
}

// Mor bölge tepeden başlar, bakana göre sağ yanaktan aşağı iner; yüz açık kalır.
const crownKnit = knit(
  [95, 88, 306, 290],
  (x, y) => {
    if (((x - 200) / 72) ** 2 + ((y - 208) / 64) ** 2 < 1) return 0;
    const edge = 128 + Math.max(0, x - 232) * 2.1 + Math.max(0, 126 - x) * 0.3;
    const cheek = 0.62 * (1 - Math.hypot(x - 110, y - 238) / 24);
    return Math.max(clamp((edge - y) / 26 + 0.34, 0, 0.9), cheek);
  },
  7,
);
const hipKnit = knit([118, 380, 284, 452], (x, y) => clamp((y - 400 - 7 * Math.sin(x / 9)) / 26 + 0.22, 0, 0.92), 19);
const tailKnit = knit(
  [246, 404, 352, 530],
  (x, y) => clamp(0.62 - Math.abs(y - (404 + (x - 250) * 1.06)) / 46 + (x - 250) / 420),
  31,
);
const armKnit = knit([92, 292, 152, 336], (x, y) => clamp(0.74 - Math.abs(y - (297 + (150 - x) * 0.62)) / 15), 43);
const legKnit = knit([152, 430, 194, 466], () => 0.6, 53);
const toeKnit = knit([128, 508, 168, 538], (x, y) => clamp(0.55 - Math.hypot(x - 142, y - 524) / 30), 61);

function Knit({ strands }: { strands: string[] }) {
  return (
    <>
      {strands.map((d, i) => d && <path key={i} d={d} fill={yarn[i]} opacity=".9" />)}
    </>
  );
}

// Eklem: içerik çizildiği koordinatlarda kalır, CSS dönüşü `at` noktası etrafında olur.
function Joint({ at, className, children }: { at: [number, number]; className: string; children: ReactNode }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <g className={className}>
        <g transform={`translate(${-at[0]} ${-at[1]})`}>{children}</g>
      </g>
    </g>
  );
}

function Badge({ x, y, small }: { x: number; y: number; small?: boolean }) {
  const w = small ? 27 : 38;
  const h = small ? 13 : 19;
  return (
    <g>
      <rect x={x + 0.6} y={y + 1} width={w} height={h} rx={small ? 2.4 : 3.2} fill="#7a3408" opacity=".35" />
      <rect x={x} y={y} width={w} height={h} rx={small ? 2.4 : 3.2} fill="#1e459c" />
      <rect
        x={x + 1.3}
        y={y + 1.3}
        width={w - 2.6}
        height={h - 2.6}
        rx={small ? 1.6 : 2.2}
        fill="none"
        stroke="#fff"
        strokeWidth=".7"
        strokeDasharray="1.6 1.1"
        opacity=".85"
      />
      <text
        aria-hidden="true"
        x={x + w / 2}
        y={y + (small ? 7.6 : 10.4)}
        textAnchor="middle"
        fontSize={small ? 5.8 : 8.2}
        fontWeight="800"
        letterSpacing=".5"
        fill="#fff"
        fontFamily="Inter, Arial, sans-serif"
      >
        COSMO
      </text>
      <path
        d="M0 -2.6 l.9 1.6 1.7 .3 -1.3 1.2 .3 1.7 -1.6 -.9 -1.6 .9 .3 -1.7 -1.3 -1.2 1.7 -.3 Z"
        fill="#fff"
        opacity=".9"
        transform={`translate(${x + w / 2} ${y + h - (small ? 2.9 : 4.2)}) scale(${small ? 0.62 : 0.9})`}
      />
    </g>
  );
}

export default function CosmoMascot({
  frame = "full",
  pose = "idle",
  talking = false,
  listening = false,
  still = false,
  label = "Cosmo",
}: {
  frame?: CosmoFrame;
  pose?: CosmoPose;
  talking?: boolean;
  listening?: boolean;
  still?: boolean;
  label?: string | null;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name: string) => `url(#${uid}${name})`;
  const headOnly = frame === "head" || frame === "chat" || frame === "star" || frame === "eye";

  const antenna = (
    <Joint at={[174, 105]} className="cosmo-ant">
      <path d="M174 107 C171 91 167 76 162 62" fill="none" stroke="#2c5fb4" strokeWidth="13" strokeLinecap="round" />
      <path d="M174 107 C171 91 167 76 162 62" fill="none" stroke="#5590d8" strokeWidth="10" strokeLinecap="round" />
      <path d="M171 98 C169 88 166 78 163 70" fill="none" stroke="#a9d0f7" strokeWidth="2.4" strokeLinecap="round" opacity=".5" />
      <ellipse cx="173.5" cy="98" rx="3.6" ry="2.6" fill={yarn[0]} opacity=".9" />
      <ellipse cx="169.5" cy="90" rx="3.4" ry="2.5" fill={yarn[2]} opacity=".9" />
      <ellipse cx="170.5" cy="82" rx="3" ry="2.3" fill={yarn[3]} opacity=".85" />
      <Joint at={[162, 62]} className="cosmo-ant-tip">
        <path d="M162 62 C158 48 154 36 150 25" fill="none" stroke="#2c5fb4" strokeWidth="13" strokeLinecap="round" />
        <path d="M162 62 C158 48 154 36 150 25" fill="none" stroke="#5590d8" strokeWidth="10" strokeLinecap="round" />
        <path d="M159 58 C156 48 153 40 150 32" fill="none" stroke="#a9d0f7" strokeWidth="2.4" strokeLinecap="round" opacity=".5" />
        <g transform="translate(146 8) rotate(-15)">
          <g className="cosmo-star">
            <polygon points={starCup} fill="#2a6fbf" stroke="#2a6fbf" strokeWidth="6.5" strokeLinejoin="round" />
            <polygon points={starCup} fill="none" stroke="#1d4f97" strokeWidth="1.2" strokeLinejoin="round" opacity=".5" transform="translate(.8 1.4)" />
            <polygon points={starFace} fill={ref("silver")} stroke="#9fadc6" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M-6 -2 L0 -8.5 L1.5 -2.5 Z" fill="#fff" opacity=".7" />
            <circle cx="3.6" cy="1.8" r=".9" fill="#fff" />
            <circle cx="-2.4" cy="4.2" r=".8" fill="#fff" opacity=".8" />
            <circle cx="5.6" cy="-3.2" r=".6" fill="#fff" opacity=".8" />
            <path className="cosmo-glint" d="M0 -7 Q.8 -.8 7 0 Q.8 .8 0 7 Q-.8 .8 -7 0 Q-.8 -.8 0 -7 Z" fill="#fff" />
          </g>
        </g>
      </Joint>
    </Joint>
  );

  const eye = (cx: number, side: "L" | "R") => (
    <g>
      <ellipse cx={cx} cy="184" rx="19" ry="20.5" fill={ref("sclera")} />
      <g clipPath={ref(`eye${side}`)}>
        <g className="cosmo-glance">
          <g className="cosmo-pupil">
            <circle cx={cx + 0.5} cy="185.5" r="15.2" fill={ref("iris")} />
            <circle cx={cx + 0.5} cy="185.5" r="10.6" fill="none" stroke="#d3e6ff" strokeWidth="6.6" strokeDasharray=".9 2.2" opacity=".34" />
            <circle cx={cx + 0.5} cy="185.5" r="15.2" fill="none" stroke="#17377e" strokeWidth="1.7" />
            <circle cx={cx + 0.5} cy="185.5" r="6.8" fill="#0c1838" />
            <circle cx={cx - 4.2} cy="180" r="3.3" fill="#fff" opacity=".95" />
            <circle cx={cx + 5.4} cy="190.6" r="1.4" fill="#fff" opacity=".7" />
          </g>
        </g>
        <ellipse cx={cx} cy="166" rx="24" ry="11" fill="#0f2a66" opacity=".2" />
        <g className="cosmo-lid">
          <path d={`M${cx - 23} 116 H${cx + 23} V160 Q${cx} 168 ${cx - 23} 160 Z`} fill={ref("lid")} />
          <path d={`M${cx - 23} 160 Q${cx} 168 ${cx + 23} 160`} fill="none" stroke="#18346b" strokeWidth="3" strokeLinecap="round" />
        </g>
      </g>
      <ellipse cx={cx} cy="184" rx="19" ry="20.5" fill="none" stroke="#18346b" strokeWidth="2.2" />
      <path d={`M${cx - 18.4} 178 A19 20.5 0 0 1 ${cx + 18.4} 178`} fill="none" stroke="#18346b" strokeWidth="3.6" strokeLinecap="round" />
    </g>
  );

  const head = (
    <Joint at={[200, 280]} className="cosmo-head">
      <g className="cosmo-ant-l">{antenna}</g>
      <g className="cosmo-ant-r" transform={mirror}>
        {antenna}
      </g>

      <path d={SKULL} fill={ref("skin")} />
      <g clipPath={ref("skull")}>
        <Knit strands={crownKnit} />
        <ellipse cx="158" cy="186" rx="34" ry="32" fill={ref("shade")} opacity=".34" />
        <ellipse cx="242" cy="186" rx="34" ry="32" fill={ref("shade")} opacity=".34" />
        <ellipse cx="200" cy="234" rx="52" ry="30" fill={ref("glow")} opacity=".26" />
        <ellipse cx="134" cy="228" rx="30" ry="22" fill={ref("glow")} opacity=".3" />
        <ellipse cx="266" cy="228" rx="30" ry="22" fill={ref("glow")} opacity=".2" />
        <ellipse cx="160" cy="128" rx="74" ry="40" fill={ref("glow")} opacity=".34" />
        <path d="M98 214 C102 262 144 286 200 288 C258 286 298 258 303 212" fill="none" stroke="#143a86" strokeWidth="22" opacity=".16" />
        <path d="M286 130 C300 156 304 196 296 232" fill="none" stroke="#143a86" strokeWidth="16" opacity=".12" />
        <path d={SKULL} fill={ref("stitch")} />
      </g>

      <g className="cosmo-brow cosmo-brow-l">
        <path d="M139 153 Q155 144 174 150" fill="none" stroke="#2d63b8" strokeWidth="4.6" strokeLinecap="round" opacity=".8" />
      </g>
      <g className="cosmo-brow cosmo-brow-r">
        <path d="M226 150 Q245 144 261 153" fill="none" stroke="#2d63b8" strokeWidth="4.6" strokeLinecap="round" opacity=".8" />
      </g>

      <g className="cosmo-eyes">
        {eye(157, "L")}
        {eye(243, "R")}
      </g>

      <path d="M168 224 Q169 231 176 232" fill="none" stroke="#2b5cb2" strokeWidth="2.3" strokeLinecap="round" opacity=".65" />
      <path d="M232 224 Q231 231 224 232" fill="none" stroke="#2b5cb2" strokeWidth="2.3" strokeLinecap="round" opacity=".65" />
      <Joint at={[200, 229]} className="cosmo-mouth">
        <path d={MOUTH} fill="#4d1d33" />
        <g clipPath={ref("mouth")}>
          <ellipse cx="200" cy="251" rx="10.5" ry="5.4" fill="#d9627f" />
          <path d="M182 227 Q200 239 218 227 L216 235.5 Q200 243 184 235.5 Z" fill="#f6f4ee" />
          <path d="M184 235.5 Q200 243 216 235.5" fill="none" stroke="#c9c6bb" strokeWidth=".8" />
        </g>
        <path d="M182 229 Q200 239 218 229" fill="none" stroke="#24509f" strokeWidth="2" strokeLinecap="round" />
      </Joint>
      <path className="cosmo-mouth-shut" d="M186 233 Q200 242 214 233" fill="none" stroke="#1f4590" strokeWidth="3" strokeLinecap="round" />
      <path d="M190 258 Q200 262 210 258" fill="none" stroke="#143a86" strokeWidth="2" strokeLinecap="round" opacity=".18" />

      <g className="cosmo-zzz" fill="#4f7fd6" fontFamily="Inter, Arial, sans-serif" fontWeight="600">
        <text x="302" y="104" fontSize="14">z</text>
        <text x="314" y="84" fontSize="17">z</text>
        <text x="324" y="60" fontSize="21">z</text>
      </g>
    </Joint>
  );

  const arm = (
    <Joint at={[150, 297]} className="cosmo-arm">
      <path d="M150 297 Q131 306 113 321" fill="none" stroke={ref("limb")} strokeWidth="27" strokeLinecap="round" />
      <g clipPath={ref("upperArm")}>
        <Knit strands={armKnit} />
      </g>
      <path d="M150 297 Q131 306 113 321" fill="none" stroke={ref("stitch")} strokeWidth="27" strokeLinecap="round" />
      <Joint at={[113, 321]} className="cosmo-fore">
        <path d="M113 321 Q96 332 80 346" fill="none" stroke={ref("limb")} strokeWidth="24.5" strokeLinecap="round" />
        <path d="M113 321 Q96 332 80 346" fill="none" stroke={ref("stitch")} strokeWidth="24.5" strokeLinecap="round" />
        <path d="M118 311 Q101 321 86 333" fill="none" stroke="#b5d7fa" strokeWidth="3" strokeLinecap="round" opacity=".32" />
        <Joint at={[80, 346]} className="cosmo-hand">
          <g fill="none" stroke="#4d86d2" strokeWidth="10.4" strokeLinecap="round">
            <path d="M66 348 L48 341" />
            <path d="M63 355 L43 356" />
            <path d="M65 362 L48 371" />
            <path d="M76 364 L77 379" />
          </g>
          <g fill="none" stroke="#6ea6ea" strokeWidth="8" strokeLinecap="round">
            <path d="M66 347.4 L48 340.4" />
            <path d="M63 354.4 L43 355.4" />
            <path d="M65 361.4 L48 370.4" />
            <path d="M75.4 364 L76.4 378.4" />
          </g>
          <circle cx="71" cy="354" r="14.4" fill="#6ea6ea" />
          <ellipse cx="68" cy="350" rx="8" ry="6" fill={ref("glow")} opacity=".45" />
          <path d="M60 366 Q70 371 80 365" fill="none" stroke="#2f63b0" strokeWidth="2" strokeLinecap="round" opacity=".35" />
        </Joint>
      </Joint>
    </Joint>
  );

  const boot = (
    <>
      <path d="M173 438 L170 472" stroke={ref("legSkin")} strokeWidth="38" strokeLinecap="round" />
      <g clipPath={ref("thigh")}>
        <Knit strands={legKnit} />
      </g>
      <path d="M124 530 C126 545 150 549 172 548 C188 547 199 541 200 530 Z" fill="#24509f" />
      <path d={TOE} fill={ref("skin")} />
      <g clipPath={ref("toe")}>
        <Knit strands={toeKnit} />
        <ellipse cx="150" cy="514" rx="20" ry="8" fill={ref("glow")} opacity=".5" />
        <path d={TOE} fill={ref("stitch")} />
      </g>
      <path d="M127 531 C135 540 188 540 198 529" fill="none" stroke="#1c4288" strokeWidth="1.6" opacity=".45" />
      <path d={SHAFT} fill={ref("shaft")} />
      <path d={SHAFT} fill={ref("weave")} />
      <path d="M143 510 Q166 520 196 508" fill="none" stroke="#8f3d0a" strokeWidth="1.2" opacity=".5" />
      <path d="M148 478 L149 508 Q160 517 174 518 M186 478 L187 505" fill="none" stroke="#ffd7a6" strokeWidth="1.5" strokeDasharray="3 3" opacity=".75" />
      <ellipse cx="169" cy="476" rx="26" ry="5" fill="#8f3d0a" opacity=".3" />
      <rect x="140" y="459" width="58" height="14" rx="7" fill={ref("cuff")} />
      <path d="M146 463 Q169 459 192 463" fill="none" stroke="#ffe0b8" strokeWidth="1.6" strokeLinecap="round" opacity=".6" />
    </>
  );

  const vestPanel = (
    <>
      <path d={VEST_PANEL} fill={ref("cloth")} />
      <g clipPath={ref("vest")}>
        <path d="M122 300 C114 336 114 372 118 404" fill="none" stroke="#7d3406" strokeWidth="18" opacity=".26" />
        <path d="M172 300 C170 336 168 372 168 404" fill="none" stroke="#ffd09a" strokeWidth="5" opacity=".34" />
        <ellipse cx="146" cy="300" rx="16" ry="18" fill="#7d3406" opacity=".42" />
        <path d={VEST_PANEL} fill={ref("weave")} />
      </g>
      <path d={VEST_PANEL} fill="none" stroke="#b9530e" strokeWidth="1.5" />
      <path d="M168 272 C177 280 183 292 180 308 C172 301 165 288 168 272 Z" fill="#ffb364" stroke="#b9530e" strokeWidth="1" />
      <path d="M127 347 h40 v31 q0 6 -6 6 h-28 q-6 0 -6 -6 Z" fill="#f08a33" stroke="#b9530e" strokeWidth="1.4" />
      <path d="M127 347 h40 v9 q-20 5 -40 0 Z" fill="#ffa24e" stroke="#b9530e" strokeWidth="1.1" />
      <path d="M129 358 q18 4 36 0" fill="none" stroke="#7d3406" strokeWidth="1.6" opacity=".28" />
      <path d="M137 287 Q127 319 128 343 M159 290 Q166 320 165 343 M132 381 Q146 387 163 381" fill="none" stroke="#ffe0b8" strokeWidth="1.5" strokeDasharray="3 3" opacity=".8" />
      <circle cx="147" cy="352" r="1.9" fill="#ffe6c2" stroke="#b9530e" strokeWidth=".6" />
    </>
  );

  return (
    <svg
      viewBox={frames[frame]}
      className={`cosmo pose-${pose}${headOnly ? " cosmo-bust" : ""}${talking ? " is-talking" : ""}${listening ? " is-listening" : ""}${still ? " is-still" : ""}`}
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={`${uid}skin`} cx="36%" cy="26%" r="82%">
          <stop offset="0" stopColor="#97c6f2" />
          <stop offset=".42" stopColor="#5f99de" />
          <stop offset=".8" stopColor="#3b72c4" />
          <stop offset="1" stopColor="#2c5cab" />
        </radialGradient>
        <radialGradient id={`${uid}belly`} cx="42%" cy="34%" r="78%">
          <stop offset="0" stopColor="#8fc0f0" />
          <stop offset=".5" stopColor="#5a94dc" />
          <stop offset="1" stopColor="#3166b8" />
        </radialGradient>
        <linearGradient id={`${uid}limb`} gradientUnits="userSpaceOnUse" x1="120" y1="290" x2="104" y2="368">
          <stop offset="0" stopColor="#74acec" />
          <stop offset=".55" stopColor="#4b84d2" />
          <stop offset="1" stopColor="#3166b8" />
        </linearGradient>
        <linearGradient id={`${uid}legSkin`} gradientUnits="userSpaceOnUse" x1="150" y1="0" x2="194" y2="0">
          <stop offset="0" stopColor="#3166b8" />
          <stop offset=".4" stopColor="#5a94dc" />
          <stop offset="1" stopColor="#3b72c4" />
        </linearGradient>
        <linearGradient id={`${uid}cloth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f9a04a" />
          <stop offset=".5" stopColor="#ee7f25" />
          <stop offset="1" stopColor="#d1640f" />
        </linearGradient>
        <linearGradient id={`${uid}shaft`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c45c10" />
          <stop offset=".32" stopColor="#f58a2c" />
          <stop offset=".5" stopColor="#ffa44e" />
          <stop offset=".78" stopColor="#e3721c" />
          <stop offset="1" stopColor="#b3520d" />
        </linearGradient>
        <linearGradient id={`${uid}cuff`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb86e" />
          <stop offset="1" stopColor="#e87a22" />
        </linearGradient>
        <linearGradient id={`${uid}sclera`} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".7" stopColor="#edf2f8" />
          <stop offset="1" stopColor="#c3d1e3" />
        </linearGradient>
        <linearGradient id={`${uid}lid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6aa2e4" />
          <stop offset="1" stopColor="#4c85d2" />
        </linearGradient>
        <radialGradient id={`${uid}iris`} cx="40%" cy="34%" r="75%">
          <stop offset="0" stopColor="#86bdf6" />
          <stop offset=".58" stopColor="#3a72d2" />
          <stop offset="1" stopColor="#1c3f9f" />
        </radialGradient>
        <linearGradient id={`${uid}silver`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".55" stopColor="#dfe6f2" />
          <stop offset="1" stopColor="#b3c0d8" />
        </linearGradient>
        <radialGradient id={`${uid}glow`}>
          <stop offset="0" stopColor="#dff0ff" />
          <stop offset="1" stopColor="#dff0ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}shade`}>
          <stop offset="0" stopColor="#0f2a66" />
          <stop offset="1" stopColor="#0f2a66" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}ground`}>
          <stop offset="0" stopColor="#18261b" stopOpacity=".32" />
          <stop offset=".6" stopColor="#18261b" stopOpacity=".14" />
          <stop offset="1" stopColor="#18261b" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${uid}stitch`} width="9" height="7.6" patternUnits="userSpaceOnUse">
          <path d="M.6 5.2 q1.9 -3.2 3.8 0 M5.1 1.4 q1.9 -3.2 3.8 0 M5.1 9 q1.9 -3.2 3.8 0" fill="none" stroke="#17408f" strokeWidth=".9" opacity=".2" />
        </pattern>
        <pattern id={`${uid}weave`} width="9" height="7.6" patternUnits="userSpaceOnUse">
          <path d="M.6 5.2 q1.9 -3.2 3.8 0 M5.1 1.4 q1.9 -3.2 3.8 0 M5.1 9 q1.9 -3.2 3.8 0" fill="none" stroke="#8f3d0a" strokeWidth=".9" opacity=".24" />
        </pattern>
        <clipPath id={`${uid}skull`}><path d={SKULL} /></clipPath>
        <clipPath id={`${uid}torso`}><path d={BODY} /></clipPath>
        <clipPath id={`${uid}mouth`}><path d={MOUTH} /></clipPath>
        <clipPath id={`${uid}eyeL`}><ellipse cx="157" cy="184" rx="19" ry="20.5" /></clipPath>
        <clipPath id={`${uid}eyeR`}><ellipse cx="243" cy="184" rx="19" ry="20.5" /></clipPath>
        <clipPath id={`${uid}vest`}><path d={VEST_PANEL} /></clipPath>
        <clipPath id={`${uid}toe`}><path d={TOE} /></clipPath>
        <clipPath id={`${uid}tailBase`}><path d={TAIL_BASE} /><circle cx="306" cy="468" r="15" /></clipPath>
        <clipPath id={`${uid}tailTip`}><path d={TAIL_TIP} /></clipPath>
        <clipPath id={`${uid}upperArm`}><path d="M143 286 L157 308 L120 332 L106 310 Z" /></clipPath>
        <clipPath id={`${uid}thigh`}><path d="M154 430 h38 v38 h-38 Z" /></clipPath>
      </defs>

      {headOnly ? (
        <g className="cosmo-figure">{head}</g>
      ) : (
        <>
          <ellipse className="cosmo-shadow" cx="204" cy="545" rx="112" ry="13" fill={ref("ground")} />
          <Joint at={[200, 546]} className="cosmo-figure">
            <Joint at={[252, 428]} className="cosmo-tail">
              <path d={TAIL_BASE} fill={ref("belly")} />
              <circle cx="306" cy="468" r="15" fill="#4a84d0" />
              <g clipPath={ref("tailBase")}>
                <Knit strands={tailKnit} />
                <path d="M246 452 C266 458 282 466 296 480 L306 484" fill="none" stroke="#143a86" strokeWidth="14" opacity=".2" />
                <path d={TAIL_BASE} fill={ref("stitch")} />
              </g>
              <Joint at={[306, 468]} className="cosmo-tail-tip">
                <path d={TAIL_TIP} fill="#4a84d0" />
                <g clipPath={ref("tailTip")}>
                  <Knit strands={tailKnit} />
                  <path d="M296 480 C310 492 324 508 337 524" fill="none" stroke="#143a86" strokeWidth="12" opacity=".22" />
                  <path d="M318 458 C332 478 343 498 349 514" fill="none" stroke="#b5d7fa" strokeWidth="3" opacity=".3" />
                  <path d={TAIL_TIP} fill={ref("stitch")} />
                </g>
              </Joint>
            </Joint>

            <g>{boot}</g>
            <g transform={mirror}>{boot}</g>
            <Badge x={155.5} y={484} small />
            <Badge x={217.5} y={484} small />

            <Joint at={[200, 456]} className="cosmo-upper">
              <path d={BODY} fill={ref("belly")} />
              <g clipPath={ref("torso")}>
                <Knit strands={hipKnit} />
                <ellipse cx="192" cy="352" rx="42" ry="60" fill={ref("glow")} opacity=".42" />
                <path d="M124 372 C126 424 160 450 200 450 C240 450 274 424 276 372" fill="none" stroke="#143a86" strokeWidth="20" opacity=".16" />
                <path d="M178 300 C176 336 174 372 174 404 M222 300 C224 336 226 372 226 404" fill="none" stroke="#143a86" strokeWidth="12" opacity=".2" />
                <path d={BODY} fill={ref("stitch")} />
                <ellipse cx="200" cy="284" rx="78" ry="26" fill={ref("shade")} opacity=".62" />
              </g>

              <path d="M158 270 Q200 256 242 270 L238 286 Q200 274 162 286 Z" fill="#b9530e" />
              <g>{vestPanel}</g>
              <g transform={mirror}>{vestPanel}</g>
              <g transform="rotate(-3 147 318)"><Badge x={128} y={308} /></g>
              <g transform="rotate(3 253 318)"><Badge x={234} y={308} /></g>

              <g className="cosmo-arm-l">{arm}</g>
              {head}
              <g className="cosmo-arm-r" transform={mirror}>
                {arm}
              </g>
            </Joint>
          </Joint>
        </>
      )}
    </svg>
  );
}
