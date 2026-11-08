# Modifications proposées (lot 4)

## 1. FLOW - Routage par ancre
Seul le frontmatter change (`status` et `last-verified`), plus une ligne sous le titre. Le reste de la note est gardé tel quel, pour l'historique.

```yaml
status: remplacé
last-verified: 2026-11-02
```

Ligne ajoutée sous `# FLOW - Routage par ancre` :

> **Remplacé le 02/11/2026** : la boutique est un thème Shopify où chaque page a sa vraie URL. Plan du site : [[OVR - Boutique NolaPrint]]. Cette note décrit la maquette HTML du 29/10 et n'est plus tenue à jour.

## 2. A VERIFIER : nouvelle partie « Boutique »
Ajoutée avant `## Tranchés`. `last-verified` reste au 02/11/2026.

```markdown
## Boutique

| Point à vérifier | Moyen | Source | Priorité | Résultat |
|---|---|---|---|---|
| Import du CSV v3 (variantes « Personnalisation ») : sans lui, la fiche affiche 19,45 / 20,45 € mais le panier facture 18,45 € ; la colonne des prix barrés est vide et peut effacer ceux en place | connecté | [[CMP - Produit]], [[FLOW - Importer les produits par CSV]] | P1 | |
| Remises à créer dans Shopify : 3 remises automatiques de lot (1,80 / 1,97 / 1,80 €, quantité minimale 3) et le code `TRIO-NOEL` (5,20 € sur la commande, combinable, minimum d'achat conseillé) | connecté | [[FLOW - Lots et trio]] | P1 | |
| Trio remisé à −5,20 € (chat du 02/11) alors que la décision 12 dit « lot un de chaque sans remise » : acter par une décision | humain | [[FLOW - Lots et trio]], [[12 - Lots de 3 à environ moins 10 %, lot un de chaque sans remise]] | P1 | |
| Prix barrés affichés sur toutes les cartes alors que la décision 09 dit « sans faux prix barrés » : chaque prix barré doit être le prix le plus bas des 30 jours précédents (art. L112-1-1 Code de la consommation) | lecture, humain | [[OVR - Boutique NolaPrint]], [[09 - Établissement des nouveaux prix, alignés sur Cadeau Plus sans faux prix barrés]] | P1 | |
| Bannière cookies du thème non reliée à l'API Customer Privacy de Shopify : elle ne bloque pas les pixels ; activer la bannière Shopify ou une app avant le pixel Meta | connecté | [[MOD - Cookies et consentement]] | P1 | |
| Accusé de réception automatique par e-mail de la rétractation (obligatoire) | connecté | [[FLOW - Rétractation en ligne]] | P1 | |
| Puce « Maquette : zones à compléter » visible par les clientes : à retirer avant la mise en ligne | test | [[MOD - Habillage]] | P1 | |
| Délais réels d'expédition et de livraison par objet (réglages 2-3 / 7-12, boule 12-32 jours ouvrés) et dates Noël (8/12, boule 10/11) | échantillon | [[CMP - Produit]] | P1 | |
| Zone d'impression du mug (80 × 212 mm estimés) et côté imprimé (un seul côté) à recaler sur le blueprint Printify 1016 ; fichiers plats d'Antoine pour la 3D | connecté | [[MOD - Mug 3D]] | P1 | |
| Durée de conservation par Shopify des images importées par les clientes | lecture | [[CMP - Panier]] | P2 | |
| Bande d'annonce encore en emoji, cases de la fiche en icônes au trait : harmoniser ? | humain | [[MOD - Habillage]] | P3 | |
```
