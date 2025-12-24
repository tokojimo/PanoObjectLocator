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
2. Dans **Sources & Projet**, choisir : dossier d'images, CSV boxes, CSV métadonnées panos, puis (optionnel) un CSV projet existant.
3. Cliquer sur **Charger le projet** pour remplir la carte Leaflet et ouvrir des panos.

## Schémas CSV attendus
- **Boxes** : colonnes `pano_id,xmin,ymin,xmax,ymax[,score]`
- **Métadonnées panos** : `pano_id,lat,lon,heading,imageWidth,imageHeight`
- **Projet (OBS/OBJ)** : `row_type,object_id,pano_id,xmin,ymin,xmax,ymax,cx,bearing_deg,pano_lat,pano_lng,obj_lat,obj_lng,n_obs,rms_m,updated_at`

Les colonnes sont validées dès le chargement et affichent une erreur si manquantes.
