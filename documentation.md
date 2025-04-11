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

## Principales Features de Développement

### 1. Système de Débogage Interactif

**Fichiers Clés :**
- `src/Utils/DebugInitializer.jsx`: Point d'entrée pour l'initialisation du mode debug
- `src/Store/useStore.js`: Gestion centralisée de l'état de débogage
- `src/Config/guiConfig.js`: Configuration des contrôles de debug
- Composants spécifiques de debug : `Camera.jsx`, `Lights.jsx`, `Cube.jsx`, `Debug.jsx`

**Interconnexion :**
- `useStore` gère l'état global du debug via un hook Zustand
- `DebugInitializer` crée l'instance GUI basée sur l'état du debug
- Les composants individuels (`Camera`, `Lights`, etc.) utilisent `useStore` pour accéder et mettre à jour les configurations de debug
- Le mode debug s'active via le hash URL (`#debug`)

### 2. Configuration Dynamique et Persistance

**Fichiers Clés :**
- `src/Utils/defaultValues.js`: Utilitaires pour extraire et appliquer des valeurs par défaut
- `src/Store/useStore.js`: Méthodes pour sauvegarder et charger des configurations
- `src/Utils/DebugInitializer.jsx`: Fonctionnalités d'export/import de configuration

**Interconnexion :**
- `defaultValues.js` fournit des méthodes pour initialiser des objets avec des configurations par défaut
- `useStore` permet de stocker et récupérer des configurations dynamiques
- `DebugInitializer` offre des fonctions pour exporter et importer des configurations complètes

### 3. Système de Statistiques et Métriques de Performance

**Fichiers Clés :**
- `src/Utils/Stats.jsx`: Composant de rendu des statistiques de performance
- `src/Store/useStore.js`: Gestion de l'état d'affichage des stats
- `experience.jsx`: Intégration conditionnelle des stats de debug

**Interconnexion :**
- `useStore` contrôle l'affichage des statistiques via le mode debug
- `Stats.jsx` récupère les informations de rendu via `useThree()`
- Le composant `Experience` rend conditionnellement les stats basé sur l'état de debug

## Flux de Données et Interactions

1. L'utilisateur active le mode debug via le hash URL
2. `useStore` met à jour l'état global de debug
3. `DebugInitializer` crée l'interface GUI
4. Les composants individuels (`Camera`, `Lights`, `Cube`) s'abonnent à cet état
5. Chaque composant peut modifier et persister ses propres configurations
6. Les valeurs par défaut sont toujours disponibles via `defaultValues.js`

## Points Clés de Conception

- **Découplage :** Chaque composant gère ses propres contrôles de debug
- **Flexibilité :** Configuration facilement exportable et importable
- **Performance :** Rendu conditionnel des outils de debug
- **Extensibilité :** Ajout facile de nouveaux contrôles et configurations

## Fonctionnalités Implémentées

| Fonctionnalité        | Description                                       | Statut     | Emplacement                                                                     |
|-----------------------|---------------------------------------------------|------------|---------------------------------------------------------------------------------|
| Setup Caméra          | Configuration initiale de la caméra 3D            | Implémenté | `src/Core/Camera.jsx`                                                           |
| Setup GUI de Debug    | Interface de débogage pour le développement       | Implémenté | `src/Config/guiConfig.js`, `src/Utils/Debug.js`,`src/Utils/DebugInitializer.js` |
| Analyses de Métriques | Système de suivi des performances et statistiques | Implémenté | `src/Utils/Stats.js`                                                            |

