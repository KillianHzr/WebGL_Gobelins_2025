import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';
import useStore from '../Store/useStore';
import templateManager from '../Config/TemplateManager';
import {textureManager} from '../Config/TextureManager';

export default function Forest() {
    const {scene} = useThree();
    const forestRef = useRef(new THREE.Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    // Utiliser des refs pour éviter les problèmes de re-rendu
    const objectPositionsRef = useRef(null);
    const objectModelsRef = useRef(null);
    const objectsLoadedRef = useRef(false);

    useEffect(() => {
        console.log('Forest: Component mounted');

        // Créer le groupe principal
        const forestGroup = new THREE.Group();
        forestGroup.name = 'Forest';
        scene.add(forestGroup);
        forestRef.current = forestGroup;

        // Charger les données de position depuis le fichier JSON
        const loadObjectPositions = async () => {
            try {
                console.log('Loading object positions from JSON...');

                // Essayer plusieurs chemins possibles
                const paths = [
                    './data/treePositions.json',
                    '/data/treePositions.json',
                    '../data/treePositions.json',
                    'treePositions.json'
                ];

                let objectPositions = null;

                // Essayer tous les chemins jusqu'à trouver le bon
                for (const path of paths) {
                    try {
                        console.log(`Trying path: ${path}`);
                        const response = await fetch(path);
                        if (response.ok) {
                            objectPositions = await response.json();
                            console.log(`Successfully loaded from ${path}`);
                            break;
                        }
                    } catch (err) {
                        console.log(`Path ${path} failed:`, err.message);
                    }
                }

                // Si aucun chemin n'a fonctionné, vérifier si les positions sont déjà dans le store
                if (!objectPositions) {
                    console.log('All paths failed, checking store for positions');
                    objectPositions = useStore.getState().treePositions;
                }

                if (objectPositions) {
                    console.log('Object positions loaded:', objectPositions);
                    return objectPositions;
                } else {
                    console.error('Could not load object positions from any source');
                    return null;
                }
            } catch (error) {
                console.error('Error loading object positions:', error);

                // Essayer de récupérer les positions depuis le store comme fallback
                const storePositions = useStore.getState().treePositions;
                if (storePositions) {
                    console.log('Using positions from store as fallback');
                    return storePositions;
                }
                return null;
            }
        };

        // Charger les modèles d'objets depuis l'assetManager
        const loadObjectModels = async () => {
            if (!assetManager) {
                console.warn('AssetManager not available');
                return null;
            }

            // Obtenir la liste des assets requis
            const requiredAssetsInfo = templateManager.getRequiredAssets();
            const requiredAssetNames = requiredAssetsInfo.map(asset => asset.name);

            // Attendre que tous les modèles soient chargés
            const waitForAssets = () => {
                return new Promise((resolve) => {
                    const checkAssets = () => {
                        const loadedModels = {};
                        let allLoaded = true;

                        // Vérifier si tous les assets requis sont chargés
                        for (const assetName of requiredAssetNames) {
                            const model = assetManager.getItem(assetName);
                            if (model) {
                                loadedModels[assetName] = model;
                            } else {
                                allLoaded = false;
                                break;
                            }
                        }

                        if (allLoaded) {
                            resolve(loadedModels);
                        } else {
                            setTimeout(checkAssets, 100);
                        }
                    };
                    checkAssets();
                });
            };

            try {
                const objectModels = await waitForAssets();
                console.log('Object models loaded:', Object.keys(objectModels));
                return objectModels;
            } catch (error) {
                console.error('Error loading object models:', error);
                return null;
            }
        };

        // Précharger toutes les textures pour les modèles avant de créer les instances
        const preloadTexturesForModels = async (modelIds) => {
            if (!textureManager) return {};

            console.log('Préchargement des textures pour tous les modèles...');
            const loadedTextures = {};

            // Charger les textures pour chaque modèle en parallèle
            const texturePromises = modelIds.map(async (modelId) => {
                if (textureManager.hasTextures(modelId)) {
                    try {
                        const textures = await textureManager.preloadTexturesForModel(modelId);
                        if (textures) {
                            loadedTextures[modelId] = textures;
                            console.log(`Textures préchargées pour ${modelId}`);
                        }
                    } catch (error) {
                        console.warn(`Erreur lors du préchargement des textures pour ${modelId}:`, error);
                    }
                }
            });

            await Promise.all(texturePromises);
            return loadedTextures;
        };

        // Créer un InstancedMesh pour un type d'objet avec textures
        const createInstancedMesh = async (objectId, model, positions, preloadedTextures) => {
            if (!positions || positions.length === 0) {
                console.log(`No positions for ${objectId}`);
                return null;
            }

            console.log(`Creating ${positions.length} instances of ${objectId}`);

            // Trouver la géométrie dans le modèle
            let geometry = null;
            let material = null;

            // Parcourir le modèle à la recherche de la première géométrie/matériau
            model.scene.traverse((child) => {
                if (child.isMesh && child.geometry && !geometry) {
                    geometry = child.geometry.clone();

                    // Cloner le matériau pour pouvoir le modifier
                    if (Array.isArray(child.material)) {
                        material = child.material[0].clone();
                    } else {
                        material = child.material.clone();
                    }
                }
            });

            if (!geometry) {
                console.warn(`No geometry found in ${objectId} model`);
                return null;
            }

            // Appliquer les textures au matériau si elles sont préchargées
            const textures = preloadedTextures[objectId];
            if (textures && material) {
                console.log(`Applying preloaded textures to ${objectId}`);
                material = new THREE.MeshStandardMaterial({
                    name: `${objectId}_material`,
                    side: THREE.DoubleSide,
                    transparent: objectId === 'Bush' || objectId === 'BranchEucalyptus',
                    alphaTest: objectId === 'Bush' || objectId === 'BranchEucalyptus' ? 0.5 : 0
                });
                // Configurer le matériau et appliquer les textures
                const options = {
                    aoIntensity: 0.7,
                    invertAlpha: true  // Pour assurer que le noir soit opaque pour les feuilles
                };

                // Configuration pour le bush: besoin d'alpha inversé
                if (objectId === 'Bush' && textures.alpha) {
                    material.transparent = true;
                    material.alphaTest = 0.5;

                    // Si l'alpha est préchargé, l'utiliser
                    if (textures.alpha) {
                        // Inverser l'alpha si nécessaire
                        if (options.invertAlpha) {
                            // Créer un canvas pour inverser l'alpha
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            const image = textures.alpha.image;

                            // Définir les dimensions du canvas
                            canvas.width = image.width;
                            canvas.height = image.height;

                            // Dessiner l'image originale
                            ctx.drawImage(image, 0, 0);

                            // Récupérer les données de l'image
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const data = imageData.data;

                            // Inverser les valeurs d'alpha
                            for (let i = 3; i < data.length; i += 4) {
                                data[i] = 255 - data[i];
                            }

                            // Remettre les données modifiées dans le canvas
                            ctx.putImageData(imageData, 0, 0);

                            // Créer une nouvelle texture à partir du canvas
                            const invertedAlphaTexture = new THREE.CanvasTexture(canvas);

                            // Appliquer les propriétés importantes
                            invertedAlphaTexture.wrapS = textures.alpha.wrapS;
                            invertedAlphaTexture.wrapT = textures.alpha.wrapT;
                            invertedAlphaTexture.encoding = textures.alpha.encoding;

                            // Utiliser la texture inversée
                            material.alphaMap = invertedAlphaTexture;
                        } else {
                            material.alphaMap = textures.alpha;
                        }
                    }
                }

                // Appliquer les autres textures au matériau
                if (textures.baseColor) {
                    material.map = textures.baseColor;
                    material.map.encoding = THREE.sRGBEncoding;
                }

                if (textures.normal) {
                    material.normalMap = textures.normal;
                }

                if (textures.roughness) {
                    material.roughnessMap = textures.roughness;
                    material.roughness = 0.5;
                }

                if (textures.metalness) {
                    material.metalnessMap = textures.metalness;
                    material.metalness = 0.0;
                }

                if (textures.ao) {
                    material.aoMap = textures.ao;
                    material.aoMapIntensity = options.aoIntensity;

                    // Activer les UV2 pour l'aoMap si nécessaire
                    if (geometry && !geometry.attributes.uv2 && geometry.attributes.uv) {
                        geometry.setAttribute('uv2', geometry.attributes.uv);
                    }
                }

                // Mise à jour du matériau après modification
                material.needsUpdate = true;
            }

            // Créer un InstancedMesh avec la géométrie et le matériau (avec textures)
            const instancedMesh = new THREE.InstancedMesh(
                geometry,
                material,
                positions.length
            );
            instancedMesh.name = `${objectId}_instances`;
            instancedMesh.castShadow = true;
            instancedMesh.receiveShadow = true;

            // Placer chaque instance en utilisant précisément les données du JSON
            const dummy = new THREE.Object3D();
            positions.forEach((pos, index) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(pos.rotationX, pos.rotationY, pos.rotationZ);
                dummy.scale.set(pos.scaleX, pos.scaleY, pos.scaleZ);
                dummy.updateMatrix();
                instancedMesh.setMatrixAt(index, dummy.matrix);
            });

            // Mettre à jour la matrice d'instances
            instancedMesh.instanceMatrix.needsUpdate = true;

            // Ajouter au groupe
            forestRef.current.add(instancedMesh);
            return instancedMesh;
        };

        // Fonction principale pour placer les objets
        const createForest = async () => {
            // Charger les positions
            const objectPositions = await loadObjectPositions();
            if (!objectPositions) {
                console.error('No object positions available');
                return false;
            }

            // Enregistrer les positions dans le store et la ref
            useStore.getState().setTreePositions(objectPositions);
            objectPositionsRef.current = objectPositions;

            // Charger les modèles
            const objectModels = await loadObjectModels();
            if (!objectModels) {
                console.error('Failed to load object models');
                return false;
            }
            objectModelsRef.current = objectModels;

            // Récupérer les IDs des modèles qui ont des positions
            const objectTypes = Object.keys(objectPositions).filter(type =>
                type !== templateManager.undefinedCategory &&
                objectPositions[type] &&
                objectPositions[type].length > 0
            );

            // Précharger toutes les textures pour tous les modèles
            const preloadedTextures = await preloadTexturesForModels(objectTypes);

            // Créer les instances pour chaque type d'objet
            const instances = [];

            // Parcourir tous les types d'objets qui ont des positions
            for (const objectId of objectTypes) {
                // Vérifier si nous avons le modèle pour ce type d'objet
                if (objectModels[objectId]) {
                    const instancedMesh = await createInstancedMesh(
                        objectId,
                        objectModels[objectId],
                        objectPositions[objectId],
                        preloadedTextures
                    );
                    if (instancedMesh) instances.push(instancedMesh);
                } else {
                    console.warn(`Model not found for object ID: ${objectId}`);
                }
            }

            console.log(`Created ${instances.length} instanced meshes with textures`);

            // Marquer comme chargé
            objectsLoadedRef.current = true;

            // Émettre l'événement forest-ready
            if (instances.length > 0) {
                setTimeout(() => {
                    EventBus.trigger('forest-ready');
                }, 100);
                return true;
            }

            return false;
        };

        // Écouter l'événement tree-positions-ready (fallback si le chargement JSON échoue)
        const handleObjectPositions = (positions) => {
            // Utiliser seulement si les objets n'ont pas déjà été chargés
            if (!objectsLoadedRef.current) {
                console.log('Received object positions from event:', positions);
                objectPositionsRef.current = positions;

                // Créer la forêt si les modèles sont déjà chargés
                if (objectModelsRef.current) {
                    // Précharger les textures et créer les instances
                    const objectTypes = Object.keys(positions).filter(type =>
                        type !== templateManager.undefinedCategory &&
                        positions[type] &&
                        positions[type].length > 0
                    );

                    preloadTexturesForModels(objectTypes).then(preloadedTextures => {
                        createInstancedMeshesFromPositions(positions, preloadedTextures);
                    });
                }
            }
        };

        // Fonction auxiliaire pour créer des meshes à partir de positions reçues par événement
        const createInstancedMeshesFromPositions = async (positions, preloadedTextures) => {
            const instances = [];
            const objectTypes = Object.keys(positions).filter(type =>
                type !== templateManager.undefinedCategory &&
                positions[type] &&
                positions[type].length > 0
            );

            for (const objectId of objectTypes) {
                const model = objectModelsRef.current[objectId];
                if (model) {
                    const instancedMesh = await createInstancedMesh(
                        objectId,
                        model,
                        positions[objectId],
                        preloadedTextures
                    );
                    if (instancedMesh) instances.push(instancedMesh);
                }
            }

            if (instances.length > 0) {
                objectsLoadedRef.current = true;
                setTimeout(() => {
                    EventBus.trigger('forest-ready');
                }, 100);
            }
        };

        // S'abonner à l'événement (comme fallback)
        EventBus.on('tree-positions-ready', handleObjectPositions);

        // Lancer la création de la forêt
        createForest();

        // Fonction de nettoyage
        return () => {
            EventBus.off('tree-positions-ready', handleObjectPositions);

            if (forestRef.current) {
                scene.remove(forestRef.current);

                // Nettoyer tous les enfants
                if (forestRef.current.children) {
                    forestRef.current.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    });
                }
            }
        };
    }, [scene, assetManager]); // Dépendances minimales

    return null;
}