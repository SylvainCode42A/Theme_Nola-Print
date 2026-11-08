/* Visuels du gabarit B (et contrôle) rendus par assets/np-rendu.js, le même code que l'aperçu de la fiche */
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto("http://localhost:8765/rendu-test.html"); await p.evaluate(() => NPRendu.configurer(n => "/assets/" + n));
  const D = ["mamie", "papy", "maman", "papa", "couple", "famille"], SUR = { mamie: "Mamie", papy: "Papy", maman: "Maman", papa: "Papa", couple: "Papy et Mamie", famille: "la famille" };
  const TXT = { mamie: "#6B4430", papy: "#2B3A67", maman: "#7B3F61", papa: "#2B3A67", couple: "#7A1E2E", famille: "#2E5E4E" };
  const out = "/home/claude/gen-b/"; fs.mkdirSync(out, { recursive: true });
  for (const [objet, decl] of [["mug", "base"], ["verre", "noel"], ["bois", "noel"]]) for (const d of D) for (const texte of [true, false]) {
    const n = objet === "mug" ? 3 : 1;
    const cmd = { objet, forme: "coeur", gabarit: "B", decl, dest: d, titre: texte ? SUR[d] : "", prenoms: texte ? ["Léa", "Hugo", "Jade"].slice(0, n).map(t => ({ texte: t })) : [], phrase: "", couleur: TXT[d] };
    const url = await p.evaluate(async c => (await NPRendu.rendre(c)).toDataURL("image/png"), cmd);
    fs.writeFileSync(`${out}${objet}-${d}-${decl}-${texte ? "t" : "nu"}.png`, Buffer.from(url.split(",")[1], "base64"));
  }
  await b.close(); console.log("ok");
})();
