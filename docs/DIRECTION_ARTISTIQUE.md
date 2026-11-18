# Direction artistique : « Tatami Twin »

Un jeu de gestion en 2D isométrique, à mi-chemin entre la maquette d'architecte vivante et le tableau de bord business. Le public est un entrepreneur (ici un responsable de club de JJB) : le ton est bienveillant, lisible, avec une pointe d'humour, jamais infantilisant.

Intention centrale : **le jeu est un révélateur**. Comme l'IA révèle les forces et les fragilités d'une équipe, la carte révèle celles du club. Les points de fragilité ne sont pas cachés : ils apparaissent en **fissures dorées façon Kintsugi**, qu'on répare en jouant.

## 1. Palette (8 couleurs)

| Rôle | Nom | Hex | Usage |
|---|---|---|---|
| Fond | Ardoise de nuit | `#1F2A3D` | Fond de carte, hors-terrain |
| Sol | Lin | `#E9E4D8` | Murs, panneaux d'UI clairs |
| Matière | Bleu tatami | `#3E7CB1` | Tatamis, accent principal de l'UI |
| Matière | Bois hinoki | `#C69C6D` | Sols de bâtiments, cadres |
| Accent | Or kintsugi | `#D9A93B` | Fissures de fragilité, sélection, moments clés |
| État : sain | Vert bambou | `#5BAE7E` | Indicateurs OK |
| État : tension | Ambre | `#E59F3A` | Indicateurs à surveiller |
| État : crise | Vermillon doux | `#D35B4F` | Indicateurs en crise |

Règle : l'or n'est jamais une couleur d'état. Il signale une fragilité *révélée*, quel que soit son niveau. Les trois couleurs d'état sont toujours doublées d'une forme (pastille pleine, triangle, octogone) pour rester lisibles par les daltoniens.

Ceintures (couleurs de contenu, hors palette d'UI) : blanche `#F4F4F0`, grise `#9AA0A6`, jaune `#E8C547`, orange `#E08A3C`, verte `#4F9D5B`, bleue `#2F6FB5`, violette `#7A4FA0`, marron `#7A5235`, noire `#1A1A1A` avec barrette rouge.

## 2. Grille isométrique

- Projection iso 2:1, tuile de **64 x 32 px**, hauteur d'un étage : 24 px.
- Carte de 20 x 20 tuiles. Origine en haut, l'axe x part vers la droite-bas, l'axe y vers la gauche-bas.
- Profondeur : `depth = (x + y) * 10 + hauteur`. Les personnages sont triés sur la même échelle.
- Lumière unique venant du haut gauche : face gauche à 100 %, face droite à 78 %, dessus à 112 % de la teinte de base.

## 3. Bâtiments

Volumes simples, presque des maquettes en bois peint, avec un seul détail signature par bâtiment.

| Bâtiment | Emprise | Détail signature | Effet en jeu |
|---|---|---|---|
| Dojo (salle) | 4 x 4 | Toit à deux pans et noren bleu à l'entrée | Débloque les créneaux, porte les tatamis |
| Tatami | 1 x 1 | Tuile bleue à liseré clair | +8 places par créneau |
| Vestiaires | 2 x 2 | Porte avec pictogramme de gi | +20 personnes simultanées |
| Accueil | 2 x 1 | Comptoir et tableau des horaires | Améliore la conversion des essais |
| Parking | 2 x 2 | Marquage au sol, une voiture | Augmente l'attractivité locale |

## 4. Personnages

- Silhouette de 14 x 24 px, tête ronde, gi blanc ou bleu, **la ceinture est la seule couleur vive**, toujours visible.
- 16 frames maximum par personnage : marche 4 directions x 2 frames (8), salut 2 frames, randori 4 frames, repos 2 frames.
- Enfants : même silhouette à 75 % de hauteur. Professeurs : gi noir, ceinture noire.

## 5. UI

- Panneaux en Lin sur Ardoise, coins à 6 px, une seule ombre portée pour le panneau actif.
- Typographies : **Barlow Condensed** (titres, esprit dossard sportif), **Inter** (texte), **JetBrains Mono** (chiffres).
- Jauges horizontales segmentées comme une ceinture à barrettes : 4 barrettes, chacune un quart de l'objectif.
- Notifications : petite carte en bas à gauche, pictogramme d'état, phrase courte au présent (« Le créneau de 19 h déborde »).

## 6. Météo, saisons et crises

- **Pluie** : particules obliques bleu pâle, le sol se fonce de 10 %.
- **Froid / neige** : flocons blancs lents, sol désaturé.
- **Canicule** : légère teinte ambre sur toute la scène.
- **Saisons** : la bordure de la carte change (vert tendre au printemps, paille l'été, rouille l'automne, gris bleuté l'hiver).
- **Crises et fragilités** : fissures dorées qui se dessinent sur le bâtiment concerné (tatamis saturés, professeur surchargé, trésorerie négative à l'accueil). Elles disparaissent quand le problème est réglé.

## 7. Cinq principes de DA

1. **Lire avant de jouer** : chaque état du club se comprend en 3 secondes, sans ouvrir de panneau.
2. **La fragilité est dorée** : on montre les failles comme des lieux à réparer, pas comme des échecs.
3. **Une couleur vive par personnage** : la ceinture. Tout le reste reste calme.
4. **Maquette, pas cartoon** : volumes nets, peu de détails, humour dans les textes plutôt que dans les formes.
5. **Le chiffre est toujours à un clic** : chaque effet visuel renvoie à une donnée réelle ou à une hypothèse nommée.

## 8. Prompts d'image réutilisables

Base commune à coller avant chaque prompt :
> Isometric 2:1 game asset, 64x32 tile grid, clean flat shading with light from top-left, painted wooden architectural model look, limited palette (slate #1F2A3D, linen #E9E4D8, tatami blue #3E7CB1, hinoki wood #C69C6D, kintsugi gold #D9A93B), transparent background, no text, no logo.

- **Bâtiment** : `{base} A {dojo | locker room | reception desk | small parking lot} for a Brazilian jiu-jitsu club, footprint {4x4 | 2x2 | 2x1} tiles, one signature detail: {blue noren curtain | gi pictogram door | timetable board | painted parking lines}.`
- **Tatami** : `{base} Single blue tatami mat tile, subtle light border, top view isometric, seamless when tiled.`
- **Personnage** : `{base} Sprite sheet, 16 frames, 14x24 px character in white jiu-jitsu gi with a {belt color} belt, walk cycle 4 directions x 2 frames, bow 2 frames, sparring 4 frames, idle 2 frames.`
- **Météo** : `{base} Overlay particle sprites: {diagonal light-blue rain streaks | slow white snowflakes | warm amber heat haze}, 8 variations, 16x16 px.`
- **Kintsugi** : `{base} Thin golden kintsugi crack lines, 6 variations, drawn to overlay an isometric building face, glowing slightly, transparent background.`
- **UI** : `Flat game UI kit, linen panels on dark slate, 6 px radius, segmented progress bars styled like a jiu-jitsu belt with 4 stripes, status icons circle/triangle/octagon in green #5BAE7E, amber #E59F3A, red #D35B4F.`

Dans le prototype, tous les assets sont dessinés en code (Phaser Graphics) à partir de cette palette. Les prompts ci-dessus servent à produire les vrais sprites plus tard.
