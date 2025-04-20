import React, {useRef, useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import {Group, Vector3, Quaternion, Matrix4, Box3, Euler, Object3D} from 'three';
import useStore from '../Store/useStore';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';

export default function MapWithInstances() {
    const {scene} = useThree();
    const mapRef = useRef(new Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    useEffect(() => {
        // Create main map group
        const mapGroup = mapRef.current;
        mapGroup.name = 'MapScene';
        scene.add(mapGroup);

        // Référence au modèle de la carte
        let mapModel = null;

        const loadMap = () => {
            // Load and add map
            if (assetManager?.getItem && assetManager.getItem('MapScene')) {
                mapModel = assetManager.getItem('MapScene').scene.clone();
                mapModel.name = 'MapSceneModel';
                mapGroup.add(mapModel);

                // Position and scale map as needed
                mapModel.position.set(0, 0, 0);
                mapModel.scale.set(1, 1, 1);

                // Analyser les instances et les templates
                analyzeInstancesAndTemplates(mapModel);
                extractAndSaveGeoNodesPositions(mapModel);

                // Émettre l'événement map-ready
                EventBus.trigger('map-ready');
                EventBus.trigger('mapscene-ready');
            } else {
                // Si assetManager n'est pas encore prêt, réessayer après un délai
                if (!assetManager?.getItem) {
                    setTimeout(loadMap, 500);
                }
            }
        };

        // Fonction optimisée pour analyser les instances et les templates
        const analyzeInstancesAndTemplates = (mapModel) => {
            // Liste des modèles templates à rechercher
            const templateNames = [
                'Retopo_TRONC001',
                'Retopo_GROS_TRONC001',
                'Retopo_TRONC_FIN',
                'Trunk'
            ];

            const idToTemplateMap = {
                1009: 'Retopo_TRONC001',
                1011: 'Retopo_TRONC001',
                1013: 'Retopo_TRONC001',
                1019: 'Retopo_TRONC001',
                1021: 'Retopo_TRONC001',
                1017: 'Retopo_TRONC_FIN',
                1015: 'Retopo_TRONC_FIN',
                1010: 'Retopo_GROS_TRONC001',
                1012: 'Retopo_GROS_TRONC001',
                1014: 'Retopo_GROS_TRONC001',
                1016: 'Retopo_GROS_TRONC001',
                1018: 'Retopo_GROS_TRONC001',
                1020: 'Retopo_GROS_TRONC001'
            };

            // Mapping direct template -> type d'arbre
            const templateToTreeMap = {
                'Retopo_TRONC001': 'TreeNaked',
                'Retopo_GROS_TRONC001': 'Tree3',
                'Retopo_TRONC_FIN': 'Tree1'
            };

            // Créer directement le tableau de positions par type d'arbre
            const treePositions = {
                TreeNaked: [],
                Tree3: [],
                Tree1: []
            };

            // Parcourir le modèle une seule fois - approche optimisée
            const processQueue = [mapModel];
            const dummy = new Object3D(); // Objet temporaire réutilisable

            while (processQueue.length > 0) {
                const node = processQueue.pop();

                // Si c'est une instance de GN_Instance
                if (node.name.startsWith('GN_Instance')) {
                    // Extraire l'ID directement
                    const match = node.name.match(/GN_Instance_(\d+)/);
                    if (match) {
                        const id = parseInt(match[1]);
                        const templateName = idToTemplateMap[id] || 'Trunk';
                        const treeType = templateToTreeMap[templateName];

                        if (treeType) {
                            // Obtenir la transformation mondiale sans décomposition excessive
                            node.updateWorldMatrix(true, false);

                            // Utiliser temporairement dummy pour obtenir position/rotation/scale
                            dummy.matrix.copy(node.matrixWorld);
                            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

                            // Extraire les valeurs directement
                            const rotation = new Euler().setFromQuaternion(dummy.quaternion);

                            // Ajouter la position à l'arbre approprié
                            treePositions[treeType].push({
                                x: dummy.position.x,
                                y: dummy.position.y,
                                z: dummy.position.z,
                                rotation: rotation.y,
                                scaleX: dummy.scale.x,
                                scaleY: dummy.scale.y,
                                scaleZ: dummy.scale.z
                            });
                        }
                    }
                }

                // Ajouter les enfants à la queue de traitement
                if (node.children && node.children.length > 0) {
                    for (let i = 0; i < node.children.length; i++) {
                        processQueue.push(node.children[i]);
                    }
                }
            }

            console.log("Tree positions count:", {
                Tree1: treePositions.Tree1.length,
                TreeNaked: treePositions.TreeNaked.length,
                Tree3: treePositions.Tree3.length
            });

            // Stocker dans le store
            useStore.getState().setTreePositions(treePositions);

            // Émettre l'événement avec les positions
            EventBus.trigger('tree-positions-ready', treePositions);

            // Préparer la gestion de l'événement forest-ready
            const forestReadyListener = () => {
                if (mapModel) {
                    mapModel.visible = false;
                }
            };

            // S'abonner à l'événement forest-ready
            EventBus.on('forest-ready', forestReadyListener);

            // Retourner la fonction de nettoyage
            return () => {
                EventBus.off('forest-ready', forestReadyListener);
            };
        };

        // Charger la carte
        loadMap();

        // Fonction de nettoyage
        return () => {
            if (mapGroup) {
                scene.remove(mapGroup);

                // Nettoyage efficace des ressources
                if (mapModel) {
                    // Utiliser une approche non-récursive pour le nettoyage
                    const cleanupQueue = [mapModel];

                    while (cleanupQueue.length > 0) {
                        const node = cleanupQueue.pop();

                        if (node.isMesh) {
                            if (node.geometry) node.geometry.dispose();
                            if (node.material) {
                                if (Array.isArray(node.material)) {
                                    node.material.forEach(mat => mat.dispose());
                                } else {
                                    node.material.dispose();
                                }
                            }
                        }

                        if (node.children && node.children.length > 0) {
                            for (let i = 0; i < node.children.length; i++) {
                                cleanupQueue.push(node.children[i]);
                            }
                        }
                    }
                }

                mapRef.current = null;
            }
        };
    }, [scene, assetManager]);

    return null;
}
function extractAndSaveGeoNodesPositions(mapModel) {
    // Mapping entre noms de templates et noms de modèles
    const templateToTreeMap = {
        'Retopo_TRONC001': 'TreeNaked',
        'Retopo_GROS_TRONC001': 'Tree3',
        'Retopo_TRONC_FIN': 'Tree1'
    };

    // Structure pour stocker les modèles de référence
    const templateModels = {};

    // Fonction pour calculer l'empreinte géométrique d'un modèle
    // Cette fonction crée une signature unique basée sur le nombre de vertices, faces, etc.
    const getGeometryFingerprint = (node) => {
        let vertexCount = 0;
        let faceCount = 0;
        let boundingSize = { x: 0, y: 0, z: 0 };

        // Traverser l'objet pour collecter des informations sur sa géométrie
        node.traverse((child) => {
            if (child.isMesh && child.geometry) {
                // Compte les vertices
                if (child.geometry.attributes.position) {
                    vertexCount += child.geometry.attributes.position.count;
                }

                // Compte les faces
                if (child.geometry.index) {
                    faceCount += child.geometry.index.count / 3;
                } else if (child.geometry.attributes.position) {
                    faceCount += child.geometry.attributes.position.count / 3;
                }

                // Calcule la taille approximative
                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                }

                const box = child.geometry.boundingBox;
                boundingSize.x = Math.max(boundingSize.x, box.max.x - box.min.x);
                boundingSize.y = Math.max(boundingSize.y, box.max.y - box.min.y);
                boundingSize.z = Math.max(boundingSize.z, box.max.z - box.min.z);
            }
        });

        return {
            vertexCount,
            faceCount,
            boundingSize
        };
    };

    // Fonction pour trouver le modèle de template le plus similaire
    const findMatchingTemplate = (node) => {
        const fingerprint = getGeometryFingerprint(node);
        let bestMatch = null;
        let bestScore = Number.MAX_VALUE;

        // Comparer avec chaque modèle de template
        Object.entries(templateModels).forEach(([templateName, templateData]) => {
            // Calculer un score de similarité (plus petit = plus similaire)
            const vertexDiff = Math.abs(fingerprint.vertexCount - templateData.fingerprint.vertexCount);
            const faceDiff = Math.abs(fingerprint.faceCount - templateData.fingerprint.faceCount);
            const sizeDiffX = Math.abs(fingerprint.boundingSize.x - templateData.fingerprint.boundingSize.x);
            const sizeDiffY = Math.abs(fingerprint.boundingSize.y - templateData.fingerprint.boundingSize.y);
            const sizeDiffZ = Math.abs(fingerprint.boundingSize.z - templateData.fingerprint.boundingSize.z);

            const score = vertexDiff + faceDiff + sizeDiffX + sizeDiffY + sizeDiffZ;

            if (score < bestScore) {
                bestScore = score;
                bestMatch = templateName;
            }
        });

        // Si aucun match satisfaisant n'est trouvé, retourner 'Trunk'
        if (bestScore > 1000) { // Seuil arbitraire à ajuster selon vos besoins
            return 'Trunk';
        }

        return bestMatch;
    };

    // Première passe : identifier les modèles de templates dans la scène
    console.log("Première passe: Identification des templates...");
    mapModel.traverse((node) => {
        // Vérifier si le nœud correspond à un modèle de template connu
        if (node.name && Object.keys(templateToTreeMap).includes(node.name)) {
            console.log(`Template trouvé: ${node.name}`);

            // Enregistrer ce modèle comme référence
            templateModels[node.name] = {
                node: node,
                fingerprint: getGeometryFingerprint(node)
            };
        }
    });

    console.log("Templates identifiés:", Object.keys(templateModels));

    // Structures pour stocker les résultats
    const modelPositions = {
        Tree1: [],
        TreeNaked: [],
        Tree3: [],
        Trunk: []
    };

    // Deuxième passe : analyser chaque instance et déterminer son template
    console.log("Deuxième passe: Analyse des instances...");

    // Parcourir le modèle pour trouver les instances
    const processQueue = [mapModel];
    const dummy = new Object3D(); // Objet temporaire réutilisable

    while (processQueue.length > 0) {
        const node = processQueue.pop();

        // Si c'est une instance GeoNode
        if (node.name.startsWith('GN_Instance')) {
            // Extraire l'ID
            const match = node.name.match(/GN_Instance_(\d+)/);
            if (match) {
                const id = parseInt(match[1]);

                // Déterminer le template en fonction de la géométrie
                const templateName = findMatchingTemplate(node);
                const treeName = templateToTreeMap[templateName] || 'Trunk';

                // Obtenir la transformation mondiale
                node.updateWorldMatrix(true, false);

                // Utiliser dummy pour obtenir position/rotation/scale
                dummy.matrix.copy(node.matrixWorld);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

                // Extraire les valeurs de rotation sur tous les axes
                const rotation = new Euler().setFromQuaternion(dummy.quaternion);

                // Créer l'objet d'information d'instance avec les rotations sur tous les axes
                const instanceInfo = {
                    id: id,
                    name: node.name,
                    template: treeName, // Utiliser directement le nom du modèle
                    position: {
                        x: dummy.position.x,
                        y: dummy.position.y,
                        z: dummy.position.z
                    },
                    rotation: {
                        x: rotation.x,
                        y: rotation.y,
                        z: rotation.z
                    },
                    scale: {
                        x: dummy.scale.x,
                        y: dummy.scale.y,
                        z: dummy.scale.z
                    }
                };

                // Ajouter aux données par modèle
                modelPositions[treeName].push(instanceInfo);
            }
        }

        // Ajouter les enfants à la queue
        if (node.children && node.children.length > 0) {
            for (let i = 0; i < node.children.length; i++) {
                processQueue.push(node.children[i]);
            }
        }
    }

    // Structure simplifiée pour le format treePositions incluant toutes les rotations
    const treePositions = {
        Tree1: [],
        TreeNaked: [],
        Tree3: []
    };

    // Remplir la structure simplifiée avec les rotations complètes
    Object.keys(treePositions).forEach(treeName => {
        if (modelPositions[treeName]) {
            treePositions[treeName] = modelPositions[treeName].map(instance => ({
                x: instance.position.x,
                y: instance.position.y,
                z: instance.position.z,
                rotationX: instance.rotation.x,
                rotationY: instance.rotation.y,
                rotationZ: instance.rotation.z,
                scaleX: instance.scale.x,
                scaleY: instance.scale.y,
                scaleZ: instance.scale.z
            }));
        }
    });

    // Créer les données JSON
    const modelJSON = JSON.stringify(modelPositions, null, 2);
    const treeJSON = JSON.stringify(treePositions, null, 2);

    // Sauvegarder les fichiers
    saveJSON(modelJSON, 'modelPositions.json');
    saveJSON(treeJSON, 'treePositions.json');

    console.log("GeoNodes positions extracted and saved!");
    console.log("Model counts:", {
        Tree1: modelPositions.Tree1.length,
        TreeNaked: modelPositions.TreeNaked.length,
        Tree3: modelPositions.Tree3.length,
        Trunk: modelPositions.Trunk.length
    });

    return { modelPositions, treePositions };
}

// Fonction pour sauvegarder un fichier JSON
function saveJSON(jsonContent, fileName) {
    // Créer un blob avec le contenu JSON
    const blob = new Blob([jsonContent], {type: 'application/json'});

    // Créer un URL pour le blob
    const url = URL.createObjectURL(blob);

    // Créer un élément <a> temporaire
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    // Ajouter l'élément au DOM, cliquer dessus, puis le supprimer
    document.body.appendChild(link);
    link.click();

    // Nettoyer
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}