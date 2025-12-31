# PROJECT_SPEC.md

Ce document est la référence fonctionnelle et technique **autoritative** du projet. Toute implémentation doit se conformer strictement aux spécifications ci-dessous.

---

## 1. Vision du projet

Développer une application web **100 % locale (frontend-only)** permettant de géolocaliser avec précision des **objets fixes** visibles dans des panoramas 360° (Street View ou équivalent), par **association manuelle assistée** et **triangulation en temps réel**.

**Public cible** : utilisateurs experts.

**Priorités** :

* précision géométrique
* contrôle utilisateur total
* traçabilité des décisions
* reprise fiable de session

⚠️ Aucune automatisation « boîte noire » : l’utilisateur reste **décisionnaire** à chaque étape. Toute aide automatique doit être explicable, paramétrable et réversible.

---

## 2. Contraintes fondamentales

### 2.1 Application 100 % locale

* Aucun backend requis
* Aucune requête d’images vers Google ou services externes
* Utilisation exclusive de données fournies par l’utilisateur

### 2.2 Sources autorisées

* panoramas locaux (images équirectangulaires)
* fichiers CSV fournis par l’utilisateur

### 2.3 Environnement cible

* Navigateurs : **Chrome / Edge**
* API requise : **File System Access API**

---

## 3. Données manipulées

### 3.1 Données d’entrée

Sélectionnées explicitement depuis l’interface utilisateur.

#### 3.1.1 Dossier des panoramas

* Contient les images panoramiques locales
* Format : JPG / PNG équirectangulaire
* Convention de nommage : `pano_id.jpg` ou `pano_id.png`

#### 3.1.2 CSV des détections / boxes

Une ligne par box détectée.

**Colonnes minimales** :

* pano_id
* xmin, ymin, xmax, ymax

**Colonnes optionnelles** :

* score

#### 3.1.3 CSV des métadonnées panoramas

Une ligne par panorama.

**Colonnes attendues** :

* pano_id
* lat, lon
* heading (degrés, nord géographique)
* imageWidth, imageHeight

#### 3.1.4 CSV projet existant (optionnel)

* Ancien fichier de sortie du projet
* Permet la reprise complète d’une session précédente

---

## 3.2 Données de sortie — Fichier projet

Un **CSV unique**, mis à jour **incrémentalement**.

### Structure générale

Chaque ligne est typée via `row_type` :

* `OBS` : observation individuelle
* `OBJ` : état courant d’un objet géolocalisé

### Colonnes communes

* row_type (OBS / OBJ)
* object_id
* updated_at (ISO 8601)

### Colonnes spécifiques OBS

* pano_id
* xmin, ymin, xmax, ymax
* cx (centre horizontal, pixels ou normalisé)
* bearing_deg
* pano_lat, pano_lng

### Colonnes spécifiques OBJ

* obj_lat, obj_lng
* n_obs
* rms_m

### Règles

* Plusieurs lignes OBS par `object_id`
* Une seule ligne OBJ par `object_id` (solution valide la plus récente)
* Aucune observation n’est supprimée ou écrasée

---

## 4. Écran de configuration (Sources & Projet)

### Objectif

Configurer intégralement un projet **depuis l’UI**, sans modification du code.

### Éléments UI

* Bouton **Choisir dossier d’images** (Directory Picker)
* Bouton **Choisir CSV boxes**
* Bouton **Choisir CSV métadonnées panos**
* Bouton **Choisir CSV projet existant** (optionnel)
* Bouton **Charger le projet**

### Comportement

* Vérification immédiate :

  * existence des fichiers
  * colonnes attendues
* Messages d’erreur explicites

Si un CSV projet est fourni :

* chargement des observations
* chargement des objets
* restauration complète de l’état

Optionnel : mémorisation des choix dans un `config.json` local (IndexedDB).

---

## 5. Carte principale

### Fonction

Vue centrale de navigation et de contrôle spatial.

### Contenu

* Points panoramas (positions fixes)
* Points objets (positions triangulées)
* **Rayons / segments de triangulation** affichés depuis les panoramas vers l’objet

### Règles d’affichage

* Couleur stable par `object_id`
* Le bleu est réservé aux panoramas
* Les rayons utilisent la couleur de l’objet correspondant

### Interactions

* Clic sur un panorama : ouverture du panorama correspondant
* Mise à jour en temps réel lors de nouvelles observations

---

## 6. Gestion des panoramas (multi-fenêtres)

### Affichage

* Chaque panorama s’ouvre dans une fenêtre indépendante
* Nombre de panoramas ouverts **non limité**
* Les panoramas occupent **toute la zone basse** disponible
* Répartition automatique :

  * 1 pano → 100 % largeur
  * 2 panos → 50 / 50
  * 3 panos → 33 / 33 / 33

### Fonctionnalités

* Zoom / pan
* Bouton de fermeture (❌)
* Affichage des métadonnées (pano_id, heading)
* Affichage des boxes détectées (SVG overlay)

### Interaction principale

* Clic sur une box = ajout d’une observation pour l’objet actif
* Les boxes changent de couleur selon l’objet actif

---

## 7. Gestion des objets

### Objet actif

* Un seul objet actif à la fois
* Identifié par un `object_id`
* Couleur dédiée et cohérente dans toute l’UI

### Actions

* Bouton **Nouvel objet**
* Sélecteur d’objets existants

Le changement d’objet n’affecte pas les panoramas ouverts.

---

## 8. Triangulation et calculs

### Principe

Chaque observation fournit :

* un point d’origine (position du panorama)
* une direction (azimut issu de la position horizontale de la box)

### Calcul

* ≥ 2 observations :

  * intersection géométrique de rayons
* ≥ 3 observations :

  * optimisation par moindres carrés

### Qualité

* RMS en mètres
* Recalcul **en temps réel** à chaque modification

---

## 9. Auto-association assistée (option avancée)

### Principe général

Aide **non destructive** à l’utilisateur pour regrouper des observations en objets via une stratégie **seed & grow** (proche en proche).

### Paramètres configurables (UI)

* `RMS_MAX`
* `MAX_SHIFT_M`
* `MIN_ANGLE_DIFF`
* `MAX_OBS_PER_OBJECT`

### Stratégie algorithmique (procédurale)

1. **Pré-clustering spatial** :

   * Construction de grappes locales de panoramas proches
   * Priorité aux panoramas ayant ≥ 2 boxes

2. **Seed** :

   * Initialisation avec **2 observations**
   * Calcul d’une première position (RMS = 0 par construction)

3. **Grow (itératif)** :

   * Test d’ajout d’une observation candidate
   * Recalcul de la triangulation

4. **Validation stricte à chaque ajout** :

   * `rms_new ≤ RMS_MAX`
   * `distance(old_pos, new_pos) ≤ MAX_SHIFT_M`
   * pas de doublon de pano
   * contrainte d’angle si activée

5. Si rejet → l’observation n’est pas ajoutée

6. Le processus vise à **maximiser le nombre de panoramas par objet**, sans jamais dégrader la solution existante.

7. En dernier recours :

   * autoriser des objets à 2 observations
   * relâcher progressivement `MIN_ANGLE_DIFF`

⚠️ L’utilisateur peut **accepter, refuser ou ajuster** toute proposition.

---

## 10. Liste des objets à traiter (Backlog)

### Description

Liste automatique des détections non encore associées à un objet valide.

### Interaction

* Clic sur un élément :

  * ouverture du panorama concerné
  * mise en évidence de la box associée

---

## 11. Sauvegarde et persistance

### Actions

* Bouton **Enregistrer**

### Comportement

* Si un CSV projet est déjà sélectionné :

  * mise à jour incrémentale
  * conservation des données existantes
* Sinon :

  * ouverture d’un **Save As…**
  * création d’un nouveau fichier projet

### Autosave (optionnel)

* Sauvegarde après chaque action
* Mécanisme de debounce

### Feedback utilisateur

* Statut : Non enregistré / Enregistré / Erreur
* Timestamp de dernière sauvegarde

---

## 12. Reprise de session

À l’ouverture d’un projet :

* rechargement des observations
* rechargement des objets validés
* reconstruction de la carte
* reconstruction des listes et états UI

---

## 13. Traçabilité et auditabilité

* Chaque observation est conservée sans écrasement
* Les solutions objets sont versionnées implicitement via `updated_at`
* Le CSV projet est directement exploitable dans un SIG

---

## 14. Résumé exécutif

Application web locale experte permettant d’associer manuellement (et assistée de manière contrôlée) des observations issues de panoramas 360° afin de géolocaliser précisément des objets fixes par triangulation en temps réel, avec une interface multi-panoramas, une carte interactive, une stratégie de regroupement explicable et une sauvegarde incrémentale exploitable en SIG.
