/* NolaPrint : le mug en 3D, directement à la place de la photo de la fiche produit.
   - Chargé par np.js après la page, seulement sur la fiche du mug (attribut data-np-3d) ; sans WebGL, la photo reste.
   - Aucun texte n'est dessiné ici (décisions 08 et 10) : la texture est l'image de la zone d'impression rendue par
     le serveur (même code que le fichier d'impression), plaquée sur le panneau imprimable (événement « np:print »).
     Sans serveur, np.js envoie l'image d'exemple de la variante, sans texte.
   - On fait tourner le mug au doigt ou à la souris (glisser horizontal) ; le défilement vertical de la page reste libre.
   - Sous l'image, une barre directionnelle (curseur + flèches) tourne aussi le mug et suit sa position.
   Three.js r169 (licence MIT) : assets/np-three.min.js. */
import * as THREE from "./np-three.min.js";

/* ---------- Mug 11 oz, en millimètres ---------- */
/* Zone d'impression Printify du blueprint 1016 (Textildruck Europa), confirmée par l'API le 02/11/2026 :
   un seul panneau de 2475 × 1155 px, soit 210 × 98 mm, centré à l'opposé de l'anse ; sous l'anse, rien. */
const R = 41, H = 98.5, WALL = 3, FLOOR = 6.5;
const BAND = { y0: 0.25, y1: 98.25 };                  /* 98 mm de haut */
const PRINT_W = 210;                                   /* largeur du panneau */
const TEX_W = 2048, PX = TEX_W / (2 * Math.PI * R);    /* texture = tour complet, 7,95 px/mm */
const TEX_H = Math.round((BAND.y1 - BAND.y0) * PX);
const PRINT = { x: (TEX_W - PRINT_W * PX) / 2, w: PRINT_W * PX };
/* Pose de repos : le milieu du panneau face à soi, l'anse derrière */
const REST = Math.PI / 2;

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = k => 0.5 - 0.5 * Math.cos(Math.PI * k);

/* ---------- Géométrie ---------- */
function bodyGeometry(){
  const p = [], v = (x, y) => p.push(new THREE.Vector2(x, y));
  const arc = (cx, cy, r, a0, a1, n) => { for(let i = 0; i <= n; i++){ const a = a0 + (a1 - a0) * i / n; v(cx + r * Math.cos(a), cy + r * Math.sin(a)); } };
  const foot = 2.6, lip = WALL / 2, fillet = 5;
  v(0.01, 0.8); v(R - foot - 3, 0.25);
  arc(R - foot, foot, foot, -Math.PI / 2, 0, 8);               /* arrondi du pied */
  arc(R - lip, H - lip, lip, 0, Math.PI, 14);                   /* bord arrondi */
  arc(R - WALL - fillet, FLOOR + fillet, fillet, 0, -Math.PI / 2, 8);  /* fond intérieur */
  v(0.01, FLOOR);
  return new THREE.LatheGeometry(p, 160);
}

/* Anse : une ellipse (6,8 x 12 mm) balayée le long d'un « C » ; les bouts restent dans l'épaisseur de la paroi */
function handleGeometry(){
  const pts = [[R - 1.6, 85.5], [R + 5, 86.6], [R + 13.5, 85.8], [R + 20.8, 81.5], [R + 25.2, 73.5], [R + 26.8, 62],
               [R + 26.2, 50], [R + 23.6, 40], [R + 18.4, 32], [R + 10.5, 28], [R + 3.5, 27.2], [R - 1.6, 27]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const N = 120, M = 28, a = 3.4, b = 6, pos = [], nor = [], idx = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), n = new THREE.Vector3();
  for(let i = 0; i <= N; i++){
    curve.getPointAt(i / N, P); curve.getTangentAt(i / N, T);
    const nx = T.y, ny = -T.x, l = Math.hypot(nx, ny);
    for(let j = 0; j <= M; j++){
      const ph = j / M * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
      pos.push(P.x + nx / l * a * c, P.y + ny / l * a * c, b * s);
      n.set(nx / l * c / a, ny / l * c / a, s / b).normalize();
      nor.push(n.x, n.y, n.z);
    }
  }
  for(let i = 0; i < N; i++) for(let j = 0; j < M; j++){
    const A = i * (M + 1) + j, B = A + M + 1;
    idx.push(A, B, A + 1, B, B + 1, A + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

/* Lumière de studio pour les reflets de l'émail (d'après RoomEnvironment de three.js, MIT) */
function studio(){
  const s = new THREE.Scene(), box = new THREE.BoxGeometry();
  box.deleteAttribute("uv");
  const room = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ side: THREE.BackSide }));
  room.position.set(-0.757, 13.219, 0.717); room.scale.set(31.713, 28.305, 28.591); s.add(room);
  const bulb = new THREE.PointLight(0xffffff, 900, 28, 2); bulb.position.set(0.418, 16.199, 0.3); s.add(bulb);
  const lamp = (i, p, sc) => { const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(i) })); m.position.set(...p); m.scale.set(...sc); s.add(m); };
  lamp(50, [-16.116, 14.37, 8.208], [0.1, 2.428, 2.739]);
  lamp(50, [-16.109, 18.021, -8.207], [0.1, 2.425, 2.751]);
  lamp(17, [14.904, 12.198, -1.832], [0.15, 4.265, 6.331]);
  lamp(43, [-0.462, 8.89, 14.52], [4.38, 5.441, 0.088]);
  lamp(20, [3.235, 11.486, -12.541], [2.5, 2, 0.1]);
  lamp(100, [0, 20, 0], [1, 0.1, 1]);
  return s;
}

/* Ombre de contact sous le mug (dégradé radial) */
function contactShadow(){
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(0,0,0,.42)"); grad.addColorStop(0.55, "rgba(0,0,0,.30)"); grad.addColorStop(0.72, "rgba(0,0,0,.08)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.9, R * 2.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.renderOrder = -1;
  return m;
}

/* ---------- Mise en place sur une fiche ---------- */
function mount(stage){
  if(stage.np3d) return;
  const canvas = document.createElement("canvas");
  canvas.className = "np-3d"; canvas.tabIndex = 0;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Votre mug en 3D : faites-le glisser pour le tourner");
  let renderer;
  try{ renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }catch(e){ return; }
  stage.np3d = true;
  stage.appendChild(canvas);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.04).texture;
  pmrem.dispose();

  /* Cadrage proche des photos : mug à gauche, anse à droite, vue légèrement plongeante */
  const cam = new THREE.PerspectiveCamera(17.8, 1, 50, 2000);
  cam.position.set(8.3, 174.5, 517.6); cam.lookAt(8.3, 46, 0);

  scene.environmentIntensity = 0.55;
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-420, 300, 120); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 9;
  Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 100, far: 1200 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.ShadowMaterial({ opacity: 0.09 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground, contactShadow());

  /* Texture : la bande imprimable, sur tout le tour (u = 0 sous l'anse) */
  const tex = document.createElement("canvas"); tex.width = TEX_W; tex.height = TEX_H;
  const ctx = tex.getContext("2d");
  const map = new THREE.CanvasTexture(tex);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const glaze = { color: 0xffffff, roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 };
  const body = new THREE.Mesh(bodyGeometry(), new THREE.MeshPhysicalMaterial(glaze));
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.04, R + 0.04, BAND.y1 - BAND.y0, 192, 1, true, Math.PI / 2, Math.PI * 2),
    new THREE.MeshPhysicalMaterial(Object.assign({ map }, glaze)));
  band.position.y = (BAND.y0 + BAND.y1) / 2;
  const handle = new THREE.Mesh(handleGeometry(), body.material);
  const mug = new THREE.Group();
  mug.add(body, band, handle);
  [body, handle, band].forEach(m => { m.castShadow = true; m.receiveShadow = true; });
  scene.add(mug);

  /* ---------- Dessin de la bande : l'image de la zone d'impression, rien d'autre ---------- */
  let painted = null, revealed = false;
  function paint(){
    const img = stage.npPrint;
    if(!img || !(img.naturalWidth || img.width)) return;
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.drawImage(img, PRINT.x, 0, PRINT.w, TEX_H);
    map.needsUpdate = true;
    if(revealed && painted && painted !== img) toRest();
    painted = img;
    if(!revealed) reveal();
    kick();
  }

  /* ---------- Rotation : glisser, inertie, retour face avant ---------- */
  /* Point du panneau face à soi au repos (mm) : 105 = milieu ; « Le goûter » : entre la scène et la colonne de texte */
  let off = 0;
  const offDe = () => -((+stage.dataset.npCentre || 105) - 105) / 41;
  off = offDe();
  let rot = REST + off, vel = 0, glide = null, drag = false, lastX = 0, lastT = 0, raf = 0, prev = 0, touched = false;
  mug.rotation.y = rot;
  /* Une image n'est calculée que si quelque chose bouge (pas de boucle permanente) */
  function frame(now){
    raf = 0;
    const dt = prev ? Math.min(0.05, Math.max(0, now - prev) / 1000) : 0.016; prev = now;
    if(glide){
      const k = Math.min(1, Math.max(0, (now - glide.t0) / glide.ms));
      rot = glide.from + (glide.to - glide.from) * ease(k);
      if(k >= 1) glide = null;
    } else if(!drag && Math.abs(vel) > 0.02){
      rot += vel * dt; vel *= Math.exp(-dt * 3.2);
    } else if(!drag) vel = 0;
    mug.rotation.y = rot;
    renderer.render(scene, cam);
    syncBar();
    if(glide || drag || vel) kick(); else prev = 0;
  }
  function kick(){ if(!raf) raf = requestAnimationFrame(frame); }
  const rest = () => REST + off + 2 * Math.PI * Math.round((rot - REST - off) / (2 * Math.PI));
  function turnTo(to, ms){ glide = { from: rot, to, t0: performance.now(), ms: reduced ? 1 : ms }; vel = 0; kick(); }
  function toRest(){ if(drag) return; const to = rest(); if(Math.abs(to - rot) > 0.02) turnTo(to, 650); }

  const hintEl = document.createElement("span");
  hintEl.className = "np-3d-hint"; hintEl.hidden = true;
  hintEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l-4 3 4 3M17 9l4 3-4 3M3 12h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Faites tourner le mug';
  stage.appendChild(hintEl);
  const seen = () => { if(touched) return; touched = true; hintEl.classList.add("is-off"); };

  /* Barre directionnelle sous l'image : 0 = face avant, −180° à +180° */
  const bar = document.createElement("div");
  bar.className = "np-3d-bar"; bar.hidden = true;
  const arrow = d => '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  bar.innerHTML = '<button type="button" class="np-3d-step" data-step="-1" aria-label="Tourner le mug vers la gauche">' + arrow("M15 6l-6 6 6 6") + '</button>'
    + '<input class="np-3d-range" type="range" min="-180" max="180" step="1" value="0" aria-label="Faire tourner le mug" aria-valuetext="face avant">'
    + '<button type="button" class="np-3d-step" data-step="1" aria-label="Tourner le mug vers la droite">' + arrow("M9 6l6 6-6 6") + '</button>';
  stage.insertAdjacentElement("afterend", bar);
  const range = bar.querySelector("input");
  let sliding = false;
  const restBase = () => REST + off;
  stage.addEventListener("np:centre", () => { const o = offDe(); if(Math.abs(o - off) > 1e-3){ off = o; toRest(); } });
  function syncBar(){
    if(sliding) return;
    let deg = (rot - restBase()) * 180 / Math.PI;
    deg = ((deg + 180) % 360 + 360) % 360 - 180;
    range.value = Math.round(deg);
    range.style.setProperty("--p", ((Math.round(deg) + 180) / 3.6).toFixed(1) + "%");
    range.setAttribute("aria-valuetext", Math.abs(deg) < 5 ? "face avant" : Math.round(deg) + " degrés");
  }
  range.addEventListener("input", () => {
    sliding = true; glide = null; vel = 0; seen();
    const want = restBase() + range.value * Math.PI / 180;
    rot = want + 2 * Math.PI * Math.round((rot - want) / (2 * Math.PI));
    range.style.setProperty("--p", ((+range.value + 180) / 3.6).toFixed(1) + "%");
    kick();
  });
  const endSlide = () => { sliding = false; };
  range.addEventListener("change", endSlide);
  range.addEventListener("pointerup", endSlide);
  range.addEventListener("blur", endSlide);
  bar.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => {
    seen(); sliding = false;
    turnTo((glide ? glide.to : rot) + Number(b.dataset.step) * Math.PI / 4, 380);
  }));

  canvas.addEventListener("pointerdown", e => {
    if(e.button > 0) return;
    drag = true; glide = null; vel = 0; lastX = e.clientX; lastT = e.timeStamp;
    try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    seen(); kick();
  });
  canvas.addEventListener("pointermove", e => {
    if(!drag) return;
    const d = (e.clientX - lastX) / Math.max(200, canvas.clientWidth) * Math.PI * 1.6, dt = Math.max(8, e.timeStamp - lastT) / 1000;
    rot += d; vel = 0.75 * (d / dt) + 0.25 * vel;
    lastX = e.clientX; lastT = e.timeStamp; kick();
  });
  const release = e => {
    if(!drag) return;
    drag = false;
    if(reduced || e.timeStamp - lastT > 90) vel = 0;
    vel = Math.max(-14, Math.min(14, vel)); kick();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("keydown", e => {
    if(e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault(); seen();
    turnTo((glide ? glide.to : rot) + (e.key === "ArrowRight" ? 1 : -1) * Math.PI / 4, 380);
  });

  /* Taille : suit la case de la photo */
  function resize(){
    const w = stage.clientWidth, h = stage.clientHeight || w;
    if(!w) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    renderer.render(scene, cam);
  }
  if("ResizeObserver" in window) new ResizeObserver(resize).observe(stage); else addEventListener("resize", resize);
  resize();

  /* Première image 3D prête : fondu sur la photo, puis un tour complet pour montrer tous les côtés */
  function reveal(){
    revealed = true;
    renderer.render(scene, cam);
    stage.classList.add("is-3d");
    hintEl.hidden = false;
    bar.hidden = false; syncBar();
    if(!reduced) setTimeout(() => { if(!touched && !drag) turnTo(rot + 2 * Math.PI, 3600); }, 900);
  }
  canvas.addEventListener("webglcontextlost", () => { stage.classList.remove("is-3d"); bar.hidden = true; });

  stage.addEventListener("np:print", paint);
  paint();
}

window.NPMug3D = { mount };
document.querySelectorAll("[data-np-3d]").forEach(mount);
