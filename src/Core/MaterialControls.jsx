import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';
import * as THREE from 'three';

// Activer ou désactiver les logs pour le débogage
const DEBUG_MATERIALS = true;

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    if (DEBUG_MATERIALS) console.log(`[MaterialControls] ${message}`, ...args);
};

export default function MaterialControls() {
    const { scene, gl } = useThree();
    const { debug, gui, updateDebugConfig } = useStore();
    const folderRef = useRef(null);
    const initialized = useRef(false);
    const materialGroups = useRef({});
    const originalMaterialStates = useRef({});

    // Helper pour extraire le nom du groupe à partir du nom de l'objet
    const extractGroupName = (objectName) => {
        if (!objectName) return 'Unknown';

        const patterns = {
            'Tree': ['Tree', 'Trunk', 'Branch'],
            'Bush': ['Bush', 'Plant'],
            'Flower': ['Flower', 'Clover', 'Bell'],
            'Mushroom': ['Mushroom'],
            'Rock': ['Rock', 'Stone'],
            'Ground': ['Ground'],
            'Water': ['Water', 'River']
        };

        for (const [group, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => objectName.includes(keyword))) {
                return group;
            }
        }

        return 'Unknown';
    };

    // Fonction pour sauvegarder l'état original d'un matériau
    const saveOriginalMaterialState = (material) => {
        if (!material || !material.uuid) return;

        // Éviter de sauvegarder plusieurs fois le même matériau
        if (originalMaterialStates.current[material.uuid]) return;

        originalMaterialStates.current[material.uuid] = {
            color: material.color ? material.color.clone() : null,
            roughness: material.roughness,
            metalness: material.metalness,
            transparent: material.transparent,
            opacity: material.opacity,
            wireframe: material.wireframe
        };
    };

    // Collecter tous les matériaux uniques dans la scène et les grouper
    const collectMaterials = () => {
        try {
            const groups = {};
            const processedMaterials = new Set();

            scene.traverse((object) => {
                if (!object.isMesh || !object.material) return;

                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];

                materials.forEach(material => {
                    // Éviter les doublons
                    if (processedMaterials.has(material.uuid)) return;
                    processedMaterials.add(material.uuid);

                    // Sauvegarder l'état original du matériau
                    saveOriginalMaterialState(material);

                    // Extraire le groupe en fonction du nom de l'objet
                    const groupName = extractGroupName(object.name || (object.parent ? object.parent.name : ''));

                    if (!groups[groupName]) {
                        groups[groupName] = [];
                    }

                    // Ajouter des informations supplémentaires
                    material._objectName = object.name || (object.parent ? object.parent.name : 'Unknown');

                    groups[groupName].push(material);
                });
            });

            debugLog(`Collected materials by group:`, Object.keys(groups).map(key => `${key}: ${groups[key].length}`));
            return groups;
        } catch (error) {
            console.error("Error collecting materials:", error);
            return {};
        }
    };

    // Fonction pour mettre à jour un paramètre pour tous les matériaux d'un groupe
    const updateGroupParam = (groupName, paramName, value) => {
        try {
            const materials = materialGroups.current[groupName] || [];

            debugLog(`Updating ${paramName} to ${value} for ${materials.length} materials in group ${groupName}`);

            // Mettre à jour tous les matériaux du groupe
            let updatedMaterials = 0;
            materials.forEach(material => {
                try {
                    if (paramName === 'color') {
                        material.color.set(value);
                    } else if (material[paramName] !== undefined) {
                        material[paramName] = value;
                    }

                    // Forcer la mise à jour du matériau
                    material.needsUpdate = true;
                    updatedMaterials++;
                } catch (innerError) {
                    console.warn(`Error updating material property ${paramName}:`, innerError);
                }
            });

            // Mettre à jour directement tous les matériaux dans la scène qui correspondent au groupe
            // C'est une double vérification pour s'assurer que tous les matériaux sont mis à jour
            scene.traverse((object) => {
                if (object.isMesh && object.material) {
                    const objName = object.name || (object.parent ? object.parent.name : '');
                    const materialGroupName = extractGroupName(objName);

                    if (materialGroupName === groupName) {
                        const materials = Array.isArray(object.material)
                            ? object.material
                            : [object.material];

                        materials.forEach(mat => {
                            try {
                                if (paramName === 'color') {
                                    mat.color.set(value);
                                } else if (mat[paramName] !== undefined) {
                                    mat[paramName] = value;
                                }

                                mat.needsUpdate = true;
                                updatedMaterials++;
                            } catch (err) {
                                // Ignorer les erreurs individuelles
                            }
                        });
                    }
                }
            });

            // Force un rendu après les modifications
            try {
                if (gl && typeof gl.render === 'function') {
                    const mainCamera = scene.children.find(c => c.isCamera);
                    if (mainCamera) gl.render(scene, mainCamera);
                }
            } catch (e) {
                // Ignorer les erreurs de rendu
            }

            // Sauvegarder la valeur dans le store pour persistance
            if (updateDebugConfig) {
                updateDebugConfig(`materials.${groupName}.${paramName}`, value);
            }
        } catch (error) {
            console.error(`Error updating group parameter ${paramName} for ${groupName}:`, error);
        }
    };

    // Fonction pour réinitialiser un matériau
    const resetMaterial = (material) => {
        try {
            if (!material || !material.uuid) return;

            const originalState = originalMaterialStates.current[material.uuid];
            if (!originalState) {
                console.warn(`No original state found for material: ${material._objectName}`);
                return;
            }

            // Restaurer les propriétés
            if (originalState.color) material.color.copy(originalState.color);

            if (originalState.roughness !== undefined) material.roughness = originalState.roughness;
            if (originalState.metalness !== undefined) material.metalness = originalState.metalness;
            if (originalState.transparent !== undefined) material.transparent = originalState.transparent;
            if (originalState.opacity !== undefined) material.opacity = originalState.opacity;
            if (originalState.wireframe !== undefined) material.wireframe = originalState.wireframe;

            material.needsUpdate = true;
        } catch (error) {
            console.error(`Error resetting material:`, error);
        }
    };

    // Fonction pour forcer un rendu de la scène
    const forceRender = () => {
        try {
            scene.traverse(obj => {
                if (obj.isMesh && obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(m => { if (m) m.needsUpdate = true; });
                }
            });

            if (gl && typeof gl.render === 'function') {
                const mainCamera = scene.children.find(c => c.isCamera);
                if (mainCamera) gl.render(scene, mainCamera);
            }
        } catch (e) {
            console.warn("Force render error:", e);
        }
    };

    // Initialisation des contrôles GUI pour les matériaux
    useEffect(() => {
        // Vérifier si le debug est activé et l'interface GUI disponible
        if (!debug?.active || !debug?.showGui || !gui || typeof gui.addFolder !== 'function') {
            return;
        }

        // Éviter l'initialisation multiple
        if (initialized.current) return;

        // Utiliser un timeout pour s'assurer que le GUI est prêt
        const initTimer = setTimeout(() => {
            try {
                console.log("Setting up materials debug UI");

                // Collecter les matériaux d'abord
                materialGroups.current = collectMaterials();

                // Créer le dossier principal pour les matériaux
                let materialsFolder;
                try {
                    // Essayer de supprimer un dossier existant
                    if (gui.__folders && gui.__folders["Materials"]) {
                        gui.removeFolder(gui.__folders["Materials"]);
                    }
                    materialsFolder = gui.addFolder("Materials");
                } catch (err) {
                    console.warn("Error handling Materials folder:", err);
                    try {
                        materialsFolder = gui.addFolder("Materials_new");
                    } catch (e) {
                        console.error("Failed to create Materials folder:", e);
                        return; // Abandonner si on ne peut pas créer le dossier
                    }
                }

                folderRef.current = materialsFolder;

                // Ajouter un bouton de réinitialisation global
                const globalControls = {
                    resetAllMaterials: () => {
                        try {
                            Object.values(materialGroups.current).flat().forEach(resetMaterial);
                            console.log("All materials have been reset to original state");
                            forceRender();
                        } catch (error) {
                            console.error("Error resetting all materials:", error);
                        }
                    }
                };

                materialsFolder.add(globalControls, 'resetAllMaterials').name('Reset All Materials');

                // Créer un dossier pour chaque groupe de matériaux
                Object.entries(materialGroups.current).forEach(([groupName, materials]) => {
                    if (materials.length === 0) return;

                    try {
                        const groupFolder = materialsFolder.addFolder(`${groupName} (${materials.length})`);

                        // Si le groupe a des matériaux, utiliser les valeurs du premier comme valeurs par défaut
                        if (materials.length === 0) return;
                        const firstMaterial = materials[0];

                        // Paramètres du groupe
                        const groupParams = {
                            color: '#' + firstMaterial.color.getHexString(),
                            roughness: firstMaterial.roughness !== undefined ? firstMaterial.roughness : 0.5,
                            metalness: firstMaterial.metalness !== undefined ? firstMaterial.metalness : 0.0,
                            opacity: firstMaterial.opacity !== undefined ? firstMaterial.opacity : 1.0,
                            wireframe: firstMaterial.wireframe !== undefined ? firstMaterial.wireframe : false,
                            resetGroup: () => {
                                try {
                                    materials.forEach(resetMaterial);
                                    console.log(`Reset all materials in group ${groupName}`);
                                    forceRender();
                                } catch (error) {
                                    console.error(`Error resetting group ${groupName}:`, error);
                                }
                            }
                        };

                        // Ajouter les contrôles pour les paramètres communs
                        groupFolder.addColor(groupParams, 'color').name('Color').onChange(value => {
                            updateGroupParam(groupName, 'color', value);
                        });

                        // Ajouter roughness et metalness seulement si le premier matériau les prend en charge
                        if (firstMaterial.roughness !== undefined) {
                            groupFolder.add(groupParams, 'roughness', 0, 1, 0.01).name('Roughness').onChange(value => {
                                updateGroupParam(groupName, 'roughness', value);
                            });
                        }

                        if (firstMaterial.metalness !== undefined) {
                            groupFolder.add(groupParams, 'metalness', 0, 1, 0.01).name('Metalness').onChange(value => {
                                updateGroupParam(groupName, 'metalness', value);
                            });
                        }

                        if (firstMaterial.opacity !== undefined) {
                            groupFolder.add(groupParams, 'opacity', 0, 1, 0.01).name('Opacity').onChange(value => {
                                updateGroupParam(groupName, 'opacity', value);
                                // Si l'opacité est inférieure à 1, forcer transparent à true
                                if (value < 1) {
                                    updateGroupParam(groupName, 'transparent', true);
                                }
                            });
                        }

                        groupFolder.add(groupParams, 'wireframe').name('Wireframe').onChange(value => {
                            updateGroupParam(groupName, 'wireframe', value);
                        });

                        // Ajouter le bouton de réinitialisation du groupe
                        groupFolder.add(groupParams, 'resetGroup').name('Reset Group');
                    } catch (error) {
                        console.error(`Error setting up GUI for group ${groupName}:`, error);
                    }
                });

                initialized.current = true;
                console.log("Material controls initialized successfully");

                // Force la mise à jour complète de la scène une fois au démarrage
                forceRender();
            } catch (error) {
                console.error("Error initializing material controls:", error);
            }
        }, 1000); // Délai d'une seconde pour s'assurer que tout est initialisé

        // Nettoyage
        return () => {
            clearTimeout(initTimer);
            if (folderRef.current && gui) {
                try {
                    gui.removeFolder(folderRef.current);
                } catch (error) {
                    console.warn("Error removing materials folder:", error);
                }
            }
        };
    }, [debug, gui, scene, updateDebugConfig, gl]);

    // Ce composant ne rend rien visuellement
    return null;
}