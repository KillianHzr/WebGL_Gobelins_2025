import { useEffect, useRef } from 'react';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';
import guiConfig from '../Config/guiConfig';
import { audioManager } from './AudioManager';

/**
 * Component that initializes debug features based on URL hash
 * This component doesn't render anything but handles the side effects
 * related to debug mode initialization
 */
const DebugInitializer = () => {
    const { debug, setDebug, setGui, setDebugConfig } = useStore();
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
                    const updatedConfig = { ...useStore.getState().debugConfig };
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

            // Ajouter un dossier pour l'audio
            const audioFolder = gui.addFolder('Audio');

            // Contrôles pour le son ambiant
            const audioControls = {
                playAmbient: () => {
                    const store = useStore.getState();
                    store.audio.playAmbient();
                    audioManager.playAmbient();
                },
                pauseAmbient: () => {
                    const store = useStore.getState();
                    store.audio.pauseAmbient();
                    audioManager.pauseAmbient();
                },
                resumeAmbient: () => {
                    const store = useStore.getState();
                    store.audio.resumeAmbient();
                    audioManager.resumeAmbient();
                },
                volume: 1.0
            };

            // Ajouter les boutons
            audioFolder.add(audioControls, 'playAmbient').name('Play Ambient');
            audioFolder.add(audioControls, 'pauseAmbient').name('Pause Ambient');
            audioFolder.add(audioControls, 'resumeAmbient').name('Resume Ambient');

            // Contrôle du volume
            const volumeControl = audioFolder.add(audioControls, 'volume', 0, 1, 0.01).name('Master Volume');
            volumeControl.onChange(value => {
                const store = useStore.getState();
                store.audio.setVolume(value);
                audioManager.setMasterVolume(value);
            });

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
                    const { debugConfig } = useStore.getState();

                    // Create a deep copy of guiConfig to modify
                    const outputConfig = JSON.parse(JSON.stringify(guiConfig));

                    // Add current values as defaults to outputConfig
                    applyCurrentValuesToDefaults(outputConfig, debugConfig);

                    // Generate JS code
                    const jsContent = generateConfigJS(outputConfig);

                    // Create a download link
                    const blob = new Blob([jsContent], { type: 'application/javascript' });
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
                    .replace(/"([^"]+)":/g, function(match, p1) {
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
            const { gui } = useStore.getState();
            if (gui) {
                gui.destroy();
                setGui(null);
                initializedRef.current = false;
            }
        };
    }, [debug?.active, debug?.showGui, setDebug, setGui, setDebugConfig]);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;