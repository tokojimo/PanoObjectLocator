PROJECT_SPEC.md

Ce document est la référence fonctionnelle et technique autoritative du projet. Toute implémentation doit se conformer strictement aux spécifications ci-dessous.

1. Vision du projet

Développer une application web 100 % locale (frontend-only) permettant de géolocaliser avec précision des objets fixes visibles dans des panoramas 360° (Street View ou équivalent), par association manuelle assistée et triangulation en temps réel.

Public cible : utilisateurs experts.

Priorités :

précision géométrique

contrôle utilisateur total

traçabilité des décisions

reprise fiable de session

Aucune automatisation « boîte noire » : l’utilisateur reste décisionnaire à chaque étape.

2. Contraintes fondamentales

Application 100 % locale

Aucun backend requis

Aucune requête d’images vers Google ou services externes

Utilisation exclusive de données fournies par l’utilisateur :

panoramas locaux (images équirectangulaires)

fichiers CSV

Compatibilité cible : Chrome / Edge

utilisation de la File System Access API

3. Données manipulées
3.1 Données d’entrée

Sélectionnées depuis l’interface utilisateur.

3.1.1 Dossier des panoramas

Contient les images panoramiques locales

Format : JPG / PNG équirectangulaire

Convention de nommage : pano_id.jpg ou pano_id.png

3.1.2 CSV des détections / boxes

Une ligne par box détectée

Colonnes minimales attendues :

pano_id

xmin, ymin, xmax, ymax

Colonnes optionnelles :

score

3.1.3 CSV des métadonnées panoramas

Une ligne par panorama

Colonnes attendues :

pano_id

lat, lon

heading (degrés, nord géographique)

imageWidth, imageHeight

3.1.4 CSV projet existant (optionnel)

Ancien fichier de sortie du projet

Permet la reprise complète d’une session précédente

3.2 Données de sortie — Fichier projet

Un CSV unique, mis à jour incrémentalement.

Structure générale

Chaque ligne est typée via row_type :

OBS : observation individuelle

OBJ : état courant d’un objet géolocalisé

Colonnes

Communes :

row_type (OBS / OBJ)

object_id

updated_at (ISO 8601)

Spécifiques OBS :

pano_id

xmin, ymin, xmax, ymax

cx (centre horizontal normalisé ou en pixels)

bearing_deg

pano_lat, pano_lng

Spécifiques OBJ :

obj_lat, obj_lng

n_obs

rms_m

Règles

Plusieurs lignes OBS par object_id

Une seule ligne OBJ par object_id (solution valide la plus récente)

4. Écran de configuration (Sources & Projet)
Objectif

Permettre la configuration complète d’un projet depuis l’UI, sans modification du code.

Éléments UI

Bouton Choisir dossier d’images (Directory Picker)

Bouton Choisir CSV boxes

Bouton Choisir CSV métadonnées panos

Bouton Choisir CSV projet existant (optionnel)

Comportement

Vérification immédiate :

existence des fichiers

colonnes attendues

Messages d’erreur explicites

Si un CSV projet est fourni :

chargement des observations

chargement des objets

restauration complète de l’état

Bouton Charger le projet

Mémorisation optionnelle des choix dans un config.json local (IndexedDB)

5. Carte principale
Fonction

Vue centrale de navigation et de contrôle spatial.

Contenu

Points panoramas (positions fixes)

Points objets (positions triangulées)

Interactions

Clic sur un panorama : ouverture du panorama correspondant

Objets affichés avec une couleur stable par object_id

Mise à jour en temps réel lors de nouvelles observations

6. Gestion des panoramas (multi-fenêtres)
Affichage

Chaque panorama s’ouvre dans une fenêtre indépendante

Nombre de panoramas ouverts non limité

Fonctionnalités

Zoom / pan

Bouton de fermeture (❌)

Affichage des métadonnées (pano_id, heading)

Affichage des boxes détectées

Interaction principale

Clic sur une box = ajout d’une observation pour l’objet actif

Les boxes sélectionnées changent de couleur selon l’objet actif

7. Gestion des objets
Objet actif

Un seul objet actif à la fois

Identifié par un object_id

Couleur dédiée et cohérente dans toute l’UI

Changement d’objet

Bouton Nouvel objet

Sélecteur d’objets existants

Le changement d’objet n’affecte pas les panoramas ouverts

8. Triangulation et calculs
Principe

Chaque observation fournit :

un point d’origine (position du panorama)

une direction (azimut issu de la position horizontale de la box)

Calcul

≥ 2 observations :

intersection géométrique de rayons

≥ 3 observations :

optimisation par moindres carrés

Qualité

RMS en mètres

Utilisé comme indicateur de fiabilité

Recalcul en temps réel à chaque nouvelle observation

9. Liste des objets à traiter (Backlog)
Description

Liste automatique des objets détectés sans position finale validée.

Interaction

Clic sur un élément :

ouverture du panorama concerné

mise en évidence de la box associée

10. Sauvegarde et persistance
Actions

Bouton Enregistrer

Comportement

Si un CSV projet est déjà sélectionné :

mise à jour incrémentale du fichier

conservation des données existantes

Sinon :

ouverture d’un Save As…

création d’un nouveau fichier projet

Autosave (optionnel)

Sauvegarde automatique après chaque action

Mécanisme de debounce

Feedback utilisateur

Statut : Non enregistré / Enregistré / Erreur

Timestamp de dernière sauvegarde

11. Reprise de session

À l’ouverture d’un projet :

rechargement des observations

rechargement des objets validés

reconstruction de la carte

reconstruction des listes et états UI

12. Traçabilité et auditabilité

Chaque observation est conservée sans écrasement

Les solutions objets sont versionnées implicitement via updated_at

Le CSV projet est exploitable directement dans un SIG

13. Résumé exécutif

Application web locale experte permettant d’associer manuellement des observations issues de panoramas 360° afin de géolocaliser précisément des objets fixes par triangulation en temps réel, avec une interface multi-panoramas, une carte interactive et une sauvegarde incrémentale exploitable en SIG.
