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
- Audio: Howler.js (gestion complète du son ambiant et des effets sonores)
- Gestion d'état: Zustand
- Debugging: lil-gui, stats.js
- Timeline: Theatre.js

## Structure du projet

```
/
├── node_modules/     # Dépendances installées
├── static/           # Ressources statiques
│   ├── draco/        # Compression Draco pour les modèles 3D
│   │   ├── envmap/   # Maps d'environnement pour Draco
│   │   ├── gltf/     # Support GLTF pour Draco
│   │   │   ├── draco_decoder.js
│   │   │   ├── draco_decoder.wasm
│   │   │   ├── draco_encoder.js
│   │   │   ├── draco_wasm_wrapper.js
│   │   │   └── README.md
│   ├── data/         # Données pour les positions des objets
│   │   ├── templatePositions.json
│   │   └── treePositions.json
│   ├── models/       # Modèles 3D
│   │   ├── forest/   # Modèles de forêt
│   │   │   ├── bush/ # Modèles de buissons
│   │   │   │   └── Bush.glb
│   │   │   └── tree/ # Modèles d'arbres
│   │   │       ├── ThinTrunk.glb
│   │   │       ├── TreeNaked.glb
│   │   │       ├── TreeStump.glb
│   │   │       └── TrunkLarge.glb
│   │   ├── Map.glb
│   │   ├── MapInstance.glb
│   │   └── MapScene.glb
│   ├── audios/       # Fichiers audio
│   │   ├── ambient.wav
│   │   ├── click.wav
│   │   └── drag.wav
│   └── textures/     # Textures
├── src/              # Code source
│   ├── Assets/       # Gestion des assets
│   │   ├── AssetManager.jsx  # Gestionnaire d'assets
│   │   └── assets.js         # Liste des assets à charger
│   ├── Config/       # Configuration
│   │   ├── TemplateManager.js  # Gestionnaire de templates pour la forêt
│   │   └── guiConfig.js        # Configuration de l'interface de debug
│   ├── Core/         # Composants principaux
│   │   ├── Camera.jsx        # Gestion de la caméra
│   │   ├── Clock.jsx         # Gestion du temps
│   │   ├── Controls.jsx      # Contrôles utilisateur
│   │   ├── Lights.jsx        # Éclairage de la scène
│   │   ├── PostProcessing.jsx # Effets post-processing
│   │   ├── Renderer.jsx      # Rendu Three.js
│   │   ├── Scene.jsx         # Scène principale
│   │   ├── ScrollControls.jsx # Contrôle du défilement et interactions
│   ├── Hooks/        # Hooks React personnalisés
│   │   ├── useAnimationLoop.js  # Animation loop
│   │   ├── useCanvasSize.js     # Gestion taille du canvas
│   │   ├── useDragGesture.js    # Détection de drag sur objets
│   │   ├── useObjectClick.js    # Détection de clic sur objets
│   │   └── useSceneClick.js     # Détection avancée de clic avec événements
│   ├── Store/        # Gestion d'état
│   │   ├── AudioSlice.js      # Tranche pour la gestion du son
│   │   ├── clickListenerSlice.js # Tranche pour la gestion des clics
│   │   └── useStore.js          # Store Zustand central
│   ├── Utils/        # Utilitaires
│   │   ├── AudioManager.jsx   # Gestionnaire audio avec Howler.js
│   │   ├── Debug.jsx          # Interface de débogage
│   │   ├── DebugInitializer.jsx # Initialisation du debug
│   │   ├── defaultValues.js   # Valeurs par défaut
│   │   ├── EventEmitter.jsx   # Gestion des événements
│   │   ├── GlowEffectDebug.jsx  # Contrôles pour l'effet de glow
│   │   ├── Loader.jsx         # Chargement des assets
│   │   ├── Math.jsx           # Fonctions mathématiques
│   │   ├── OutlineEffect.jsx  # Effet de contour lumineux
│   │   ├── RayCaster.jsx      # Détection d'intersections
│   │   └── Stats.jsx          # Statistiques de performance
│   ├── World/        # Éléments du monde
│   │   ├── Character.jsx      # Personnage
│   │   ├── Cube.jsx           # Objet cube
│   │   ├── Forest.jsx         # Forêt
│   │   ├── ForestScene.jsx    # Scène de forêt
│   │   ├── ForestSceneWrapper.jsx # Wrapper pour la scène de forêt
│   │   ├── Map.jsx            # Carte du monde
│   │   ├── MapWithInstances.jsx # Carte avec instances pour la forêt
│   │   ├── Particles.jsx      # Système de particules
│   │   ├── Physics.jsx        # Système physique
│   │   ├── Sky.jsx            # Ciel
│   │   └── Terrain.jsx        # Terrain
│   ├── App.jsx       # Composant racine
│   ├── Experience.jsx # Composant principal de l'expérience
│   ├── index.html    # Fichier HTML principal
│   ├── main.jsx      # Point d'entrée
│   └── style.css     # Styles CSS globaux
├── documentation.md  # Documentation technique
├── package.json      # Dépendances et scripts
├── package-lock.json # Versions verrouillées des dépendances
├── README.md         # Documentation d'introduction
└── vite.config.js    # Configuration de Vite
```

## Principales Features de Développement

### 1. Système de Débogage Interactif

**Fichiers Clés :**

- `src/Utils/DebugInitializer.jsx`: Point d'entrée pour l'initialisation du mode debug
- `src/Store/useStore.js`: Gestion centralisée de l'état de débogage
- `src/Config/guiConfig.js`: Configuration des contrôles du GUI
- Composants spécifiques de debug : `Camera.jsx`, `Lights.jsx`, `Cube.jsx`, `Debug.jsx`

**Interconnexion :**

- `useStore` gère l'état global du debug via un hook Zustand
- `DebugInitializer` crée l'instance GUI basée sur l'état du debug
- Les composants individuels (`Camera`, `Lights`, etc.) utilisent `useStore` pour accéder et mettre à jour les
  configurations de debug
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
7. Les interactions utilisateur déclenchent des événements audio via `AudioManager`
8. Les objets interactifs signalent leur disponibilité via l'effet de glow

## Points Clés de Conception

- **Découplage :** Chaque composant gère ses propres contrôles de debug
- **Flexibilité :** Configuration facilement exportable et importable
- **Performance :** Rendu conditionnel des outils de debug
- **Extensibilité :** Ajout facile de nouveaux contrôles et configurations
- **Modularité :** Gestion audio centralisée via un système de singleton accessible partout
- **Visibilité :** Retour visuel clair sur les objets interactifs grâce à l'effet de glow

| Fonctionnalités Implémentées

| Fonctionnalité                           | Description                                                                            | Statut     | Emplacement                                                                                                                                         |
|------------------------------------------|----------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Système de Marker Interactif             | Gestion dynamique et automatisée des objets interactifs et de leurs interactions       | Implémenté | `src/World/SceneObjectManager.js`, `src/World/EasyModelMarker.jsx`                                                                                  |
| Setup Caméra                             | Configuration initiale de la caméra 3D                                                 | Implémenté | `src/Core/Camera.jsx`                                                                                                                               |
| Setup GUI de Debug                       | Interface de débogage pour le développement                                            | Implémenté | `src/Config/guiConfig.js`, `src/Utils/Debug.js`,`src/Utils/DebugInitializer.js`                                                                     |
| Analyses de Métriques                    | Système de suivi des performances et statistiques                                      | Implémenté | `src/Utils/Stats.js`                                                                                                                                |
| Mouvement de Caméra au Scroll            | Contrôle de la caméra via le défilement                                                | Implémenté | `src/Core/ScrollControls.jsx`                                                                                                                       |
| Détection de Clic sur Objets 3D          | Système pour détecter les interactions de clic sur des objets spécifiques              | Implémenté | `src/Utils/RayCaster.jsx`, `src/Hooks/useObjectClick.js`, `src/Hooks/useSceneClick.js`, `src/Utils/EventEmitter.jsx`                                |
| Détection de Drag sur Objets 3D          | Système avancé pour détecter et gérer les interactions de glissement sur objets 3D     | Implémenté | `src/Hooks/useDragGesture.js`, `src/Utils/RayCaster.jsx`, `src/Hooks/useObjectClick.js`, `src/Hooks/useSceneClick.js`, `src/Utils/EventEmitter.jsx` |
| Système Audio                            | Gestion complète des sons ambiant et ponctuels, avec effets de fondu                   | Implémenté | `src/Utils/AudioManager.jsx`, `src/Store/audioSlice.js`, `src/Utils/DebugInitializer.jsx`, `src/World/Cube.jsx`                                     |
| Effet de Glow                            | Système de contour lumineux autour des objets interactifs                              | Implémenté | `src/Utils/OutlineEffect.jsx`, `src/Utils/GlowEffectDebug.jsx`, `src/Config/guiConfig.js`, `src/World/Cube.jsx`                                     |
| Chargement et Optimisation de Modèles 3D | Système de chargement et d'optimisation des modèles 3D pour maximiser les performances | Implémenté | `src/Assets/AssetManager.jsx`, `src/World/Forest.jsx`, `src/Assets/assets.js`, `src/World/ForestSceneWrapper.jsx`                                   |
| Système d'Instanciation de Forêt         | Architecture modulaire pour le rendu efficient des éléments forestiers                 | Implémenté | `src/Assets/AssetManager.jsx`, `src/Config/TemplateManager.js`, `src/World/Forest.jsx`                                                              |

## Fonctionnement des features de documentation

La documentation (`documentation.md`) décrit quatre fonctionnalités principales:

### 1. Setup Caméra

* Implémenté dans `Camera.jsx`
* Utilise `useThree()` pour accéder à la caméra Three.js
* Applique les valeurs par défaut de `guiConfig.js`
* En mode debug, ajoute des contrôles pour position, rotation, FOV, etc.
* Les valeurs sont persistées dans le store et peuvent être restaurées

### 2. Setup GUI de Debug

* Implémenté dans `DebugInitializer.jsx` avec `guiConfig.js`
* L'interface est construite avec lil-gui
* Activé par le hash URL `#debug`
* Permet d'exporter/importer des configurations complètes
* Organise les contrôles par catégories (caméra, lumières, objets, etc.)

### 3. Analyses de Métriques

* Implémenté dans `Stats.jsx`
* Utilise `stats.js` pour afficher les FPS, temps de rendu, etc.
* Ajoute des informations spécifiques à WebGL (triangles, appels de rendu, etc.)
* Affiché uniquement quand `debug.showStats` est actif
* Les métriques sont mises à jour à chaque frame

### 4. Mouvement de Caméra au Scroll

* Implémenté dans `ScrollControls.jsx`
* Utilise Theatre.js pour définir une séquence d'animation
* Capture les événements de défilement et les normalise pour tous les périphériques
* Fait progresser la timeline en fonction du défilement avec effet d'inertie
* Permet des points d'arrêt interactifs à des positions prédéfinies
* Affiche une barre de progression pour visualiser la position dans la séquence

### 5. Détection de Clic sur Objets 3D

* Implémenté via plusieurs composants interconnectés dans une architecture modulaire
* Le composant `RayCaster.jsx` agit comme provider central qui gère le lancement de rayons et la détection
  d'intersections
* Deux hooks personnalisés sont disponibles pour l'implémentation :
    * `useObjectClick` - Hook simple pour détecter les clics sur un objet spécifique
    * `useSceneClick` - Hook plus avancé avec capacité d'émettre des événements
* L'état d'écoute est géré de façon centralisée via `clickListenerSlice` dans le store Zustand
* Permet de facilement :
    * Activer/désactiver l'écoute globalement via `clickListener.startListening()` et `clickListener.stopListening()`
    * Associer des callbacks à des objets spécifiques via `useObjectClick({ objectRef, onClick })`
    * Récupérer des informations précises sur l'intersection (point d'impact, distance, coordonnées UV)
* S'intègre avec le système de points d'arrêt interactifs dans `ScrollControls.jsx` pour permettre des interactions
  utilisateur aux moments clés de l'expérience

### 6. Système de Drag Gestures Personnalisés

* Implémenté dans `useDragGesture.js`
* Hook personnalisé pour gérer les interactions de glissement (drag) sur des objets 3D
* Fonctionnalités avancées de détection de gestes :
    * Configuration flexible de la direction du drag (horizontal, vertical, directionnel)
    * Détection précise basée sur la distance minimale et l'orientation
    * Support des interactions sur écrans tactiles et souris
    * Gestion complète du cycle de vie du drag :
        * `onDragStart` : Déclenché au début du glissement
        * `onDragEnd` : Appelé à la fin du mouvement, réussi ou annulé
        * `onDragSuccess` : Spécifiquement pour les drags qui respectent les critères
* Paramètres configurables :
    * `minDistance` : Distance minimale pour déclencher un drag
    * `direction` : Restriction de l'orientation du glissement
    * `debug` : Mode de débogage avec logs détaillés
* Intégration avec le système de raycasting pour s'assurer que le drag commence sur l'objet ciblé
* Utilisé dans `Cube.jsx` pour créer des interactions interactives dans l'expérience
* Permet de créer des interactions utilisateur complexes et personnalisées dans un environnement 3D

### 7. Système Audio Intégré

* Implémenté dans `AudioManager.jsx` avec Howler.js
* Architecture singleton pour une gestion audio centralisée
* Fonctionnalités complètes :
    * **Son d'ambiance** : lecture en boucle, pause, reprise
    * **Effets de fondu** : transitions douces lors des pauses/reprises (fade in/out)
    * **Sons ponctuels** : sons déclenchés par des interactions spécifiques
    * **Contrôle du volume** : réglage global via l'interface de debug
* Intégration avec le système d'interaction :
    * Déclenchement de sons lors des clics sur le cube
    * Déclenchement de sons lors des drags réussis
* Interface de debug dédiée :
    * Boutons pour jouer, mettre en pause et reprendre le son d'ambiance
    * Slider pour ajuster le volume global
* Capacité à jouer des sons ponctuels sans interrompre le son d'ambiance
* Architecture extensible permettant d'ajouter facilement de nouveaux sons

### 8. Système d'Effet de Contour Lumineux (Glow)

* Implémenté dans `OutlineEffect.jsx` et `GlowEffectDebug.jsx`
* Système visuel pour mettre en évidence les objets interactifs de l'expérience
* Approche technique avancée :
    * Crée des meshes de contour autour des objets ciblés
    * Utilise des matériaux additifs pour un effet lumineux éclatant
    * Gestion de la hiérarchie complète des objets avec enfants
    * Animation de pulsation dynamique pour attirer l'attention
* Paramètres entièrement personnalisables via l'interface de debug :
    * **Activation** : activer/désactiver l'effet
    * **Couleur** : personnalisation de la teinte du glow
    * **Épaisseur** : ajustement de la taille du contour (0.01-0.1)
    * **Intensité** : contrôle de la luminosité (1-10)
    * **Vitesse de pulsation** : animation dynamique (0-5)
* Fonctionnalités spéciales :
    * Bouton de test pour visualiser l'effet pendant 2 secondes
    * Activation conditionnelle basée sur l'état d'interaction
    * Intégration complète avec le système d'interaction existant
* API avancée via forwardRef pour contrôle programmatique :
    * Accès au groupe de contour
    * Méthodes pour modifier la visibilité et les propriétés à la volée
    * Possibilité d'obtenir l'état actuel des paramètres
* Optimisation des performances :
    * Nettoyage des ressources lors du démontage
    * Gestion correcte des ressources Three.js (geometries, materials)
    * Animation conditionnelle uniquement lorsque l'effet est visible

### 9. Chargement et Optimisation de Modèles 3D

* Implémenté via une architecture en couches avec plusieurs composants spécialisés :
    * `AssetManager.jsx` : Gestionnaire central responsable du chargement et de l'optimisation des modèles
    * `assets.js` : Définition déclarative des assets à charger avec leurs métadonnées
    * `ForestSceneWrapper.jsx` : Composant enveloppant qui gère la transition entre le chargement et l'affichage
    * `Forest.jsx` : Composant d'affichage optimisé qui implémente les techniques de rendu efficaces
* Fonctionnalités d'optimisation avancées :
    * **Partage de matériaux** : Système de cache qui permet la réutilisation de matériaux similaires
    * **Occlusion Culling** : Technique qui évite de rendre les objets non visibles par la caméra
    * **Frustum Culling** : Ne traite que les objets dans le champ de vision de la caméra
    * **Level of Detail (LOD)** : Ajuste la complexité des modèles en fonction de leur distance
    * **Material Batching** : Regroupe les objets avec des matériaux similaires pour réduire les drawcalls
* Stratégies d'optimisation des performances :
    * Calcul et mise en cache des boundingSpheres pour accélérer le culling
    * Suppression d'attributs non essentiels pour les objets éloignés
    * Application automatique de niveaux de détails basée sur la distance à la caméra
    * Système de vérification robuste pour garantir le chargement complet des modèles
* Mesures de sécurité :
    * Traitement des erreurs lors du chargement et de l'optimisation
    * Fallbacks pour les assets manquants ou corrompus
    * Nettoyage méthodique des ressources WebGL lors du démontage des composants
* Résultats mesurables :
    * Réduction significative du nombre de drawcalls (de plusieurs dizaines à moins de 10)
    * Optimisation du nombre de triangles rendus
    * Amélioration des performances globales, particulièrement sur les appareils mobiles
    * Interface utilisateur fluide même avec des scènes complexes

### 10. Système d'Instanciation de Forêt

* Architecture modulaire pour le chargement efficace et le rendu performant d'éléments forestiers :
    * `src/Assets/AssetManager.jsx` : Gestionnaire central de chargement avec optimisation de matériaux et DRACO
    * `src/Config/TemplateManager.js` : Registre des templates avec mapping ID-modèle (ex: 753 → 'Retopo_TRONC001')
    * `src/World/MapWithInstances.jsx` : Analyse les nœuds GN_Instance_X pour extraire positions et transformations
    * `src/World/Forest.jsx` : Génère les InstancedMesh pour un rendu efficient des arbres et buissons
    * `src/World/ForestSceneWrapper.jsx` : Vérifie la disponibilité des assets avec mécanisme de repli

* Optimisations techniques implémentées :
    * **Partage intelligent de matériaux** : Cache basé sur type et couleur pour réduire les draw calls
    * **Analyse géométrique** : Système d'empreinte détaillant vertices, faces et ratios pour identifier les templates
    * **Chargement multi-source** : Tente multiples chemins pour les positions JSON avec fallback vers store
    * **Nettoyage méthodique** : Dispose correcte des géométries et matériaux pour éviter fuites mémoire

* Communication par événements :
    * 'map-ready' → 'tree-positions-ready' → 'forest-ready' → 'forest-scene-ready'
    * Utilisation de l'EventBus pour découpler les composants et synchroniser le chargement

* Configuration des templates existants :
    * TreeNaked, TrunkLarge, TrunkThin, TreeStump et Bush actuellement supportés
    * Extension facile via le système de templates avec définition de priorité de chargement

### 11. Système de Marker Interactif Avancé

Le système de Marker est une couche d'abstraction sophistiquée qui gère les interactions et la visibilité des objets
dans la scène 3D. Il offre une approche modulaire et hautement configurable pour la gestion des objets interactifs.

#### Caractéristiques Principales

* **Attribution Automatique des Étapes**
    - Génération dynamique des étapes d'interaction basée sur l'ordre des objets dans le catalogue
    - Système flexible permettant de définir des séquences d'interaction prédéfinies
    - Capacité à gérer des objets interactifs et statiques dans un même flux

* **Génération Intelligente des Identifiants**
    - Création automatique de `markerId` basée sur l'étape d'interaction
    - Génération de textes descriptifs associés aux markers
    - Dictionnaire centralisé de textes pour chaque étape (`stepTexts`)

* **Gestion Dynamique des Interactions**
    - Support pour les objets avec interaction obligatoire et optionnelle
    - Contrôle fin de la visibilité des contours (outlines) basé sur l'étape courante
    - Possibilité de définir des callbacks personnalisés pour chaque interaction

* **Configuration Centralisée**
    - Tous les placements d'objets (interactifs et statiques) gérés depuis un point unique
    - Mécanisme de réinitialisation aux valeurs par défaut
    - Support pour les modifications dynamiques des placements

#### Mécanisme de Fonctionnement

```javascript
// Exemple de configuration automatique
sceneObjectManager.addPlacement('TreeInteractive', [2, 0, -5], {
    // Le requiredStep sera automatiquement assigné
    markerId: "firstStop-marker",  // Généré automatiquement
    markerText: "Premier point d'intérêt",  // Généré depuis stepTexts
    onInteract: (event) => {
        // Logique d'interaction personnalisée
    }
});
```