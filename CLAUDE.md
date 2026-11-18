# Tatami Twin : digital twin d'un club de JJB

Jeu de simulation 2D isométrique (Phaser 3 + TypeScript + Vite) qui reproduit un club de jiu-jitsu brésilien à partir de données saisies, importées (CSV) ou réelles (météo Open-Meteo).

## Architecture (à respecter strictement)

- `src/engine/` : logique de simulation en **TypeScript pur**, sans Phaser ni DOM. Testable, déterministe (PRNG à graine).
  - `types.ts` modèle de domaine, `sim.ts` boucle par tick (1 tick = 1 jour), `buildings.ts` effets des bâtiments sur capacité et coûts,
    `shocks.ts` chocs de scénario, `scenarios.ts` comparaison référence / scénario et détection d'alertes, `expansion.ts` évaluation d'un nouveau club, `calibrate.ts` calibrage sur l'historique.
- `src/data/` : connecteurs interchangeables qui alimentent l'`Environment` du moteur (météo Open-Meteo avec repli sur normales, saisonnalité JSON, CSV, lieux candidats, stockage local).
- `src/render/` : affichage Phaser uniquement (`ClubScene`). Aucune règle métier : la scène reçoit des données via des setters.
- `src/ui/` : panneaux DOM (tableau de bord, saisie, scénarios, nouveau club).
- `src/game.ts` : orchestration moteur + connecteurs pour l'UI. `src/main.ts` : assemblage.

Le moteur ne doit jamais importer `/render`, `/ui` ni `phaser`.

## Commandes

- `npm run dev` serveur local
- `npm test` tests Vitest (moteur et données)
- `npm run build` build de production dans `dist/` (déployé sur GitHub Pages par `.github/workflows/pages.yml`)
- `npm run build:single` génère `single/tatami-twin.html`, une page autonome

## Règles

- Données personnelles : uniquement des identifiants anonymes. L'import CSV supprime les colonnes nom, e-mail, téléphone, adresse. Ne jamais commiter de données réelles.
- Les assets sont dessinés en code à partir de la palette de `docs/DIRECTION_ARTISTIQUE.md`.
- Toute nouvelle règle métier va dans `/engine` avec un test.
- Textes de l'UI en français, phrases courtes, au présent.
