import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';
import useStore from '../Store/useStore';
import templateManager from '../Config/TemplateManager';
import {textureManager} from '../Config/TextureManager';

// -------------------- OPTIMIZED LOD PARAMETERS --------------------
const LOD_CONFIG = {
    MAX_DETAIL_DISTANCE: 60, MIN_DETAIL_DISTANCE: 90, LOD_LEVELS: 1, MIN_DETAIL_PERCENTAGE: 0.15, DEBUG_LOD: false
};

const TRUNK_SWITCH_CONFIG = {
    SWITCH_DISTANCE: 35, SWITCH_RANGE: 7, CHUNK_SIZE: 20, DEBUG_SWITCH: false
};

// Optimized loading configuration
const LOADING_CONFIG = {
    BATCH_SIZE: 10, BATCH_DELAY: 20, PRIORITY_RADIUS: 100, MAX_WORKERS: 2, ENABLE_GEOMETRY_CACHE: true, CHUNK_SIZE: 60
};
// ----------------------------------------------------------------------

// Improved geometry cache with better memory management
const GeometryCache = {
    cache: new Map(), materials: new Map(), // New: Global material cache for strict reuse
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

    // New: Get or create shared material
    getMaterial(objectId, properties = {}) {
        if (!this.materials.has(objectId)) {
            // Create a new material if it doesn't exist
            const material = textureManager.getMaterial(objectId, {
                aoIntensity: 0.0, alphaTest: 1.0, ...properties
            });

            // Important: Optimize material for instance rendering
            if (material) {
                material.uniformsNeedUpdate = false;
                // Disable material features that cause additional draw calls
                material.needsUpdate = false;

                // Store in cache
                this.materials.set(objectId, material);
            }
            return material;
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

        // Also dispose materials when clearing cache
        this.materials.forEach(material => {
            if (material && material.dispose) {
                material.dispose();
            }
        });
        this.materials.clear();
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

    // Refs for data and state
    const objectPositionsRef = useRef(null);
    const objectModelsRef = useRef(null);
    const objectsLoadedRef = useRef(false);
    const lodInstancesRef = useRef([]);
    const animationFrameIdRef = useRef(null);
    const frameSkipRef = useRef(0);
    const FRAME_SKIP = 2;

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

        // Trigger events to notify other components about initial visibility
        EventBus.trigger('end-group-visibility-changed', true);
        EventBus.trigger('screen-group-visibility-changed', false);

        console.log('Default scene group visibility set: endGroup=visible, screenGroup=hidden');

        const endGroupUnsubscribe = EventBus.on('end-group-visibility-changed', (visible) => {
            console.log(`Événement reçu: end-group-visibility-changed -> ${visible ? 'visible' : 'caché'}`);
        });
        const screenGroupUnsubscribe = EventBus.on('screen-group-visibility-changed', (visible) => {
            console.log(`Événement reçu: screen-group-visibility-changed -> ${visible ? 'visible' : 'caché'}`);
        });

        // Initialize worker pool
        initializeWorkerPool();

        // Load forest data
        initForestLoading();

        // forceGroupVisibility(true);

        // Clean up resources
        return () => {
            cleanupResources();
            endGroupUnsubscribe();
            screenGroupUnsubscribe();
        };
    }, [scene, camera, assetManager]);


    useEffect(() => {
        // Exposer les références des groupes au niveau global pour l'accès externe
        window.endGroupRef = endGroupRef;
        window.screenGroupRef = screenGroupRef;
        window.endGroupRef.current.visible = true;
        window.screenGroupRef.current.visible = false;

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
            // 1. Load positions first
            const positions = await loadObjectPositions();
            if (!positions) {
                console.error('Failed to load tree positions');
                return;
            }
            objectPositionsRef.current = positions;
            useStore.getState().setTreePositions(positions);

            // 2. Load necessary models (optimized with Promise.all)
            const models = await loadObjectModelsOptimized();
            if (!models) {
                console.error('Failed to load tree models');
                return;
            }
            objectModelsRef.current = models;

            // 3. Prepare priority loading queue - now with type grouping
            prepareLoadingQueue(positions);

            // 4. Start progressive loading
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
        processNextBatch();
    };

    // Process a batch of chunks
    const processNextBatch = async () => {
        const queue = loadingQueueRef.current;

        if (queue.length === 0) {
            isLoadingRef.current = false;

            // Trigger event when everything is loaded
            EventBus.trigger('forest-ready');
            objectsLoadedRef.current = true;

            // Log material and geometry cache stats
            console.log('Forest loading complete!', {
                instancedMeshes: lodInstancesRef.current.length,
                geometryCacheStats: GeometryCache.stats,
                materialCacheSize: GeometryCache.materials.size
            });

            return;
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
                    console.warn(`Model not found for ${objectId}`);
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
                // If it's a TrunkThinPlane, hide it initially
                if (instance.userData.objectId === 'TrunkThinPlane') {
                    instance.visible = false;
                }

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

        // Find geometry
        let geometry = null;

        // Extract geometry from first mesh
        model.scene.traverse((child) => {
            if (child.isMesh && child.geometry && !geometry) {
                geometry = child.geometry.clone();
            }
        });

        if (!geometry) {
            console.warn(`No geometry found in ${objectId} model`);
            return [];
        }

        // OPTIMIZATION: Use global material cache for strict reuse
        const material = GeometryCache.getMaterial(objectId, {
            aoIntensity: 0.0, alphaTest: 1.0
        });

        if (!material) {
            console.warn(`Failed to create material for ${objectId}`);
            return [];
        }

        // Create LOD instances
        const instances = [];
        const lodLevels = LOD_CONFIG.LOD_LEVELS;
        const distanceRange = LOD_CONFIG.MIN_DETAIL_DISTANCE - LOD_CONFIG.MAX_DETAIL_DISTANCE;

        // Create a temporary object for matrix calculations
        const dummy = new THREE.Object3D();

        // Create instanced meshes for each LOD level
        for (let level = 0; level < lodLevels; level++) {
            // Calculate detail level
            const detailLevel = level === 0 ? 1.0 : 1.0 - (level / (lodLevels - 1));

            // Calculate distance range for this LOD level
            const minDistance = level === 0 ? 0 : LOD_CONFIG.MAX_DETAIL_DISTANCE + (level - 1) / (lodLevels - 1) * distanceRange;
            const maxDistance = level === lodLevels - 1 ? Infinity : LOD_CONFIG.MAX_DETAIL_DISTANCE + level / (lodLevels - 1) * distanceRange;

            // Check geometry cache or create simplified geometry
            let levelGeometry;

            if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE && GeometryCache.has(objectId, detailLevel)) {
                levelGeometry = GeometryCache.get(objectId, detailLevel);
            } else {
                // Create new simplified geometry
                levelGeometry = await createOptimizedGeometry(geometry, detailLevel, objectId);

                // Cache for reuse
                if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE) {
                    GeometryCache.set(objectId, detailLevel, levelGeometry);
                }
            }

            if (!levelGeometry) continue;

            // OPTIMIZATION: Use existing material reference
            // Create instanced mesh with efficient parameters
            const instancedMesh = new THREE.InstancedMesh(levelGeometry, material, positions.length);

            // OPTIMIZATION: Set renderOrder by distance to reduce overdraw
            instancedMesh.renderOrder = -minDistance;

            instancedMesh.name = `${objectId}_lod${level}_chunk${chunkId}`;
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;

            // Set custom properties for LOD management
            instancedMesh.userData.lodLevel = level;
            instancedMesh.userData.minDistance = minDistance;
            instancedMesh.userData.maxDistance = maxDistance;
            instancedMesh.userData.chunkCenter = chunkCenter;
            instancedMesh.userData.objectId = objectId;
            instancedMesh.userData.chunkId = chunkId;

            // For TrunkThin, calculate custom threshold
            if (objectId === 'TrunkThin' || objectId === 'TrunkThinPlane') {
                // Extract chunkX and chunkZ from chunkId
                const parts = chunkId.split('_');
                const chunkX = parts.length > 1 ? parseInt(parts[1]) : 0;
                const chunkZ = parts.length > 2 ? parseInt(parts[2]) : 0;

                instancedMesh.userData.customSwitchThreshold = getChunkCustomThreshold(chunkId, chunkX, chunkZ);
            }

            // Calculate bounding sphere for frustum culling
            const boundingSphere = new THREE.Sphere(chunkCenter.clone(), LOADING_CONFIG.CHUNK_SIZE * Math.sqrt(2));
            instancedMesh.userData.boundingSphere = boundingSphere;

            // Set instance matrices
            positions.forEach((pos, index) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(pos.rotationX, pos.rotationY, pos.rotationZ);
                dummy.scale.set(pos.scaleX, pos.scaleY, pos.scaleZ);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            });

            // Update instance matrices
            instancedMesh.instanceMatrix.needsUpdate = true;

            // OPTIMIZATION: Pre-compute bounds for faster culling
            instancedMesh.computeBoundingSphere();
            instancedMesh.computeBoundingBox();

            // Add to instance list
            instances.push(instancedMesh);
        }

        return instances;
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

    const resetProcessingFlags = () => {
        lodInstancesRef.current.forEach(instance => {
            if (instance.userData && (instance.userData.objectId === 'TrunkThin' || instance.userData.objectId === 'TrunkThinPlane')) {
                instance.userData.processed = false;
            }
        });
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
        resetProcessingFlags();

        if (camera && lodInstancesRef.current.length > 0) {
            const cameraPosition = camera.position;

            // Update frustum for culling
            projScreenMatrixRef.current.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

            // Create Maps to store TrunkThin and TrunkThinPlane objects by position
            const trunkThinMap = new Map();
            const trunkThinPlaneMap = new Map();

            // Reset visible instance counter
            instanceStatsRef.current.visibleInstances = 0;

            // First pass: identify and index all TrunkThin and TrunkThinPlane
            lodInstancesRef.current.forEach(instance => {
                if (!instance.userData) return;

                const objectId = instance.userData.objectId;

                // Skip objects other than TrunkThin and TrunkThinPlane
                if (objectId !== 'TrunkThin' && objectId !== 'TrunkThinPlane') return;

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
                } else if (objectId === 'TrunkThinPlane') {
                    trunkThinPlaneMap.set(posKey, instance);
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

                const objectId = instance.userData.objectId;

                // Special logic for TrunkThin and TrunkThinPlane
                if (objectId === 'TrunkThin' || objectId === 'TrunkThinPlane') {
                    // Create position key
                    const posKey = `${chunkCenter.x.toFixed(2)}_${chunkCenter.y.toFixed(2)}_${chunkCenter.z.toFixed(2)}`;

                    if (visible) {
                        if (objectId === 'TrunkThin') {
                            // Use custom threshold if available
                            const switchThreshold = instance.userData.customSwitchThreshold || TRUNK_SWITCH_CONFIG.SWITCH_DISTANCE;

                            // TrunkThin is visible if distance is less than custom threshold
                            instance.visible = distance < switchThreshold;

                            // Update corresponding TrunkThinPlane if found
                            const planeInstance = trunkThinPlaneMap.get(posKey);
                            if (planeInstance) {
                                planeInstance.visible = visible && distance >= switchThreshold;
                                if (planeInstance.visible) {
                                    instanceStatsRef.current.visibleInstances += planeInstance.count || 0;
                                }
                            }
                        } else if (objectId === 'TrunkThinPlane') {
                            // Find corresponding TrunkThin to get threshold
                            const thinInstance = trunkThinMap.get(posKey);
                            const switchThreshold = thinInstance?.userData.customSwitchThreshold || TRUNK_SWITCH_CONFIG.SWITCH_DISTANCE;

                            // TrunkThinPlane is visible if distance is greater or equal to threshold
                            instance.visible = distance >= switchThreshold;

                            // Skip if corresponding TrunkThin already processed, otherwise update
                            if (thinInstance && !thinInstance.userData.processed) {
                                thinInstance.visible = visible && distance < switchThreshold;
                                thinInstance.userData.processed = true; // Mark as processed
                                if (thinInstance.visible) {
                                    instanceStatsRef.current.visibleInstances += thinInstance.count || 0;
                                }
                            }
                        }
                    } else {
                        // Not in frustum, hide
                        instance.visible = false;
                    }
                } else {
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