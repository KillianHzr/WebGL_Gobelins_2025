// Camera.jsx - Version modifiée sans Theatre.js
import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import * as THREE from 'three';
import {SRGBColorSpace, TextureLoader} from 'three';

export default function Camera() {
    const {camera, gl, scene} = useThree();
    const folderRef = useRef(null);
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();

    // Initialiser renderSettingsRef avec des valeurs persistantes
    const renderSettingsRef = useRef({
        toneMapping: Number(guiConfig.camera.render.toneMapping.default),
        toneMappingExposure: Number(guiConfig.camera.render.toneMappingExposure.default),
        shadowMapType: Number(guiConfig.renderer.shadowMap.type.default),
        shadowMapEnabled: guiConfig.renderer.shadowMap.enabled.default,
        shadowMapSize: Number(guiConfig.renderer.shadowMap.mapSize.default),
        shadowBias: Number(guiConfig.renderer.shadowMap.bias.default),
        shadowNormalBias: Number(guiConfig.renderer.shadowMap.normalBias.default)
    });

    useEffect(() => {
        const loader = new TextureLoader();

        // Liste des chemins possibles à tester
        const possibleBackgroundPaths = [
            '/textures/Background.png',
        ];

        const tryLoadTexture = (paths) => {
            if (paths.length === 0) {
                console.error('Aucun chemin de texture de fond valide trouvé');
                return;
            }

            const currentPath = paths[0];
            console.log(`Tentative de chargement de la texture depuis : ${currentPath}`);

            loader.load(
                currentPath,
                (texture) => {
                    // Succès du chargement
                    console.log(`Texture chargée avec succès depuis : ${currentPath}`);

                    // Configurer correctement l'espace de couleur
                    texture.colorSpace = SRGBColorSpace;

                    // Ajouter le mesh de fond à la scène
                    // scene.background = texture;
                },
                // Progression du chargement
                (xhr) => {
                    console.log(`Chargement de ${currentPath}: ${(xhr.loaded / xhr.total * 100)}% chargé`);
                },
                // Gestion des erreurs
                (error) => {
                    console.error(`Erreur de chargement de la texture depuis ${currentPath}:`, error);
                    // Essayer le prochain chemin
                    tryLoadTexture(paths.slice(1));
                }
            );
        };

        // Commencer à essayer de charger la texture
        tryLoadTexture(possibleBackgroundPaths);
    }, [scene]);

    // Configurer le renderer avec les paramètres centralisés
    useEffect(() => {
        // Appliquer les valeurs par défaut indépendamment du mode debug
        gl.toneMapping = guiConfig.camera.render.toneMapping.default;
        gl.toneMappingExposure = guiConfig.camera.render.toneMappingExposure.default;

        if (gl.shadowMap) {
            gl.shadowMap.enabled = guiConfig.renderer.shadowMap.enabled.default;
            gl.shadowMap.type = guiConfig.renderer.shadowMap.type.default;
        }

        // Mettre à jour les lumières avec les paramètres des ombres
        scene.traverse((object) => {
            if (object.isLight && object.shadow) {
                try {
                    object.shadow.type = guiConfig.renderer.shadowMap.type.default;

                    if (object.shadow.mapSize) {
                        object.shadow.mapSize.width = guiConfig.renderer.shadowMap.mapSize.default;
                        object.shadow.mapSize.height = guiConfig.renderer.shadowMap.mapSize.default;
                    }

                    object.shadow.bias = guiConfig.renderer.shadowMap.bias.default;
                    object.shadow.normalBias = guiConfig.renderer.shadowMap.normalBias.default;
                    object.shadow.needsUpdate = true;
                } catch (error) {
                    console.error('Erreur lors de la configuration initiale des ombres:', error);
                }
            }
        });

        if (camera.far !== guiConfig.camera.settings.far.default) {
            camera.far = guiConfig.camera.settings.far.default;
            camera.updateProjectionMatrix();
        }

    }, [gl, scene]);

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