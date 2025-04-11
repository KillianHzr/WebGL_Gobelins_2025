import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';

export default function Controls() {
    const { gl } = useThree();
    const { debug, gui, updateDebugConfig, getDebugConfigValue } = useStore();
    const folderRef = useRef(null);

    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists
        if (debug?.active && debug?.showGui && gui) {
            // Try to find orbit controls instance
            const controls = gl.domElement.__r3f?.controls;

            if (controls && controls.length > 0) {
                const orbitControls = controls[0];
                console.log("Setting up controls debug UI", orbitControls);

                // Apply saved values if they exist
                const config = guiConfig.controls;
                const basicConfig = config.basic;
                const limitsConfig = config.limits;

                // Create controls folder
                const controlsFolder = gui.addFolder(config.folder);
                folderRef.current = controlsFolder;

                // Basic Controls settings
                // Apply saved values for basic controls
                Object.keys(basicConfig).forEach(key => {
                    if (orbitControls[key] !== undefined) {
                        const savedValue = getDebugConfigValue(`controls.basic.${key}.value`, orbitControls[key]);
                        orbitControls[key] = savedValue;

                        // Create control
                        const control = basicConfig[key].min !== undefined ?
                            controlsFolder.add(
                                orbitControls,
                                key,
                                basicConfig[key].min,
                                basicConfig[key].max,
                                basicConfig[key].step
                            ).name(basicConfig[key].name) :
                            controlsFolder.add(orbitControls, key).name(basicConfig[key].name);

                        // Update config on change
                        control.onChange(value => {
                            updateDebugConfig(`controls.basic.${key}.value`, value);
                        });
                    }
                });

                // Auto-rotation
                const rotationFolder = controlsFolder.addFolder(config.autoRotation.folder);

                // Apply saved auto-rotation settings
                const savedAutoRotate = getDebugConfigValue('controls.autoRotation.autoRotate.value', orbitControls.autoRotate);
                const savedAutoRotateSpeed = getDebugConfigValue('controls.autoRotation.autoRotateSpeed.value', orbitControls.autoRotateSpeed);

                orbitControls.autoRotate = savedAutoRotate;
                orbitControls.autoRotateSpeed = savedAutoRotateSpeed;

                // Create auto-rotation controls
                const autoRotateControl = rotationFolder.add(
                    orbitControls,
                    'autoRotate'
                ).name(config.autoRotation.autoRotate.name);

                autoRotateControl.onChange(value => {
                    updateDebugConfig('controls.autoRotation.autoRotate.value', value);
                });

                const autoRotateSpeedControl = rotationFolder.add(
                    orbitControls,
                    'autoRotateSpeed',
                    config.autoRotation.autoRotateSpeed.min,
                    config.autoRotation.autoRotateSpeed.max,
                    config.autoRotation.autoRotateSpeed.step
                ).name(config.autoRotation.autoRotateSpeed.name);

                autoRotateSpeedControl.onChange(value => {
                    updateDebugConfig('controls.autoRotation.autoRotateSpeed.value', value);
                });

                // Limits
                const limitsFolder = controlsFolder.addFolder(config.limits.folder);

                // Apply saved limits
                Object.keys(limitsConfig).forEach(key => {
                    if (orbitControls[key] !== undefined) {
                        const savedValue = getDebugConfigValue(`controls.limits.${key}.value`, orbitControls[key]);
                        orbitControls[key] = savedValue;

                        // Create control
                        const control = limitsFolder.add(
                            orbitControls,
                            key,
                            limitsConfig[key].min,
                            limitsConfig[key].max,
                            limitsConfig[key].step
                        ).name(limitsConfig[key].name);

                        // Update config on change
                        control.onChange(value => {
                            updateDebugConfig(`controls.limits.${key}.value`, value);
                        });
                    }
                });
            }
        }

        // Cleanup function
        return () => {
            if (folderRef.current && gui) {
                gui.removeFolder(folderRef.current);
                folderRef.current = null;
            }
        };
    }, [debug, gui, gl, updateDebugConfig, getDebugConfigValue]);

    return null;
}