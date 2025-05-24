// SceneObjectManager.js
// Système centralisé pour la gestion des objets individuels dans la scène
// Version avec liaison automatique des événements aux animations

import {INTERACTION_TYPES} from '../Utils/EnhancedObjectMarker';
import {EventBus, MARKER_EVENTS} from '../Utils/EventEmitter';
import {textureManager} from './TextureManager';
import { modelAnimationManager, ANIMATION_EVENTS } from './ModelAnimationManager';
import UseStore from "../Store/useStore.js";

// Fonction utilitaire pour gérer les cas où EventBus n'est pas encore disponible
function safeEventBus() {
    // Vérifier si EventBus est disponible et fonctionnel
    if (!EventBus || typeof EventBus.on !== 'function') {
        console.warn('⚠️ EventBus non disponible ou non initialisé, utilisation d\'un substitut temporaire');

        // Créer un EventEmitter de substitution basique
        return {
            on: (eventName, callback) => {
                console.log(`[TempEventBus] Enregistrement différé pour "${eventName}"`);
                // Stocker dans une file d'attente globale pour réessayer plus tard
                if (typeof window !== 'undefined') {
                    if (!window._pendingEventListeners) {
                        window._pendingEventListeners = [];
                    }
                    window._pendingEventListeners.push({ eventName, callback });
                }
                // Retourner une fonction de nettoyage vide
                return () => {};
            },
            off: () => {},
            trigger: (eventName, data) => {
                console.log(`[TempEventBus] Événement "${eventName}" différé`);
                // Stocker dans une file d'attente globale pour réessayer plus tard
                if (typeof window !== 'undefined') {
                    if (!window._pendingEvents) {
                        window._pendingEvents = [];
                    }
                    window._pendingEvents.push({ eventName, data });
                }
            },
            MARKER: MARKER_EVENTS || {} // Pour éviter d'autres erreurs
        };
    }

    return EventBus;
}

class SceneObjectManager {
    constructor() {
        /**
         * PARCOURS INTERACTIF - DÉCOUVERTE ENVIRONNEMENTALE
         * =================================================
         * Ce gestionnaire organise une expérience narrative centrée sur la découverte
         * d'un vison affecté par la pollution et la pénurie d'eau.
         */

        // Définition des étapes dans l'ordre de progression du parcours
        this.interactionSteps = ['firstStop', 'secondStop', 'thirdStop', 'fourthStop', 'fifthStop', 'sixthStop'];

        // Textes standard pour les différentes étapes d'interaction
        this.stepTexts = {
            'firstStop': "Premier point d'intérêt",
            'secondStop': "Deuxième point d'intérêt",
            'thirdStop': "Troisième point d'intérêt",
            'fourthStop': "Quatrième point d'intérêt",
            'fifthStop': "Cinquième point d'intérêt",
            'sixthStop': "Sixième point d'intérêt",
            'specialStop': "Point spécial"
        };

        // Compteur pour suivre l'ordre des objets interactifs
        this.interactiveObjectsCount = 0;

        // État de synchronisation
        this.animationSystemReady = false;
        this.registeredModels = new Set();

        // Catalogue des modèles disponibles pour les objets individuels
        this.objectCatalog = {
            'TVScreen': {
                id: 'ScreenOld',
                path: '/models/digital/screen/ScreenOld.glb',
                interactive: false,
                useTextures: true,
                defaultPlacements: [{
                    position: [-34.943, 0, 45.149],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                }],
            },

            'ModernScreen': {
                id: 'Screen',
                path: '/models/digital/screen/Screen.glb',
                interactive: false,
                useTextures: true,
                defaultPlacements: [{
                    position: [-34.043, 0, 45.149],
                    rotation: [0, -90, 0],
                    scale: [1, 1, 1],
                }]
            },

            'Ground': {
                id: 'Ground',
                path: '/models/Ground.glb',
                scale: [1, 1, 1],
                interactive: false,
                useTextures: true,
                defaultPlacements: [{position: [0, 0, 0], rotation: [0, 0, 0]},]
            },

            'Camera': {
                id: 'Camera',
                path: '/models/Camera.glb',
                scale: [1, 1, 1],
                interactive: false,
                useTextures: false,
                defaultPlacements: [{position: [0, 0, 0], rotation: [0, 0, 0]},]
            },
            // // 'WaterPlane': {
            // //     id: 'WaterPlane',
            // //     path: '/models/forest/river/River.glb',
            // //     scale: [1, 1, 1],
            // //     interactive: false,
            // //     useTextures: true,
            // //     defaultPlacements: [{position: [0, 0, 0], rotation: [0, 0, 0]}]
            // // },
            //


            'VisonRun': {
                id: 'VisonRun',
                path: '/models/primary/Vison.glb',
                scale: [10, 10, 10],
                interactive: false,
                useTextures: false,
                defaultPlacements: [{
                    position: [-33.943, 0, 45.149],
                    rotation: [0, 0, 0]
                }],
                animations: {
                    'run': {
                        animationName: 'animation_0', // Nom correct basé sur les logs
                        autoplay: false,
                        loop: true,
                        loopCount: 1,
                        timeScale: 1.0,
                        clampWhenFinished: false,
                        fadeInDuration: 0.1,
                        fadeOutDuration: 0.1,
                        weight: 0.8
                    }
                },
                // defaultAnimations: ['run'],
                animationTriggers: {
                    'subtitle-changed': {
                        animation: 'run',
                        options: {
                            timeScale: 1,
                            loopCount: 1
                        }
                    },
                }
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
                scale: [0.605, 0.605, 0.605],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.LONG_PRESS,
                    text: "Maintiens",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "image",
                    chapterDistance: 0.5,
                    requiredStep: 'initialStartStop',
                    // Ajouter cette fonction callback pour jouer la narration et afficher l'interface image
                    onInteract: () => {
                        console.log("Long press sur le panneau d'information - lancement narration et interface image");
                        // Jouer la narration
                        if (window.narrationManager && typeof window.narrationManager.playNarration === 'function') {
                            window.narrationManager.playNarration('Scene02_PanneauInformation');
                        }

                        // Afficher l'interface image
                        const store = useStore.getState();
                        if (store.interaction && typeof store.interaction.setShowImageInterface === 'function') {
                            store.interaction.setShowImageInterface(true, '/images/Panneau_Info.png');
                        }
                    }
                }],
                defaultPlacement: {
                    position: [-6.7116, 0, 11.35076],
                    rotation: [0, 179.5 + 53.97781, 0],
                    scale: [0.60463, 0.60463, 0.60463],
                    outlinePulse: false,
                }
            },

            // initialStop au click -> progression dans la timeline pour rotation de la camera vers le panneau + zoom caméra sur le panneau
            // intialStopEnd au maintient -> dézoom caméra sur le panneau + progression dans la timeline pour rotation de la caméra vers le chemin

            /**
             * SCÈNE 03 - OBSTACLE DU TRONC D'ARBRE
             * Apprentissage du mouvement vertical
             * Déclencheur: DRAG DE BAS EN HAUT "Saute au-dessus"
             * Effet: Animation de saut par-dessus l'obstacle
             */
            'TrunkLargeInteractive': {
                id: 'TrunkLarge',
                path: '/models/forest/tree/ObstacleTree.glb',
                scale: [1.000, 1.000, 1.000],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Tire",
                    offset: -0.5,
                    axis: "y",
                    interfaceToShow: "none", //TODO: faire un énumérateur pour les interfaces
                    chapterDistance: 0.6,
                    requiredStep: 'firstStop'
                }],
                defaultPlacement: {
                    position: [1.833, 0, -11.911], rotation: [0, 0, 0], outlinePulse: false,
                }
            }, // firstStop au drag -> progression dans la timeline pour animation de saut par dessus du tronc

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
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.5,
                    requiredStep: 'thirdStop'
                }],
                defaultPlacement: {
                    scale: [1, 1, 1],
                    position: [-6.905, 0.05, -55.498], rotation: [0, 0, 0]
                }
            },
            'AnimalPaws': {
                id: 'AnimalPaws',
                path: '/models/primary/AnimalPaws.glb',
                scale: [0.13031, 0.13031, 0.13031],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.CLICK,
                    text: "Clique",

                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "scanner",
                    chapterDistance: 0.5,
                    requiredStep: 'fifthStop'
                }],
                defaultPlacement: {
                    position: [-6.92739, 0.03838, -55.54513],
                    rotation: [0, 24.64264, 0],
                    scale: [1.3031, 1.3031, 1.3031],
                }
            }, // fifthStop au click -> apparition de l'overlay de scanner + progression dans la timeline pour rotation de la caméra vers les empreintes
            // fifthStopEnd au maintient -> disparition de l'overlay de scanner + progression dans la timeline pour rotation de la caméra vers le chemin

            /**
             * SCÈNE 05 - TRAVERSÉE DE LA RIVIÈRE
             * Puzzle spatial avec progression séquentielle
             * Déclencheur: 4 CLICKS SUCCESSIFS sur chaque pierre "Saute sur la pierre"
             * Effet: Animation de saut sur chaque pierre pour traverser la rivière
             */
            'JumpRock1': {
                id: 'RockWater',
                path: '/models/rock/RockWater.glb',
                scale: [0.279, 0.279, 0.279],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Tire",

                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.5,
                    requiredStep: 'eleventhStop'
                }],
                defaultPlacement: {
                    position: [-30.164, 0, -75.977], rotation: [0, 0, 0], outlinePulse: false
                }
            },

            'JumpRock2': {
                id: 'RockWater',
                path: '/models/rock/RockWater2.glb',
                scale: [0.279, 0.279, 0.279],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Tire",

                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.7,
                    requiredStep: 'twelfthStop'
                }],
                defaultPlacement: {
                    position: [-30.137, 0, -76.954], rotation: [0, 0, 0], outlinePulse: false
                }
            },

            'JumpRock3': {
                id: 'RockWater',
                path: '/models/rock/RockWater.glb',
                scale: [0.279, 0.279, 0.279],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Tire",

                    offset: 0.6,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.5,
                    requiredStep: 'thirteenthStop'
                }],
                defaultPlacement: {
                    position: [-31.319, 0, -76.848], rotation: [0, 0, 0], outlinePulse: false
                }
            },

            'JumpRock4': {
                id: 'RockWater',
                path: '/models/rock/RockWater2.glb',
                scale: [0.279, 0.279, 0.279],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Tire",

                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 1.5,
                    requiredStep: 'fourteenthStop'
                }],
                defaultPlacement: {
                    position: [-31.648, 0, -77.683], rotation: [0, 0, 0], outlinePulse: false
                }
            },
            /**
             * SCÈNE 06 - OBSTACLE DE LA BRANCHE
             * Apprentissage du mouvement vertical inverse
             * Déclencheur: DRAG HAUT-BAS "Passe en-dessous"
             * Effet: Animation de passage sous la branche
             */
            'ThinTrunkInteractive': {
                id: 'TrunkLarge',
                path: '/models/forest/tree/Obstacle2Tree.glb',
                scale: [1, 1, 1],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DRAG_DOWN,
                    text: "Tire",
                    offset: -0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.6,
                    requiredStep: 'fourthStop'
                }],
                defaultPlacement: {
                    position: [-41.732, 0.05, -115.572], rotation: [0.0, -0.60, -0.075], outlinePulse: false
                }
            }, // fourthStop au drag -> progression dans la timeline pour animation de passage sous la branche
            'BigRock': {
                id: 'BigRock',
                path: '/models/rock/BigRock.glb',
                scale: [0.12371, 0.12371, 0.12371],
                interactive: false,
                useTextures: true,
                defaultPlacements: [{
                    position: [-42.79226, 0.06409, -116.47688],
                    rotation: [-3.14159, -52.79977, -3.14159],
                    scale: [0.1371, 0.1371, 0.1371],
                }]
            },
            'TreeStump': {
                id: 'TreeStump', path: '/models/forest/tree/TreeStump.glb', // scale: [0.108, 0.07866, 0.108],
                interactive: false, useTextures: true, defaultPlacements: [{
                    position: [-41.25625, 0.06409, -115.15076],
                    rotation: [-3.14159, 40.80581, -3.14159],
                    scale: [0.07507, 0.07507, 0.07507],
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
                scale: [1, 1, 1],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.DISABLE,
                    text: "Maintiens",
                    offset: -0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.3,
                    requiredStep: 'seventeenStop'
                }],
                defaultPlacement: {
                    // position: [0.42004, -0.70173, -141.44714],
                    position: [0.1004, -0.70173, -141.54714],
                    // position: [0.108, -0.702, -141.176],
                    // position: [-39.47393, 0.2628, 83.18371],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                }
            },


            /**
             * Scène 08: Découverte du vison mort
             *  - Animation automatique d'éclairage révélant le vison
             *  - CLICK "Immortalise le moment" pour prendre photo
             *  - Flash d'appareil photo et transition vers scène suivante
             */




            'Vison': {
                id: 'Vison',
                path: '/models/primary/AnimalVisonMortV1.glb',
                scale: [0.04874, 0.04874, 0.04874],
                interactive: true,
                useTextures: false,
                interaction: [{
                    type: INTERACTION_TYPES.CLICK,
                    text: "Clique",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "capture",
                    chapterDistance: 0.28,
                    requiredStep: 'sixthStop'
                }],
                defaultPlacement: {
                    position: [51.67054, 0.04409, -134.37912],
                    rotation: [-3.14159, 25.90977, -3.14159],
                    scale: [1, 1, 1],
                    outlinePulse: false,
                }
            },


            //
            // 'VisonRun': {
            //     id: 'VisonRun',
            //     path: '/models/primary/VisonRun.glb',
            //     scale: [0.04874, 0.04874, 0.04874],
            //     interactive: true,
            //     useTextures: false,
            //     interaction: [{
            //         type: INTERACTION_TYPES.CLICK,
            //         text: "Clique",
            //         offset: 0.5,
            //         axis: "y",
            //         interfaceToShow: "capture",
            //         chapterDistance: 0.28,
            //         requiredStep: 'sixthStop'
            //     }],
            //     defaultPlacement: {
            //         position: [51.67054, 0.04409, -134.37912],
            //         rotation: [-3.14159, 25.90977, -3.14159],
            //         scale: [1, 1, 1],
            //         outlinePulse: false,
            //     }
            // },

            'DataCenter': {
                id: 'DataCenter', path: '/models/digital/DataCenter.glb',
                interactive: false, useTextures: true, defaultPlacements: [{
                    position: [66.95818, -0.50182, -123.19365],
                    rotation: [-3.14159, -54.12542, -3.14159],
                    scale: [1.79768, 1.79768, 1.79768],
                }]
                //todo: ajouter DataCenter au groupe Screen et trigger à la fin
            },
            // 'Vison': {
            //     id: 'Vison',
            //     path: '/models/primary/AnimalVisonMortV1.glb',
            //     scale: [0.07888, 0.07888, 0.07888],
            //     interactive: true,
            //     useTextures: true,
            //     interaction: [{
            //         type: INTERACTION_TYPES.CLICK,
            //         text: "Immortaliser le moment",
            //         offset: 0.5,
            //         axis: "y",
            //         interfaceToShow: "none",
            //         chapterDistance: 0.01,
            //         requiredStep: 'sixthStop'
            //     }],
            //     // animations: {
            //     //     // Tester plusieurs variations possibles du nom de l'animation
            //     //     'action': {
            //     //         autoplay: true, defaultLoop: true, defaultClamp: false, defaultTimeScale: 1.0
            //     //     }, 'Action': {
            //     //         autoplay: true, defaultLoop: true, defaultClamp: false, defaultTimeScale: 1.0
            //     //     }, 'Action.001': {
            //     //         autoplay: true, defaultLoop: true, defaultClamp: false, defaultTimeScale: 1.0
            //     //     }, 'Action.001.001': {
            //     //         autoplay: true, defaultLoop: true, defaultClamp: false, defaultTimeScale: 1.0
            //     //     }, // Ajouter cette variante au cas où
            //     //     '*': {
            //     //         autoplay: true, defaultLoop: true, defaultClamp: false, defaultTimeScale: 1.0
            //     //     }
            //     // },
            //     defaultPlacements: [{
            //         position: [52.11705, 0, -129.83212],
            //         rotation: [-3.14159, 67.09271, -3.14159],
            //         scale: [0.07888, 0.07888, 0.07888],
            //         outlinePulse: false,
            //     }]
            // },
            // sixthStop au click -> apparition de l'overlay de camera + progression dans la timeline pour rotation de la caméra vers le vison + zoom sur le vison
            // sixthStopEnd au click -> voile blanc sur tout l'écran + disparition de l'overlay de camera + dézoom de la camera + progression dans la timeline pour rotation de la caméra vers le chemin + caché le groupe de mesh End + afficher le groupe de mesh Screen
            /**
             * SCÈNE 09 & 10 - RÉVÉLATION FINALE ET APPEL À L'ACTION
             * Scène 09: Clairière digitalisée avec panneau interactif
             *  - CLICK "Récupérer votre facture" sur panneau directionnel digital
             *  - Affichage de la facture écologique avec narration de Célia
             *  - CLICK MAINTENU "Quitte le panneau" pour fermer l'interface
             * Scène 10: Actualité fantasmée et CTA final
             *  - CLICK MAINTENU "Allume la radio" pour entendre les actualités
             *  - CLICK sur CTA final "Je veux en savoir plus" pour redirection externe
             */
            'DigitalDirectionPanelEndInteractive': {
                id: 'DigitalDirectionPanel',
                path: '/models/primary/DigitalDirectionPanel.glb',
                scale: [0.55, 0.55, 0.55],
                interactive: true,
                useTextures: true,
                interaction: [{
                    type: INTERACTION_TYPES.LONG_PRESS,
                    text: "Maintiens",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.1,
                    requiredStep: 'tenthStop',
                    // Ajouter cette fonction callback pour jouer la narration dès l'interaction
                    onInteract: () => {
                        console.log("Long press sur le panneau digital - lancement narration");
                        narrationManager.playNarration('Scene09_ClairiereDigitalisee');
                    }
                }, {
                    type: INTERACTION_TYPES.LONG_PRESS,
                    text: "Maintiens",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.5,
                    requiredStep: 'tenthStopEnd'
                }],
                defaultPlacement: {
                    position: [55.10253, 0, -134.2177],
                    rotation: [0, 135 + 58.43814, 0],
                    scale: [0.55, 0.55, 0.55],
                    outlinePulse: false,
                }
            },
            // tenthStopEnd au maintient -> dézoom sur le panneau + progression dans la timeline pour rotation de la caméra vers le chemin


            'RadioInteractive': {
                id: 'Radio',
                path: '/models/primary/Radio.glb',
                interactive: true,
                useTextures: false,
                scale: [0.13, 0.13, 0.13],
                interaction: [{
                    type: INTERACTION_TYPES.LONG_PRESS, // Long press plutôt que click simple pour "Allumer la radio"
                    text: "Maintiens",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "blackScreen",
                    requiredStep: 'seventhStop',
                }],
                defaultPlacement: {
                    position: [56.50845, 0, -131.60712],
                    rotation: [-3.09, 270 + 55.03315, -3.10794],
                    scale: [0.13, 0.13, 0.13],
                }
            }
        };

        // Liste des placements d'objets dans la scène
        this.placements = [];

        // Initialiser les placements par défaut et le système d'animation
        this._initializeDefaultPlacements();
        this.initializeAnimationSystem();

        // Différer la configuration des écouteurs d'événements pour éviter les problèmes
        // lorsque EventBus n'est pas encore complètement initialisé
        setTimeout(() => {
            console.log('🕒 Configuration différée des écouteurs d\'événements...');
            this._setupEventListeners();
            this._setupAutomaticEventTriggers();


        }, 500);
    }

    /**
     * Configure automatiquement les écouteurs d'événements pour tous les triggers d'animation
     * définis dans le catalogue d'objets
     * @private
     */
    _setupAutomaticEventTriggers() {
        console.log('🔄 Configuration automatique des écouteurs d\'événements pour les animations...');

        // ⚠️ VÉRIFICATION : S'assurer que EventBus est défini
        if (!EventBus || typeof EventBus.on !== 'function') {
            console.error('❌ EventBus non disponible ou méthode "on" manquante! Réessai planifié...');

            // Planifier une nouvelle tentative dans 500ms
            setTimeout(() => {
                if (EventBus && typeof EventBus.on === 'function') {
                    console.log('✅ EventBus maintenant disponible, reprise de la configuration...');
                    this._setupAutomaticEventTriggers();
                } else {
                    console.error('❌ EventBus toujours non disponible après délai');
                }
            }, 500);

            // Créer un mappeur vide pour éviter d'autres erreurs
            this.autoEventMappings = {};
            return;
        }

        // Stocker tous les mappages événement → [objet, trigger] pour le débogage
        const mappings = {};

        // Parcourir tout le catalogue d'objets
        Object.entries(this.objectCatalog).forEach(([objectKey, config]) => {
            // Vérifier si l'objet a des triggers d'animation définis
            if (config.animationTriggers) {
                // Pour chaque trigger d'animation défini
                Object.keys(config.animationTriggers).forEach(triggerName => {
                    // Éviter de dupliquer les écouteurs pour le même événement
                    if (!mappings[triggerName]) {
                        mappings[triggerName] = [];

                        // Créer l'écouteur d'événement avec meilleure gestion des erreurs
                        const eventListener = (data) => {
                            console.log(`📢 Événement "${triggerName}" reçu avec données:`, data);

                            // Pour chaque objet qui a un trigger correspondant à cet événement,
                            // déclencher l'animation associée
                            mappings[triggerName].forEach(([objKey, triggerConfig]) => {
                                try {
                                    console.log(`  → Déclenchement animation "${triggerConfig.animation}" sur "${objKey}"`);
                                    this.triggerAnimationByEvent(objKey, triggerName, data || {});
                                } catch (error) {
                                    console.error(`Erreur lors du déclenchement de l'animation via l'événement "${triggerName}" pour l'objet "${objKey}":`, error);
                                }
                            });
                        };

                        // ⚠️ VÉRIFICATION SUPPLÉMENTAIRE avant d'ajouter l'écouteur
                        try {
                            EventBus.on(triggerName, eventListener);
                            console.log(`👂 Écouteur automatique créé pour l'événement "${triggerName}"`);
                        } catch (error) {
                            console.error(`❌ Erreur lors de la création de l'écouteur pour "${triggerName}":`, error);
                        }
                    }

                    // Ajouter ce mapping à notre liste
                    mappings[triggerName].push([objectKey, config.animationTriggers[triggerName]]);

                    console.log(`🔗 Animation "${config.animationTriggers[triggerName].animation}" de l'objet "${objectKey}" liée à l'événement "${triggerName}"`);
                });
            }
        });

        // Stocker les mappages pour référence et débogage
        this.autoEventMappings = mappings;

        // Résumé du nombre de mappages créés
        const totalEvents = Object.keys(mappings).length;
        const totalMappings = Object.values(mappings).reduce((acc, val) => acc + val.length, 0);
        console.log(`✅ ${totalEvents} événements automatiquement liés à ${totalMappings} animations`);


    }

    /**
     * Initialise le système d'animation intégré de manière synchronisée
     */
    initializeAnimationSystem() {
        // Vérifier si le ModelAnimationManager est prêt
        if (!modelAnimationManager.initialized) {
            modelAnimationManager.init();
        }

        // Ajouter les associations d'animations depuis notre catalogue
        Object.entries(this.objectCatalog).forEach(([objectKey, config]) => {
            if (config.animations) {
                const animationAssociation = {
                    modelId: config.id,
                    animations: config.animations,
                    defaultAnimations: config.defaultAnimations || []
                };

                modelAnimationManager.addModelAnimationAssociation(config.id, animationAssociation);
                console.log(`🎭 Association d'animation ajoutée pour ${config.id}`);
            }
        });

        // Configurer les écouteurs d'événements d'animation
        this._setupAnimationEventListeners();

        this.animationSystemReady = true;
        console.log('✅ Système d\'animation intégré initialisé et synchronisé');

        // Exposer globalement pour les tests
        if (typeof window !== 'undefined') {
            window.sceneObjectManager = this;
        }
    }

    /**
     * Configure les écouteurs d'événements pour les triggers d'animation
     * Version modifiée pour être compatible avec la liaison automatique
     */
    _setupAnimationEventListeners() {
        // Écouteur principal pour les triggers d'animation explicites
        safeEventBus().on('trigger_animation', this._handleAnimationTrigger.bind(this));

        // Écouteur pour les changements de position de timeline
        safeEventBus().on('timeline-position-changed', (data) => {
            this._handleTimelineTriggers(data.position);
        });

        // Écouteur pour force-local-animation (pour contourner les problèmes de chaîne d'événements)
        safeEventBus().on('force-local-animation', (data) => {
            console.log(`📢 Événement force-local-animation reçu par SceneObjectManager:`, data);
        });
    }

    /**
     * Gère les triggers d'animation de manière synchronisée
     */
    _handleAnimationTrigger(data) {
        const { objectKey, trigger, options = {} } = data;

        console.log(`🎬 Trigger d'animation: ${objectKey} -> ${trigger}`);

        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig || !objectConfig.animationTriggers) {
            console.warn(`Aucun trigger d'animation trouvé pour ${objectKey}:${trigger}`);
            return;
        }

        const triggerConfig = objectConfig.animationTriggers[trigger];
        if (!triggerConfig) {
            console.warn(`Trigger "${trigger}" non trouvé pour l'objet "${objectKey}"`);
            return;
        }

        // Utiliser le ModelAnimationManager pour jouer l'animation
        if (triggerConfig.sequence) {
            safeEventBus().trigger(ANIMATION_EVENTS.PLAY_ANIMATION_SEQUENCE, {
                modelId: objectConfig.id,
                sequence: triggerConfig.sequence.map(step => ({
                    ...step,
                    options: {
                        ...step.options,
                        ...options
                    }
                }))
            });
        } else {
            safeEventBus().trigger(ANIMATION_EVENTS.MODEL_ANIMATION_START, {
                modelId: objectConfig.id,
                animationKey: triggerConfig.animation,
                options: {
                    ...triggerConfig.options,
                    ...options
                }
            });

            // AJOUT: Déclencher également via l'événement direct pour plus de fiabilité
            const animConfig = objectConfig.animations[triggerConfig.animation];
            if (animConfig) {
                safeEventBus().trigger('force-local-animation', {
                    objectKey: objectKey,
                    modelId: objectConfig.id,
                    animationName: animConfig.animationName,
                    options: {
                        ...animConfig,
                        ...triggerConfig.options,
                        ...options
                    }
                });
            }
        }
    }

    /**
     * Déclenche une animation par événement
     */
    triggerAnimationByEvent(objectKey, trigger, options = {}) {
        if (!this.animationSystemReady) {
            console.warn(`Système d'animation pas encore prêt, trigger reporté: ${objectKey} -> ${trigger}`);
            setTimeout(() => this.triggerAnimationByEvent(objectKey, trigger, options), 100);
            return;
        }

        // Déclencher via l'événement standard
        safeEventBus().trigger('trigger_animation', {
            objectKey,
            trigger,
            options
        });

        // AJOUT: Déclencher également via l'événement direct pour plus de fiabilité
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (objectConfig && objectConfig.animations && objectConfig.animationTriggers &&
            objectConfig.animationTriggers[trigger]) {

            const triggerConfig = objectConfig.animationTriggers[trigger];
            const animationName = triggerConfig.animation;

            if (animationName && objectConfig.animations[animationName]) {
                const animConfig = objectConfig.animations[animationName];

                // Déclencher via événement force-local-animation pour StaticObject
                safeEventBus().trigger('force-local-animation', {
                    objectKey: objectKey,
                    modelId: objectConfig.id,
                    animationName: animConfig.animationName,
                    options: {
                        ...animConfig,
                        ...triggerConfig.options,
                        ...options
                    }
                });

                console.log(`💪 Animation déclenchée par double mécanisme: ${objectKey} -> ${animationName}`);
            }
        }
    }

    /**
     * Force le déclenchement manuel d'une animation pour un objet spécifique
     * Utile pour déboguer les animations qui ne se déclenchent pas automatiquement
     * @param {string} objectKey - Clé de l'objet à animer (ex: 'VisonRun')
     * @param {string} animationName - Nom de l'animation à jouer (ex: 'run')
     * @param {Object} options - Options d'animation (timeScale, loopCount, etc.)
     */
    forceAnimation(objectKey, animationName, options = {}) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig) {
            console.error(`❌ Objet "${objectKey}" non trouvé dans le catalogue`);
            return false;
        }

        if (!objectConfig.animations || !objectConfig.animations[animationName]) {
            console.error(`❌ Animation "${animationName}" non trouvée dans l'objet "${objectKey}"`);
            return false;
        }

        const modelId = objectConfig.id;
        console.log(`🔥 FORCE ANIMATION: ${objectKey}(${modelId}) -> ${animationName} avec options:`, options);

        // Fusionner les options
        const animConfig = objectConfig.animations[animationName];
        const mergedOptions = {
            ...animConfig,
            ...options
        };

        // 1. Déclencher via ModelAnimationManager
        safeEventBus().trigger(ANIMATION_EVENTS.MODEL_ANIMATION_START, {
            modelId: modelId,
            animationKey: animationName,
            options: mergedOptions
        });

        // 2. Déclencher également via l'événement direct
        safeEventBus().trigger('force-local-animation', {
            objectKey: objectKey,
            modelId: modelId,
            animationName: animConfig.animationName,
            options: mergedOptions
        });

        return true;
    }

    /**
     * Retrigger explicitement tous les mappages pour un événement spécifique
     * Utile pour redéclencher des animations qui n'ont pas fonctionné
     * @param {string} eventName - Nom de l'événement à redéclencher
     * @param {Object} data - Données d'événement
     */
    retriggerEvent(eventName, data = {}) {
        if (!this.autoEventMappings || !this.autoEventMappings[eventName]) {
            console.warn(`⚠️ Aucun mappage trouvé pour l'événement "${eventName}"`);
            return false;
        }

        console.log(`🔄 RETRIGGER EVENT: "${eventName}" avec ${this.autoEventMappings[eventName].length} mappages`);

        // Déclencher manuellement toutes les animations associées à cet événement
        this.autoEventMappings[eventName].forEach(([objectKey, triggerConfig]) => {
            const objectConfig = this.getObjectFromCatalog(objectKey);
            if (!objectConfig) return;

            console.log(`  → Déclenchement forcé: ${objectKey} - animation "${triggerConfig.animation}"`);

            // Fusionner les options configurées avec les données d'événement
            const options = {
                ...triggerConfig.options,
                ...data
            };

            // Déclencher directement l'animation sans passer par le système de triggers
            this.forceAnimation(objectKey, triggerConfig.animation, options);
        });

        return true;
    }

    /**
     * Diagnostique les problèmes d'animation pour un objet spécifique
     * @param {string} objectKey - Clé de l'objet à diagnostiquer
     */
    diagnoseAnimationIssue(objectKey) {
        console.group(`🔍 DIAGNOSTIC ANIMATION: ${objectKey}`);

        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig) {
            console.error(`❌ Objet "${objectKey}" non trouvé dans le catalogue`);
            console.groupEnd();
            return;
        }

        console.log(`📋 Configuration de l'objet:`, {
            id: objectConfig.id,
            interactive: objectConfig.interactive,
            animationSystemReady: this.animationSystemReady,
            modelRegistered: this.registeredModels.size > 0 && Array.from(this.registeredModels).some(id => id.startsWith(objectConfig.id))
        });

        if (!objectConfig.animations) {
            console.warn(`⚠️ Aucune animation définie pour "${objectKey}"`);
        } else {
            console.log(`📊 Animations disponibles:`, Object.keys(objectConfig.animations));
        }

        if (!objectConfig.animationTriggers) {
            console.warn(`⚠️ Aucun trigger d'animation défini pour "${objectKey}"`);
        } else {
            console.log(`🔌 Triggers définis:`, Object.keys(objectConfig.animationTriggers));

            // Vérifier si les triggers sont correctement enregistrés dans les mappages
            Object.keys(objectConfig.animationTriggers).forEach(triggerName => {
                const isRegistered = this.autoEventMappings &&
                    this.autoEventMappings[triggerName] &&
                    this.autoEventMappings[triggerName].some(([key]) => key === objectKey);

                console.log(`  → Trigger "${triggerName}": ${isRegistered ? '✅ enregistré' : '❌ non enregistré'}`);
            });
        }

        // Vérifier les placements
        const placements = this.getPlacements({objectKey});
        console.log(`📍 Placements: ${placements.length} trouvés`);

        console.groupEnd();
    }



    /**
     * Gère les triggers basés sur la timeline
     */
    _handleTimelineTriggers(position) {
        Object.entries(this.objectCatalog).forEach(([objectKey, config]) => {
            if (config.timelineTriggers) {
                Object.entries(config.timelineTriggers).forEach(([timelinePos, triggerData]) => {
                    const triggerPosition = parseFloat(timelinePos);

                    if (Math.abs(position - triggerPosition) < 0.5) {
                        console.log(`Timeline trigger activé: ${objectKey} à position ${triggerPosition}`);
                        this.triggerAnimationByEvent(objectKey, triggerData.trigger, triggerData.options || {});
                    }
                });
            }
        });
    }

    /**
     * Enregistre un modèle chargé avec ses animations de manière synchronisée
     */
    registerLoadedModelWithAnimations(objectKey, modelObject, gltf) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig) return;

        // Créer un identifiant unique pour éviter les doublons
        const registrationKey = `${objectConfig.id}-${modelObject.uuid}`;

        if (this.registeredModels.has(registrationKey)) {
            console.log(`🔄 Modèle ${objectConfig.id} déjà enregistré, ignoré`);
            return;
        }

        // Marquer comme en cours d'enregistrement
        this.registeredModels.add(registrationKey);

        // Extraire les animations du GLTF
        const animations = gltf.animations || [];

        console.log(`🎭 Enregistrement du modèle ${objectConfig.id} avec ${animations.length} animations`);

        // Log des animations pour débogage
        animations.forEach((clip, index) => {
            console.log(`  📽️ Animation ${index}: "${clip.name}" (${clip.duration.toFixed(2)}s)`);
        });

        // Enregistrer auprès du ModelAnimationManager de manière synchronisée
        // ⚠️ NE PAS déclencher les animations par défaut ici
        // Elles sont maintenant gérées localement dans StaticObject
        if (this.animationSystemReady) {
            modelAnimationManager.registerModel(objectConfig.id, modelObject, animations);
            console.log(`✅ Modèle ${objectConfig.id} enregistré (animations gérées localement)`);
        } else {
            // Attendre que le système soit prêt
            setTimeout(() => {
                if (this.animationSystemReady) {
                    modelAnimationManager.registerModel(objectConfig.id, modelObject, animations);
                    console.log(`✅ Modèle ${objectConfig.id} enregistré (différé)`);
                }
            }, 100);
        }
    }

    /**
     * Arrête une animation spécifique
     */
    stopAnimation(objectKey, animationKey) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig) return;

        safeEventBus().trigger(ANIMATION_EVENTS.MODEL_ANIMATION_STOP, {
            modelId: objectConfig.id,
            animationKey
        });
    }

    /**
     * Arrête toutes les animations d'un objet
     */
    stopAllAnimationsForObject(objectKey) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig) return;

        safeEventBus().trigger(ANIMATION_EVENTS.STOP_ALL_ANIMATIONS, {
            modelId: objectConfig.id
        });
    }

    handleThirdStopCompletion() {
        console.log('*** Exécution de handleThirdStopCompletion ***');

        const leafPlacements = this.getPlacements({objectKey: 'MultipleLeaf'});
        console.log('Placements MultipleLeaf trouvés:', leafPlacements);

        if (leafPlacements && leafPlacements.length > 0) {
            const leafPlacement = leafPlacements[0];
            const currentPosition = [...leafPlacement.position];
            console.log('Position actuelle de MultipleLeaf:', currentPosition);

            const newPosition = [
                currentPosition[0] + 0.5,
                currentPosition[1] + 0.1,
                currentPosition[2] - 0.02
            ];

            console.log(`Déplacement de MultipleLeaf de [${currentPosition}] à [${newPosition}]`);

            let identifier;
            if (leafPlacement.markerId) {
                identifier = leafPlacement.markerId;
            } else {
                const index = this.placements.findIndex(p =>
                    p.objectKey === 'MultipleLeaf' &&
                    p.position[0] === currentPosition[0] &&
                    p.position[2] === currentPosition[2]
                );

                if (index !== -1) {
                    identifier = index;
                } else {
                    console.warn('Impossible de trouver un identifiant valide pour la mise à jour');
                    return;
                }
            }

            const updateResult = this.updatePlacement(identifier, {
                position: newPosition
            });

            console.log('Résultat de la mise à jour:', updateResult);

            // Déclencher l'animation de dispersion des feuilles
            this.triggerAnimationByEvent('MultipleLeaf', 'leaves_scattered');

            safeEventBus().trigger('object-position-updated', {
                objectKey: 'MultipleLeaf',
                oldPosition: currentPosition,
                newPosition: newPosition
            });
        } else {
            console.warn('Objet MultipleLeaf non trouvé lors de la complétion de thirdStop');
        }
    }

    getChapterDistance(stepId) {
        const placements = this.getInteractivePlacements({requiredStep: stepId});

        if (placements.length > 0) {
            const objectKey = placements[0].objectKey;
            const objectConfig = this.getObjectFromCatalog(objectKey);

            if (objectConfig && objectConfig.interaction) {
                if (Array.isArray(objectConfig.interaction)) {
                    const matchingInteraction = objectConfig.interaction.find(interaction =>
                        interaction.requiredStep === stepId);

                    if (matchingInteraction) {
                        if (matchingInteraction.chapterDistance === "none" ||
                            matchingInteraction.chapterDistance === 0 ||
                            matchingInteraction.chapterDistance === "0") {
                            console.log(`Distance zéro explicitement configurée pour ${stepId} (${objectKey})`);
                            return 0;
                        }

                        if (matchingInteraction.chapterDistance !== undefined) {
                            return matchingInteraction.chapterDistance;
                        }
                    }
                } else if (objectConfig.interaction.requiredStep === stepId) {
                    if (objectConfig.interaction.chapterDistance === "none" ||
                        objectConfig.interaction.chapterDistance === 0 ||
                        objectConfig.interaction.chapterDistance === "0") {
                        console.log(`Distance zéro explicitement configurée pour ${stepId} (${objectKey})`);
                        return 0;
                    }

                    if (objectConfig.interaction.chapterDistance !== undefined) {
                        return objectConfig.interaction.chapterDistance;
                    }
                }
            }
        }

        return 0;
    }

    _getCurrentInteraction(objectConfig, placement) {
        if (!objectConfig.interaction || !Array.isArray(objectConfig.interaction)) {
            return null;
        }

        if (placement && placement.requiredStep) {
            const matchingInteraction = objectConfig.interaction.find(interaction =>
                interaction.requiredStep === placement.requiredStep
            );

            if (matchingInteraction) {
                console.log(`Interaction trouvée pour ${placement.objectKey} (${placement.requiredStep}):`,
                    matchingInteraction);
                return matchingInteraction;
            } else {
                console.warn(`Aucune interaction trouvée pour ${placement.objectKey} avec requiredStep=${placement.requiredStep}`);
            }
        }

        if (!placement || placement.interactionIndex === undefined) {
            return objectConfig.interaction[0];
        }

        const currentIndex = placement.interactionIndex;

        if (currentIndex >= objectConfig.interaction.length) {
            return objectConfig.interaction[objectConfig.interaction.length - 1];
        }

        return objectConfig.interaction[currentIndex];
    }

    getInteractiveObjectInterfaces() {
        const interfaces = {};

        Object.entries(this.objectCatalog).forEach(([key, config]) => {
            if (config.interactive) {
                if (Array.isArray(config.interaction)) {
                    config.interaction.forEach(interaction => {
                        if (interaction.interfaceToShow) {
                            if (!interfaces[key]) {
                                interfaces[key] = [];
                            }
                            interfaces[key].push({
                                step: interaction.requiredStep,
                                interface: interaction.interfaceToShow
                            });
                        }
                    });
                } else if (config.interaction && config.interaction.interfaceToShow) {
                    interfaces[key] = [{
                        step: config.interaction.requiredStep,
                        interface: config.interaction.interfaceToShow
                    }];
                }
            }
        });

        console.log("Interfaces disponibles dans les objets interactifs:", interfaces);
        return interfaces;
    }

    // Attribue automatiquement une étape en fonction de l'ordre des objets
    _getNextStep() {
        if (this.interactiveObjectsCount < this.interactionSteps.length) {
            const step = this.interactionSteps[this.interactiveObjectsCount];
            this.interactiveObjectsCount++;
            return step;
        }

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
        if (requiredStep && this.stepTexts[requiredStep]) {
            return this.stepTexts[requiredStep];
        }

        if (defaultText) {
            return defaultText;
        }

        const objectName = objectKey.replace(/Interactive$/, '');
        return `Examiner ${objectName.toLowerCase()}`;
    }

    // Initialiser les placements par défaut à partir du catalogue
    _initializeDefaultPlacements() {
        this.interactiveObjectsCount = 0;

        Object.entries(this.objectCatalog).forEach(([key, config]) => {
            if (config.interactive && config.defaultPlacement) {
                if (Array.isArray(config.interaction) && config.interaction.length > 0) {
                    config.interaction.forEach((interaction, index) => {
                        let requiredStep = interaction.requiredStep;
                        requiredStep = requiredStep || config.defaultPlacement.requiredStep || this._getNextStep();

                        const markerId = config.defaultPlacement.markerId || this._generateMarkerId(key, requiredStep);
                        let markerText = interaction.text || config.defaultPlacement.markerText || this._generateMarkerText(key, requiredStep, null);

                        this.addPlacement(key, config.defaultPlacement.position, {
                            rotation: config.defaultPlacement.rotation || [0, 0, 0],
                            markerId: markerId,
                            markerText: markerText,
                            requiredStep: requiredStep,
                            outlinePulse: config.defaultPlacement.outlinePulse,
                            markerOffset: interaction.offset || config.defaultPlacement.markerOffset,
                            markerAxis: interaction.axis || config.defaultPlacement.markerAxis,
                            interactionIndex: index
                        });
                    });
                } else if (config.interaction && config.interaction.requiredStep) {
                    let requiredStep = config.interaction.requiredStep;
                    requiredStep = requiredStep || config.defaultPlacement.requiredStep || this._getNextStep();

                    const markerId = config.defaultPlacement.markerId || this._generateMarkerId(key, requiredStep);
                    const markerText = config.interaction.text || config.defaultPlacement.markerText || this._generateMarkerText(key, requiredStep, null);

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
                config.defaultPlacements.forEach((placement, index) => {
                    const placementOptions = {
                        rotation: placement.rotation || [0, 0, 0],
                        scale: placement.scale || config.scale,
                        quaternion: placement.quaternion
                    };

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
        safeEventBus().on(MARKER_EVENTS.INTERACTION_COMPLETE, (data) => {
            console.log('Événement INTERACTION_COMPLETE reçu:', data);

            if (data.requiredStep === 'thirdStop' ||
                (data.id && data.id.includes('thirdStop'))) {
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

                if (placement.onInteract && typeof placement.onInteract === 'function') {
                    placement.onInteract(data);
                }

                placement.interacted = true;

                safeEventBus().trigger('object:interaction:complete', {
                    markerId: placement.markerId,
                    objectKey: placement.objectKey,
                    requiredStep: placement.requiredStep,
                    isFinalInteraction: true
                });

                if (placement.requiredStep === 'thirdStop') {
                    console.log('thirdStop completion détectée via placement.requiredStep');
                    this.handleThirdStopCompletion();
                }
            }
        });

        safeEventBus().on('leaf-erable-move-requested', (data) => {
            console.log('Événement leaf-erable-move-requested reçu:', data);
            this.handleThirdStopCompletion();
        });

        safeEventBus().on('INTERACTION_COMPLETE', (data) => {
            console.log('Événement INTERACTION_COMPLETE direct reçu:', data);
            if (data.id === 'thirdStop' || (typeof data.id === 'string' && data.id.includes('thirdStop'))) {
                console.log('thirdStop completion détectée via INTERACTION_COMPLETE direct');
                this.handleThirdStopCompletion();
            }
        });
    }

    // Ajouter un nouvel objet au catalogue
    addObjectToCatalog(key, config) {
        if (this.objectCatalog[key]) {
            console.warn(`Objet ${key} existe déjà dans le catalogue. Il sera remplacé.`);
        }

        const baseConfig = {
            id: config.id || key,
            path: config.path,
            scale: config.scale || [1, 1, 1],
            interactive: config.interactive !== undefined ? config.interactive : false,
            useTextures: config.useTextures !== undefined ? config.useTextures : true
        };

        if (config.interactive) {
            baseConfig.interaction = [{
                type: config.interaction?.type || INTERACTION_TYPES.CLICK,
                text: config.interaction?.text || "Interagir",
                offset: config.interaction?.offset || 1.0,
                axis: config.interaction?.axis || "y",
                interfaceToShow: config.interaction?.interfaceToShow || null
            }];
        } else if (config.defaultPlacements) {
            baseConfig.defaultPlacements = config.defaultPlacements;
        }

        if (config.animations) {
            baseConfig.animations = config.animations;

            const autoplayAnimation = Object.entries(config.animations).find(([name, animConfig]) => animConfig.autoplay === true);

            if (autoplayAnimation) {
                const [animName, animConfig] = autoplayAnimation;

                baseConfig.defaultAnimation = {
                    play: true,
                    name: animName,
                    loop: animConfig.defaultLoop !== undefined ? animConfig.defaultLoop : true,
                    clamp: animConfig.defaultClamp !== undefined ? animConfig.defaultClamp : false,
                    timeScale: animConfig.defaultTimeScale !== undefined ? animConfig.defaultTimeScale : 1.0
                };
            }
        }

        // Ajouter les animationTriggers s'ils existent
        if (config.animationTriggers) {
            baseConfig.animationTriggers = config.animationTriggers;
        }

        this.objectCatalog[key] = baseConfig;

        // Ajouter l'association d'animation si applicable
        if (config.animations && this.animationSystemReady) {
            const animationAssociation = {
                modelId: baseConfig.id,
                animations: config.animations,
                defaultAnimations: baseConfig.defaultAnimations || []
            };

            modelAnimationManager.addModelAnimationAssociation(baseConfig.id, animationAssociation);
        }

        // Si l'objet a des triggers d'animation, les configurer automatiquement
        if (config.animationTriggers && this.autoEventMappings) {
            Object.keys(config.animationTriggers).forEach(triggerName => {
                if (!this.autoEventMappings[triggerName]) {
                    this.autoEventMappings[triggerName] = [];

                    // Créer l'écouteur d'événement
                    safeEventBus().on(triggerName, (data) => {
                        console.log(`📢 Événement "${triggerName}" reçu:`, data);
                        this.autoEventMappings[triggerName].forEach(([objKey, triggerConfig]) => {
                            this.triggerAnimationByEvent(objKey, triggerName, data || {});
                        });
                    });

                    console.log(`👂 Écouteur automatique créé pour le nouvel événement "${triggerName}"`);
                }

                // Ajouter ce mapping à notre liste
                this.autoEventMappings[triggerName].push([key, config.animationTriggers[triggerName]]);

                console.log(`🔗 Animation "${config.animationTriggers[triggerName].animation}" du nouvel objet "${key}" liée à l'événement "${triggerName}"`);
            });
        }

        if (config.interactive && config.defaultPlacement) {
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

        if (options.quaternion) {
            placement.quaternion = options.quaternion;
        } else if (objectConfig.defaultPlacement?.quaternion) {
            placement.quaternion = objectConfig.defaultPlacement.quaternion;
        }

        if (options.animation || objectConfig.defaultAnimation) {
            placement.animation = options.animation || {...objectConfig.defaultAnimation};
        }

        if (objectConfig.interactive) {
            let requiredStep = options.requiredStep;

            if (!requiredStep) {
                if (Array.isArray(objectConfig.interaction) && objectConfig.interaction.length > 0) {
                    requiredStep = objectConfig.interaction[0].requiredStep;
                } else if (objectConfig.interaction && objectConfig.interaction.requiredStep) {
                    requiredStep = objectConfig.interaction.requiredStep;
                }

                requiredStep = requiredStep || objectConfig.defaultPlacement?.requiredStep || this._getNextStep();
            }

            const markerId = options.markerId || this._generateMarkerId(key, requiredStep);

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

            markerText = markerText || this._generateMarkerText(key, requiredStep, null);

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
                interactionIndex: 0
            });
        }

        this.placements.push(placement);
        return placement;
    }

    configureGround(groundObject, useDepthSystem = true) {
        if (!groundObject) {
            console.error("configureGround: objet terrain manquant");
            return false;
        }

        console.log("Configuration du terrain avec système basé sur la hauteur:", groundObject.name || "sans nom");

        if (textureManager) {
            return textureManager.setupGroundBasedOnHeight(groundObject, {
                heightThreshold: 0.15,
                transitionZone: 0.05,
                invertHeight: true
            });
        }

        return false;
    }

    findAndConfigureGround(scene) {
        if (!scene) {
            console.error("findAndConfigureGround: scène manquante");
            return null;
        }

        let groundObject = null;

        scene.traverse((node) => {
            if (node.name === 'Ground' ||
                node.name.toLowerCase().includes('ground') ||
                node.name.toLowerCase().includes('terrain')) {
                groundObject = node;
            }

            if (node.isMesh &&
                node.geometry &&
                node.geometry.attributes.position &&
                node.geometry.attributes.position.count > 1000 &&
                Math.abs(node.position.y) < 0.1) {

                if (!node.geometry.boundingBox) {
                    node.geometry.computeBoundingBox();
                }

                const box = node.geometry.boundingBox;
                if (box) {
                    const width = box.max.x - box.min.x;
                    const depth = box.max.z - box.min.z;
                    const height = box.max.y - box.min.y;

                    if (width > 50 && depth > 50 && height < 10) {
                        groundObject = node;
                    }
                }
            }
        });

        if (groundObject) {
            console.log("Terrain trouvé, configuration automatique avec système basé sur la profondeur...");
            this.configureGround(groundObject);
            return groundObject;
        } else {
            console.warn("Aucun terrain trouvé dans la scène");
            return null;
        }
    }

    async applyTexturesToObject(placement, modelObject) {
        if (!placement || !modelObject) return;

        if (placement.useTextures === false) return;

        if (placement.objectKey === 'Ground') {
            console.log("Détection de l'objet terrain dans applyTexturesToObject");
            return this.configureGround(modelObject, true);
        }

        const modelId = this.getTextureModelId(placement.objectKey);
        if (modelId && textureManager) {
            await textureManager.applyTexturesToModel(modelId, modelObject);
        }
    }

    // Récupérer tous les placements
    getAllPlacements() {
        return this.placements;
    }

    // Récupérer les placements filtrés par critères
    getPlacements(filters = {}) {
        return this.placements.filter(placement => {
            if (filters.objectKey && placement.objectKey !== filters.objectKey) {
                return false;
            }

            if (filters.interactive !== undefined) {
                const objectConfig = this.objectCatalog[placement.objectKey];
                if (!objectConfig || objectConfig.interactive !== filters.interactive) {
                    return false;
                }
            }

            if (filters.requiredStep && placement.requiredStep !== filters.requiredStep) {
                return false;
            }

            if (filters.interacted !== undefined && placement.interacted !== undefined && placement.interacted !== filters.interacted) {
                return false;
            }

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
        let index = -1;

        if (typeof identifier === 'string') {
            index = this.placements.findIndex(p => p.markerId === identifier);
        } else if (typeof identifier === 'number') {
            index = identifier;
        }

        if (index === -1 || index >= this.placements.length) {
            console.error(`Placement avec identifiant "${identifier}" non trouvé.`);
            return false;
        }

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
            index = this.placements.findIndex(p => p.markerId === identifier);
        } else if (typeof identifier === 'number') {
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
        this.placements = [];
        this._initializeDefaultPlacements();
    }

    // Reordonner les étapes d'interaction des objets existants
    reorderInteractionSteps() {
        const interactivePlacements = this.getInteractivePlacements();
        this.interactiveObjectsCount = 0;

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
            if (!assetSet.has(obj.path)) {
                assetSet.add(obj.path);

                assets.push({
                    name: obj.id,
                    type: 'gltf',
                    path: obj.path,
                    license: 'CC-BY',
                    author: 'Author',
                    url: ''
                });
            }
        });

        if (textureManager) {
            const textureAssets = textureManager.generateTextureAssetList();
            assets.push(...textureAssets);
        }

        return assets;
    }

    /**
     * Méthode pour tester si un événement va déclencher des animations
     * @param {string} eventName - Nom de l'événement à tester
     * @param {Object} data - Données optionnelles à passer avec l'événement
     * @returns {SceneObjectManager} - Pour le chaînage
     */
    testEvent(eventName, data = {}) {
        console.log(`🧪 Test de l'événement "${eventName}" avec:`, data);
        safeEventBus().trigger(eventName, data);
        return this;
    }

    /**
     * Méthode pour obtenir tous les mappages événement → animation
     * @returns {Object} - Mappages formatés pour le débogage
     */
    getEventAnimationMappings() {
        if (!this.autoEventMappings) return {};

        // Convertir en format plus lisible pour le débogage
        const result = {};
        Object.entries(this.autoEventMappings).forEach(([eventName, mappings]) => {
            result[eventName] = mappings.map(([objectKey, triggerConfig]) => ({
                objectKey,
                animation: triggerConfig.animation,
                options: triggerConfig.options
            }));
        });

        return result;
    }

    /**
     * Déclenche toutes les animations liées à un événement
     * @param {string} eventName - Nom de l'événement à émettre
     * @param {Object} data - Données optionnelles à passer avec l'événement
     * @returns {SceneObjectManager} - Pour le chaînage
     */
    emitAnimationEvent(eventName, data = {}) {
        console.log(`📢 Émission de l'événement "${eventName}"`);
        safeEventBus().trigger(eventName, data);
        return this;
    }

    /**
     * Méthodes utilitaires pour le débogage
     */

    // Obtient l'état des animations actives
    getActiveAnimationsState() {
        return modelAnimationManager.getActiveAnimations();
    }

    // Obtient la liste des modèles enregistrés
    getRegisteredModels() {
        return modelAnimationManager.getRegisteredModels();
    }

    // Obtient les animations disponibles pour un objet
    getAvailableAnimationsForObject(objectKey) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig || !objectConfig.animations) return [];

        return Object.keys(objectConfig.animations);
    }

    // Obtient les triggers disponibles pour un objet
    getAvailableTriggersForObject(objectKey) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig || !objectConfig.animationTriggers) return [];

        return Object.keys(objectConfig.animationTriggers);
    }

    // Teste une animation (pour le débogage)
    testAnimation(objectKey, animationKey, options = {}) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig) {
            console.error(`Objet "${objectKey}" non trouvé`);
            return;
        }

        if (!objectConfig.animations || !objectConfig.animations[animationKey]) {
            console.error(`Animation "${animationKey}" non trouvée pour l'objet "${objectKey}"`);
            return;
        }

        console.log(`🧪 Test de l'animation: ${objectKey} -> ${animationKey}`);

        safeEventBus().trigger(ANIMATION_EVENTS.MODEL_ANIMATION_START, {
            modelId: objectConfig.id,
            animationKey,
            options
        });
    }

    // Teste un trigger (pour le débogage)
    testTrigger(objectKey, trigger, options = {}) {
        console.log(`🧪 Test du trigger: ${objectKey} -> ${trigger}`);
        this.triggerAnimationByEvent(objectKey, trigger, options);
    }

    // Méthode pour déboguer l'état actuel
    debugState() {
        console.group('🔍 État du SceneObjectManager');
        console.log('Objets du catalogue:', Object.keys(this.objectCatalog));
        console.log('Placements:', this.placements.length);
        console.log('Système d\'animation prêt:', this.animationSystemReady);
        console.log('Modèles enregistrés:', Array.from(this.registeredModels));

        // Afficher les mappages d'événements automatiques
        if (this.autoEventMappings) {
            console.group('Mappages événements → animations:');
            Object.entries(this.autoEventMappings).forEach(([eventName, mappings]) => {
                console.log(`${eventName}: ${mappings.length} animations associées`);
            });
            console.groupEnd();
        }

        console.groupEnd();

        // Déboguer aussi le ModelAnimationManager
        modelAnimationManager.debugState();
    }

    /**
     * 🧪 MÉTHODES DE TEST POUR DÉBOGUER LES ANIMATIONS
     */

    // Teste toutes les animations d'un objet
    testAllAnimations(objectKey) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig || !objectConfig.animations) {
            console.error(`❌ Aucune animation trouvée pour ${objectKey}`);
            return;
        }

        console.group(`🧪 Test de toutes les animations pour ${objectKey}`);

        Object.keys(objectConfig.animations).forEach((animKey, index) => {
            setTimeout(() => {
                console.log(`▶️ Test animation ${index + 1}/${Object.keys(objectConfig.animations).length}: ${animKey}`);
                this.testAnimation(objectKey, animKey);
            }, index * 3000); // 3 secondes entre chaque test
        });

        console.groupEnd();
    }

    // Force le redémarrage d'une animation par défaut
    forceDefaultAnimation(objectKey) {
        const objectConfig = this.getObjectFromCatalog(objectKey);
        if (!objectConfig || !objectConfig.defaultAnimations) {
            console.error(`❌ Aucune animation par défaut pour ${objectKey}`);
            return;
        }

        console.log(`🔄 Force redémarrage animations par défaut pour ${objectKey}`);

        objectConfig.defaultAnimations.forEach(animKey => {
            const animConfig = objectConfig.animations[animKey];
            if (animConfig && animConfig.autoplay) {
                console.log(`🎬 Force animation: ${animKey} -> ${animConfig.animationName}`);

                // Émettre un événement pour forcer l'animation localement
                safeEventBus().trigger('force-local-animation', {
                    modelId: objectConfig.id,
                    animationName: animConfig.animationName,
                    config: animConfig
                });
            }
        });
    }

    // Liste toutes les animations disponibles
    listAllAnimations() {
        console.group('📋 ANIMATIONS DISPONIBLES DANS LE CATALOGUE');

        Object.entries(this.objectCatalog).forEach(([objectKey, config]) => {
            if (config.animations) {
                console.group(`🎭 ${objectKey} (${config.id})`);
                console.log('📁 Animations configurées:');

                Object.entries(config.animations).forEach(([animKey, animConfig]) => {
                    console.log(`  • ${animKey}: "${animConfig.animationName}" ${animConfig.autoplay ? '(AUTO)' : ''}`);
                });

                if (config.defaultAnimations) {
                    console.log('🎯 Animations par défaut:', config.defaultAnimations);
                }

                if (config.animationTriggers) {
                    console.log('🎪 Triggers disponibles:', Object.keys(config.animationTriggers));
                }

                console.groupEnd();
            }
        });

        console.groupEnd();
    }
}

export let sceneObjectManager = new SceneObjectManager();
export default sceneObjectManager;