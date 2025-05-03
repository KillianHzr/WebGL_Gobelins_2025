import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';
import useStore from '../Store/useStore';
import templateManager from '../Config/TemplateManager';
import {textureManager} from '../Config/TextureManager';
import {MeshStandardMaterial} from "three";

// -------------------- CONFIGURABLE LOD PARAMETERS --------------------
const LOD_CONFIG = {
    MAX_DETAIL_DISTANCE: 60,
    MIN_DETAIL_DISTANCE: 90,
    LOD_LEVELS: 2,
    MIN_DETAIL_PERCENTAGE: 0.1,
    DEBUG_LOD: false
};

// Nouveau: Configuration du chargement progressif
const LOADING_CONFIG = {
    // Nombre maximum d'objets à charger par lot
    BATCH_SIZE: 5,
    // Délai entre les lots (ms)
    BATCH_DELAY: 20,
    // Rayon autour de la caméra pour la priorisation
    PRIORITY_RADIUS: 100,
    // Nombre maximum de threads WebWorker pour la géométrie
    MAX_WORKERS: 2,
    // Active le cache de géométrie
    ENABLE_GEOMETRY_CACHE: true,
    // Taille du chunk pour le regroupement des instances
    CHUNK_SIZE: 40
};
// ----------------------------------------------------------------------

// Nouveau: Cache de géométrie partagé entre les instances
const GeometryCache = {
    cache: new Map(),

    getKey(objectId, detailLevel) {
        return `${objectId}_lod_${detailLevel.toFixed(2)}`;
    },

    has(objectId, detailLevel) {
        return this.cache.has(this.getKey(objectId, detailLevel));
    },

    get(objectId, detailLevel) {
        return this.cache.get(this.getKey(objectId, detailLevel));
    },

    set(objectId, detailLevel, geometry) {
        this.cache.set(this.getKey(objectId, detailLevel), geometry);
    },

    clear() {
        this.cache.forEach(geometry => {
            if (geometry && geometry.dispose) {
                geometry.dispose();
            }
        });
        this.cache.clear();
    }
};

export default function Forest() {
    const {scene, camera} = useThree();
    const forestRef = useRef(new THREE.Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    // Refs pour stocker les données et l'état
    const objectPositionsRef = useRef(null);
    const objectModelsRef = useRef(null);
    const objectsLoadedRef = useRef(false);
    const lodInstancesRef = useRef([]);
    const animationFrameIdRef = useRef(null);
    const frameSkipRef = useRef(0);
    const FRAME_SKIP = 2;

    // Nouveaux refs pour le chargement prioritaire
    const loadingQueueRef = useRef([]);
    const isLoadingRef = useRef(false);
    const loadedChunksRef = useRef(new Set());
    const workerPoolRef = useRef([]);

    // Refs pour le frustum culling
    const frustumRef = useRef(new THREE.Frustum());
    const projScreenMatrixRef = useRef(new THREE.Matrix4());

    useEffect(() => {
        console.log('Forest: Component mounted');
        console.log(`LOD Configuration: Max detail at ${LOD_CONFIG.MAX_DETAIL_DISTANCE} units, ` +
            `Min detail at ${LOD_CONFIG.MIN_DETAIL_DISTANCE} units, ` +
            `Using ${LOD_CONFIG.LOD_LEVELS} levels`);

        // Créer le groupe principal
        const forestGroup = new THREE.Group();
        forestGroup.name = 'Forest';
        scene.add(forestGroup);
        forestRef.current = forestGroup;

        // Nouveau: Initialiser le pool de workers
        initializeWorkerPool();

        // Charger les données de la forêt
        initForestLoading();

        // Nettoyer les ressources
        return () => {
            cleanupResources();
        };
    }, [scene, camera, assetManager]);

    // Nouveau: Initialiser le pool de workers pour la création de géométrie
    const initializeWorkerPool = () => {
        // On pourrait implémenter ici un pool de Web Workers pour la création de géométrie
        // Mais pour la simplicité, nous allons simuler le comportement
        workerPoolRef.current = Array(LOADING_CONFIG.MAX_WORKERS).fill(null).map(() => ({
            busy: false,
            id: Math.random().toString(36).substring(7)
        }));
    };

    // Nouveau: Fonction principale de chargement de la forêt
    const initForestLoading = async () => {
        try {
            // 1. Charger les positions d'abord
            const positions = await loadObjectPositions();
            if (!positions) {
                console.error('Failed to load tree positions');
                return;
            }
            objectPositionsRef.current = positions;
            useStore.getState().setTreePositions(positions);

            // 2. Charger les modèles nécessaires (optimisé avec Promise.all)
            const models = await loadObjectModelsOptimized();
            if (!models) {
                console.error('Failed to load tree models');
                return;
            }
            objectModelsRef.current = models;

            // 3. Préparer la file d'attente de chargement prioritaire
            prepareLoadingQueue(positions);

            // 4. Commencer le chargement progressif
            startProgressiveLoading();

            // 5. Démarrer la boucle de mise à jour LOD
            updateLODs();

        } catch (error) {
            console.error('Error initializing forest:', error);
        }
    };

    // Optimisé: Chargement des positions
    const loadObjectPositions = async () => {
        try {
            console.log('Loading object positions from JSON...');

            // Essayer les chemins possibles
            const paths = [
                './data/treePositions.json',
                '/data/treePositions.json',
                '../data/treePositions.json',
                'treePositions.json'
            ];

            // Promise.race pour prendre le premier chemin qui fonctionne
            const fetchPromises = paths.map(path =>
                fetch(path)
                    .then(response => {
                        if (!response.ok) throw new Error(`Path ${path} failed`);
                        return response.json();
                    })
                    .then(data => {
                        console.log(`Successfully loaded from ${path}`);
                        return data;
                    })
                    .catch(err => {
                        console.log(`Path ${path} failed:`, err.message);
                        return null;
                    })
            );

            // Ajouter un fallback pour le store
            const storePromise = new Promise(resolve => {
                const storePositions = useStore.getState().treePositions;
                if (storePositions) {
                    console.log('Using positions from store');
                    resolve(storePositions);
                } else {
                    resolve(null);
                }
            });

            // Prendre le premier résultat valide
            const results = await Promise.all([...fetchPromises, storePromise]);
            const validResult = results.find(result => result !== null);

            if (validResult) {
                console.log('Object positions loaded successfully');
                return validResult;
            }

            console.error('Could not load object positions from any source');
            return null;
        } catch (error) {
            console.error('Error loading object positions:', error);
            return useStore.getState().treePositions || null;
        }
    };

    // Optimisé: Chargement des modèles utilisant des promesses
    const loadObjectModelsOptimized = async () => {
        if (!assetManager) {
            console.warn('AssetManager not available');
            return null;
        }

        try {
            // Obtenir les infos sur les assets requis
            const requiredAssetsInfo = templateManager.getRequiredAssets();
            const requiredAssetNames = requiredAssetsInfo.map(asset => asset.name);

            console.log(`Loading ${requiredAssetNames.length} models...`);

            // Créer un objet de promesses pour chaque asset
            const modelPromises = requiredAssetNames.map(assetName => {
                return new Promise(resolve => {
                    // Vérifier si le modèle est déjà chargé
                    const model = assetManager.getItem(assetName);
                    if (model) {
                        resolve({ name: assetName, model });
                        return;
                    }

                    // Sinon, écouter l'événement de chargement
                    const onAssetLoaded = (loadedName, loadedModel) => {
                        if (loadedName === assetName) {
                            // Désabonner pour éviter les fuites de mémoire
                            assetManager.off('assetLoaded', onAssetLoaded);
                            resolve({ name: assetName, model: loadedModel });
                        }
                    };

                    // S'abonner à l'événement
                    assetManager.on('assetLoaded', onAssetLoaded);

                    // Demander le chargement si nécessaire
                    if (!assetManager.isLoading(assetName)) {
                        assetManager.loadAsset(assetName);
                    }
                });
            });

            // Attendre que tous les modèles soient chargés
            const loadedModels = await Promise.all(modelPromises);

            // Convertir en objet
            const modelObject = {};
            loadedModels.forEach(({ name, model }) => {
                modelObject[name] = model;
            });

            console.log('All models loaded successfully:', Object.keys(modelObject));
            return modelObject;
        } catch (error) {
            console.error('Error loading models:', error);
            return null;
        }
    };

    // Nouveau: Préparation de la file d'attente de chargement
    const prepareLoadingQueue = (positions) => {
        if (!positions || !camera) return;

        const queue = [];
        const cameraPosition = camera.position.clone();
        const CHUNK_SIZE = LOADING_CONFIG.CHUNK_SIZE;

        // Créer des chunks pour chaque type d'objet
        Object.keys(positions).forEach(objectId => {
            if (objectId === templateManager.undefinedCategory ||
                !positions[objectId] ||
                positions[objectId].length === 0) {
                return;
            }

            // Regrouper par chunks pour le chargement
            const chunks = {};

            positions[objectId].forEach(pos => {
                const chunkX = Math.floor(pos.x / CHUNK_SIZE);
                const chunkZ = Math.floor(pos.z / CHUNK_SIZE);
                const chunkId = `${objectId}_${chunkX}_${chunkZ}`;

                if (!chunks[chunkId]) {
                    chunks[chunkId] = {
                        objectId,
                        chunkX,
                        chunkZ,
                        chunkId,
                        positions: [],
                        center: new THREE.Vector3(
                            (chunkX + 0.5) * CHUNK_SIZE,
                            0,
                            (chunkZ + 0.5) * CHUNK_SIZE
                        )
                    };
                }

                chunks[chunkId].positions.push(pos);
            });

            // Ajouter les chunks à la file d'attente
            Object.values(chunks).forEach(chunk => {
                // Calculer la distance à la caméra pour la priorité
                const distanceToCamera = chunk.center.distanceTo(cameraPosition);

                queue.push({
                    ...chunk,
                    distanceToCamera,
                    priority: distanceToCamera <= LOADING_CONFIG.PRIORITY_RADIUS ? 1 : 0
                });
            });
        });

        // Trier la file d'attente par priorité et distance
        queue.sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return a.distanceToCamera - b.distanceToCamera;
        });

        console.log(`Prepared loading queue with ${queue.length} chunks, sorted by distance`);
        loadingQueueRef.current = queue;
    };

    // Nouveau: Lancement du chargement progressif
    const startProgressiveLoading = () => {
        if (isLoadingRef.current || loadingQueueRef.current.length === 0) return;

        isLoadingRef.current = true;
        processNextBatch();
    };

    // Nouveau: Traitement d'un lot de chunks
    const processNextBatch = async () => {
        const queue = loadingQueueRef.current;

        if (queue.length === 0) {
            console.log('Progressive loading complete');
            isLoadingRef.current = false;

            // Déclencher l'événement quand tout est chargé
            EventBus.trigger('forest-ready');
            objectsLoadedRef.current = true;
            return;
        }

        // Prendre un lot de chunks à traiter
        const batch = queue.splice(0, LOADING_CONFIG.BATCH_SIZE);
        // console.log(`Processing batch of ${batch.length} chunks, ${queue.length} remaining`);

        // Précharger les textures pour les types d'objets du lot
        const objectTypes = [...new Set(batch.map(chunk => chunk.objectId))];
        const preloadedTextures = await preloadTexturesForModels(objectTypes);

        // Traiter chaque chunk du lot en parallèle
        await Promise.all(batch.map(chunk =>
            createChunkInstances(chunk, preloadedTextures)
        ));

        // Planifier le prochain lot après un court délai
        setTimeout(() => {
            processNextBatch();
        }, LOADING_CONFIG.BATCH_DELAY);
    };

    // Nouveau: Création des instances pour un chunk
    const createChunkInstances = async (chunk, preloadedTextures) => {
        const { objectId, chunkId, positions, center } = chunk;

        // Vérifier si ce chunk a déjà été traité
        if (loadedChunksRef.current.has(chunkId)) {
            return;
        }

        // Marquer comme traité
        loadedChunksRef.current.add(chunkId);

        try {
            // Récupérer le modèle
            const model = objectModelsRef.current[objectId];
            if (!model) {
                console.warn(`Model not found for ${objectId}`);
                return;
            }

            // Créer les instances LOD pour ce chunk
            const instances = await createLodInstancedMeshesForChunk(
                objectId,
                model,
                positions,
                preloadedTextures,
                center,
                chunkId
            );

            // Ajouter les instances au groupe de la forêt et à la liste des instances
            instances.forEach(instance => {
                forestRef.current.add(instance);
                lodInstancesRef.current.push(instance);
            });

        } catch (error) {
            console.error(`Error creating instances for chunk ${chunkId}:`, error);
        }
    };

    // Modifié: Création des instances LOD pour un chunk spécifique
    /**
     * Extrait optimisé de Forest.jsx qui concerne la création des instances et l'application des textures
     * Cette version utilise le TextureManagerOptimized pour éviter les duplications de textures
     */

// Modifié: Création des instances LOD pour un chunk spécifique
    const createLodInstancedMeshesForChunk = async (objectId, model, positions, preloadedTextures, chunkCenter, chunkId) => {
        if (!positions || positions.length === 0) {
            return [];
        }

        // Trouver la géométrie
        let geometry = null;

        // Extraire la géométrie du premier mesh
        model.scene.traverse((child) => {
            if (child.isMesh && child.geometry && !geometry) {
                geometry = child.geometry.clone();
            }
        });

        if (!geometry) {
            console.warn(`No geometry found in ${objectId} model`);
            return [];
        }

        // OPTIMISATION: Au lieu de créer un nouveau matériau chaque fois,
        // utiliser le gestionnaire de textures optimisé pour obtenir un matériau réutilisable
        const material = textureManager.getMaterial(objectId, {
            aoIntensity: 0.0,
            alphaTest: 1.0
        });

        // Créer les instances LOD
        const instances = [];
        const lodLevels = LOD_CONFIG.LOD_LEVELS;
        const distanceRange = LOD_CONFIG.MIN_DETAIL_DISTANCE - LOD_CONFIG.MAX_DETAIL_DISTANCE;

        // Créer un objet temporaire pour les calculs de matrices
        const dummy = new THREE.Object3D();

        // Créer les meshes instanciés pour chaque niveau LOD
        for (let level = 0; level < lodLevels; level++) {
            // Calculer le niveau de détail
            const detailLevel = level === 0 ? 1.0 : 1.0 - (level / (lodLevels - 1));

            // Calculer la plage de distance pour ce niveau LOD
            const minDistance = level === 0 ? 0 :
                LOD_CONFIG.MAX_DETAIL_DISTANCE +
                (level - 1) / (lodLevels - 1) * distanceRange;

            const maxDistance = level === lodLevels - 1 ? Infinity :
                LOD_CONFIG.MAX_DETAIL_DISTANCE +
                level / (lodLevels - 1) * distanceRange;

            // Vérifier le cache de géométrie ou créer une géométrie simplifiée
            let levelGeometry;

            if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE && GeometryCache.has(objectId, detailLevel)) {
                levelGeometry = GeometryCache.get(objectId, detailLevel);
            } else {
                // Créer une nouvelle géométrie simplifiée
                levelGeometry = await createSimplifiedGeometryAsync(geometry, detailLevel, objectId);

                // Mettre en cache pour réutilisation
                if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE) {
                    GeometryCache.set(objectId, detailLevel, levelGeometry);
                }
            }

            if (!levelGeometry) continue;

            // OPTIMISATION: Utilisation du même matériau de référence partagé
            // au lieu de créer une copie avec material.clone()
            const instancedMesh = new THREE.InstancedMesh(
                levelGeometry,
                material,  // Réutilisation du même matériau - pas de clone()
                positions.length
            );

            instancedMesh.name = `${objectId}_lod${level}_chunk${chunkId}`;
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;

            // Définir les propriétés personnalisées pour la gestion LOD
            instancedMesh.userData.lodLevel = level;
            instancedMesh.userData.minDistance = minDistance;
            instancedMesh.userData.maxDistance = maxDistance;
            instancedMesh.userData.chunkCenter = chunkCenter;
            instancedMesh.userData.objectId = objectId;

            // Calculer la sphère englobante pour le frustum culling
            const boundingSphere = new THREE.Sphere(
                chunkCenter.clone(),
                LOADING_CONFIG.CHUNK_SIZE * Math.sqrt(2)
            );
            instancedMesh.userData.boundingSphere = boundingSphere;

            // Définir les matrices d'instance
            positions.forEach((pos, index) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(pos.rotationX, pos.rotationY, pos.rotationZ);
                dummy.scale.set(pos.scaleX, pos.scaleY, pos.scaleZ);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            });

            // Mettre à jour les matrices d'instance
            instancedMesh.instanceMatrix.needsUpdate = true;

            // Ajouter à la liste d'instances
            instances.push(instancedMesh);

            if (LOD_CONFIG.DEBUG_LOD) {
                console.log(`Created LOD level ${level} for ${objectId} chunk ${chunkId}: ` +
                    `Detail ${(detailLevel * 100).toFixed(0)}% ` +
                    `Range ${minDistance.toFixed(1)} - ${maxDistance === Infinity ? 'Infinity' : maxDistance.toFixed(1)} units`);
            }
        }

        return instances;
    };

    // Nouveau: Version asynchrone pour la création de géométrie simplifiée
    const createSimplifiedGeometryAsync = (geometry, detailLevel, objectId) => {
        return new Promise(resolve => {
            // Pour les détails maximaux, pas besoin de simplifier
            if (detailLevel >= 0.999) {
                resolve(geometry.clone());
                return;
            }

            // Utiliser un worker disponible ou exécuter dans le thread principal
            const availableWorker = workerPoolRef.current.find(worker => !worker.busy);

            if (availableWorker) {
                // Simuler un worker asynchrone pour les opérations lourdes
                availableWorker.busy = true;

                setTimeout(() => {
                    const simplifiedGeometry = createSimplifiedGeometry(geometry, detailLevel, objectId);
                    availableWorker.busy = false;
                    resolve(simplifiedGeometry);
                }, 0);
            } else {
                // Aucun worker disponible, exécuter dans le thread principal
                const simplifiedGeometry = createSimplifiedGeometry(geometry, detailLevel, objectId);
                resolve(simplifiedGeometry);
            }
        });
    };

    // Fonction de création de géométrie simplifiée (non modifiée)
    const createSimplifiedGeometry = (geometry, detailLevel, objectId) => {
        if (!geometry) return null;

        // Cloner la géométrie pour éviter de modifier l'originale
        const clonedGeometry = geometry.clone();

        // Si c'est le niveau de détail maximum, retourner la géométrie originale
        if (detailLevel >= 0.999) {
            return clonedGeometry;
        }

        // Calculer le ratio de triangles à conserver
        // Interpolation linéaire entre MIN_DETAIL_PERCENTAGE et 1.0
        const ratio = LOD_CONFIG.MIN_DETAIL_PERCENTAGE +
            (1.0 - LOD_CONFIG.MIN_DETAIL_PERCENTAGE) * detailLevel;

        if (LOD_CONFIG.DEBUG_LOD) {
            console.log(`Creating simplified geometry for ${objectId} at detail level ${detailLevel.toFixed(2)}, ` +
                `keeping ${(ratio * 100).toFixed(1)}% of triangles`);
        }

        // Si la géométrie a un buffer d'index (triangles)
        if (clonedGeometry.index) {
            const indices = clonedGeometry.index.array;
            const newIndicesCount = Math.floor(indices.length * ratio);
            // S'assurer que le compte est divisible par 3 (pour des triangles complets)
            const adjustedCount = Math.floor(newIndicesCount / 3) * 3;

            // Créer un nouveau buffer d'indices avec moins de triangles
            const newIndices = new Uint32Array(adjustedCount);

            // Échantillonner les triangles uniformément
            const stride = Math.max(1, Math.floor(1 / ratio));
            for (let i = 0, j = 0; i < adjustedCount; i += 3, j += 3 * stride) {
                // Conserver les triangles à des intervalles réguliers
                const baseIndex = (j % (indices.length - 2));
                newIndices[i] = indices[baseIndex];
                newIndices[i + 1] = indices[baseIndex + 1];
                newIndices[i + 2] = indices[baseIndex + 2];
            }

            clonedGeometry.setIndex(new THREE.BufferAttribute(newIndices, 1));
        }
        // Si la géométrie n'est pas indexée
        else if (clonedGeometry.attributes.position) {
            const positions = clonedGeometry.attributes.position.array;
            const newPositionsCount = Math.floor(positions.length * ratio);
            // S'assurer que le compte est divisible par 9
            const adjustedCount = Math.floor(newPositionsCount / 9) * 9;

            const newPositions = new Float32Array(adjustedCount);

            // Échantillonner les triangles uniformément
            const stride = Math.max(1, Math.floor(1 / ratio));
            for (let i = 0, j = 0; i < adjustedCount; i += 9, j += 9 * stride) {
                // Copier des triangles entiers
                const baseIndex = (j % (positions.length - 8));
                for (let k = 0; k < 9; k++) {
                    newPositions[i + k] = positions[baseIndex + k];
                }
            }

            // Mettre à jour l'attribut de position
            clonedGeometry.setAttribute('position',
                new THREE.BufferAttribute(newPositions, 3));

            // Mettre à jour les autres attributs (normales, UVs, etc.)
            if (clonedGeometry.attributes.normal) {
                const normals = clonedGeometry.attributes.normal.array;
                const newNormals = new Float32Array(adjustedCount);
                for (let i = 0, j = 0; i < adjustedCount; i += 9, j += 9 * stride) {
                    const baseIndex = (j % (normals.length - 8));
                    for (let k = 0; k < 9; k++) {
                        newNormals[i + k] = normals[baseIndex + k];
                    }
                }
                clonedGeometry.setAttribute('normal',
                    new THREE.BufferAttribute(newNormals, 3));
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
                clonedGeometry.setAttribute('uv',
                    new THREE.BufferAttribute(newUVs, 2));
            }
        }

        // Nettoyage et optimisation
        clonedGeometry.computeBoundingSphere();
        clonedGeometry.computeBoundingBox();

        return clonedGeometry;
    };

    // Fonction de préchargement des textures originale (non modifiée)
    const preloadTexturesForModels = async (modelIds) => {
        if (!textureManager) return {};

        // console.log('Preloading textures for all models...');
        const loadedTextures = {};

        // Load textures for each model in parallel
        const texturePromises = modelIds.map(async (modelId) => {
            if (textureManager.hasTextures(modelId)) {
                try {
                    const textures = await textureManager.preloadTexturesForModel(modelId);
                    if (textures) {
                        loadedTextures[modelId] = textures;
                        // console.log(`Textures preloaded for ${modelId}`);
                    }
                } catch (error) {
                    console.warn(`Error preloading textures for ${modelId}:`, error);
                }
            }
        });

        await Promise.all(texturePromises);
        return loadedTextures;
    };

    // Vérification du frustum culling (non modifiée)
    const isInFrustum = (boundingSphere, frustum) => {
        return frustum.intersectsSphere(boundingSphere);
    };

    // Mise à jour des LOD (non modifiée)
    const updateLODs = () => {
        // Sauter des frames pour réduire la fréquence de mise à jour
        frameSkipRef.current++;
        if (frameSkipRef.current < FRAME_SKIP) {
            animationFrameIdRef.current = requestAnimationFrame(updateLODs);
            return;
        }
        frameSkipRef.current = 0;

        if (camera && lodInstancesRef.current.length > 0) {
            const cameraPosition = camera.position;

            // Mettre à jour le frustum pour le culling
            projScreenMatrixRef.current.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            );
            frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

            // Mettre à jour la visibilité des LOD pour tous les meshes instanciés
            lodInstancesRef.current.forEach(instance => {
                if (!instance.userData) return;

                // Calculer la distance au centre du chunk
                const chunkCenter = instance.userData.chunkCenter;
                if (!chunkCenter) return;

                const distance = chunkCenter.distanceTo(cameraPosition);

                // Vérifier d'abord le frustum culling (optimisation majeure)
                const visible = isInFrustum(instance.userData.boundingSphere, frustumRef.current);

                if (visible) {
                    // Vérifier si ce niveau LOD doit être visible en fonction de la distance
                    const minDistance = instance.userData.minDistance || 0;
                    const maxDistance = instance.userData.maxDistance || Infinity;

                    // Définir la visibilité en fonction de la distance
                    instance.visible = (distance >= minDistance && distance < maxDistance);
                } else {
                    // Pas dans le frustum de vue, le cacher
                    instance.visible = false;
                }

                // Logging de débogage pour les premières instances
                if (LOD_CONFIG.DEBUG_LOD && Math.random() < 0.001) {
                    console.log(`LOD update for ${instance.name}: ` +
                        `distance=${distance.toFixed(1)}, ` +
                        `range=${minDistance?.toFixed(1) || 0}-${maxDistance === Infinity ? 'Infinity' : maxDistance?.toFixed(1)}, ` +
                        `visible=${instance.visible}, in frustum=${visible}`);
                }
            });
        }

        // Continuer la boucle d'animation
        animationFrameIdRef.current = requestAnimationFrame(updateLODs);
    };

    // Fonction de nettoyage complète
    const cleanupResources = () => {
        // Annuler la frame d'animation
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }

        // Nettoyer les écouteurs d'événements
        EventBus.off('tree-positions-ready');

        // Nettoyer les instances
        if (forestRef.current) {
            scene.remove(forestRef.current);

            // Nettoyer efficacement les instances
            lodInstancesRef.current.forEach(instance => {
                if (instance.geometry && !instance.geometry.isInstancedBufferGeometry) {
                    instance.geometry.dispose();
                }
                if (instance.material) {
                    if (Array.isArray(instance.material)) {
                        instance.material.forEach(mat => mat.dispose());
                    } else {
                        instance.material.dispose();
                    }
                }
            });

            lodInstancesRef.current = [];
        }

        // Vider le cache de géométrie
        if (LOADING_CONFIG.ENABLE_GEOMETRY_CACHE) {
            GeometryCache.clear();
        }
    };

    return null;
}