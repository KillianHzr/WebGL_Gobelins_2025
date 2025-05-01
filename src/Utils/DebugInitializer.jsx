import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';
import guiConfig from '../Config/guiConfig';
import {audioManager} from './AudioManager';
import {addNarrationControlsToDebug} from './NarrationDebugControls';
import {EventBus} from './EventEmitter';
import * as THREE from 'three';
import { getProject } from '@theatre/core';
import sceneObjectManager from '../Config/SceneObjectManager';

/**
 * Component that initializes debug features based on URL hash
 * This component doesn't render anything but handles the side effects
 * related to debug mode initialization
 */
const DebugInitializer = () => {
    const {scene, camera, controls} = useThree();
    const {debug, setDebug, setGui, setDebugConfig} = useStore();
    const initializedRef = useRef(false);

    // Fonction utilitaire pour manipuler l'interface Theatre.js
    // sans causer de re-rendu des composants React
    const toggleTheatreUI = (show) => {
        if (window.__theatreStudio) {
            try {
                if (show) {
                    console.log('Restoring Theatre.js UI');
                    window.__theatreStudio.ui.restore();
                } else {
                    console.log('Hiding Theatre.js UI');
                    window.__theatreStudio.ui.hide();
                }

                // Mettre à jour la configuration sans modifier l'état React
                if (useStore.getState().debugConfig) {
                    const updatedConfig = {...useStore.getState().debugConfig};
                    if (!updatedConfig.theatre) updatedConfig.theatre = {};
                    if (!updatedConfig.theatre.showUI) updatedConfig.theatre.showUI = {};
                    updatedConfig.theatre.showUI.value = show;

                    // Mettre à jour directement sans déclencher un re-rendu
                    setDebugConfig(updatedConfig);
                }
            } catch (error) {
                console.error('Error toggling Theatre.js UI:', error);
            }
        } else {
            console.warn('Theatre.js instance not found');
        }
    };

    // Amélioration de la fonction toggleCameraMode existante
    const toggleCameraMode = (mode) => {
        // Update the visualization state in the store
        useStore.getState().visualization.cameraMode = mode;

        // Store the setting in debug config
        if (useStore.getState().updateDebugConfig) {
            useStore.getState().updateDebugConfig('visualization.cameraMode.value', mode);
        }

        console.log(`Camera mode switched to: ${mode}`);

        // Emit an event for other components
        EventBus.trigger('camera-mode-changed', { mode });
    };

    // Fonction pour appliquer le mode wireframe à tous les objets de la scène
    const applyWireframeToScene = (enabled) => {
        if (!scene) return;

        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                // Gérer les matériaux multiples
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        material.wireframe = enabled;
                    });
                } else {
                    object.material.wireframe = enabled;
                }

                // S'assurer que le matériau est mis à jour
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        material.needsUpdate = true;
                    });
                } else {
                    object.material.needsUpdate = true;
                }
            }
        });

        console.log(`Wireframe mode ${enabled ? 'enabled' : 'disabled'}`);
    };

    // Fonction pour mettre à jour la visibilité des objets dans la scène
    const updateObjectsVisibility = (settings) => {
        if (!scene) return;

        // Parcourir tous les objets de la scène
        scene.traverse((object) => {
            // Vérification des objets de la forêt (instances)
            if (object.name === 'Forest' || object.name?.includes('instances') || object.name?.includes('MapInstance')) {
                if (object.visible !== settings.showInstances) {
                    object.visible = settings.showInstances;
                    console.log(`${object.name} visibility set to ${settings.showInstances}`);
                }
            }

            // Gestion des objets interactifs
            else if (object.name === 'interactive-objects' || object.parent?.name === 'interactive-objects') {
                if (object.visible !== settings.showInteractive) {
                    object.visible = settings.showInteractive;
                    console.log(`${object.name} visibility set to ${settings.showInteractive}`);
                }
            }

            // Gestion des objets statiques
            else if (object.name === 'static-objects' || object.parent?.name === 'static-objects') {
                if (object.visible !== settings.showStatic) {
                    object.visible = settings.showStatic;
                    console.log(`${object.name} visibility set to ${settings.showStatic}`);
                }
            }
        });

        // Émettre un événement pour informer d'autres composants
        EventBus.trigger('objects-visibility-changed', settings);
    };

    useEffect(() => {
        // Initialize GUI if debug mode is active
        if (debug?.active && debug?.showGui && !initializedRef.current) {
            initializedRef.current = true;

            // Create GUI only if it doesn't exist yet
            const gui = new GUI({
                width: guiConfig.gui.width || 300
            });
            gui.title(guiConfig.gui.title || 'Debug Controls');

            // Ferme tous les dossiers par défaut si configuré ainsi
            if (guiConfig.gui.closeFolders) {
                gui.close();
            }

            // Ajout des contrôles de visualisation
            const visualizationFolder = gui.addFolder('Visualisation');

            // Configurer les paramètres de visualisation
            const visualizationSettings = {
                wireframe: false,
                showInstances: true,
                showInteractive: true,
                showStatic: true,
                cameraMode: 'theatre' // 'theatre' ou 'free'
            };

            // Obtenir les valeurs sauvegardées si disponibles
            if (useStore.getState().getDebugConfigValue) {
                visualizationSettings.wireframe = useStore.getState().getDebugConfigValue(
                    'visualization.wireframe.value',
                    false
                );
                visualizationSettings.showInstances = useStore.getState().getDebugConfigValue(
                    'visualization.showInstances.value',
                    true
                );
                visualizationSettings.showInteractive = useStore.getState().getDebugConfigValue(
                    'visualization.showInteractive.value',
                    true
                );
                visualizationSettings.showStatic = useStore.getState().getDebugConfigValue(
                    'visualization.showStatic.value',
                    true
                );
                visualizationSettings.cameraMode = useStore.getState().getDebugConfigValue(
                    'visualization.cameraMode.value',
                    'theatre'
                );
            }

            // Initialiser l'état dans le store
            if (!useStore.getState().visualization) {
                useStore.getState().visualization = {...visualizationSettings};
            }

            // Contrôle du mode wireframe
            visualizationFolder.add(visualizationSettings, 'wireframe')
                .name('Mode Wireframe')
                .onChange(value => {
                    applyWireframeToScene(value);
                    useStore.getState().visualization.wireframe = value;

                    // Mettre à jour la configuration enregistrée
                    if (useStore.getState().updateDebugConfig) {
                        useStore.getState().updateDebugConfig('visualization.wireframe.value', value);
                    }
                });

            // Contrôle de la visibilité des instances (forêt)
            visualizationFolder.add(visualizationSettings, 'showInstances')
                .name('Afficher Instances')
                .onChange(value => {
                    useStore.getState().visualization.showInstances = value;
                    updateObjectsVisibility(useStore.getState().visualization);

                    // Mettre à jour la configuration enregistrée
                    if (useStore.getState().updateDebugConfig) {
                        useStore.getState().updateDebugConfig('visualization.showInstances.value', value);
                    }
                });

            // Contrôle de la visibilité des objets interactifs
            visualizationFolder.add(visualizationSettings, 'showInteractive')
                .name('Afficher Interactifs')
                .onChange(value => {
                    useStore.getState().visualization.showInteractive = value;
                    updateObjectsVisibility(useStore.getState().visualization);

                    // Mettre à jour la configuration enregistrée
                    if (useStore.getState().updateDebugConfig) {
                        useStore.getState().updateDebugConfig('visualization.showInteractive.value', value);
                    }
                });

            // Contrôle de la visibilité des objets statiques
            visualizationFolder.add(visualizationSettings, 'showStatic')
                .name('Afficher Statiques')
                .onChange(value => {
                    useStore.getState().visualization.showStatic = value;
                    updateObjectsVisibility(useStore.getState().visualization);

                    // Mettre à jour la configuration enregistrée
                    if (useStore.getState().updateDebugConfig) {
                        useStore.getState().updateDebugConfig('visualization.showStatic.value', value);
                    }
                });

            // Contrôle du mode de caméra
            const cameraModeOptions = {
                "TheatreJS": 'theatre',
                "Libre": 'free'
            };

            visualizationFolder.add(visualizationSettings, 'cameraMode', cameraModeOptions)
                .name('Mode Caméra')
                .onChange(toggleCameraMode);

            // Si configuré ainsi, fermer le dossier
            if (guiConfig.gui.closeFolders) {
                visualizationFolder.close();
            }

            const interactionPointsFolder = gui.addFolder('Points d\'interaction');

            // Récupérer les emplacements d'interaction depuis sceneObjectManager
            const interactivePlacements = sceneObjectManager.getInteractivePlacements();

            // Fonction pour téléporter la caméra à un emplacement spécifique
            const teleportCamera = (interactionPoint) => {
                if (!camera) {
                    console.warn("Camera not available for teleportation");
                    return;
                }

                try {
                    // Extraire la position du point d'interaction
                    const posX = interactionPoint.position[0] || 0;
                    const posY = interactionPoint.position[1] || 0;
                    const posZ = interactionPoint.position[2] || 0;

                    const interactionPos = new THREE.Vector3(posX, posY, posZ);

                    // Position de la caméra légèrement en arrière et au-dessus du point d'interaction
                    const cameraOffset = new THREE.Vector3(0, 2, 5);

                    // Position finale de la caméra
                    const cameraPos = interactionPos.clone().add(cameraOffset);

                    console.log(`Teleporting camera to: ${cameraPos.x}, ${cameraPos.y}, ${cameraPos.z}`);

                    // Téléporter la caméra à la position calculée
                    camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);

                    // Faire la caméra regarder vers le point d'interaction
                    camera.lookAt(interactionPos);

                    // Mettre à jour la matrice de projection de la caméra
                    camera.updateProjectionMatrix();

                    // Si nous sommes en mode Theatre.js, mettre à jour l'état dans Theatre.js
                    if (window.__theatreStudio && useStore.getState().visualization?.cameraMode === 'theatre') {
                        console.log("Updating Theatre.js camera position");

                        try {
                            // Accéder à la feuille actuelle
                            const project = getProject('WebGL_Gobelins');
                            if (project) {
                                const sheet = project.sheet('Scene');

                                if (sheet) {
                                    // Mise à jour de l'objet caméra dans Theatre.js
                                    const obj = sheet.object('Camera');

                                    if (obj) {
                                        obj.set({
                                            position: {
                                                x: cameraPos.x,
                                                y: cameraPos.y,
                                                z: cameraPos.z
                                            }
                                        });

                                        console.log("Theatre.js camera position updated successfully");
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn("Failed to update Theatre.js camera:", error);
                        }
                    }

                    // Mettre à jour la configuration de débogage
                    if (typeof useStore.getState().updateDebugConfig === 'function') {
                        useStore.getState().updateDebugConfig('camera.position.x.value', cameraPos.x);
                        useStore.getState().updateDebugConfig('camera.position.y.value', cameraPos.y);
                        useStore.getState().updateDebugConfig('camera.position.z.value', cameraPos.z);
                    }

                    // Émettre un événement pour informer d'autres composants
                    EventBus.trigger('camera-teleported', { position: cameraPos, target: interactionPos });

                    return true;
                } catch (error) {
                    console.error("Error teleporting camera:", error);
                    return false;
                }
            };

            // Créer un objet pour stocker les fonctions de téléportation
            const teleportFunctions = {};

            // Ajouter des boutons pour se téléporter à chaque point d'interaction
            interactivePlacements.forEach((placement, index) => {
                // Générer un nom unique pour ce point d'interaction
                const pointName = placement.markerText ||
                    placement.requiredStep ||
                    placement.markerId ||
                    `${placement.objectKey}_${index}`;

                // Créer une propriété unique pour cette fonction de téléportation
                const functionName = `teleportTo_${index}`;

                // Ajouter la fonction de téléportation à l'objet
                teleportFunctions[functionName] = () => {
                    teleportCamera(placement);
                };

                // Ajouter un bouton pour cette fonction
                interactionPointsFolder.add(teleportFunctions, functionName).name(`TP: ${pointName}`);
            });

            // Ajouter une fonction pour désactiver le mouvement automatique de la caméra
            teleportFunctions.disableAutoMove = () => {
                const state = useStore.getState();

                // Si l'interaction a une méthode pour désactiver le défilement automatique
                if (state.interaction && typeof state.interaction.setAllowScroll === 'function') {
                    state.interaction.setAllowScroll(false);
                    console.log("Auto-scrolling disabled");
                }
            };

            // Ajouter une fonction pour activer le mouvement automatique de la caméra
            teleportFunctions.enableAutoMove = () => {
                const state = useStore.getState();

                // Si l'interaction a une méthode pour activer le défilement automatique
                if (state.interaction && typeof state.interaction.setAllowScroll === 'function') {
                    state.interaction.setAllowScroll(true);
                    console.log("Auto-scrolling enabled");
                }
            };

            // Ajouter ces boutons
            interactionPointsFolder.add(teleportFunctions, 'disableAutoMove').name("Désactiver AutoMove");
            interactionPointsFolder.add(teleportFunctions, 'enableAutoMove').name("Activer AutoMove");

            // Fermer le dossier si configuré ainsi
            if (guiConfig.gui.closeFolders) {
                interactionPointsFolder.close();
            }

            // Appliquer les paramètres de visualisation initiaux
            setTimeout(() => {
                applyWireframeToScene(visualizationSettings.wireframe);
                updateObjectsVisibility(visualizationSettings);
                toggleCameraMode(visualizationSettings.cameraMode);
            }, 500);

            // Ajout du contrôle Theatre.js
            const theatreFolder = gui.addFolder(guiConfig.theatre.folder);

            // Obtention de la valeur sauvegardée ou utilisation de la valeur par défaut
            const savedShowTheatre = useStore.getState().getDebugConfigValue(
                'theatre.showUI.value',
                guiConfig.theatre.showUI.default
            );

            // Contrôle d'affichage de l'UI Theatre.js
            const theatreSettings = {
                showUI: savedShowTheatre
            };

            // Appliquer immédiatement l'état initial de l'UI Theatre.js
            toggleTheatreUI(savedShowTheatre);

            theatreFolder.add(theatreSettings, 'showUI')
                .name(guiConfig.theatre.showUI.name)
                .onChange(toggleTheatreUI);

            if (guiConfig.gui.closeFolders) {
                theatreFolder.close();
            }

            // Ajouter un dossier pour les interfaces
            const interfacesFolder = gui.addFolder('Interfaces');

            // Contrôles pour les interfaces
            const interfaceControls = {
                showCameraInterface: () => {
                    const store = useStore.getState();

                    // Afficher l'interface caméra
                    if (typeof store.setShowCaptureInterface === 'function') {
                        store.setShowCaptureInterface(true);
                    } else if (store.interaction && typeof store.interaction.setShowCaptureInterface === 'function') {
                        store.interaction.setShowCaptureInterface(true);
                    } else {
                        console.warn("Méthode setShowCaptureInterface non trouvée, utilisation d'une alternative");
                        useStore.setState(state => ({
                            interaction: {
                                ...state.interaction,
                                showCaptureInterface: true
                            }
                        }));
                    }
                },
                showScannerInterface: () => {
                    const store = useStore.getState();

                    // Afficher l'interface scanner
                    if (typeof store.setShowScannerInterface === 'function') {
                        store.setShowScannerInterface(true);
                    } else if (store.interaction && typeof store.interaction.setShowScannerInterface === 'function') {
                        store.interaction.setShowScannerInterface(true);
                    } else {
                        console.warn("Méthode setShowScannerInterface non trouvée, utilisation d'une alternative");
                        useStore.setState(state => ({
                            interaction: {
                                ...state.interaction,
                                showScannerInterface: true
                            }
                        }));
                    }
                },
                hideCameraInterface: () => {
                    const store = useStore.getState();

                    // Cacher l'interface caméra
                    if (typeof store.setShowCaptureInterface === 'function') {
                        store.setShowCaptureInterface(false);
                    } else if (store.interaction && typeof store.interaction.setShowCaptureInterface === 'function') {
                        store.interaction.setShowCaptureInterface(false);
                    } else {
                        useStore.setState(state => ({
                            interaction: {
                                ...state.interaction,
                                showCaptureInterface: false
                            }
                        }));
                    }
                },
                hideScannerInterface: () => {
                    const store = useStore.getState();

                    // Cacher l'interface scanner
                    if (typeof store.setShowScannerInterface === 'function') {
                        store.setShowScannerInterface(false);
                    } else if (store.interaction && typeof store.interaction.setShowScannerInterface === 'function') {
                        store.interaction.setShowScannerInterface(false);
                    } else {
                        useStore.setState(state => ({
                            interaction: {
                                ...state.interaction,
                                showScannerInterface: false
                            }
                        }));
                    }
                }
            };

            // Ajouter les boutons pour afficher/cacher les interfaces
            interfacesFolder.add(interfaceControls, 'showCameraInterface').name('Show Camera');
            interfacesFolder.add(interfaceControls, 'hideCameraInterface').name('Hide Camera');
            interfacesFolder.add(interfaceControls, 'showScannerInterface').name('Show Scanner');
            interfacesFolder.add(interfaceControls, 'hideScannerInterface').name('Hide Scanner');

            // Fermer le dossier interfaces si configuré
            if (guiConfig.gui.closeFolders) {
                interfacesFolder.close();
            }

// Ajouter un dossier pour l'audio
            const audioFolder = gui.addFolder('Audio');

// Contrôles pour le son ambiant
            const audioControls = {
                playAmbient: () => {
                    const store = useStore.getState();
                    if (store.audio && store.audio.playAmbient) {
                        store.audio.playAmbient();
                    }
                    if (audioManager && audioManager.playAmbient) {
                        audioManager.playAmbient();
                    }
                },
                pauseAmbient: () => {
                    const store = useStore.getState();
                    if (store.audio && store.audio.pauseAmbient) {
                        store.audio.pauseAmbient();
                    }
                    if (audioManager && audioManager.pauseAmbient) {
                        audioManager.pauseAmbient();
                    }
                },
                resumeAmbient: () => {
                    const store = useStore.getState();
                    if (store.audio && store.audio.resumeAmbient) {
                        store.audio.resumeAmbient();
                    }
                    if (audioManager && audioManager.resumeAmbient) {
                        audioManager.resumeAmbient();
                    }
                },
                volume: 1.0
            };

            // Créer un sous-dossier pour l'ambiance
            const ambientFolder = audioFolder.addFolder('Ambiance');

            // Ajouter les boutons
            ambientFolder.add(audioControls, 'playAmbient').name('Play Ambient');
            ambientFolder.add(audioControls, 'pauseAmbient').name('Pause Ambient');
            ambientFolder.add(audioControls, 'resumeAmbient').name('Resume Ambient');

            // Contrôle du volume
            const volumeControl = audioFolder.add(audioControls, 'volume', 0, 1, 0.01).name('Master Volume');
            volumeControl.onChange(value => {
                const store = useStore.getState();
                if (store.audio && store.audio.setVolume) {
                    store.audio.setVolume(value);
                }
                if (audioManager && audioManager.setMasterVolume) {
                    audioManager.setMasterVolume(value);
                }
            });

            // Ajouter les contrôles de narration au dossier audio
            addNarrationControlsToDebug(audioFolder)
                .catch(error => console.error('Error adding narration controls:', error));

            // Fermer le dossier audio si configuré
            if (guiConfig.gui.closeFolders) {
                audioFolder.close();
            }

            // Add export/import functionality
            const utilsFolder = gui.addFolder('Utils');

            // Close utils folder by default
            utilsFolder.close();

            // Export configuration
            const exportConfig = {
                export: () => {
                    // Get current config and scene state
                    const {debugConfig} = useStore.getState();

                    // Create a deep copy of guiConfig to modify
                    const outputConfig = JSON.parse(JSON.stringify(guiConfig));

                    // Add current values as defaults to outputConfig
                    applyCurrentValuesToDefaults(outputConfig, debugConfig);

                    // Generate JS code
                    const jsContent = generateConfigJS(outputConfig);

                    // Create a download link
                    const blob = new Blob([jsContent], {type: 'application/javascript'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'guiConfig.js';
                    a.click();
                    URL.revokeObjectURL(url);

                    console.log('Configuration exported as guiConfig.js');
                }
            };

            // Helper function to apply current values to default properties
            function applyCurrentValuesToDefaults(baseConfig, currentConfig) {
                if (!currentConfig) return;

                // Process Theatre.js settings
                if (currentConfig.theatre) {
                    // Theatre.js UI toggle
                    if (currentConfig.theatre.showUI && currentConfig.theatre.showUI.value !== undefined) {
                        baseConfig.theatre.showUI.default = currentConfig.theatre.showUI.value;
                    }
                }

                // Ajouter le traitement pour les nouvelles options de visualisation
                if (currentConfig.visualization) {
                    // Ajout des options de visualisation au fichier de configuration
                    if (!baseConfig.visualization) {
                        baseConfig.visualization = {
                            folder: 'Visualisation',
                            wireframe: {
                                name: 'Mode Wireframe',
                                default: false
                            },
                            showInstances: {
                                name: 'Afficher Instances',
                                default: true
                            },
                            showInteractive: {
                                name: 'Afficher Interactifs',
                                default: true
                            },
                            showStatic: {
                                name: 'Afficher Statiques',
                                default: true
                            },
                            cameraMode: {
                                name: 'Mode Caméra',
                                options: {
                                    "TheatreJS": 'theatre',
                                    "Libre": 'free'
                                },
                                default: 'theatre'
                            }
                        };
                    }

                    // Mettre à jour les valeurs par défaut avec les valeurs actuelles
                    if (currentConfig.visualization.wireframe && currentConfig.visualization.wireframe.value !== undefined) {
                        baseConfig.visualization.wireframe.default = currentConfig.visualization.wireframe.value;
                    }
                    if (currentConfig.visualization.showInstances && currentConfig.visualization.showInstances.value !== undefined) {
                        baseConfig.visualization.showInstances.default = currentConfig.visualization.showInstances.value;
                    }
                    if (currentConfig.visualization.showInteractive && currentConfig.visualization.showInteractive.value !== undefined) {
                        baseConfig.visualization.showInteractive.default = currentConfig.visualization.showInteractive.value;
                    }
                    if (currentConfig.visualization.showStatic && currentConfig.visualization.showStatic.value !== undefined) {
                        baseConfig.visualization.showStatic.default = currentConfig.visualization.showStatic.value;
                    }
                    if (currentConfig.visualization.cameraMode && currentConfig.visualization.cameraMode.value !== undefined) {
                        baseConfig.visualization.cameraMode.default = currentConfig.visualization.cameraMode.value;
                    }
                }

                // Process camera settings
                if (currentConfig.camera) {
                    // Position values
                    if (currentConfig.camera.position) {
                        for (const axis of ['x', 'y', 'z']) {
                            if (currentConfig.camera.position[axis]?.value !== undefined) {
                                baseConfig.camera.position[axis].default = currentConfig.camera.position[axis].value;
                            }
                        }
                    }

                    // Rotation values
                    if (currentConfig.camera.rotation) {
                        for (const axis of ['x', 'y', 'z']) {
                            if (currentConfig.camera.rotation[axis]?.value !== undefined) {
                                baseConfig.camera.rotation[axis].default = currentConfig.camera.rotation[axis].value;
                            }
                        }
                    }

                    // Camera settings
                    if (currentConfig.camera.settings) {
                        for (const prop of ['fov', 'near', 'far']) {
                            if (currentConfig.camera.settings[prop]?.value !== undefined) {
                                baseConfig.camera.settings[prop].default = currentConfig.camera.settings[prop].value;
                            }
                        }
                    }
                }

                // Autres configurations existantes...
            }

            // Helper to generate a well-formatted JS file
            function generateConfigJS(config) {
                // Basic file structure
                let jsContent = `/**
 * Configuration centralisée pour l'interface GUI de debugging
 * Ce fichier contient toutes les configurations pour les contrôles du GUI
 */

const guiConfig = ${JSON.stringify(config, null, 4)};

export default guiConfig;`;

                // Fix formatting for better readability and proper JS syntax
                jsContent = jsContent
                    // Fix quotes for all normal property names
                    .replace(/"([a-zA-Z0-9_]+)":/g, '$1:')
                    // Keep quotes for property names with special characters
                    .replace(/"([^"]+)":/g, function (match, p1) {
                        // If the property name contains spaces, keep it quoted
                        if (/[^a-zA-Z0-9_]/.test(p1)) {
                            return match;
                        }
                        return p1 + ':';
                    })
                    // Fix Math.PI
                    .replace(/"?3\.141592653589793"?/g, 'Math.PI')
                    .replace(/"?1\.5707963267948966"?/g, 'Math.PI / 2')
                    // Fix other numbers
                    .replace(/:\s*"(-?\d+(\.\d+)?)"/g, ': $1')
                    // Fix booleans
                    .replace(/:\s*"(true|false)"/g, ': $1');

                return jsContent;
            }

            // Import configuration
            const importConfig = {
                import: () => {
                    // Create a hidden file input
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json,.js';

                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const fileContent = event.target.result;
                                let newConfig;

                                // Check if it's a JS file with export default
                                if (file.name.endsWith('.js') && fileContent.includes('export default')) {
                                    // Use a safer method to extract the config object
                                    const jsContent = fileContent;
                                    // Find the start of the object declaration
                                    const objStart = jsContent.indexOf('const guiConfig = ') + 'const guiConfig = '.length;
                                    // Find the end (looking for the last semicolon before export)
                                    let objEnd = jsContent.lastIndexOf('export default');
                                    objEnd = jsContent.lastIndexOf(';', objEnd);
                                    if (objEnd === -1) {
                                        // If no semicolon, find the last closing brace
                                        objEnd = jsContent.lastIndexOf('}', jsContent.lastIndexOf('export default')) + 1;
                                    }

                                    const objText = jsContent.substring(objStart, objEnd);

                                    // Create a function that will safely evaluate the object
                                    const objFunction = new Function(`
                                        const Math = { PI: ${Math.PI} };
                                        return ${objText};
                                    `);

                                    newConfig = objFunction();
                                } else {
                                    // Parse as regular JSON
                                    newConfig = JSON.parse(fileContent);
                                }

                                // Store the config
                                setDebugConfig(newConfig);
                                console.log('Configuration imported');

                                // To apply changes, need to destroy and recreate GUI
                                gui.destroy();
                                setGui(null);
                                initializedRef.current = false;

                                // Wait a bit then create new GUI with imported config
                                setTimeout(() => {
                                    const newGui = new GUI({
                                        width: guiConfig.gui.width || 300
                                    });
                                    newGui.title(guiConfig.gui.title || 'Debug Controls');

                                    // Close folders if configured to do so
                                    if (guiConfig.gui.closeFolders) {
                                        newGui.close();
                                    }

                                    setGui(newGui);
                                }, 100);

                            } catch (err) {
                                console.error('Failed to parse config file:', err);
                                alert('Erreur lors de l\'import: ' + err.message);
                            }
                        };
                        reader.readAsText(file);
                    };

                    input.click();
                }
            };

            // Add buttons to utils folder
            utilsFolder.add(exportConfig, 'export').name('Export Config');
            utilsFolder.add(importConfig, 'import').name('Import Config');

            // Initialize debug config in store if not already set
            if (!useStore.getState().debugConfig) {
                // Create a deep copy of the initial config
                const initialConfig = JSON.parse(JSON.stringify(guiConfig));
                setDebugConfig(initialConfig);
            }

            setGui(gui);
            console.log('Debug GUI initialized');
        }

        // Cleanup function - destroy GUI on unmount
        return () => {
            const {gui} = useStore.getState();
            if (gui) {
                gui.destroy();
                setGui(null);
                initializedRef.current = false;
            }
        };
    }, [debug?.active, debug?.showGui, setDebug, setGui, setDebugConfig, scene, camera, controls]);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;