# Industrial Photo Annotator

Application web pour préparer les photos des **rapports journaliers** de chantier : chaque photo reçoit un cartouche professionnel avec le projet, le repère, la tâche réalisée et la date, en lot et en un clic.

```
PROJET:          TANK FARM PROJECT
REPÈRE:          V-101
TÂCHE RÉALISÉE:  Travaux de soudage sur la virole V-101.
DATE:            24/11/2026
```

**100 % local** : les photos sont traitées dans le navigateur et enregistrées uniquement sur votre ordinateur (IndexedDB). Aucun serveur, aucune API payante, aucun abonnement.

---

## Installation (Windows)

1. Installez **Node.js LTS** (version 20 ou plus récente) : <https://nodejs.org>.
2. Double-cliquez sur **`Lancer.bat`** dans le dossier du projet.
   - La première fois, les dépendances s'installent automatiquement (1 minute environ, connexion Internet nécessaire).
   - L'application s'ouvre ensuite dans votre navigateur sur <http://localhost:5173>.
3. Pour arrêter l'application, fermez la fenêtre noire.

### Méthode manuelle (PowerShell)

```powershell
cd "C:\Users\<vous>\Desktop\TECH\Industrial Photo Annotator"
npm install
npm run dev
```

Puis ouvrez <http://localhost:5173> dans Chrome ou Edge.

### Utilisation sur tablette / smartphone (même réseau Wi-Fi)

```powershell
npm run dev -- --host
```

Vite affiche une adresse `http://192.168.x.x:5173` à ouvrir sur la tablette. Les données restent dans le navigateur de l'appareil utilisé.

### Version de production (optionnel)

```powershell
npm run build
npm run preview
```

Le dossier `dist/` contient une version statique qui peut être hébergée sur n'importe quel serveur web interne.

---

## Version 2 — Rapports journaliers (bouton **Rapports** en haut)

Le module **Rapports** produit le rapport journalier d'avancement des travaux, au même format que le fichier Excel « Daily Report jj-mm-aaaa.xlsx », et garde l'historique de toute la semaine.

| Onglet | Contenu |
|---|---|
| **Rapport du jour** | En-tête (n° d'affaire, atelier, établi par…), synthèse des projets, **effectif** par métier et par projet (matin / après-midi), activités du jour par projet, éléments en attente, suite des travaux, problèmes, HSE, reportage photo |
| **Semaine** | Toutes les activités de la semaine (ex. semaine 48) ou d'un seul jour, filtres projet / statut / recherche, synthèse par équipement, suivi de chaque activité jour après jour |
| **Effectif & heures** | Total des heures de la semaine et par jour, heures par projet et par métier, hommes-jours, effectif moyen / max, heures cumulées |
| **Paramètres** | Projets, heures par demi-journée (ex. 4 h + 4 h, MHS 5 h + 4 h), heures cumulées de départ, métiers, en-tête par défaut |

### Utilisation quotidienne

1. Choisissez le jour dans la barre de la semaine, puis **Reprendre le rapport du …** : l'effectif, les activités non terminées et les éléments en attente de la veille sont repris (les jours d'attente sont mis à jour).
2. Mettez à jour l'effectif et l'**avancement %** de chaque activité : le statut (terminé / en cours…) et les heures se calculent seuls.
3. Ajoutez les photos avec le bouton **+** de chaque ligne : elles sont **annotées automatiquement** (Projet / Designation / Rep / Tache) avec le style de l'onglet Photos. Le bouton **Photos d'un projet** reprend aussi les photos déjà annotées dans l'onglet Photos.
4. **Excel du jour** ou **Excel semaine** : le fichier est téléchargé, prêt à envoyer (une feuille par jour + RECAP_SEMAINE, RECAP_EFFECTIF, HISTORIQUE, photos incluses).

**Importer vos anciens rapports :** bouton **Importer un rapport Excel**, choisissez un fichier « Daily Report …xlsx » puis cochez les jours (chaque feuille datée devient un rapport, photos comprises).

> Heures du jour = effectif du matin × heures du matin + effectif de l'après-midi × heures de l'après-midi, par projet (réglable dans Paramètres).

## Utilisateurs et listes d'équipements

Au démarrage, choisissez votre nom (**KHALID**, **NAJIB**…). Chaque utilisateur a **sa propre liste d'équipements**, son propre format de texte et **son propre historique de projets**. Pour changer : cliquez sur votre nom en haut à droite.

| Utilisateur | Liste | Exemple de texte sur la photo |
|---|---|---|
| KHALID | PAP · SMP · PAT | `Projet: PAP-M76AAR15` / `Designation: Sump Tank` |
| NAJIB | CHEMITECS · MS HOPPERS · CALGON CARBON | `Projet: CHEMITECS-5553` / `Designation: Inter Acid Tower Train B - LEVEL 1` |

### Importer une nouvelle liste (bouton **Données**)

1. Préparez le tableau comme d'habitude : une ligne avec le **nom du groupe** (ex. `CHEMITECS`), puis les colonnes **No. · Tank Name · Client Tag** (les autres colonnes sont ignorées). Plusieurs groupes peuvent se suivre.
2. Cliquez **Données** → **Fichier Excel / CSV** (`.xlsx`, `.csv`, `.txt`), **ou** sélectionnez les cellules dans Excel, `Ctrl+C`, puis collez-les dans la zone de texte et cliquez **Analyser**.
3. Vérifiez l'aperçu, choisissez **Ajouter à la liste actuelle** (les doublons sont ignorés) ou **Remplacer toute la liste**, puis **Importer**.

Dans la même fenêtre : supprimer un groupe, exporter la liste en CSV (sauvegarde, réimportable), et régler le texte écrit sur la photo avec les mots-clés `{groupe}`, `{no}`, `{nom}`, `{tag}` (ex. `{groupe}-{tag}` → `PAP-M76AAR15`).

## Utilisation — flux de travail rapide

**Importer 20 photos → Nom du projet → Repères et tâches → Aperçu → Tout exporter.**

1. **Projet** (onglet *1 · Projet*) : nom du projet, date, site/zone optionnel. Appliqués automatiquement à toutes les photos.
   - Le projet se choisit dans une **liste déroulante** des équipements (groupes PAP, SMP, PAT). Choisir `5555-TB01 | SUMP TANK | M76AAR15` remplit **Projet** = `PAP-M76AAR15` et **Désignation** = `Sump Tank`. Tapez quelques lettres (tag, n° ou nom, ex. `seal tn`) pour filtrer, ↑/↓ + Entrée pour choisir. Un texte libre reste possible.
   - Pour modifier la liste : bouton **Données** (import Excel / CSV / copier-coller).
2. **Photos** : glissez-déposez vos photos n'importe où dans la fenêtre, ou cliquez sur *Choisir des photos*. Elles sont triées par nom de fichier. Utilisez les flèches de déplacement pour changer l'ordre.
3. **Détails** (colonne de droite) : pour chaque photo, saisissez le **Repère**, la **Tâche réalisée** (ou cliquez une tâche de la bibliothèque) et des observations optionnelles. `Ctrl+Entrée` passe à la photo suivante avec le curseur dans *Repère*.
4. **Aperçu en direct** : chaque modification met l'aperçu à jour instantanément. Cliquez dessus pour le plein écran.
5. **Export** (onglet *5 · Export* ou bouton orange *Exporter tout*) : JPG ou PNG, qualité, dimensions, nommage des fichiers. Export de la photo actuelle, de la sélection, de tout en ZIP ou en fichiers séparés.

### Gagner du temps

| Fonction | Où | Effet |
|---|---|---|
| **Saisie groupée** | Cochez des photos → panneau *Saisie groupée* | Copie la tâche / observations de la photo actuelle vers toutes les photos cochées, **en conservant les repères**. |
| **Numérotation auto** | *Saisie groupée* | Ex. `V-101` → V-101, V-102, V-103… dans l'ordre de la galerie (pas réglable). |
| **`{repere}`** | Texte de la tâche | `Travaux de soudage sur la virole {repere}.` devient « … sur la virole V-101. » sur chaque photo. |
| **Précédente** (`Ctrl+D`) | Détails | Reprend la tâche et les observations de la photo précédente. |
| **Copier / Coller** | Détails | Copie les infos d'une photo et les colle sur une autre. |
| **Incomplètes** | Galerie | Sélectionne les photos sans repère ou sans tâche. |
| **Personnaliser** | Détails | Projet / date / site différents pour une photo précise. |

### Annotation — choisir son modèle

Deux modèles au choix, sélectionnables en un clic (cartes avec aperçu dans les onglets *Projet* et *Style*). Le changement s'applique à toutes les photos du projet ; le logo est conservé.

| Modèle | Rendu |
|---|---|
| **Modèle 1 — Cartouche** | Bandeau encadré ajouté sous la photo (rien n'est masqué) : PROJET / DÉSIGNATION / REPÈRE / TÂCHE RÉALISÉE / DATE / SITE. |
| **Modèle 2 — Texte sur photo** *(recommandé, par défaut)* | Texte blanc centré en bas de la photo + logo, style chantier. |

Réglages détaillés de chaque modèle dans l'onglet *Style* :

- **Texte sur photo** (par défaut, style chantier) : texte blanc centré en bas de la photo, avec ombre et contour pour rester lisible :
  ```
  Projet: PAP-M76AAR15
  Designation: Sump Tank
  Rep: M-55TB01
  Tache: Assemblage Anchor Chair
  ```
  La date, le site et les observations peuvent être ajoutés avec les interrupteurs.
- **Logo** (optionnel) : ajoutez le logo de l'entreprise (PNG/JPG), choisissez le coin et la taille. Il est enregistré avec le style et les modèles.
- **Cartouche** : bandeau encadré PROJET / DÉSIGNATION / REPÈRE / TÂCHE RÉALISÉE / DATE.
- Position : **Bas**, **Haut**, **Bas gauche**, **Bas droite**.
- Placement *Hors photo* (recommandé) : le bandeau est ajouté sous/au-dessus de l'image, **rien n'est masqué**. *Sur la photo* : bandeau semi-transparent superposé.
- Taille du texte, police, couleurs, opacité, séparateurs, majuscules, affichage du site et des observations.
- La taille du texte s'adapte automatiquement à la résolution et au format de chaque photo (paysage, portrait, panoramique).
- **Modèles** : enregistrez un style sous un nom et réappliquez-le en un clic ; définissez un style par défaut pour les nouveaux projets.

### Bibliothèque de tâches

Bouton *Tâches* (en-tête) ou *Gérer* (sous le champ Tâche) : ajouter, modifier, réordonner, supprimer les descriptions types. Liste par défaut : débitage, chanfreins, assemblage, soudage, meulage, contrôle dimensionnel, contrôle END, montage, peinture, manutention, nettoyage.

### Historique des projets

Chaque projet (photos comprises) est enregistré automatiquement. Bouton *Historique* : rouvrir, rechercher ou supprimer un projet. *Nouveau* démarre un projet vierge ; le précédent reste dans l'historique.

> Les données sont liées au navigateur utilisé. Vider les données de navigation du site efface les projets : exportez toujours vos photos finales.

### Raccourcis clavier

| Touches | Action |
|---|---|
| `→` / `PgDn` | Photo suivante (hors champ de saisie) |
| `←` / `PgUp` | Photo précédente (hors champ de saisie) |
| `Ctrl+Entrée` | Photo suivante + curseur dans *Repère* |
| `Ctrl+Maj+Entrée` | Photo précédente + curseur dans *Repère* |
| `Entrée` (dans Repère) | Aller au champ *Tâche réalisée* |
| `Ctrl+D` | Copier la tâche de la photo précédente |
| `Ctrl+Maj+C` / `Ctrl+Maj+V` | Copier / coller les infos |
| `Espace` | Cocher / décocher la photo actuelle |
| `Ctrl+E` | Exporter la photo actuelle |
| `Ctrl+Maj+E` | Tout exporter en ZIP |
| `Suppr` | Retirer la photo actuelle |
| `?` | Aide des raccourcis |

---

## Où sont mes données ? Sauvegarde

Toutes les données (utilisateurs, projets photo, rapports, photos originales, listes, paramètres) sont enregistrées **uniquement dans le navigateur de cet ordinateur**, à l'adresse `http://localhost:5173`. Rien n'est envoyé sur Internet.

- **Bouton Enregistrer** (ou `Ctrl+S`) : enregistre immédiatement ; l'enregistrement automatique reste actif.
- **Sauvegarde** : menu utilisateur (en haut à droite) → *Sauvegarde / restauration* → **Sauvegarder toutes les données** : un fichier `.zip` à copier sur une clé USB, un disque ou OneDrive.
- **Restauration** : même fenêtre → *Choisir un fichier de sauvegarde* → **Restaurer** (les éléments de la sauvegarde remplacent ceux qui ont le même identifiant ; le reste est conservé).

> Vider les données de navigation du navigateur efface tout : faites une sauvegarde régulière. Les données sont propres à chaque navigateur (Chrome ≠ Edge).
> L'application utilise toujours le port 5173 ; si `Lancer.bat` signale que le port est occupé, fermez l'autre fenêtre de l'application.

## Qualité d'image

- L'export repart toujours du **fichier original** en pleine résolution (l'aperçu utilise une copie réduite pour la rapidité).
- L'orientation EXIF des smartphones est respectée.
- PNG = sans perte ; JPG 92 % = excellent compromis. Option de redimensionnement (1920 px, 1280 px…) pour alléger les rapports.
- Formats acceptés : JPG, PNG, WebP, GIF, BMP, AVIF. Les fichiers HEIC (iPhone) doivent être convertis en JPG (réglage iPhone : *Appareil photo → Formats → Le plus compatible*).

## Architecture technique

| Élément | Technologie |
|---|---|
| Interface | React 19 + TypeScript, Vite, Tailwind CSS v4 |
| Annotation | HTML5 Canvas (`src/lib/render.ts`) |
| Export ZIP | JSZip (`src/lib/exporter.ts`) |
| Persistance | IndexedDB (`src/lib/db.ts`) : projets, images (original, aperçu, miniature), réglages |

```
src/
  App.tsx                 mise en page, raccourcis, glisser-déposer, export
  hooks/useProject.ts     état du projet + sauvegarde automatique
  hooks/useTaskLibrary.ts bibliothèque de tâches
  lib/render.ts           dessin du cartouche (commun aperçu / export)
  lib/images.ts           import, miniatures, cache d'aperçu
  lib/exporter.ts         rendu pleine résolution, ZIP, téléchargements
  lib/db.ts               IndexedDB
  components/             panneaux et fenêtres de l'interface
```

Scripts : `npm run dev` (développement), `npm run build` (vérification TypeScript + build), `npm run preview` (tester le build).
