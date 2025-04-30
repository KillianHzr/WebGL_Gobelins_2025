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
        toneMapping: guiConfig.camera.render.toneMapping.default,
        toneMappingExposure: guiConfig.camera.render.toneMappingExposure.default,
        shadowMapType: guiConfig.renderer.shadowMap.type.default,
        shadowMapEnabled: guiConfig.renderer.shadowMap.enabled.default,
        shadowMapSize: guiConfig.renderer.shadowMap.mapSize.default,
        shadowBias: guiConfig.renderer.shadowMap.bias.default,
        shadowNormalBias: guiConfig.renderer.shadowMap.normalBias.default
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
            enabled: gl.shadowMap?.enabled || false,
            type: gl.shadowMap?.type || THREE.PCFShadowMap,
            mapSize: {
                width: 1024,  // Valeur par défaut si non disponible
                height: 1024  // Valeur par défaut si non disponible
            },
            bias: scene.children.find(obj => obj.isLight && obj.shadow)?.shadow?.bias || 0,
            normalBias: scene.children.find(obj => obj.isLight && obj.shadow)?.shadow?.normalBias || 0
        };

        const targetShadowConfig = {
            enabled: renderSettingsRef.current.shadowMapEnabled ?? true,
            type: renderSettingsRef.current.shadowMapType ?? THREE.PCFShadowMap,
            mapSize: renderSettingsRef.current.shadowMapSize ?? 1024,
            bias: renderSettingsRef.current.shadowBias ?? 0,
            normalBias: renderSettingsRef.current.shadowNormalBias ?? 0
        };

        if (gl.shadowMap && (
            currentShadowConfig.enabled !== targetShadowConfig.enabled ||
            currentShadowConfig.type !== targetShadowConfig.type ||
            currentShadowConfig.mapSize.width !== targetShadowConfig.mapSize ||
            currentShadowConfig.bias !== targetShadowConfig.bias ||
            currentShadowConfig.normalBias !== targetShadowConfig.normalBias)) {

            // Vérifier et mettre à jour le renderer
            if (gl.shadowMap) {
                gl.shadowMap.enabled = targetShadowConfig.enabled;
                gl.shadowMap.type = targetShadowConfig.type;
            }

            // Parcourir et mettre à jour toutes les lumières avec des ombres
            scene.traverse((object) => {
                if (object.isLight && object.shadow) {
                    try {
                        object.shadow.type = targetShadowConfig.type;

                        // S'assurer que mapSize existe et est un objet avec width/height
                        if (object.shadow.mapSize) {
                            object.shadow.mapSize.width = targetShadowConfig.mapSize;
                            object.shadow.mapSize.height = targetShadowConfig.mapSize;
                        }

                        object.shadow.bias = targetShadowConfig.bias;
                        object.shadow.normalBias = targetShadowConfig.normalBias;
                        object.shadow.needsUpdate = true;

                        // Nettoyer la map d'ombre précédente
                        if (object.shadow.map) {
                            object.shadow.map.dispose();
                            object.shadow.map = null;
                        }
                    } catch (error) {
                        console.error('Erreur lors de la mise à jour des ombres:', error);
                    }
                }
            });

            // Marquer les ombres comme devant être mises à jour
            if (gl.shadowMap) {
                gl.shadowMap.needsUpdate = true;
            }

            // Forcer un rendu pour appliquer les changements
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
                shadowType: renderSettingsRef.current.shadowMapType,
                shadowQuality: renderSettingsRef.current.shadowMapSize,
                shadowEnabled: renderSettingsRef.current.shadowMapEnabled,
                shadowBias: renderSettingsRef.current.shadowBias,
                shadowNormalBias: renderSettingsRef.current.shadowNormalBias
            };

            // Contrôle de l'activation des ombres
            const shadowEnabledControl = renderFolder.add(
                renderSettings,
                'shadowEnabled'
            ).name('Shadow Enabled');

            shadowEnabledControl.onChange(value => {
                renderSettingsRef.current.shadowMapEnabled = value;
                updateDebugConfig('renderer.shadowMap.enabled.value', value);
            });

            // Contrôle du type de shadow mapping
            const shadowTypeControl = renderFolder.add(
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
                updateDebugConfig('renderer.shadowMap.type.value', Number(value));
            });

            // Contrôle de la qualité des ombres
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
                renderSettingsRef.current.shadowMapSize = Number(value);
                updateDebugConfig('renderer.shadowMap.mapSize.value', Number(value));
            });

            // Contrôle du shadow bias
            const shadowBiasControl = renderFolder.add(
                renderSettings,
                'shadowBias',
                guiConfig.renderer.shadowMap.bias.min,
                guiConfig.renderer.shadowMap.bias.max,
                guiConfig.renderer.shadowMap.bias.step
            ).name('Shadow Bias');

            shadowBiasControl.onChange(value => {
                renderSettingsRef.current.shadowBias = value;
                updateDebugConfig('renderer.shadowMap.bias.value', value);
            });

            // Contrôle du shadow normal bias
            const shadowNormalBiasControl = renderFolder.add(
                renderSettings,
                'shadowNormalBias',
                guiConfig.renderer.shadowMap.normalBias.min,
                guiConfig.renderer.shadowMap.normalBias.max,
                guiConfig.renderer.shadowMap.normalBias.step
            ).name('Shadow Normal Bias');

            shadowNormalBiasControl.onChange(value => {
                renderSettingsRef.current.shadowNormalBias = value;
                updateDebugConfig('renderer.shadowMap.normalBias.value', value);
            });

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
                scene.traverse((object) => {
                    if (object.isMesh && object.material) {
                        object.material.needsUpdate = true;
                    }
                });
                gl.render(scene, camera);
            });

            // Contrôle de l'exposition
            const exposureControl = renderFolder.add(
                renderSettings,
                'toneMappingExposure',
                guiConfig.camera.render.toneMappingExposure.min,
                guiConfig.camera.render.toneMappingExposure.max,
                guiConfig.camera.render.toneMappingExposure.step
            ).name('Exposure');

            exposureControl.onChange(value => {
                renderSettingsRef.current.toneMappingExposure = value;
                gl.toneMappingExposure = value;
                updateDebugConfig('camera.render.toneMappingExposure.value', value);
                scene.traverse((object) => {
                    if (object.isMesh && object.material) {
                        object.material.needsUpdate = true;
                    }
                });
                gl.render(scene, camera);
            });

            // Fermer les dossiers si configuré
            if (guiConfig.gui.closeFolders) {
                renderFolder.close();
                cameraFolder.close();
            }
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