import {useEffect, useRef} from 'react';
import {useThree, useFrame} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {getDefaultValue} from '../Utils/defaultValues';

export default function Camera() {
    const {camera, gl, scene} = useThree();
    const folderRef = useRef(null);
    const renderSettingsRef = useRef({
        toneMapping: undefined,
        toneMappingExposure: undefined
    });
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();

    // Cette fonction s'exécute à chaque frame pour s'assurer que les paramètres de rendu sont appliqués
    useFrame(() => {
        if (renderSettingsRef.current.toneMapping !== undefined &&
            gl.toneMapping !== renderSettingsRef.current.toneMapping) {
            gl.toneMapping = renderSettingsRef.current.toneMapping;
        }

        if (renderSettingsRef.current.toneMappingExposure !== undefined &&
            gl.toneMappingExposure !== renderSettingsRef.current.toneMappingExposure) {
            gl.toneMappingExposure = renderSettingsRef.current.toneMappingExposure;
        }
    });

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


            // Camera settings
            const savedSettings = {
                fov: getDebugConfigValue('camera.settings.fov.value',
                    getDefaultValue('camera.settings.fov', camera.fov)),
                near: getDebugConfigValue('camera.settings.near.value',
                    getDefaultValue('camera.settings.near', camera.near)),
                far: getDebugConfigValue('camera.settings.far.value',
                    getDefaultValue('camera.settings.far', camera.far))
            };

            // Render settings folder
            const renderFolder = cameraFolder.addFolder('Render');

            // Get saved renderer values
            const savedRenderSettings = {
                toneMapping: getDebugConfigValue('camera.render.toneMapping.value',
                    getDefaultValue('camera.render.toneMapping', gl.toneMapping)),
                toneMappingExposure: getDebugConfigValue('camera.render.toneMappingExposure.value',
                    getDefaultValue('camera.render.toneMappingExposure', gl.toneMappingExposure))
            };

            // Stocker les valeurs dans la référence pour les mises à jour de frame
            renderSettingsRef.current = {
                toneMapping: savedRenderSettings.toneMapping,
                toneMappingExposure: savedRenderSettings.toneMappingExposure
            };

            // Apply saved values immediately
            gl.toneMapping = savedRenderSettings.toneMapping;
            gl.toneMappingExposure = savedRenderSettings.toneMappingExposure;

            const renderSettings = {
                toneMapping: savedRenderSettings.toneMapping,
                toneMappingExposure: savedRenderSettings.toneMappingExposure
            };

            // Tone mapping control
            const toneMappingControl = renderFolder.add(
                renderSettings,
                'toneMapping',
                guiConfig.camera.render.toneMapping.options
            ).name(guiConfig.camera.render.toneMapping.name);

            toneMappingControl.onChange(value => {
                // Mettre à jour la référence pour que useFrame puisse appliquer le changement
                renderSettingsRef.current.toneMapping = Number(value);
                gl.toneMapping = Number(value); // Appliquer également immédiatement
                updateDebugConfig('camera.render.toneMapping.value', Number(value));

                // Forcer le rendu pour voir les changements immédiatement
                gl.render(scene, camera);
            });

            // Exposure control
            const exposureControl = renderFolder.add(
                renderSettings,
                'toneMappingExposure',
                guiConfig.camera.render.toneMappingExposure.min,
                guiConfig.camera.render.toneMappingExposure.max,
                guiConfig.camera.render.toneMappingExposure.step
            ).name(guiConfig.camera.render.toneMappingExposure.name);

            exposureControl.onChange(value => {
                // Mettre à jour la référence pour que useFrame puisse appliquer le changement
                renderSettingsRef.current.toneMappingExposure = value;
                gl.toneMappingExposure = value; // Appliquer également immédiatement
                updateDebugConfig('camera.render.toneMappingExposure.value', value);

                // Forcer le rendu pour voir les changements immédiatement
                gl.render(scene, camera);
            });

            // Close folders if configured
            if (guiConfig.gui.closeFolders) {
                renderFolder.close();
                cameraFolder.close();
            }
        }

        // Cleanup function
        return () => {
            if (folderRef.current) {
                // Simply clean the reference
                folderRef.current = null;
                console.log('Camera folder cleanup - reference cleared');
            }
        };
    }, [camera, debug, gui, gl, scene, updateDebugConfig, getDebugConfigValue]);

    return null;
}