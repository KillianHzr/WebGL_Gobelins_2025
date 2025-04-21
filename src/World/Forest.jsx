import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EventBus, useEventEmitter } from '../Utils/EventEmitter';
import useStore from '../Store/useStore';
import templateManager from '../Config/TemplateManager';

export default function Forest() {
    const { scene } = useThree();
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

        // Créer un InstancedMesh pour un type d'objet
        const createInstancedMesh = (objectId, model, positions) => {
            if (!positions || positions.length === 0) {
                console.log(`No positions for ${objectId}`);
                return null;
            }

            console.log(`Creating ${positions.length} instances of ${objectId}`);

            // Trouver la géométrie et les matériaux dans le modèle
            const geometries = [];
            const materials = [];

            model.scene.traverse((child) => {
                if (child.isMesh) {
                    geometries.push(child.geometry);
                    materials.push(child.material);
                }
            });

            if (geometries.length === 0) {
                console.warn(`No geometries found in ${objectId} model`);
                return null;
            }

            // Utiliser la première géométrie et le premier matériau trouvés
            const geometry = geometries[0];
            const material = materials[0];

            // Créer un InstancedMesh
            const instancedMesh = new THREE.InstancedMesh(
                geometry.clone(),
                material.clone(),
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

            // Créer les instances pour chaque type d'objet
            const instances = [];
            const objectTypes = templateManager.getAllObjectTypes();

            // Parcourir tous les types d'objets définis dans le gestionnaire de templates
            for (const objectId of objectTypes) {
                // Ignorer la catégorie "Undefined"
                if (objectId === templateManager.undefinedCategory) continue;

                // Vérifier si nous avons des positions pour ce type d'objet
                if (objectPositions[objectId] && objectPositions[objectId].length > 0) {
                    const model = objectModels[objectId];
                    if (model) {
                        const instancedMesh = createInstancedMesh(objectId, model, objectPositions[objectId]);
                        if (instancedMesh) instances.push(instancedMesh);
                    } else {
                        console.warn(`Model not found for object ID: ${objectId}`);
                    }
                }
            }

            console.log(`Created ${instances.length} instanced meshes`);

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
                    createInstancedMeshesFromPositions(positions);
                }
            }
        };

        // Fonction auxiliaire pour créer des meshes à partir de positions reçues par événement
        const createInstancedMeshesFromPositions = (positions) => {
            const instances = [];
            const objectTypes = templateManager.getAllObjectTypes();

            for (const objectId of objectTypes) {
                // Ignorer la catégorie "Undefined"
                if (objectId === templateManager.undefinedCategory) continue;

                if (positions[objectId] && positions[objectId].length > 0) {
                    const model = objectModelsRef.current[objectId];
                    if (model) {
                        const instancedMesh = createInstancedMesh(objectId, model, positions[objectId]);
                        if (instancedMesh) instances.push(instancedMesh);
                    }
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