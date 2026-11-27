# Hellfest Twin : digital twin mobile du Hellfest

PWA mobile (Vite + TypeScript, rendu SVG) qui reproduit le site du Hellfest à Clisson : carte isométrique à 3 niveaux de zoom (site, camping et parkings, ville), programme, favoris de plusieurs personnes, regroupements devant les scènes, plan de journée optimisé, guidage à pied et météo Open-Meteo. Fonctionne hors ligne.

## Architecture (à respecter strictement)

- `src/engine/` : logique en **TypeScript pur**, sans DOM. Testable, déterministe.
  - `types.ts` modèle, `site.ts` plan du site (scènes, carrefours, chemins, points d'intérêt) et temps de marche (foule, boue),
    `plan.ts` planning optimisé, position estimée, regroupements, suggestions, `guidance.ts` guidage pas à pas,
    `geo.ts` GPS vers plan, `share.ts` codes de partage, `weather.ts`, `time.ts`.
- `src/data/` : connecteurs (programmation d'exemple et import CSV, météo Open-Meteo avec repli sur normales, équipe d'exemple, stockage local, `sync.ts` partage d'équipe).
- `src/render/` : dessin uniquement. `mapArt.ts` dessine les 3 niveaux en SVG, `MapView.ts` gère zoom, déplacement et calques. Aucune règle métier.
- `src/ui/` : écrans DOM (carte et guidage, programme, mon plan, équipe, météo, hors connexion).
- `src/app.ts` : état et orchestration. `src/main.ts` : assemblage, service worker.
- `public/` : manifeste, `sw.js`, icônes.

Le moteur ne doit jamais importer `/render` ni `/ui`.

## Commandes

- `npm run dev` serveur local
- `npm test` tests Vitest
- `npm run build` build dans `dist/` (GitHub Pages via `.github/workflows/pages.yml`)
- `npm run build:single` génère `single/hellfest-twin.html`

## Règles

- Carte dessinée par nous, sans visuel ni logo officiel du festival.
- Programmation d'exemple : noms inventés, toujours signalée comme telle tant que la vraie n'est pas importée.
- Les 4 nouvelles scènes 2027 ont une position estimée, dessinée en pointillés.
- L'ancre GPS (`ANCHOR` dans `app.ts`) est approximative : à calibrer sur place.
- Partage V1 par code ou lien (`#ami=`), sans serveur. La synchro en direct (Supabase) se branche en V2 en implémentant `TeamSync`.
- Données personnelles : un prénom et des favoris, rien d'autre. Pas de suivi GPS partagé. Ne jamais commiter de données réelles.
- Couleurs et formes : `docs/DIRECTION_ARTISTIQUE.md` (direction « Clisson clair »).
- Toute nouvelle règle métier va dans `/engine` avec un test.
- Textes de l'UI en français, phrases courtes, au présent.
