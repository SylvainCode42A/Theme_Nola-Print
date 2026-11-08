/* NolaPrint (Noël 2026) : en-tête, cookies, galerie par destinataire, démo, fiche produit (texte en trois champs,
   symbole par prénom, page blanche recadrée), aperçu rendu par le serveur, arrivée estimée, panier. */
(function(){
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
function toast(msg){
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; t.setAttribute("role", "status");
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}


/* ---------- Prix au format de la boutique, compteur du panier, chargement du mug 3D ---------- */
function moneyFmt(fmt){
  const f = String(fmt || "{{amount_with_comma_separator}} €").replace(/<[^>]*>/g, "");
  return cents => {
    const v = cents / 100, two = v.toFixed(2), whole = String(Math.round(v));
    return f.replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, two.replace(".", ","))
            .replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, whole)
            .replace(/\{\{\s*amount_no_decimals\s*\}\}/g, whole)
            .replace(/\{\{\s*amount_with_apostrophe_separator\s*\}\}/g, two)
            .replace(/\{\{\s*amount\s*\}\}/g, two);
  };
}
function updateCartCount(){
  fetch("/cart.js", { headers: { "Accept": "application/json" } }).then(r => r.json()).then(c => {
    const el = $("#cartCount"); if(el) el.textContent = c.item_count;
    const btn = $("#cartBtn"); if(btn) btn.setAttribute("aria-label", "Panier, " + c.item_count + " article" + (c.item_count > 1 ? "s" : ""));
  }).catch(() => {});
}

/* Mug en 3D (assets/np-mug3d.js, type module) : chargé une seule fois, après l'événement load, si WebGL 2 marche */
function load3d(stage){
  try{ if(!document.createElement("canvas").getContext("webgl2")) return; }catch(e){ return; }
  const go = () => {
    if(window.NPMug3D) return window.NPMug3D.mount(stage);
    const s = document.createElement("script"); s.type = "module"; s.src = stage.getAttribute("data-np-3d");
    document.head.appendChild(s);
  };
  if(document.readyState === "complete") go(); else addEventListener("load", go, { once: true });
}


/* ---------- Outils communs ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s == null ? "" : s).toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const formeKey = s => norm(s).split(" ")[0];
function loadImg(src){
  return new Promise((ok, ko) => {
    const im = new Image();
    if(!/^data:|^blob:/.test(src)) im.crossOrigin = "anonymous";
    im.decoding = "async";
    im.onload = () => ok(im); im.onerror = ko; im.src = src;
  });
}
const shopRoot = () => (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";

/* ---------- Galerie de l'accueil : onglets (objet) et puces (pour qui), ?pour=mamie ---------- */
function initGallery(sec){
  if(sec.dataset.npInit) return; sec.dataset.npInit = "1";
  const tabs = $$("[data-np-tab]", sec), chips = $$("[data-np-aud]", sec);
  let aud = "all";
  const apply = () => $$(".np-dcard", sec).forEach(c => {
    const a = (c.dataset.aud || "").split(" ");
    c.hidden = !(aud === "all" || a.includes("all") || a.includes(aud));
  });
  const pick = t => {
    tabs.forEach(x => x.setAttribute("aria-selected", x === t ? "true" : "false"));
    $$("[role='tabpanel']", sec).forEach(p => { p.hidden = p.id !== "np-grid-" + t.dataset.npTab; });
  };
  const choose = c => {
    aud = c.dataset.npAud;
    chips.forEach(x => x.setAttribute("aria-pressed", x === c ? "true" : "false"));
    apply();
  };
  tabs.forEach(t => t.addEventListener("click", () => pick(t)));
  chips.forEach(c => c.addEventListener("click", () => choose(c)));
  /* Lien direct depuis une publicité : /?pour=mamie#designs, /?objet=verre#designs */
  try{
    const q = new URLSearchParams(location.search);
    const c = chips.find(x => x.dataset.npAud === q.get("pour")); if(c) choose(c);
    const t = tabs.find(x => x.dataset.npTab === q.get("objet")); if(t) pick(t);
  }catch(e){}
}

/* ---------- Serveur d'aperçu (contrat « Contrat API aperçu NolaPrint ») ----------
   Le serveur compose l'image de la zone d'impression avec le même code que le fichier d'impression.
   Le navigateur ne dessine aucun texte : il plaque l'image reçue. */
function apercuClient(base){
  const api = String(base || "").trim().replace(/\/+$/, "");
  const cache = new Map();
  let ctrl = null;
  return {
    actif: !!api,
    async rendre(payload){
      const body = JSON.stringify(payload);
      if(cache.has(body)) return cache.get(body);
      if(ctrl) ctrl.abort();
      ctrl = new AbortController();
      const r = await fetch(api + "/v1/apercu", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: ctrl.signal });
      if(!r.ok) throw new Error("apercu " + r.status);
      const j = await r.json();
      const img = await loadImg(j.image);
      const res = { img, j };
      cache.set(body, res);
      if(cache.size > 30) cache.delete(cache.keys().next().value);
      return res;
    },
    async envoyer(file){
      const fd = new FormData(); fd.append("fichier", file);
      const r = await fetch(api + "/v1/images", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if(!r.ok) { const e = new Error("images " + r.status); e.code = j.code; throw e; }
      return j;
    }
  };
}
const ALERTES = {
  reduit: "Le texte a été un peu réduit pour tenir dans l'illustration.",
  trop_long: "Ce texte est long : nous le vérifierons à la main avant l'impression.",
  illisible: "Cette couleur se lit mal ici : essayez-en une autre."
};

/* ---------- Démo de l'accueil : un prénom tapé, rendu par le serveur ---------- */
function initDemo(box){
  if(box.dataset.npInit) return; box.dataset.npInit = "1";
  let cfg = {};
  try{ cfg = JSON.parse($("[data-np-demo-data]", box).textContent); }catch(e){ return; }
  const client = apercuClient(cfg.apercu);
  const base = $("[data-np-base]", box), input = $("[data-np-demo-input]", box), cta = $("[data-np-demo-cta]", box), etat = $("[data-np-demo-etat]", box);
  let dest = cfg.dest || "mamie", timer = 0;
  const draw = async () => {
    const v = input.value.trim();
    if(cta){
      const u = new URL(cta.dataset.base, location.origin);
      u.searchParams.set("pour", dest);
      cta.href = u.pathname + u.search;
    }
    if(!client.actif) return;
    try{
      if(etat){ etat.hidden = false; etat.textContent = "Aperçu en cours…"; }
      const { img } = await client.rendre({ version: 1, objet: "mug", forme: null, gabarit: "A", declinaison: "base", destinataire: dest,
        titre: (cfg.titres && cfg.titres[dest]) || "", prenoms: v ? [{ texte: v.slice(0, 15), symbole: "rose" }] : [], phrase: "", couleur: (cfg.couleurs && cfg.couleurs[dest]) || null, image: null, taille: "apercu" });
      if(box.npMug){ box.npMug.npPrint = img; box.npMug.dispatchEvent(new CustomEvent("np:print")); }
      else base.src = img.src;
      if(etat) etat.hidden = true;
    }catch(e){ if(e.name !== "AbortError" && etat){ etat.textContent = "Aperçu momentanément indisponible."; } }
  };
  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(draw, 400); });
  $$("[data-np-demo-dest]", box).forEach(b => b.addEventListener("click", () => {
    dest = b.dataset.npDemoDest;
    $$("[data-np-demo-dest]", box).forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
    if(b.dataset.img && !client.actif) base.src = b.dataset.img;
    draw();
  }));
  draw();
}

/* ---------- Fiche produit ----------
   Destinataire, forme (bois), déclinaison (mug A), titre / prénoms (avec symbole) / phrase, couleur,
   page blanche (photo, forme, recadrage), prix par variante (+1 € dès qu'un champ est rempli), lot de 3. */
const MAX_MB = 20, MIN_PX = 1200, BON_PX = 2000;
const FORMES_IMG = {
  sapin: "M0.5 0.02 L0.74 0.3 L0.64 0.3 L0.86 0.56 L0.74 0.56 L0.96 0.82 L0.56 0.82 L0.56 0.98 L0.44 0.98 L0.44 0.82 L0.04 0.82 L0.26 0.56 L0.14 0.56 L0.36 0.3 L0.26 0.3 Z",
  etoile: "M0.5 0.02 L0.618 0.358 L0.976 0.365 L0.69 0.582 L0.794 0.926 L0.5 0.72 L0.206 0.926 L0.31 0.582 L0.024 0.365 L0.382 0.358 Z",
  coeur: "M0.5 0.95 C0.2 0.72 0.02 0.52 0.02 0.3 C0.02 0.12 0.16 0.03 0.3 0.03 C0.4 0.03 0.47 0.09 0.5 0.18 C0.53 0.09 0.6 0.03 0.7 0.03 C0.84 0.03 0.98 0.12 0.98 0.3 C0.98 0.52 0.8 0.72 0.5 0.95 Z"
};
/* Contour d'une forme de l'image, du repère 0..1 de son cadre vers les pixels (contrat, section 3) */
function shapePath(forme, b){
  if(forme === "ovale"){
    const rx = b.w * 0.39, ry = b.h / 2, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return "M" + (cx - rx).toFixed(1) + " " + cy.toFixed(1) + " A" + rx.toFixed(1) + " " + ry.toFixed(1) + " 0 1 0 " + (cx + rx).toFixed(1) + " " + cy.toFixed(1)
      + " A" + rx.toFixed(1) + " " + ry.toFixed(1) + " 0 1 0 " + (cx - rx).toFixed(1) + " " + cy.toFixed(1) + " Z";
  }
  if(forme === "rond"){
    const r = b.w / 2, cx = b.x + r, cy = b.y + b.h / 2;
    return "M" + (cx - r).toFixed(1) + " " + cy.toFixed(1) + " A" + r.toFixed(1) + " " + r.toFixed(1) + " 0 1 0 " + (cx + r).toFixed(1) + " " + cy.toFixed(1)
      + " A" + r.toFixed(1) + " " + r.toFixed(1) + " 0 1 0 " + (cx - r).toFixed(1) + " " + cy.toFixed(1) + " Z";
  }
  return FORMES_IMG[forme].replace(/([0-9.]+) ([0-9.]+)/g, (m, a, c) => (b.x + a * b.w).toFixed(1) + " " + (b.y + c * b.h).toFixed(1));
}

function initPdp(root){
  if(root.dataset.npInit) return; root.dataset.npInit = "1";
  let data = {};
  try{ data = JSON.parse(($("[data-np-data]") || {}).textContent || "{}"); }catch(e){ return; }
  const form = $("#np-product-form");
  if(!form || !data.ref) return;
  const ref = data.ref, type = data.type, idx = data.idx || {}, variants = data.variants || [];
  const objet = type === "verre" ? "boule" : type;
  let gab = data.gabarit;   /* A (jardin, sapin), B (goûter) ou blanche (votre photo) : changeable dans la fiche des anciens produits */
  const fmt = moneyFmt(data.money);
  const client = apercuClient(data.apercu);
  const q1 = s => $(s, form), qa = s => $$(s, form);
  const stage = $("[data-np-stage]", root), base = $("[data-np-base]", stage), plaque = $("[data-np-plaque]", stage), etat = $("[data-np-apercu-etat]", stage);
  const variantIn = q1("[data-np-variant]"), propsBox = q1("[data-np-props]");
  const addBtn = q1("[data-np-add]"), addLabel = q1("[data-np-add-label]"), errEl = q1("[data-np-error]"), checkIn = q1("[data-np-check]");
  const retractEl = q1("[data-np-retract]"), qtyField = q1("[data-np-qty-field]"), qtyIn = $("#np-qty", form);
  const lotNote = q1("[data-np-lot-note]"), lotPill = q1("[data-np-lot-pill]");
  const limites = ref.limites || { prenoms: 6, prenom: 15, titre: 30, phrase: 40 };

  /* État de la personnalisation : la seule source des propriétés de ligne et de l'aperçu */
  const st = {
    dest: (q1("[data-np-dest]:checked") || {}).value || null,
    decl: data.decl || "base",
    forme: null, formeLabel: "",
    titre: "", prenoms: [], phrase: "", couleur: 0, bg: 0, mois: true,
    image: null,
    apercuId: "", apercuUrl: "", version: ""
  };
  const shapeChecked = q1("[data-np-shape]:checked");
  if(shapeChecked){ st.forme = shapeChecked.dataset.npShapeKey; st.formeLabel = shapeChecked.value; }
  let lot = false, lotN = 1, busy = false, timer = 0;

  const dref = () => (gab === "blanche" ? null : ref.destinataires[st.dest]) || null;
  const palette = () => (dref() || ref.blanche).couleurs;
  const couleur = () => palette()[Math.min(st.couleur, palette().length - 1)];
  const symboles = () => (ref.symboles && ref.symboles[st.decl]) || [];
  const symInfo = id => symboles().find(s => s.id === id) || null;
  const symLabel = s => s ? (s.mois ? s.nom + " (" + s.mois + ")" : s.nom) : "";
  /* Exemple de départ, le même que la maquette de la carte : la cliente le modifie, tout est visible en direct */
  const DEMO = {
    noms: ["Léa", "Hugo", "Jade"],
    surnom: { mamie: "Mamie", papy: "Papy", maman: "Maman", papa: "Papa", couple: "Papy et Mamie", famille: "la famille" },
    base: { mamie: ["rose", "tournesol", "muguet"], papy: ["tournesol", "violette", "muguet"], maman: ["muguet", "oeillet", "rose"],
            papa: ["pied-dalouette", "souci", "marguerite"], couple: ["rose", "houx", "jonquille"], famille: ["chrysantheme", "aster", "rose"] },
    noel: { mamie: ["boule", "etoile", "sapin"], papy: ["sapin", "flocon", "boule"], maman: ["coeur-noel", "etoile", "pain-depice"],
            papa: ["flocon", "sapin", "etoile"], couple: ["coeur-noel", "boule", "sapin"], famille: ["pain-depice", "sapin", "etoile"] }
  };
  const titreOmis = () => type === "verre" && gab === "A";   /* boule aux ornements : la branche prend la place du titre */
  const titrePhrase = t => !t ? "" : gab === "B" ? "Le goûter chez " + t : gab === "A" ? (st.decl === "noel" ? "Le sapin de " : "Le jardin de ") + t : t;
  let demo = gab !== "blanche";
  if(window.NPRendu && data.asset) NPRendu.configurer(n => data.asset.replace("np2-el-rose.png", n));

  /* ---- Titre : liste du destinataire, deux surnoms (couple), Famille + nom, ou saisie libre ---- */
  const titreSel = q1("[data-np-titre-sel]"), titreLibre = q1("[data-np-titre-libre]"), titreDeux = q1("[data-np-titre-deux]"), titreFam = q1("[data-np-titre-famille]");
  const surnoms = qa("[data-np-surnom]"), titreCount = q1("[data-np-titre-count]");
  function buildTitre(){
    if(!titreSel) return;
    const d = dref(); if(!d) return;
    const prev = titreSel.value;
    const opts = [["", "Sans titre"]].concat(d.titres.map(t => [t, t]));
    if(d.deux_surnoms) opts.push(["__deux", "Deux surnoms au choix…"]);
    if(d.famille_nom) opts.push(["__famille", "Famille + votre nom…"]);
    opts.push(["__libre", "Autre : je l'écris…"]);
    titreSel.innerHTML = opts.map(([v, l]) => '<option value="' + esc(v) + '">' + esc(l) + "</option>").join("");
    titreSel.value = opts.some(o => o[0] === prev) ? prev : "";
    if(d.deux_surnoms && surnoms.length){
      const list = ref.surnoms || [];
      surnoms.forEach((s, i) => { const keep = s.value; s.innerHTML = list.map(t => '<option>' + esc(t) + "</option>").join(""); s.value = keep && list.includes(keep) ? keep : list[i === 0 ? 0 : 8] || list[0]; });
    }
    syncTitre();
  }
  function titreVal(){
    if(!titreSel) return (titreLibre && titreLibre.value || "").trim();
    const v = titreSel.value;
    if(v === "__libre") return (titreLibre.value || "").trim();
    if(v === "__deux") return surnoms.length ? (surnoms[0].value + " et " + surnoms[1].value) : "";
    if(v === "__famille"){ const n = (titreFam.value || "").trim(); return n ? "Famille " + n : "Famille"; }
    return v;
  }
  function syncTitre(){
    if(titreSel){
      const v = titreSel.value;
      if(titreLibre) titreLibre.hidden = v !== "__libre";
      if(titreDeux) titreDeux.hidden = v !== "__deux";
      if(titreFam) titreFam.hidden = v !== "__famille";
    }
    st.titre = titreOmis() ? "" : titreVal().slice(0, limites.titre);
    if(titreCount) titreCount.textContent = st.titre.length;
    const ph = q1("[data-np-titre-phrase]");
    if(ph) ph.textContent = st.titre ? "Sur l'illustration : « " + titrePhrase(st.titre) + " »" : "Écrivez le surnom : « " + titrePhrase("Mamie") + " » s'affichera.";
  }
  if(titreSel) titreSel.addEventListener("change", () => { syncTitre(); changed(); if(titreSel.value === "__libre") titreLibre.focus(); if(titreSel.value === "__famille") titreFam.focus(); });
  [titreLibre, titreFam].forEach(el => el && el.addEventListener("input", () => { demo = false; syncTitre(); changed(); }));
  surnoms.forEach(s => s.addEventListener("change", () => { syncTitre(); changed(); }));

  /* ---- Prénoms : 0 à 6 (4 sur le cœur, la cloche et l'étoile en bois), un symbole au choix par prénom (gabarit A) ---- */
  const maxPrenoms = () => Math.min(limites.prenoms, window.NPRendu && gab === "A" ? NPRendu.nMax(type, st.forme) : 6);
  const list = q1("[data-np-prenom-list]"), tpl = q1("[data-np-prenom-tpl]"), addLine = q1("[data-np-prenom-add]");
  const defaultSym = i => { const s = symboles(); return s.length ? s[(i * 5 + (st.decl === "base" ? 5 : 0)) % s.length].id : null; };
  function renderPrenoms(focusLast){
    if(!list || !tpl) return;
    if(!st.prenoms.length) st.prenoms.push({ texte: "", symbole: defaultSym(0) });
    list.innerHTML = "";
    st.prenoms.forEach((p, i) => {
      const li = tpl.content.firstElementChild.cloneNode(true);
      const inp = $("[data-np-prenom]", li), sel = $("[data-np-symbole]", li), del = $("[data-np-prenom-del]", li);
      inp.value = p.texte; inp.maxLength = limites.prenom;
      inp.placeholder = "Prénom " + (i + 1);
      inp.setAttribute("aria-label", "Prénom " + (i + 1));
      inp.addEventListener("input", () => { demo = false; p.texte = inp.value; changed(); });
      const pick = $(".np-sym-pick", li);
      if(pick) pick.hidden = gab !== "A";
      if(sel && gab === "A"){
        const syms = symboles();
        if(!symInfo(p.symbole)) p.symbole = defaultSym(i);
        sel.innerHTML = syms.map(s => '<option value="' + esc(s.id) + '">' + esc(symLabel(s)) + "</option>").join("");
        sel.value = p.symbole;
        const im = $("[data-np-symbole-img]", li);
        const majImg = () => { if(im && data.sym_img){ im.src = data.sym_img.replace("np2-sym-rose.png", "np2-sym-" + p.symbole + ".png"); im.alt = symLabel(symInfo(p.symbole)); } };
        majImg();
        sel.setAttribute("aria-label", (st.decl === "noel" ? "Ornement" : "Fleur de naissance") + " du prénom " + (i + 1));
        sel.addEventListener("change", () => { demo = false; p.symbole = sel.value; majImg(); changed(); });
      }
      del.addEventListener("click", () => {
        demo = false;
        if(st.prenoms.length > 1) st.prenoms.splice(i, 1); else { p.texte = ""; }
        renderPrenoms(); changed();
      });
      list.appendChild(li);
    });
    if(addLine) addLine.hidden = st.prenoms.length >= maxPrenoms();
    if(focusLast){ const all = $$("[data-np-prenom]", list); if(all.length) all[all.length - 1].focus(); }
  }
  if(addLine) addLine.addEventListener("click", () => {
    demo = false;
    if(st.prenoms.length >= maxPrenoms()) return;
    st.prenoms.push({ texte: "", symbole: defaultSym(st.prenoms.length) });
    renderPrenoms(true);
  });

  /* ---- Phrase ---- */
  const phraseIn = q1("[data-np-phrase]"), phraseCount = q1("[data-np-phrase-count]");
  if(phraseIn){ phraseIn.maxLength = limites.phrase; phraseIn.addEventListener("input", () => { demo = false; st.phrase = phraseIn.value; if(phraseCount) phraseCount.textContent = phraseIn.value.length; changed(); }); }

  /* ---- Couleur de fond (personnalisation libre) : couleurs pâles, « Sans fond » en premier ---- */
  const fonds = () => ref.blanche.fonds || [];
  const fondCourant = () => gab === "blanche" ? fonds()[st.bg] || null : null;
  const bgBox = q1("[data-np-bgs]"), bgName = q1("[data-np-bg-nom]");
  function renderFonds(){
    if(!bgBox) return;
    bgBox.innerHTML = fonds().map((c, i) => '<label class="np-color" title="' + esc(c.nom) + '"><input type="radio" name="np_bg" value="' + i + '"' + (i === st.bg ? " checked" : "") + '><span class="' + (c.hex ? "" : "np-color-sans") + '" style="--c:' + esc(c.hex || "#FFFFFF") + '"></span><span class="sr">' + esc(c.nom) + "</span></label>").join("");
    $$("input", bgBox).forEach(r => r.addEventListener("change", () => { st.bg = +r.value; if(bgName) bgName.textContent = fonds()[st.bg].nom; changed(); }));
    if(bgName && fonds()[st.bg]) bgName.textContent = fonds()[st.bg].nom;
  }
  /* ---- Couleur du texte : palette du destinataire (ou de la page blanche) ---- */
  const colorsBox = q1("[data-np-couleurs]"), colorName = q1("[data-np-couleur-nom]");
  function renderCouleurs(){
    if(!colorsBox) return;
    const pal = palette();
    if(st.couleur >= pal.length) st.couleur = 0;
    colorsBox.innerHTML = pal.map((c, i) => '<label class="np-color" title="' + esc(c.nom) + '"><input type="radio" name="np_couleur" value="' + i + '"' + (i === st.couleur ? " checked" : "") + '><span style="--c:' + esc(c.hex) + '"></span><span class="sr">' + esc(c.nom) + "</span></label>").join("");
    $$("input", colorsBox).forEach(r => r.addEventListener("change", () => { demo = false; st.couleur = +r.value; if(colorName) colorName.textContent = couleur().nom; changed(); }));
    if(colorName) colorName.textContent = couleur().nom;
  }

  /* ---- Variante : forme × destinataire × texte ---- */
  const hasText = () => gab === "blanche" ? !!st.titre.trim() : !!(st.titre.trim() || st.prenoms.some(p => p.texte.trim()) || st.phrase.trim());
  function pickVariant(){
    const wantT = hasText();
    const varImage = gab === "blanche" && idx.texte >= 0 && variants.some(v => norm(v.options[idx.texte]).includes("image"));
    if(varImage){
      const okI = v => (idx.forme < 0 || formeKey(v.options[idx.forme]) === st.forme) && norm(v.options[idx.texte]).includes("image");
      return variants.find(v => okI(v) && v.available) || variants.find(okI) || null;
    }
    const ok = v => (idx.forme < 0 || formeKey(v.options[idx.forme]) === st.forme)
      && (idx.dest < 0 || norm(v.options[idx.dest]) === st.dest)
      && (idx.texte < 0 || (/avec|\+ ?texte/.test(norm(v.options[idx.texte])) === wantT
        && (gab === "blanche" || !norm(v.options[idx.texte]).includes("image"))));   /* ancien produit : « Illustration + texte », jamais « Votre image » */
    return variants.find(v => ok(v) && v.available) || variants.find(ok) || null;
  }
  function refresh(){
    const v = pickVariant();
    if(v && variantIn) variantIn.value = v.id;
    if(v){
      const add = idx.texte < 0 && hasText() ? (data.extra || 0) : 0;
      const price = v.price + add, compare = v.compare > v.price ? v.compare + add : 0;
      $$("[data-np-price]").forEach(el => { el.textContent = fmt(price); });
      $$("[data-np-compare]").forEach(el => { el.hidden = !compare; if(compare) el.textContent = fmt(compare); });
    }
    const can = !!v && v.available;
    if(addBtn) addBtn.disabled = !can || busy;
    if(addLabel) addLabel.textContent = !can ? (v ? "Épuisé" : "Indisponible") : (busy ? "Ajout en cours…" : (lot ? "Ajouter l'article " + lotN + " sur 3" : "Ajouter au panier"));
    if(retractEl && data.retract) retractEl.textContent = (hasText() || gab === "blanche") ? data.retract.perso : data.retract.free;
    if(lotPill){ lotPill.hidden = !lot; const n = $("[data-np-lot-n]", lotPill); if(n) n.textContent = lotN; }
    if(lotNote) lotNote.hidden = !lot;
    if(qtyField) qtyField.hidden = lot;
    if(lot && qtyIn) qtyIn.value = 1;
  }
  function updateUrl(){
    try{
      const v = pickVariant(); if(!v) return;
      const u = new URL(location.href);
      u.searchParams.set("variant", v.id); u.searchParams.delete("pour");
      if(type === "mug" && gab === "A"){ if(st.decl === "noel") u.searchParams.set("noel", "1"); else u.searchParams.delete("noel"); }
      history.replaceState(null, "", u);
    }catch(e){}
  }

  /* ---- Page blanche : photo, forme, recadrage (déplacer et zoomer) ---- */
  const fileIn = q1("[data-np-file]"), fileMsg = q1("[data-np-file-msg]"), drop = q1("[data-np-drop]"), dropLabel = q1("[data-np-drop-label]");
  const crop = q1("[data-np-crop]"), frame = q1("[data-np-crop-frame]"), cImg = q1("[data-np-crop-img]"), cMask = q1("[data-np-crop-mask]"), zoomIn = q1("[data-np-crop-zoom]");
  const rightsIn = q1("[data-np-rights]");
  const msg = (cls, text) => { if(fileMsg){ fileMsg.className = "np-msg " + cls; fileMsg.textContent = text; } };
  const zoneRatio = () => { const z = data.zone || {}; return (type === "bois" ? z[st.forme] : z[""]) || 1; };
  /* Cadre de la forme dans la zone : toute la zone, ou un carré centré de côté 0,9 × min(l, h) */
  function boxOf(W, H, forme){
    if(forme === "tout") return { x: 0, y: 0, w: W, h: H };
    const c = 0.9 * Math.min(W, H);
    return { x: (W - c) / 2, y: (H - c) / 2, w: c, h: c };
  }
  function layoutCrop(){
    if(!crop || !st.image || !st.image.src) return;
    const im = st.image, W = frame.clientWidth, H = W / zoneRatio();
    frame.style.height = H.toFixed(1) + "px";
    const b = boxOf(W, H, im.forme), s = im.zoom * Math.max(b.w / im.w, b.h / im.h);
    const dw = im.w * s, dh = im.h * s;
    /* centre visé (fractions de l'image) → décalage, borné pour couvrir le cadre */
    let tx = b.w / 2 - im.cx * dw, ty = b.h / 2 - im.cy * dh;
    /* plus grande que le cadre : elle le couvre ; plus petite (zoom < 1) : elle se place librement dedans */
    tx = Math.min(Math.max(0, b.w - dw), Math.max(Math.min(0, b.w - dw), tx));
    ty = Math.min(Math.max(0, b.h - dh), Math.max(Math.min(0, b.h - dh), ty));
    im.cx = (b.w / 2 - tx) / dw; im.cy = (b.h / 2 - ty) / dh;
    cImg.style.width = dw.toFixed(1) + "px"; cImg.style.height = dh.toFixed(1) + "px";
    cImg.style.transform = "translate(" + (b.x + tx).toFixed(1) + "px," + (b.y + ty).toFixed(1) + "px)";
    im.crop = { x: +(-tx / dw).toFixed(4), y: +(-ty / dh).toFixed(4), l: +(b.w / dw).toFixed(4), h: +(b.h / dh).toFixed(4) };
    /* masque : blanc hors de la forme, contour pointillé ; cercle de la boule ; contour découpé du bois */
    let outline = "";
    if(im.forme !== "tout") outline = shapePath(im.forme, b);
    const disque = type === "verre" ? "M" + (W / 2) + " 0 A" + (W / 2) + " " + (H / 2) + " 0 1 1 " + (W / 2 - 0.01) + " 0 Z" : "";
    cMask.setAttribute("viewBox", "0 0 " + W.toFixed(1) + " " + H.toFixed(1));
    cMask.innerHTML = (outline ? '<path d="M0 0H' + W + "V" + H + "H0Z " + outline + '" fill="#FFFFFF" fill-rule="evenodd"/><path d="' + outline + '" fill="none" stroke="rgba(193,18,31,.8)" stroke-width="2" stroke-dasharray="7 6"/>' : "")
      + (disque ? '<path d="M0 0H' + W + "V" + H + "H0Z " + disque + '" fill="rgba(240,236,232,.92)" fill-rule="evenodd"/><path d="' + disque + '" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>' : "");
    if(type === "bois" && data.contour && data.contour[st.forme]){
      frame.style.webkitMaskImage = frame.style.maskImage = "url(" + data.contour[st.forme] + ")";
      frame.style.webkitMaskSize = frame.style.maskSize = "100% 100%";
    }
  }
  function setImage(info){
    st.image = Object.assign({ forme: (q1("[data-np-forme-img]:checked") || {}).value || "tout", zoom: 1, cx: 0.5, cy: 0.5, crop: null, id: "" }, info);
    if(crop) crop.hidden = !st.image.src;
    if(cImg && st.image.src) cImg.src = st.image.src;
    st.image.zoom = zFit(); if(zoomIn) zoomIn.value = 0;   /* curseur au milieu : la photo entière, ajustée à la zone */
    requestAnimationFrame(layoutCrop);
    changed();
  }
  async function readFile(){
    const f = fileIn.files && fileIn.files[0];
    st.image = null; if(crop) crop.hidden = true;
    if(drop) drop.classList.remove("has-file"); if(dropLabel) dropLabel.textContent = "Importer une photo"; msg("", "");
    if(!f){ changed(); return; }
    const isHeic = /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
    if(!/^image\/(jpeg|png)$/.test(f.type) && !isHeic){ fileIn.value = ""; msg("err", "Format non accepté : choisissez une photo JPG, PNG ou HEIC."); changed(); return; }
    if(f.size > MAX_MB * 1024 * 1024){ fileIn.value = ""; msg("err", "Photo trop lourde : " + MAX_MB + " Mo au maximum."); changed(); return; }
    if(drop) drop.classList.add("has-file"); if(dropLabel) dropLabel.textContent = f.name;
    const local = URL.createObjectURL(f);
    let im = null;
    try{ im = await loadImg(local); }catch(e){ im = null; }
    const check = (w, h) => {
      const m = Math.min(w, h), dim = w + " × " + h + " pixels";
      if(m < BON_PX) msg("warn", "Photo de " + dim + " : acceptée. Au-delà de " + BON_PX + " pixels, l'impression sera plus nette.");
      else msg("ok", "Photo de " + dim + " : parfaite pour l'impression.");
      return true;
    };
    if(im && !check(im.naturalWidth, im.naturalHeight)){ fileIn.value = ""; if(drop) drop.classList.remove("has-file"); if(dropLabel) dropLabel.textContent = "Importer une photo"; changed(); return; }
    original = im ? { src: local, file: f, w: im.naturalWidth, h: im.naturalHeight } : null;
    resetFond();
    if(im) setImage({ src: local, w: im.naturalWidth, h: im.naturalHeight });
    else msg("warn", "Photo HEIC : votre navigateur ne sait pas l'afficher. Elle sera centrée dans la forme ; vous pouvez aussi choisir une photo JPG pour la placer vous-même.");
    if(client.actif){
      try{
        const r = await client.envoyer(f);
        if(!im && r.apercu){ setImage({ src: r.apercu, w: r.largeur, h: r.hauteur, id: r.id }); if(!check(r.largeur, r.hauteur)){ fileIn.value = ""; st.image = null; if(crop) crop.hidden = true; } }
        else if(st.image) st.image.id = r.id || "";
        if(r.alerte === "basse_definition" && st.image) msg("warn", "Photo acceptée. Une photo plus grande donnera une impression plus nette.");
        changed();
      }catch(e){
        if(e.code === "trop_petite"){ fileIn.value = ""; st.image = null; if(crop) crop.hidden = true; msg("err", "Photo trop petite pour une impression nette : il faut au moins " + MIN_PX + " pixels sur le petit côté."); changed(); }
      }
    }
    if(!st.image && fileIn.value) st.image = { src: "", w: 0, h: 0, forme: (q1("[data-np-forme-img]:checked") || {}).value || "tout", crop: null, id: "" };
  }
  /* ---- Retirer le fond : automatique (MediaPipe, modèles Google, licence Apache 2.0) ou fond uni (couleur du bord) ----
     La photo détourée (PNG transparent) remplace la photo d'origine dans le formulaire : c'est elle qui part avec la commande. */
  const fondBox = q1("[data-np-fond]"), fondMsg = q1("[data-np-fond-msg]"), tolBox = q1("[data-np-fond-tol]"), tolIn = q1("[data-np-fond-tol-in]");
  const MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  const MODELES = ["https://storage.googleapis.com/mediapipe-models/image_segmenter/deeplab_v3/float32/1/deeplab_v3.tflite",
                   "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"];
  const FOND_MAX = 3000;   /* côté maximal de la photo détourée */
  let original = null, fondMode = "garder", fondSeq = 0, segs = null;
  const fondInfo = fondMsg ? fondMsg.textContent : "";
  const fmsg = (cls, t) => { if(fondMsg){ fondMsg.className = "np-msg " + cls; fondMsg.textContent = t; } };
  function resetFond(){
    fondMode = "garder";
    const r = q1("[data-np-fond-mode][value='garder']"); if(r) r.checked = true;
    if(fondBox) fondBox.hidden = !original; if(tolBox) tolBox.hidden = true; fmsg("", fondInfo);
  }
  async function segmenteurs(){
    if(segs) return segs;
    const v = await import(MP + "/vision_bundle.mjs");
    const fs = await v.FilesetResolver.forVisionTasks(MP + "/wasm");
    segs = await Promise.all(MODELES.map(m => v.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: m }, runningMode: "IMAGE", outputConfidenceMasks: true, outputCategoryMask: false })));
    return segs;
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  async function masqueAuto(im, sw, sh){
    const c = document.createElement("canvas"); c.width = sw; c.height = sh; c.getContext("2d").drawImage(im, 0, 0, sw, sh);
    const fg = new Float32Array(sw * sh);
    for(const seg of await segmenteurs()){
      const r = seg.segment(c), bg = r.confidenceMasks[0].getAsFloat32Array();
      for(let i = 0; i < fg.length; i++) fg[i] = Math.max(fg[i], 1 - bg[i]);
      r.confidenceMasks.forEach(m => m.close());
    }
    return fg.map(v => smooth(0.3, 0.7, v));
  }
  function masqueUni(im, sw, sh, tol){
    const c = document.createElement("canvas"); c.width = sw; c.height = sh; const x = c.getContext("2d"); x.drawImage(im, 0, 0, sw, sh);
    const d = x.getImageData(0, 0, sw, sh).data, n = sw * sh;
    /* couleur du fond : médiane des pixels du bord */
    const bord = [];
    for(let i = 0; i < sw; i++){ bord.push(i, (sh - 1) * sw + i); }
    for(let j = 0; j < sh; j++){ bord.push(j * sw, j * sw + sw - 1); }
    const med = k => { const v = bord.map(p => d[p * 4 + k]).sort((a, b) => a - b); return v[v.length >> 1]; };
    const R = med(0), G = med(1), B = med(2), t2 = tol * tol * 3;
    const dist = p => { const a = d[p * 4] - R, b = d[p * 4 + 1] - G, e = d[p * 4 + 2] - B; return a * a + b * b + e * e; };
    const fond = new Uint8Array(n), pile = [];
    for(const p of bord) if(!fond[p] && dist(p) <= t2){ fond[p] = 1; pile.push(p); }
    while(pile.length){
      const p = pile.pop(), px = p % sw, py = (p / sw) | 0;
      const vois = [px > 0 ? p - 1 : -1, px < sw - 1 ? p + 1 : -1, py > 0 ? p - sw : -1, py < sh - 1 ? p + sw : -1];
      for(const q of vois) if(q >= 0 && !fond[q] && dist(q) <= t2){ fond[q] = 1; pile.push(q); }
    }
    const m = new Float32Array(n);
    for(let i = 0; i < n; i++) m[i] = fond[i] ? 0 : 1;
    return m;
  }
  async function appliquerFond(){
    if(!original || !st.image) return;
    const seq = ++fondSeq;
    if(fondMode === "garder"){ remplacerPhoto(original.src, original.file); fmsg("", fondInfo); return; }
    fmsg("", fondMode === "auto" ? "Détourage en cours… (la première fois, le module se télécharge : quelques secondes)" : "Effacement du fond…");
    try{
      const im = await loadImg(original.src);
      const W0 = im.naturalWidth, H0 = im.naturalHeight, kOut = Math.min(1, FOND_MAX / Math.max(W0, H0));
      const W = Math.round(W0 * kOut), H = Math.round(H0 * kOut);
      const kM = Math.min(1, (fondMode === "auto" ? 768 : 1200) / Math.max(W0, H0)), sw = Math.max(1, Math.round(W0 * kM)), sh = Math.max(1, Math.round(H0 * kM));
      const m = fondMode === "auto" ? await masqueAuto(im, sw, sh) : masqueUni(im, sw, sh, tolIn ? +tolIn.value : 40);
      if(seq !== fondSeq) return;
      const mc = document.createElement("canvas"); mc.width = sw; mc.height = sh; const mx = mc.getContext("2d"), id = mx.createImageData(sw, sh);
      let garde = 0;
      for(let i = 0; i < m.length; i++){ id.data[i * 4 + 3] = Math.round(m[i] * 255); garde += m[i]; }
      mx.putImageData(id, 0, 0);
      if(garde < m.length * 0.01){ fmsg("warn", "Rien de net à détourer sur cette photo : essayez « Retirer un fond uni » ou gardez le fond."); return; }
      const out = document.createElement("canvas"); out.width = W; out.height = H; const ox = out.getContext("2d");
      ox.drawImage(im, 0, 0, W, H); ox.globalCompositeOperation = "destination-in"; ox.imageSmoothingQuality = "high"; ox.drawImage(mc, 0, 0, W, H);
      const blob = await new Promise(ok => out.toBlob(ok, "image/png"));
      if(seq !== fondSeq || !blob) return;
      const nom = (original.file.name || "photo").replace(/\.[a-z0-9]+$/i, "") + "-sans-fond.png";
      remplacerPhoto(URL.createObjectURL(blob), new File([blob], nom, { type: "image/png" }));
      fmsg("ok", "Fond retiré. Le résultat ne vous plaît pas ? Revenez à « Garder le fond »" + (fondMode === "uni" ? " ou changez la tolérance." : "."));
    }catch(e){
      fmsg("err", fondMode === "auto" ? "Le détourage automatique n'a pas pu se lancer sur cet appareil : essayez « Retirer un fond uni »." : "Le fond n'a pas pu être effacé.");
    }
  }
  function remplacerPhoto(src, file){
    if(!st.image) return;
    st.image.src = src; if(cImg) cImg.src = src;
    try{ const dt = new DataTransfer(); dt.items.add(file); fileIn.files = dt.files; }catch(e){}
    st.image.fond = fondMode;
    if(client.actif) client.envoyer(file).then(r => { if(st.image) st.image.id = r.id || ""; changed(); }).catch(() => {});
    layoutCrop(); changed();
  }
  qa("[data-np-fond-mode]").forEach(r => r.addEventListener("change", () => { fondMode = r.value; if(tolBox) tolBox.hidden = fondMode !== "uni"; appliquerFond(); }));
  let tolTimer = 0;
  if(tolIn) tolIn.addEventListener("input", () => { clearTimeout(tolTimer); tolTimer = setTimeout(appliquerFond, 250); });

  if(fileIn){
    fileIn.addEventListener("change", readFile);
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("is-drag"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("is-drag"); }));
    drop.addEventListener("drop", e => { if(!e.dataTransfer || !e.dataTransfer.files.length) return; try{ fileIn.files = e.dataTransfer.files; fileIn.dispatchEvent(new Event("change")); }catch(err){} });
  }
  qa("[data-np-forme-img]").forEach(r => r.addEventListener("change", () => { if(st.image){ st.image.forme = r.value; st.image.zoom = zFit(); if(zoomIn) zoomIn.value = 0; layoutCrop(); } changed(); }));
  if(frame){
    let dragging = null;
    frame.addEventListener("pointerdown", e => { if(!st.image || !st.image.src) return; dragging = { x: e.clientX, y: e.clientY }; try{ frame.setPointerCapture(e.pointerId); }catch(err){} });
    frame.addEventListener("pointermove", e => {
      if(!dragging || !st.image) return;
      const im = st.image, W = frame.clientWidth, H = W / zoneRatio(), b = boxOf(W, H, im.forme), s = im.zoom * Math.max(b.w / im.w, b.h / im.h);
      im.cx -= (e.clientX - dragging.x) / (im.w * s); im.cy -= (e.clientY - dragging.y) / (im.h * s);
      dragging = { x: e.clientX, y: e.clientY }; layoutCrop();
      if(!client.actif) changed();   /* aperçu local : l'objet suit le déplacement */
    });
    const end = () => { if(dragging){ dragging = null; changed(); } };
    frame.addEventListener("pointerup", end); frame.addEventListener("pointercancel", end);
    frame.addEventListener("wheel", e => { if(!st.image || !st.image.src) return; e.preventDefault(); setS(sDe(st.image.zoom) + (e.deltaY < 0 ? 0.05 : -0.05)); }, { passive: false });
  }
  /* Zoom : 1 = la photo couvre la zone ; zFit = la photo entière tient dans la zone (curseur au milieu).
     Le curseur va de zFit ÷ 5 (toute petite) à zFit × 5 (très agrandie). */
  const ZK = 5;
  function zFit(){
    if(!st.image || !st.image.w) return 1;
    const im = st.image, b = boxOf(1000, 1000 / zoneRatio(), im.forme), sx = b.w / im.w, sy = b.h / im.h;
    return Math.min(sx, sy) / Math.max(sx, sy);
  }
  const sDe = z => Math.log(z / zFit()) / Math.log(ZK);
  function setS(v){
    if(!st.image) return;
    v = Math.min(1, Math.max(-1, v));
    st.image.zoom = zFit() * Math.pow(ZK, v);
    if(zoomIn) zoomIn.value = v.toFixed(2);
    layoutCrop(); changed();
  }
  if(zoomIn) zoomIn.addEventListener("input", () => setS(+zoomIn.value));
  qa("[data-np-crop-step]").forEach(b => b.addEventListener("click", () => setS((st.image ? sDe(st.image.zoom) : 0) + 0.1 * b.dataset.npCropStep)));
  addEventListener("resize", () => layoutCrop());

  /* ---- Aperçu : image du serveur plaquée, ou image d'exemple ---- */
  const setEtat = (t, err) => { if(!etat) return; etat.hidden = !t; etat.textContent = t || ""; etat.classList.toggle("is-err", !!err); };
  const alertesEl = q1("[data-np-alertes]");
  const key = () => st.dest + "-" + st.decl;
  const vierge = () => (data.vierge || {})[type === "bois" ? st.forme : ""] || base.src;
  function exempleSrc(){
    if(gab === "blanche" || (type === "bois" && st.forme !== "coeur")) return vierge();
    return (data.ex || {})[key()] || base.src;
  }
  function payload(){
    const c = couleur();
    return {
      version: 1, objet, forme: type === "bois" ? st.forme : null, gabarit: gab, declinaison: st.decl,
      destinataire: gab === "blanche" ? null : st.dest, titre: st.titre.trim(), surnom: st.titre.trim(),
      prenoms: gab === "blanche" ? [] : st.prenoms.filter(p => p.texte.trim()).map(p => ({ texte: p.texte.trim(), symbole: gab === "A" ? p.symbole : null })), mois: st.mois,
      phrase: st.phrase.trim(), couleur: c ? c.hex : null, fond: fondCourant() ? fondCourant().hex || null : null,
      image: gab === "blanche" && st.image && st.image.id ? { id: st.image.id, forme: st.image.forme, recadrage: st.image.crop } : null,
      taille: "apercu"
    };
  }
  let plaqueSeq = 0;
  async function plaquer(img){
    if(type === "mug"){
      const centre = gab === "B" ? "150" : "105";
      if(stage.dataset.npCentre !== centre){ stage.dataset.npCentre = centre; stage.dispatchEvent(new CustomEvent("np:centre")); }
      stage.npPrint = img; stage.dispatchEvent(new CustomEvent("np:print"));
      if(stage.hasAttribute("data-np-3d")) load3d(stage);
      return;
    }
    const seq = ++plaqueSeq;
    try{
      const ph = await loadImg(vierge());
      const msk = type === "bois" ? await loadImg(data.masque[st.forme]) : null;
      if(seq !== plaqueSeq) return;
      const c = plaque.getContext("2d");
      c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, 1000, 1000); c.drawImage(ph, 0, 0, 1000, 1000);
      if(type === "verre"){
        const [cx, cy, r] = data.disque;
        c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip(); c.drawImage(img, cx - r, cy - r, 2 * r, 2 * r); c.restore();
      } else {
        const [x, y, w, h] = data.boite[st.forme];
        const off = document.createElement("canvas"); off.width = off.height = 1000;
        const o = off.getContext("2d"), sc = Math.max(w / img.width, h / img.height), dw = img.width * sc, dh = img.height * sc;
        o.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        o.globalCompositeOperation = "destination-in"; o.drawImage(msk, 0, 0, 1000, 1000);
        c.globalCompositeOperation = "multiply"; c.drawImage(off, 0, 0); c.globalCompositeOperation = "source-over";
      }
      plaque.hidden = false;
    }catch(e){ plaque.hidden = true; }
  }
  function repli(){
    st.apercuId = ""; st.apercuUrl = ""; st.version = "";
    /* Sans serveur : l'illustration de la variante sans texte (np2-plat), plaquée comme l'aperçu du serveur */
    if(gab !== "blanche" && data.plat && data.plat[key()]){
      base.src = type === "mug" ? exempleSrc() : vierge();
      loadImg(data.plat[key()]).then(plaquer).catch(() => { plaque.hidden = true; base.src = exempleSrc(); });
      return;
    }
    plaque.hidden = true;
    base.src = exempleSrc();
  }
  /* Sans serveur : la zone d'impression composée ici (assets/np-rendu.js), visible en direct sur l'objet */
  let localSeq = 0;
  async function local(){
    if(!window.NPRendu){ repli(); return; }
    const seq = ++localSeq, c = couleur();
    try{
      const cv = await NPRendu.rendre({ objet: type, forme: st.forme, gabarit: gab, decl: st.decl, dest: st.dest || "mamie",
        titre: st.titre, prenoms: gab === "blanche" ? [] : st.prenoms, phrase: gab === "blanche" ? "" : st.phrase, couleur: c ? c.hex : null, mois: st.mois, fond: fondCourant() ? fondCourant().hex || null : null,
        image: st.image && st.image.src ? { src: st.image.src, forme: st.image.forme, crop: st.image.crop } : null });
      if(seq !== localSeq) return;
      st.apercuId = ""; st.apercuUrl = ""; st.version = "";
      if(type !== "mug") base.src = vierge();
      await plaquer(cv);
    }catch(e){ repli(); }
  }
  async function demander(){
    if(alertesEl){ alertesEl.textContent = ""; alertesEl.className = "np-msg"; }
    if(!client.actif || (gab === "blanche" && !(st.image && st.image.id))){ setEtat(""); return local(); }
    setEtat("Aperçu en cours…");
    try{
      const { img, j } = await client.rendre(payload());
      st.apercuId = j.apercu_id || ""; st.apercuUrl = j.apercu_url || ""; st.version = j.gabarit_version || "";
      await plaquer(img);
      setEtat("");
      const al = (j.alertes || []).map(a => ALERTES[a.code]).filter(Boolean);
      if(alertesEl && al.length){ alertesEl.className = "np-msg warn"; alertesEl.textContent = Array.from(new Set(al)).join(" "); }
    }catch(e){
      if(e.name === "AbortError") return;
      setEtat("Aperçu momentanément indisponible : votre texte sera imprimé exactement comme saisi.", true);
      repli();
    }
  }
  function changed(){
    if(errEl) errEl.hidden = true;
    if(checkIn && checkIn.checked && !busy) checkIn.checked = false; /* toute modification demande une nouvelle vérification */
    refresh();
    clearTimeout(timer); timer = setTimeout(demander, client.actif ? 400 : 60);
  }

  /* ---- Destinataire, déclinaison, forme ---- */
  function setDest(d){
    st.dest = d;
    qa("[data-np-dest]").forEach(r => { r.checked = r.value === d; });
    if(demo) appliquerDemo();
    buildTitre(); renderCouleurs();
    if(!client.actif) base.src = exempleSrc();
    updateUrl(); changed();
  }
  qa("[data-np-dest]").forEach(r => r.addEventListener("change", () => setDest(r.value)));
  qa("[data-np-decl]").forEach(r => r.addEventListener("change", () => {
    st.decl = r.value;
    renderPrenoms();
    if(!client.actif) base.src = exempleSrc();
    updateUrl(); changed();
  }));
  const shapeNote = $("[data-np-shape-note]", root);
  qa("[data-np-shape]").forEach(r => r.addEventListener("change", () => {
    st.forme = r.dataset.npShapeKey; st.formeLabel = r.value;
    if(st.prenoms.length > maxPrenoms()){ st.prenoms = st.prenoms.slice(0, maxPrenoms()); renderPrenoms(); }
    if(shapeNote) shapeNote.textContent = "Forme : " + r.value;
    plaque.hidden = true; base.src = exempleSrc();
    layoutCrop(); updateUrl(); changed();
  }));
  /* Préchargement des photos des formes pour un changement instantané */
  if(type === "bois") setTimeout(() => Object.values(data.vierge || {}).forEach(u => { const i = new Image(); i.src = u; }), 1500);

  /* ---- Formule : 1 article ou lot de 3 ---- */
  qa("[data-np-offer-qty]").forEach(r => r.addEventListener("change", () => { lot = r.value === "3"; lotN = 1; if(errEl) errEl.hidden = true; refresh(); }));

  /* ---- Propriétés de ligne (contrat, section 5) : écrites juste avant l'envoi ---- */
  function writeProps(){
    propsBox.innerHTML = "";
    const add = (k, v) => {
      if(v === undefined || v === null || v === "") return;
      const i = document.createElement("input"); i.type = "hidden"; i.name = "properties[" + k + "]"; i.value = v; propsBox.appendChild(i);
    };
    add(gab === "blanche" ? "Texte" : "Titre", titrePhrase(st.titre.trim()));
    if(type === "mug" && gab === "A" && st.decl === "base") add("_mois", st.mois ? "oui" : "non");
    if(gab !== "blanche") add("_surnom", st.titre.trim());
    (gab === "blanche" ? [] : st.prenoms).filter(p => p.texte.trim()).forEach((p, i) => {
      add("Prénom " + (i + 1), p.texte.trim());
      if(gab === "A"){ add("Symbole " + (i + 1), symLabel(symInfo(p.symbole))); add("_symbole_" + (i + 1), p.symbole); }
    });
    if(gab !== "blanche") add("Phrase", st.phrase.trim());
    if(hasText()){ const c = couleur(); add("Couleur du texte", c.nom); add("_couleur", c.hex); }
    if(fondCourant() && fondCourant().hex){ add("Couleur de fond", fondCourant().nom); add("_fond", fondCourant().hex); }
    if(gab === "blanche" && st.image && st.image.fond && st.image.fond !== "garder") add("Fond de la photo", st.image.fond === "auto" ? "retiré (automatique)" : "retiré (fond uni)");
    if(gab === "blanche" && st.image){
      const fi = (ref.formes_image || []).find(x => x.id === st.image.forme) || { nom: { ovale: "Ovale", coeur: "Cœur" }[st.image.forme] };
      add("Forme de l'image", fi ? fi.nom : st.image.forme);
      add("_forme_image", st.image.forme);
      if(st.image.crop) add("_recadrage", JSON.stringify(st.image.crop));
      add("_image_id", st.image.id);
      add("_Droits sur l'image", "oui");
    }
    add("_objet", objet); add("_gabarit", gab); add("_declinaison", st.decl);
    if(gab !== "blanche") add("_destinataire", st.dest);
    if(type === "bois") add("_forme", st.forme);
    add("_apercu_id", st.apercuId); add("_apercu_url", st.apercuUrl); add("_version", st.version);
    add("_Aperçu vérifié", "oui");
  }
  function resetTexte(){
    st.prenoms = []; renderPrenoms();
    if(titreSel){ titreSel.value = ""; }
    if(titreLibre) titreLibre.value = ""; if(titreFam) titreFam.value = "";
    if(phraseIn){ phraseIn.value = ""; st.phrase = ""; if(phraseCount) phraseCount.textContent = "0"; }
    syncTitre();
    if(fileIn && fileIn.value){ fileIn.value = ""; readFile(); }
    if(rightsIn) rightsIn.checked = false;
    if(checkIn) checkIn.checked = false;
  }
  form.addEventListener("submit", e => {
    e.preventDefault();
    const fail = (text, el) => { if(errEl){ errEl.textContent = text; errEl.hidden = false; } if(el) el.focus(); };
    if(errEl) errEl.hidden = true;
    if(busy) return;
    if(gab === "blanche" && !(fileIn && fileIn.files && fileIn.files.length)) return fail("Importez votre photo pour créer votre modèle.", drop);
    if(gab === "blanche" && rightsIn && !rightsIn.checked) return fail("Cochez la case : vous certifiez avoir les droits sur cette image.", rightsIn);
    if(checkIn && !checkIn.checked) return fail(gab === "blanche" ? "Cochez la case « J'ai vérifié l'aperçu de ma photo » pour continuer." : "Cochez la case « J'ai vérifié l'aperçu et l'orthographe » pour continuer.", checkIn);
    if(!pickVariant()) return fail("Cette option n'est pas disponible pour le moment.", null);
    refresh(); writeProps();
    if(!lot || lotN >= 3){ busy = true; refresh(); form.submit(); return; } /* envoi normal : Shopify ouvre le panier */
    busy = true; refresh();
    const fd = new FormData(form); fd.set("quantity", "1");
    fetch(shopRoot() + "cart/add.js", { method: "POST", body: fd, headers: { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" } })
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j), () => Promise.reject({})))
      .then(() => {
        toast("Article " + lotN + " ajouté au panier ✓");
        lotN += 1; resetTexte(); updateCartCount();
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(err => { if(errEl){ errEl.textContent = (err && (err.description || err.message)) || "L'article n'a pas pu être ajouté. Réessayez."; errEl.hidden = false; } })
      .finally(() => { busy = false; refresh(); changed(); });
  });
  if(checkIn) checkIn.addEventListener("change", () => { if(errEl) errEl.hidden = true; });

  /* ---- État de départ : ?variant= (Shopify), ?pour=mamie, ?noel=1, ?lot=3 ---- */
  const q = new URLSearchParams(location.search);
  if(!q.get("variant") && q.get("pour") && ref.destinataires[q.get("pour")]) st.dest = q.get("pour");
  if(type === "mug" && gab === "A" && q.get("noel") === "1"){ st.decl = "noel"; const r = q1("[data-np-decl][value='noel']"); if(r) r.checked = true; }
  if(q.get("lot") === "3"){ const r3 = q1("[data-np-offer-qty='3']"); if(r3){ r3.checked = true; lot = true; } }
  qa("[data-np-dest]").forEach(r => { r.checked = r.value === st.dest; });
  if(!st.dest) st.dest = "mamie";
  function appliquerDemo(){
    const n = type === "mug" ? 3 : 1, syms = (DEMO[st.decl] || DEMO.base)[st.dest] || DEMO.base.mamie;
    st.prenoms = DEMO.noms.slice(0, n).map((t, i) => ({ texte: t, symbole: gab === "A" ? syms[i] : null }));
    if(titreLibre) titreLibre.value = titreOmis() ? "" : (DEMO.surnom[st.dest] || "");
    st.couleur = 0;
    renderPrenoms(); syncTitre(); renderCouleurs();
  }
  /* ---- Les trois façons dans la même fiche : Le jardin / Le sapin (A), Le goûter (B), Votre photo ---- */
  const modeBtns = $$("[data-np-mode]", root);
  const declDe = m => m === "blanche" ? "base" : type === "mug" ? (m === "A" && q.get("noel") === "1" ? "noel" : "base") : "noel";
  function majMode(){
    const photo = gab === "blanche";
    modeBtns.forEach(b => { const on = b.dataset.npMode === gab; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    const show = (sel, v) => { const el = q1(sel); if(el) el.hidden = !v; };
    show("[data-np-dest-group]", !photo);
    show("[data-np-image-group]", photo);
    show("[data-np-prenoms]", !photo);
    show("[data-np-phrase-field]", !photo);
    show("[data-np-bg-field]", photo);
    show("[data-np-titre-phrase]", !photo);
    show("[data-np-mois-opt]", type === "mug" && gab === "A" && st.decl === "base");
    show("[data-np-fleurs-liste]", gab === "A" && st.decl === "base");
    show("[data-np-accent-note]", !photo || !!st.titre);
    const al = q1("[data-np-decl-link]"); if(al && al.parentElement) al.parentElement.hidden = !(type === "mug" && gab === "A");
    const tl = q1("[data-np-titre-label]"); if(tl) tl.textContent = photo ? "Texte sur la photo (facultatif)" : "Titre";
    if(titreLibre) titreLibre.placeholder = photo ? "Ex. Joyeux Noël Mamie" : "Ex. Mamie";
    const tb = q1("[data-np-titre]"); if(tb) tb.hidden = titreOmis();
    const cl = q1("[data-np-check-label]"); if(cl) cl.textContent = photo ? "J'ai vérifié l'aperçu de ma photo : c'est ce que je veux voir imprimé." : "J'ai vérifié l'aperçu et l'orthographe : c'est ce que je veux voir imprimé.";
    /* numéros des étapes visibles */
    let k = 0; $$(".np-step > span", form).forEach(sp => { const box = sp.closest("fieldset, .np-step"); if(box && !box.closest("[hidden]")) sp.textContent = ++k; });
  }
  function setMode(m, init){
    gab = m; st.decl = declDe(m);
    if(m !== "blanche" && !st.dest) st.dest = "mamie";
    if(!init && m !== "blanche"){ demo = true; appliquerDemo(); }
    if(!init && m === "blanche"){ demo = false; if(titreLibre) titreLibre.value = ""; syncTitre(); }
    renderPrenoms(); renderCouleurs(); majMode(); layoutCrop();
    try{ const u = new URL(location.href); u.searchParams.delete("variant"); u.searchParams.delete("photo"); u.searchParams.delete("modele");
      if(m === "blanche") u.searchParams.set("photo", "1"); if(m === "B") u.searchParams.set("modele", "gouter"); history.replaceState(null, "", u); }catch(e){}
    if(!init) changed();
  }
  modeBtns.forEach(b => b.addEventListener("click", () => { if(b.dataset.npMode !== gab) setMode(b.dataset.npMode); }));
  if(modeBtns.length){
    if(q.get("photo") === "1") { gab = "blanche"; }
    /* « Le goûter » retiré (03/11/2026) : ?modele=gouter ouvre le jardin */
    st.decl = declDe(gab);
    /* Le goûter : pas d'onglet à lui, on y arrive par sa carte de l'accueil ; l'onglet illustration le reprend */
    const illus = modeBtns.find(b => b.dataset.npMode !== "blanche");
    if(illus && type === "mug" && q.get("noel") === "1") illus.textContent = "Le sapin";
  }
  const moisIn = q1("[data-np-mois]");
  if(moisIn) moisIn.addEventListener("change", () => { st.mois = moisIn.checked; changed(); });
  if(gab !== "blanche"){ demo = true; appliquerDemo(); } else demo = false;
  /* Mug aux fleurs ou aux ornements : l'autre version est un autre article (lien, pas un interrupteur) */
  const declLink = q1("[data-np-decl-link]");
  if(declLink){
    const u = new URL(location.href); u.searchParams.delete("variant");
    if(st.decl === "noel"){ u.searchParams.delete("noel"); declLink.textContent = "Préférez les fleurs de naissance ? Voir « Le jardin de… »"; }
    else { u.searchParams.set("noel", "1"); declLink.textContent = "Pour Noël : les ornements pendus à une branche, « Le sapin de… »"; }
    if(st.dest) u.searchParams.set("pour", st.dest);
    declLink.href = u.pathname + u.search;
  }
  buildTitre(); renderPrenoms(); renderCouleurs(); renderFonds(); syncTitre(); majMode();
  if(modeBtns.length) setMode(gab, true);
  refresh();
  demander();

  /* Bouton « Personnaliser » collant sur téléphone, masqué quand le formulaire est visible */
  const sticky = $("[data-np-sticky]");
  if(sticky && "IntersectionObserver" in window){
    document.body.classList.add("np-has-sticky");
    new IntersectionObserver(entries => entries.forEach(en => {
      sticky.classList.toggle("is-hidden", en.isIntersecting);
      document.body.classList.toggle("np-has-sticky", !en.isIntersecting);
    }), { threshold: 0.15 }).observe(form);
  }
}

/* ---------- Arrivée estimée : jours ouvrés (heure de Paris), hors week-ends et jours fériés ----------
   Avant l'heure limite d'un jour ouvré, la fabrication démarre le jour même ; sinon le jour ouvré suivant.
   Les dates se recalculent toutes les minutes et au retour sur l'onglet (page restée ouverte). */
const HOLIDAYS = new Set(["2026-11-11","2026-12-25","2027-01-01","2027-03-29","2027-05-01","2027-05-06","2027-05-08","2027-05-17","2027-07-14","2027-08-15","2027-11-01","2027-11-11","2027-12-25"]);
const MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const isWorkday = d => { const w = d.getDay(); return w !== 0 && w !== 6 && !HOLIDAYS.has(ymd(d)); };
function parisNow(){
  try{
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const g = t => parseInt(parts.find(p => p.type === t).value, 10);
    return { day: new Date(g("year"), g("month") - 1, g("day")), hour: g("hour") };
  }catch(e){
    const d = new Date();
    return { day: new Date(d.getFullYear(), d.getMonth(), d.getDate()), hour: d.getHours() };
  }
}
function addDays(from, n){ const d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d.setDate(d.getDate() + n); return d; }
function addWorkdays(from, n){
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let k = 0;
  while(k < n){ d.setDate(d.getDate() + 1); const w = d.getDay(); if(w !== 0 && w !== 6 && !HOLIDAYS.has(ymd(d))) k++; }
  return d;
}
const dayLabel = d => d.getDate() + " " + MOIS[d.getMonth()];
function rangeLabel(a, b){
  if(a.getTime() === b.getTime()) return dayLabel(a);
  if(a.getMonth() === b.getMonth()) return a.getDate() + " – " + dayLabel(b);
  return dayLabel(a) + " – " + dayLabel(b);
}
const parseRange = (s, d) => { const m = String(s || "").match(/(\d+)\s*-\s*(\d+)/); return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : d; };
function initEta(box){
  if(box.dataset.npInit) return; box.dataset.npInit = "1";
  const [s1, s2] = parseRange(box.dataset.ship, [2, 3]), [d1, d2] = parseRange(box.dataset.deliver, [7, 12]);
  const cutoff = parseInt(box.dataset.cutoff, 10) || 14;
  const set = (sel, txt) => { const el = $(sel, box); if(el) el.textContent = txt; };
  let shown = "";
  function render(){
    const now = parisNow(), today = now.day;
    /* jour où la commande part en fabrication */
    const start = isWorkday(today) && now.hour < cutoff ? today : addWorkdays(today, 1);
    const key = ymd(today) + "|" + ymd(start);
    if(key === shown) return;
    shown = key;
    /* Jours calendaires, calés sur une vraie commande : passée le lundi 2 novembre 2026, livrée du vendredi 13 au
       dimanche 15 novembre (départ + 11 à 13 jours) ; expédition 3 à 4 jours ouvrés après le départ. Recalculé chaque jour. */
    const cal = box.dataset.jours === "calendaires";
    const plus = (n) => cal ? addDays(start, n) : addWorkdays(start, n);
    const range = rangeLabel(plus(d1), plus(d2));
    set("[data-np-eta-order]", dayLabel(today));
    set("[data-np-eta-ship]", rangeLabel(addWorkdays(start, s1), addWorkdays(start, s2)));   /* expédition : jours ouvrés */
    set("[data-np-eta-deliver]", range);
    set("[data-np-eta-range]", range);
    /* case « Pour Noël » : masquée après la date limite */
    $$("[data-np-noel]").forEach(t => { t.hidden = ymd(today) > t.dataset.npNoel; });
  }
  render();
  setInterval(render, 60000);
  document.addEventListener("visibilitychange", () => { if(!document.hidden) render(); });
  addEventListener("pageshow", render);
}

/* ---------- Panier : code du trio de Noël ajouté quand mug + boule + décoration y sont, retiré sinon ----------
   Les autres codes saisis par la cliente sont gardés. Une seule tentative par état du panier (pas de boucle). */
function initTrio(el){
  if(el.dataset.npInit) return; el.dataset.npInit = "1";
  const code = el.dataset.code, want = el.dataset.want === "1", applied = el.dataset.applied === "1";
  if(!code || want === applied) return;
  const tryKey = "np_trio_try_" + (want ? "on" : "off");
  try{ if(sessionStorage.getItem(tryKey) === String(Date.now()).slice(0, -5)) return; sessionStorage.setItem(tryKey, String(Date.now()).slice(0, -5)); }catch(e){}
  const codes = (el.dataset.others || "").split(",").map(c => c.trim()).filter(Boolean);
  if(want) codes.push(code);
  const shopRoot = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || "/";
  fetch(shopRoot + "cart/update.js", { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ discount: codes.join(",") }) })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(c => {
      const hit = (c.discount_codes || []).find(d => String(d.code).toUpperCase() === code.toUpperCase());
      if(want ? (hit && hit.applicable) : !hit) location.reload();
    })
    .catch(() => {});
}

/* ---------- Onglets (Description, Livraison et retours, Paiement sécurisé) ---------- */
function initTabs(box){
  if(box.dataset.npInit) return; box.dataset.npInit = "1";
  const tabs = $$("[role='tab']", box);
  const show = t => tabs.forEach(x => {
    const on = x === t;
    x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1;
    const p = document.getElementById(x.getAttribute("aria-controls")); if(p) p.hidden = !on;
  });
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => show(t));
    t.addEventListener("keydown", e => {
      if(e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      show(n); n.focus();
    });
  });
}


/* ---------- Initialisation (aussi après un rechargement de section dans l'éditeur) ---------- */
function init(scope){
  $$("#designs", scope).forEach(initGallery);
  $$("[data-np-demo]", scope).forEach(initDemo);
  $$("[data-np-pdp]", scope).forEach(initPdp);
  $$("[data-np-eta]", scope).forEach(initEta);
  $$("[data-np-tabs]", scope).forEach(initTabs);
  $$("[data-np-trio-cart]", scope).forEach(initTrio);
  $$("[data-scroll]", scope).forEach(a => {
    if(a.dataset.npScroll) return; a.dataset.npScroll = "1";
    a.addEventListener("click", e => { const el = document.getElementById(a.dataset.scroll); if(el){ e.preventDefault(); el.scrollIntoView({ behavior: "smooth" }); } });
  });
}
init(document);
document.addEventListener("shopify:section:load", e => init(e.target));


/* ---------- Bande d'annonce : contenu doublé pour un défilement sans fin ---------- */
const ann = $("#annTrack");
if(ann && ann.children.length){ Array.from(ann.children).forEach(s => { const c = s.cloneNode(true); c.setAttribute("aria-hidden", "true"); ann.appendChild(c); }); }

/* ---------- Menu ---------- */
const menuBtn = $("#menuBtn"), nav = $("#mainNav");
if(menuBtn && nav) menuBtn.addEventListener("click", () => { const o = nav.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", o ? "true" : "false"); });

/* ---------- Cookies : bannière du thème, ou bannière Shopify si elle est activée ---------- */
const ck = $("#cookie");
let showCookies = () => {};
/* Choix de cookies valable 6 mois (CNIL) : au-delà, la bannière revient */
const consent = () => { const c = store.get("np_consent", null); return c && c.at && Date.now() - Date.parse(c.at) < 182 * 864e5 ? c : null; };
if(ck){
  showCookies = () => { ck.hidden = false; const c = consent(); if(c){ $("#ckStats").checked = !!c.stats; $("#ckAds").checked = !!c.ads; } };
  const save = (stats, ads) => { store.set("np_consent", { stats, ads, at: new Date().toISOString() }); ck.hidden = true; $("#ckPrefs").hidden = true; $("#ckCustom").textContent = "Personnaliser"; toast(ads || stats ? "Préférences enregistrées" : "Cookies refusés"); };
  $("#ckRefuse").addEventListener("click", () => save(false, false));
  $("#ckAccept").addEventListener("click", () => save(true, true));
  $("#ckCustom").addEventListener("click", () => { const p = $("#ckPrefs"); if(p.hidden){ p.hidden = false; $("#ckCustom").textContent = "Enregistrer mes choix"; } else save($("#ckStats").checked, $("#ckAds").checked); });
  if(!consent()) ck.hidden = false;
}
/* « Gérer mes cookies » (page Confidentialité) : préférences Shopify si la bannière Shopify est active, sinon celles du thème */
$$("[data-np-cookies], #reopenCookies, #cookieAgain").forEach(b => b.addEventListener("click", e => {
  e.preventDefault();
  if(window.privacyBanner && typeof window.privacyBanner.showPreferences === "function") window.privacyBanner.showPreferences();
  else showCookies();
}));

/* ---------- Mode maquette : zones à compléter ---------- */
const chip = $("#mockChip");
if(chip){
  const apply = hidden => { document.body.classList.toggle("hide-todo", hidden); chip.setAttribute("aria-pressed", hidden ? "false" : "true"); chip.textContent = hidden ? "Maquette : afficher les zones à compléter" : "Maquette : zones à compléter visibles"; };
  apply(!!store.get("np_hide_todo", false));
  chip.addEventListener("click", () => { const h = !document.body.classList.contains("hide-todo"); store.set("np_hide_todo", h); apply(h); });
}

/* ---------- Flocons (désactivés si l'utilisateur limite les animations) ---------- */
(function(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.id = "snow"; c.setAttribute("aria-hidden", "true"); document.body.appendChild(c);
  const ctx = c.getContext("2d"); let W = 0, H = 0, flakes = [];
  function size(){ const dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function make(top){ const r = 1.2 + Math.random() * 3.2; return { x: Math.random() * W, y: top ? -10 : Math.random() * H, r, vy: .35 + r * .22, vx: (Math.random() - .5) * .4, ph: Math.random() * 6.28, star: r > 3.4 }; }
  size(); const N = Math.round(Math.min(70, W / 16)); for(let i = 0; i < N; i++) flakes.push(make(false));
  addEventListener("resize", size);
  function star(f){ ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ph); ctx.beginPath(); for(let k = 0; k < 6; k++){ ctx.moveTo(0, 0); ctx.lineTo(0, -f.r * 2); ctx.rotate(Math.PI / 3); } ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore(); }
  function tick(){
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.shadowColor = "rgba(110,11,21,.35)"; ctx.shadowBlur = 3;
    for(const f of flakes){
      f.ph += .01; f.y += f.vy; f.x += f.vx + Math.sin(f.ph) * .3;
      if(f.y > H + 10) Object.assign(f, make(true));
      if(f.x < -10) f.x = W + 10; if(f.x > W + 10) f.x = -10;
      if(f.star) star(f); else { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill(); }
    }
    requestAnimationFrame(tick);
  }
  tick();
})();
})();
