# Documentation Technique

## Vue d'ensemble du projet

Ce projet est une expérience interactive utilisant Three.js et React pour sensibiliser aux impacts environnementaux de
l'IA et des datacenters. L'utilisateur suit une mission narrative où il doit photographier un vison d'Europe (Mustela
lutreola), une espèce en voie d'extinction, tout en découvrant progressivement l'impact environnemental des
technologies.

## Stack technique

- Framework: React
- Rendu 3D: Three.js (@react-three/fiber, @react-three/drei)
- Animation: GSAP, Blender (animations importées)
- Audio: Howler.js
- Gestion d'état: Zustand
- Debugging: lil-gui, stats.js
- Timeline: Theatre.js

## Structure du projet

```
/
├── node_modules/     # Dépendances installées
├── static/           # Ressources statiques
│   ├── draco/        # Compression Draco pour les modèles 3D
│   │   └── gltf/     # Support GLTF pour Draco
│   ├── models/       # Modèles 3D
│   │   └── Fox/      # Modèle du renard
│   └── textures/     # Textures
│       ├── dirt/     # Textures de sol
│       └── environmentMap/ # Maps d'environnement
├── src/              # Code source
│   ├── Assets/       # Gestion des assets
│   │   ├── AssetManager.jsx # Gestionnaire d'assets
│   │   └── assets.js # Liste des assets à charger
│   ├── Core/         # Composants principaux
│   │   ├── Camera.jsx        # Gestion de la caméra
│   │   ├── Clock.jsx         # Gestion du temps
│   │   ├── Controls.jsx      # Contrôles utilisateur
│   │   ├── Lights.jsx        # Éclairage de la scène
│   │   ├── PostProcessing.jsx # Effets post-processing
│   │   ├── Renderer.jsx      # Rendu Three.js
│   │   └── Scene.jsx         # Scène principale
│   ├── Hooks/        # Hooks React personnalisés
│   │   ├── useAnimationLoop.js  # Animation loop
│   │   └── useCanvasSize.js     # Gestion taille du canvas
│   ├── Store/        # Gestion d'état
│   │   └── useStore.js       # Store Zustand
│   ├── Utils/        # Utilitaires
│   │   ├── Debug.js          # Outils de débogage
│   │   ├── EventEmitter.js   # Gestion des événements
│   │   ├── Loader.js         # Chargement des assets
│   │   ├── Math.js           # Fonctions mathématiques
│   │   ├── RayCaster.js      # Détection d'intersections
│   │   └── Stats.js          # Statistiques de performance
│   ├── World/        # Éléments du monde
│   │   ├── Character.jsx     # Personnage
│   │   ├── Cube.jsx          # Objet cube
│   │   ├── Particles.jsx     # Système de particules
│   │   ├── Physics.jsx       # Système physique
│   │   ├── Sky.jsx           # Ciel
│   │   └── Terrain.jsx       # Terrain
│   ├── App.jsx       # Composant racine
│   ├── Experience.jsx # Composant principal de l'expérience
│   ├── index.html    # Fichier HTML principal
│   ├── main.jsx      # Point d'entrée
│   └── style.css     # Styles CSS globaux
├── .gitignore        # Configuration Git
├── documentation.md  # Documentation technique
├── package.json      # Dépendances et scripts
├── package-lock.json # Versions verrouillées des dépendances
└── README.md         # Documentation d'introduction
```

## Fonctionnalités implémentées

*Note: Cette section sera mise à jour au fur et à mesure que les fonctionnalités seront développées.*

| Fonctionnalité | Description | Statut | Emplacement |
|----------------|-------------|--------|-------------|
|                |             |        |             |
|                |             |        |             |
|                |             |        |             |
|                |             |        |             |
|                |             |        |             |
|                |             |        |             |
|                |             |        |             |
|                |             |        |             |



