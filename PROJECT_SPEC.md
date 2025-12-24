# PROJECT_SPEC.md

> This document is the authoritative functional and technical reference for this project.
> All implementations should conform to the specifications defined below.

---

## 1. Vision du projet

Ce projet vise à développer une **application web locale (frontend-only)** permettant de **géolocaliser précisément des objets fixes** visibles dans des panoramas 360° (Street View ou équivalent), par **association manuelle assistée** et **triangulation en temps réel**.

L’outil est destiné à un **usage expert**, avec une priorité donnée à :

* la précision géométrique
* le contrôle utilisateur
* la traçabilité des décisions
* la reprise de session

Aucune automatisation « boîte noire » n’est recherchée : l’utilisateur reste décisionnaire.

---

## 2. Contraintes fondamentales

* Application **100 % locale**
* **Aucun backend obligatoire**
* Aucune requête d’images vers Google
* Utilisation exclusive de :

  * panos locaux (images équirectangulaires)
  * fichiers CSV fournis par l’utilisateur
* Compatibilité cible : **Chrome / Edge** (File System Access API)

---

## 3. Données manipulées

### 3.1 Données d’entrée

Sélectionnées depuis l’interface utilisateur :

1. **Dossier des panos**

   * Contient les images panoramiques locales
   * Convention : `pano_id.jpg / pano_id.png`

2. **CSV des détections / boxes**

   * Une ligne par box détectée
   * Colonnes minimales attendues :

     * `pano_id`
     * `xmin, ymin, xmax, ymax`
     * `score` (optionnel)

3. **CSV des métadonnées panos**

   * Une ligne par pano
   * Colonnes attendues :

     * `pano_id`
     * `lat, lon`
     * `heading`
     * `imageWidth, imageHeight`

4. **(Optionnel) CSV projet existant**

   * Ancien fichier de sortie
   * Permet de reprendre une session précédente

---

### 3.2 Données de sortie (fichier projet)

Un **CSV projet unique**, mis à jour au fil de l’eau.

#### Format recommandé

Chaque ligne contient un type :

* `OBS` : observation (sélection d’une box)
* `OBJ` : état courant d’un objet géolocalisé

Colonnes :

* `row_type` (`OBS` / `OBJ`)
* `object_id`
* `pano_id`
* `xmin, ymin, xmax, ymax` (OBS)
* `cx` (centre horizontal)
* `bearing_deg`
* `pano_lat, pano_lng`
* `obj_lat, obj_lng` (OBJ)
* `n_obs`
* `rms_m`
* `updated_at`

Règles :

* Plusieurs lignes `OBS` par objet
* Une seule ligne `OBJ` par objet (dernière solution valide)

---

## 4. Écran de configuration (Sources & Projet)

### Objectif

Permettre à l’utilisateur de **configurer entièrement un projet depuis l’UI**, sans modifier le code.

### Éléments UI

* Bouton **Choisir dossier d’images** (Directory Picker)
* Bouton **Choisir CSV boxes**
* Bouton **Choisir CSV métadonnées panos**
* Bouton **Choisir CSV projet existant** (optionnel)

### Comportement

* Vérification immédiate des chemins et colonnes attendues

* Messages d’erreur explicites

* Si un CSV projet est fourni :

  * chargement des observations et objets existants
  * restauration de l’état

* Bouton **Charger le projet**

Les choix peuvent être mémorisés dans un `config.json` local (IndexedDB).

---

## 5. Carte principale

### Fonction

Vue centrale de navigation et de contrôle spatial.

### Contenu

* Points **panos** (positions fixes)
* Points **objets** (positions triangulées)

### Interactions

* Cliquer sur un pano : ouvre le panorama correspondant
* Les objets sont affichés avec une **couleur par object_id**
* Mise à jour en temps réel lors de nouvelles observations

---

## 6. Gestion des panoramas (multi-fenêtres)

### Affichage

* Chaque pano s’ouvre dans une **carte indépendante**
* Nombre de panos ouverts non limité

### Fonctionnalités

* Zoom / pan
* Bouton de fermeture (❌)
* Affichage des métadonnées (pano_id, heading)
* Affichage des boxes détectées

### Interaction principale

* Cliquer sur une box = ajouter une observation pour l’objet actif
* Les boxes sélectionnées changent de couleur selon l’objet actif

---

## 7. Gestion des objets

### Objet actif

* Un seul objet actif à la fois
* Identifié par un `object_id`
* Couleur dédiée (réutilisée partout)

### Changement d’objet

* Bouton **Nouvel objet**
* Sélecteur d’objets existants
* Le changement d’objet n’affecte pas les panos ouverts

---

## 8. Triangulation et calculs

### Principe

Chaque observation fournit :

* un point d’origine (pano)
* une direction (azimut issu de la position horizontale de la box)

### Calcul

* ≥ 2 observations :

  * calcul de la position par intersection de rayons
* ≥ 3 observations :

  * optimisation par moindres carrés

### Qualité

* RMS en mètres
* Utilisé comme indicateur de fiabilité

La position est recalculée **en temps réel** à chaque nouvelle observation.

---

## 9. Liste des objets à traiter

* Liste automatique des objets détectés sans position finale
* Sert de backlog de travail

### Interaction

* Cliquer sur un élément :

  * ouvre le pano correspondant
  * met en évidence la box

---

## 10. Sauvegarde et persistance

### Bouton "Enregistrer"

Comportement :

* Si un **CSV projet est déjà sélectionné** :

  * mise à jour du fichier
  * conservation des données existantes

* Si aucun CSV projet n’est sélectionné :

  * ouverture d’un **Save As…**
  * création d’un nouveau fichier projet

### Autosave (optionnel)

* Sauvegarde automatique après chaque action (avec debounce)

### Feedback

* Statut : `Non enregistré / Enregistré / Erreur`
* Timestamp de dernière sauvegarde

---

## 11. Reprise de session

À l’ouverture d’un projet :

* rechargement des observations
* rechargement des objets validés
* reconstruction de la carte et des listes

---

## 13. Résumé exécutif

> Application web locale experte permettant d’associer manuellement des observations issues de panoramas 360° afin de géolocaliser précisément des objets fixes par triangulation en temps réel, avec une interface multi-panos, une carte interactive et une sauvegarde incrémentale exploitable en SIG.
