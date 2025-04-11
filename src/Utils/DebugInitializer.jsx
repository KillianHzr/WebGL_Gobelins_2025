import { useEffect } from 'react';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';
import guiConfig from '../Config/guiConfig';

/**
 * Component that initializes debug features based on URL hash
 * This component doesn't render anything but handles the side effects
 * related to debug mode initialization
 */
const DebugInitializer = () => {
    const { debug, setGui, setDebugConfig } = useStore();

    useEffect(() => {
        // Initialize GUI if debug mode is active
        if (debug?.active && debug?.showGui) {
            // Create GUI only if it doesn't exist yet
            const gui = new GUI({
                width: guiConfig.gui.width || 300
            });
            gui.title(guiConfig.gui.title || 'Debug Controls');

            // Ferme tous les dossiers par défaut si configuré ainsi
            if (guiConfig.gui.closeFolders) {
                gui.close();
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

                // Process controls settings
                if (currentConfig.controls) {
                    // Basic controls
                    if (currentConfig.controls.basic) {
                        for (const prop in currentConfig.controls.basic) {
                            if (currentConfig.controls.basic[prop]?.value !== undefined) {
                                baseConfig.controls.basic[prop].default = currentConfig.controls.basic[prop].value;
                            }
                        }
                    }

                    // Auto rotation settings
                    if (currentConfig.controls.autoRotation) {
                        for (const prop in currentConfig.controls.autoRotation) {
                            if (currentConfig.controls.autoRotation[prop]?.value !== undefined) {
                                baseConfig.controls.autoRotation[prop].default = currentConfig.controls.autoRotation[prop].value;
                            }
                        }
                    }

                    // Limits settings
                    if (currentConfig.controls.limits) {
                        for (const prop in currentConfig.controls.limits) {
                            if (currentConfig.controls.limits[prop]?.value !== undefined) {
                                baseConfig.controls.limits[prop].default = currentConfig.controls.limits[prop].value;
                            }
                        }
                    }
                }

                // Process scene settings
                if (currentConfig.scene) {
                    // Background
                    if (currentConfig.scene.background?.value !== undefined) {
                        baseConfig.scene.background.color = currentConfig.scene.background.value;
                    }

                    // Fog settings
                    if (currentConfig.scene.fog) {
                        if (currentConfig.scene.fog.enabled?.value !== undefined) {
                            baseConfig.scene.fog.enabled.default = currentConfig.scene.fog.enabled.value;
                        }
                        if (currentConfig.scene.fog.color?.value !== undefined) {
                            baseConfig.scene.fog.color.color = currentConfig.scene.fog.color.value;
                        }
                        if (currentConfig.scene.fog.near?.value !== undefined) {
                            baseConfig.scene.fog.near.default = currentConfig.scene.fog.near.value;
                        }
                        if (currentConfig.scene.fog.far?.value !== undefined) {
                            baseConfig.scene.fog.far.default = currentConfig.scene.fog.far.value;
                        }
                    }
                }

                // Process renderer settings
                if (currentConfig.renderer) {
                    if (currentConfig.renderer.shadowMap?.value !== undefined) {
                        baseConfig.renderer.shadowMap.default = currentConfig.renderer.shadowMap.value;
                    }
                    if (currentConfig.renderer.toneMapping?.value !== undefined) {
                        baseConfig.renderer.toneMapping.default = currentConfig.renderer.toneMapping.value;
                    }
                    if (currentConfig.renderer.toneMappingExposure?.value !== undefined) {
                        baseConfig.renderer.toneMappingExposure.default = currentConfig.renderer.toneMappingExposure.value;
                    }
                }

                // Process lights settings
                if (currentConfig.lights) {
                    // Ensure defaults object exists
                    if (!baseConfig.lights.defaults) {
                        baseConfig.lights.defaults = {};
                    }

                    // For each light type in current config
                    for (const lightType in currentConfig.lights) {
                        // Skip non-object properties
                        if (typeof currentConfig.lights[lightType] !== 'object') continue;

                        // Skip internal properties that aren't light types
                        if (['folder', 'common', 'position', 'shadows', 'spotLight', 'pointLight', 'rectAreaLight'].includes(lightType)) {
                            continue;
                        }

                        // Save light settings to defaults
                        baseConfig.lights.defaults[lightType] = currentConfig.lights[lightType];
                    }
                }

                // Process objects settings
                if (currentConfig.objects && currentConfig.objects.cube) {
                    // Position
                    if (currentConfig.objects.cube.position) {
                        for (const axis of ['x', 'y', 'z']) {
                            if (currentConfig.objects.cube.position[axis]?.value !== undefined) {
                                baseConfig.objects.cube.position[axis].default = currentConfig.objects.cube.position[axis].value;
                            }
                        }
                    }

                    // Rotation
                    if (currentConfig.objects.cube.rotation) {
                        for (const axis of ['x', 'y', 'z']) {
                            if (currentConfig.objects.cube.rotation[axis]?.value !== undefined) {
                                baseConfig.objects.cube.rotation[axis].default = currentConfig.objects.cube.rotation[axis].value;
                            }
                        }
                    }

                    // Scale
                    if (currentConfig.objects.cube.scale) {
                        for (const axis of ['x', 'y', 'z']) {
                            if (currentConfig.objects.cube.scale[axis]?.value !== undefined) {
                                baseConfig.objects.cube.scale[axis].default = currentConfig.objects.cube.scale[axis].value;
                            }
                        }
                    }

                    // Material
                    if (currentConfig.objects.cube.material) {
                        if (currentConfig.objects.cube.material.color?.value !== undefined) {
                            baseConfig.objects.cube.material.color.color = currentConfig.objects.cube.material.color.value;
                        }
                        if (currentConfig.objects.cube.material.wireframe?.value !== undefined) {
                            baseConfig.objects.cube.material.wireframe.default = currentConfig.objects.cube.material.wireframe.value;
                        }
                        if (currentConfig.objects.cube.material.roughness?.value !== undefined) {
                            baseConfig.objects.cube.material.roughness.default = currentConfig.objects.cube.material.roughness.value;
                        }
                        if (currentConfig.objects.cube.material.metalness?.value !== undefined) {
                            baseConfig.objects.cube.material.metalness.default = currentConfig.objects.cube.material.metalness.value;
                        }
                    }

                    // Animation
                    if (currentConfig.objects.cube.animation) {
                        if (currentConfig.objects.cube.animation.enabled?.value !== undefined) {
                            baseConfig.objects.cube.animation.enabled.default = currentConfig.objects.cube.animation.enabled.value;
                        }
                        if (currentConfig.objects.cube.animation.speed?.value !== undefined) {
                            baseConfig.objects.cube.animation.speed.default = currentConfig.objects.cube.animation.speed.value;
                        }
                    }
                }
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
            }
        };
    }, [debug?.active, debug?.showGui, setGui, setDebugConfig]);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;