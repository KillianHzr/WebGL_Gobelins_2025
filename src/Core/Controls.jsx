import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';

export default function Controls() {
    const { gl } = useThree();
    const { debug, gui } = useStore();
    const folderRef = useRef(null);

    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists
        if (debug?.active && debug?.showGui && gui) {
            // Try to find orbit controls instance
            const controls = gl.domElement.__r3f?.controls;

            if (controls && controls.length > 0) {
                const orbitControls = controls[0];
                console.log("Setting up controls debug UI", orbitControls);

                // Create controls folder
                const controlsFolder = gui.addFolder('Controls');
                folderRef.current = controlsFolder;

                // Basic Controls settings
                controlsFolder.add(orbitControls, 'enableDamping').name('Damping');
                controlsFolder.add(orbitControls, 'dampingFactor', 0, 1, 0.01).name('Damping Factor');
                controlsFolder.add(orbitControls, 'enableZoom').name('Allow Zoom');
                controlsFolder.add(orbitControls, 'zoomSpeed', 0.1, 5, 0.1).name('Zoom Speed');
                controlsFolder.add(orbitControls, 'enableRotate').name('Allow Rotate');
                controlsFolder.add(orbitControls, 'rotateSpeed', 0.1, 5, 0.1).name('Rotate Speed');
                controlsFolder.add(orbitControls, 'enablePan').name('Allow Pan');
                controlsFolder.add(orbitControls, 'panSpeed', 0.1, 5, 0.1).name('Pan Speed');

                // Auto-rotation
                const rotationFolder = controlsFolder.addFolder('Auto Rotation');
                rotationFolder.add(orbitControls, 'autoRotate').name('Enable');
                rotationFolder.add(orbitControls, 'autoRotateSpeed', -10, 10, 0.1).name('Speed');

                // Limits
                const limitsFolder = controlsFolder.addFolder('Limits');

                // Min/Max Polar Angle (vertical rotation limits)
                limitsFolder.add(orbitControls, 'minPolarAngle', 0, Math.PI, 0.01).name('Min Vertical');
                limitsFolder.add(orbitControls, 'maxPolarAngle', 0, Math.PI, 0.01).name('Max Vertical');

                // Min/Max Azimuth Angle (horizontal rotation limits)
                limitsFolder.add(orbitControls, 'minAzimuthAngle', -Math.PI, Math.PI, 0.01).name('Min Horizontal');
                limitsFolder.add(orbitControls, 'maxAzimuthAngle', -Math.PI, Math.PI, 0.01).name('Max Horizontal');

                // Min/Max Distance (zoom limits)
                limitsFolder.add(orbitControls, 'minDistance', 0, 20, 0.1).name('Min Distance');
                limitsFolder.add(orbitControls, 'maxDistance', 0, 1000, 1).name('Max Distance');
            }
        }

        // Cleanup function
        return () => {
            if (folderRef.current && gui) {
                gui.removeFolder(folderRef.current);
                folderRef.current = null;
            }
        };
    }, [debug, gui, gl]);

    return null;
}