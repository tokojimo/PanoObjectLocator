# PanoTriangulator (frontend MVP)

Application React + Vite en TypeScript pour charger des panos locaux, inspecter les boxes et préparer la triangulation sans backend.

## Prérequis
- Node 20+
- Navigateur Chrome / Edge (File System Access API activée)

## Installation
```bash
npm install
npm run dev
```

## Flux rapide
1. Ouvrir l'app (`npm run dev`).
2. Dans **Sources & Projet**, choisir : dossier d'images, CSV boxes, CSV métadonnées panos (alias supportés : lat/latitude, lon/lng, image_width…), puis (optionnel) un CSV projet existant.
3. Cliquer sur **Charger le projet** pour remplir la carte Leaflet et ouvrir des panos.
4. Cliquer sur un point pano sur la carte pour ouvrir l'image ; les boxes rouges sont dessinées directement au-dessus de l'image.
5. Sélectionner une box (ou laisser l'app créer un nouvel objet automatiquement) sur deux panos pour voir la position triangulée apparaître sur la carte.
6. Cliquer sur **Enregistrer** pour exporter un CSV projet unique (OBS + OBJ) via la File System Access API.

## Schémas CSV attendus
- **Boxes** : colonnes `pano_id,xmin,ymin,xmax,ymax[,score]`
- **Métadonnées panos** : `pano_id,lat,lon,heading,imageWidth,imageHeight`
- **Projet (OBS/OBJ)** : `row_type,object_id,pano_id,xmin,ymin,xmax,ymax,cx,bearing_deg,pano_lat,pano_lng,obj_lat,obj_lng,n_obs,rms_m,updated_at`

Les colonnes sont validées dès le chargement et affichent une erreur si manquantes.

## Dépannage
- Assurez-vous d'utiliser Chrome/Edge avec la File System Access API. Sur d'autres navigateurs, l'ouverture/sauvegarde peut échouer.
- Les images sont résolues dans le dossier fourni avec les extensions `.jpg/.jpeg/.png` (insensible à la casse).
- Si une box est déjà associée à un autre objet, l'app demande confirmation avant réassignation.
