import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { CosmoPose } from "./mascot";

export type CosmoView = "full" | "bust";
export type CosmoMood = { pose: CosmoPose; talking: boolean; listening: boolean; facing?: number };

const yarnInk = ["#5f35ac", "#7b2f9e", "#96308c", "#45329a"];
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, color = true) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// İlmek ilmek boyanmış yüzey: her hücre bir ilmek, `purple` o ilmeğin mor olma olasılığı.
function knitTexture(cols: number, rows: number, base: [number, number, number], purple: (u: number, v: number) => number, seed: number) {
  const cell = 12;
  return canvasTexture(cols * cell, rows * cell, (ctx) => {
    const rand = seeded(seed);
    ctx.fillStyle = `rgb(${base.map((c) => Math.round(c * 0.86)).join(",")})`;
    ctx.fillRect(0, 0, cols * cell, rows * cell);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const u = (col + 0.5) / cols;
        const v = (row + 0.5) / rows;
        const roll = rand();
        const tint = 0.92 + rand() * 0.16;
        const hue = rand();
        ctx.fillStyle =
          roll < purple(u, v)
            ? yarnInk[Math.min(3, Math.floor((Math.sin(col * 0.5 + row * 0.35) + 1) * 1.1 + hue * 1.8))]
            : `rgb(${base.map((c) => Math.round(clamp(c * tint, 0, 255))).join(",")})`;
        ctx.beginPath();
        ctx.ellipse((col + (row % 2 ? 1 : 0.5)) * cell, (row + 0.5) * cell, cell * 0.52, cell * 0.44, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

const SKIN: [number, number, number] = [62, 118, 208];

function makeTextures() {
  const bump = canvasTexture(
    48,
    32,
    (ctx) => {
      ctx.fillStyle = "#6a6a6a";
      ctx.fillRect(0, 0, 48, 32);
      for (let row = 0; row < 4; row++) {
        for (let col = -1; col < 4; col++) {
          const x = (col + (row % 2 ? 1 : 0.5)) * 16;
          const y = row * 8 + 4;
          const light = ctx.createRadialGradient(x, y - 1, 0.5, x, y, 8);
          light.addColorStop(0, "#f2f2f2");
          light.addColorStop(1, "#6a6a6a");
          ctx.fillStyle = light;
          ctx.beginPath();
          ctx.ellipse(x, y, 7.4, 3.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    false,
  );
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;

  // Küre haritasında u=0.25 ön, u=0.5 bakana göre sağ yan.
  const head = knitTexture(96, 48, SKIN, (u, v) => {
    const sin = Math.sin(v * Math.PI);
    const x = -Math.cos(u * 2 * Math.PI) * sin;
    const z = Math.sin(u * 2 * Math.PI) * sin;
    const y = Math.cos(v * Math.PI);
    if (z > 0 && (x / 0.74) ** 2 + ((y + 0.16) / 0.6) ** 2 < 1) return 0;
    const cheek = 0.6 * (1 - Math.hypot(x + 0.86, y + 0.42, z - 0.3) / 0.24);
    return Math.max(clamp((y - 0.4 + Math.max(0, x - 0.3) * 1.6) / 0.2 + 0.4, 0, 0.95), cheek);
  }, 7);
  const body = knitTexture(64, 44, SKIN, (u, v) => clamp((v - 0.62 + 0.03 * Math.sin(u * 44)) / 0.1 + 0.3, 0, 0.92), 19);
  const limb = knitTexture(16, 12, SKIN, (u, v) => 0.3 + 0.4 * Math.sin(u * 9) * Math.sin(v * 7), 31);
  limb.wrapS = limb.wrapT = THREE.RepeatWrapping;

  const badge = canvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = "#1e459c";
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(11, 11, 234, 106);
    ctx.fillStyle = "#fff";
    ctx.font = "800 54px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COSMO", 128, 76);
    ctx.font = "26px Arial";
    ctx.fillText("★", 128, 106);
  });
  const iris = canvasTexture(128, 128, (ctx) => {
    const fill = ctx.createRadialGradient(52, 46, 4, 64, 64, 64);
    fill.addColorStop(0, "#8ec2f8");
    fill.addColorStop(0.6, "#3a72d2");
    fill.addColorStop(1, "#1c3f9f");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = "#d3e6ff55";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 44; i++) {
      const angle = (i / 44) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(angle) * 30, 64 + Math.sin(angle) * 30);
      ctx.lineTo(64 + Math.cos(angle) * 56, 64 + Math.sin(angle) * 56);
      ctx.stroke();
    }
  });
  const ground = canvasTexture(128, 128, (ctx) => {
    const fill = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    fill.addColorStop(0, "#18261b70");
    fill.addColorStop(0.55, "#18261b2e");
    fill.addColorStop(1, "#18261b00");
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 128, 128);
  });
  return { bump, head, body, limb, badge, iris, ground };
}

function makeMaterials(tex: ReturnType<typeof makeTextures>) {
  const stitched = (repeatX: number, repeatY: number) => {
    const map = tex.bump.clone();
    map.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    return map;
  };
  const yarn = (options: THREE.MeshPhysicalMaterialParameters, repeat: [number, number], sheen = "#cfe4ff") =>
    new THREE.MeshPhysicalMaterial({
      roughness: 0.94,
      sheen: 0.3,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(sheen),
      bumpMap: stitched(...repeat),
      bumpScale: 1.1,
      ...options,
    });
  const flat = (color: string, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness });
  const skin = "#3e76d0";
  const limb = tex.limb;
  limb.repeat.set(2, 2);

  return {
    skinHead: yarn({ map: tex.head }, [44, 22]),
    skinBody: yarn({ map: tex.body }, [32, 17]),
    skinLimb: yarn({ map: limb }, [10, 7]),
    hand: yarn({ color: "#5c95e4" }, [7, 5]),
    lid: yarn({ color: skin }, [5, 4]),
    brow: flat("#2a5fb6", 0.9),
    cloth: yarn({ color: "#e86f14", side: THREE.DoubleSide }, [30, 13], "#ffd9ad"),
    pocket: yarn({ color: "#f08224" }, [7, 6], "#ffd9ad"),
    trim: yarn({ color: "#b9530e" }, [16, 2], "#ffb877"),
    badge: new THREE.MeshStandardMaterial({ map: tex.badge, roughness: 0.8 }),
    sole: yarn({ color: "#24509f" }, [8, 3]),
    sclera: flat("#f4f7fb", 0.25),
    rim: flat("#18346b", 0.5),
    iris: new THREE.MeshStandardMaterial({ map: tex.iris, roughness: 0.3 }),
    pupil: flat("#0c1838", 0.2),
    glint: new THREE.MeshBasicMaterial({ color: "#fff" }),
    mouth: flat("#4d1d33", 0.8),
    teeth: flat("#f6f4ee", 0.4),
    tongue: flat("#d9627f", 0.5),
    starCup: yarn({ color: "#2a6fbf" }, [4, 4]),
    silver: new THREE.MeshStandardMaterial({ color: "#e9eef7", roughness: 0.32, metalness: 0.55, emissive: "#5d6f8f", emissiveIntensity: 0.35 }),
  } as Record<string, THREE.Material>;
}

// Büst tuvali kutusundan yukarı ve iki yana bu oranlarda taşar (mascot.css ile aynı
// değerler); dinlerken büyüyen Cosmo ve uzayan antenler o boşluğa çizilir.
const HEADROOM = 1.1;
const SIDEROOM = 0.6;

const framing = {
  full: { centerY: 2.95, halfHeight: 3.3, halfWidth: 2.05, headroom: 0, sideroom: 0 },
  bust: { centerY: 4.05, halfHeight: 2.05, halfWidth: 1.5, headroom: HEADROOM, sideroom: SIDEROOM },
};

// Model, dokular ve malzemeler bir kez hazırlanır; her sahne kendi kopyasını alır.
// Böylece Cosmo bir yerde kapanıp başka yerde açıldığında yeniden yükleme olmaz.
let assets: ReturnType<typeof prepare> | undefined;
async function prepare() {
  const gltf = await new GLTFLoader().loadAsync("/cosmo.glb");
  const textures = makeTextures();
  const materials = makeMaterials(textures);
  gltf.scene.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) mesh.material = materials[(mesh.material as THREE.Material).name] ?? mesh.material;
  });
  return { gltf, ground: textures.ground };
}

export async function mountCosmo(canvas: HTMLCanvasElement, view: CosmoView, mood: () => CosmoMood, onReady: () => void) {
  const { gltf, ground } = await (assets ??= prepare());
  const model = gltf.scene.clone(true);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  scene.add(model);
  scene.add(new THREE.HemisphereLight("#ffffff", "#8fa58c", 0.95));
  const key = new THREE.DirectionalLight("#fff6ea", 2.1);
  key.position.set(-3.5, 7, 6);
  const rim = new THREE.DirectionalLight("#bcd6ff", 1.3);
  rim.position.set(4.5, 4, -5);
  const fill = new THREE.DirectionalLight("#ffffff", 0.5);
  fill.position.set(4, 1, 5);
  scene.add(key, rim, fill);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.4),
    new THREE.MeshBasicMaterial({ map: ground, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  const frame = framing[view];
  function fit() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    // Kadraj kutunun kendisine göre kurulur; fazladan alan aynı görüşün üstüne ve yanlarına eklenir.
    const boxHeight = height / (1 + frame.headroom);
    const boxWidth = width / (1 + 2 * frame.sideroom);
    camera.aspect = boxWidth / boxHeight;
    if (frame.headroom) camera.setViewOffset(boxWidth, boxHeight, (boxWidth - width) / 2, boxHeight - height, width, height);
    const reach = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(frame.halfHeight / reach, frame.halfWidth / (reach * camera.aspect));
    camera.position.set(0, frame.centerY + distance * 0.07, distance);
    camera.lookAt(0, frame.centerY, 0);
    camera.updateProjectionMatrix();
  }
  fit();

  const node = (name: string) => model.getObjectByName(name)!;
  const head = node("head");
  const mouth = node("mouth");
  const face = (["L", "R"] as const).map((tag) => {
    const pupil = node(`pupil${tag}`);
    const brow = node(`brow${tag}`);
    return {
      pupil,
      pupilHome: pupil.position.clone(),
      lid: node(`lid${tag}`),
      brow,
      browHome: brow.position.clone(),
      antenna: node(`ant${tag}`),
      tip: node(`antTip${tag}`),
      star: node(`star${tag}`),
      stalk: node(`stalk${tag}`),
      stem: node(`stem${tag}`),
      side: tag === "L" ? -1 : 1,
    };
  });

  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
  actions.jump.setLoop(THREE.LoopOnce, 1);
  actions.jump.clampWhenFinished = true;
  let playing = actions.idle.play();
  function play(pose: CosmoPose) {
    const next = actions[pose] ?? actions.idle;
    if (next === playing) return;
    if (calm) {
      // Hareket azaltma açıkken geçiş yok; pozun ortasındaki bir kare gösterilir.
      playing.stop();
      next.reset().play();
      next.time = next.getClip().duration * 0.3;
    } else {
      next.reset().fadeIn(0.35).play();
      playing.fadeOut(0.35);
    }
    playing = next;
  }
  mixer.addEventListener("finished", () => play("idle"));

  const gaze = { x: 0, y: 0, toX: 0, toY: 0 };
  function follow(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    const reach = Math.max(box.width * 2.5, 320);
    gaze.toX = clamp((event.clientX - (box.left + box.width / 2)) / reach, -1, 1);
    gaze.toY = clamp((event.clientY - (box.top + box.height * 0.35)) / reach, -1, 1);
  }
  window.addEventListener("pointermove", follow, { passive: true });

  const clock = new THREE.Clock();
  const turn = new THREE.Quaternion();
  const euler = new THREE.Euler();
  let blinkAt = 2;
  let lidNow = 0.02;
  let perk = 0;
  let perkSpeed = 0;
  let shownPose: CosmoPose | null = null;
  let visible = true;
  let frameId = 0;

  function tick() {
    frameId = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const dt = calm ? 0 : Math.min(clock.getDelta(), 0.05);
    const now = calm ? 0 : clock.elapsedTime;
    const settle = (rate: number) => (calm ? 1 : 1 - Math.exp(-dt * rate));
    const { pose, talking, listening, facing = 0 } = mood();
    if (pose !== shownPose) {
      shownPose = pose;
      play(pose);
    }
    mixer.update(dt);

    const asleep = pose === "sleep";
    const ease = settle(7);
    const roaming = pose === "walk";
    gaze.x += ((asleep || roaming || calm ? 0 : gaze.toX) - gaze.x) * ease;
    gaze.y += ((asleep || roaming || calm ? 0 : gaze.toY) - gaze.y) * ease;
    model.rotation.y += (facing - model.rotation.y) * settle(6);

    // Dinleme yay gibi açılır: hedefi hafifçe aşıp yerine oturur.
    if (calm) {
      perk = listening ? 1 : 0;
    } else {
      perkSpeed += ((listening ? 1 : 0) - perk) * 90 * dt - perkSpeed * 11 * dt;
      perk += perkSpeed * dt;
    }
    // Dinlerken başını yana eğip sağ antenini konuşana doğru uzatır.
    const nod = talking ? Math.sin(now * 5.2) * 0.02 : 0;
    head.quaternion.multiply(turn.setFromEuler(euler.set(gaze.y * 0.22 + nod + perk * 0.05, gaze.x * 0.42 - perk * 0.2, -perk * 0.1)));

    if (now > blinkAt) blinkAt = now + 2.4 + Math.random() * 3.6 + (Math.random() < 0.2 ? -2.2 : 0);
    const blinking = !calm && blinkAt - now < 0.13;
    const lidGoal = asleep || blinking ? 1 : pose === "think" ? 0.3 : 0.02;
    lidNow += (lidGoal - lidNow) * settle(blinking ? 38 : 16);

    const throb = perk * Math.sin(now * 5) * 0.04;

    for (const part of face) {
      // Sağ anten "kulak": uzun uzar ve öne eğilir; soldaki yalnızca biraz dikleşir.
      // Yalnız saplar uzar; yıldız ezilmesin diye eklem ve yıldız yerleri sapla birlikte kayar.
      const ear = part.side > 0;
      const stretch = 1 + perk * (ear ? 1.5 : 0.35) + (ear ? throb : 0);
      part.antenna.scale.setScalar(1 + perk * (ear ? 0.2 : 0.06));
      part.stalk.scale.y = stretch;
      part.stalk.position.y = 0.25 * stretch;
      part.tip.position.y = 0.5 * stretch;
      part.stem.scale.y = stretch;
      part.stem.position.y = 0.22 * stretch;
      part.star.position.y = 0.56 * stretch;
      part.star.scale.setScalar(1 + perk * (ear ? 0.9 : 0.2) + (ear ? throb : 0));
      // Sap öne eğilince yıldızın gümüş yüzü yere bakar; geri çevrilip bakana döndürülür.
      part.star.rotation.x = ear ? -perk * 0.85 : 0;
      if (perk > 0.001) {
        const lean = ear ? perk * 0.5 : 0;
        const sway = ear ? Math.sin(now * 2.2) * 0.03 * perk : 0;
        part.antenna.quaternion.multiply(turn.setFromEuler(euler.set(lean, 0, (ear ? -0.1 : 0.1) * perk + sway)));
        part.tip.quaternion.multiply(turn.setFromEuler(euler.set(lean * 0.7, 0, 0)));
      }
      part.lid.scale.y = lidNow;
      part.pupil.position.set(
        part.pupilHome.x + gaze.x * 0.045 + (pose === "think" ? -0.035 : 0),
        part.pupilHome.y - gaze.y * 0.035 + (pose === "think" ? 0.04 : 0),
        part.pupilHome.z,
      );
      const raise = listening ? 0.035 : pose === "think" && part.side < 0 ? 0.04 : 0;
      part.brow.position.y += (part.browHome.y + raise - part.brow.position.y) * ease;
    }

    const open = talking
      ? 0.5 + 0.5 * Math.abs(Math.sin(now * 11.3) * Math.sin(now * 3.7 + 1))
      : asleep || pose === "think"
        ? 0.3
        : 1;
    mouth.scale.y += (open - mouth.scale.y) * settle(24);
    mouth.scale.x += ((asleep || pose === "think" ? 0.62 : 1) - mouth.scale.x) * ease;

    const breath = 1 + Math.sin(now * (asleep ? 1.1 : 1.7)) * (asleep ? 0.012 : 0.006);
    const grow = 1 + perk * 0.16;
    model.scale.set(grow, grow * breath, grow);
    const air = model.position.y;
    shadow.scale.setScalar(1 - air * 0.45);
    (shadow.material as THREE.MeshBasicMaterial).opacity = 1 - air * 0.9;

    renderer.render(scene, camera);
  }

  const resize = new ResizeObserver(fit);
  resize.observe(canvas);
  const watch = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
  watch.observe(canvas);
  tick();
  onReady();

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener("pointermove", follow);
    resize.disconnect();
    watch.disconnect();
    renderer.dispose();
  };
}
