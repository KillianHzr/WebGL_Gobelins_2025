import React, {useRef, useEffect} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {
    Group,
    Frustum,
    Matrix4,
    Vector3,
    Raycaster,
    Box3,
    Sphere
} from 'three';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';
import useStore from '../Store/useStore';

export default function Forest() {
    const {scene, camera} = useThree();
    const forestRef = useRef(new Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();
    const frustumRef = useRef(new Frustum());
    const projScreenMatrixRef = useRef(new Matrix4());
    const raycasterRef = useRef(new Raycaster());
    const tempBox = useRef(new Box3());
    const tempSphere = useRef(new Sphere());

    // Références pour les groupes d'arbres
    const tree1GroupRef = useRef(null);
    const tree2GroupRef = useRef(null);
    const tree3GroupRef = useRef(null);

    const optimizeGeometry = (model) => {
        model.traverse(child => {
            if (child.isMesh && child.geometry) {
                // 1. Simplifier les géométries des objets éloignés
                if (child.userData.detail === 'low') {
                    // Réduire la résolution des géométries
                    const geometry = child.geometry;

                    // Supprimer les attributs non essentiels pour les objets distants
                    if (geometry.attributes && geometry.attributes.uv2) geometry.deleteAttribute('uv2');
                    if (geometry.attributes && geometry.attributes.tangent) geometry.deleteAttribute('tangent');
                    // Réduire la précision des normales pour les objets distants
                    if (geometry.attributes && geometry.attributes.normal) {
                        const normals = geometry.attributes.normal.array;
                        for (let i = 0; i < normals.length; i++) {
                            // Arrondir les normales à une précision réduite
                            normals[i] = Math.round(normals[i] * 10) / 10;
                        }
                        geometry.attributes.normal.needsUpdate = true;
                    }
                }

                // 2. Désactiver les calculs d'ombre pour les objets non importants
                if (child.userData.importance === 'low') {
                    child.castShadow = false;
                    child.receiveShadow = false;
                }
            }
        });

        return model;
    };

    // Fonction sécurisée pour vérifier si un objet est dans le frustum de la caméra
    const isInFrustum = (object) => {
        try {
            // Si l'objet a déjà une boundingSphere, utiliser celle-ci
            if (object.geometry && object.geometry.boundingSphere) {
                return frustumRef.current.intersectsObject(object);
            }

            // Sinon, calculer une bounding box puis une bounding sphere temporaires
            tempBox.current.setFromObject(object);

            if (tempBox.current.isEmpty()) {
                return true; // Si la boîte est vide, considérer comme visible par défaut
            }

            tempBox.current.getCenter(tempSphere.current.center);
            tempSphere.current.radius = tempBox.current.getSize(new Vector3()).length() * 0.5;

            // Vérifier si la sphère temporaire est dans le frustum
            return frustumRef.current.intersectsSphere(tempSphere.current);
        } catch (error) {
            console.warn("Error in frustum culling:", error);
            return true; // En cas d'erreur, considérer comme visible par défaut
        }
    };

    // Occlusion culling - vérification à chaque frame
    useFrame(() => {
        try {
            // Mettre à jour la matrice de projection de la caméra
            projScreenMatrixRef.current.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            );
            frustumRef.current.setFromProjectionMatrix(projScreenMatrixRef.current);

            // Appliquer l'occlusion culling sur chaque arbre
            const occluders = []; // Objets qui peuvent occulter d'autres (comme le terrain)

            // Trouver les occluders potentiels dans la scène
            scene.traverse(object => {
                if (object.userData && object.userData.isOccluder) {
                    occluders.push(object);
                }
            });

            // Vérifier chaque groupe d'arbres
            [tree1GroupRef, tree2GroupRef, tree3GroupRef].forEach(groupRef => {
                if (groupRef.current) {
                    groupRef.current.children.forEach(tree => {
                        // 1. Frustum culling - vérifier si l'arbre est dans le champ de vision
                        const inFrustum = isInFrustum(tree);

                        // 2. Distance culling - masquer les arbres trop loin
                        const distance = camera.position.distanceTo(tree.position);
                        const tooFar = distance > 50; // Ajuster selon vos besoins

                        // 3. Occlusion culling - vérifier si l'arbre est caché derrière d'autres objets
                        let isOccluded = false;

                        if (inFrustum && !tooFar && occluders.length > 0) {
                            // Direction de la caméra vers l'arbre
                            const direction = new Vector3()
                                .subVectors(tree.position, camera.position)
                                .normalize();

                            raycasterRef.current.set(camera.position, direction);

                            // Vérifier les intersections avec les occluders
                            for (const occluder of occluders) {
                                const intersects = raycasterRef.current.intersectObject(occluder, false);

                                if (intersects.length > 0) {
                                    // Si la distance à l'occluder est inférieure à la distance à l'arbre,
                                    // alors l'arbre est occulté
                                    const occluderDistance = intersects[0].distance;
                                    if (occluderDistance < distance) {
                                        isOccluded = true;
                                        break;
                                    }
                                }
                            }
                        }

                        // Appliquer la visibilité
                        tree.visible = inFrustum && !tooFar && !isOccluded;
                    });
                }
            });
        } catch (error) {
            console.error("Error in scene culling:", error);
        }
    });

    useEffect(() => {
        // Créer le groupe principal de la forêt
        const forestGroup = forestRef.current;
        forestGroup.name = 'Forest';
        scene.add(forestGroup);

        // Fonction pour cloner et positionner des arbres - version robuste
        const createTreeClones = (treeName, groupRef, positions) => {
            if (assetManager?.getItem && assetManager.getItem(treeName)) {
                // Créer un groupe pour ce type d'arbre
                const treeGroup = new Group();
                treeGroup.name = `${treeName}_group`;
                forestGroup.add(treeGroup);
                groupRef.current = treeGroup;

                // Obtenir le modèle original
                const originalTreeModel = assetManager.getItem(treeName);

                if (!originalTreeModel || !originalTreeModel.scene) {
                    console.warn(`${treeName} model scene not found`);
                    return false;
                }

                // Traiter chaque position
                positions.forEach((pos, index) => {
                    try {
                        // Cloner le modèle complet pour cette position
                        const treeInstance = originalTreeModel.scene.clone();
                        treeInstance.name = `${treeName}_${index}`;

                        // Appliquer la position
                        treeInstance.position.set(pos.x, pos.y, pos.z);

                        // Rotation aléatoire pour un aspect naturel
                        treeInstance.rotation.y = Math.random() * Math.PI * 2;

                        // Échelle aléatoire pour plus de variété
                        const scale = 0.8 + Math.random() * 0.4;
                        treeInstance.scale.set(scale, scale, scale);

                        // Pré-calculer une bounding box pour l'occlusion culling
                        const boundingBox = new Box3().setFromObject(treeInstance);
                        treeInstance.userData.boundingBox = boundingBox;

                        // Cacher les géométries complexes pour réduire les drawcalls
                        treeInstance.traverse(child => {
                            // Optimiser les matériaux
                            if (child.isMesh && child.material) {
                                // Utiliser la même instance de matériau pour tous les meshes similaires
                                if (!window.sharedMaterials) {
                                    window.sharedMaterials = {};
                                }

                                const matKey = child.material.type + '_' +
                                    (child.material.color ? child.material.color.getHexString() : 'default');

                                if (!window.sharedMaterials[matKey]) {
                                    window.sharedMaterials[matKey] = child.material;
                                } else {
                                    child.material = window.sharedMaterials[matKey];
                                }

                                // Calculer la boundingSphere si elle n'existe pas
                                if (child.geometry && !child.geometry.boundingSphere) {
                                    child.geometry.computeBoundingSphere();
                                }
                            }
                        });

                        const distanceToCamera = camera.position.distanceTo(new Vector3(pos.x, pos.y, pos.z));

                        // Marquer le niveau de détail en fonction de la distance
                        if (distanceToCamera > 20) {
                            treeInstance.traverse(child => {
                                if (child.isMesh) {
                                    child.userData.detail = 'low';
                                    child.userData.importance = 'low';
                                }
                            });
                        } else if (distanceToCamera > 10) {
                            treeInstance.traverse(child => {
                                if (child.isMesh) {
                                    child.userData.detail = 'medium';
                                }
                            });
                        } else {
                            treeInstance.traverse(child => {
                                if (child.isMesh) {
                                    child.userData.detail = 'high';
                                }
                            });
                        }

                        // Optimiser la géométrie en fonction du niveau de détail
                        optimizeGeometry(treeInstance);
                        // Ajouter l'instance au groupe d'arbres
                        treeGroup.add(treeInstance);
                    } catch (error) {
                        console.error(`Error creating tree instance for ${treeName} at position ${index}:`, error);
                    }
                });

                return true;
            } else {
                console.warn(`${treeName} model not found in asset manager`);
                return false;
            }
        };

        const loadForest = () => {
            // Vérifier si l'AssetManager est prêt
            if (!assetManager?.getItem) {
                console.log('AssetManager not ready yet, retrying in 500ms...');
                setTimeout(loadForest, 500);
                return;
            }

            // Définir les positions pour différents types d'arbres
            const tree1Positions = [
                {x: -5, y: 0, z: -15},
                {x: -4, y: 0, z: -10},
                {x: 7, y: 0, z: -25},
                {x: 6, y: 0, z: -20}
            ];

            const tree2Positions = [
                {x: -3, y: 0, z: -15},
                {x: -2, y: 0, z: -25},
                {x: 8, y: 0, z: -10},
                {x: 7, y: 0, z: -13}
            ];

            const tree3Positions = [
                {x: -1, y: 0, z: -11},
                {x: -5, y: 0, z: -15},
                {x: 6, y: 0, z: -18},
                {x: 3, y: 0, z: -21}
            ];

            // Créer des clones d'arbres de chaque type
            const tree1Success = createTreeClones('Tree1', tree1GroupRef, tree1Positions);
            const tree2Success = createTreeClones('Tree2', tree2GroupRef, tree2Positions);
            const tree3Success = createTreeClones('Tree3', tree3GroupRef, tree3Positions);

            if (tree1Success || tree2Success || tree3Success) {
                console.log('Forest trees loaded and positioned successfully');

                // Si au moins un type d'arbre a été chargé, considérer la forêt comme prête
                EventBus.trigger('forest-ready');
            } else {
                console.warn('No tree models could be loaded');
            }
        };

        // Première tentative de chargement
        loadForest();

        // Fonction de nettoyage
        return () => {
            // Supprimer le groupe forestier de la scène
            if (forestGroup) {
                scene.remove(forestGroup);

                // Dispose all materials from the shared materials
                if (window.sharedMaterials) {
                    Object.values(window.sharedMaterials).forEach(material => {
                        if (material && material.dispose) {
                            material.dispose();
                        }
                    });
                    window.sharedMaterials = null;
                }
            }
        };
    }, [scene, assetManager, camera]);

    return null;
}