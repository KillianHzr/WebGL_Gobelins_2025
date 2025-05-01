import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import * as THREE from 'three';

// Activer ou désactiver les logs pour le débogage
const DEBUG_MATERIALS = true;

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    if (DEBUG_MATERIALS) console.log(`[MaterialControls] ${message}`, ...args);
};

export default function MaterialControls() {
    const {scene, gl} = useThree();
    const {debug, gui, updateDebugConfig} = useStore();
    const foldersRef = useRef({});
    const initialized = useRef(false);
    const originalMaterialStates = useRef({});
    const originalMeshStates = useRef({});  // Pour stocker l'état original des meshes
    const [materialsReady, setMaterialsReady] = useState(false);

    // Fonction pour collecter tous les matériaux et meshes de la scène
    const collectAllMaterials = () => {
        const materials = new Map();
        const meshes = new Map();  // Stocker les références aux meshes

        scene.traverse((object) => {
            if (!object.isMesh || !object.material) return;

            // Sauvegarder l'état original du mesh pour les propriétés de shadow
            if (!originalMeshStates.current[object.uuid]) {
                originalMeshStates.current[object.uuid] = {
                    castShadow: object.castShadow,
                    receiveShadow: object.receiveShadow
                };
            }

            // Ajouter le mesh à la map
            if (!meshes.has(object.uuid)) {
                meshes.set(object.uuid, object);
            }

            const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];

            meshMaterials.forEach(material => {
                // Extraire le model ID à partir du nom de l'objet
                const extractModelId = (objectName) => {
                    const parts = objectName.split('_lod');
                    return parts[0]; // Par exemple "TrunkThin" de "TrunkThin_lod0_chunkTrunkThin_-1_0"
                };

                const modelId = extractModelId(object.name);

                if (material && material.uuid && !materials.has(material.uuid)) {
                    // Sauvegarder l'état original
                    if (!originalMaterialStates.current[material.uuid]) {
                        originalMaterialStates.current[material.uuid] = {
                            // color: material.color ? material.color.clone() : null,
                            roughness: material.roughness,
                            metalness: material.metalness,
                            transparent: material.transparent,
                            opacity: material.opacity,
                            wireframe: material.wireframe
                        };
                    }

                    // Utiliser le modelId extrait
                    material._objectName = modelId || 'Unknown';
                    material._objectType = object.type;

                    // Associer le matériau avec le mesh
                    material._meshRefs = material._meshRefs || [];
                    if (!material._meshRefs.includes(object.uuid)) {
                        material._meshRefs.push(object.uuid);
                    }

                    materials.set(material.uuid, material);
                }
            });
        });

        debugLog(`Collected ${materials.size} unique materials and ${meshes.size} meshes from scene`);
        return {
            materials: Array.from(materials.values()),
            meshes
        };
    };

    // Fonction pour vérifier si la scène est prête
    const isSceneReady = () => {
        let materialCount = 0;

        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                materialCount++;
            }
        });

        return materialCount > 0;
    };

    // Fonction pour réinitialiser un matériau à son état d'origine
    const resetMaterial = (material) => {
        if (!material || !material.uuid) return;

        const originalState = originalMaterialStates.current[material.uuid];
        if (!originalState) return;

        try {
            // Restaurer les propriétés si elles existent
            // if (originalState.color && material.color) material.color.copy(originalState.color);

            if (originalState.roughness !== undefined) material.roughness = originalState.roughness;
            if (originalState.metalness !== undefined) material.metalness = originalState.metalness;
            if (originalState.transparent !== undefined) material.transparent = originalState.transparent;
            if (originalState.opacity !== undefined) material.opacity = originalState.opacity;
            if (originalState.wireframe !== undefined) material.wireframe = originalState.wireframe;

            material.needsUpdate = true;
        } catch (error) {
            console.warn(`Error resetting material ${material._objectName}:`, error);
        }
    };

    // Fonction pour réinitialiser les propriétés de shadow d'un mesh
    const resetMeshShadowProperties = (meshUuid, meshesMap) => {
        const mesh = meshesMap.get(meshUuid);
        if (!mesh) return;

        const originalState = originalMeshStates.current[meshUuid];
        if (!originalState) return;

        try {
            if (originalState.castShadow !== undefined) mesh.castShadow = originalState.castShadow;
            if (originalState.receiveShadow !== undefined) mesh.receiveShadow = originalState.receiveShadow;
        } catch (error) {
            console.warn(`Error resetting shadow properties for mesh ${mesh.name}:`, error);
        }
    };

    // Hook pour vérifier la disponibilité des matériaux
    useEffect(() => {
        const checkMaterialsReadyInterval = setInterval(() => {
            if (isSceneReady()) {
                clearInterval(checkMaterialsReadyInterval);
                setMaterialsReady(true);
            }
        }, 500); // Vérifier toutes les 500ms

        return () => clearInterval(checkMaterialsReadyInterval);
    }, [scene]);

    // Initialisation des contrôles GUI pour les matériaux
    useEffect(() => {
        // Vérifier si le debug est activé et l'interface GUI disponible
        // Et si les matériaux sont prêts
        if (!materialsReady ||
            !debug?.active ||
            !debug?.showGui ||
            !gui ||
            typeof gui.addFolder !== 'function' ||
            initialized.current
        ) {
            return;
        }

        // Utiliser un timeout supplémentaire pour s'assurer que tout est chargé
        const initTimer = setTimeout(() => {
            try {
                console.log("Setting up individual material controls");

                // Collecter tous les matériaux et meshes
                const {materials: allMaterials, meshes: meshesMap} = collectAllMaterials();
                if (allMaterials.length === 0) {
                    console.warn("No materials found in scene");
                    return;
                }

                // Créer le dossier principal pour les matériaux
                let materialsFolder;
                try {
                    if (gui.__folders && gui.__folders["Materials"]) {
                        gui.removeFolder(gui.__folders["Materials"]);
                    }
                    materialsFolder = gui.addFolder("Materials");
                    materialsFolder.close();
                } catch (e) {
                    console.warn("Error creating Materials folder:", e);
                    try {
                        materialsFolder = gui.addFolder("MaterialsControls");
                    } catch (e2) {
                        console.error("Failed to create folder:", e2);
                        return;
                    }
                }

                // Créer un sous-dossier pour chaque matériau unique
                allMaterials.forEach((material) => {
                    // Utiliser le nom de l'objet pour le dossier
                    const folderName = material._objectName || 'Unknown Material';
                    if (folderName !== "Unknown Material" && folderName !== "Unknown") {
                        const materialFolder = materialsFolder.addFolder(folderName);
                        foldersRef.current[material.uuid] = materialFolder;
                        materialFolder.close();

                        // État du matériau
                        const materialControls = {
                            // Contrôles de base
                            // color: '#' + (material.color ? material.color.getHexString() : 'ffffff'),
                            wireframe: material.wireframe || false,

                            // Autres propriétés selon le type de matériau
                            ...(material.roughness !== undefined ? {roughness: material.roughness} : {}),
                            ...(material.metalness !== undefined ? {metalness: material.metalness} : {}),
                            ...(material.opacity !== undefined ? {opacity: material.opacity} : {}),

                            // Contrôle de l'environment mapping
                            ...(material.envMapIntensity !== undefined ? {
                                envMapIntensity: material.envMapIntensity
                            } : {}),

                            // Propriétés de shadow pour les meshes associés
                            castShadow: material._meshRefs && material._meshRefs.length > 0
                                ? meshesMap.get(material._meshRefs[0])?.castShadow || false
                                : false,
                            receiveShadow: material._meshRefs && material._meshRefs.length > 0
                                ? meshesMap.get(material._meshRefs[0])?.receiveShadow || false
                                : false,

                            // Fonction de réinitialisation
                            reset: () => {
                                resetMaterial(material);

                                // Réinitialiser les propriétés de shadow pour tous les meshes associés
                                if (material._meshRefs && material._meshRefs.length > 0) {
                                    material._meshRefs.forEach(meshUuid => {
                                        resetMeshShadowProperties(meshUuid, meshesMap);
                                    });
                                }

                                // Mettre à jour les contrôleurs
                                // Mise à jour des contrôleurs existants...

                                // Mise à jour du contrôleur d'environment mapping
                                if (material.envMapIntensity !== undefined) {
                                    materialControls.envMapIntensity = material.envMapIntensity;
                                    const envMapController = materialFolder.__controllers.find(c => c.property === 'envMapIntensity');
                                    if (envMapController) {
                                        envMapController.updateDisplay();
                                    }
                                }

                                // Forcer un rendu
                                if (gl && gl.render && scene) {
                                    const camera = scene.getObjectByProperty('isCamera', true) ||
                                        scene.children.find(child => child.isCamera);
                                    if (camera) gl.render(scene, camera);
                                }
                            }
                        };

                        // Ajouter les contrôleurs pour ce matériau
                        // materialFolder.addColor(materialControls, 'color').name('Color').onChange(value => {
                        //     try {
                        //         material.color.set(value);
                        //         material.needsUpdate = true;
                        //     } catch (error) {
                        //         console.warn(`Error updating color for ${material._objectName}:`, error);
                        //     }
                        // });

                        if (material.roughness !== undefined) {
                            materialFolder.add(materialControls, 'roughness', 0, 1, 0.01).name('Roughness').onChange(value => {
                                try {
                                    material.roughness = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating roughness for ${material._objectName}:`, error);
                                }
                            });
                        }

                        if (material.metalness !== undefined) {
                            materialFolder.add(materialControls, 'metalness', 0, 1, 0.01).name('Metalness').onChange(value => {
                                try {
                                    material.metalness = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating metalness for ${material._objectName}:`, error);
                                }
                            });
                        }
                        // Ajouter le contrôleur pour l'environment mapping
                        if (material.envMapIntensity !== undefined) {
                            materialFolder.add(materialControls, 'envMapIntensity', 0, 2, 0.01)
                                .name('EnvMap Intensity')
                                .onChange(value => {
                                    try {
                                        material.envMapIntensity = value;
                                        material.needsUpdate = true;
                                        debugLog(`Updated envMapIntensity for ${material._objectName} to ${value}`);
                                    } catch (error) {
                                        console.warn(`Error updating envMapIntensity for ${material._objectName}:`, error);
                                    }
                                });
                        }
                        // if (material.opacity !== undefined) {
                        //     materialFolder.add(materialControls, 'opacity', 0, 1, 0.01).name('Opacity').onChange(value => {
                        //         try {
                        //             // Activer la transparence si l'opacité est < 1
                        //             material.transparent = value < 1;
                        //             material.opacity = value;
                        //             material.needsUpdate = true;
                        //         } catch (error) {
                        //             console.warn(`Error updating opacity for ${material._objectName}:`, error);
                        //         }
                        //     });
                        // }

                        materialFolder.add(materialControls, 'wireframe').name('Wireframe').onChange(value => {
                            try {
                                material.wireframe = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating wireframe for ${material._objectName}:`, error);
                            }
                        });

                        // Ajouter les contrôleurs pour les propriétés de shadow
                        if (material._meshRefs && material._meshRefs.length > 0) {
                            materialFolder.add(materialControls, 'castShadow').name('Cast Shadow').onChange(value => {
                                try {
                                    // Appliquer à tous les meshes associés à ce matériau
                                    material._meshRefs.forEach(meshUuid => {
                                        const mesh = meshesMap.get(meshUuid);
                                        if (mesh) {
                                            mesh.castShadow = value;
                                        }
                                    });
                                } catch (error) {
                                    console.warn(`Error updating cast shadow for ${material._objectName}:`, error);
                                }
                            });

                            materialFolder.add(materialControls, 'receiveShadow').name('Receive Shadow').onChange(value => {
                                try {
                                    // Appliquer à tous les meshes associés à ce matériau
                                    material._meshRefs.forEach(meshUuid => {
                                        const mesh = meshesMap.get(meshUuid);
                                        if (mesh) {
                                            mesh.receiveShadow = value;
                                            if (mesh.material) {
                                                mesh.material.needsUpdate = true;
                                            }
                                        }
                                    });
                                } catch (error) {
                                    console.warn(`Error updating receive shadow for ${material._objectName}:`, error);
                                }
                            });
                        }

                        // Ajouter un bouton de réinitialisation
                        materialFolder.add(materialControls, 'reset').name('Reset Material');
                    }
                });

                materialsFolder.close();
                initialized.current = true;
                console.log("Individual material controls initialized successfully");
            } catch (error) {
                console.error("Error initializing material controls:", error);
            }
        }, 2000); // Augmenté à 2 secondes pour plus de fiabilité

        // Nettoyage
        return () => {
            clearTimeout(initTimer);
            if (gui) {
                try {
                    // Supprimer tous les dossiers de matériaux
                    Object.values(foldersRef.current).forEach(folder => {
                        try {
                            gui.removeFolder(folder);
                        } catch (e) {
                            console.warn("Error removing material folder:", e);
                        }
                    });
                } catch (e) {
                    console.warn("Error during cleanup:", e);
                }
            }
        };
    }, [materialsReady, debug, gui, scene, gl]);

    return null; // Ce composant ne rend rien
}