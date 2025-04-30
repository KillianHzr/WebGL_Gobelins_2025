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

    // Initialiser renderSettingsRef correctement comme un objet avec les valeurs par défaut
    const renderSettingsRef = useRef({
        toneMapping: LightConfig.renderer.toneMapping.type,
        toneMappingExposure: LightConfig.renderer.toneMapping.exposure,
        shadowMapType: LightConfig.renderer.shadowMapping.type,
        shadowMapEnabled: LightConfig.renderer.shadowMapping.enabled
    });

    // Configurer le renderer avec les paramètres centralisés
    useEffect(() => {
        configureRenderer(gl);
    }, [gl]);

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
        const currentShadowConfig = {
            enabled: gl.shadowMap.enabled,
            type: gl.shadowMap.type
        };

        const targetShadowConfig = {
            enabled: renderSettingsRef.current.shadowMapEnabled,
            type: renderSettingsRef.current.shadowMapType
        };

        if (currentShadowConfig.enabled !== targetShadowConfig.enabled ||
            currentShadowConfig.type !== targetShadowConfig.type) {
            gl.shadowMap.enabled = targetShadowConfig.enabled;
            gl.shadowMap.type = targetShadowConfig.type;

            scene.traverse((object) => {
                if (object.isLight && object.shadow) {
                    object.shadow.type = targetShadowConfig.type;
                    object.shadow.needsUpdate = true;
                    object.shadow.map?.dispose();
                    object.shadow.map = null;
                }
            });

            gl.shadowMap.needsUpdate = true;
            gl.render(scene, camera);
        }
    });

    useEffect(() => {
        // Ajouter des contrôles de débogage si le mode débogage est actif
        if (debug?.active && debug?.showGui && gui && camera) {
            console.log("Configurant les contrôles de caméra de débogage", camera);

            // Ajouter des dossiers de contrôle de caméra à l'interface existante
            const cameraFolder = gui.addFolder(guiConfig.camera.folder);
            folderRef.current = cameraFolder;

            // Récupérer les paramètres de position sauvegardés
            const savedPosition = {
                x: getDebugConfigValue('camera.position.x.value',
                    getDefaultValue('camera.position.x', camera.position.x)),
                y: getDebugConfigValue('camera.position.y.value',
                    getDefaultValue('camera.position.y', camera.position.y)),
                z: getDebugConfigValue('camera.position.z.value',
                    getDefaultValue('camera.position.z', camera.position.z))
            };

            // Appliquer la position sauvegardée
            camera.position.set(savedPosition.x, savedPosition.y, savedPosition.z);

            // Récupérer les paramètres de rotation sauvegardés
            const savedRotation = {
                x: getDebugConfigValue('camera.rotation.x.value',
                    getDefaultValue('camera.rotation.x', camera.rotation.x)),
                y: getDebugConfigValue('camera.rotation.y.value',
                    getDefaultValue('camera.rotation.y', camera.rotation.y)),
                z: getDebugConfigValue('camera.rotation.z.value',
                    getDefaultValue('camera.rotation.z', camera.rotation.z))
            };

            // Appliquer la rotation sauvegardée
            camera.rotation.set(savedRotation.x, savedRotation.y, savedRotation.z);

            // Dossier des paramètres de rendu
            const renderFolder = gui.addFolder('Render');

            // Contrôles pour le tone mapping
            const renderSettings = {
                toneMapping: renderSettingsRef.current.toneMapping,
                toneMappingExposure: renderSettingsRef.current.toneMappingExposure,
                shadowMapType: renderSettingsRef.current.shadowMapType,
                shadowMapEnabled: renderSettingsRef.current.shadowMapEnabled
            };

            // Contrôle du tone mapping
            const toneMappingControl = renderFolder.add(
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
                gl.toneMapping = Number(value);
                updateDebugConfig('camera.render.toneMapping.value', Number(value));
                gl.render(scene, camera);
            });

            // Contrôle de l'exposition
            const exposureControl = renderFolder.add(
                renderSettings,
                'toneMappingExposure',
                0, 5, 0.01
            ).name('Exposure');

            exposureControl.onChange(value => {
                renderSettingsRef.current.toneMappingExposure = value;
                gl.toneMappingExposure = value;
                updateDebugConfig('camera.render.toneMappingExposure.value', value);
                gl.render(scene, camera);
            });

            // Fermer les dossiers si configuré
            if (guiConfig.gui.closeFolders) {
                renderFolder.close();
                cameraFolder.close();
            }
            const shadowTypeControl = renderFolder.add(
                renderSettings,
                'shadowType',
                {
                    'Basic': THREE.BasicShadowMap,
                    'PCF': THREE.PCFShadowMap,
                    'PCF Soft': THREE.PCFSoftShadowMap,
                    'VSM': THREE.VSMShadowMap,
                }
            ).name('Shadow Type');

            shadowTypeControl.onChange(value => {
                renderSettingsRef.current.shadowMapType = Number(value);
                gl.shadowMap.type = Number(value);

                // Mettre à jour les ombres pour toutes les lumières
                scene.traverse((object) => {
                    if (object.isLight && object.shadow) {
                        object.shadow.type = Number(value);
                        object.shadow.needsUpdate = true;
                        object.shadow.map?.dispose();
                        object.shadow.map = null;
                    }
                });

                // Mettre à jour le renderer
                gl.shadowMap.needsUpdate = true;

                // Mettre à jour la configuration de débogage
                updateDebugConfig('camera.render.shadowType.value', Number(value));

                // Forcer le rendu
                gl.render(scene, camera);
            });
            const shadowQualityControl = renderFolder.add(
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
                // Mettre à jour la taille des shadow maps pour toutes les lumières
                scene.traverse((object) => {
                    if (object.isLight && object.shadow) {
                        object.shadow.mapSize.width = value;
                        object.shadow.mapSize.height = value;
                        object.shadow.map?.dispose();
                        object.shadow.map = null;
                        object.shadow.needsUpdate = true;
                    }
                });

                updateDebugConfig('renderer.shadowMap.mapSize.value', value);

                // Force le rendu avec la nouvelle configuration
                gl.render(scene, camera);
            });
        }

        // Nettoyer lors du démontage
        return () => {
            if (folderRef.current) {
                folderRef.current = null;
                console.log('Nettoyage du dossier de caméra - référence effacée');
            }
        };
    }, [camera, debug, gui, gl, scene, updateDebugConfig, getDebugConfigValue]);

    return null;
}