# Direction artistique : « Académie »

Version 2 (18 nov. 2026), construite à partir de la planche d'intention fournie par Paul. Elle remplace la direction « Tatami Twin » v1 (ardoise, tatami bleu, lin).

Un jeu de gestion en 2D isométrique qui ressemble à une **vraie académie de JJB, vue en maquette pixel art** : dojo monochrome, tatamis blancs, gi blancs et noirs, quelques touches de bois et de vert, une nuit pluvieuse dehors. L'interface est un **cadre papier blanc** avec une typographie condensée noire, comme une affiche de club. Le public est un entrepreneur (ici un responsable de club) : ton bienveillant, lisible, jamais infantilisant.

Intention centrale : **le jeu est un révélateur**. Les points de fragilité apparaissent en **fissures dorées façon Kintsugi**, seule couleur chaude et brillante de la scène.

## 1. Palette

| Rôle | Nom | Hex | Usage |
|---|---|---|---|
| Cadre | Papier | `#FAFAF8` / `#FFFFFF` | Fond de l'interface, cartes |
| Texte | Encre | `#141414` | Titres, boutons, contours pixel, gi noirs |
| Scène | Nuit | `#1D1F22` | Fond de la carte, extérieur sous la pluie |
| Sol | Pierre | `#3A3D42` / `#35383D` | Carrelage intérieur |
| Murs | Enduit clair | `#E4E4E1`, soubassement `#2F3034` | Murs du dojo, vestiaires, boutique |
| Tatami | Blanc tatami | `#EEEEEC`, joints `#D3D4D2`, bordure `#3A3C40` | Surface d'entraînement |
| Matière | Bois | `#B98A57` | Accueil, bancs, portes, étagères |
| Vivant | Feuillage | `#5E8C3A` / `#3F6A2A` | Plantes en pot |
| Accent | Or kintsugi | `#E0A526` | Fissures de fragilité, moments clés |
| État : sain | Vert | `#3F8F4E` | Pastille ronde |
| État : tension | Ambre | `#F2B33D` | Triangle |
| État : crise | Rouge | `#D4513F` | Octogone |

Règles : l'or n'est jamais une couleur d'état. Les états sont toujours doublés d'une forme (rond, triangle, octogone) et d'un pictogramme de deux pratiquants (assis face à face, en garde, l'un sur l'autre).

Ceintures (seule couleur vive d'un personnage) : blanche `#F4F4F0`, grise `#9AA0A6`, jaune `#E8C547`, orange `#E08A3C`, verte `#4F9D5B`, bleue `#2F6FB5`, violette `#7A4FA0`, marron `#7A5235`, noire `#1A1A1A` avec barrette rouge.

## 2. Grille isométrique

- Projection iso 2:1, tuile de **64 x 32 px**, hauteur d'un étage : 24 px.
- Carte de 20 x 20 tuiles. Origine en haut, l'axe x part vers la droite-bas, l'axe y vers la gauche-bas.
- Profondeur : `depth = (x + y) * 10 + hauteur`. Les personnages sont triés sur la même échelle.
- Lumière unique venant du haut gauche : face gauche à 100 %, face droite à 78 %, dessus à 112 % de la teinte de base.

## 3. Bâtiments et décor

Volumes nets, murs clairs avec soubassement sombre, contour encre de 1 px. Un détail signature par bâtiment.

| Bâtiment | Emprise | Détail signature | Effet en jeu |
|---|---|---|---|
| Dojo | 6 x 6 | Deux murs du fond, marque à trois bandes, tableau des horaires, lampe suspendue, plantes, muret à chaussures | Porte les tatamis, débloque les cours |
| Tatami | 1 x 1 | Dalle blanche à joint gris | +2 places par créneau |
| Vestiaires | 2 x 2 | Porte en bois, pictogramme, rangée de casiers, banc | +25 personnes en même temps |
| Accueil | 2 x 1 | Comptoir bois plateau blanc, écran, plante, hôte en t-shirt noir | +15 % de conversion des essais |
| Boutique | 2 x 2 | Étagères de gi pliés blancs et noirs, gi suspendus, bandeau « BOUTIQUE » | +1,5 € de marge par adhérent et par mois |
| Parking | 2 x 2 | Asphalte, marquage, voiture claire | +6 % d'attractivité |

Extérieur : sol mouillé avec reflets quand il pleut, anneau de saison autour de la carte.

## 4. Personnages (pixel art)

- 16 x 31 px debout, 18 x 22 px assis en tailleur, contour encre automatique, rendu sans lissage.
- Variété : 5 carnations, 4 coiffures (court, chignon, boucles, rasé), barbe possible, gi blanc (60 %) ou noir (40 %).
- **La ceinture est la seule couleur vive**, avec le pan qui pend. Ceinture noire : barrette rouge.
- Le professeur porte un gi noir et une ceinture noire. Le personnel d'accueil porte un t-shirt noir.
- Enfants : même construction, plus petits.
- Poses : debout (se déplace entre les tatamis) et assis (attend en bord de tapis). Animations prévues en V2 : marche, salut, randori.

## 5. UI

- Cadre papier blanc, filet noir de 3 px sous le bandeau et autour de la scène.
- Bandeau : titre condensé noir en capitales, filet vertical, sur-titre en petites capitales espacées, trois bandes obliques dégradées (noir, gris, gris clair), devise « Encadrer · Enseigner · Développer votre communauté ».
- Carte flottante sur la scène, bord noir de 2 px : **Cours du soir**, **Capacité** (chiffre + jauge de 20 segments), **Accueil** (pastille « N en attente »), météo et facteurs de demande, légende Sain / Tension / Crise.
- Typographies : **Barlow Condensed** (titres), **Inter** (texte), **JetBrains Mono** (chiffres).
- Notifications : carte blanche en bas à gauche, pictogramme d'état, phrase courte au présent.

## 6. Météo, saisons et crises

- **Pluie** : particules obliques bleu pâle, le sol se fonce de 10 %.
- **Froid / neige** : flocons blancs lents, sol désaturé.
- **Canicule** : légère teinte ambre sur toute la scène.
- **Saisons** : la bordure de la carte change (vert tendre au printemps, paille l'été, rouille l'automne, gris bleuté l'hiver).
- **Crises et fragilités** : fissures dorées qui se dessinent sur le bâtiment concerné (tatamis saturés, professeur surchargé, trésorerie négative à l'accueil). Elles disparaissent quand le problème est réglé.

## 7. Cinq principes de DA

1. **Lire avant de jouer** : chaque état du club se comprend en 3 secondes, sans ouvrir de panneau.
2. **La fragilité est dorée** : l'or est la seule couleur chaude de la scène, réservée aux failles à réparer.
3. **Monochrome d'abord** : noir, blanc, gris, un peu de bois et de vert. La couleur vive d'un personnage, c'est sa ceinture.
4. **Une vraie académie** : chaque élément existe dans un club réel (muret à chaussures, casiers, gi en boutique), pas de décor fantaisiste.
5. **Le chiffre est toujours à un clic** : chaque effet visuel renvoie à une donnée réelle ou à une hypothèse nommée.

## 8. Prompts d'image réutilisables

Base commune à coller avant chaque prompt :
> Isometric 2:1 pixel-art game asset, 64x32 tile grid, crisp 1px dark outlines, light from top-left, monochrome martial arts academy look (ink #141414, light plaster walls #E4E4E1 with dark baseboard #2F3034, white mats #EEEEEC, wood #B98A57, plants #5E8C3A, kintsugi gold #E0A526 only for cracks), transparent background, no text, no logo.

- **Bâtiment** : `{base} A {dojo | locker room | reception desk | gear shop | small parking lot} for a Brazilian jiu-jitsu club, footprint {4x4 | 2x2 | 2x1} tiles, one signature detail: {three-stripe wall mark and shoe rack | lockers and wooden door | wooden counter with monitor | shelves of folded white and black gis | painted parking lines}.`
- **Tatami** : `{base} Single white tatami mat tile, light grey seam, top view isometric, seamless when tiled.`
- **Personnage** : `{base} Sprite sheet, 16 frames, 16x31 px character in a {white | black} jiu-jitsu gi with a {belt color} belt, {skin tone}, {hair style}, walk cycle 4 directions x 2 frames, bow 2 frames, sparring 4 frames, idle 2 frames.`
- **Météo** : `{base} Overlay particle sprites: {diagonal light-blue rain streaks | slow white snowflakes | warm amber heat haze}, 8 variations, 16x16 px.`
- **Kintsugi** : `{base} Thin golden kintsugi crack lines, 6 variations, drawn to overlay an isometric building face, glowing slightly, transparent background.`
- **UI** : `Flat game UI kit, white paper panels with 2px black borders, bold condensed black uppercase titles, 20-segment green capacity bar, amber waiting pill, status icons circle/triangle/octagon in green #3F8F4E, amber #F2B33D, red #D4513F with two-grappler pictograms.`

Dans le prototype, tous les assets sont dessinés en code (Phaser Graphics) à partir de cette palette. Les prompts ci-dessus servent à produire les vrais sprites plus tard.
