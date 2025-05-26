import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import * as THREE from 'three';
import { SRGBColorSpace, TextureLoader } from 'three';
import { EventBus } from '../Utils/EventEmitter.jsx';
import GuiConfig from "../Config/guiConfig";

export default function Camera() {
    const { camera, gl, scene } = useThree();
    const folderRef = useRef(null);
    const cameraModelRef = useRef(null);
    const { debug, gui, updateDebugConfig, getDebugConfigValue } = useStore();

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
        // Fonction pour charger le modèle de caméra
        const loadCameraModel = () => {
            // Vérifier si AssetManager est accessible
            if (!window.assetManager || typeof window.assetManager.getItem !== 'function') {
                console.warn("AssetManager n'est pas encore disponible, nouvelle tentative dans 500ms");
                setTimeout(loadCameraModel, 500);
                return;
            }

            // Essayer de charger le modèle Camera
            try {
                const cameraModel = window.assetManager.getItem('Camera');
                if (!cameraModel) {
                    // Si Camera n'est pas trouvé, vérifions les assets disponibles
                    const availableAssets = Object.keys(window.assetManager.items || {});
                    console.warn("Modèle Camera non trouvé. Assets disponibles:", availableAssets.join(', '));

                    // Essayer avec un autre nom clé si 'Camera' n'est pas trouvé
                    const possibleCameraKeys = availableAssets.filter(key =>
                        key.toLowerCase().includes('camera') ||
                        key === 'Map' || // Parfois la caméra pourrait être incluse dans une map
                        key === 'MapInstance'
                    );

                    if (possibleCameraKeys.length > 0) {
                        console.log("Tentative avec les clés alternatives:", possibleCameraKeys);
                        for (const key of possibleCameraKeys) {
                            const altModel = window.assetManager.getItem(key);
                            if (altModel && (altModel.scene || altModel.animations)) {
                                console.log(`Modèle trouvé avec la clé alternative: ${key}`);
                                processCameraModel(altModel, key);
                                return;
                            }
                        }
                    }

                    // Si toujours pas trouvé, réessayer plus tard
                    console.warn("Modèle Camera non trouvé, nouvelle tentative dans 1000ms");
                    setTimeout(loadCameraModel, 1000);
                    return;
                }

                processCameraModel(cameraModel, 'Camera');
            } catch (error) {
                console.error("Erreur lors du chargement du modèle Camera:", error);
                setTimeout(loadCameraModel, 1000);
            }
        };

        // Fonction pour traiter le modèle de caméra une fois chargé
        const processCameraModel = (cameraModel, modelName) => {
            if (!cameraModel.scene) {
                console.warn(`Le modèle ${modelName} n'a pas de scène`);
                return;
            }

            // CORRECTION: Créer une structure qui contient à la fois la scène et les animations
            const combinedModel = {
                scene: cameraModel.scene.clone(),
                animations: cameraModel.animations || []
            };

            // Stocker la référence
            cameraModelRef.current = combinedModel;

            console.log(`Modèle de caméra ${modelName} chargé:`, cameraModelRef.current.scene);
            console.log(`Animations disponibles dans le modèle:`, cameraModelRef.current.animations.map(a => a.name));

            // Chercher l'objet caméra dans le modèle GLB
            let glbCamera = null;
            cameraModelRef.current.scene.traverse((object) => {
                if (object.isCamera) {
                    glbCamera = object;
                    // console.log("Caméra trouvée dans le modèle:", object);
                }
            });

            // Si pas de caméra trouvée, chercher un objet qui pourrait être une caméra
            if (!glbCamera) {
                cameraModelRef.current.scene.traverse((object) => {
                    console.log(`Objet dans la scène: ${object.name} (${object.type})`);
                    if (object.name.toLowerCase().includes('camera')) {
                        glbCamera = object;
                        console.log("Objet caméra potentiel trouvé:", object);
                    }
                });
            }

            if (glbCamera) {
                console.log('Caméra trouvée dans le GLB:', glbCamera);

                // Copier les propriétés de la caméra GLB vers la caméra Three.js
                if (glbCamera.isCamera) {
                    // Si c'est une vraie caméra, on copie les propriétés
                    camera.fov = glbCamera.fov;
                    camera.near = GuiConfig.camera.settings.near.default;
                    camera.far = GuiConfig.camera.settings.far.default;
                    camera.aspect = glbCamera.aspect;
                    camera.zoom = glbCamera.zoom;
                    camera.updateProjectionMatrix();
                }

                // CORRECTION: Mettre à jour le store avec le modèle combiné
                useStore.getState().setCameraModel(combinedModel);

                // Si des animations sont disponibles, les stocker également
                if (combinedModel.animations && combinedModel.animations.length > 0) {
                    useStore.getState().setCameraAnimation(combinedModel.animations[0]);
                    useStore.getState().setAvailableCameraAnimations(combinedModel.animations);
                }

                // Informer le système que la caméra GLB est prête
                EventBus.trigger('camera-glb-loaded', {
                    cameraModel: combinedModel
                });
            } else {
                console.warn(`Aucune caméra trouvée dans le modèle ${modelName}`);

                // CORRECTION: Utiliser le modèle combiné même sans caméra spécifique
                useStore.getState().setCameraModel(combinedModel);
                EventBus.trigger('camera-glb-loaded', {
                    cameraModel: combinedModel
                });
            }

            // Chercher les animations
            if (cameraModel.animations && cameraModel.animations.length > 0) {
                console.log('Animations trouvées:', cameraModel.animations);

                // Chercher l'animation spécifique "Action.007"
                const targetAnimation = cameraModel.animations.find(anim =>
                    anim.name === 'Action.007' ||
                    anim.name.toLowerCase().includes('Action.007')
                );

                if (targetAnimation) {
                    console.log('Animation target trouvée:', targetAnimation);
                    // Informer le système que l'animation est disponible
                    EventBus.trigger('camera-animation-loaded', {
                        animation: targetAnimation,
                        allAnimations: cameraModel.animations
                    });
                } else {
                    console.log("Animations disponibles:", cameraModel.animations.map(a => a.name).join(', '));

                    // Si Action.007 n'est pas trouvée, utiliser la première animation disponible
                    if (cameraModel.animations.length > 0) {
                        console.log(`Animation 'Action.007' non trouvée, utilisation de la première animation: ${cameraModel.animations[0].name}`);
                        EventBus.trigger('camera-animation-loaded', {
                            animation: cameraModel.animations[0],
                            allAnimations: cameraModel.animations
                        });
                    } else {
                        console.warn("Aucune animation trouvée dans le modèle");
                    }
                }
            } else {
                console.warn(`Aucune animation trouvée dans le modèle ${modelName}`);
            }
        };


        // Écouter l'événement 'ready' de l'AssetManager
        const handleAssetManagerReady = () => {
            console.log("Événement 'ready' reçu de l'AssetManager");
            loadCameraModel();
        };

        // S'abonner à l'événement 'ready'
        const readySubscription = EventBus.on('ready', handleAssetManagerReady);


        return () => {
            readySubscription(); // Se désabonner de l'événement ready
        };
    }, [camera]);

    // Le reste du code est inchangé...

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