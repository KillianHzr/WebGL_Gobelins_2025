import { useEffect, useRef } from 'react';
import useStore from '../Store/useStore';
import GUI from 'lil-gui';

/**
 * Component that initializes debug features based on URL hash
 * This component doesn't render anything but handles the side effects
 * related to debug mode initialization
 */
const DebugInitializer = () => {
    const { debug, setDebug, setGui, setDebugConfig, orbitControlsEnabled, setOrbitControlsEnabled } = useStore();
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
        if (debug?.active && !initializedRef.current) {
            initializedRef.current = true;

            // Create GUI only if it doesn't exist yet
            const gui = new GUI({
                width: 300
            });
            gui.title('Prototype Controls');

            // Get saved values
            const savedOrbitControlsEnabled = useStore.getState().orbitControlsEnabled || false;

            // Montrer/cacher Theatre.js UI
            const theatreSettings = {
                showUI: debug.showTheatre
            };

            // Appliquer immédiatement l'état initial de l'UI Theatre.js
            toggleTheatreUI(debug.showTheatre);

            gui.add(theatreSettings, 'showUI')
                .name('Show Theatre.js UI')
                .onChange(toggleTheatreUI);

            // Ajouter le contrôle pour OrbitControls
            const cameraSettings = {
                orbitControls: savedOrbitControlsEnabled
            };

            gui.add(cameraSettings, 'orbitControls')
                .name('Enable Orbit Controls')
                .onChange(value => {
                    setOrbitControlsEnabled(value);
                });

            // Initialize debug config in store if not already set
            if (!useStore.getState().debugConfig) {
                const initialConfig = {
                    theatre: {
                        showUI: {
                            value: debug.showTheatre
                        }
                    },
                    camera: {
                        orbitControls: {
                            value: savedOrbitControlsEnabled
                        }
                    }
                };
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
    }, [debug?.active, setDebug, setGui, setDebugConfig, setOrbitControlsEnabled]);

    // This component doesn't render anything
    return null;
};

export default DebugInitializer;