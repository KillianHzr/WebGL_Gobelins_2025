// SceneObjectManager.js
// Système centralisé pour la gestion des objets individuels dans la scène
// Gère à la fois les objets interactifs et les objets statiques avec leur placement par défaut

import {INTERACTION_TYPES} from '../Utils/EnhancedObjectMarker';
import {EventBus, MARKER_EVENTS} from '../Utils/EventEmitter';
import {textureManager} from './TextureManager';

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
            },
            'Camera': {
                id: 'Camera',
                path: '/models/Camera.glb',
                scale: [1, 1, 1],
                interactive: false,
                useTextures: false,
                defaultPlacements: [{position: [0, 0, 0], rotation: [0, 0, 0]},]
            },
            // 'WaterPlane': {
            //     id: 'WaterPlane',
            //     path: '/models/forest/river/River.glb',
            //     scale: [1, 1, 1],
            //     interactive: false,
            //     useTextures: true,
            //     defaultPlacements: [{position: [0, 0, 0], rotation: [0, 0, 0]}]
            // },

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
                    interfaceToShow: "none",
                    chapterDistance: 0.5,
                    requiredStep: 'initialStartStop',
                    // Ajouter cette fonction callback pour jouer la narration dès l'interaction
                    onInteract: () => {
                        console.log("Long press sur le panneau d'information - lancement narration");
                        narrationManager.playNarration('Scene02_PanneauInformation');
                    }
                }, {
                    type: INTERACTION_TYPES.LONG_PRESS,
                    text: "Maintiens",
                    offset: 0.5,
                    axis: "y",
                    interfaceToShow: "none",
                    chapterDistance: 0.8,
                    requiredStep: 'initialEndStop'
                }],
                defaultPlacement: {
                    position: [-6.7116, 0, 11.35076],
                    rotation: [0, 179.5  + 53.97781, 0],
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
                    rotation: [0,  135 + 58.43814, 0],
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
            // seventhStop au click -> voile noir sur tout l'écran


        };
        // Liste des placements d'objets dans la scène
        this.placements = [];

        // Écouter les événements d'interaction
        this._setupEventListeners();

        // Initialiser les placements par défaut
        this._initializeDefaultPlacements();
    }

    _getCurrentInteraction(objectConfig, placement) {
        if (!objectConfig.interaction || !Array.isArray(objectConfig.interaction)) {
            return null;
        }

        // Si un requiredStep est spécifié dans le placement, chercher l'interaction correspondante
        if (placement && placement.requiredStep) {
            const matchingInteraction = objectConfig.interaction.find(interaction =>
                interaction.requiredStep === placement.requiredStep
            );

            if (matchingInteraction) {
                // Ajouter des logs pour le débogage
                console.log(`Interaction trouvée pour ${placement.objectKey} (${placement.requiredStep}):`,
                    matchingInteraction);
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

        // Logger les interfaces trouvées pour le débogage
        console.log("Interfaces disponibles dans les objets interactifs:", interfaces);
        return interfaces;
    }

    handleThirdStopCompletion() {
        console.log('*** Exécution de handleThirdStopCompletion ***');

        // Trouver l'emplacement de MultipleLeaf avec plus de détails de débogage
        const leafPlacements = this.getPlacements({ objectKey: 'MultipleLeaf' });
        console.log('Placements MultipleLeaf trouvés:', leafPlacements);

        if (leafPlacements && leafPlacements.length > 0) {
            const leafPlacement = leafPlacements[0];

            // Obtenir la position actuelle
            const currentPosition = [...leafPlacement.position];
            console.log('Position actuelle de MultipleLeaf:', currentPosition);

            // Calculer la nouvelle position (décalage de 2.0 sur X et Z)
            const newPosition = [
                currentPosition[0] + 0.5,
                currentPosition[1] + 0.1,
                currentPosition[2] - 0.02
            ];

            console.log(`Déplacement de MultipleLeaf de [${currentPosition}] à [${newPosition}]`);

            // Récupérer l'identifiant du marqueur pour une mise à jour précise
            let identifier;
            if (leafPlacement.markerId) {
                identifier = leafPlacement.markerId;
                console.log('Mise à jour par markerId:', identifier);
            } else {
                // Si markerId n'est pas disponible, utiliser l'index de placement dans le tableau
                const index = this.placements.findIndex(p =>
                    p.objectKey === 'MultipleLeaf' &&
                    p.position[0] === currentPosition[0] &&
                    p.position[2] === currentPosition[2]
                );

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
            const updatedPlacements = this.getPlacements({ objectKey: 'MultipleLeaf' });
            if (updatedPlacements && updatedPlacements.length > 0) {
                console.log('Nouvelle position après mise à jour:', updatedPlacements[0].position);
            }

            // Émettre un événement pour informer les autres composants
            EventBus.trigger('object-position-updated', {
                objectKey: 'MultipleLeaf',
                oldPosition: currentPosition,
                newPosition: newPosition
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
                // Placer plusieurs instances d'objets statiques (inchangé)
                config.defaultPlacements.forEach((placement, index) => {
                    const placementOptions = {
                        rotation: placement.rotation || [0, 0, 0],
                        scale: placement.scale || config.scale,
                        quaternion: placement.quaternion
                    };

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
    // Configurer les écouteurs d'événements
    // Inside the _setupEventListeners method
    _setupEventListeners() {
        // Réagir aux interactions complétées
        EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, (data) => {
            console.log('Événement INTERACTION_COMPLETE reçu:', data);

            // Vérifier directement si c'est l'étape thirdStop, indépendamment du placement
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


    /**
     * Méthode pour intégrer la nouvelle fonction dans le système existant
     * @param {Object} groundObject - L'objet 3D du terrain
     * @param {Object} options - Options de configuration
     */
    configureGround(groundObject, options = {}) {
        if (!groundObject) {
            console.error("configureGround: objet terrain manquant");
            return false;
        }

        // Utiliser la nouvelle méthode avec des paramètres spécifiques
        return textureManager.setupPreciseGround(groundObject, {
            heightThreshold: 0.63,
            transitionZone: 0.02,
            roughness: 0.92,
            metalness: 0.05,
            normalScale: 1.2,
            grassRoughness: 0.98,
            roadRoughness: 0.85
        });
    }

    findAndConfigureGround(scene) {
        if (!scene) {
            console.error("findAndConfigureGround: scène manquante");
            return null;
        }

        let groundObject = null;

        // Chercher l'objet Ground
        scene.traverse((node) => {
            // Recherche par nom
            if (node.name === 'Ground' ||
                node.name.toLowerCase().includes('ground') ||
                node.name.toLowerCase().includes('terrain')) {
                groundObject = node;
            }

            // Si c'est un mesh avec beaucoup de vertices et qu'il est à Y=0
            // (caractéristiques typiques d'un terrain)
            if (node.isMesh &&
                node.geometry &&
                node.geometry.attributes.position &&
                node.geometry.attributes.position.count > 1000 &&
                Math.abs(node.position.y) < 0.1) {

                // Vérifier aussi si c'est large et plat
                if (!node.geometry.boundingBox) {
                    node.geometry.computeBoundingBox();
                }

                const box = node.geometry.boundingBox;
                if (box) {
                    const width = box.max.x - box.min.x;
                    const depth = box.max.z - box.min.z;
                    const height = box.max.y - box.min.y;

                    // Un terrain est généralement beaucoup plus large que haut
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
    // Appliquer les textures à un objet
    /**
     * Applique les textures à un objet, avec un traitement spécial pour le terrain
     * @param {Object} placement - Données de placement de l'objet
     * @param {Object} modelObject - L'objet 3D auquel appliquer les textures
     */
    async applyTexturesToObject(placement, modelObject) {
        if (!placement || !modelObject) return;

        // Vérifier si l'objet doit utiliser des textures
        if (placement.useTextures === false) return;

        // Traitement spécial pour le terrain (Ground)
        if (placement.objectKey === 'Ground') {
            console.log("Détection de l'objet terrain dans applyTexturesToObject");
            // Utiliser la nouvelle méthode basée sur la profondeur
            return this.configureGround(modelObject, true);
        }

        // Traitement standard pour les autres objets
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