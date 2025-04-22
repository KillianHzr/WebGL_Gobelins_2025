import React, {useRef, useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import {Group, Vector3, Quaternion, Matrix4, Box3, Euler, Object3D} from 'three';
import useStore from '../Store/useStore';
import {EventBus, useEventEmitter} from '../Utils/EventEmitter';
import templateManager from '../Config/TemplateManager';

export default function MapWithInstances() {
    const {scene} = useThree();
    const mapRef = useRef(new Group());
    const assetManager = window.assetManager;
    const eventEmitter = useEventEmitter();

    useEffect(() => {
        // Create main map group
        const mapGroup = mapRef.current;
        mapGroup.name = 'MapInstance';
        scene.add(mapGroup);

        // Référence au modèle de la carte
        let mapModel = null;

        const loadMap = () => {
            // Vérification plus robuste de l'AssetManager
            if (!assetManager || !assetManager.getItem) {
                console.log("AssetManager not fully initialized, retrying in 500ms...");
                setTimeout(loadMap, 500);
                return;
            }

            // Vérification plus robuste de l'asset MapInstance
            const mapAsset = assetManager.getItem('MapInstance');
            if (!mapAsset) {
                console.log("MapInstance asset not found, retrying in 500ms...");
                setTimeout(loadMap, 500);
                return;
            }

            // Continuer avec le chargement
            mapModel = mapAsset.scene.clone();
            mapModel.name = 'MapInstanceModel';
            mapGroup.add(mapModel);
            if (assetManager?.getItem && assetManager.getItem('MapInstance')) {
                mapModel = assetManager.getItem('MapInstance').scene.clone();
                mapModel.name = 'MapInstanceModel';
                mapGroup.add(mapModel);

                // Position and scale map as needed
                mapModel.position.set(0, 0, 0);
                mapModel.scale.set(1, 1, 1);

                // Analyser les instances et les templates
                analyzeInstancesAndTemplates(mapModel);
                extractAndSaveGeoNodesPositions(mapModel);

                // Émettre l'événement map-ready
                EventBus.trigger('map-ready');
                EventBus.trigger('MapInstance-ready');
            } else {
                // Si assetManager n'est pas encore prêt, réessayer après un délai
                if (!assetManager?.getItem) {
                    setTimeout(loadMap, 500);
                }
            }
        };

        // Fonction optimisée pour analyser les instances et les templates
        const analyzeInstancesAndTemplates = (mapModel) => {
            // Créer la structure vide de positions d'objets
            const objectPositions = templateManager.createEmptyPositionsStructure();

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
                        const templateName = templateManager.getTemplateFromId(id) || 'Trunk'; // Fallback à Trunk
                        const objectId = templateManager.getObjectTypeFromTemplate(templateName);

                        if (objectId && objectPositions[objectId]) {
                            // Obtenir la transformation mondiale sans décomposition excessive
                            node.updateWorldMatrix(true, false);

                            // Utiliser temporairement dummy pour obtenir position/rotation/scale
                            dummy.matrix.copy(node.matrixWorld);
                            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

                            // Extraire les valeurs directement
                            const rotation = new Euler().setFromQuaternion(dummy.quaternion);

                            // Ajouter la position à l'objet approprié
                            objectPositions[objectId].push({
                                x: dummy.position.x,
                                y: dummy.position.y,
                                z: dummy.position.z,
                                rotationX: rotation.x,
                                rotationY: rotation.y,
                                rotationZ: rotation.z,
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

            // Afficher les statistiques des positions trouvées
            const stats = {};
            for (const [objectId, positions] of Object.entries(objectPositions)) {
                stats[objectId] = positions.length;
            }
            console.log("Object positions count:", stats);

            // Stocker dans le store
            useStore.getState().setTreePositions(objectPositions);

            // Émettre l'événement avec les positions
            EventBus.trigger('tree-positions-ready', objectPositions);

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
    // Structure pour stocker les modèles de référence
    const templateModels = {};

    // Fonction pour calculer l'empreinte géométrique d'un modèle de manière plus précise
    const getGeometryFingerprint = (node) => {
        let vertexCount = 0;
        let faceCount = 0;
        let materialCount = 0;
        let boundingSize = { x: 0, y: 0, z: 0 };
        let meshCount = 0;
        let materialTypes = new Set();

        // Traverser l'objet pour collecter des informations détaillées sur sa géométrie
        node.traverse((child) => {
            if (child.isMesh && child.geometry) {
                meshCount++;

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

                // Enregistre les informations sur les matériaux
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        materialCount += child.material.length;
                        child.material.forEach(mat => materialTypes.add(mat.type));
                    } else {
                        materialCount++;
                        materialTypes.add(child.material.type);
                    }
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

        // Calculer le ratio hauteur/largeur pour aider à différencier les formes
        const aspectRatio = {
            xy: boundingSize.y / (boundingSize.x || 1),
            xz: boundingSize.z / (boundingSize.x || 1),
            yz: boundingSize.z / (boundingSize.y || 1)
        };

        // Volume approximatif pour aider à la comparaison
        const volume = boundingSize.x * boundingSize.y * boundingSize.z;

        return {
            vertexCount,
            faceCount,
            meshCount,
            materialCount,
            materialTypes: Array.from(materialTypes),
            boundingSize,
            aspectRatio,
            volume
        };
    };

    // Fonction pour trouver le modèle de template le plus similaire avec une logique améliorée
    const findMatchingTemplate = (node) => {
        const fingerprint = getGeometryFingerprint(node);
        let bestMatch = null;
        let bestScore = Number.MAX_VALUE;
        const scores = {}; // Pour le logging

        console.log(`Analysing node with ${fingerprint.vertexCount} vertices, ${fingerprint.faceCount} faces, ${fingerprint.meshCount} meshes`);

        // Comparer avec chaque modèle de template
        Object.entries(templateModels).forEach(([templateName, templateData]) => {
            const tf = templateData.fingerprint;

            // Facteurs de pondération pour donner plus d'importance à certains aspects
            const weights = {
                vertexCount: 0.5,
                faceCount: 0.5,
                meshCount: 2.0,
                materialCount: 1.0,
                volume: 0.8,
                aspectRatio: 1.5
            };

            // Calcul des différences relatives (en pourcentage) plutôt qu'absolues
            const vertexDiff = Math.abs(fingerprint.vertexCount - tf.vertexCount) / (tf.vertexCount || 1);
            const faceDiff = Math.abs(fingerprint.faceCount - tf.faceCount) / (tf.faceCount || 1);
            const meshDiff = Math.abs(fingerprint.meshCount - tf.meshCount) / (tf.meshCount || 1);
            const materialDiff = Math.abs(fingerprint.materialCount - tf.materialCount) / (tf.materialCount || 1);
            const volumeDiff = Math.abs(fingerprint.volume - tf.volume) / (tf.volume || 1);

            // Différence d'aspect ratio (forme)
            const aspectDiffXY = Math.abs(fingerprint.aspectRatio.xy - tf.aspectRatio.xy) / (tf.aspectRatio.xy || 1);
            const aspectDiffXZ = Math.abs(fingerprint.aspectRatio.xz - tf.aspectRatio.xz) / (tf.aspectRatio.xz || 1);
            const aspectDiffYZ = Math.abs(fingerprint.aspectRatio.yz - tf.aspectRatio.yz) / (tf.aspectRatio.yz || 1);
            const aspectDiff = (aspectDiffXY + aspectDiffXZ + aspectDiffYZ) / 3;

            // Score pondéré total (plus bas = meilleure correspondance)
            const score =
                weights.vertexCount * vertexDiff +
                weights.faceCount * faceDiff +
                weights.meshCount * meshDiff +
                weights.materialCount * materialDiff +
                weights.volume * volumeDiff +
                weights.aspectRatio * aspectDiff;

            scores[templateName] = {
                score,
                vertexDiff: (vertexDiff * 100).toFixed(1) + '%',
                faceDiff: (faceDiff * 100).toFixed(1) + '%',
                meshDiff: (meshDiff * 100).toFixed(1) + '%'
            };

            if (score < bestScore) {
                bestScore = score;
                bestMatch = templateName;
            }
        });

        // Ajustement du seuil - utiliser un seuil RELATIF plutôt que absolu
        const MATCH_THRESHOLD = 0.3;

        if (bestScore > MATCH_THRESHOLD) {
            console.log(`No good match found. Best match was ${bestMatch} with score ${bestScore.toFixed(3)}. Using 'Undefined'.`);
            console.log('Scores:', scores);
            return templateManager.undefinedCategory;
        }

        console.log(`Found match: ${bestMatch} with score ${bestScore.toFixed(3)}`);
        return bestMatch;
    };

    // Première passe : identifier les modèles de templates dans la scène
    console.log("Première passe: Identification des templates...");
    mapModel.traverse((node) => {
        // Récupérer tous les templates disponibles
        const knownTemplates = Object.keys(templateManager.templates);

        // Vérifier si le nœud correspond à un modèle de template connu
        if (node.name && knownTemplates.includes(node.name)) {
            console.log(`Template trouvé: ${node.name}`);

            // Enregistrer ce modèle comme référence et son empreinte détaillée
            const fingerprint = getGeometryFingerprint(node);
            templateModels[node.name] = { node, fingerprint };

            // Log des caractéristiques précises de ce template pour débogage
            console.log(`Template ${node.name} details:`, {
                vertices: fingerprint.vertexCount,
                faces: fingerprint.faceCount,
                meshes: fingerprint.meshCount,
                materials: fingerprint.materialCount,
                volume: fingerprint.volume.toFixed(2),
                aspectRatios: {
                    xy: fingerprint.aspectRatio.xy.toFixed(2),
                    xz: fingerprint.aspectRatio.xz.toFixed(2),
                    yz: fingerprint.aspectRatio.yz.toFixed(2)
                }
            });
        }
    });

    console.log("Templates identifiés:", Object.keys(templateModels));

    // Si aucun template n'a été trouvé, afficher un avertissement
    if (Object.keys(templateModels).length === 0) {
        console.warn("ATTENTION: Aucun template n'a été trouvé dans le modèle. Vérifiez les noms des modèles.");
    }

    // Créer la structure de positions
    const modelPositions = templateManager.createEmptyPositionsStructure();

    // Deuxième passe : analyser chaque instance et déterminer son template
    console.log("Deuxième passe: Analyse des instances...");

    // Parcourir le modèle pour trouver les instances
    const processQueue = [mapModel];
    const dummy = new Object3D(); // Objet temporaire réutilisable

    // Statistiques pour le rapport final
    const stats = {
        totalInstances: 0,
        matches: {}
    };

    while (processQueue.length > 0) {
        const node = processQueue.pop();

        // Si c'est une instance GeoNode
        if (node.name.startsWith('GN_Instance')) {
            stats.totalInstances++;

            // Extraire l'ID
            const match = node.name.match(/GN_Instance_(\d+)/);
            if (match) {
                const id = parseInt(match[1]);

                // Si l'ID est dans la map d'ID vers template, utiliser cette correspondance directe
                // sinon utiliser l'analyse géométrique
                let objectId;
                const templateName = templateManager.getTemplateFromId(id);

                if (templateName) {
                    objectId = templateManager.getObjectTypeFromTemplate(templateName);
                } else {
                    // Utiliser l'analyse géométrique comme fallback
                    const detectedTemplate = findMatchingTemplate(node);
                    objectId = templateManager.getObjectTypeFromTemplate(detectedTemplate);
                }

                // Statistiques
                stats.matches[objectId] = (stats.matches[objectId] || 0) + 1;

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
                    template: objectId,
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
                modelPositions[objectId].push(instanceInfo);
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
    const treePositions = templateManager.createEmptyPositionsStructure();

    // Remplir la structure simplifiée avec les rotations complètes
    Object.keys(treePositions).forEach(treeType => {
        if (modelPositions[treeType]) {
            treePositions[treeType] = modelPositions[treeType].map(instance => ({
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

    // Rapport final
    console.log("===== Rapport d'analyse des instances =====");
    console.log(`Total des instances analysées: ${stats.totalInstances}`);
    console.log("Distribution par type d'objet:");
    Object.entries(stats.matches).forEach(([type, count]) => {
        const percentage = ((count / stats.totalInstances) * 100).toFixed(1);
        console.log(`- ${type}: ${count} (${percentage}%)`);
    });

    // Créer les données JSON
    const modelJSON = JSON.stringify(modelPositions, null, 2);
    const treeJSON = JSON.stringify(treePositions, null, 2);

    // Sauvegarder les fichiers
    saveJSON(modelJSON, 'modelPositions.json');
    saveJSON(treeJSON, 'treePositions.json');

    console.log("GeoNodes positions extracted and saved!");
    console.log("Object counts:", {
        ...Object.entries(treePositions).reduce((acc, [key, val]) => {
            acc[key] = val.length;
            return acc;
        }, {})
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