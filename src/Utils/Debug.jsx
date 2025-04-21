import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';

const Debug = () => {
    const {gl, scene} = useThree();
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const foldersRef = useRef([]);

    useEffect(() => {
        if (!debug?.active || !debug?.showGui || !gui) return;

        // Add scene controls
        const sceneFolder = gui.addFolder(guiConfig.scene.folder);
        if (guiConfig.gui.closeFolders) {
            sceneFolder.close();
        }
        // Get saved values or use defaults
        const savedBackground = getDebugConfigValue('scene.background.value', guiConfig.scene.background.color);
        const savedFogEnabled = getDebugConfigValue('scene.fog.enabled.value', false);
        const savedFogColor = getDebugConfigValue('scene.fog.color.value', guiConfig.scene.fog.color.color);
        const savedFogNear = getDebugConfigValue('scene.fog.near.value', guiConfig.scene.fog.near.min);
        const savedFogFar = getDebugConfigValue('scene.fog.far.value', guiConfig.scene.fog.far.min);

        // Apply saved values
        scene.background = new THREE.Color(savedBackground);
        if (savedFogEnabled) {
            scene.fog = new THREE.Fog(savedFogColor, savedFogNear, savedFogFar);
        }

        const sceneSettings = {
            background: savedBackground,
            fogEnabled: savedFogEnabled,
            fogColor: savedFogColor,
            fogNear: savedFogNear,
            fogFar: savedFogFar
        };

        // Background control
        const bgControl = sceneFolder.addColor(sceneSettings, 'background')
            .name(guiConfig.scene.background.name);

        bgControl.onChange(value => {
            scene.background = new THREE.Color(value);
            updateDebugConfig('scene.background.value', value);
        });

        // Fog enabled control
        const fogEnabledControl = sceneFolder.add(sceneSettings, 'fogEnabled')
            .name(guiConfig.scene.fog.enabled.name);

        fogEnabledControl.onChange(value => {
            if (value) {
                scene.fog = new THREE.Fog(sceneSettings.fogColor, sceneSettings.fogNear, sceneSettings.fogFar);
            } else {
                scene.fog = null;
            }
            updateDebugConfig('scene.fog.enabled.value', value);
        });

        // Fog color control
        const fogColorControl = sceneFolder.addColor(sceneSettings, 'fogColor')
            .name(guiConfig.scene.fog.color.name);

        fogColorControl.onChange(value => {
            if (scene.fog) {
                scene.fog.color = new THREE.Color(value);
            }
            updateDebugConfig('scene.fog.color.value', value);
        });

        // Fog near control
        const fogNearControl = sceneFolder.add(sceneSettings, 'fogNear', guiConfig.scene.fog.near.min, guiConfig.scene.fog.near.max, guiConfig.scene.fog.near.step).name(guiConfig.scene.fog.near.name);

        fogNearControl.onChange(value => {
            if (scene.fog) {
                scene.fog.near = value;
            }
            updateDebugConfig('scene.fog.near.value', value);
        });

        // Fog far control
        const fogFarControl = sceneFolder.add(sceneSettings, 'fogFar', guiConfig.scene.fog.far.min, guiConfig.scene.fog.far.max, guiConfig.scene.fog.far.step).name(guiConfig.scene.fog.far.name);

        fogFarControl.onChange(value => {
            if (scene.fog) {
                scene.fog.far = value;
            }
            updateDebugConfig('scene.fog.far.value', value);
        });

        // Add renderer controls
        const rendererFolder = gui.addFolder(guiConfig.renderer.folder);
        if (guiConfig.gui.closeFolders) {
            rendererFolder.close();

        }

        // Get saved renderer values
        const savedShadowMap = getDebugConfigValue('renderer.shadowMap.value', true);
        const savedToneMapping = getDebugConfigValue('renderer.toneMapping.value', guiConfig.renderer.toneMapping.default);
        const savedExposure = getDebugConfigValue('renderer.toneMappingExposure.value', 1);

        // Apply saved values
        gl.shadowMap.enabled = savedShadowMap;
        gl.toneMapping = savedToneMapping;
        gl.toneMappingExposure = savedExposure;

        const rendererSettings = {
            shadowMap: savedShadowMap, toneMapping: savedToneMapping, toneMappingExposure: savedExposure
        };

        // Shadow map control
        const shadowMapControl = rendererFolder.add(rendererSettings, 'shadowMap')
            .name(guiConfig.renderer.shadowMap.name);

        shadowMapControl.onChange(value => {
            gl.shadowMap.enabled = value;
            gl.shadowMap.needsUpdate = true;
            updateDebugConfig('renderer.shadowMap.value', value);
        });

        // Tone mapping control
        const toneMappingControl = rendererFolder.add(rendererSettings, 'toneMapping', guiConfig.renderer.toneMapping.options).name(guiConfig.renderer.toneMapping.name);

        toneMappingControl.onChange(value => {
            gl.toneMapping = Number(value);
            updateDebugConfig('renderer.toneMapping.value', Number(value));
        });

        // Exposure control
        const exposureControl = rendererFolder.add(rendererSettings, 'toneMappingExposure', guiConfig.renderer.toneMappingExposure.min, guiConfig.renderer.toneMappingExposure.max, guiConfig.renderer.toneMappingExposure.step).name(guiConfig.renderer.toneMappingExposure.name);

        exposureControl.onChange(value => {
            gl.toneMappingExposure = value;
            updateDebugConfig('renderer.toneMappingExposure.value', value);
        });

        // Store folders for cleanup
        foldersRef.current = [sceneFolder, rendererFolder];

        // Cleanup on unmount - remove folders but don't destroy GUI
        return () => {
            if (gui) {
                // Dans lil-gui, on ne peut pas supprimer directement un dossier
                // La solution est de détruire l'interface complète ou de la reconstruire
                // Mais on peut marquer nos références comme nulles pour éviter les fuites mémoire
                foldersRef.current = [];
                console.log('Debug folders cleanup - references cleared');
            }
        };
    }, [gl, scene, debug, gui, updateDebugConfig, getDebugConfigValue]);

    return null; // This component doesn't render any React elements
};

export default Debug;