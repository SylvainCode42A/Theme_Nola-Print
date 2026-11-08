# Contrat de l'API d'aperçu NolaPrint (v1)

Pour : Antoine (module de rendu) · Côté boutique : thème `_noel-v2` (`assets/np.js`, `assets/np-mug3d.js`)
Décisions appliquées : 08, 10, 13, 14, 15 · CMP - Personnalisation par produit

## Principe
- Le serveur compose l'**image de la zone d'impression** avec le même code que le fichier envoyé à
  Printify. Il la renvoie en basse définition pendant l'édition.
- Le navigateur ne dessine **aucun texte**. Il plaque l'image reçue :
  - mug : texture du mug 3D, sur le panneau imprimable ;
  - boule : disque, sur la photo de la boule vierge ;
  - bois : rectangle de la forme, détouré au contour, multiplié par le grain, sur la photo de la forme vierge.
- La commande ne transporte que les **choix** de la cliente (propriétés de ligne, plus bas). Le serveur
  refait le rendu en pleine définition à la commande. L'aperçu ne sert qu'à l'affichage.
- Tant que l'URL du serveur n'est pas renseignée dans le thème (réglage `np_apercu_url`), la fiche
  affiche l'image d'exemple de la variante, sans le texte de la cliente.

## Réglage côté thème
`Paramètres du thème › NolaPrint : aperçu › URL du serveur d'aperçu`, par exemple
`https://apercu.nolaprint.fr`. Le thème appelle `{URL}/v1/…`.
Le serveur doit répondre aux en-têtes CORS pour l'origine de la boutique (`https://nolaprint.fr`,
`https://04qh0j-2k.myshopify.com`) : `Access-Control-Allow-Origin`, méthodes `POST, OPTIONS`,
en-tête `Content-Type`.

## 1. `POST /v1/apercu`
Appelée 400 ms après la dernière modification. La requête précédente est annulée (AbortController).
Le thème garde un cache des 30 dernières réponses par corps de requête.

### Requête (JSON)
```json
{
  "version": 1,
  "objet": "mug",
  "forme": null,
  "gabarit": "A",
  "declinaison": "base",
  "destinataire": "mamie",
  "titre": "Mamie",
  "prenoms": [
    { "texte": "Léa", "symbole": "rose" },
    { "texte": "Hugo", "symbole": "muguet" }
  ],
  "phrase": "Nos fleurs pour toi",
  "couleur": "#6B4430",
  "image": null,
  "taille": "apercu"
}
```

| Champ | Valeurs | Notes |
|---|---|---|
| `objet` | `mug`, `boule`, `bois` | |
| `forme` | `coeur`, `sapin`, `etoile`, `cloche`, `chaussette`, `ovale`, ou `null` | bois seulement |
| `gabarit` | `A` (un symbole par prénom), `B` (scène du goûter), `blanche` (page blanche) | |
| `declinaison` | `base`, `noel` | mug A : `base` (fleurs) ou `noel` (ornements), au choix de la cliente ; mug B : `base` ; boule et bois : `noel` |
| `destinataire` | `maman`, `papa`, `mamie`, `papy`, `couple`, `famille`, ou `null` | `null` pour la page blanche |
| `titre` | chaîne, 0 à 30 caractères | déjà composé par le thème (ex. « Papy et Mamie », « Famille Martin ») |
| `prenoms` | 0 à 6 objets `{texte, symbole}` | `texte` 1 à 15 caractères ; `symbole` : id de la liste plus bas, `null` sur le gabarit B et la page blanche ; les prénoms vides ne sont pas envoyés |
| `phrase` | chaîne, 0 à 40 caractères | une ligne |
| `couleur` | code `#RRGGBB` de la palette du destinataire (ou de la page blanche) | le serveur refuse une couleur hors palette (400) |
| `image` | `null` ou `{ "id", "forme", "recadrage" }` | page blanche seulement, voir 3 |
| `taille` | `apercu` (défaut) | réservé : `impression` pour un rendu pleine définition, non utilisé par le thème |

### Réponse 200 (JSON)
```json
{
  "image": "data:image/webp;base64,…",
  "largeur": 1238,
  "hauteur": 578,
  "apercu_id": "ap_7f3c…",
  "apercu_url": "https://apercu.nolaprint.fr/v1/apercus/ap_7f3c….webp",
  "alertes": [ { "champ": "prenoms.1", "code": "reduit" } ],
  "gabarit_version": "A-2026.11.05"
}
```
| Champ | Sens |
|---|---|
| `image` | image de la zone d'impression, en data URI WebP ou PNG, **aux proportions exactes de la zone** |
| `largeur`, `hauteur` | pixels de `image` |
| `apercu_id` | identifiant du rendu ; le thème le joint à la commande (`_apercu_id`) pour la validation humaine |
| `apercu_url` | facultatif : URL publique de cette image, conservée au moins 60 jours ; le panier l'utilise comme vignette |
| `alertes` | facultatif : `reduit` (texte réduit pour tenir), `trop_long` (taille minimale atteinte, revue humaine), `illisible` (contraste) ; le thème affiche un message doux sous le champ |
| `gabarit_version` | version du gabarit utilisée ; le thème la joint à la commande (`_version`) |

Erreurs : `400` (corps invalide, couleur hors palette, symbole inconnu), `413` (corps trop gros),
`429` (trop d'appels), `5xx`. Le thème affiche alors l'image d'exemple et le message
« Aperçu momentanément indisponible : votre texte sera imprimé exactement comme saisi ».
Délai visé : moins de 800 ms au 95e centile pour un mug.

### Zones et proportions attendues
| Objet | Zone d'impression (pleine définition) | `image` d'aperçu conseillée |
|---|---|---|
| mug | 2475 × 1155 px, 210 × 98 mm, un seul panneau, centré à l'opposé de l'anse | 1238 × 578 |
| boule | 900 × 900 px, disque de 76,2 mm | 900 × 900 |
| bois | rectangle de la forme (placeholder Printify), découpé au contour par l'imprimeur | largeur 800 |

Rien n'est exigé hors du disque (boule) ni hors du contour (bois) : le thème masque.

## 2. `POST /v1/images` (page blanche)
Envoi de la photo de la cliente, dès qu'elle la choisit. Corps `multipart/form-data`, champ `fichier`.
Formats : JPG, PNG, HEIC/HEIF. 20 Mo au plus.

Réponse 200 :
```json
{
  "id": "img_91ab…",
  "largeur": 4032,
  "hauteur": 3024,
  "apercu": "https://apercu.nolaprint.fr/v1/images/img_91ab…/apercu.jpg",
  "alerte": "basse_definition"
}
```
- Le serveur convertit le HEIC, applique l'orientation EXIF, et renvoie un JPEG d'au plus 1600 px
  de côté (`apercu`) que le navigateur affiche dans l'outil de recadrage.
- `largeur` et `hauteur` : pixels de l'image d'origine, **après** orientation.
- Refus `422` avec `{"code": "trop_petite"}` sous 1 200 px sur le petit côté ; `alerte` vaut
  `basse_definition` entre 1 200 et 2 000 px.
- L'original est conservé au moins 60 jours ; la commande porte `_image_id`.
- Sans serveur : le thème lit lui-même les JPG et PNG (seuils appliqués), le HEIC est accepté sans aperçu.
  Dans tous les cas, le fichier part aussi dans la commande Shopify (propriété `Votre image`).

## 3. Forme et recadrage de la page blanche
```json
"image": { "id": "img_91ab…", "forme": "sapin", "recadrage": { "x": 0.12, "y": 0.05, "l": 0.64, "h": 0.86 } }
```
- `forme` : `tout`, `sapin`, `etoile`, `rond`.
- **Cadre de la forme** dans la zone d'impression :
  - `tout` : toute la zone (sur le bois, le contour de la forme découpe ensuite) ;
  - `sapin`, `etoile`, `rond` : un carré centré dans la zone, de côté `0,9 × min(largeur, hauteur)`.
- **Contour** de chaque forme, en coordonnées du cadre (0 à 1) :
  - `rond` : cercle de centre (0,5 ; 0,5), rayon 0,5 ;
  - `etoile` : `M0.5 0.02 L0.618 0.358 L0.976 0.365 L0.69 0.582 L0.794 0.926 L0.5 0.72 L0.206 0.926 L0.31 0.582 L0.024 0.365 L0.382 0.358 Z`
  - `sapin` : `M0.5 0.02 L0.74 0.3 L0.64 0.3 L0.86 0.56 L0.74 0.56 L0.96 0.82 L0.56 0.82 L0.56 0.98 L0.44 0.98 L0.44 0.82 L0.04 0.82 L0.26 0.56 L0.14 0.56 L0.36 0.3 L0.26 0.3 Z`
- **Hors du contour : blanc** (#FFFFFF, opaque), sur toute la zone.
- `recadrage` : la portion de l'image d'origine (après orientation EXIF) qui remplit **le cadre de la
  forme**, en fractions de la largeur et de la hauteur de l'image : `x`, `y` (coin haut gauche), `l`, `h`.
  Le thème garantit `l × largeur / (h × hauteur)` = proportion du cadre, et que l'image couvre tout le
  cadre (pas de vide). Le serveur applique ce rectangle tel quel, sans recadrage automatique.
- `recadrage` peut valoir `null` (photo HEIC qu'un navigateur ne sait pas afficher, sans serveur d'images) :
  le serveur centre alors l'image et la fait couvrir le cadre.

## 4. Référentiel partagé (le thème l'envoie, le serveur le valide)
- Destinataires et palettes : brief de génération, section 2 (fond, accents, 4 couleurs de texte).
- Palette de la page blanche (⚠️ à valider) : `#1A1A1A` noir, `#FFFFFF` blanc, `#2B3A67` bleu nuit,
  `#7A1E2E` bordeaux, `#2E5E4E` vert bouteille, `#6B4430` brun.
- Symboles, ids stables :
  - fleurs (déclinaison `base`) : `oeillet`, `violette`, `jonquille`, `marguerite`, `muguet`, `rose`,
    `pied-dalouette`, `glaieul`, `aster`, `souci`, `chrysantheme`, `houx` ;
  - ornements (déclinaison `noel`) : `boule`, `etoile`, `sapin`, `flocon`, `pain-depice`, `coeur-noel`.
- Polices : gabarit A Caveat Brush, gabarit B Nunito, page blanche Nunito (⚠️ à confirmer, décision 15).

## 5. Propriétés de ligne de la commande Shopify
Le serveur lit la commande (`orders/create`), pas l'aperçu. Les noms sans `_` sont visibles de la
cliente au panier et au paiement.

| Propriété | Exemple | Sens |
|---|---|---|
| `Titre` | Mamie | titre composé |
| `Prénom 1` … `Prénom 6` | Léa | prénoms non vides, dans l'ordre |
| `Symbole 1` … `Symbole 6` | Rose (juin) | libellé lisible du symbole (gabarit A) |
| `Phrase` | Nos fleurs pour toi | |
| `Couleur du texte` | Brun | libellé |
| `Votre image` | (fichier) | page blanche : fichier envoyé par Shopify |
| `Forme de l'image` | Sapin | page blanche |
| `_objet` | mug | `mug`, `boule`, `bois` |
| `_gabarit` | A | `A`, `B`, `blanche` |
| `_declinaison` | base | `base`, `noel` |
| `_destinataire` | mamie | |
| `_forme` | sapin | bois seulement |
| `_symbole_1` … `_symbole_6` | rose | ids |
| `_couleur` | #6B4430 | |
| `_forme_image` | sapin | page blanche |
| `_recadrage` | {"x":0.12,"y":0.05,"l":0.64,"h":0.86} | page blanche, JSON |
| `_image_id` | img_91ab… | page blanche, si `/v1/images` a répondu |
| `_apercu_id` | ap_7f3c… | dernier aperçu vu |
| `_apercu_url` | https://… | vignette du panier, si fournie |
| `_version` | A-2026.11.05 | version du gabarit de l'aperçu |
| `_Aperçu vérifié` | oui | case obligatoire |
| `_Droits sur l'image` | oui | page blanche, case obligatoire |

La variante Shopify porte aussi le destinataire, la forme (bois) et `Texte` (`Sans texte` / `Avec texte`,
+1 € dès qu'un champ est rempli). En cas d'écart, les propriétés font foi.

## 6. Ce que le thème garantit
- Prénoms nettoyés (espaces de début et de fin), 15 caractères au plus, 6 au plus ; titre 30, phrase 40.
- Couleur toujours prise dans la palette du destinataire ou de la page blanche.
- Recadrage toujours couvrant et aux proportions du cadre.
- Aucun texte dessiné dans le navigateur : l'aperçu affiché est l'image du serveur, ou l'image d'exemple.
