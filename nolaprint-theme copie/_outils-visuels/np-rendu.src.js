/* NolaPrint : aperçu dynamique dans le navigateur (03/11/2026).
   Compose la zone d'impression à partir des éléments d'Antoine (assets np2-el-*, np2-sol-*, np2-branche-*) et des
   placements de CMP - Gabarits de support (gabarits.json, recopié ci-dessous), à la façon de production/rendu/rendu.py :
   « Le jardin de … » (fleurs plantées dans le sol, mois sous le prénom), « Le sapin de … » (ornements pendus à une
   branche), « Le goûter chez … » (scène et colonne de texte), page blanche (photo dans sa forme).
   Sert tant que le serveur d'aperçu n'est pas branché (réglage du thème « URL du serveur d'aperçu ») : dès qu'il l'est,
   c'est l'image du serveur, même code que le fichier d'impression (décisions 08 et 10), qui est plaquée.
   La scène du goûter et le motif de la boule et du bois sont PROVISOIRES (scènes d'Antoine hors dépôt). */
(function(){
"use strict";
const G = __G__;
const PAL = { mamie: "#F3E6D3", papy: "#D6DEE6", maman: "#F2D9DC", papa: "#E3DED6", couple: "#F5EFE0", famille: "#F5EFE0" };
const FAM = { A: "NPCaveat", B: "NPNunito", blanche: "NPNunito" };
const CAPR = { NPCaveat: 0.661, NPNunito: 0.719 };          /* capitale / corps, mesurées par Antoine */
const PPM = { mug: 8, boule: 900 / 76.2, bois: 9.4 };      /* pixels par millimètre de l'aperçu */
const MOIS = { oeillet: "janvier", violette: "février", jonquille: "mars", marguerite: "avril", muguet: "mai", rose: "juin",
  "pied-dalouette": "juillet", tournesol: "août", aster: "septembre", souci: "octobre", chrysantheme: "novembre", houx: "décembre" };
const FORMES_IMG = {
  sapin: [[.5,.02],[.74,.3],[.64,.3],[.86,.56],[.74,.56],[.96,.82],[.56,.82],[.56,.98],[.44,.98],[.44,.82],[.04,.82],[.26,.56],[.14,.56],[.36,.3],[.26,.3]],
  etoile: [[.5,.02],[.618,.358],[.976,.365],[.69,.582],[.794,.926],[.5,.72],[.206,.926],[.31,.582],[.024,.365],[.382,.358]]
};

let asset = n => n;
const cache = {};
function charger(src){
  if(!cache[src]) cache[src] = new Promise((ok, ko) => {
    const im = new Image();
    if(!/^data:|^blob:/.test(src)) im.crossOrigin = "anonymous";
    im.onload = () => ok(im); im.onerror = ko; im.src = src;
  });
  return cache[src];
}
let polices = null;
function chargerPolices(){
  if(polices) return polices;
  try{
    const a = new FontFace("NPCaveat", "url(" + asset("np-font-caveat-brush.ttf") + ")");
    const b = new FontFace("NPNunito", "url(" + asset("np-font-nunito.ttf") + ")", { weight: "200 1000" });
    polices = Promise.all([a.load(), b.load()]).then(fs => fs.forEach(f => document.fonts.add(f))).catch(() => {});
  }catch(e){ polices = Promise.resolve(); }
  return polices;
}

/* ---------- toile en millimètres ---------- */
function toile(sup, wmm, hmm, centre, fond){
  const ppm = PPM[sup], c = document.createElement("canvas");
  c.width = Math.round(wmm * ppm); c.height = Math.round(hmm * ppm);
  const x = c.getContext("2d");
  if(fond){ x.fillStyle = fond; x.fillRect(0, 0, c.width, c.height); }
  return { c, x, ppm, wmm, hmm, centre, sup,
    px(a, b){ return centre ? [(a + wmm / 2) * ppm, (b + hmm / 2) * ppm] : [a * ppm, b * ppm]; },
    mm(v){ return v * ppm; } };
}

/* ---------- texte ---------- */
const fontStr = (fam, px) => (fam === "NPNunito" ? "600 " : "400 ") + px.toFixed(2) + "px " + fam;
const corps = (t, fam, cap) => cap * t.ppm / CAPR[fam];
function largeur(t, fam, morceaux, cap){
  let w = 0;
  for(const [s, k] of morceaux){ t.x.font = fontStr(fam, corps(t, fam, cap * k)); w += t.x.measureText(s).width; }
  return w / t.ppm;
}
function couper(s){
  const m = s.split(/\s+/); if(m.length < 2) return [s];
  let best = null;
  for(let i = 1; i < m.length; i++){ const a = m.slice(0, i).join(" "), b = m.slice(i).join(" "), e = Math.abs(a.length - b.length); if(!best || e < best[0]) best = [e, [a, b]]; }
  return best[1];
}
/* Texte dans une zone (x, y, l, h en mm) : réduit jusqu'au minimum, deux lignes si la zone le permet ;
   l'aperçu ne refuse jamais (au-delà du minimum, il réduit encore et le signale). */
function texteZone(t, morceaux, z, cap, capMin, fam, couleur, o){
  o = o || {};
  const [x, y, l, h] = z;
  const essais = [[morceaux]];
  if(o.moisDessous && morceaux.length === 2) essais.push([[morceaux[0]], [[morceaux[1][0].replace(" · ", ""), morceaux[1][1], morceaux[1][2]]]]);
  if((o.lignes || 1) >= 2 && morceaux.length === 1) essais.push(couper(morceaux[0][0]).map(s => [[s, 1, 1]]));
  const haut = (lignes, c) => c * Math.max(...lignes[0].map(m => m[1])) + lignes.slice(1).reduce((a, li) => a + 1.45 * c * Math.max(...li.map(m => m[1])), 0);
  let choix = null, c = cap;
  for(const lignes of essais){
    c = cap;
    const tient = cc => Math.max(...lignes.map(li => largeur(t, fam, li, cc))) <= l && haut(lignes, cc) <= h + 1e-6;
    while(!tient(c) && c > capMin + 1e-9) c = Math.round((c - 0.1) * 100) / 100;
    if(tient(c)){ choix = lignes; break; }
  }
  let alerte = false;
  if(!choix){ choix = essais[essais.length - 1]; alerte = true;
    while(c > 1 && (Math.max(...choix.map(li => largeur(t, fam, li, c))) > l || haut(choix, c) > h)) c = Math.round((c - 0.1) * 100) / 100; }
  const bloc = haut(choix, c);
  let base = y + (o.aligne === "haut" ? 0 : (h - bloc) / 2) + c * Math.max(...choix[0].map(m => m[1]));
  t.x.textBaseline = "alphabetic"; t.x.textAlign = "left"; t.x.fillStyle = couleur;
  choix.forEach((li, k) => {
    if(k) base += 1.45 * c * Math.max(...li.map(m => m[1]));
    const w = largeur(t, fam, li, c) * t.ppm;
    let [px, py] = t.px(x + l / 2, base); px -= w / 2;
    for(const [s, kk, op] of li){
      t.x.font = fontStr(fam, corps(t, fam, c * kk)); t.x.globalAlpha = op == null ? 1 : op;
      t.x.fillText(s, px, py); px += t.x.measureText(s).width;
    }
    t.x.globalAlpha = 1;
  });
  return { cap: c, alerte, bas: y + (o.aligne === "haut" ? bloc : (h + bloc) / 2) };
}
/* Texte en arc (boule) : arc du haut, lettres vers l'extérieur ; arc du bas, lisible de gauche à droite */
function texteArc(t, s, arc, cap, capMin, fam, couleur){
  const hautArc = arc.deg_debut >= 180;
  let c = cap;
  const r = cc => (arc.rayon - (hautArc ? cc : 0));
  const dispo = cc => (arc.deg_fin - arc.deg_debut) * Math.PI / 180 * r(cc) * 0.96;
  while(largeur(t, fam, [[s, 1]], c) > dispo(c) && c > 1) c = Math.round((c - 0.1) * 100) / 100;
  t.x.font = fontStr(fam, corps(t, fam, c)); t.x.fillStyle = couleur; t.x.textAlign = "center"; t.x.textBaseline = "alphabetic";
  const R = r(c) * t.ppm, [cx, cy] = t.px(0, 0);
  const total = t.x.measureText(s).width / R, mid = (arc.deg_debut + arc.deg_fin) / 2 * Math.PI / 180;
  let a = hautArc ? mid - total / 2 : mid + total / 2;
  for(const ch of s){
    const w = t.x.measureText(ch).width / R, am = hautArc ? a + w / 2 : a - w / 2;
    t.x.save(); t.x.translate(cx + R * Math.cos(am), cy + R * Math.sin(am));
    t.x.rotate(hautArc ? am + Math.PI / 2 : am - Math.PI / 2);
    t.x.fillText(ch, 0, 0); t.x.restore();
    a = hautArc ? a + w : a - w;
  }
}

/* ---------- gabarit A ---------- */
function repartir(n, cols, rangs){
  const out = []; let reste = n;
  for(let r = 0; r < rangs; r++){ const k = Math.min(cols, Math.ceil(reste / (rangs - r))); out.push(k); reste -= k; }
  return out.filter(k => k);
}
function rangees(par, s, e, cx, y0, pas){
  const cases = [];
  par.forEach((k, r) => { const L = k * s + (k - 1) * e, x0 = cx - L / 2; for(let i = 0; i < k; i++) cases.push({ x: x0 + i * (s + e), y: y0 + r * pas, s, r }); });
  return cases;
}
const capP = (sup, f) => sup === "bois" ? ((G.bois.formes[f].A || {}).prenom_cap || G.communs.cap_mm.prenom.bois) : G.communs.cap_mm.prenom[sup];
const moisAffiche = (cmd, n) => !(cmd.sup === "boule" && n > G.communs.mois.omis_boule_si_n_sup);
function blocTexte(cmd, n){
  let h = 1.4 * capP(cmd.sup, cmd.forme);
  if(moisAffiche(cmd, n) && cmd.decl === "base") h += 1.4 * G.communs.mois.cap_mm[cmd.sup];
  return h;
}
function grilleA(cmd){
  const n = cmd.prenoms.length; if(!n) return [];
  const sup = cmd.sup, noel = cmd.decl === "noel", e = G.communs.espace_symboles_mm[sup], ss = G.communs.support_symboles;
  if(sup === "mug"){
    const a = G.mug.A, s = a.symboles.taille_par_n[String(n)];
    return rangees([n], s, e, a.symboles.centre_x, a.symboles.y + (noel ? 4 : 0), 0);
  }
  if(sup === "boule"){
    const a = G.boule.A.symboles;
    if(n <= a.n_max_rangee){ const s = a.une_rangee.taille; return rangees([n], s, e, 0, a.une_rangee.y - s / 2, 0); }
    const s = a.deux_rangees.taille, [h, b] = a.deux_rangees.y;
    return rangees(repartir(n, 3, 2), s, e, 0, h - s / 2, b - h);
  }
  const f = G.bois.formes[cmd.forme], sais = noel ? (f.A.noel || {}) : {};
  const disp = ((sais.disposition || {})[String(n)] || f.A.disposition[String(n)])[0];
  const [s, cols, rangs] = disp, par = repartir(n, cols, rangs), bloc = blocTexte(cmd, n);
  const pasImp = (sais.pas_par_n || {})[String(n)] || (f.A.pas_par_n || {})[String(n)];
  const pas = pasImp || (noel ? s + 0.5 + bloc + e + ss.branche_decalage_mm + ss.hauteur_fraction * s / 2 : s + ss.hauteur_fraction * s + 0.5 + bloc + e);
  const u = f.utile.jambe || f.utile, hauteur = par.length * pas - e;
  let cx, y0;
  if(f.A.grille_y != null){ cx = f.A.centre_x; y0 = f.A.grille_y; } else { cx = u.x + u.l / 2; y0 = u.y + (u.h - hauteur) / 2; }
  if(noel) y0 += ss.branche_decalage_mm;
  return rangees(par, s, e, cx, y0, pas);
}
async function bande(t, nom, xmm, ymm, lmm, hmm){
  const [g, tu, d] = await Promise.all(["gauche", "tuile", "droite"].map(p => charger(asset("np2-" + nom + "-" + p + ".png"))));
  const H = t.mm(hmm), W = t.mm(lmm), sw = im => im.width * H / im.height;
  const [X, Y] = t.px(xmm, ymm);
  let wg = sw(g), wd = sw(d), reste = W - wg - wd;
  if(reste <= 0){ t.x.drawImage(g, X, Y, W / 2, H); t.x.drawImage(d, X + W / 2, Y, W / 2, H); return; }
  const k = Math.max(1, Math.round(reste / sw(tu))), wt = reste / k;
  t.x.drawImage(g, X, Y, wg, H);
  for(let i = 0; i < k; i++) t.x.drawImage(tu, X + wg + i * wt - 0.5, Y, wt + 1, H);
  t.x.drawImage(d, X + wg + reste, Y, wd, H);
}
const accroches = {};
function accroche(im){   /* rangée du premier pixel opaque près de l'axe : là où la ficelle s'attache (fraction) */
  if(accroches[im.src] != null) return accroches[im.src];
  let v = 0;
  try{
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const x = c.getContext("2d"); x.drawImage(im, 0, 0);
    const cx = Math.floor(im.width / 2), dm = Math.max(2, Math.floor(im.width / 20));
    const a = x.getImageData(cx - dm, 0, 2 * dm + 1, im.height).data;
    outer: for(let y = 0; y < im.height; y++) for(let k = 0; k < 2 * dm + 1; k++) if(a[(y * (2 * dm + 1) + k) * 4 + 3] > 128){ v = y / im.height; break outer; }
  }catch(e){}
  return (accroches[im.src] = v);
}
async function poserSymboles(t, cmd, cases){
  const noel = cmd.decl === "noel", ss = G.communs.support_symboles, sous = [];
  const ims = await Promise.all(cmd.prenoms.map(p => charger(asset("np2-el-" + p.symbole + ".png")).catch(() => null)));
  const rs = [...new Set(cases.map(c => c.r))];
  for(const r of rs){
    const rg = cases.filter(c => c.r === r), s = rg[0].s, hs = ss.hauteur_fraction * s;
    const g = rg[0].x, d = rg[rg.length - 1].x + s, L = d - g + ss.marge_largeur_symboles * s, xs = (g + d) / 2 - L / 2, top = rg[0].y;
    let yAxe = 0, ys;
    if(noel){ yAxe = top - ss.branche_decalage_mm; ys = yAxe - hs / 2; } else ys = top + s - ss.sol_enfoncement_fraction * hs;
    await bande(t, noel ? ss.noel : ss.base, xs, ys, L, hs);
    for(const c of rg){
      const im = ims[cases.indexOf(c)]; if(!im) continue;
      const k = t.mm(s) / Math.max(im.width, im.height), w = im.width * k, h = im.height * k;
      const [X, Y] = t.px(c.x, c.y), x = X + (t.mm(s) - w) / 2;
      const y = noel ? Y : Y + t.mm(s) - h;
      if(noel){
        const cx = X + t.mm(s) / 2, y0 = t.px(0, yAxe)[1], y1 = y + accroche(im) * h + t.mm(0.3);
        t.x.strokeStyle = ss.ficelle.couleur; t.x.lineWidth = Math.max(1, t.mm(ss.ficelle.epaisseur_mm));
        t.x.beginPath(); t.x.moveTo(cx, y0); t.x.lineTo(cx, y1); t.x.stroke();
      }
      t.x.drawImage(im, x, y, w, h);
    }
    const bas = top + s + (noel ? 0 : hs * (1 - ss.sol_enfoncement_fraction));
    rg.forEach(() => sous.push(bas));
  }
  return sous;
}
function zoneBois(f, role, forme){
  if(f.A[role]) { const z = f.A[role]; return [z.x, z.y, z.l, z.h]; }
  const u = f.utile;
  if(role === "titre") return u.jambe ? [u.jambe.x, u.jambe.y, u.jambe.l, 11] : [u.x, u.y - 13, u.l, 11];
  return u.pied ? [u.pied.x, u.pied.y + u.pied.h - 10, u.pied.l, 7] : [u.x, u.y + u.h + 2, u.l, 6];
}
const titrePhrase = (cmd, cle) => G.communs.titre_phrase[cle].replace("{surnom}", cmd.titre);

async function rendreA(cmd){
  const sup = cmd.sup, cmm = G.communs, fam = FAM.A, col = cmd.couleur;
  const n = cmd.prenoms.length, noel = cmd.decl === "noel";
  let t;
  if(sup === "mug") t = toile("mug", 210, 98, false, PAL[cmd.dest] || "#FFFFFF");
  else if(sup === "boule") t = toile("boule", 76.2, 76.2, true, null);
  else { const f = G.bois.formes[cmd.forme]; t = toile("bois", f.fichier_mm[0], f.fichier_mm[1], false, null); }
  const cases = grilleA(cmd), sous = await poserSymboles(t, cmd, cases);
  const cle = noel ? "A_noel" : "A_base";
  if(cmd.titre){
    if(sup === "mug"){ const z = G.mug.A.titre; texteZone(t, [[titrePhrase(cmd, cle), 1, 1]], [z.x, z.y, z.l, z.h], cmm.cap_mm.titre.mug, cmm.cap_min_mm.titre.mug, fam, col); }
    else if(sup === "boule"){ const a = G.boule.A; if(!(noel && a.titre_omis_noel) && n <= a.titre_si_n_max) texteArc(t, titrePhrase(cmd, cle), a.titre_arc, cmm.cap_mm.titre.boule, cmm.cap_min_mm.titre.boule, fam, col); }
    else { const f = G.bois.formes[cmd.forme]; texteZone(t, [[titrePhrase(cmd, cle), 1, 1]], zoneBois(f, "titre"), f.A.titre_cap || cmm.cap_mm.titre.bois, cmm.cap_min_mm.titre.bois, fam, col, { lignes: 2 }); }
  }
  const decal = sup === "mug" ? G.mug.A.prenom.decalage_y : sup === "boule" ? G.boule.A.prenom.decalage_y : 0.5;
  const cp = capP(sup, cmd.forme), e = cmm.espace_symboles_mm[sup], am = moisAffiche(cmd, n);
  cases.forEach((c, i) => {
    const p = cmd.prenoms[i]; if(!p.texte) return;
    const m = [[p.texte, 1, 1]], mois = MOIS[p.symbole];
    if(am && !noel && mois) m.push([cmm.mois.separateur + mois, cmm.mois.cap_mm[sup] / cp, cmm.mois.opacite]);
    texteZone(t, m, [c.x - e / 2, sous[i] + decal, c.s + e, blocTexte(cmd, n) + 2], cp, cmm.cap_min_mm.prenom[sup], fam, col, { aligne: "haut", moisDessous: true });
  });
  if(cmd.phrase){
    if(sup === "mug"){ const z = G.mug.A.phrase; texteZone(t, [[cmd.phrase, 1, 1]], [z.x, z.y, z.l, z.h], cmm.cap_mm.phrase.mug, 2.5, fam, col, { lignes: z.lignes || 1 }); }
    else if(sup === "boule"){ const a = G.boule.A.phrase_arc; if(n <= a.si_n_max) texteArc(t, cmd.phrase, a, cmm.cap_mm.phrase.boule, 2.5, fam, col); }
    else { const f = G.bois.formes[cmd.forme]; if(n <= (f.A.phrase_si_n_max || 6)) texteZone(t, [[cmd.phrase, 1, 1]], zoneBois(f, "phrase"), cmm.cap_mm.phrase.bois, 2.5, fam, col); }
  }
  return t;
}

/* ---------- gabarit B (scène et motif PROVISOIRES) ---------- */
async function rendreB(cmd){
  const sup = cmd.sup, cmm = G.communs, fam = FAM.B, col = cmd.couleur, titre = cmd.titre ? titrePhrase(cmd, "B") : "";
  const noms = cmd.prenoms.map(p => p.texte).filter(Boolean);
  if(sup === "mug"){
    const t = toile("mug", 210, 98, false, PAL[cmd.dest] || "#FFFFFF"), b = G.mug.B, z = b.scene;
    const sc = await charger(asset("np2-scene-" + cmd.dest + "-base.png"));
    const [X, Y] = t.px(z.x, z.y); t.x.drawImage(sc, X, Y, t.mm(z.l), t.mm(z.h));
    /* sol prolongé sous la colonne de texte */
    const solY = z.y + z.h * 0.84;
    try{ const c = document.createElement("canvas"); c.width = sc.width; c.height = sc.height; const cx = c.getContext("2d"); cx.drawImage(sc, 0, 0);
      const px = cx.getImageData(sc.width - 3, sc.height - 3, 1, 1).data; t.x.fillStyle = "rgb(" + px[0] + "," + px[1] + "," + px[2] + ")"; }catch(e){ t.x.fillStyle = "#CDBBA7"; }
    const [sx, sy] = t.px(z.x + z.l - 0.3, solY); t.x.fillRect(sx, sy, t.mm(210 - 5 - (z.x + z.l) + 0.3), t.mm(z.y + z.h - solY));
    if(titre) texteZone(t, [[titre, 1, 1]], [b.titre.x, b.titre.y, b.titre.l, b.titre.h], b.titre.cap || cmm.cap_mm.titre.mug, b.titre.cap_min || 4, fam, col, { lignes: 2 });
    const deux = noms.length >= (b.prenoms.deux_colonnes_si_n_min || 99);
    noms.forEach((nm, i) => {
      const colk = deux ? i % 2 : 0, row = deux ? Math.floor(i / 2) : i, l = deux ? b.prenoms.l / 2 : b.prenoms.l;
      texteZone(t, [[nm, 1, 1]], [b.prenoms.x + colk * l, b.prenoms.y0 + row * b.prenoms.pas, l, b.prenoms.h], cmm.cap_mm.prenom.mug, cmm.cap_min_mm.prenom.mug, fam, col);
    });
    if(cmd.phrase) texteZone(t, [[cmd.phrase, 1, 1]], [b.phrase.x, solY - (b.phrase.au_dessus_du_sol_mm || 1) - b.phrase.h, b.phrase.l, b.phrase.h], cmm.cap_mm.phrase.mug, 2.5, fam, col, { lignes: 2 });
    return t;
  }
  /* boule et bois : un seul motif centré, le titre au-dessus, les prénoms et la phrase dessous */
  let t, zone;
  if(sup === "boule"){ t = toile("boule", 76.2, 76.2, true, null); zone = { x: -26, y: -22, l: 52, h: 50, motif: 44 }; }
  else { const f = G.bois.formes[cmd.forme], u = f.utile.jambe || f.utile; t = toile("bois", f.fichier_mm[0], f.fichier_mm[1], false, null);
    const zt = zoneBois(f, "titre"); zone = { x: u.x, y: zt[1], l: u.l, h: u.y + u.h - zt[1], motif: Math.min(u.l * 0.98, u.h * 0.7) }; }
  const cap = cmm.cap_mm, capm = cmm.cap_min_mm, s = sup;
  const hT = 11, mot = zone.motif;
  if(titre) texteZone(t, [[titre, 1, 1]], [zone.x, zone.y, zone.l, hT], cap.titre[s], capm.titre[s], fam, col, { lignes: 2 });
  const im = await charger(asset("np2-motif-" + cmd.dest + "-" + cmd.decl + ".png")).catch(() => null);
  const my = zone.y + hT + 1;
  let y = my + 1.5;
  if(im){   /* le motif à sa largeur, les prénoms juste dessous */
    const k = t.mm(mot) / Math.max(im.width, im.height), w = im.width * k, h = im.height * k;
    const hmm = h / t.ppm, top = my + Math.max(0, (zone.h - hT - hmm - 16) / 2.5);
    const [X, Y] = t.px(zone.x + zone.l / 2, top); t.x.drawImage(im, X - w / 2, Y, w, h);
    y = top + hmm + 2;
  }
  if(noms.length){ const r = texteZone(t, [[noms.join(" · "), 1, 1]], [zone.x, y, zone.l, 8], cap.prenom[s], capm.prenom[s], fam, col, { lignes: 2, aligne: "haut" }); y = r.bas + 1.5; }
  if(cmd.phrase) texteZone(t, [[cmd.phrase, 1, 1]], [zone.x, y, zone.l, 6], cap.phrase[s], 2.2, fam, col);
  return t;
}

/* ---------- page blanche : la photo dans sa forme, fond blanc, texte par-dessus ---------- */
async function rendreBlanche(cmd){
  const sup = cmd.sup, fam = FAM.blanche, col = cmd.couleur, cmm = G.communs;
  let t;
  if(sup === "mug") t = toile("mug", 210, 98, false, "#FFFFFF");
  else if(sup === "boule") t = toile("boule", 76.2, 76.2, true, "#FFFFFF");
  else { const f = G.bois.formes[cmd.forme]; t = toile("bois", f.fichier_mm[0], f.fichier_mm[1], false, "#FFFFFF"); }
  const W = t.c.width, H = t.c.height, im = cmd.image;
  if(im && im.src){
    const src = await charger(im.src).catch(() => null);
    if(src){
      const forme = im.forme || "tout", c = 0.9 * Math.min(W, H);
      const b = forme === "tout" ? { x: 0, y: 0, w: W, h: H } : { x: (W - c) / 2, y: (H - c) / 2, w: c, h: c };
      const r = im.crop || null;
      t.x.save(); t.x.beginPath();
      if(forme === "rond") t.x.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      else if(FORMES_IMG[forme]) FORMES_IMG[forme].forEach(([px, py], i) => i ? t.x.lineTo(b.x + px * b.w, b.y + py * b.h) : t.x.moveTo(b.x + px * b.w, b.y + py * b.h));
      else t.x.rect(b.x, b.y, b.w, b.h);
      t.x.closePath(); t.x.clip();
      if(r) t.x.drawImage(src, r.x * src.width, r.y * src.height, r.l * src.width, r.h * src.height, b.x, b.y, b.w, b.h);
      else { const k = Math.max(b.w / src.width, b.h / src.height), w = src.width * k, h = src.height * k; t.x.drawImage(src, b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h); }
      t.x.restore();
    }
  }
  const noms = cmd.prenoms.map(p => p.texte).filter(Boolean), s = sup;
  const L = t.wmm, Hm = t.hmm, o = t.centre ? -L / 2 : 0;
  if(cmd.titre) texteZone(t, [[cmd.titre, 1, 1]], [o + L * 0.1, o + Hm * 0.06, L * 0.8, Hm * 0.14], cmm.cap_mm.titre[s], 3, fam, col, { lignes: 2 });
  if(noms.length) texteZone(t, [[noms.join(" · "), 1, 1]], [o + L * 0.1, o + Hm * 0.74, L * 0.8, Hm * 0.09], cmm.cap_mm.prenom[s], 2.5, fam, col);
  if(cmd.phrase) texteZone(t, [[cmd.phrase, 1, 1]], [o + L * 0.1, o + Hm * 0.85, L * 0.8, Hm * 0.08], cmm.cap_mm.phrase[s], 2.2, fam, col);
  return t;
}

/* Décoration en bois, forme cœur : sur la photo, le ruban recouvre le haut du cœur ; l'aperçu (comme les
   maquettes) réduit le dessin à 78 % et le descend de 23 mm. À reprendre quand le gabarit de découpe sera relevé. */
function maquetteCoeur(t){
  const c = document.createElement("canvas"); c.width = t.c.width; c.height = t.c.height;
  const k = 0.78, w = c.width * k, h = c.height * k;
  c.getContext("2d").drawImage(t.c, (c.width - w) / 2, t.mm(23), w, h);
  return c;
}

/* cmd : { objet: mug|verre|bois, forme, gabarit: A|B|blanche, decl: base|noel, dest, titre, prenoms: [{texte, symbole}],
   phrase, couleur (hex), image: {src, forme, crop} } → canvas de la zone d'impression */
async function rendre(cmd){
  await chargerPolices();
  const c = Object.assign({}, cmd, { sup: cmd.objet === "verre" ? "boule" : cmd.objet, forme: cmd.forme || "coeur", couleur: cmd.couleur || "#2B3A67",
    titre: (cmd.titre || "").trim(), phrase: (cmd.phrase || "").trim(), prenoms: (cmd.prenoms || []).map(p => ({ texte: (p.texte || "").trim(), symbole: p.symbole })) });
  if(c.sup === "bois" && !G.bois.formes[c.forme]) c.forme = "coeur";
  if(c.gabarit === "A" && c.sup === "bois") c.prenoms = c.prenoms.slice(0, G.bois.formes[c.forme].n_max);
  const t = c.gabarit === "A" ? await rendreA(c) : c.gabarit === "B" ? await rendreB(c) : await rendreBlanche(c);
  return c.sup === "bois" && c.forme === "coeur" ? maquetteCoeur(t) : t.c;
}
const nMax = (objet, forme) => objet === "bois" ? ((G.bois.formes[forme] || {}).n_max || 6) : 6;

window.NPRendu = { rendre, nMax, configurer(fn){ asset = fn; }, precharger(){ return chargerPolices(); } };
})();
