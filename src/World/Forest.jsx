import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EventBus, useEventEmitter } from '../Utils/EventEmitter';
import useStore from '../Store/useStore';

export default function Forest() {
    const { scene } = useThree();
    const forestRef = useRef(new THREE.Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    // Utiliser des refs pour éviter les problèmes de re-rendu
    const treePositionsRef = useRef(null);
    const treeModelsRef = useRef(null);
    const treesLoadedRef = useRef(false);

    useEffect(() => {
        console.log('Forest: Component mounted');

        // Créer le groupe principal
        const forestGroup = new THREE.Group();
        forestGroup.name = 'Forest';
        scene.add(forestGroup);
        forestRef.current = forestGroup;

        // Charger les données de position depuis le fichier JSON
        const loadTreePositions = async () => {
            try {
                console.log('Loading tree positions from JSON...');

                // Essayer plusieurs chemins possibles
                const paths = [
                    './data/treePositions.json',
                    '/data/treePositions.json',
                    '../data/treePositions.json',
                    'treePositions.json'
                ];

                let treePositions = null;

                // Essayer tous les chemins jusqu'à trouver le bon
                for (const path of paths) {
                    try {
                        console.log(`Trying path: ${path}`);
                        const response = await fetch(path);
                        if (response.ok) {
                            treePositions = await response.json();
                            console.log(`Successfully loaded from ${path}`);
                            break;
                        }
                    } catch (err) {
                        console.log(`Path ${path} failed:`, err.message);
                    }
                }

                // Si aucun chemin n'a fonctionné, vérifier si les positions sont déjà dans le store
                if (!treePositions) {
                    console.log('All paths failed, checking store for positions');
                    treePositions = useStore.getState().treePositions;
                }

                if (treePositions) {
                    console.log('Tree positions loaded:', treePositions);
                    return treePositions;
                } else {
                    console.error('Could not load tree positions from any source');
                    return null;
                }

            } catch (error) {
                console.error('Error loading tree positions:', error);

                // Essayer de récupérer les positions depuis le store comme fallback
                const storePositions = useStore.getState().treePositions;
                if (storePositions) {
                    console.log('Using positions from store as fallback');
                    return storePositions;
                }
                return null;
            }
        };

        // Charger les modèles d'arbres réels depuis l'assetManager
        const loadTreeModels = async () => {
            if (!assetManager) {
                console.warn('AssetManager not available');
                return null;
            }

            // Attendre que tous les modèles soient chargés
            const waitForAssets = () => {
                return new Promise((resolve) => {
                    const checkAssets = () => {
                        const tree1 = assetManager.getItem('Tree1');
                        const TreeNaked = assetManager.getItem('TreeNaked');
                        const tree3 = assetManager.getItem('Tree3');
                        const treeStump = assetManager.getItem('TreeStump'); // Ajout du nouveau modèle

                        if (tree1 && TreeNaked && tree3 && treeStump) {
                            resolve({
                                Tree1: tree1,
                                TreeNaked: TreeNaked,
                                Tree3: tree3,
                                TreeStump: treeStump  // Ajout à l'objet retourné
                            });
                        } else {
                            setTimeout(checkAssets, 100);
                        }
                    };
                    checkAssets();
                });
            };

            try {
                const treeModels = await waitForAssets();
                console.log('Tree models loaded:', treeModels);
                return treeModels;
            } catch (error) {
                console.error('Error loading tree models:', error);
                return null;
            }
        };

        // Créer un InstancedMesh pour un type d'arbre
        const createInstancedMesh = (treeName, model, positions) => {
            if (!positions || positions.length === 0) {
                console.log(`No positions for ${treeName}`);
                return null;
            }

            console.log(`Creating ${positions.length} instances of ${treeName}`);

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
                console.warn(`No geometries found in ${treeName} model`);
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
            instancedMesh.name = `${treeName}_instances`;
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

        // Fonction principale pour placer les arbres
        const createForest = async () => {
            // Charger les positions
            const treePositions = await loadTreePositions();
            if (!treePositions) {
                console.error('No tree positions available');
                return false;
            }

            // Enregistrer les positions dans le store et la ref
            useStore.getState().setTreePositions(treePositions);
            treePositionsRef.current = treePositions;

            // Charger les modèles
            const treeModels = await loadTreeModels();
            if (!treeModels) {
                console.error('Failed to load tree models');
                return false;
            }
            treeModelsRef.current = treeModels;

            // Créer les instances pour chaque type d'arbre
            const instances = [];

            // Créer des instances pour Tree1
            if (treePositions.Tree1 && treePositions.Tree1.length > 0) {
                const tree1 = createInstancedMesh('Tree1', treeModels.Tree1, treePositions.Tree1);
                if (tree1) instances.push(tree1);
            }

            // Créer des instances pour TreeNaked
            if (treePositions.TreeNaked && treePositions.TreeNaked.length > 0) {
                const TreeNaked = createInstancedMesh('TreeNaked', treeModels.TreeNaked, treePositions.TreeNaked);
                if (TreeNaked) instances.push(TreeNaked);
            }

            // Créer des instances pour Tree3
            if (treePositions.Tree3 && treePositions.Tree3.length > 0) {
                const tree3 = createInstancedMesh('Tree3', treeModels.Tree3, treePositions.Tree3);
                if (tree3) instances.push(tree3);
            }

            if (treePositions.TreeStump && treePositions.TreeStump.length > 0) {
                const treeStump = createInstancedMesh('TreeStump', treeModels.TreeStump, treePositions.TreeStump);
                if (treeStump) instances.push(treeStump);
            }
            console.log(`Created ${instances.length} instanced meshes`);

            // Marquer comme chargé
            treesLoadedRef.current = true;

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
        const handleTreePositions = (positions) => {
            // Utiliser seulement si les arbres n'ont pas déjà été chargés
            if (!treesLoadedRef.current) {
                console.log('Received tree positions from event:', positions);
                treePositionsRef.current = positions;

                // Créer la forêt si les modèles sont déjà chargés
                if (treeModelsRef.current) {
                    createInstancedMeshesFromPositions(positions);
                }
            }
        };

        // Fonction auxiliaire pour créer des meshes à partir de positions reçues par événement
        const createInstancedMeshesFromPositions = (positions) => {
            const instances = [];

            if (positions.Tree1 && positions.Tree1.length > 0) {
                const tree1 = createInstancedMesh('Tree1', treeModelsRef.current.Tree1, positions.Tree1);
                if (tree1) instances.push(tree1);
            }

            if (positions.TreeNaked && positions.TreeNaked.length > 0) {
                const TreeNaked = createInstancedMesh('TreeNaked', treeModelsRef.current.TreeNaked, positions.TreeNaked);
                if (TreeNaked) instances.push(TreeNaked);
            }

            if (positions.Tree3 && positions.Tree3.length > 0) {
                const tree3 = createInstancedMesh('Tree3', treeModelsRef.current.Tree3, positions.Tree3);
                if (tree3) instances.push(tree3);
            }

            if (instances.length > 0) {
                treesLoadedRef.current = true;
                setTimeout(() => {
                    EventBus.trigger('forest-ready');
                }, 100);
            }
        };

        // S'abonner à l'événement (comme fallback)
        EventBus.on('tree-positions-ready', handleTreePositions);

        // Lancer la création de la forêt
        createForest();

        // Fonction de nettoyage
        return () => {
            EventBus.off('tree-positions-ready', handleTreePositions);

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