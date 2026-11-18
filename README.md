# Tatami Twin

Le digital twin d'un club de jiu-jitsu brésilien, sous forme de jeu de gestion en 2D isométrique.

On construit le club (dojo, tatamis, vestiaires, accueil, parking), on saisit ses vraies données (adhérents, créneaux, profs, charges, cotisations) ou on les importe en CSV, et la simulation tourne jour après jour avec la météo réelle (Open-Meteo) et la saisonnalité de l'année scolaire. Les fragilités du club apparaissent sur la carte en **fissures dorées façon Kintsugi**.

**Jouer** : https://thaznak.github.io/jjb-digital-twin/

## Ce qu'on peut faire

- **Jouer le club** au fil des jours (x1, x5, x30), poser des tatamis ou des vestiaires et voir l'effet sur la capacité et les coûts.
- **Tableau de bord transverse** : trésorerie, adhérents, remplissage des créneaux, satisfaction, charge des profs.
- **Mes données** : saisie manuelle de tout (adhérents, créneaux, profs, charges, tarifs), import CSV des adhérents, calibrage du modèle sur l'historique mensuel.
- **Scénarios** : nouveau créneau enfants, hausse de cotisation, départ ou embauche d'un prof, canicule, stage, hausse du loyer. Comparaison référence / scénario sur 6 ou 12 mois et alertes sur la carte.
- **Nouveau club** : évaluer l'implantation dans un autre lieu (population, concurrence, loyer, météo locale, cannibalisation), avec trésorerie sur 36 mois, point mort et verdict.

Les données du jeu sont fictives. Tes saisies restent dans ton navigateur (localStorage).

## Développer

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # tests du moteur
npm run build
```

Voir [CLAUDE.md](CLAUDE.md) pour l'architecture, [docs/DIRECTION_ARTISTIQUE.md](docs/DIRECTION_ARTISTIQUE.md) pour la DA et [docs/APPRENTISSAGES.md](docs/APPRENTISSAGES.md) pour le retour d'expérience.

## Formats CSV

Adhérents : `id,segment,ceinture,age,date_inscription,seances_semaine` (segment = adulte ou enfant).

Historique : `mois,ca,adherents,inscriptions,departs` (les deux dernières colonnes sont facultatives).
