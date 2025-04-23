// SceneObjectManager.js
// Système centralisé pour la gestion des objets individuels dans la scène
// Gère à la fois les objets interactifs et les objets statiques avec leur placement par défaut

import {INTERACTION_TYPES} from '../Utils/EnhancedObjectMarker';
import MARKER_EVENTS, {EventBus} from '../Utils/EventEmitter';
import {textureManager} from './TextureManager';

class SceneObjectManager {
    constructor() {
        // Définition des étapes dans l'ordre
        this.interactionSteps = [
            'firstStop',
            'secondStop',
            'thirdStop',
            'fourthStop',
            'fifthStop',
            'sixthStop'
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
            'specialStop': "Point spécial",
            // Ajoutez d'autres textes par défaut ici
        };

        // Compteur pour suivre l'ordre des objets interactifs
        this.interactiveObjectsCount = 0;

        // Catalogue des modèles disponibles pour les objets individuels
        // avec leur configuration et placement par défaut
        this.objectCatalog = {
            // Objets interactifs
            'TreeInteractive': {
                id: 'TreeNaked',
                path: '/models/forest/tree/TreeNaked.gltf',
                scale: [0.1, 0.1, 0.1],
                interactive: true,
                useTextures: true,
                interaction: {
                    type: INTERACTION_TYPES.DRAG_UP,
                    text: "Examiner l'arbre",
                    color: "#44ff44",
                    offset: 1.5,
                    axis: "y",
                    interfaceToShow: "none"
                },
                defaultPlacement: {
                    position: [23, 0, -150],
                    rotation: [0, 0, 0],
                    outlinePulse: false,
                    requiredStep: 'firstStop'
                }
            },
            'StumpInteractive': {
                id: 'TreeStump',
                path: '/models/forest/tree/TreeStump.gltf',
                scale: [0.25, 0.25, 0.25],
                interactive: true,
                useTextures: true,
                interaction: {
                    type: INTERACTION_TYPES.LONG_PRESS,
                    text: "Inspecter la souche",
                    color: "#ffbb00",
                    offset: 1.0,
                    axis: "y",
                    interfaceToShow: "camera"
                },
                defaultPlacement: {
                    position: [-1, 0, -138.00],
                    rotation: [0, 0, 0],
                    outlinePulse: false,
                    requiredStep: 'secondStop'
                }
            },

            // Nouveaux objets interactifs - Ajouter sans perturber les existants
            'TrunkLargeInteractive': {
                id: 'TrunkLarge',
                path: '/models/forest/tree/TrunkLarge.gltf',
                scale: [0.15, 0.15, 0.15],
                interactive: true,
                useTextures: true,
                interaction: {
                    type: INTERACTION_TYPES.CLICK,
                    text: "Observer le tronc",
                    color: "#44aacc",
                    offset: 1.2,
                    axis: "y",
                    interfaceToShow: "none"
                },
                defaultPlacement: {
                    position: [-48, 0, -95],
                    rotation: [0, 0, 0],
                    outlinePulse: false,
                    requiredStep: 'thirdStop'
                }
            },
            'ThinTrunkInteractive': {
                id: 'ThinTrunk',
                path: '/models/forest/tree/ThinTrunk.gltf',
                scale: [0.2, 0.2, 0.2],
                interactive: true,
                useTextures: true,
                interaction: {
                    type: INTERACTION_TYPES.LONG_PRESS,
                    text: "Examiner le tronc fin",
                    color: "#ff88cc",
                    offset: 1.0,
                    axis: "y",
                    interfaceToShow: "none"
                },
                defaultPlacement: {
                    position: [-43, 0, -81],
                    rotation: [0, 0, 0],
                    outlinePulse: false,
                    requiredStep: 'fourthStop'
                }
            },
            'BushInteractive': {
                id: 'Bush',
                path: '/models/forest/bush/Bush.glb',
                scale: [0.2, 0.2, 0.2],
                interactive: true,
                useTextures: true,
                interaction: {
                    type: INTERACTION_TYPES.DRAG_RIGHT,
                    text: "Écarter le buisson",
                    color: "#88cc44",
                    offset: 1.0,
                    axis: "y",
                    interfaceToShow: "none"
                },
                defaultPlacement: {
                    position: [-8, 0, -60],
                    rotation: [0, 0, 0],
                    outlinePulse: false,
                    requiredStep: 'fifthStop'
                }
            },
            'DirectionPanelInteractive': {
                id: 'DirectionPanel',
                path: '/models/primary/DirectionPanel.gltf',
                scale: [0.5, 0.5, 0.5],
                interactive: true,
                useTextures: false,
                interaction: {
                    type: INTERACTION_TYPES.CLICK,
                    text: "Lire le panneau",
                    color: "#ffcc44",
                    offset: 1.5,
                    axis: "y",
                    interfaceToShow: "scanner"
                },
                defaultPlacement: {
                    position: [3, 0, -23],
                    rotation: [0, 0, 0],
                    outlinePulse: false,
                    requiredStep: 'sixthStop'
                }
            },
            'Ground': {
                id: 'Bush',
                path: '/models/Ground.glb',
                scale: [1, 1, 1],
                interactive: false,
                useTextures: false,
                defaultPlacements: [
                    {position: [0, 0, 0], rotation: [0, 0, 0]},
                ]
            },
            'DirectionPanel': {
                id: 'DirectionPanel',
                path: '/models/primary/DirectionPanel.gltf',
                scale: [0.605, 0.605, 0.605],
                interactive: false,
                useTextures: true,
                defaultPlacements: [
                    {position: [-8.343, 0, 13.953], rotation: [0, 0.5061454831, 0]}
                ]
            },
            'LeafErable': {
                id: 'LeafErable',
                path: '/models/primary/LeafErable.glb',
                scale: [0.018, 0.018, 0.018],
                interactive: false,
                useTextures: true,
                defaultPlacements: [
                    {position: [-5.895, 0.193, -56.018], rotation: [0, -0.8552113335, 0]}
                ]
            },
            'OakLeaf': {
                id: 'OakLeaf',
                path: '/models/primary/OakLeaf.glb',
                scale: [0.048, 0.048, 0.048],
                interactive: false,
                useTextures: true,
                defaultPlacements: [
                    {position: [-5.747, 0.187, -56.018], rotation: [0, 0, 0]}
                ]
            },
        };

        // Liste des placements d'objets dans la scène
        this.placements = [];

        // Écouter les événements d'interaction
        this._setupEventListeners();

        // Initialiser les placements par défaut
        this._initializeDefaultPlacements();
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
                // Attribuer automatiquement la prochaine étape si non spécifiée
                const requiredStep = config.defaultPlacement.requiredStep || this._getNextStep();

                // Générer automatiquement markerId et markerText si nécessaire
                const markerId = config.defaultPlacement.markerId || this._generateMarkerId(key, requiredStep);
                const markerText = config.defaultPlacement.markerText ||
                    this._generateMarkerText(key, requiredStep, config.interaction.text);

                // Placer un objet interactif
                this.addPlacement(key, config.defaultPlacement.position, {
                    rotation: config.defaultPlacement.rotation || [0, 0, 0],
                    markerId: markerId,
                    markerText: markerText,
                    requiredStep: requiredStep,
                    outlinePulse: config.defaultPlacement.outlinePulse,
                    markerColor: config.defaultPlacement.markerColor,
                    markerOffset: config.defaultPlacement.markerOffset,
                    markerAxis: config.defaultPlacement.markerAxis
                });
            } else if (!config.interactive && config.defaultPlacements) {
                // Placer plusieurs instances d'objets statiques
                config.defaultPlacements.forEach((placement, index) => {
                    this.addPlacement(key, placement.position, {
                        rotation: placement.rotation || [0, 0, 0],
                        scale: placement.scale || config.scale
                    });
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
            const placement = this.placements.find(p => p.markerId === data.id);
            if (placement) {
                console.log(`==== INTERACTION COMPLÉTÉE ====`);
                console.log(`SceneObjectManager: Interaction complétée pour ${placement.markerId}`);
                console.log(`Objet: ${placement.objectKey} à la position [${placement.position}]`);
                console.log(`Étape requise: ${placement.requiredStep}`);
                console.log(`Type d'interaction: ${placement.markerType}`);
                console.log(`=============================`);

                // Exécuter le callback personnalisé si défini
                if (placement.onInteract && typeof placement.onInteract === 'function') {
                    placement.onInteract(data);
                }

                // Mettre à jour l'état d'interaction de l'objet
                placement.interacted = true;
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
            baseConfig.interaction = {
                type: config.interaction?.type || INTERACTION_TYPES.CLICK,
                text: config.interaction?.text || "Interagir",
                color: config.interaction?.color || "#44ff44",
                offset: config.interaction?.offset || 1.0,
                axis: config.interaction?.axis || "y",
                interfaceToShow: config.interaction?.interfaceToShow || null
            };

            // Ajouter le placement par défaut si fourni
            if (config.defaultPlacement) {
                baseConfig.defaultPlacement = config.defaultPlacement;
            }
        } else if (config.defaultPlacements) {
            // Ajouter les placements par défaut pour les objets statiques
            baseConfig.defaultPlacements = config.defaultPlacements;
        }

        this.objectCatalog[key] = baseConfig;

        // Si des placements par défaut sont définis, les ajouter immédiatement
        if (config.interactive && config.defaultPlacement) {
            // Attribuer automatiquement la prochaine étape si non spécifiée
            const requiredStep = config.defaultPlacement.requiredStep || this._getNextStep();

            const markerId = config.defaultPlacement.markerId ||
                this._generateMarkerId(key, requiredStep);
            const markerText = config.defaultPlacement.markerText ||
                this._generateMarkerText(key, requiredStep, config.interaction.text);

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

        // Si l'objet est interactif, ajouter les propriétés d'interaction
        if (objectConfig.interactive) {
            // Attribuer automatiquement la prochaine étape si non spécifiée
            const requiredStep = options.requiredStep ||
                objectConfig.defaultPlacement?.requiredStep ||
                this._getNextStep();

            const markerId = options.markerId ||
                this._generateMarkerId(key, requiredStep);
            const markerText = options.markerText ||
                this._generateMarkerText(key, requiredStep, objectConfig.interaction.text);

            Object.assign(placement, {
                markerId: markerId,
                requiredStep: requiredStep,
                onInteract: options.onInteract || null,
                markerText: markerText,
                markerColor: options.markerColor || objectConfig.defaultPlacement?.markerColor || objectConfig.interaction.color,
                markerOffset: options.markerOffset || objectConfig.defaultPlacement?.markerOffset || objectConfig.interaction.offset,
                markerAxis: options.markerAxis || objectConfig.defaultPlacement?.markerAxis || objectConfig.interaction.axis,
                markerType: options.markerType || objectConfig.interaction.type,
                outlineColor: options.outlineColor || objectConfig.defaultPlacement?.outlineColor || objectConfig.interaction.color,
                outlinePulse: options.outlinePulse !== undefined ? options.outlinePulse :
                    (objectConfig.defaultPlacement?.outlinePulse !== undefined ?
                        objectConfig.defaultPlacement.outlinePulse : true),
                interacted: false
            });
        }

        this.placements.push(placement);
        return placement;
    }

    // Appliquer les textures à un objet
    async applyTexturesToObject(placement, modelObject) {
        if (!placement || !modelObject) return;

        // Vérifier si l'objet doit utiliser des textures
        if (placement.useTextures === false) return;

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
            if (filters.interacted !== undefined &&
                placement.interacted !== undefined &&
                placement.interacted !== filters.interacted) {
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
            updates.markerId = this._generateMarkerId(
                this.placements[index].objectKey,
                updates.requiredStep
            );
        }

        if (updates.requiredStep && !updates.markerText) {
            updates.markerText = this._generateMarkerText(
                this.placements[index].objectKey,
                updates.requiredStep,
                this.objectCatalog[this.placements[index].objectKey]?.interaction?.text
            );
        }

        this.placements[index] = {
            ...this.placements[index],
            ...updates
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

    // Générer la liste des assets nécessaires au format attendu par l'AssetManager
    generateAssetList() {
        const assetSet = new Set();
        const assets = [];

        Object.values(this.objectCatalog).forEach(obj => {
            // Éviter les doublons en utilisant le chemin comme clé
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