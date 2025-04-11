import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import { getDefaultValue } from '../Utils/defaultValues.js';

export default function Camera() {
    const { camera, gl } = useThree();
    const folderRef = useRef(null);
    const { debug, gui, updateDebugConfig, getDebugConfigValue } = useStore();

    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists
        if (debug?.active && debug?.showGui && gui && camera) {
            console.log("Setting up camera debug controls", camera);

            // Add camera controls to existing GUI
            const cameraFolder = gui.addFolder(guiConfig.camera.folder);
            folderRef.current = cameraFolder;

            // Camera position controls - using config for ranges
            const savedPositionX = getDebugConfigValue('camera.position.x.value',
                getDefaultValue('camera.position.x', camera.position.x));
            const savedPositionY = getDebugConfigValue('camera.position.y.value',
                getDefaultValue('camera.position.y', camera.position.y));
            const savedPositionZ = getDebugConfigValue('camera.position.z.value',
                getDefaultValue('camera.position.z', camera.position.z));

            // Apply saved positions
            camera.position.set(savedPositionX, savedPositionY, savedPositionZ);

            // Position X control
            const posX = cameraFolder.add(
                camera.position,
                'x',
                guiConfig.camera.position.x.min,
                guiConfig.camera.position.x.max,
                guiConfig.camera.position.x.step
            ).name(guiConfig.camera.position.x.name);

            posX.onChange(value => {
                updateDebugConfig('camera.position.x.value', value);
            });

            // Position Y control
            const posY = cameraFolder.add(
                camera.position,
                'y',
                guiConfig.camera.position.y.min,
                guiConfig.camera.position.y.max,
                guiConfig.camera.position.y.step
            ).name(guiConfig.camera.position.y.name);

            posY.onChange(value => {
                updateDebugConfig('camera.position.y.value', value);
            });

            // Position Z control
            const posZ = cameraFolder.add(
                camera.position,
                'z',
                guiConfig.camera.position.z.min,
                guiConfig.camera.position.z.max,
                guiConfig.camera.position.z.step
            ).name(guiConfig.camera.position.z.name);

            posZ.onChange(value => {
                updateDebugConfig('camera.position.z.value', value);
            });

            // Camera rotation controls
            const savedRotationX = getDebugConfigValue('camera.rotation.x.value',
                getDefaultValue('camera.rotation.x', camera.rotation.x));
            const savedRotationY = getDebugConfigValue('camera.rotation.y.value',
                getDefaultValue('camera.rotation.y', camera.rotation.y));
            const savedRotationZ = getDebugConfigValue('camera.rotation.z.value',
                getDefaultValue('camera.rotation.z', camera.rotation.z));

            // Apply saved rotations
            camera.rotation.set(savedRotationX, savedRotationY, savedRotationZ);

            // Rotation X control
            const rotX = cameraFolder.add(
                camera.rotation,
                'x',
                guiConfig.camera.rotation.x.min,
                guiConfig.camera.rotation.x.max,
                guiConfig.camera.rotation.x.step
            ).name(guiConfig.camera.rotation.x.name);

            rotX.onChange(value => {
                updateDebugConfig('camera.rotation.x.value', value);
            });

            // Rotation Y control
            const rotY = cameraFolder.add(
                camera.rotation,
                'y',
                guiConfig.camera.rotation.y.min,
                guiConfig.camera.rotation.y.max,
                guiConfig.camera.rotation.y.step
            ).name(guiConfig.camera.rotation.y.name);

            rotY.onChange(value => {
                updateDebugConfig('camera.rotation.y.value', value);
            });

            // Rotation Z control
            const rotZ = cameraFolder.add(
                camera.rotation,
                'z',
                guiConfig.camera.rotation.z.min,
                guiConfig.camera.rotation.z.max,
                guiConfig.camera.rotation.z.step
            ).name(guiConfig.camera.rotation.z.name);

            rotZ.onChange(value => {
                updateDebugConfig('camera.rotation.z.value', value);
            });

            // Camera settings
            const cameraSettings = {
                fov: getDebugConfigValue('camera.settings.fov.value',
                    getDefaultValue('camera.settings.fov', camera.fov)),
                near: getDebugConfigValue('camera.settings.near.value',
                    getDefaultValue('camera.settings.near', camera.near)),
                far: getDebugConfigValue('camera.settings.far.value',
                    getDefaultValue('camera.settings.far', camera.far))
            };

            // Apply saved values
            camera.fov = cameraSettings.fov;
            camera.near = cameraSettings.near;
            camera.far = cameraSettings.far;
            camera.updateProjectionMatrix();

            // FOV control
            const fovControl = cameraFolder.add(
                cameraSettings,
                'fov',
                guiConfig.camera.settings.fov.min,
                guiConfig.camera.settings.fov.max,
                guiConfig.camera.settings.fov.step
            ).name(guiConfig.camera.settings.fov.name);

            fovControl.onChange(value => {
                camera.fov = value;
                camera.updateProjectionMatrix();
                updateDebugConfig('camera.settings.fov.value', value);
            });

            // Near plane control
            const nearControl = cameraFolder.add(
                cameraSettings,
                'near',
                guiConfig.camera.settings.near.min,
                guiConfig.camera.settings.near.max,
                guiConfig.camera.settings.near.step
            ).name(guiConfig.camera.settings.near.name);

            nearControl.onChange(value => {
                camera.near = value;
                camera.updateProjectionMatrix();
                updateDebugConfig('camera.settings.near.value', value);
            });

            // Far plane control
            const farControl = cameraFolder.add(
                cameraSettings,
                'far',
                guiConfig.camera.settings.far.min,
                guiConfig.camera.settings.far.max,
                guiConfig.camera.settings.far.step
            ).name(guiConfig.camera.settings.far.name);

            farControl.onChange(value => {
                camera.far = value;
                camera.updateProjectionMatrix();
                updateDebugConfig('camera.settings.far.value', value);
            });

            // Close folder if configured
            if (guiConfig.gui.closeFolders) {
                cameraFolder.close();
            }

            // Check if we can find OrbitControls
            const controls = gl.domElement.__r3f?.controls;
            if (controls && controls.length > 0) {
                const orbitControls = controls[0];

                // Apply saved values with defaults from configuration
                const savedDamping = getDebugConfigValue('controls.basic.enableDamping.value',
                    getDefaultValue('controls.basic.enableDamping', orbitControls.enableDamping));
                const savedDampingFactor = getDebugConfigValue('controls.basic.dampingFactor.value',
                    getDefaultValue('controls.basic.dampingFactor', orbitControls.dampingFactor));
                const savedEnableZoom = getDebugConfigValue('controls.basic.enableZoom.value',
                    getDefaultValue('controls.basic.enableZoom', orbitControls.enableZoom));
                const savedAutoRotate = getDebugConfigValue('controls.autoRotation.autoRotate.value',
                    getDefaultValue('controls.autoRotation.autoRotate', orbitControls.autoRotate));
                const savedAutoRotateSpeed = getDebugConfigValue('controls.autoRotation.autoRotateSpeed.value',
                    getDefaultValue('controls.autoRotation.autoRotateSpeed', orbitControls.autoRotateSpeed));

                // Apply saved or default values to OrbitControls
                orbitControls.enableDamping = savedDamping;
                orbitControls.dampingFactor = savedDampingFactor;
                orbitControls.enableZoom = savedEnableZoom;
                orbitControls.autoRotate = savedAutoRotate;
                orbitControls.autoRotateSpeed = savedAutoRotateSpeed;

                // OrbitControls settings folder
                const orbitFolder = cameraFolder.addFolder('Orbit Controls');

                // Damping control
                const dampingControl = orbitFolder.add(
                    orbitControls,
                    'enableDamping'
                ).name(guiConfig.controls.basic.enableDamping.name);

                dampingControl.onChange(value => {
                    updateDebugConfig('controls.basic.enableDamping.value', value);
                });

                // Damping factor control
                const dampingFactorControl = orbitFolder.add(
                    orbitControls,
                    'dampingFactor',
                    guiConfig.controls.basic.dampingFactor.min,
                    guiConfig.controls.basic.dampingFactor.max,
                    guiConfig.controls.basic.dampingFactor.step
                ).name(guiConfig.controls.basic.dampingFactor.name);

                dampingFactorControl.onChange(value => {
                    updateDebugConfig('controls.basic.dampingFactor.value', value);
                });

                // Zoom control
                const zoomControl = orbitFolder.add(
                    orbitControls,
                    'enableZoom'
                ).name(guiConfig.controls.basic.enableZoom.name);

                zoomControl.onChange(value => {
                    updateDebugConfig('controls.basic.enableZoom.value', value);
                });

                // Auto-rotate control
                const autoRotateControl = orbitFolder.add(
                    orbitControls,
                    'autoRotate'
                ).name(guiConfig.controls.autoRotation.autoRotate.name);

                autoRotateControl.onChange(value => {
                    updateDebugConfig('controls.autoRotation.autoRotate.value', value);
                });

                // Auto-rotate speed control
                const autoRotateSpeedControl = orbitFolder.add(
                    orbitControls,
                    'autoRotateSpeed',
                    guiConfig.controls.autoRotation.autoRotateSpeed.min,
                    guiConfig.controls.autoRotation.autoRotateSpeed.max,
                    guiConfig.controls.autoRotation.autoRotateSpeed.step
                ).name(guiConfig.controls.autoRotation.autoRotateSpeed.name);

                autoRotateSpeedControl.onChange(value => {
                    updateDebugConfig('controls.autoRotation.autoRotateSpeed.value', value);
                });

                // Close orbit folder if configured
                if (guiConfig.gui.closeFolders) {
                    orbitFolder.close();
                }
            }
        }

        // Cleanup function
        return () => {
            if (folderRef.current && gui) {
                gui.removeFolder(folderRef.current);
                folderRef.current = null;
            }
        };
    }, [camera, debug, gui, gl, updateDebugConfig, getDebugConfigValue]);

    // This component doesn't render any visible elements
    return null;
}