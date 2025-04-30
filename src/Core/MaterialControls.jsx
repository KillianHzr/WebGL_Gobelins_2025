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
    const [materialsReady, setMaterialsReady] = useState(false);

    // Fonction pour collecter tous les matériaux de la scène
    const collectAllMaterials = () => {
        const materials = new Map();

        scene.traverse((object) => {
            if (!object.isMesh || !object.material) return;

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
                            color: material.color ? material.color.clone() : null,
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

                    materials.set(material.uuid, material);
                }
            });
        });

        debugLog(`Collected ${materials.size} unique materials from scene`);
        return Array.from(materials.values());
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
            if (originalState.color && material.color) material.color.copy(originalState.color);

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

                // Collecter tous les matériaux
                const allMaterials = collectAllMaterials();
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
                    materialsFolder.close()
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

                        // État du matériau
                        const materialControls = {
                            // Contrôles de base
                            color: '#' + (material.color ? material.color.getHexString() : 'ffffff'),
                            wireframe: material.wireframe || false,

                            // Autres propriétés selon le type de matériau
                            ...(material.roughness !== undefined ? {roughness: material.roughness} : {}),
                            ...(material.metalness !== undefined ? {metalness: material.metalness} : {}),
                            ...(material.opacity !== undefined ? {opacity: material.opacity} : {}),

                            // Fonction de réinitialisation
                            reset: () => {
                                resetMaterial(material);

                                // Mettre à jour les contrôleurs
                                if (material.color) {
                                    materialControls.color = '#' + material.color.getHexString();
                                    materialFolder.__controllers.find(c => c.property === 'color')?.updateDisplay();
                                }

                                if (material.roughness !== undefined) {
                                    materialControls.roughness = material.roughness;
                                    materialFolder.__controllers.find(c => c.property === 'roughness')?.updateDisplay();
                                }

                                if (material.metalness !== undefined) {
                                    materialControls.metalness = material.metalness;
                                    materialFolder.__controllers.find(c => c.property === 'metalness')?.updateDisplay();
                                }

                                if (material.opacity !== undefined) {
                                    materialControls.opacity = material.opacity;
                                    materialFolder.__controllers.find(c => c.property === 'opacity')?.updateDisplay();
                                }

                                materialControls.wireframe = material.wireframe || false;
                                materialFolder.__controllers.find(c => c.property === 'wireframe')?.updateDisplay();

                                // Forcer un rendu
                                if (gl && gl.render && scene) {
                                    const camera = scene.getObjectByProperty('isCamera', true) ||
                                        scene.children.find(child => child.isCamera);
                                    if (camera) gl.render(scene, camera);
                                }
                            }
                        };

                        // Ajouter les contrôleurs pour ce matériau
                        materialFolder.addColor(materialControls, 'color').name('Color').onChange(value => {
                            try {
                                material.color.set(value);
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating color for ${material._objectName}:`, error);
                            }
                        });

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

                        if (material.opacity !== undefined) {
                            materialFolder.add(materialControls, 'opacity', 0, 1, 0.01).name('Opacity').onChange(value => {
                                try {
                                    // Activer la transparence si l'opacité est < 1
                                    material.transparent = value < 1;
                                    material.opacity = value;
                                    material.needsUpdate = true;
                                } catch (error) {
                                    console.warn(`Error updating opacity for ${material._objectName}:`, error);
                                }
                            });
                        }

                        materialFolder.add(materialControls, 'wireframe').name('Wireframe').onChange(value => {
                            try {
                                material.wireframe = value;
                                material.needsUpdate = true;
                            } catch (error) {
                                console.warn(`Error updating wireframe for ${material._objectName}:`, error);
                            }
                        });

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