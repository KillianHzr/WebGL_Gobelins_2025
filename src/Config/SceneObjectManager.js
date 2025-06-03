// SceneObjectManager.js
// Système centralisé pour la gestion des objets individuels dans la scène
// Gère à la fois les objets interactifs et les objets statiques avec leur placement par défaut

import {INTERACTION_TYPES} from '../Utils/EnhancedObjectMarker';
import {EventBus, MARKER_EVENTS} from '../Utils/EventEmitter';
import {textureManager} from './TextureManager';
import {Vector2} from "three";

class SceneObjectManager {
    constructor() {
        /**
         * PARCOURS INTERACTIF - DÉCOUVERTE ENVIRONNEMENTALE
         * =================================================
         * Ce gestionnaire organise une expérience narrative centrée sur la découverte
         * d'un vison affecté par la pollution et la pénurie d'eau. L'utilisateur progresse
         * à travers différentes scènes interactives qui racontent une histoire environnementale.
         */

        // Définition des étapes dans l'ordre de progression du parcours
        this.interactionSteps = ['firstStop', 'secondStop', 'thirdStop', 'fourthStop', 'fifthStop', 'sixthStop'
            // Ajoutez d'autres étapes si nécessaire
        ];

        // Textes standard pour les différentes étapes d'interaction
        this.stepTexts = {
            'firstStop': "Premier point d'intérêt",
            'secondStop': "Deuxième point d'intérêt",
            'thirdStop': "Troisième point d'intérêt",
            'fourthStop': "Quatrième point d'intérêt",
            'fifthStop': "Cinquième point d'intérêt",
            'sixthStop': "Sixième point d'intérêt",
            'specialStop': "Point spécial", // Ajoutez d'autres textes par défaut ici
        };

        // Compteur pour suivre l'ordre des objets interactifs
        this.interactiveObjectsCount = 0;

        // Catalogue des modèles disponibles pour les objets individuels
        // avec leur configuration et placement par défaut
        this.objectCatalog = {

            // // 'DataCenter': {
            // //     id: 'DataCenter', path: '/models/digital/DataCenter.glb',
            // //     interactive: false, useTextures: true, defaultPlacements: [{
            // //         // position: [66.95818, -0.50182, -123.19365],
            // //         position: [-35.943, 0.0, 44.149],
            // //         rotation: [-3.14159, -54.12542, -3.14159],
            // //         // scale: [1.79768, 1.79768, 1.79768],
            // //         scale: [0.59768, 0.59768, 0.59768],
            // //     }]
            // // },
            // // 'TVScreen': {
            // //     id: 'ScreenOldEmission', path: '/models/digital/screen/ScreenOldEmission.glb', // scale: [0.108, 0.07866, 0.108],
            // //     interactive: false, useTextures: true, defaultPlacements: [{
            // //         // position: [-39.93887, 0.3095, 84.51408],
            // //         position: [-33.943, 0.51133, 45.149],
            // //
            // //         rotation: [0, 0, 0],
            // //         scale: [0.1, 0.1, 0.1],
            // //     }]
            // // },
            // // 'ModernScreen': {
            // //     id: 'Screen',
            // //     path: '/models/digital/screen/screentest.glb',
            // //     interactive: false, useTextures: true, defaultPlacements: [{
            // //         // position: [-39.47393, 0.728, 83.68371],
            // //         position: [-34.943, 0.51133, 45.149],
            // //         rotation: [0,  -3.14 / 2, 0],
            // //         scale: [0.1, 0.1, 0.1],
            // //     }]
            // // },
            // // 'ModernScreenEmission': {
            // //     id: 'ScreenEmission',
            // //     path: '/models/digital/screen/ScreenEmission.glb',
            // //     interactive: false, useTextures: true, defaultPlacements: [{
            // //         // position: [-39.47393, 0.728, 83.68371],
            // //         position: [-34.943, 0.51133, 45.149],
            // //         rotation: [0,  -3.14 / 2, 0],
            // //         scale: [0.1, 0.1, 0.1],
            // //     }]
            // // },
            // // 'Server': {
            // //     id: 'Server',
            // //     path: '/models/digital/Server.glb',
            // //
            // //     interactive: false, useTextures: true, defaultPlacements: [{
            // //         // position: [-39.47393, 0.728, 83.68371],
            // //         position: [-32.943, 0.51133, 45.149],
            // //         rotation: [0, 0, 0],
            // //         scale: [0.5, 0.5, 0.5],
            // //     }]
            // // },
            //
            //
            /**
             * SCÈNE 01 - POINT DE DÉPART
             * Introduction narrative avec Célia (narratrice)
             * Déclencheur: Fin de la cinématique d'introduction
             * Type: Événement automatique basé sur la timeline
             */
            'Ground': {
                id: 'Ground',
                path: '/models/Ground.glb',
                scale: [1, 1, 1],
                interactive: false,
                useTextures: true,
                defaultPlacements: [{position: [0, 0, 0], rotation: [0, 0, 0]},]
            }, 'Camera': {
                id: 'Camera',
                path: '/models/Camera.glb',
                scale: [1, 1, 1],
                interactive: false,
                useTextures: false,
                defaultPlacements: [{position: [0, 0, 0], rotation: [0, 0, 0]},]
            },

            /**
             * SCÈNE 02 - PANNEAU D'INFORMATION
             * Premier point interactif avec informations contextuelles
             * Déclencheur: CLICK sur le panneau "Lis le panneau"
             * Effet: Rotation et zoom vers le panneau, narration par Célia
             * Sortie: CLICK MAINTENU "Quitte le panneau" pour dézoomer
             */
            'DirectionPanelStartInteractive': {
                id: 'DirectionPanel',
                path: '/models/primary/DirectionPanel.glb',
                scale: [0.60463, 0.60463, 0.60463],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.LONG_PRESS,
                    text: "Maintiens",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "image",
                    chapterDistance: 1.5,
                    requiredStep: 'initialStartStop',
                    // Ajouter cette fonction callback pour jouer la narration et afficher l'interface image
                    onInteract: () => {
                        console.log("Long press sur le panneau d'information - lancement narration et interface image");
                        // Jouer la narration
                        if (window.narrationManager && typeof window.narrationManager.playNarration === 'function') {
                            window.narrationManager.playNarration('Scene02_PanneauInformation');
                        }

                        // Afficher l'interface image
                        const store = UseStore.getState();
                        if (store.interaction && typeof store.interaction.setShowImageInterface === 'function') {
                            store.interaction.setShowImageInterface(true, '/images/Panneau_Info.png');
                        }
                    }
                }],
                defaultPlacement: {
                    position: [-6.71148, -0.08855, 11.35006],
                    rotation: [0, -30.9, 0],
                    scale: [0.60463, 0.60463, 0.60463],
                    outlinePulse: false,
                }
            },

            'DirectionPanelBoard': {
                id: 'DirectionPanelBoard',
                path: '/models/primary/DirectionPanelBoard.glb',
                scale: [0.60463, 0.60463, 0.60463],
                interactive: false,
                useTextures: false,
                defaultPlacements: [{
                    position: [-6.71148, -0.08855, 11.35006],
                    rotation: [0, -30.9, 0],
                    scale: [0.60463, 0.60463, 0.60463],
                }]
            },
            /**
             * SCÈNE 03 - OBSTACLE DU TRONC D'ARBRE
             * Apprentissage du mouvement vertical
             * Déclencheur: DRAG DE BAS EN HAUT "Saute au-dessus"
             * Effet: Animation de saut par-dessus l'obstacle
             */
            'TrunkLargeInteractive': {
                id: 'TrunkLargeInteractive',
                path: '/models/forest/tree/TrunkLarge.gltf',
                scale: [0.10763, 0.10763, 0.10763],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP, text: "Tire", offset: -0.5, axis: "y", interfaceToShow: "none", //TODO: faire un énumérateur pour les interfaces
                    chapterDistance: 1.85, requiredStep: 'firstStop'
                }],
                defaultPlacement: {
                    position: [4.42042, 0.4972, -10.60032],
                    rotation: [0.01065, -12.32268, 1.60327],
                    scale: [0.1763, 0.1763, 0.1763],
                }
            },

            'VisonRun': {
                id: 'VisonRun',
                path: '/models/primary/VisonRun2.glb',
                scale: [10, 10, 10],
                interactive: false,
                useTextures: true,
                animations: {
                    // Animation principale du vison
                    'animation_0': {
                        autoplay: false, // Contrôle manuel
                        defaultLoop: false,
                        defaultClamp: true,
                        defaultTimeScale: 1.66
                    },
                },
                defaultPlacements: [{
                    position: [5.02042, 0.7472, -10.60032], // position: [-34.943, 0, 45.149],
                    rotation: [3.14 / 2, 3.14 / 2 * 3 + 0.066, 3.14 / 2], // scale: [5, 5, 5],
                    scale: [5, 5, 5], animationId: 'VisonRun'
                }]
            },


            /**
             * SCÈNE 04 - RECHERCHE DES INDICES
             * Investigation environnementale avec découverte progressive
             * Déclencheur 1: DRAG DROITE-GAUCHE "Déblaye les feuilles"
             * Effet 1: Animation de secousse et déblayage des feuilles
             * Déclencheur 2: CLICK MAINTENU sur empreintes "Scan les traces"
             * Effet 2: Analyse des empreintes avec explication par Célia
             */
            'MultipleLeaf': {
                id: 'MultipleLeaf',
                path: '/models/primary/MultipleLeaf.glb',
                scale: [1, 1, 1],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_RIGHT,
                    text: "Tire",
                    offset: -0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.5,
                    requiredStep: 'thirdStop'
                }],
                defaultPlacement: {
                    position: [0.41938, -0.07564, -30.79174], rotation: [0, 0, 0], scale: [1, 1, 1],
                }
            }, 'AnimalPaws': {
                id: 'AnimalPaws',
                path: '/models/primary/AnimalPaws.glb',
                scale: [0.18402, 0.18402, 0.18402],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.CLICK, text: "Clique",

                    offset: 0.5, axis: "y", interfaceToShow: "scanner", chapterDistance: 0.33, requiredStep: 'fifthStop'
                }],
                defaultPlacement: {
                    position: [0.42958, -0.07796, -30.79699],
                    rotation: [0, 24.64264, 0],
                    scale: [0.18402, 0.18402, 0.18402],
                }
            },

            /**
             * SCÈNE 05 - TRAVERSÉE DE LA RIVIÈRE
             * Puzzle spatial avec progression séquentielle
             * Déclencheur: 4 CLICKS SUCCESSIFS sur chaque pierre "Saute sur la pierre"
             * Effet: Animation de saut sur chaque pierre pour traverser la rivière
             */
            'JumpRock1': {
                id: 'RockWater',
                path: '/models/rock/RockWater.glb',
                scale: [0.87951, 0.87951, 0.87951],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP, text: "Tire",

                    offset: 0.5, axis: "y", interfaceToShow: "none", chapterDistance: 1.66, requiredStep: 'eleventhStop'
                }],
                defaultPlacement: {
                    position: [-19.1548, -0.44604, -53.4215],
                    rotation: [0, -47.69659, 0],
                    scale: [0.87951, 0.87951, 0.87951],
                    outlinePulse: false
                }
            },

            'JumpRock2': {
                id: 'RockWater',
                path: '/models/rock/RockWater.glb',
                scale: [0.86286, 0.86286, 0.86286],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP, text: "Tire",

                    offset: 0.5, axis: "y", interfaceToShow: "none", chapterDistance: 0.9, requiredStep: 'twelfthStop'
                }],
                defaultPlacement: {
                    position: [-16.5692, -0.44358, -54.6309],
                    rotation: [0, -36.97567, 0],
                    scale: [0.86286, 0.86286, 0.86286],
                    outlinePulse: false
                }
            },

            'JumpRock3': {
                id: 'RockWater',
                path: '/models/rock/RockWater.glb',
                scale: [0.87951, 0.87951, 0.87951],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Tire",

                    offset: 0.6,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 1.0,
                    requiredStep: 'thirteenthStop'
                }],
                defaultPlacement: {
                    position: [-14.8924, -0.44604, -52.2855],
                    rotation: [0, 0, 0],
                    scale: [0.87951, 0.87951, 0.87951],
                    outlinePulse: false
                }
            },


            'JumpRock4': {
                id: 'RockWater',
                path: '/models/rock/RockWater.glb',
                scale: [0.86286, 0.86286, 0.86286],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Tire",

                    offset: 0.33,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 1.15,
                    requiredStep: 'fourteenthStop'
                }],
                defaultPlacement: {
                    position: [-13.076, -0.44358, -53.6481],
                    rotation: [0, 0, 0],
                    scale: [0.86286, 0.86286, 0.86286],
                    outlinePulse: false
                }
            }, /**
             * SCÈNE 06 - OBSTACLE DE LA BRANCHE
             * Apprentissage du mouvement vertical inverse
             * Déclencheur: DRAG HAUT-BAS "Passe en-dessous"
             * Effet: Animation de passage sous la branche
             */
            'ThinTrunkInteractive': {
                id: 'TrunkThin',
                path: '/models/forest/tree/ThinTrunk.gltf',
                scale: [0.27658, 0.27658, 0.27658],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_DOWN,
                    text: "Tire",
                    offset: -0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 1.75,
                    requiredStep: 'fourthStop'
                }],
                defaultPlacement: {
                    position: [-38.33459, 0.51133, -112.1474], // position: [-33.943, 0.51133, 45.149],
                    rotation: [179.6387 - 45, -48.41434 - 45, -23.12458], scale: [0.27658, 0.27658, 0.27658],
                }
            },

            'Vison': {
                id: 'Vison',
                path: '/models/primary/VisonRun2.glb',
                scale: [10, 10, 10],
                interactive: false,
                useTextures: true,
                animations: {
                    // Animation principale du vison
                    'animation_0': {
                        autoplay: false, // Contrôle manuel
                        defaultLoop: false,
                        defaultClamp: true,
                        defaultTimeScale: 1.5
                    },
                },
                defaultPlacements: [{
                    position: [-42.88209, 1.2587, -118.12142],
                    // position: [-34.943, 0, 45.149],
                    rotation: [3.14 / 32, 3.14 / 4, 0],
                    // scale: [5, 5, 5],
                    scale: [5, 5, 5],
                    animationId: 'Vison'
                }]
            },
            'BigRock': {
                id: 'BigRock',
                path: '/models/rock/BigRock.glb',
                scale: [0.12371, 0.12371, 0.12371],
                interactive: false,
                useTextures: true,
                defaultPlacements: [{
                    position: [-41.86723, 0.06409, -115.2628], // position: [-33.943, 0.51133, 45.149],

                    rotation: [-3.14159, -52.79977, -3.14159], scale: [0.1671, 0.1671, 0.1671],
                }, {
                    position: [-6.48458, -0.1, 9.08298],
                    rotation: [0, 12.65998, 0],
                    scale: [0.19009, 0.19009, 0.19009],
                }]
            }, 'TreeStump': {
                id: 'TreeStump',
                path: '/models/forest/tree/TreeStump.glb',
                interactive: false,
                useTextures: true,
                defaultPlacements: [{
                    position: [-40.33271, 0.06409, -113.93519], // position: [-34.943, 0.51133, 45.149],

                    rotation: [-3.14159, 40.80581, -3.14159], scale: [0.09007, 0.09007, 0.09007],
                }, {
                    position: [-4.42556, -0.10466, 17.08652],
                    // position: [-34.943, 0.51133, 45.149],

                    rotation: [3.1266, -3.1415 / 2, 3.13356], scale: [0.08086, 0.08086, 0.08086],
                }, {
                    position: [-1.41912, 0, 14.05649],
                    // position: [-34.943, 0.51133, 45.149],

                    rotation: [0.35329, -70.04373, 0.40651], scale: [0.09086, 0.09086, 0.09086],
                }]
            },

            /**
             * SCÈNE 07 & 08 - DÉCOUVERTE DU VISON
             * Révélation principale et message environnemental
             * Scène 07: HOVER sur l'action désactivée "Remplis ta gourde"
             *  - Explication du problème de pénurie d'eau
             */

            'RiverCheckpoint': {
                id: 'Screen',
                path: '/models/digital/screen/Screen.glb',
                scale: [0.1, 0.1, 0.1],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DISABLE,
                    text: "Maintiens",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 1.75,
                    requiredStep: 'seventeenStop'
                }],
                defaultPlacement: {
                    position: [-14.93628, -0.75, -135.53311], rotation: [0, -89.39436, 0], scale: [0.1, 0.1, 0.1],
                }
            },

            'DataCenter': {
                id: 'DataCenter',
                path: '/models/digital/DataCenter.glb',
                interactive: false,
                useTextures: true,
                defaultPlacements: [{
                    position: [21.48621, -0.04933, -144.81503],
                    rotation: [0, -3.14 / 2, 0],
                    scale: [0.48521, 0.4852, 0.48521],
                }, {
                    position: [9.48621, -0.04933, -144.81503],
                    rotation: [0, 3.14, 0],
                    scale: [0.45521, 0.4552, 0.45521],
                }, {
                    position: [17.48621, -0.04933, -133.21503],
                    rotation: [0, -3.14 / 2, 0],
                    scale: [0.50521, 0.5052, 0.50521],
                }, {
                    position: [20.48621, -0.04933, -138.21503],
                    rotation: [0, -3.14 / 2, 0],
                    scale: [0.652, 0.652, 0.652],
                }, {
                    position: [17.78621, -0.34933, -126.81503],
                    rotation: [0, 3.14 / 4, 0],
                    scale: [0.62521, 0.6252, 0.62521],
                }]
            },

            'DataCenterPanel': {
                id: 'DataCenterPanel',
                path: '/models/digital/DataCenterPanel.glb',
                interactive: false,
                useTextures: true,
                defaultPlacements: [{
                    position: [-3.055, -0.251, -135.134],
                    rotation: [0, -126.78, 0],
                    scale: [1, 1, 1],
                }, {
                    position: [15.931, 0.000, -134.524],
                    rotation: [0, -70.69, 0],
                    scale: [0.82521, 0.82521, 0.82521],
                }, {
                    position: [11.700, 0.000, -126.457],
                    rotation: [0, 29.32, 0],
                    scale: [0.82521, 0.82521, 0.82521],
                }]
            },

            'VisonDead': {
                id: 'VisonDead',
                path: '/models/primary/AnimalVisonDead.glb',
                scale: [1.05783, 1.05783, 1.05783],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.CONFIRM,  // CHANGÉ : de CLICK à CONFIRM
                    text: "Prends en photo",        // CHANGÉ : texte plus descriptif
                    offset: 0.5, axis: "y", interfaceToShow: "capture", chapterDistance: 3.4, requiredStep: 'sixthStop'
                }],
                defaultPlacement: {
                    position: [7.281, -0.07878, -135.01186], // position: [-33.943, 0.51133, 45.149],
                    rotation: [-3.14159, -6.18583, -3.14159],
                    scale: [1.05783, 1.05783, 1.05783],
                }
            },
        };

        // Liste des placements d'objets dans la scène
        this.placements = [];

        // Écouter les événements d'interaction
        this._setupEventListeners();

        // Initialiser les placements par défaut
        this._initializeDefaultPlacements();
        setTimeout(() => {
            this.configureGroundObject();
        }, 1000);
        // Exposer l'API globale pour contrôle externe des animations
        window.animationControls = {
            play: (identifier, animationName, options = {}) => {
                return this.playAnimation(identifier, animationName, options);
            },

            stop: (identifier) => {
                return this.stopAnimation(identifier);
            },

            pause: (identifier) => {
                return this.pauseAnimation(identifier);
            },

            resume: (identifier) => {
                return this.resumeAnimation(identifier);
            },

            updateParams: (identifier, params) => {
                return this.updateAnimationParams(identifier, params);
            },

            getState: (identifier) => {
                return this.getAnimationState(identifier);
            },

            getAvailable: (objectKey) => {
                return this.getAvailableAnimationsForObject(objectKey);
            },

            playByStep: (stepId, animationName, options = {}) => {
                return this.playAnimationByStep(stepId, animationName, options);
            }
        };
    }

    /**
     * SYSTÈME DE CONTRÔLE D'ANIMATIONS EXTERNES
     * ========================================
     */
    _setupAnimationEventListeners() {
        // Écouter les commandes d'animation externes
        EventBus.on('external-animation-play', (data) => {
            this.playAnimation(data.identifier, data.animationName, data.options);
        });

        EventBus.on('external-animation-stop', (data) => {
            this.stopAnimation(data.identifier);
        });

        EventBus.on('external-animation-pause', (data) => {
            this.pauseAnimation(data.identifier);
        });

        EventBus.on('external-animation-resume', (data) => {
            this.resumeAnimation(data.identifier);
        });

        EventBus.on('external-animation-update-params', (data) => {
            this.updateAnimationParams(data.identifier, data.params);
        });
    }

    triggerAnimation(identifier, animationName, options = {}) {
        // Vérifier les placements Vison
        const visonPlacements = sceneObjectManager.getPlacements({objectKey: identifier});
        console.log("- Placements Vison trouvés:", visonPlacements.length);
        console.log("- Détail placements:", visonPlacements);

        // Vérifier les animations disponibles
        const availableAnimations = sceneObjectManager.getAvailableAnimations(identifier);
        console.log("- Animations disponibles pour Vison:", availableAnimations);

        // Vérifier l'état actuel
        const currentState = window.animationControls.getState(identifier);
        console.log("- État actuel Vison:", currentState);

        // Essayer plusieurs identifiants
        console.log("🎬 Tentatives de déclenchement:");

        // Méthode 1: Par objectKey
        try {
            const result1 = window.animationControls.play(identifier, animationName, options);
            console.log("- Résultat méthode 1 (objectKey):", result1);
        } catch (error) {
            console.error("- Erreur méthode 1:", error);
        }
    }

    // Méthode pour jouer une animation sur un objet spécifique
    playAnimation(identifier, animationName, options = {}) {
        console.log(`🎬 DÉBUT playAnimation - identifier: ${identifier}, animation: ${animationName}`);

        const placements = this.findPlacementsByIdentifier(identifier);
        console.log(`📍 Placements trouvés: ${placements.length}`);

        if (placements.length === 0) {
            console.warn(`❌ Aucun placement trouvé pour l'identifiant "${identifier}"`);
            console.log('📋 Placements disponibles:', this.placements.map(p => ({
                objectKey: p.objectKey,
                markerId: p.markerId,
                animationId: p.animationId,
                index: this.placements.indexOf(p)
            })));
            return false;
        }

        placements.forEach((placement, placementIdx) => {
            console.log(`🔄 Traitement placement ${placementIdx}:`, {
                objectKey: placement.objectKey, hasAnimationId: !!placement.animationId
            });

            const objectConfig = this.getObjectFromCatalog(placement.objectKey);

            if (!objectConfig || !objectConfig.animations || !objectConfig.animations[animationName]) {
                console.warn(`❌ Animation "${animationName}" non trouvée pour ${placement.objectKey}`);
                console.log(`📋 Animations disponibles:`, objectConfig?.animations ? Object.keys(objectConfig.animations) : 'Aucune');
                return;
            }

            const animConfig = objectConfig.animations[animationName];
            console.log(`⚙️ Config animation trouvée:`, animConfig);

            // Mettre à jour le placement avec les nouvelles propriétés d'animation
            const animationUpdate = {
                animation: {
                    play: true,
                    name: animationName,
                    loop: options.loop !== undefined ? options.loop : animConfig.defaultLoop,
                    clamp: options.clamp !== undefined ? options.clamp : animConfig.defaultClamp,
                    timeScale: options.timeScale !== undefined ? options.timeScale : animConfig.defaultTimeScale,
                    onComplete: options.onComplete || null
                }
            };

            console.log(`🔄 Mise à jour animation:`, animationUpdate);

            // Trouver l'index du placement pour la mise à jour
            const placementIndex = this.placements.findIndex(p => p === placement);
            console.log(`📍 Index du placement trouvé: ${placementIndex}`);

            if (placementIndex !== -1) {
                // IMPORTANT: Mettre à jour le placement dans le tableau
                const success = this.updatePlacement(placementIndex, animationUpdate);
                console.log(`✅ Mise à jour placement réussie: ${success}`);

                // Vérifier que la mise à jour a bien eu lieu
                const updatedPlacement = this.placements[placementIndex];
                console.log(`🔍 Placement après mise à jour:`, {
                    objectKey: updatedPlacement.objectKey,
                    hasAnimation: !!updatedPlacement.animation,
                    animationPlay: updatedPlacement.animation?.play,
                    animationName: updatedPlacement.animation?.name
                });
            }

            // CRITIQUE: Émettre l'événement avec tous les détails nécessaires
            const eventData = {
                identifier: identifier,
                objectKey: placement.objectKey,
                action: 'play',
                animationName: animationName,
                placement: this.placements[placementIndex], // Utiliser le placement mis à jour
                animationId: placement.animationId,
                placementIndex: placementIndex
            };

            console.log(`📡 Émission événement animation-control-update:`, eventData);

            EventBus.trigger('animation-control-update', eventData);

            console.log(`✅ Événement émis pour ${placement.objectKey} (index: ${placementIndex})`);
        });

        console.log(`🎬 FIN playAnimation - succès: ${placements.length > 0}`);
        return placements.length > 0;
    }

    configureGroundObject() {
        console.log("🌍 Configuration spéciale du sol...");

        // Appliquer la configuration de texture avancée
        if (textureManager && typeof textureManager.configureGroundTexture === 'function') {
            textureManager.configureGroundTexture(500, 500, {
                roughness: 1.0,
                metalness: 0.0,
                envMapIntensity: 0.2,
                aoIntensity: 1.2,
                normalScale: new Vector2(1.0, 1.0)
            });

            console.log("✅ Configuration sol appliquée avec textures détaillées");
        }

        // Forcer l'application des textures sur les objets Ground existants
        this.applyGroundTexturesForAll();
    }

    applyGroundTexturesForAll() {
        const groundPlacements = this.getPlacements({objectKey: 'Ground'});

        groundPlacements.forEach((placement, index) => {
            console.log(`🌍 Application textures sol ${index + 1}/${groundPlacements.length}`);


            // Mettre à jour le placement avec les nouvelles propriétés
            this.updatePlacement(index, {
                useTextures: true, textureConfig: {
                    repeat: [500, 500], quality: 'high', anisotropy: 32
                }
            });
        });

        // Émettre un événement pour forcer la mise à jour
        EventBus.trigger('ground-textures-updated', {
            count: groundPlacements.length
        });
    }

    setGroundTextureRepeat(repeatX, repeatY) {
        if (!textureManager) {
            console.warn("TextureManager non disponible");
            return false;
        }

        console.log(`🌍 Modification répétition texture sol: ${repeatX}x${repeatY}`);

        // Appliquer la nouvelle configuration
        textureManager.configureGroundTexture(repeatX, repeatY);

        // Forcer la mise à jour des matériaux existants
        this.applyGroundTexturesForAll();

        return true;
    }

// Méthode pour optimiser les performances du sol
    optimizeGroundRendering() {
        const groundPlacements = this.getPlacements({objectKey: 'Ground'});

        groundPlacements.forEach((placement, index) => {
            // Configuration optimisée pour les performances
            this.updatePlacement(index, {
                // Optimisations de rendu
                frustumCulled: false, // Le sol est toujours visible
                castShadow: false,    // Le sol ne projette pas d'ombre
                receiveShadow: true,  // Mais reçoit les ombres

                // Optimisations de texture
                textureConfig: {
                    minFilter: 'LinearMipmapLinear', magFilter: 'Linear', anisotropy: 8, // Réduire si performance nécessaire
                    generateMipmaps: true
                }
            });
        });

        console.log(`🌍 Optimisation rendu appliquée à ${groundPlacements.length} objets sol`);
    }

    // Méthode pour arrêter une animation
    stopAnimation(identifier) {
        const placements = this.findPlacementsByIdentifier(identifier);

        placements.forEach(placement => {
            if (placement.animation) {
                const animationUpdate = {
                    animation: {
                        ...placement.animation, play: false
                    }
                };

                this.updatePlacement(placement.markerId || this._getPlacementIndex(placement), animationUpdate);

                EventBus.trigger('animation-control-update', {
                    identifier: identifier, objectKey: placement.objectKey, action: 'stop', placement: placement
                });
            }
        });

        return placements.length > 0;
    }

    // Méthode pour mettre en pause une animation
    pauseAnimation(identifier) {
        return this.stopAnimation(identifier);
    }

    // Méthode pour reprendre une animation
    resumeAnimation(identifier) {
        const placements = this.findPlacementsByIdentifier(identifier);

        placements.forEach(placement => {
            if (placement.animation && placement.animation.name) {
                const animationUpdate = {
                    animation: {
                        ...placement.animation, play: true
                    }
                };

                this.updatePlacement(placement.markerId || this._getPlacementIndex(placement), animationUpdate);

                EventBus.trigger('animation-control-update', {
                    identifier: identifier, objectKey: placement.objectKey, action: 'resume', placement: placement
                });
            }
        });

        return placements.length > 0;
    }

    // Méthode pour modifier les paramètres d'une animation en cours
    updateAnimationParams(identifier, params = {}) {
        const placements = this.findPlacementsByIdentifier(identifier);

        placements.forEach(placement => {
            if (placement.animation) {
                const animationUpdate = {
                    animation: {
                        ...placement.animation, ...params
                    }
                };

                this.updatePlacement(placement.markerId || this._getPlacementIndex(placement), animationUpdate);

                EventBus.trigger('animation-control-update', {
                    identifier: identifier,
                    objectKey: placement.objectKey,
                    action: 'update-params',
                    params: params,
                    placement: placement
                });
            }
        });

        return placements.length > 0;
    }

    // Méthode utilitaire pour trouver les placements par identifier
    findPlacementsByIdentifier(identifier) {
        return this.placements.filter(placement => {
            // Correspondance exacte avec markerId (pour objets interactifs)
            if (placement.markerId === identifier) {
                return true;
            }

            // Correspondance avec objectKey (pour objets statiques ET interactifs)
            if (placement.objectKey === identifier) {
                return true;
            }

            // Correspondance avec requiredStep
            if (placement.requiredStep && placement.requiredStep === identifier) {
                return true;
            }

            // NOUVEAU: Correspondance avec l'ID du modèle de texture
            const objectConfig = this.getObjectFromCatalog(placement.objectKey);
            if (objectConfig && objectConfig.id === identifier) {
                return true;
            }

            return false;
        });
    }

    // Méthode utilitaire pour obtenir l'index d'un placement
    _getPlacementIndex(targetPlacement) {
        return this.placements.findIndex(placement => placement === targetPlacement);
    }

    // Méthode pour obtenir l'état d'animation d'un objet
    getAnimationState(identifier) {
        const placements = this.findPlacementsByIdentifier(identifier);

        return placements.map(placement => ({
            objectKey: placement.objectKey,
            markerId: placement.markerId,
            animation: placement.animation || null,
            isPlaying: placement.animation?.play || false
        }));
    }

    // Méthode pour lister toutes les animations disponibles pour un objet
    getAvailableAnimationsForObject(objectKey) {
        const objectConfig = this.getObjectFromCatalog(objectKey);

        if (!objectConfig || !objectConfig.animations) {
            return [];
        }

        return Object.keys(objectConfig.animations).map(animName => ({
            name: animName, config: objectConfig.animations[animName]
        }));
    }

    // Méthode globale pour jouer une animation par étape de scénario
    playAnimationByStep(stepId, animationName, options = {}) {
        const placements = this.getObjectsForStep(stepId);

        placements.forEach(placement => {
            this.playAnimation(placement.markerId || placement.objectKey, animationName, options);
        });

        return placements.length > 0;
    }

    _getCurrentInteraction(objectConfig, placement) {
        if (!objectConfig.interaction || !Array.isArray(objectConfig.interaction)) {
            return null;
        }

        // Si un requiredStep est spécifié dans le placement, chercher l'interaction correspondante
        if (placement && placement.requiredStep) {
            const matchingInteraction = objectConfig.interaction.find(interaction => interaction.requiredStep === placement.requiredStep);

            if (matchingInteraction) {
                // Ajouter des logs pour le débogage
                console.log(`Interaction trouvée pour ${placement.objectKey} (${placement.requiredStep}):`, matchingInteraction);
                return matchingInteraction;
            } else {
                console.warn(`Aucune interaction trouvée pour ${placement.objectKey} avec requiredStep=${placement.requiredStep}`);
            }
        }

        // Si l'objet n'a pas encore été interagi du tout, renvoyer la première interaction
        if (!placement || placement.interactionIndex === undefined) {
            return objectConfig.interaction[0];
        }

        // Si nous avons un index d'interaction stocké dans le placement, l'utiliser
        const currentIndex = placement.interactionIndex;

        // Si nous avons terminé toutes les interactions, renvoyer la dernière
        if (currentIndex >= objectConfig.interaction.length) {
            return objectConfig.interaction[objectConfig.interaction.length - 1];
        }

        // Renvoyer l'interaction actuelle
        return objectConfig.interaction[currentIndex];
    }

    getInteractiveObjectInterfaces() {
        const interfaces = {};

        // Parcourir tous les objets interactifs
        Object.entries(this.objectCatalog).forEach(([key, config]) => {
            if (config.interactive) {
                // Vérifier les interactions et leurs interfaces
                if (Array.isArray(config.interaction)) {
                    config.interaction.forEach(interaction => {
                        if (interaction.interfaceToShow) {
                            if (!interfaces[key]) {
                                interfaces[key] = [];
                            }
                            interfaces[key].push({
                                step: interaction.requiredStep, interface: interaction.interfaceToShow
                            });
                        }
                    });
                } else if (config.interaction && config.interaction.interfaceToShow) {
                    interfaces[key] = [{
                        step: config.interaction.requiredStep, interface: config.interaction.interfaceToShow
                    }];
                }
            }
        });

        // Logger les interfaces trouvées pour le débogage
        console.log("Interfaces disponibles dans les objets interactifs:", interfaces);
        return interfaces;
    }

    handleThirdStopCompletion() {
        console.log('*** Exécution de handleThirdStopCompletion ***');

        // Trouver l'emplacement de MultipleLeaf avec plus de détails de débogage
        const leafPlacements = this.getPlacements({objectKey: 'MultipleLeaf'});
        console.log('Placements MultipleLeaf trouvés:', leafPlacements);

        if (leafPlacements && leafPlacements.length > 0) {
            const leafPlacement = leafPlacements[0];

            // Obtenir la position actuelle
            const currentPosition = [...leafPlacement.position];
            console.log('Position actuelle de MultipleLeaf:', currentPosition);

            // Calculer la nouvelle position (décalage de 2.0 sur X et Z)
            const newPosition = [currentPosition[0] + 0.5, currentPosition[1] + 0.1, currentPosition[2] - 0.02];

            console.log(`Déplacement de MultipleLeaf de [${currentPosition}] à [${newPosition}]`);

            // Récupérer l'identifiant du marqueur pour une mise à jour précise
            let identifier;
            if (leafPlacement.markerId) {
                identifier = leafPlacement.markerId;
                console.log('Mise à jour par markerId:', identifier);
            } else {
                // Si markerId n'est pas disponible, utiliser l'index de placement dans le tableau
                const index = this.placements.findIndex(p => p.objectKey === 'MultipleLeaf' && p.position[0] === currentPosition[0] && p.position[2] === currentPosition[2]);

                if (index !== -1) {
                    identifier = index;
                    console.log('Mise à jour par index:', index);
                } else {
                    console.warn('Impossible de trouver un identifiant valide pour la mise à jour');
                    return;
                }
            }

            // Effectuer la mise à jour avec l'identifiant approprié
            const updateResult = this.updatePlacement(identifier, {
                position: newPosition
            });

            console.log('Résultat de la mise à jour:', updateResult);

            // Vérifier si la mise à jour a fonctionné en récupérant à nouveau le placement
            const updatedPlacements = this.getPlacements({objectKey: 'MultipleLeaf'});
            if (updatedPlacements && updatedPlacements.length > 0) {
                console.log('Nouvelle position après mise à jour:', updatedPlacements[0].position);
            }

            // Émettre un événement pour informer les autres composants
            EventBus.trigger('object-position-updated', {
                objectKey: 'MultipleLeaf', oldPosition: currentPosition, newPosition: newPosition
            });
        } else {
            console.warn('Objet MultipleLeaf non trouvé lors de la complétion de thirdStop');
        }
    }

    // Méthode simplifiée pour gérer les cas où on ne veut pas de transition
    getChapterDistance(stepId) {
        const placements = this.getInteractivePlacements({requiredStep: stepId});

        if (placements.length > 0) {
            const objectKey = placements[0].objectKey;
            const objectConfig = this.getObjectFromCatalog(objectKey);
            const placement = placements[0];

            if (objectConfig && objectConfig.interaction) {
                // Pour les interactions multiples (tableau)
                if (Array.isArray(objectConfig.interaction)) {
                    // Trouver l'interaction correspondant à l'étape requise
                    const matchingInteraction = objectConfig.interaction.find(interaction => interaction.requiredStep === stepId);

                    if (matchingInteraction) {
                        // Vérifier explicitement les cas spéciaux
                        if (matchingInteraction.chapterDistance === "none" || matchingInteraction.chapterDistance === 0 || matchingInteraction.chapterDistance === "0") {
                            console.log(`Distance zéro explicitement configurée pour ${stepId} (${objectKey})`);
                            return 0;
                        }

                        if (matchingInteraction.chapterDistance !== undefined) {
                            return matchingInteraction.chapterDistance;
                        }
                    }
                }
                // Pour une interaction unique (compatibilité descendante)
                else if (objectConfig.interaction.requiredStep === stepId) {
                    // Vérifier explicitement les cas spéciaux
                    if (objectConfig.interaction.chapterDistance === "none" || objectConfig.interaction.chapterDistance === 0 || objectConfig.interaction.chapterDistance === "0") {
                        console.log(`Distance zéro explicitement configurée pour ${stepId} (${objectKey})`);
                        return 0;
                    }

                    if (objectConfig.interaction.chapterDistance !== undefined) {
                        return objectConfig.interaction.chapterDistance;
                    }
                }
            }
        }

        // Valeur par défaut
        return 0;
    }

    // Attribue automatiquement une étape en fonction de l'ordre des objets
    _getNextStep() {
        // Vérifier si nous avons encore des étapes disponibles
        if (this.interactiveObjectsCount < this.interactionSteps.length) {
            const step = this.interactionSteps[this.interactiveObjectsCount];
            this.interactiveObjectsCount++;
            return step;
        }

        // Si tous les steps sont utilisés, générer un nom d'étape basé sur le compteur
        return `additionalStop_${this.interactiveObjectsCount++}`;
    }

    // Génère un markerId basé sur le requiredStep
    _generateMarkerId(objectKey, requiredStep) {
        if (!requiredStep) {
            return `${objectKey}-${Math.random().toString(36).substring(2, 9)}`;
        }

        return `${requiredStep}-marker`;
    }

    // Génère un texte de marqueur basé sur le requiredStep ou le type d'objet
    _generateMarkerText(objectKey, requiredStep, defaultText) {
        // Si une étape est définie et qu'il y a un texte correspondant, l'utiliser
        if (requiredStep && this.stepTexts[requiredStep]) {
            return this.stepTexts[requiredStep];
        }

        // Sinon, utiliser le texte par défaut de l'objet
        if (defaultText) {
            return defaultText;
        }

        // Dernier recours: générer un texte basé sur le type d'objet
        const objectName = objectKey.replace(/Interactive$/, '');
        return `Examiner ${objectName.toLowerCase()}`;
    }

    // Initialiser les placements par défaut à partir du catalogue
    _initializeDefaultPlacements() {
        // Réinitialiser le compteur d'objets interactifs
        this.interactiveObjectsCount = 0;

        Object.entries(this.objectCatalog).forEach(([key, config]) => {
            if (config.interactive && config.defaultPlacement) {
                // Si l'objet a des interactions multiples (tableau), créer un placement pour chaque interaction
                if (Array.isArray(config.interaction) && config.interaction.length > 0) {
                    config.interaction.forEach((interaction, index) => {
                        // Utiliser le requiredStep de l'interaction actuelle
                        let requiredStep = interaction.requiredStep;

                        // Fallback si nécessaire
                        requiredStep = requiredStep || config.defaultPlacement.requiredStep || this._getNextStep();

                        // Générer automatiquement markerId et markerText
                        const markerId = config.defaultPlacement.markerId || this._generateMarkerId(key, requiredStep);

                        // Utiliser le texte de l'interaction actuelle
                        let markerText = interaction.text || config.defaultPlacement.markerText || this._generateMarkerText(key, requiredStep, null);

                        // Créer un placement pour cette interaction
                        this.addPlacement(key, config.defaultPlacement.position, {
                            rotation: config.defaultPlacement.rotation || [0, 0, 0],
                            markerId: markerId,
                            markerText: markerText,
                            requiredStep: requiredStep,
                            outlinePulse: config.defaultPlacement.outlinePulse,
                            markerOffset: interaction.offset || config.defaultPlacement.markerOffset,
                            markerAxis: interaction.axis || config.defaultPlacement.markerAxis,
                            interactionIndex: index  // Stocker l'index de l'interaction dans le placement
                        });
                    });
                } else if (config.interaction && config.interaction.requiredStep) {
                    // Cas d'une interaction unique
                    let requiredStep = config.interaction.requiredStep;

                    // Fallback au placement par défaut ou génération automatique
                    requiredStep = requiredStep || config.defaultPlacement.requiredStep || this._getNextStep();

                    const markerId = config.defaultPlacement.markerId || this._generateMarkerId(key, requiredStep);
                    const markerText = config.interaction.text || config.defaultPlacement.markerText || this._generateMarkerText(key, requiredStep, null);

                    // Créer un placement pour cette interaction
                    this.addPlacement(key, config.defaultPlacement.position, {
                        rotation: config.defaultPlacement.rotation || [0, 0, 0],
                        markerId: markerId,
                        markerText: markerText,
                        requiredStep: requiredStep,
                        outlinePulse: config.defaultPlacement.outlinePulse,
                        markerOffset: config.interaction.offset || config.defaultPlacement.markerOffset,
                        markerAxis: config.interaction.axis || config.defaultPlacement.markerAxis
                    });
                }
            } else if (!config.interactive && config.defaultPlacements) {
                // MODIFIÉ: Objets statiques - assigner un identifiant unique si ils ont des animations
                config.defaultPlacements.forEach((placement, index) => {
                    const placementOptions = {
                        rotation: placement.rotation || [0, 0, 0],
                        scale: placement.scale || config.scale,
                        quaternion: placement.quaternion
                    };

                    // NOUVEAU: Si l'objet a des animations, lui assigner un identifiant unique
                    if (config.animations && Object.keys(config.animations).length > 0) {
                        const uniqueId = index === 0 ? key : `${key}-${index}`;
                        placementOptions.animationId = uniqueId;

                        console.log(`Objet statique ${key} avec animations - ID assigné: ${uniqueId}`);
                    }

                    // Ajouter l'animation par défaut si disponible
                    if (config.defaultAnimation) {
                        placementOptions.animation = {...config.defaultAnimation};
                    }

                    this.addPlacement(key, placement.position, placementOptions);
                });
            }
        });
    }

    // Ajouter un texte standard pour une étape
    addStepText(stepId, text) {
        this.stepTexts[stepId] = text;
        return this;
    }

    // Obtenir le texte standard pour une étape
    getStepText(stepId) {
        return this.stepTexts[stepId] || `Point d'intérêt`;
    }


    // Configurer les écouteurs d'événements
    _setupEventListeners() {
        // Réagir aux interactions complétées
        EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, (data) => {
            console.log('Événement INTERACTION_COMPLETE reçu:', data);

            // Vérifier directement si c'est l'étape thirdStop, indépendamment du placement
            if (data.requiredStep === 'thirdStop' || (data.id && data.id.includes('thirdStop'))) {
                console.log('Détection directe de thirdStop dans INTERACTION_COMPLETE');
                this.handleThirdStopCompletion();
            }

            const placement = this.placements.find(p => p.markerId === data.id);
            if (placement) {
                console.log(`%c==== INTERACTION ENREGISTRÉE PAR SceneObjectManager ====`);
                console.log(`Marqueur: ${placement.markerId}`);
                console.log(`Objet: ${placement.objectKey}`);
                console.log(`Étape requise: ${placement.requiredStep}`);
                console.log(`Type d'interaction: ${data.type || placement.markerType}`);
                console.log(`=============================`);

                // Exécuter le callback personnalisé si défini
                if (placement.onInteract && typeof placement.onInteract === 'function') {
                    placement.onInteract(data);
                }

                // Marquer l'objet comme complètement interagi
                placement.interacted = true;

                // Émettre un événement pour le système de scénario
                EventBus.trigger('object:interaction:complete', {
                    markerId: placement.markerId,
                    objectKey: placement.objectKey,
                    requiredStep: placement.requiredStep,
                    isFinalInteraction: true
                });

                // Cas spécial pour thirdStop - Déplacer l'objet MultipleLeaf
                if (placement.requiredStep === 'thirdStop') {
                    console.log('thirdStop completion détectée via placement.requiredStep');
                    this.handleThirdStopCompletion();
                }
            }
        });

        // Écouter aussi l'événement object:interaction:complete
        EventBus.on('leaf-erable-move-requested', (data) => {
            console.log('Événement leaf-erable-move-requested reçu:', data);
            this.handleThirdStopCompletion();
        });

        // Ajouter un écouteur spécifique pour INTERACTION_COMPLETE provenant du store
        EventBus.on('INTERACTION_COMPLETE', (data) => {
            console.log('Événement INTERACTION_COMPLETE direct reçu:', data);
            // Vérifier si c'est l'étape thirdStop
            if (data.id === 'thirdStop' || (typeof data.id === 'string' && data.id.includes('thirdStop'))) {
                console.log('thirdStop completion détectée via INTERACTION_COMPLETE direct');
                this.handleThirdStopCompletion();
            }
        });

        // NOUVEAU: Configurer les écouteurs d'événements d'animation
        this._setupAnimationEventListeners();
    }

    // Ajouter un nouvel objet au catalogue
    addObjectToCatalog(key, config) {
        if (this.objectCatalog[key]) {
            console.warn(`Objet ${key} existe déjà dans le catalogue. Il sera remplacé.`);
        }

        // Configuration de base pour tous les objets
        const baseConfig = {
            id: config.id || key,
            path: config.path,
            scale: config.scale || [1, 1, 1],
            interactive: config.interactive !== undefined ? config.interactive : false,
            useTextures: config.useTextures !== undefined ? config.useTextures : true
        };

        // Ajouter les propriétés d'interaction si l'objet est interactif
        if (config.interactive) {
            baseConfig.interaction = [{
                type: config.interaction?.type || INTERACTION_TYPES.CLICK,
                text: config.interaction?.text || "Interagir",
                offset: config.interaction?.offset || 1.0,
                axis: config.interaction?.axis || "y",
                interfaceToShow: config.interaction?.interfaceToShow || null
            }];
        } else if (config.defaultPlacements) {
            // Ajouter les placements par défaut pour les objets statiques
            baseConfig.defaultPlacements = config.defaultPlacements;
        }

        // Ajouter le support des animations
        if (config.animations) {
            baseConfig.animations = config.animations;

            // Vérifier si une animation est marquée pour démarrer automatiquement
            const autoplayAnimation = Object.entries(config.animations).find(([name, animConfig]) => animConfig.autoplay === true);

            if (autoplayAnimation) {
                const [animName, animConfig] = autoplayAnimation;

                // Configurer l'animation par défaut
                baseConfig.defaultAnimation = {
                    play: true,
                    name: animName,
                    loop: animConfig.defaultLoop !== undefined ? animConfig.defaultLoop : true,
                    clamp: animConfig.defaultClamp !== undefined ? animConfig.defaultClamp : false,
                    timeScale: animConfig.defaultTimeScale !== undefined ? animConfig.defaultTimeScale : 1.0
                };
            }
        }

        this.objectCatalog[key] = baseConfig;

        // Si des placements par défaut sont définis, les ajouter immédiatement
        if (config.interactive && config.defaultPlacement) {
            // Attribuer automatiquement la prochaine étape si non spécifiée
            const requiredStep = config.defaultPlacement.requiredStep || this._getNextStep();

            const markerId = config.defaultPlacement.markerId || this._generateMarkerId(key, requiredStep);
            const markerText = config.defaultPlacement.markerText || this._generateMarkerText(key, requiredStep, config.interaction.text);

            this.addPlacement(key, config.defaultPlacement.position, {
                rotation: config.defaultPlacement.rotation || [0, 0, 0],
                markerId: markerId,
                markerText: markerText,
                requiredStep: requiredStep,
                outlinePulse: config.defaultPlacement.outlinePulse
            });
        } else if (!config.interactive && config.defaultPlacements) {
            config.defaultPlacements.forEach((placement) => {
                this.addPlacement(key, placement.position, {
                    rotation: placement.rotation || [0, 0, 0]
                });
            });
        }

        return this;
    }

    // Récupérer la configuration d'un objet du catalogue
    getObjectFromCatalog(key) {
        return this.objectCatalog[key] || null;
    }

    // Vérifier si un objet utilise des textures
    doesObjectUseTextures(key) {
        return this.objectCatalog[key]?.useTextures === true;
    }

    // Obtenir l'ID de modèle pour appliquer les textures
    getTextureModelId(key) {
        return this.objectCatalog[key]?.id || null;
    }

    // Ajouter un placement d'objet dans la scène
    addPlacement(key, position, options = {}) {
        const objectConfig = this.objectCatalog[key];
        if (!objectConfig) {
            console.error(`Objet "${key}" non trouvé dans le catalogue.`);
            return null;
        }

        const placement = {
            objectKey: key,
            position: position || (objectConfig.defaultPlacement?.position || [0, 0, 0]),
            rotation: options.rotation || (objectConfig.defaultPlacement?.rotation || [0, 0, 0]),
            scale: options.scale || objectConfig.scale || [1, 1, 1],
            visible: options.visible !== undefined ? options.visible : true,
            castShadow: options.castShadow !== undefined ? options.castShadow : true,
            receiveShadow: options.receiveShadow !== undefined ? options.receiveShadow : true,
            useTextures: options.useTextures !== undefined ? options.useTextures : objectConfig.useTextures
        };

        // Gérer les quaternions si fournis
        if (options.quaternion) {
            placement.quaternion = options.quaternion;
        } else if (objectConfig.defaultPlacement?.quaternion) {
            placement.quaternion = objectConfig.defaultPlacement.quaternion;
        }

        // Ajouter l'animation par défaut si disponible dans l'objet
        if (options.animation || objectConfig.defaultAnimation) {
            placement.animation = options.animation || {...objectConfig.defaultAnimation};
        }

        // Si l'objet est interactif, ajouter les propriétés d'interaction
        if (objectConfig.interactive) {
            // Trouver le bon requiredStep
            let requiredStep = options.requiredStep;

            if (!requiredStep) {
                // Chercher dans les interactions
                if (Array.isArray(objectConfig.interaction) && objectConfig.interaction.length > 0) {
                    requiredStep = objectConfig.interaction[0].requiredStep;
                } else if (objectConfig.interaction && objectConfig.interaction.requiredStep) {
                    requiredStep = objectConfig.interaction.requiredStep;
                }

                // Fallback au placement par défaut ou génération automatique
                requiredStep = requiredStep || objectConfig.defaultPlacement?.requiredStep || this._getNextStep();
            }

            const markerId = options.markerId || this._generateMarkerId(key, requiredStep);

            // Déterminer le texte du marqueur en priorité depuis les options, sinon depuis l'interaction
            let markerText = options.markerText;

            if (!markerText) {
                if (Array.isArray(objectConfig.interaction)) {
                    const matchingInteraction = objectConfig.interaction.find(interaction => interaction.requiredStep === requiredStep);
                    if (matchingInteraction) {
                        markerText = matchingInteraction.text;
                    } else if (objectConfig.interaction.length > 0) {
                        markerText = objectConfig.interaction[0].text;
                    }
                } else if (objectConfig.interaction) {
                    markerText = objectConfig.interaction.text;
                }
            }

            // Fallback au texte généré automatiquement
            markerText = markerText || this._generateMarkerText(key, requiredStep, null);

            // Trouver l'interaction correspondante pour l'offset et l'axis
            let interactionForProps;
            if (Array.isArray(objectConfig.interaction)) {
                interactionForProps = objectConfig.interaction.find(i => i.requiredStep === requiredStep) || objectConfig.interaction[0];
            } else {
                interactionForProps = objectConfig.interaction;
            }

            Object.assign(placement, {
                markerId: markerId,
                requiredStep: requiredStep,
                onInteract: options.onInteract || null,
                markerText: markerText,
                markerOffset: options.markerOffset || objectConfig.defaultPlacement?.markerOffset || interactionForProps.offset,
                markerAxis: options.markerAxis || objectConfig.defaultPlacement?.markerAxis || interactionForProps.axis,
                markerType: options.markerType || interactionForProps.type,
                outlinePulse: options.outlinePulse !== undefined ? options.outlinePulse : (objectConfig.defaultPlacement?.outlinePulse !== undefined ? objectConfig.defaultPlacement.outlinePulse : true),
                interacted: false,
                interactionIndex: 0 // Pour suivre quelle interaction est actuellement active
            });
        }

        this.placements.push(placement);
        return placement;
    }

    // Récupérer tous les placements
    getAllPlacements() {
        return this.placements;
    }

    // Récupérer les placements filtrés par critères
    getPlacements(filters = {}) {
        return this.placements.filter(placement => {
            // Filtrer par type d'objet
            if (filters.objectKey && placement.objectKey !== filters.objectKey) {
                return false;
            }

            // Filtrer par interactivité
            if (filters.interactive !== undefined) {
                const objectConfig = this.objectCatalog[placement.objectKey];
                if (!objectConfig || objectConfig.interactive !== filters.interactive) {
                    return false;
                }
            }

            // Filtrer par étape requise (pour les objets interactifs)
            if (filters.requiredStep && placement.requiredStep !== filters.requiredStep) {
                return false;
            }

            // Filtrer par état d'interaction (pour les objets interactifs)
            if (filters.interacted !== undefined && placement.interacted !== undefined && placement.interacted !== filters.interacted) {
                return false;
            }

            // Filtrer par visibilité
            if (filters.visible !== undefined && placement.visible !== filters.visible) {
                return false;
            }

            return true;
        });
    }

    // Récupérer uniquement les placements d'objets interactifs
    getInteractivePlacements(filters = {}) {
        return this.getPlacements({...filters, interactive: true});
    }

    // Récupérer uniquement les placements d'objets statiques
    getStaticPlacements(filters = {}) {
        return this.getPlacements({...filters, interactive: false});
    }

    // Récupérer les objets pour une étape spécifique
    getObjectsForStep(stepId) {
        return this.getInteractivePlacements({requiredStep: stepId});
    }

    // Récupérer l'ordre des étapes d'interaction
    getInteractionSteps() {
        return this.interactionSteps;
    }

    // Modifier un placement existant
    updatePlacement(identifier, updates) {
        // L'identifiant peut être soit un markerId pour les objets interactifs,
        // soit un index pour les objets statiques
        let index = -1;

        if (typeof identifier === 'string') {
            // Recherche par markerId (pour objets interactifs)
            index = this.placements.findIndex(p => p.markerId === identifier);
        } else if (typeof identifier === 'number') {
            // Recherche par index
            index = identifier;
        }

        if (index === -1 || index >= this.placements.length) {
            console.error(`Placement avec identifiant "${identifier}" non trouvé.`);
            return false;
        }

        // Si requiredStep est modifié, mettre à jour également le markerId et markerText
        // sauf si explicitement fournis
        if (updates.requiredStep && !updates.markerId) {
            updates.markerId = this._generateMarkerId(this.placements[index].objectKey, updates.requiredStep);
        }

        if (updates.requiredStep && !updates.markerText) {
            updates.markerText = this._generateMarkerText(this.placements[index].objectKey, updates.requiredStep, this.objectCatalog[this.placements[index].objectKey]?.interaction?.text);
        }

        this.placements[index] = {
            ...this.placements[index], ...updates
        };

        return true;
    }

    // Supprimer un placement
    removePlacement(identifier) {
        let index = -1;

        if (typeof identifier === 'string') {
            // Recherche par markerId (pour objets interactifs)
            index = this.placements.findIndex(p => p.markerId === identifier);
        } else if (typeof identifier === 'number') {
            // Recherche par index
            index = identifier;
        }

        if (index === -1 || index >= this.placements.length) {
            console.error(`Placement avec identifiant "${identifier}" non trouvé.`);
            return false;
        }

        this.placements.splice(index, 1);
        return true;
    }

    // Réinitialiser tous les états d'interaction
    resetInteractions() {
        this.placements.forEach(placement => {
            if (placement.interacted !== undefined) {
                placement.interacted = false;
            }
        });
    }

    // Réinitialiser tous les placements aux valeurs par défaut
    resetToDefaultPlacements() {
        // Vider la liste actuelle des placements
        this.placements = [];

        // Réinitialiser avec les valeurs par défaut
        this._initializeDefaultPlacements();
    }

    // Reordonner les étapes d'interaction des objets existants
    reorderInteractionSteps() {
        // Obtenir tous les objets interactifs placés
        const interactivePlacements = this.getInteractivePlacements();

        // Réinitialiser le compteur d'étapes
        this.interactiveObjectsCount = 0;

        // Réattribuer les étapes dans l'ordre actuel
        interactivePlacements.forEach(placement => {
            const step = this._getNextStep();
            this.updatePlacement(placement.markerId, {
                requiredStep: step
            });
        });
    }

    getAvailableAnimations(key) {
        const objectConfig = this.objectCatalog[key];
        if (!objectConfig || !objectConfig.animations) {
            return [];
        }

        return Object.keys(objectConfig.animations);
    }

    // Générer la liste des assets nécessaires au format attendu par l'AssetManager
    generateAssetList() {
        const assetSet = new Set();
        const assets = [];

        Object.values(this.objectCatalog).forEach(obj => {
            // Éviter les doublons en utilisant le chemin comme clé
            if (!assetSet.has(obj.path)) {
                assetSet.add(obj.path);

                assets.push({
                    name: obj.id, type: 'gltf', path: obj.path, license: 'CC-BY', author: 'Author', url: ''
                });
            }
        });

        // Ajouter les textures si TextureManager est disponible
        if (textureManager) {
            const textureAssets = textureManager.generateTextureAssetList();
            assets.push(...textureAssets);
        }

        return assets;
    }
}

export const sceneObjectManager = new SceneObjectManager();
export default sceneObjectManager;