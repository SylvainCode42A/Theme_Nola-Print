# NolaPrint Noël v2 — mise en ligne

Nouvelle version complète du site d'après les décisions 13, 14 et 15 et le mail d'Antoine du 02/11/2026.
Elle vit dans `~/Documents/nolaprint-theme/_noel-v2/` et se pousse comme un **thème séparé, non publié** :
le site actuel reste en ligne tant que tu ne publies pas la v2.

## Ce qui change
- **9 produits** : par objet (mug, boule, bois), le gabarit A « un symbole au choix par prénom », le gabarit B
  « la table du goûter », et la page blanche. Le destinataire (Maman, Papa, Mamie, Papy, Couple, Famille) est une
  variante ; sur le bois, la forme aussi (6 × 6). Plus de `?design=` : les liens utilisent `?variant=`.
- **Fiche produit** : « Pour qui ? », forme (bois), symboles (mug A : fleurs de naissance ou ornements de Noël),
  puis le texte en trois champs facultatifs : titre (liste de surnoms du destinataire, deux surnoms pour le couple,
  « Famille + nom », ou saisie libre), 0 à 6 prénoms avec chacun son symbole (gabarit A), phrase ; couleur du texte
  parmi les 4 de la palette du destinataire ; police fixée par le gabarit. **+1 € dès qu'un champ est rempli**
  (variante « Avec texte »).
- **Page blanche** : photo JPG, PNG ou HEIC (20 Mo, refus sous 1 200 px, avertissement sous 2 000 px), forme
  tout / sapin / étoile / rond sur fond blanc, recadrage déplacer + zoomer par la cliente.
- **Aperçu** : le navigateur ne dessine plus aucun texte. Il plaque l'image rendue par le serveur d'Antoine
  (contrat joint : `Contrat API aperçu NolaPrint.md`). Mug : la 3D est gardée, avec la bande de 2475 × 1155 px
  (210 × 98 mm, un seul panneau). Boule : disque. Bois : forme détourée, multipliée par le grain.
  **Tant que le serveur n'est pas branché**, la fiche plaque l'illustration de la variante **sans texte**
  (`np2-plat-*`) sur l'objet : mug 3D, boule, bois (toutes les formes).
- **Maquettes** (cartes de l'accueil, couverture, offres, images produits) : l'illustration est enroulée sur la photo
  du mug par lancer de rayons, avec la perspective du bord et du pied, l'ombrage de la photo et 2 mm de blanc
  sous la lèvre ; boule avec reflet du verre ; bois multiplié par le grain. Les cartes gardent un exemple de texte
  (« Mamie », Léa · Hugo · Jade) pour montrer le rendu.
- **Accueil** : galerie par objet, puces Tous · Maman · Papa · Mamie · Papy · Couple · Famille · Noël. Noël est
  une collection croisée (les déclinaisons de Noël apparaissent dans Noël et dans leur destinataire).
  **Amies et fratrie est masquée** (réglage de la section pour la rouvrir). Liens publicitaires :
  `/?pour=mamie#designs`, `/?objet=verre#designs`.
- **Menu** : Mugs · Boules de Noël · Décorations en bois · Noël · Votre photo · Questions (vers les collections).
- **Panier** : vignette = l'aperçu du serveur s'il existe ; lots et trio comptent tous les produits d'un même objet.
- **Textes** : FAQ (accueil et page), CGV articles 2 et 3, annonces sans emoji, couverture, « Deux façons ».

## 1. Pousser la v2 en thème non publié (Terminal)
```
cd ~/Documents/nolaprint-theme
shopify theme push --path _noel-v2 --unpublished --theme "NolaPrint Noël v2"
```
Note le numéro du thème affiché (ex. 2100000000). Pour les envois suivants :
`shopify theme push --path _noel-v2 --theme <numéro> --only <fichier>`.
Aperçu : admin › Boutique en ligne › Thèmes › « NolaPrint Noël v2 » › Aperçu.

## 2. Admin Shopify
1. **Produits** : Produits › Importer › `_imports-shopify/nolaprint-produits-v4-noel-2026.csv`.
   Les 9 produits arrivent **en brouillon** (208 variantes). Ajoute à chacun l'image de
   `_imports-shopify/images-produits/<handle>.jpg` (vue au paiement et dans Google).
2. **Collections automatiques** (Produits › Collections › Créer, condition « Tag du produit est égal à ») :
   | Titre | Handle (URL) | Tag |
   |---|---|---|
   | Mugs | `mugs` | `np-mug` |
   | Boules de Noël | `boules-de-noel` | `np-verre` |
   | Décorations en bois | `decorations-en-bois` | `np-bois` |
   | Noël | `noel` | `noel` |
3. **Remises** (Remises › Créer) :
   - 3 remises automatiques « Montant fixe sur des produits », appliquées à chaque article, quantité minimale 3,
     sur la collection : Mugs 1,80 € · Boules de Noël 1,97 € · Décorations en bois 1,80 € ; combinables avec les
     autres remises produit et les codes de commande.
   - Code `TRIO-NOEL` : 5,20 € sur la commande, combinable avec les remises produit, minimum d'achat 50 €.
4. **Comptes clients** activés (Paramètres › Comptes clients) pour la page Suivi de commande.

## 3. Vérifier dans l'aperçu (téléphone et ordinateur)
- Accueil : chaque puce, chaque onglet, une carte de chaque sorte ouvre la bonne variante.
- Une fiche de chaque produit : changer de destinataire, taper un titre, 2 prénoms, une phrase : le prix passe
  à +1 € ; bois : changer de forme ; page blanche : photo trop petite refusée, photo correcte recadrée.
- Lot de 3 sur une fiche, puis panier : remise lot, indication du trio, code TRIO-NOEL posé avec les 3 objets.

## 4. Basculer
1. Thèmes › « NolaPrint Noël v2 » › Publier.
2. Passer les 9 produits en **Actif** ; passer les 3 anciens (`mug-personnalise`, `boule-de-noel-verre-personnalisee`,
   `decoration-bois-personnalisee`) en **Archivé** (pas supprimés).
3. Ajouter des redirections d'URL des 3 anciens produits vers les nouveaux gabarits A (Navigation › Redirections).

## 5. Quand Antoine envoie ses images et son serveur
- **Serveur** : Paramètres du thème › NolaPrint : aperçu › URL du serveur d'aperçu (ex. `https://apercu.nolaprint.fr`).
- **Images** : les visuels `np2-*` livrés ici sont **provisoires** (dessinés par code pour tenir la place). Les remplacer
  par les rendus d'Antoine, mêmes noms, puis pousser `--only "assets/np2-*"` :
  - `np2-plat-<objet>-<a|b>-<destinataire>-<base|noel>.jpg` : zone d'impression **sans texte** (mug 1238 × 578,
    boule 900 × 900, bois cœur 820 × 1084) — aperçu de la fiche quand le serveur ne répond pas ;
  - `np2-ex-<objet>-<a|b>-<destinataire>-<base|noel>.jpg` (1000 px) et `-s.jpg` (480 px) : maquettes de face ;
  - `np2-offre-lot-<mug|verre|bois>.jpg`, `np2-offre-trio.jpg` (1200 × 900) et leurs `-t.jpg` ;
  - objet : `mug`, `verre`, `bois` ; mug : A en `base` et `noel`, B en `base` ; boule et bois : `noel`.
  - maquette du mug à partir d'une image de zone d'impression : `python3 _outils-visuels/maquette_mug.py plat.jpg sortie.jpg`
    (caméra calée sur `np-mug-vierge.jpg` à 0,2 px près ; numpy, opencv-python, pillow).

## Fichiers du paquet
- `_noel-v2/` : les fichiers modifiés ou nouveaux du thème v2 (le reste est déjà dans le dossier).
- À retirer de `_noel-v2/` (plus utilisés) : `snippets/np-designs.liquid`, `snippets/np-name-overlay.liquid`,
  `snippets/np-bois-shapes.liquid`, et dans `assets/` les anciens visuels `np-*-d01…d10-*.jpg`, `np-mug-d*-flat.jpg`,
  `np-offre-*.jpg`. Les photos d'objets vierges `np-*-vierge*.jpg` restent.
- `_imports-shopify/` : le CSV v4 et les 9 images produits.
- `_outils-visuels/` : l'outil de maquette du mug (`maquette_mug.py`) et le calage de sa caméra (`mug_cam.py`).
- `Contrat API aperçu NolaPrint.md` : pour Antoine.

## Points ouverts (à trancher, pas bloquants pour l'aperçu)
- Trio à −5,20 € alors que la décision 12 le voulait sans remise : décision 13 bis à écrire.
- Page blanche avec texte : +2 € puis +1 € (CMP Personnalisation), contre « texte inclus » avant.
- Mug A : fleurs et ornements au choix par un interrupteur commun à tous les prénoms (pas de mélange).
- Palette de la page blanche (noir, blanc, bleu nuit, bordeaux, vert bouteille, brun) à valider.
- Chaussette en bois : 86 × 162 mm chez Printify contre une photo plus trapue ; titre 30 et phrase 40 caractères.
