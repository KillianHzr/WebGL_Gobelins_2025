import {useEffect, useRef} from 'react';
import {useThree, useFrame} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {getDefaultValue} from '../Utils/defaultValues';
import {LightConfig, configureRenderer} from './Lights.jsx';
import * as THREE from 'three';

export default function Camera() {
    const {camera, gl, scene} = useThree();
    const folderRef = useRef(null);
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();

    // Initialiser renderSettingsRef avec des valeurs persistantes
    const renderSettingsRef = useRef({
        toneMapping: Number( guiConfig.camera.render.toneMapping.default),
        toneMappingExposure: Number( guiConfig.camera.render.toneMappingExposure.default),
        shadowMapType: Number( guiConfig.renderer.shadowMap.type.default),
        shadowMapEnabled: guiConfig.renderer.shadowMap.enabled.default,
        shadowMapSize: Number(guiConfig.renderer.shadowMap.mapSize.default),
        shadowBias: Number(guiConfig.renderer.shadowMap.bias.default),
        shadowNormalBias: Number(guiConfig.renderer.shadowMap.normalBias.default)
    });

    // Configurer le renderer avec les paramètres centralisés
    useEffect(() => {
        configureRenderer(gl);

        // Appliquer les paramètres sauvegardés
        gl.toneMapping = renderSettingsRef.current.toneMapping;
        gl.toneMappingExposure = renderSettingsRef.current.toneMappingExposure;

        if (gl.shadowMap) {
            gl.shadowMap.enabled = renderSettingsRef.current.shadowMapEnabled;
            gl.shadowMap.type = renderSettingsRef.current.shadowMapType;
        }

        // Mettre à jour les lumières avec les paramètres des ombres
        scene.traverse((object) => {
            if (object.isLight && object.shadow) {
                try {
                    object.shadow.type = renderSettingsRef.current.shadowMapType;

                    if (object.shadow.mapSize) {
                        object.shadow.mapSize.width = renderSettingsRef.current.shadowMapSize;
                        object.shadow.mapSize.height = renderSettingsRef.current.shadowMapSize;
                    }

                    object.shadow.bias = renderSettingsRef.current.shadowBias;
                    object.shadow.normalBias = renderSettingsRef.current.shadowNormalBias;
                    object.shadow.needsUpdate = true;
                } catch (error) {
                    console.error('Erreur lors de la configuration initiale des ombres:', error);
                }
            }
        });

    }, [gl, scene]);

    // S'exécute à chaque frame pour s'assurer que les paramètres de rendu sont appliqués
    useFrame(() => {
        // Vérifier et mettre à jour le tone mapping
        if (renderSettingsRef.current.toneMapping !== undefined &&
            gl.toneMapping !== renderSettingsRef.current.toneMapping) {
            gl.toneMapping = renderSettingsRef.current.toneMapping;
            scene.traverse((object) => {
                if (object.isMesh && object.material) {
                    object.material.needsUpdate = true;
                }
            });
            gl.render(scene, camera);
        }

        if (renderSettingsRef.current.toneMappingExposure !== undefined &&
            gl.toneMappingExposure !== renderSettingsRef.current.toneMappingExposure) {
            gl.toneMappingExposure = renderSettingsRef.current.toneMappingExposure;
            scene.traverse((object) => {
                if (object.isMesh && object.material) {
                    object.material.needsUpdate = true;
                }
            });
            gl.render(scene, camera);
        }

        // Vérifier et mettre à jour les paramètres des ombres
        if (gl.shadowMap) {
            const currentShadowConfig = {
                enabled: gl.shadowMap.enabled,
                type: gl.shadowMap.type,
                mapSize: gl.shadowMap.size?.width || 1024,
                bias: scene.children.find(obj => obj.isLight && obj.shadow)?.shadow?.bias || 0,
                normalBias: scene.children.find(obj => obj.isLight && obj.shadow)?.shadow?.normalBias || 0
            };

            const targetShadowConfig = renderSettingsRef.current;

            if (currentShadowConfig.enabled !== targetShadowConfig.shadowMapEnabled ||
                currentShadowConfig.type !== targetShadowConfig.shadowMapType ||
                currentShadowConfig.mapSize !== targetShadowConfig.shadowMapSize ||
                currentShadowConfig.bias !== targetShadowConfig.shadowBias ||
                currentShadowConfig.normalBias !== targetShadowConfig.shadowNormalBias) {

                gl.shadowMap.enabled = targetShadowConfig.shadowMapEnabled;
                gl.shadowMap.type = targetShadowConfig.shadowMapType;

                scene.traverse((object) => {
                    if (object.isLight && object.shadow) {
                        try {
                            object.shadow.type = targetShadowConfig.shadowMapType;

                            if (object.shadow.mapSize) {
                                object.shadow.mapSize.width = targetShadowConfig.shadowMapSize;
                                object.shadow.mapSize.height = targetShadowConfig.shadowMapSize;
                            }

                            object.shadow.bias = targetShadowConfig.shadowBias;
                            object.shadow.normalBias = targetShadowConfig.shadowNormalBias;
                            object.shadow.needsUpdate = true;

                            if (object.shadow.map) {
                                object.shadow.map.dispose();
                                object.shadow.map = null;
                            }
                        } catch (error) {
                            console.error('Erreur lors de la mise à jour des ombres:', error);
                        }
                    }
                });

                gl.shadowMap.needsUpdate = true;
                gl.render(scene, camera);
            }
        }
    });

    useEffect(() => {
        // Sauvegarder les paramètres initiaux
        const initialPosition = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        };

        const initialRotation = {
            x: camera.rotation.x,
            y: camera.rotation.y,
            z: camera.rotation.z
        };

        // Ajouter des contrôles de débogage si le mode débogage est actif
        if (debug?.active && debug?.showGui && gui && camera) {
            console.log("Configurant les contrôles de caméra de débogage", camera);

            // Dossier des paramètres de rendu
            const renderFolder = gui.addFolder(guiConfig.renderer.folder);

            // Dossier pour le Tone Mapping
            const toneFolder = renderFolder.addFolder('Tone Mapping');

            // Dossier pour les Shadows
            const shadowFolder = renderFolder.addFolder('Shadows');

            // Contrôles pour le tone mapping et les ombres
            const renderSettings = {
                toneMapping: renderSettingsRef.current.toneMapping,
                toneMappingExposure: renderSettingsRef.current.toneMappingExposure,
                shadowEnabled: renderSettingsRef.current.shadowMapEnabled,
                shadowType: renderSettingsRef.current.shadowMapType,
                shadowQuality: renderSettingsRef.current.shadowMapSize,
                shadowBias: renderSettingsRef.current.shadowBias,
                shadowNormalBias: renderSettingsRef.current.shadowNormalBias
            };

            // Contrôle de l'activation des ombres
            const shadowEnabledControl = shadowFolder.add(
                renderSettings,
                'shadowEnabled'
            ).name('Enable Shadows');

            shadowEnabledControl.onChange(value => {
                renderSettingsRef.current.shadowMapEnabled = value;
                // saveRenderSettings();
            });

            // Contrôle du type de shadow mapping
            const shadowTypeControl = shadowFolder.add(
                renderSettings,
                'shadowType',
                {
                    'Basic': THREE.BasicShadowMap,
                    'PCF': THREE.PCFShadowMap,
                    'PCF Soft': THREE.PCFSoftShadowMap,
                    'VSM': THREE.VSMShadowMap
                }
            ).name('Shadow Type');

            shadowTypeControl.onChange(value => {
                renderSettingsRef.current.shadowMapType = Number(value);
                // saveRenderSettings();
            });

            // Contrôle de la qualité des ombres
            const shadowQualityControl = shadowFolder.add(
                renderSettings,
                'shadowQuality',
                {
                    '256x256': 256,
                    '512x512': 512,
                    '1024x1024': 1024,
                    '2048x2048': 2048,
                    '4096x4096': 4096,
                    '8192x8192': 8192,
                    '16384x16384': 16384
                }
            ).name('Shadow Quality');

            shadowQualityControl.onChange(value => {
                renderSettingsRef.current.shadowMapSize = Number(value);
                // saveRenderSettings();
            });

            // Contrôle du shadow bias
            const shadowBiasControl = shadowFolder.add(
                renderSettings,
                'shadowBias',
                guiConfig.renderer.shadowMap.bias.min,
                guiConfig.renderer.shadowMap.bias.max,
                guiConfig.renderer.shadowMap.bias.step
            ).name('Shadow Bias');

            shadowBiasControl.onChange(value => {
                renderSettingsRef.current.shadowBias = value;
                // saveRenderSettings();
            });

            // Contrôle du shadow normal bias
            const shadowNormalBiasControl = shadowFolder.add(
                renderSettings,
                'shadowNormalBias',
                guiConfig.renderer.shadowMap.normalBias.min,
                guiConfig.renderer.shadowMap.normalBias.max,
                guiConfig.renderer.shadowMap.normalBias.step
            ).name('Shadow Normal Bias');

            shadowNormalBiasControl.onChange(value => {
                renderSettingsRef.current.shadowNormalBias = value;
                // saveRenderSettings();
            });

            // Contrôle du tone mapping
            const toneMappingControl = toneFolder.add(
                renderSettings,
                'toneMapping',
                {
                    'None': THREE.NoToneMapping,
                    'Linear': THREE.LinearToneMapping,
                    'Reinhard': THREE.ReinhardToneMapping,
                    'Cineon': THREE.CineonToneMapping,
                    'ACESFilmic': THREE.ACESFilmicToneMapping
                }
            ).name('Tone Mapping');

            toneMappingControl.onChange(value => {
                renderSettingsRef.current.toneMapping = Number(value);
                // saveRenderSettings();
            });

            // Contrôle de l'exposition
            const exposureControl = toneFolder.add(
                renderSettings,
                'toneMappingExposure',
                guiConfig.camera.render.toneMappingExposure.min,
                guiConfig.camera.render.toneMappingExposure.max,
                guiConfig.camera.render.toneMappingExposure.step
            ).name('Exposure');

            exposureControl.onChange(value => {
                renderSettingsRef.current.toneMappingExposure = value;
                // saveRenderSettings();
            });

            // Fermer les dossiers si configuré
            if (guiConfig.gui.closeFolders) {
                renderFolder.close();
                toneFolder.close();
                shadowFolder.close();
            }
        }

        // Nettoyer lors du démontage
        return () => {
            if (folderRef.current) {
                folderRef.current = null;
                console.log('Nettoyage du dossier de caméra - référence effacée');
            }
        };
    }, [camera, debug, gui, gl, scene]);

    return null;
}