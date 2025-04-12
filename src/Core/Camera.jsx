import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import { getDefaultValue } from '../Utils/defaultValues';

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

            // Camera position control
            const savedPosition = {
                x: getDebugConfigValue('camera.position.x.value',
                    getDefaultValue('camera.position.x', camera.position.x)),
                y: getDebugConfigValue('camera.position.y.value',
                    getDefaultValue('camera.position.y', camera.position.y)),
                z: getDebugConfigValue('camera.position.z.value',
                    getDefaultValue('camera.position.z', camera.position.z))
            };

            // Apply saved position
            camera.position.set(savedPosition.x, savedPosition.y, savedPosition.z);

            // Position X control
            const positionFolder = cameraFolder.addFolder('Position');
            const posXControl = positionFolder.add(
                camera.position,
                'x',
                guiConfig.camera.position.x.min,
                guiConfig.camera.position.x.max,
                guiConfig.camera.position.x.step
            ).name(guiConfig.camera.position.x.name);
            posXControl.onChange(value => {
                updateDebugConfig('camera.position.x.value', value);
            });

            // Position Y control
            const posYControl = positionFolder.add(
                camera.position,
                'y',
                guiConfig.camera.position.y.min,
                guiConfig.camera.position.y.max,
                guiConfig.camera.position.y.step
            ).name(guiConfig.camera.position.y.name);
            posYControl.onChange(value => {
                updateDebugConfig('camera.position.y.value', value);
            });

            // Position Z control
            const posZControl = positionFolder.add(
                camera.position,
                'z',
                guiConfig.camera.position.z.min,
                guiConfig.camera.position.z.max,
                guiConfig.camera.position.z.step
            ).name(guiConfig.camera.position.z.name);
            posZControl.onChange(value => {
                updateDebugConfig('camera.position.z.value', value);
            });

            // Camera rotation control
            const savedRotation = {
                x: getDebugConfigValue('camera.rotation.x.value',
                    getDefaultValue('camera.rotation.x', camera.rotation.x)),
                y: getDebugConfigValue('camera.rotation.y.value',
                    getDefaultValue('camera.rotation.y', camera.rotation.y)),
                z: getDebugConfigValue('camera.rotation.z.value',
                    getDefaultValue('camera.rotation.z', camera.rotation.z))
            };

            // Apply saved rotation
            camera.rotation.set(savedRotation.x, savedRotation.y, savedRotation.z);

            // Rotation folder
            const rotationFolder = cameraFolder.addFolder('Rotation');
            const rotXControl = rotationFolder.add(
                camera.rotation,
                'x',
                guiConfig.camera.rotation.x.min,
                guiConfig.camera.rotation.x.max,
                guiConfig.camera.rotation.x.step
            ).name(guiConfig.camera.rotation.x.name);
            rotXControl.onChange(value => {
                updateDebugConfig('camera.rotation.x.value', value);
            });

            const rotYControl = rotationFolder.add(
                camera.rotation,
                'y',
                guiConfig.camera.rotation.y.min,
                guiConfig.camera.rotation.y.max,
                guiConfig.camera.rotation.y.step
            ).name(guiConfig.camera.rotation.y.name);
            rotYControl.onChange(value => {
                updateDebugConfig('camera.rotation.y.value', value);
            });

            const rotZControl = rotationFolder.add(
                camera.rotation,
                'z',
                guiConfig.camera.rotation.z.min,
                guiConfig.camera.rotation.z.max,
                guiConfig.camera.rotation.z.step
            ).name(guiConfig.camera.rotation.z.name);
            rotZControl.onChange(value => {
                updateDebugConfig('camera.rotation.z.value', value);
            });

            // Camera settings
            const savedSettings = {
                fov: getDebugConfigValue('camera.settings.fov.value',
                    getDefaultValue('camera.settings.fov', camera.fov)),
                near: getDebugConfigValue('camera.settings.near.value',
                    getDefaultValue('camera.settings.near', camera.near)),
                far: getDebugConfigValue('camera.settings.far.value',
                    getDefaultValue('camera.settings.far', camera.far))
            };

            // Apply saved settings
            camera.fov = savedSettings.fov;
            camera.near = savedSettings.near;
            camera.far = savedSettings.far;
            camera.updateProjectionMatrix();

            // Settings folder
            const settingsFolder = cameraFolder.addFolder('Settings');

            // FOV control
            const fovControl = settingsFolder.add(
                camera,
                'fov',
                guiConfig.camera.settings.fov.min,
                guiConfig.camera.settings.fov.max,
                guiConfig.camera.settings.fov.step
            ).name(guiConfig.camera.settings.fov.name);
            fovControl.onChange(value => {
                camera.updateProjectionMatrix();
                updateDebugConfig('camera.settings.fov.value', value);
            });

            // Near plane control
            const nearControl = settingsFolder.add(
                camera,
                'near',
                guiConfig.camera.settings.near.min,
                guiConfig.camera.settings.near.max,
                guiConfig.camera.settings.near.step
            ).name(guiConfig.camera.settings.near.name);
            nearControl.onChange(value => {
                camera.updateProjectionMatrix();
                updateDebugConfig('camera.settings.near.value', value);
            });

            // Far plane control
            const farControl = settingsFolder.add(
                camera,
                'far',
                guiConfig.camera.settings.far.min,
                guiConfig.camera.settings.far.max,
                guiConfig.camera.settings.far.step
            ).name(guiConfig.camera.settings.far.name);
            farControl.onChange(value => {
                camera.updateProjectionMatrix();
                updateDebugConfig('camera.settings.far.value', value);
            });

            // Close folders if configured
            if (guiConfig.gui.closeFolders) {
                positionFolder.close();
                rotationFolder.close();
                settingsFolder.close();
                cameraFolder.close();
            }
        }

        // Cleanup function
        return () => {
            if (folderRef.current) {
                // Simplement nettoyer la référence
                folderRef.current = null;
                console.log('Camera folder cleanup - reference cleared');
            }
        };
    }, [camera, debug, gui, gl, updateDebugConfig, getDebugConfigValue]);

    return null;
}