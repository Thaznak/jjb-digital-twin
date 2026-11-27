# Hellfest Twin

Application mobile (PWA) pour vivre le Hellfest en équipe : voir qui sera devant quelle scène, optimiser son planning et ses trajets, se guider à pied même sans réseau.

- **Carte** isométrique du site, zoom jusqu'au camping, aux parkings et à Clisson. Points d'eau, WC, secours, bars.
- **Programme** par jour, favoris, conflits signalés.
- **Mon plan** : planning optimisé, temps de marche selon la foule et la pluie, concerts vus ensemble mis en avant.
- **Équipe** : chacun ses favoris, partage par lien, « qui est où » à une heure donnée, suggestions.
- **Guidage à pied** pas à pas, avec voix en option. Sans GPS, on choisit son point de départ sur la carte.
- **Météo** de Clisson (Open-Meteo), normales de juin quand le festival est trop loin.
- **Hors ligne** : l'app s'installe sur l'écran d'accueil et reste utilisable sans réseau.

La programmation affichée est un exemple aux noms inventés. Importe la vraie en CSV (`jour, scene, debut, fin, groupe`) depuis l'écran Programme.

## Développer

```bash
npm install
npm run dev
npm test
npm run build
```

Voir `CLAUDE.md` pour l'architecture et les règles.
