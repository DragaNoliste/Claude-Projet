# Historique des versions

## 2.0.0 — 25/11/2026 (Version 2 : rapports journaliers)

- Nouveau module **Rapports** (bouton Photos / Rapports en haut) : le rapport journalier d'avancement des travaux complet, au format du fichier « Daily Report ».
  - En-tête, synthèse des projets, **effectif** par métier × projet (matin / après-midi) avec **total des heures**, activités du jour par projet,
    éléments en attente, suite des travaux, problèmes, HSE, reportage photo, validation.
  - **Statut calculé automatiquement** à partir de l'avancement (100 % = terminé) : plus de #REF!.
  - Photos ajoutées sur chaque ligne d'activité, **annotées automatiquement** (Projet / Designation / Rep / Tache) ; ou reprises depuis un projet photo.
  - « Reprendre le rapport de la veille » : effectif + activités non terminées + éléments en attente (jours d'attente mis à jour).
- **Vue semaine** (ex. semaine 48) : toutes les activités de la semaine ou d'un jour, filtres, synthèse par équipement, suivi de chaque activité jour après jour.
- **Effectif & heures** : heures par jour, par projet, par métier, hommes-jours, heures cumulées ; heures par demi-journée réglables par projet.
- **Export Excel** du jour et de la semaine (une feuille par jour + RECAP_SEMAINE, RECAP_EFFECTIF, HISTORIQUE), photos incluses, sans formules.
- **Import des fichiers Excel existants** (feuilles datées), photos dans les cellules comprises.
- **Main-d'œuvre** : une liste déroulante de métier par personne (autant de cases que NBR).
- **Effectif automatique** depuis la main-d'œuvre des activités (SMP, PAP, PAT) ; chef d'atelier et contremaître = 1/1
  si le projet a une activité, sinon 0 ; MHS et MS saisis à la main. Interrupteur pour repasser en saisie manuelle.
- **Export Excel au design de la feuille « 25-11-2026 »** : logo, en-tête Arial bleu marine, cadres, effectif SMP · PAT · PAP · MHS · MS,
  % d'avancement coloré selon le statut, bande orange « éléments en attente », photos 4 par ligne, A3 paysage.
  Le logo est récupéré automatiquement à l'import d'un Daily Report (modifiable dans Paramètres).
- **Photos HD annotées automatiquement** : l'original est conservé ; Projet / Désignation / Repère / Tâche de la ligne d'activité
  sont dessinés à l'export en 2000 px. Éditeur d'annotation au clic sur une photo (valeurs remplaçables par photo),
  bouton « Annoter toutes les photos ».
- La Version 1 reste disponible (tag v1, branche version-1) et partage les mêmes données.

## 1.2.0 — 25/11/2026

- **Utilisateurs KHALID et NAJIB** : écran « Qui utilise l'application ? » au démarrage, changement d'utilisateur depuis l'en-tête.
  Chaque utilisateur a sa propre liste d'équipements, son format de texte et son historique de projets.
  - KHALID : liste PAP / SMP / PAT inchangée (Projet `PAP-M76AAR15`, Designation `Sump Tank`).
  - NAJIB : nouvelle liste CHEMITECS / MS HOPPERS / CALGON CARBON (Projet `CHEMITECS-5553`, Designation `Inter Acid Tower Train B - LEVEL 1`).
  - Ajout d'autres utilisateurs possible.
- **Import de liste** (bouton « Données ») : fichier Excel `.xlsx`, CSV / TXT, ou copier-coller depuis Excel, avec aperçu
  avant import, mode « Ajouter » (doublons ignorés) ou « Remplacer ». Export de la liste en CSV.
- **Format du texte réglable** par utilisateur : mots-clés `{groupe}`, `{no}`, `{nom}`, `{tag}`.
- Recherche : les nombres correspondent au début des mots (« level 3 » ne trouve plus « 5553 »).
- Les projets existants sont rattachés à KHALID.

## 1.1.0 — 24/11/2026

- **Liste déroulante des équipements** (PAP, SMP, PAT) pour le champ Projet, avec recherche (tag, n° ou nom du bac).
  Choisir un bac remplit **Projet** (ex. `PAP-M76AAR15`) et **Désignation** (ex. `Sump Tank`).
- Nouveau champ **Désignation** (projet et personnalisation par photo).
- **Deux modèles d'annotation** au choix, avec aperçu, dans les onglets Projet et Style :
  - **Modèle 1 — Cartouche** : bandeau encadré sous la photo.
  - **Modèle 2 — Texte sur photo** (recommandé, par défaut) : texte blanc centré
    `Projet / Designation / Rep / Tache`, avec ombre et contour.
- **Logo de l'entreprise** optionnel (coin et taille réglables), conservé lors du changement de modèle.
- Interrupteur **Afficher la date**.
- Les projets enregistrés avec la version 1.0 passent automatiquement au Modèle 2.

## 1.0.0 — 24/11/2026

- Première version : import par lot, glisser-déposer, aperçu en direct, saisie groupée,
  numérotation automatique des repères, bibliothèque de tâches, modèles de style,
  historique des projets (IndexedDB), raccourcis clavier, export JPG/PNG et ZIP. 100 % local.
