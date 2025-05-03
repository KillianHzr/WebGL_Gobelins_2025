import React, { useEffect } from 'react';
import useStore from '../Store/useStore';
import { EventBus } from './EventEmitter';

/**
 * Component to fix camera switching issues by ensuring proper state synchronization
 * between GUI controls and the CameraSwitcher component
 */
const CameraModeSync = () => {
    const { debug, updateDebugConfig, getDebugConfigValue } = useStore();

    // Get camera mode from store
    const cameraMode = useStore(state =>
        state.visualization?.cameraMode ||
        (getDebugConfigValue ? getDebugConfigValue('visualization.cameraMode.value', 'theatre') : 'theatre')
    );

    // Listen for GUI change events
    useEffect(() => {
        const handleCameraModeChange = (event) => {
            console.log("Camera mode change detected via event:", event.mode);

            // Force update to the store
            const store = useStore.getState();

            // Ensure visualization exists
            if (!store.visualization) {
                store.visualization = { cameraMode: event.mode };
            } else {
                store.visualization.cameraMode = event.mode;
            }

            // Update debug config
            if (typeof updateDebugConfig === 'function') {
                updateDebugConfig('visualization.cameraMode.value', event.mode);
            }

            // Force a re-render by updating state
            if (store.setVisualization && typeof store.setVisualization === 'function') {
                store.setVisualization({
                    ...store.visualization,
                    cameraMode: event.mode
                });
            }
        };

        // Subscribe to camera mode change events
        const unsubscribe = EventBus.on('camera-mode-changed', handleCameraModeChange);

        return () => {
            unsubscribe();
        };
    }, [updateDebugConfig]);

    // Debug output to check the current camera mode
    useEffect(() => {
        console.log("Current camera mode in CameraModeSync:", cameraMode);
    }, [cameraMode]);

    return null; // This is a utility component with no UI
};

export default CameraModeSync;