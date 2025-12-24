# ARCHITECTURE.md

## 1. Objectif

Ce document décrit l’architecture technique de **PanoTriangulator** : une web app **frontend-only** (sans backend obligatoire) permettant de :

* charger des sources locales (dossier d’images + CSV)
* afficher panos et boxes
* associer des observations à un `object_id`
* trianguler en temps réel
* enregistrer progressivement dans un **CSV projet** (création ou mise à jour)

Cible principale : **Chrome / Edge** (File System Access API).

---

## 2. Stack et outils

### 2.1 Frontend

* **TypeScript** (recommandé) ou JavaScript
* **Vite** (build/dev server)
* UI : React (recommandé) ou Vanilla (possible)
* Carte : **Leaflet**
* Parsing CSV : `papaparse`

### 2.2 Stockage local

* File System Access API :

  * `showDirectoryPicker()`
  * `showOpenFilePicker()`
  * `showSaveFilePicker()`
  * `FileSystemFileHandle` / `FileSystemDirectoryHandle`
* Fallback (si API non dispo) :

  * lecture via `<input type="file">`
  * écriture via téléchargement (download)

### 2.3 Persistance navigateur

* **IndexedDB** (via `idb-keyval` ou équivalent) :

  * stocker les handles (quand possible)
  * stocker l’état UI (objets actifs, couleurs)
  * stocker un snapshot de session pour reprise rapide

---

## 3. Découpage du repo

```
/ (root)
  PROJECT_SPEC.md
  ARCHITECTURE.md
  README.md
  package.json
  vite.config.ts
  /src
    /app
      App.tsx
      router.ts
    /components
      SourcePicker.tsx
      MapView.tsx
      PanoDock.tsx
      PanoCard.tsx
      PanoViewer.tsx
      BoxOverlay.tsx
      ObjectPanel.tsx
      TodoList.tsx
      SaveStatus.tsx
    /state
      store.ts
      selectors.ts
      colors.ts
    /data
      csv.ts
      schema.ts
      projectIO.ts
      handles.ts
    /geo
      bearing.ts
      triangulation.ts
      projection.ts
      quality.ts
    /utils
      debounce.ts
      ids.ts
      time.ts
      errors.ts
```

---

## 4. Modèle de données (runtime)

### 4.1 Types principaux

#### Pano

* `pano_id: string`
* `lat: number`
* `lng: number`
* `heading: number`
* `imageWidth: number`
* `imageHeight: number`
* `imageFileHandle?: FileSystemFileHandle` (résolu depuis le dossier)
* `imageUrl?: string` (URL.createObjectURL)

#### Detection (box)

* `detection_id: string` (stable, ex: hash pano_id + coords + score)
* `pano_id: string`
* `xmin,ymin,xmax,ymax: number`
* `score?: number`
* `status: 'unassigned'|'assigned'` (dérivé)

#### Observation (sélection utilisateur)

* `obs_id: string`
* `object_id: string`
* `detection_id: string`
* `pano_id: string`
* `xmin,ymin,xmax,ymax: number`
* `cx: number` (centre horizontal)
* `bearing_deg: number`
* `pano_lat: number`
* `pano_lng: number`
* `created_at: string`

#### ObjectState (état courant d’un objet)

* `object_id: string`
* `color: string`
* `obj_lat?: number`
* `obj_lng?: number`
* `n_obs: number`
* `rms_m?: number`
* `updated_at: string`

---

## 5. Fichiers et schémas CSV

### 5.1 CSV d’entrée : detections/boxes

* Colonnes minimales : `pano_id, xmin, ymin, xmax, ymax`
* Colonnes optionnelles : `score, crop_filename, class`

### 5.2 CSV d’entrée : metadata panos

* Colonnes : `pano_id, lat, lon, heading, imageWidth, imageHeight`
* Note : si le CSV utilise `lng` au lieu de `lon`, normaliser.

### 5.3 CSV projet (sortie) : format unique

Deux types de lignes.

#### OBS

* `row_type=OBS`
* `object_id, pano_id, xmin, ymin, xmax, ymax, cx, bearing_deg, pano_lat, pano_lng, updated_at`

#### OBJ

* `row_type=OBJ`
* `object_id, obj_lat, obj_lng, n_obs, rms_m, updated_at`

Règle : pour un `object_id`, il peut y avoir N lignes OBS, et 1 ligne OBJ (dernier état).

---

## 6. Flux applicatifs

### 6.1 Chargement des sources (SourcePicker)

1. L’utilisateur sélectionne :

* dossier d’images
* CSV boxes
* CSV metadata
* (optionnel) CSV projet existant

2. Validation :

* existence
* colonnes attendues
* cohérence pano_id

3. Indexation du dossier images :

* lister les fichiers du dossier
* construire un index `pano_id -> fileHandle`

4. Parsing CSV :

* `boxes.csv` -> `Detection[]`
* `metadata.csv` -> `Map<pano_id, PanoMeta>`

5. Chargement projet (si fourni) :

* `project.csv` -> `Observation[]` + `ObjectState[]`
* reconstruire l’état runtime (assignations, objets déjà définis)

6. L’application passe en mode “édition”.

### 6.2 Interaction carte -> panos

* Carte affiche `Pano[]`.
* Clic pano => `openPano(pano_id)`
* `PanoDock` crée une `PanoCard`.

### 6.3 Interaction pano -> observation

* `PanoViewer` affiche l’image + `BoxOverlay`.
* Clic sur une box :

  * déterminer `object_id` actif
  * créer/mettre à jour observation pour cette box dans cet objet
  * recalculer triangulation de l’objet
  * mettre à jour le point objet sur la carte
  * marquer la box comme assignée

### 6.4 Gestion de l’objet actif

* `ObjectPanel` permet :

  * créer nouvel objet
  * sélectionner objet existant
  * changer couleur (option)

Le changement d’objet ne ferme pas les panos.

### 6.5 Liste “à traiter” (TodoList)

* Liste des `Detection` non assignées OU assignées mais sans objet final (selon règle)
* Clic item :

  * ouvrir pano correspondant
  * scroller/centrer sur la box
  * surligner la box

---

## 7. Géométrie (core)

### 7.1 Calcul du bearing à partir d’une box

* `cx = (xmin + xmax) / 2`
* Pour une image équirectangulaire :

  * `delta = (cx / imageWidth - 0.5) * 360`
  * `bearing = wrap360(heading + delta)`

### 7.2 Projection locale

* Projection locale en mètres autour d’un centre (moyenne des panos utilisés).
* Approximation equirectangulaire locale suffisante à l’échelle urbaine.

### 7.3 Triangulation (moindres carrés)

* Chaque observation définit une droite (origine pano, direction bearing).
* Résoudre le point minimisant la somme des distances orthogonales aux droites.
* Détecter les cas dégénérés (droites quasi parallèles) et renvoyer un état “instable”.

### 7.4 Qualité

* RMS (mètres) = racine de la moyenne des distances point->droite.
* UI :

  * < 3m : bon
  * 3–8m : moyen
  * > 8m : faible

---

## 8. Sauvegarde / mise à jour du CSV projet

### 8.1 Modes

* **Manual Save** : bouton Enregistrer
* **Autosave** (option) : debounce 1000–2000ms après dernière action

### 8.2 Comportement “Enregistrer”

#### Si un CSV projet est déjà sélectionné

* lire le fichier courant (si nécessaire)
* fusionner :

  * OBS : union (par `obs_id` ou par clé stable)
  * OBJ : remplacer la ligne OBJ par objet (dernier état)
* réécrire le fichier via `createWritable()`

#### Si aucun CSV projet n’est sélectionné

* ouvrir un Save As…
* créer le fichier
* écrire contenu complet
* mémoriser le handle comme `projectFileHandle`

### 8.3 Prise en compte des anciennes données

* Au chargement d’un projet existant :

  * conserver toutes les lignes OBS
  * reconstruire l’état OBJ à partir des lignes OBJ (si présentes)
  * si incohérence : recalculer OBJ à partir des OBS

### 8.4 Stratégie anti-corruption

* Écriture via `FileSystemWritableFileStream` (écriture complète)
* Éviter les “append” partiels (risque de fichier cassé)
* En autosave, limiter la fréquence (debounce + statut)

---

## 9. Gestion des handles (File System Access)

### 9.1 Stockage

* Sauvegarder en IndexedDB :

  * `imagesDirHandle`
  * `boxesFileHandle`
  * `metadataFileHandle`
  * `projectFileHandle` (si choisi)

### 9.2 Permissions

* À la reprise, tester `queryPermission()` puis `requestPermission()` si nécessaire.
* Si refus : demander à l’utilisateur de re-sélectionner.

### 9.3 Fallback

* Si `showDirectoryPicker` indisponible :

  * utiliser `<input webkitdirectory>` (Chrome)
  * sinon charger uniquement les fichiers choisis
* Si écriture impossible :

  * proposer Export CSV (download)

---

## 10. Performance et UX

### 10.1 Chargement images

* Ne pas charger toutes les images en mémoire.
* À l’ouverture d’un pano :

  * lire le fichier via handle
  * `URL.createObjectURL(file)`
  * libérer l’URL à la fermeture du pano.

### 10.2 Rendu boxes

* Overlay canvas ou SVG (SVG recommandé pour interactions box).
* Gestion du zoom :

  * zoom sur l’image (CSS transform + recalcul coordonnées) ou via canvas.

### 10.3 Multi-panos

* `PanoDock` gère une liste de cartes ouvertes.
* Chaque carte a :

  * état zoom/pan
  * box highlight

### 10.4 Couleurs objets

* Palette stable basée sur `object_id`.
* Les boxes sélectionnées prennent la couleur de l’objet.

---

## 11. État global (store)

### 11.1 Store minimal

* `sources`: handles + chemins
* `panosById`
* `detectionsById`
* `observationsByObjectId`
* `objectsById`
* `activeObjectId`
* `ui`: panos ouverts, highlights, filtres
* `save`: statut, dernier timestamp

### 11.2 Sélecteurs

* detections non assignées
* objets “non définis” (n_obs < 2 ou RMS trop élevé)
* objets définis

---

## 12. API interne (fonctions)

### 12.1 data/projectIO

* `loadBoxes(handle) -> Detection[]`
* `loadMetadata(handle) -> Map<pano_id, meta>`
* `loadProject(handle) -> {observations, objects}`
* `saveProject(handle?, state) -> handle`

### 12.2 geo

* `bearingFromBox(xmin,xmax,imageWidth,heading) -> bearing`
* `triangulate(observations) -> {lat,lng,rms,n_obs,stable}`

### 12.3 UI actions

* `openPano(pano_id)`
* `closePano(pano_id)`
* `selectBox(object_id, detection_id)`
* `setActiveObject(object_id)`
* `save()`

---

## 13. Tests

* Tests unitaires :

  * calcul bearing
  * triangulation (cas simples + cas dégénérés)
  * parsing CSV (colonnes alias)

* Tests manuels UX :

  * chargement sources
  * ouverture multi-panos
  * association boxes
  * sauvegarde / reprise

---

## 14. Roadmap d’implémentation (MVP)

1. SourcePicker + chargement CSV
2. Carte panos + clic ouverture pano
3. PanoViewer + overlay boxes
4. Gestion objet actif + sélection box
5. Triangulation temps réel + point objet sur carte
6. CSV projet : création + mise à jour
7. Reprise de session via CSV projet
8. Autosave + status UI

---

## 15. Notes importantes

* Sans backend, l’accès disque dépend du navigateur.
* Chrome/Edge : recommandé.
* La sauvegarde “au fil de l’eau” doit être protégée par debounce et statuts d’erreur.
* Les images doivent rester locales ; l’app ne doit pas tenter de résoudre des panos via réseau.
