# Apprentissages : développer un jeu avec Claude en une session

Retour d'expérience sur la construction de Tatami Twin, prototype réalisé en une session de travail avec Claude Code.

## Ce qui a bien marché

1. **Séparer le moteur du rendu dès le premier prompt.** `/engine` en TypeScript pur a permis d'écrire 27 tests et de régler l'équilibre du modèle (adhérents, trésorerie) sans lancer le jeu une seule fois. C'est la décision qui fait gagner le plus de temps.
2. **Faire tourner le modèle avant de dessiner.** Le premier essai donnait un club qui perdait des adhérents chaque mois : les vestiaires saturaient. Une sonde de 12 mois en console a suffi à le voir et à corriger. Sans tests, on l'aurait découvert en jouant, beaucoup plus tard.
3. **Dessiner les assets en code depuis la palette de la DA.** Pas de dépendance à un pack externe, et la DA devient une contrainte concrète (8 couleurs, une seule couleur vive par personnage : la ceinture).
4. **Des connecteurs avec repli.** La météo réelle passe par Open-Meteo, mais le jeu reste jouable hors ligne grâce aux normales climatiques. Un connecteur qui peut échouer doit toujours avoir un plan B.

## Ce qui demande de la vigilance

1. **Les chiffres du modèle sont des hypothèses.** Taux de pratique, élasticité au prix, effet de la pluie : l'IA propose des valeurs plausibles, pas des valeurs vraies. Le jeu affiche « hypothèse à vérifier » partout où c'est le cas. Le calibrage sur l'historique réel est l'étape qui transforme le jouet en outil.
2. **Le scénario révèle des effets de second ordre.** Ajouter un créneau enfants fait gagner des adhérents mais surcharge un prof. C'est exactement l'intérêt du digital twin, et c'est un bon exemple pour un atelier : l'IA aide à voir les conséquences, le jugement reste humain.
3. **Données personnelles.** Même pour un club associatif, la liste d'adhérents est une donnée personnelle (RGPD). L'import supprime automatiquement les colonnes nominatives, et les statuts de l'association sont à vérifier avant d'utiliser de vraies données.
4. **Le périmètre.** Chaque idée (trafic, géopolitique, multijoueur) est tentante. Le MVP tient parce qu'il se limite à une entreprise, une source réelle et un import CSV.

## Pour un atelier ou une conférence

- La métaphore du Kintsugi fonctionne en jeu : les fragilités sont dorées, pas cachées.
- Démo en 3 minutes : lancer x30, voir la rentrée de septembre saturer les tatamis, poser des tatamis, puis lancer le scénario « départ d'un prof ».

## Backlog V2

- Connecteurs trafic (TomTom) et signaux géopolitiques (GDELT).
- Cotisations annuelles payées en septembre (aujourd'hui lissées par mois).
- Sprites dessinés selon les prompts de la DA, animations de randori.
- Zoom au pincement sur mobile.
- Plusieurs clubs sur la même carte après une implantation.
