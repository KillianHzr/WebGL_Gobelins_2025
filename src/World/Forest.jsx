import {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';
import useStore from '../Store/useStore';
import templateManager from '../Config/TemplateManager';
import {textureManager} from '../Config/TextureManager';

// -------------------- OPTIMIZED LOD PARAMETERS --------------------
const LOD_CONFIG = {
    MAX_DETAIL_DISTANCE: 33, MIN_DETAIL_DISTANCE: 50, LOD_LEVELS: 1, MIN_DETAIL_PERCENTAGE: 0.1, DEBUG_LOD: false
};

const TRUNK_SWITCH_CONFIG = {
    SWITCH_DISTANCE: 3000, SWITCH_RANGE: 7, CHUNK_SIZE: 20, DEBUG_SWITCH: false
};

// Optimized loading configuration
const LOADING_CONFIG = {
    BATCH_SIZE: 10, BATCH_DELAY: 2, PRIORITY_RADIUS: 50, MAX_WORKERS: 2, ENABLE_GEOMETRY_CACHE: true, CHUNK_SIZE: 5
};
// ----------------------------------------------------------------------

const FOREST_LOADING_PHASES = {
    WAITING_CAMERA: { weight: 5, label: 'Ajustement des jumelles...' },
    LOADING_POSITIONS: { weight: 10, label: 'Cartographie de la zone...' },
    LOADING_MODELS: { weight: 15, label: 'Identification de la faune...' },
    PREPARING_QUEUE: { weight: 5, label: 'Préparation de l\'équipement...' },
    CREATING_INSTANCES: { weight: 50, label: 'Localisation du vison...' },
    APPLYING_TEXTURES: { weight: 10, label: 'Écoute de la radio...' },
    FINALIZING: { weight: 5, label: 'Réveil...' }
};

// Calculer le poids total
const TOTAL_WEIGHT = Object.values(FOREST_LOADING_PHASES).reduce((sum, phase) => sum + phase.weight, 0);

// Fonction utilitaire pour émettre la progression - VERSION CORRIGÉE
const emitForestProgress = (phase, progressInPhase = 0) => {
    try {
        // Calculer la progression jusqu'à cette phase
        let progressBefore = 0;
        const phaseKeys = Object.keys(FOREST_LOADING_PHASES);
        const currentPhaseIndex = phaseKeys.findIndex(key => key === phase);

        for (let i = 0; i < currentPhaseIndex; i++) {
            progressBefore += FOREST_LOADING_PHASES[phaseKeys[i]].weight;
        }

        // Ajouter la progression dans la phase actuelle
        const currentPhaseWeight = FOREST_LOADING_PHASES[phase].weight;
        const currentPhaseProgress = progressInPhase * currentPhaseWeight;

        // Calculer le pourcentage total
        const totalProgress = (progressBefore + currentPhaseProgress) / TOTAL_WEIGHT * 100;

        console.log(`🌲 Forest Loading: ${FOREST_LOADING_PHASES[phase].label} (${totalProgress.toFixed(1)}%)`);

        const eventData = {
            phase: phase,
            phaseLabel: FOREST_LOADING_PHASES[phase].label,
            phaseProgress: progressInPhase * 100,
            totalProgress: Math.min(100, totalProgress), // S'assurer qu'on ne dépasse pas 100%
            isComplete: totalProgress >= 100
        };

        // Émettre l'événement avec gestion d'erreur
        if (typeof EventBus !== 'undefined' && EventBus.trigger) {
            EventBus.trigger('forest-loading-progress', eventData);
        } else {
            console.warn('EventBus non disponible pour émettre forest-loading-progress');
        }

        // Si on atteint 100%, émettre aussi forest-ready après un court délai
        if (totalProgress >= 100) {
            setTimeout(() => {
                console.log('🌲 Émission de forest-ready depuis emitForestProgress');
                if (typeof EventBus !== 'undefined' && EventBus.trigger) {
                    EventBus.trigger('forest-ready', eventData);
                }
            }, 100);
        }

    } catch (error) {
        console.error('Erreur lors de l\'émission de la progression de la forêt:', error);
    }
};

// Improved geometry cache with better memory management
const GeometryCache = {
    cache: new Map(), materials: new Map(), pendingMaterials: new Map(), // Nouveau: pour gérer les matériaux en cours de chargement
    stats: {hits: 0, misses: 0},

    getKey(objectId, detailLevel) {
        return `${objectId}_lod_${detailLevel.toFixed(2)}`;
    },

    has(objectId, detailLevel) {
        const result = this.cache.has(this.getKey(objectId, detailLevel));
        if (result) this.stats.hits++; else this.stats.misses++;
        return result;
    },

    get(objectId, detailLevel) {
        return this.cache.get(this.getKey(objectId, detailLevel));
    },

    set(objectId, detailLevel, geometry) {
        this.cache.set(this.getKey(objectId, detailLevel), geometry);
    },

    // NOUVELLE MÉTHODE: Obtenir un matériau de manière asynchrone
    async getMaterialAsync(objectId, properties = {}) {
        // Vérifier si le matériau est déjà en cache
        if (this.materials.has(objectId)) {
            const material = this.materials.get(objectId);
            // Si le matériau est encore en cours de chargement des textures, attendre
            if (material.userData.isLoadingTextures) {
                await this.waitForMaterialTextures(material);
            }
            return material;
        }

        // Vérifier si le matériau est déjà en cours de création
        if (this.pendingMaterials.has(objectId)) {
            return await this.pendingMaterials.get(objectId);
        }

        // Créer une nouvelle promesse pour ce matériau
        const materialPromise = textureManager.getMaterialAsync(objectId, {
            aoIntensity: 0.0, alphaTest: 1.0, ...properties
        });

        // Stocker la promesse pour éviter les doublons
        this.pendingMaterials.set(objectId, materialPromise);

        try {
            const material = await materialPromise;

            // Optimiser le matériau pour le rendu d'instances
            if (material) {
                material.uniformsNeedUpdate = true;
                material.needsUpdate = true;

                // Stocker dans le cache
                this.materials.set(objectId, material);
            }

            // Nettoyer la promesse en attente
            this.pendingMaterials.delete(objectId);

            return material;
        } catch (error) {
            console.error(`Erreur lors de la création du matériau pour ${objectId}:`, error);
            this.pendingMaterials.delete(objectId);
            throw error;
        }
    },

    // Méthode pour attendre que les textures d'un matériau soient chargées
    async waitForMaterialTextures(material, timeout = 5000) {
        if (!material.userData.isLoadingTextures) {
            return material;
        }

        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkInterval = setInterval(() => {
                if (!material.userData.isLoadingTextures) {
                    clearInterval(checkInterval);
                    resolve(material);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    console.warn(`Timeout lors de l'attente des textures pour ${material.userData.modelId}`);
                    resolve(material); // Résoudre quand même pour éviter de bloquer
                }
            }, 50);
        });
    },

    // Version synchrone modifiée pour être plus robuste
    getMaterial(objectId, properties = {}) {
        if (!this.materials.has(objectId)) {
            // Créer un matériau temporaire en attendant la version complète
            const tempMaterial = textureManager.getMaterial(objectId, {
                aoIntensity: 0.0, alphaTest: 1.0, ...properties
            });

            if (tempMaterial) {
                tempMaterial.uniformsNeedUpdate = true;
                tempMaterial.needsUpdate = true;
                this.materials.set(objectId, tempMaterial);
            }
            return tempMaterial;
        }
        return this.materials.get(objectId);
    },

    clear() {
        this.cache.forEach(geometry => {
            if (geometry && geometry.dispose) {
                geometry.dispose();
            }
        });
        this.cache.clear();

        this.materials.forEach(material => {
            if (material && material.dispose) {
                material.dispose();
            }
        });
        this.materials.clear();
        this.pendingMaterials.clear();
    }
};

// Object type groups for batching similar objects
const OBJECT_TYPE_GROUPS = {
    trees: ['TreeNaked', 'TrunkLarge', 'TrunkThin', 'TreeStump'],
    bushes: ['Bush', 'BushBlueberry', 'BushRaspberry', 'BushTrunk', 'BushStrawberry'],
    plants: ['FlowerBell', 'FlowerClover', 'PlantClematis', 'PlantMiscanthus', 'PlantPuccinellia', 'PlantReed'],
    misc: ['BigRock', 'RockWater', 'RockWater2', 'MushroomDuo', 'MushroomSolo'],
};

// Get group for object type for better batching
const getObjectTypeGroup = (objectId) => {
    // D'abord, vérifier si l'objet a un groupe spécifique dans templateManager
    const templateManagerGroup = templateManager.getGroupFromObjectId(objectId);

    // Si l'objet est spécifiquement dans le groupe 'end' ou 'screen', retourner ce groupe
    if (templateManagerGroup === 'end' || templateManagerGroup === 'screen') {
        return templateManagerGroup;
    }

    // Sinon, utiliser la classification existante pour le batching
    for (const [groupName, types] of Object.entries(OBJECT_TYPE_GROUPS)) {
        if (types.includes(objectId)) return groupName;
    }
    return 'default';
};

export default function Forest() {
    const {scene, camera} = useThree();
    const forestRef = useRef(new THREE.Group());
    const endGroupRef = useRef(new THREE.Group());
    const screenGroupRef = useRef(new THREE.Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    const endGroupVisible = useStore(state => state.endGroupVisible);
    const screenGroupVisible = useStore(state => state.screenGroupVisible);
    const setEndGroupVisible = useStore(state => state.setEndGroupVisible);
    const setScreenGroupVisible = useStore(state => state.setScreenGroupVisible);

    // État pour attendre la stabilité de la caméra
    const [cameraStable, setCameraStable] = useState(false);
    const [forestLoadingStarted, setForestLoadingStarted] = useState(false);
    const cameraStabilityTimerRef = useRef(null);

    // Refs for data and state
    const objectPositionsRef = useRef(null);
    const objectModelsRef = useRef(null);
    const objectsLoadedRef = useRef(false);
    const lodInstancesRef = useRef([]);
    const animationFrameIdRef = useRef(null);
    const frameSkipRef = useRef(0);
    const FRAME_SKIP = 6;

    // Refs for priority loading
    const loadingQueueRef = useRef([]);
    const isLoadingRef = useRef(false);
    const loadedChunksRef = useRef(new Set());
    const workerPoolRef = useRef([]);

    // Refs for frustum culling
    const frustumRef = useRef(new THREE.Frustum());
    const projScreenMatrixRef = useRef(new THREE.Matrix4());

    // NEW: Track instance statistics
    const instanceStatsRef = useRef({
        totalInstances: 0, visibleInstances: 0, instancedMeshes: 0, lastUpdate: 0
    });

    // Fonction pour vérifier la stabilité de la caméra
    const checkCameraStability = () => {
        console.log("Checking camera stability...");

        // Nettoyer le timer précédent s'il existe
        if (cameraStabilityTimerRef.current) {
            clearTimeout(cameraStabilityTimerRef.current);
        }

        // Attendre 2 secondes de stabilité avant de considérer la caméra comme stable
        cameraStabilityTimerRef.current = setTimeout(() => {
            console.log("Camera is now stable - ready to load forest");
            setCameraStable(true);
            emitForestProgress('WAITING_CAMERA', 1.0);
        }, 2000);
    };

    // Écouteur pour les changements de mode de caméra
    useEffect(() => {
        const handleCameraModeChange = (data) => {
            console.log("Forest received camera mode change event:", data);
            setCameraStable(false);
            checkCameraStability();
        };

        const handleCameraTeleport = (data) => {
            console.log("Forest received camera teleport event:", data);
            setCameraStable(false);
            checkCameraStability();
        };

        // S'abonner aux événements de caméra
        const cameraModeUnsubscribe = EventBus.on('camera-mode-changed', handleCameraModeChange);
        const teleportUnsubscribe = EventBus.on('camera-teleported', handleCameraTeleport);

        // Vérifier la stabilité initiale
        checkCameraStability();

        return () => {
            if (cameraStabilityTimerRef.current) {
                clearTimeout(cameraStabilityTimerRef.current);
            }
            cameraModeUnsubscribe();
            teleportUnsubscribe();
        };
    }, []);

    // Function to toggle group visibility
    const toggleGroupVisibility = (groupRef, currentVisibility, setVisibility) => {
        const newVisibility = !currentVisibility;
        if (groupRef.current) {
            groupRef.current.visible = newVisibility;
        }
        setVisibility(newVisibility);
        return newVisibility;
    };

    useEffect(() => {
        // Marquer le chargement comme non terminé au début
        window.forestLoadingComplete = false;

        // Create the main group and subgroups
        const forestGroup = new THREE.Group();
        forestGroup.name = 'Forest';

        // Create the group for "End" objects
        const endGroup = new THREE.Group();
        endGroup.name = 'EndObjects';
        endGroup.visible = endGroupVisible; // Use store value
        forestGroup.add(endGroup);
        endGroupRef.current = endGroup;

        // Create the group for screens
        const screenGroup = new THREE.Group();
        screenGroup.name = 'ScreenObjects';
        screenGroup.visible = screenGroupVisible; // Use store value
        forestGroup.add(screenGroup);
        screenGroupRef.current = screenGroup;

        scene.add(forestGroup);
        forestRef.current = forestGroup;

        // Update the store with the default visibility states
        setEndGroupVisible(true);
        setScreenGroupVisible(false);


        //
        // setEndGroupVisible(false);
        // setScreenGroupVisible(true);

        // Trigger events to notify other components about initial visibility
        EventBus.trigger('end-group-visibility-changed', false);
        EventBus.trigger('screen-group-visibility-changed', true);

        console.log('Forest groups created, waiting for camera stability before loading...');

        // Initialize worker pool
        initializeWorkerPool();

        return () => {
            cleanupResources();
        };
    }, [scene, camera, assetManager]);

    // Effet pour commencer le chargement quand la caméra est stable
    useEffect(() => {
        if (cameraStable && !forestLoadingStarted) {
            console.log("Camera is stable, starting forest loading...");
            setForestLoadingStarted(true);
            initForestLoading();
        }
    }, [cameraStable, forestLoadingStarted]);

    useEffect(() => {
        // Exposer les références des groupes au niveau global pour l'accès externe
        window.endGroupRef = endGroupRef;
        window.screenGroupRef = screenGroupRef;
        // Todo: set avec le state
        if (window.endGroupRef.current) {
            window.endGroupRef.current.visible = endGroupVisible;
        }
        if (window.screenGroupRef.current) {
            window.screenGroupRef.current.visible = screenGroupVisible;
        }
        console.log('Références de groupe exposées:', {
            endGroupRef: endGroupRef.current, screenGroupRef: screenGroupRef.current
        });

        return () => {
            delete window.endGroupRef;
            delete window.screenGroupRef;
        };
    }, [endGroupVisible, screenGroupVisible]);

    const forceGroupVisibility = (force = true) => {
        // Update store
        useStore.getState().setEndGroupVisible(force);
        useStore.getState().setScreenGroupVisible(force);

        // Apply directly to references
        if (endGroupRef.current) {
            endGroupRef.current.visible = force;
        }

        if (screenGroupRef.current) {
            screenGroupRef.current.visible = force;
        }

        // Emit events
        EventBus.trigger('end-group-visibility-changed', force);
        EventBus.trigger('screen-group-visibility-changed', force);
    };

    // Initialize worker pool for geometry creation
    const initializeWorkerPool = () => {
        workerPoolRef.current = Array(LOADING_CONFIG.MAX_WORKERS).fill(null).map(() => ({
            busy: false, id: Math.random().toString(36).substring(7)
        }));
    };

    // Main function for loading the forest
    const initForestLoading = async () => {
        try {
            console.log("Starting forest loading process...");
            emitForestProgress('LOADING_POSITIONS', 0);

            // 1. Load positions first
            const positions = await loadObjectPositions();
            if (!positions) {
                console.error('Failed to load tree positions');
                return;
            }
            objectPositionsRef.current = positions;
            useStore.getState().setTreePositions(positions);
            emitForestProgress('LOADING_POSITIONS', 1.0);

            // 2. Load necessary models
            emitForestProgress('LOADING_MODELS', 0);
            const models = await loadObjectModelsOptimized();
            if (!models) {
                console.error('Failed to load tree models');
                return;
            }
            objectModelsRef.current = models;
            emitForestProgress('LOADING_MODELS', 1.0);

            // 3. Prepare priority loading queue
            emitForestProgress('PREPARING_QUEUE', 0);
            prepareLoadingQueue(positions);
            emitForestProgress('PREPARING_QUEUE', 1.0);

            // 4. Start progressive loading
            emitForestProgress('CREATING_INSTANCES', 0);
            startProgressiveLoading();

            // 5. Start LOD update loop
            updateLODs();

        } catch (error) {
            console.error('Error initializing forest:', error);
        }
    };

    const loadObjectPositions = async () => {
        try {
            // Try possible paths
            const paths = ['./data/treePositions.json', '/data/treePositions.json', '../data/treePositions.json', 'treePositions.json'];

            // Promise.race to take the first working path
            const fetchPromises = paths.map(path => fetch(path)
                .then(response => {
                    if (!response.ok) throw new Error(`Path ${path} failed`);
                    return response.json();
                })
                .then(data => {
                    return data;
                })
                .catch(err => {
                    return null;
                }));

            // Add store fallback
            const storePromise = new Promise(resolve => {
                const storePositions = useStore.getState().treePositions;
                if (storePositions) {
                    resolve(storePositions);
                } else {
                    resolve(null);
                }
            });

            // Take the first valid result
            const results = await Promise.all([...fetchPromises, storePromise]);
            const validResult = results.find(result => result !== null);

            if (validResult) {
                return validResult;
            }

            console.error('Could not load object positions from any source');
            return null;
        } catch (error) {
            console.error('Error loading object positions:', error);
            return useStore.getState().treePositions || null;
        }
    };

    const loadObjectModelsOptimized = async () => {
        if (!assetManager) {
            console.warn('AssetManager not available');
            return null;
        }

        try {
            // Get required asset info
            const requiredAssetsInfo = templateManager.getRequiredAssets();
            const requiredAssetNames = requiredAssetsInfo.map(asset => asset.name);

            // Create promise object for each asset
            const modelPromises = requiredAssetNames.map(assetName => {
                return new Promise(resolve => {
                    // Check if model is already loaded
                    const model = assetManager.getItem(assetName);
                    if (model) {
                        resolve({name: assetName, model});
                        return;
                    }

                    // Otherwise, listen for load event
                    const onAssetLoaded = (loadedName, loadedModel) => {
                        if (loadedName === assetName) {
                            // Unsubscribe to avoid memory leaks
                            assetManager.off('assetLoaded', onAssetLoaded);
                            resolve({name: assetName, model: loadedModel});
                        }
                    };

                    // Subscribe to event
                    assetManager.on('assetLoaded', onAssetLoaded);

                    // Request loading if necessary
                    if (!assetManager.isLoading(assetName)) {
                        assetManager.loadAsset(assetName);
                    }
                });
            });

            // Wait for all models to load
            const loadedModels = await Promise.all(modelPromises);

            // Convert to object
            const modelObject = {};
            loadedModels.forEach(({name, model}) => {
                modelObject[name] = model;
            });

            return modelObject;
        } catch (error) {
            console.error('Error loading models:', error);
            return null;
        }
    };

    // New optimized version to group by both type and position
    const prepareLoadingQueue = (positions) => {
        if (!positions || !camera) return;

        const queue = [];
        const cameraPosition = camera.position.clone();
        const CHUNK_SIZE = LOADING_CONFIG.CHUNK_SIZE;

        // Group similar object types to reduce state changes
        const typeGroups = {};

        // First, group all positions by object type group and chunk
        Object.keys(positions).forEach(objectId => {
            if (objectId === templateManager.undefinedCategory || !positions[objectId] || positions[objectId].length === 0) {
                return;
            }

            // Get the object group for better batching
            const objectGroup = getObjectTypeGroup(objectId);

            // Initialize group if needed
            if (!typeGroups[objectGroup]) {
                typeGroups[objectGroup] = {};
            }

            // Group positions by chunk
            positions[objectId].forEach(pos => {
                const chunkX = Math.floor(pos.x / CHUNK_SIZE);
                const chunkZ = Math.floor(pos.z / CHUNK_SIZE);
                const chunkId = `${objectGroup}_${chunkX}_${chunkZ}`;

                if (!typeGroups[objectGroup][chunkId]) {
                    typeGroups[objectGroup][chunkId] = {
                        objectGroup,
                        chunkX,
                        chunkZ,
                        chunkId,
                        objects: {},
                        center: new THREE.Vector3((chunkX + 0.5) * CHUNK_SIZE, 0, (chunkZ + 0.5) * CHUNK_SIZE)
                    };
                }

                // Add to the type group's object list
                if (!typeGroups[objectGroup][chunkId].objects[objectId]) {
                    typeGroups[objectGroup][chunkId].objects[objectId] = [];
                }

                typeGroups[objectGroup][chunkId].objects[objectId].push(pos);
            });
        });

        // Convert grouped chunks to queue items
        Object.values(typeGroups).forEach(groupChunks => {
            Object.values(groupChunks).forEach(chunk => {
                // Calculate distance to camera for priority
                const distanceToCamera = chunk.center.distanceTo(cameraPosition);

                queue.push({
                    ...chunk, distanceToCamera, priority: distanceToCamera <= LOADING_CONFIG.PRIORITY_RADIUS ? 1 : 0
                });
            });
        });

        // Sort queue by priority and distance
        queue.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return a.distanceToCamera - b.distanceToCamera;
        });

        loadingQueueRef.current = queue;
    };

    // Start progressive loading
    const startProgressiveLoading = () => {
        if (isLoadingRef.current || loadingQueueRef.current.length === 0) return;

        isLoadingRef.current = true;
        processNextBatch().then(r => {
            console.log("Progressive loading started, processing first batch...");
        });
    };

    // Process a batch of chunks

    const processNextBatch = async () => {
        const queue = loadingQueueRef.current;
        const totalChunks = loadedChunksRef.current.size + queue.length;
        const processedChunks = loadedChunksRef.current.size;

        if (queue.length === 0) {
            isLoadingRef.current = false;
            window.forestLoadingComplete = true;

            console.log('🌲 Forest loading complete!');

            // Finalisation
            emitForestProgress('APPLYING_TEXTURES', 0);

            setTimeout(() => {
                console.log("🔥 Application sélective de l'émission + nettoyage...");

                const result = forceEmissionOnlyOnEmissionObjects();
                console.log(`✅ Émission terminée: ${result.applied} objets 'Emission' activés`);

                emitForestProgress('APPLYING_TEXTURES', 1.0);
                emitForestProgress('FINALIZING', 0.5);

                // CRITIQUE: S'assurer d'émettre forest-ready
                setTimeout(() => {
                    emitForestProgress('FINALIZING', 1.0); // Ceci va automatiquement émettre forest-ready

                    // Sécurité: émettre forest-ready explicitement aussi
                    setTimeout(() => {
                        console.log('🌲 Émission explicite de forest-ready en sécurité');
                        try {
                            EventBus.trigger('forest-ready', {
                                phase: 'FINALIZING',
                                phaseLabel: 'Forêt complètement chargée!',
                                phaseProgress: 100,
                                totalProgress: 100,
                                isComplete: true
                            });
                            objectsLoadedRef.current = true;
                        } catch (error) {
                            console.error('Erreur lors de l\'émission de forest-ready:', error);
                        }
                    }, 200);

                }, 300);

            }, 1000);

            return;
        }

        // Calculer et émettre la progression de création d'instances
        if (totalChunks > 0) {
            const progressInPhase = processedChunks / totalChunks;
            emitForestProgress('CREATING_INSTANCES', Math.min(0.95, progressInPhase)); // Cap à 95% pour laisser place à la finalisation
        }

        // Take a batch of chunks to process
        const batch = queue.splice(0, LOADING_CONFIG.BATCH_SIZE);

        // Preload textures for object types in batch
        const objectTypes = new Set();
        batch.forEach(chunk => {
            Object.keys(chunk.objects).forEach(type => objectTypes.add(type));
        });

        const preloadedTextures = await preloadTexturesForModels(Array.from(objectTypes));

        // Process each chunk in batch in parallel
        await Promise.all(batch.map(chunk => createChunkInstances(chunk, preloadedTextures)));

        // Schedule next batch after short delay
        setTimeout(() => {
            processNextBatch();
        }, LOADING_CONFIG.BATCH_DELAY);
    };

    // Create instances for a chunk with distribution to groups
    const createChunkInstances = async (chunk, preloadedTextures) => {
        const {objectGroup, chunkId, objects, center} = chunk;

        // Check if this chunk has already been processed
        if (loadedChunksRef.current.has(chunkId)) {
            return;
        }

        // Mark as processed
        loadedChunksRef.current.add(chunkId);

        try {
            // Process each object type in this chunk
            const instances = [];

            for (const [objectId, positions] of Object.entries(objects)) {
                if (positions.length === 0) continue;

                // Get the model
                const model = objectModelsRef.current[objectId];
                if (!model) {
                    // console.warn(`Model not found for ${objectId}`);
                    continue;
                }

                // Create LOD instanced meshes for this object type
                const objectInstances = await createLodInstancedMeshesForObjects(objectId, model, positions, preloadedTextures, center, chunkId);

                instances.push(...objectInstances);
            }

            // Determine which group the object belongs to
            let targetGroup = forestRef.current;

            // Screen objects go to screen group
            if (objectGroup === 'screen' || chunk.chunkId.includes('Screen')) {
                targetGroup = screenGroupRef.current;
            }
            // Objects with "End" in their ID go to "End" group
            else if (objectGroup === 'end' || chunk.chunkId.includes('End')) {
                targetGroup = endGroupRef.current;
            }

            // Add instances to appropriate group and instance list
            instances.forEach(instance => {

                targetGroup.add(instance);
                lodInstancesRef.current.push(instance);
            });

            // Update instance stats
            instanceStatsRef.current.instancedMeshes += instances.length;
            instances.forEach(instance => {
                if (instance.count) {
                    instanceStatsRef.current.totalInstances += instance.count;
                }
            });

        } catch (error) {
            console.error(`Error creating instances for chunk ${chunkId}:`, error);
        }
    };

    // NEW: Optimized method that creates instances for multiple object types in a chunk
    const createLodInstancedMeshesForObjects = async (objectId, model, positions, preloadedTextures, chunkCenter, chunkId) => {
        if (!positions || positions.length === 0) {
            return [];
        }

        // Trouver la géométrie
        let geometry = null;
        model.scene.traverse((child) => {
            if (child.isMesh && child.geometry && !geometry) {
                geometry = child.geometry.clone();
            }
        });

        if (!geometry) {
            console.warn(`No geometry found in ${objectId} model`);
            return [];
        }

        // CORRECTION : Vérification stricte pour les objets émissifs (seulement "Emission")
        const shouldBeEmissive = textureManager._shouldObjectBeEmissive(objectId);

        if (shouldBeEmissive) {
            console.log(`🔥 Objet émissif détecté: ${objectId}`);
        } else if (objectId.includes('Screen')) {
            console.log(`📱 Écran normal (non émissif): ${objectId}`);
        }

        // Créer le matériau avec gestion spéciale pour les objets émissifs
        let material;
        try {
            if (shouldBeEmissive) {
                console.log(`🔥 Création de matériau émissif pour ${objectId}...`);

                // Utiliser la nouvelle méthode pour créer un matériau émissif
                material = await textureManager.createEmissiveMaterialForEmissionObjects(objectId);

                if (!material) {
                    // Fallback: créer un matériau basé sur la version non-émissive
                    const baseObjectId = objectId.replace('Emission', '');
                    console.log(`🔄 Fallback: création basée sur ${baseObjectId}`);

                    material = await GeometryCache.getMaterialAsync(baseObjectId, {
                        aoIntensity: 0.0,
                        alphaTest: 1.0,
                        isEmissive: true,
                        emissiveColor: textureManager.emissiveConfig.color,
                        emissiveIntensity: textureManager.emissiveConfig.intensity
                    });
                }
            } else {
                // Matériau normal pour les objets non émissifs (écrans normaux, etc.)
                material = GeometryCache.getMaterial(objectId, {
                    aoIntensity: 0.0,
                    alphaTest: 1.0
                });
            }
        } catch (error) {
            console.error(`❌ Erreur lors de la création du matériau pour ${objectId}:`, error);
            // Fallback vers la méthode normale
            material = GeometryCache.getMaterial(objectId, {
                aoIntensity: 0.0,
                alphaTest: 1.0
            });
        }

        if (!material) {
            console.warn(`Failed to create material for ${objectId}`);
            return [];
        }

        // CORRECTION : Application finale de l'émission SEULEMENT si l'objet est marqué émissif
        if (shouldBeEmissive && material) {
            console.log(`🎯 Application finale de l'émission sur ${objectId}...`);

            const emissionApplied = textureManager._safelySetEmissive(material, {
                color: textureManager.emissiveConfig.color,
                intensity: textureManager.emissiveConfig.intensity,
                useTexture: textureManager.emissiveConfig.useTexture,
                emissiveMap: textureManager.emissiveConfig.useTexture ? material.map : null
            });

            if (emissionApplied) {
                console.log(`✅ Émission appliquée avec succès à ${objectId}`);
            } else {
                console.warn(`⚠️ Échec de l'application de l'émission à ${objectId}`);
            }
        }

        // ... reste de la fonction pour créer les instances LOD ...

        // Créer les instances LOD
        const instances = [];
        const lodLevels = LOD_CONFIG.LOD_LEVELS;
        const dummy = new THREE.Object3D();

        for (let level = 0; level < lodLevels; level++) {
            const detailLevel = level === 0 ? 1.0 : 1.0 - (level / (lodLevels - 1));
            const minDistance = level === 0 ? 0 : LOD_CONFIG.MAX_DETAIL_DISTANCE + (level - 1) / (lodLevels - 1) * (LOD_CONFIG.MIN_DETAIL_DISTANCE - LOD_CONFIG.MAX_DETAIL_DISTANCE);
            const maxDistance = level === lodLevels - 1 ? Infinity : LOD_CONFIG.MAX_DETAIL_DISTANCE + level / (lodLevels - 1) * (LOD_CONFIG.MIN_DETAIL_DISTANCE - LOD_CONFIG.MAX_DETAIL_DISTANCE);

            let levelGeometry;
            if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE && GeometryCache.has(objectId, detailLevel)) {
                levelGeometry = GeometryCache.get(objectId, detailLevel);
            } else {
                levelGeometry = await createOptimizedGeometry(geometry, detailLevel, objectId);
                if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE) {
                    GeometryCache.set(objectId, detailLevel, levelGeometry);
                }
            }

            if (!levelGeometry) continue;

            // Créer le mesh instancié
            const instancedMesh = new THREE.InstancedMesh(levelGeometry, material, positions.length);

            // CORRECTION : Marquer SEULEMENT les instances vraiment émissives
            if (shouldBeEmissive) {
                instancedMesh.userData.isEmissive = true;
                instancedMesh.userData.emissiveConfig = {
                    color: textureManager.emissiveConfig.color,
                    intensity: textureManager.emissiveConfig.intensity,
                    useTexture: textureManager.emissiveConfig.useTexture
                };

                console.log(`🔥 Instance émissive créée: ${objectId}_lod${level}`);
            } else {
                // Marquer explicitement comme non émissif pour éviter toute confusion
                instancedMesh.userData.isEmissive = false;

                if (objectId.includes('Screen')) {
                    console.log(`📱 Instance d'écran normal créée: ${objectId}_lod${level}`);
                }
            }

            instancedMesh.renderOrder = -minDistance;
            instancedMesh.name = `${objectId}_lod${level}_chunk${chunkId}`;
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;

            // Définir les propriétés LOD
            instancedMesh.userData.lodLevel = level;
            instancedMesh.userData.minDistance = minDistance;
            instancedMesh.userData.maxDistance = maxDistance;
            instancedMesh.userData.chunkCenter = chunkCenter;
            instancedMesh.userData.objectId = objectId;
            instancedMesh.userData.chunkId = chunkId;

            // Calculer la sphère englobante
            const boundingSphere = new THREE.Sphere(chunkCenter.clone(), LOADING_CONFIG.CHUNK_SIZE * Math.sqrt(2));
            instancedMesh.userData.boundingSphere = boundingSphere;

            // Définir les matrices d'instance
            positions.forEach((pos, index) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(pos.rotationX, pos.rotationY, pos.rotationZ);
                dummy.scale.set(pos.scaleX, pos.scaleY, pos.scaleZ);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            });

            instancedMesh.instanceMatrix.needsUpdate = true;
            instancedMesh.computeBoundingSphere();
            instancedMesh.computeBoundingBox();

            instances.push(instancedMesh);
        }

        return instances;
    };



    const forceEmissionOnlyOnEmissionObjects = () => {
        console.log("🚀 Application sélective de l'émission sur les objets 'Emission' uniquement...");

        if (!forestRef.current) {
            console.warn("⚠️ forestRef.current n'est pas disponible");
            return { applied: 0, cleaned: 0 };
        }


        // 2. ENSUITE configurer l'émission avec des paramètres optimisés
        textureManager.setEmissiveConfig({
            color: 0xffffff,      // Cyan brillant
            intensity: 2.5,       // Intensité élevée
            useTexture: true,     // Utiliser la texture comme base
            forceOverride: true   // Forcer l'écrasement
        });

        // 3. ENFIN appliquer SEULEMENT sur les objets avec "Emission"
        console.log("🔥 Étape 2: Application de l'émission sur les objets 'Emission'...");
        const appliedCount = textureManager.forceEmissiveOnEmissionObjectsOnly(forestRef.current);

        // 4. Forcer le rendu
        if (window.renderer && camera) {
            window.renderer.render(scene, camera);
        }

        console.log(`✅ Opération terminée: ${appliedCount} appliqués`);
        return { applied: appliedCount };
    };


// 2. Fonction pour appliquer un correctif de timing spécifique à Screen
    const applyScreenTimingFix = async () => {
        console.log("Application du correctif de timing pour Screen...");

        // Attendre que le chargement de la forêt soit terminé
        if (!window.forestLoadingComplete) {
            console.log("Attente de la fin du chargement de la forêt...");
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (window.forestLoadingComplete) {
                        clearInterval(checkInterval);
                        resolve(applyScreenTimingFix());
                    }
                }, 100);
            });
        }

        // Forcer la recréation du matériau Screen
        const newScreenMaterial = await textureManager.forceRecreateScreenMaterial();

        // Appliquer le nouveau matériau à toutes les instances Screen
        let updatedInstances = 0;

        if (forestRef.current) {
            forestRef.current.traverse((object) => {
                if (object.userData?.objectId === 'Screen' || object.name.includes('Screen')) {
                    if (object.material) {
                        // Remplacer le matériau
                        const oldMaterial = object.material;
                        object.material = newScreenMaterial;

                        // Disposer de l'ancien matériau si ce n'est pas partagé
                        if (oldMaterial && oldMaterial !== newScreenMaterial) {
                            // Vérifier s'il est utilisé ailleurs avant de le disposer
                            setTimeout(() => {
                                if (oldMaterial.dispose) {
                                    oldMaterial.dispose();
                                }
                            }, 1000);
                        }

                        updatedInstances++;
                    }
                }
            });
        }

        console.log(`Correctif appliqué à ${updatedInstances} instances Screen`);

        // Forcer le rendu
        if (window.renderer) {
            window.renderer.render(scene, camera);
        }

        return updatedInstances;
    };


    const getChunkHash = (chunkId, x, z) => {
        // Use a simple hash algorithm to generate a pseudo-random but stable value
        let hash = 0;
        for (let i = 0; i < chunkId.length; i++) {
            hash = (hash << 5) - hash + chunkId.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
        // Add influence of coordinates for more variation
        hash += x * 73 + z * 151;
        return hash;
    };

    const getChunkCustomThreshold = (chunkId, chunkX, chunkZ) => {
        const hash = getChunkHash(chunkId, chunkX, chunkZ);
        // Generate variation between -SWITCH_RANGE/2 and +SWITCH_RANGE/2
        const variation = (hash % TRUNK_SWITCH_CONFIG.SWITCH_RANGE) - (TRUNK_SWITCH_CONFIG.SWITCH_RANGE / 2);
        return TRUNK_SWITCH_CONFIG.SWITCH_DISTANCE + variation;
    };


    // IMPROVED: Optimized geometry simplification for fewer polygons while maintaining shape
    const createOptimizedGeometry = (geometry, detailLevel, objectId) => {
        if (!geometry) return null;

        // Clone geometry to avoid modifying original
        const clonedGeometry = geometry.clone();

        // If maximum detail level, return original geometry
        if (detailLevel >= 0.999) {
            return clonedGeometry;
        }

        // Calculate ratio of triangles to keep
        // Linear interpolation between MIN_DETAIL_PERCENTAGE and 1.0
        const ratio = LOD_CONFIG.MIN_DETAIL_PERCENTAGE + (1.0 - LOD_CONFIG.MIN_DETAIL_PERCENTAGE) * detailLevel;

        // IMPROVED: More efficient method of triangle reduction
        if (clonedGeometry.index) {
            const indices = clonedGeometry.index.array;
            const newIndicesCount = Math.floor(indices.length * ratio);
            // Ensure count is divisible by 3 (for complete triangles)
            const adjustedCount = Math.floor(newIndicesCount / 3) * 3;

            // Create new index buffer with fewer triangles
            const newIndices = new Uint32Array(adjustedCount);

            // Sample triangles evenly instead of just taking the first ones
            const stride = Math.max(1, Math.floor(1 / ratio));

            // Use uniform sampling to preserve shape better
            for (let i = 0, j = 0; i < adjustedCount; i += 3, j += 3 * stride) {
                // Keep triangles at regular intervals
                const baseIndex = (j % (indices.length - 2));
                newIndices[i] = indices[baseIndex];
                newIndices[i + 1] = indices[baseIndex + 1];
                newIndices[i + 2] = indices[baseIndex + 2];
            }

            clonedGeometry.setIndex(new THREE.BufferAttribute(newIndices, 1));
        }
        // If geometry is not indexed
        else if (clonedGeometry.attributes.position) {
            const positions = clonedGeometry.attributes.position.array;
            const newPositionsCount = Math.floor(positions.length * ratio);
            // Ensure count is divisible by 9
            const adjustedCount = Math.floor(newPositionsCount / 9) * 9;

            const newPositions = new Float32Array(adjustedCount);

            // Sample triangles evenly
            const stride = Math.max(1, Math.floor(1 / ratio));
            for (let i = 0, j = 0; i < adjustedCount; i += 9, j += 9 * stride) {
                // Copy entire triangles
                const baseIndex = (j % (positions.length - 8));
                for (let k = 0; k < 9; k++) {
                    newPositions[i + k] = positions[baseIndex + k];
                }
            }

            // Update position attribute
            clonedGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));

            // Update other attributes (normals, UVs, etc.)
            if (clonedGeometry.attributes.normal) {
                const normals = clonedGeometry.attributes.normal.array;
                const newNormals = new Float32Array(adjustedCount);
                for (let i = 0, j = 0; i < adjustedCount; i += 9, j += 9 * stride) {
                    const baseIndex = (j % (normals.length - 8));
                    for (let k = 0; k < 9; k++) {
                        newNormals[i + k] = normals[baseIndex + k];
                    }
                }
                clonedGeometry.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
            }

            if (clonedGeometry.attributes.uv) {
                const uvs = clonedGeometry.attributes.uv.array;
                const newUVs = new Float32Array(adjustedCount / 3 * 2);
                for (let i = 0, j = 0; i < adjustedCount / 3 * 2; i += 6, j += 6 * stride) {
                    const baseIndex = (j % (uvs.length - 5));
                    for (let k = 0; k < 6; k++) {
                        newUVs[i + k] = uvs[baseIndex + k];
                    }
                }
                clonedGeometry.setAttribute('uv', new THREE.BufferAttribute(newUVs, 2));
            }
        }

        // Cleanup and optimization
        clonedGeometry.computeBoundingSphere();
        clonedGeometry.computeBoundingBox();

        // OPTIMIZATION: Remove any non-essential attributes
        const essentialAttributes = ['position', 'normal', 'uv'];
        for (const key in clonedGeometry.attributes) {
            if (!essentialAttributes.includes(key)) {
                clonedGeometry.deleteAttribute(key);
            }
        }

        return clonedGeometry;
    };

    // Function to preload textures
    const preloadTexturesForModels = async (modelIds) => {
        if (!textureManager) return {};

        const loadedTextures = {};

        // Load textures for each model in parallel
        const texturePromises = modelIds.map(async (modelId) => {
            if (textureManager.hasTextures(modelId)) {
                try {
                    const textures = await textureManager.preloadTexturesForModel(modelId);
                    if (textures) {
                        loadedTextures[modelId] = textures;
                    }
                } catch (error) {
                    console.warn(`Error preloading textures for ${modelId}:`, error);
                }
            }
        });

        await Promise.all(texturePromises);
        return loadedTextures;
    };

    // Check frustum culling
    const isInFrustum = (boundingSphere, frustum) => {
        return frustum.intersectsSphere(boundingSphere);
    };

    // Update LODs - optimized to reduce state changes
    const updateLODs = () => {
        // Skip frames to reduce update frequency
        frameSkipRef.current++;
        if (frameSkipRef.current < FRAME_SKIP) {
            animationFrameIdRef.current = requestAnimationFrame(updateLODs);
            return;
        }
        frameSkipRef.current = 0;

        // Reset processing flags
        // resetProcessingFlags();

        if (camera && lodInstancesRef.current.length > 0) {
            const cameraPosition = camera.position;

            // Update frustum for culling
            projScreenMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

            const trunkThinMap = new Map();

            // Reset visible instance counter
            instanceStatsRef.current.visibleInstances = 0;

            lodInstancesRef.current.forEach(instance => {
                if (!instance.userData) return;

                const objectId = instance.userData.objectId;

                // Create key based on position to identify pairs
                const posKey = instance.userData.chunkCenter ? `${instance.userData.chunkCenter.x.toFixed(2)}_${instance.userData.chunkCenter.y.toFixed(2)}_${instance.userData.chunkCenter.z.toFixed(2)}` : null;

                if (!posKey) return;

                // Store instance in appropriate map with custom threshold
                if (objectId === 'TrunkThin') {
                    // Calculate custom threshold for this chunk if not already done
                    if (!instance.userData.customSwitchThreshold && instance.userData.chunkId) {
                        const [_, chunkX, chunkZ] = instance.userData.chunkId.split('_').map(Number);
                        instance.userData.customSwitchThreshold = getChunkCustomThreshold(instance.userData.chunkId, chunkX || 0, chunkZ || 0);
                    }
                    trunkThinMap.set(posKey, instance);
                }

            });

            // Second pass: update visibility of all objects
            lodInstancesRef.current.forEach(instance => {
                if (!instance.userData) return;

                // Calculate distance to chunk center
                const chunkCenter = instance.userData.chunkCenter;
                if (!chunkCenter) return;

                const distance = chunkCenter.distanceTo(cameraPosition);

                // Check frustum culling first (major optimization)
                const visible = isInFrustum(instance.userData.boundingSphere, frustumRef.current);


                // Standard logic for other objects
                if (visible) {
                    // Check if this LOD level should be visible based on distance
                    const minDistance = instance.userData.minDistance || 0;
                    const maxDistance = instance.userData.maxDistance || Infinity;

                    // Define visibility based on distance
                    instance.visible = (distance >= minDistance && distance < maxDistance);

                    // Count visible instances
                    if (instance.visible) {
                        instanceStatsRef.current.visibleInstances += instance.count || 0;
                    }
                } else {
                    // Not in view frustum, hide it
                    instance.visible = false;
                }
            });

            // Periodically log statistics (every ~5 seconds)
            const now = performance.now();
            if (now - instanceStatsRef.current.lastUpdate > 5000) {
                instanceStatsRef.current.lastUpdate = now;
                console.log('Forest performance stats:', {
                    totalInstances: instanceStatsRef.current.totalInstances,
                    visibleInstances: instanceStatsRef.current.visibleInstances,
                    visiblePercent: Math.round((instanceStatsRef.current.visibleInstances / instanceStatsRef.current.totalInstances) * 100) + '%',
                    instancedMeshCount: instanceStatsRef.current.instancedMeshes,
                });
            }
        }

        // Continue animation loop
        animationFrameIdRef.current = requestAnimationFrame(updateLODs);
    };

    // Complete cleanup function
    const cleanupResources = () => {
        // Cancel animation frame
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }

        // Nettoyer le timer de stabilité
        if (cameraStabilityTimerRef.current) {
            clearTimeout(cameraStabilityTimerRef.current);
            cameraStabilityTimerRef.current = null;
        }

        // Marquer le chargement comme non terminé
        window.forestLoadingComplete = false;

        // Clean up event listeners
        EventBus.off('tree-positions-ready');

        // Clean up instances
        if (forestRef.current) {
            scene.remove(forestRef.current);

            // Efficiently clean up instances
            lodInstancesRef.current.forEach(instance => {
                if (instance.geometry && !instance.geometry.isInstancedBufferGeometry) {
                    instance.geometry.dispose();
                }
                // Material cleanup is now handled by the GeometryCache
            });

            lodInstancesRef.current = [];
        }

        // Clear geometry cache
        if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE) {
            GeometryCache.clear();
        }
    };

    return null;
}