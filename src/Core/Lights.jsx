import {useEffect, useRef, useState} from 'react';
import {useThree, useFrame} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {getDefaultValue, initializeLight} from '../Utils/defaultValues';
import {DirectionalLight, DirectionalLightHelper, CameraHelper} from "three";

import * as THREE from 'three';

// Configuration centralisée des lumières directement depuis Lights.jsx

// Configuration centralisée et enrichie des lumières
export const LightConfig = {
    modes: {
        day: {
            ambientIntensity: 0.2,
            ambientColor: "#FFFFFF",
            mainLight: {
                position: [53.764, 31.716, -56.134],
                intensity: 13000,
                color: "#FFEAC6",
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        },
        night: {
            ambientIntensity: 0.1,
            mainLight: {
                position: [171.443, 32.282, -81.040],
                intensity: 20870.28 * 2,
                color: "#B4B5FF",
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        }
    },
    renderer: {
        toneMapping: {
            type: THREE.LinearToneMapping,
            exposure: 1.5,
            options: guiConfig.camera.render.toneMapping.options
        },
        shadowMapping: {
            enabled: true,
            type: THREE.PCFSoftShadowMap,
            types: guiConfig.renderer.shadowMap.type.options
        }
    },
    defaults: {
        directionalLight: {
            intensity: 7.5,
            color: "#FFE9C1",
            position: [-20, 30, 20],
            castShadow: true,
            shadowConfig: {
                mapSize: 2048,
                bias: -0.0005,
                camera: {
                    near: 0.1,
                    far: 200,
                    left: -50,
                    right: 50,
                    top: 50,
                    bottom: -50
                }
            }
        }
    }
};

// Fonction pour créer et configurer les lumières de la scène
export function createSceneLights(scene, isNightMode = false) {
    // Nettoyer les lumières existantes
    const existingLights = [];
    scene.traverse((child) => {
        if (child.isLight) existingLights.push(child);
    });
    existingLights.forEach(light => scene.remove(light));

    const mode = isNightMode ? LightConfig.modes.night : LightConfig.modes.day;

    // Configuration de la lumière ambiante
    const ambientLight = new THREE.AmbientLight(
        '#FFFFFF',
        mode.ambientIntensity
    );
    scene.add(ambientLight);

    // Configuration de la lumière principale (point light)
    const mainLight = new THREE.PointLight(
        mode.mainLight.color,
        mode.mainLight.intensity
    );
    mainLight.position.set(...mode.mainLight.position);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = mode.mainLight.shadowMapSize;
    mainLight.shadow.mapSize.height = mode.mainLight.shadowMapSize;
    mainLight.shadow.bias = mode.mainLight.shadowBias;
    mainLight.shadow.radius = 1;
    scene.add(mainLight);

    return { ambientLight, mainLight };
}

// Fonction pour configurer le renderer
export function configureRenderer(renderer) {
    renderer.toneMapping = LightConfig.renderer.toneMapping.type;
    renderer.toneMappingExposure = LightConfig.renderer.toneMapping.exposure;
    renderer.shadowMap.enabled = LightConfig.renderer.shadowMapping.enabled;
    renderer.shadowMap.type = LightConfig.renderer.shadowMapping.type;

    // AJOUT : Force la mise à jour du renderer
    renderer.shadowMap.needsUpdate = true;
}

// Fonction pour créer une lumière directionnelle avec configuration détaillée
export function createDirectionalLight(config = {}) {
    const lightConfig = { ...LightConfig.defaults.directionalLight, ...config };

    const light = new THREE.DirectionalLight(
        lightConfig.color,
        lightConfig.intensity
    );

    light.position.set(...lightConfig.position);
    light.castShadow = lightConfig.castShadow;

    // Configuration des ombres
    light.shadow.mapSize.width = lightConfig.shadowConfig.mapSize;
    light.shadow.mapSize.height = lightConfig.shadowConfig.mapSize;
    light.shadow.bias = lightConfig.shadowConfig.bias;

    // Configuration de la caméra d'ombre
    const shadowCamera = light.shadow.camera;
    Object.assign(shadowCamera, lightConfig.shadowConfig.camera);
    shadowCamera.updateProjectionMatrix();

    return light;
}

export default function Lights() {
    const {scene, gl, camera} = useThree();
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const folderRef = useRef(null);
    const debugLightValuesRef = useRef(null);
    const directionalLightRef = useRef();
    const lightHelperRef = useRef();
    const shadowCameraHelperRef = useRef();
    const guiInitializedRef = useRef(false);
    const [isNightMode, setIsNightMode] = useState(false);

    // Référence aux paramètres d'éclairage actuels - NOUVEAU
    const lightSettingsRef = useRef({
        day: {
            position: [53.764, 31.716, -56.134],
            intensity: 13000,
            color: "#FFEAC6"
        },
        night: {
            position: [171.443, 32.282, -81.040],
            intensity: 20870.28 * 2,
            color: "#B4B5FF"
        },
        isNightMode: false,
        needsUpdate: false,
        // Paramètres pour les ombres, pour une cohérence avec renderSettingsRef dans Camera.jsx
        shadowMapSize: Number( guiConfig.renderer.shadowMap.mapSize.default),
        shadowBias: Number(guiConfig.renderer.shadowMap.bias.default),
        shadowNormalBias: Number( guiConfig.renderer.shadowMap.normalBias.default)
    });


    // Utilisation de useFrame pour appliquer les changements d'éclairage en temps réel - NOUVEAU
    useFrame(() => {
        // Si des mises à jour sont nécessaires
        if (lightSettingsRef.current.needsUpdate) {
            lightSettingsRef.current.needsUpdate = false;

            // Si la lumière directionnelle existe
            if (directionalLightRef.current) {
                // Obtenir la configuration active selon le mode
                const currentConfig = lightSettingsRef.current.isNightMode
                    ? lightSettingsRef.current.night
                    : lightSettingsRef.current.day;

                // Appliquer les changements à la lumière
                directionalLightRef.current.intensity = currentConfig.intensity;
                directionalLightRef.current.color.set(currentConfig.color);

                // Mettre à jour la position si nécessaire
                if (Array.isArray(currentConfig.position) && currentConfig.position.length === 3) {
                    directionalLightRef.current.position.set(
                        currentConfig.position[0],
                        currentConfig.position[1],
                        currentConfig.position[2]
                    );
                }

                // Mettre à jour les ombres si nécessaire
                if (directionalLightRef.current.shadow) {
                    if (directionalLightRef.current.shadow.mapSize) {
                        directionalLightRef.current.shadow.mapSize.width = lightSettingsRef.current.shadowMapSize;
                        directionalLightRef.current.shadow.mapSize.height = lightSettingsRef.current.shadowMapSize;
                    }

                    directionalLightRef.current.shadow.bias = lightSettingsRef.current.shadowBias;
                    directionalLightRef.current.shadow.normalBias = lightSettingsRef.current.shadowNormalBias;
                    directionalLightRef.current.shadow.needsUpdate = true;

                    if (directionalLightRef.current.shadow.map) {
                        directionalLightRef.current.shadow.map.dispose();
                        directionalLightRef.current.shadow.map = null;
                    }
                }

                // Forcer le rendu de la scène pour voir les changements immédiatement
                gl.render(scene, camera);

                // Mettre à jour les helpers si nécessaire
                if (lightHelperRef.current) {
                    lightHelperRef.current.update();
                }

                if (shadowCameraHelperRef.current) {
                    shadowCameraHelperRef.current.update();
                }
            }
        }
    });

    // Configuration des données pour l'éclairage jour/nuit - MODIFIÉ pour utiliser lightSettingsRef
    const dayLightConfig = lightSettingsRef.current.day;
    const nightLightConfig = lightSettingsRef.current.night;

    // Ajouter la lumière directionnelle à la scène et ses helpers
    useEffect(() => {
        // Créer la lumière directionnelle (soleil) depuis le haut à gauche
        if (!directionalLightRef.current) {
            const directionalLight = scene.children.find(
                (child) => child.isDirectionalLight && child.name === 'TopLeftLight'
            );

            if (!directionalLight) {
                console.log("Adding directional light to the scene");
                const newLight = new DirectionalLight('#FFE9C1', 7.5);

                // Utiliser les valeurs du lightSettingsRef
                const currentConfig = lightSettingsRef.current.isNightMode
                    ? lightSettingsRef.current.night
                    : lightSettingsRef.current.day;

                newLight.color.set(currentConfig.color);
                newLight.intensity = currentConfig.intensity;
                newLight.position.set(...currentConfig.position);

                newLight.castShadow = true;
                newLight.shadow.mapSize.width = lightSettingsRef.current.shadowMapSize;
                newLight.shadow.mapSize.height = lightSettingsRef.current.shadowMapSize;
                newLight.shadow.bias = lightSettingsRef.current.shadowBias;
                newLight.shadow.camera.near = 0.1;
                newLight.shadow.camera.far = 25;

                // Étendre le frustum de la caméra d'ombre
                newLight.shadow.camera.left = -50;
                newLight.shadow.camera.right = 50;
                newLight.shadow.camera.top = 50;
                newLight.shadow.camera.bottom = -50;

                newLight.name = 'TopLeftLight';
                scene.add(newLight);
                directionalLightRef.current = newLight;

                // Créer les helpers pour le mode debug
                if (debug?.active) {
                    createHelpers(newLight);
                }
            } else {
                directionalLightRef.current = directionalLight;

                // Créer les helpers pour le mode debug
                if (debug?.active) {
                    createHelpers(directionalLight);
                }
            }
        }

        // Fonction pour créer et gérer les helpers
        function createHelpers(light) {
            // Supprimer les helpers existants si présents
            if (lightHelperRef.current) {
                scene.remove(lightHelperRef.current);
            }

            if (shadowCameraHelperRef.current) {
                scene.remove(shadowCameraHelperRef.current);
            }

            // Créer un helper pour visualiser la direction de la lumière
            const helper = new DirectionalLightHelper(light, 2);
            helper.visible = debug?.showLightHelpers || false;
            scene.add(helper);
            lightHelperRef.current = helper;

            // Créer un helper pour visualiser la zone de projection d'ombres
            const shadowHelper = new CameraHelper(light.shadow.camera);
            shadowHelper.visible = debug?.showLightHelpers || false;
            scene.add(shadowHelper);
            shadowCameraHelperRef.current = shadowHelper;
        }

        // Nettoyage lors du démontage
        return () => {
            if (lightHelperRef.current) {
                scene.remove(lightHelperRef.current);
                lightHelperRef.current = null;
            }

            if (shadowCameraHelperRef.current) {
                scene.remove(shadowCameraHelperRef.current);
                shadowCameraHelperRef.current = null;
            }
        };
    }, [scene, debug]);

    // Mise à jour des helpers lorsque la lumière change
    useEffect(() => {
        if (directionalLightRef.current && lightHelperRef.current) {
            lightHelperRef.current.update();
        }

        if (directionalLightRef.current && shadowCameraHelperRef.current) {
            shadowCameraHelperRef.current.update();
        }
    }, [directionalLightRef.current?.position, directionalLightRef.current?.rotation]);

    // Récupérer l'état du mode nuit sauvegardé lors de l'initialisation du composant
    useEffect(() => {
        const savedNightMode = getDebugConfigValue('lights.nightMode.value', false);
        setIsNightMode(savedNightMode);

        // Mettre à jour également la référence
        lightSettingsRef.current.isNightMode = savedNightMode;
        lightSettingsRef.current.needsUpdate = true;
    }, [getDebugConfigValue]);

    // Mettre à jour les valeurs de debug lorsque le mode jour/nuit change
    useEffect(() => {
        // Mettre à jour la référence aux paramètres d'éclairage
        lightSettingsRef.current.isNightMode = isNightMode;
        lightSettingsRef.current.needsUpdate = true;

        // Sauvegarder le paramètre
        // localStorage.setItem('lightSettings.isNightMode', String(isNightMode));

        if (debugLightValuesRef.current && debugLightValuesRef.current.controllers) {
            const currentConfig = isNightMode ? nightLightConfig : dayLightConfig;

            // Mettre à jour chaque contrôleur individuellement
            debugLightValuesRef.current.controllers.forEach(controller => {
                if (controller.property === 'activeMode') {
                    controller.object.activeMode = isNightMode ? "Night" : "Day";
                } else if (controller.property === 'posX') {
                    controller.object.posX = currentConfig.position[0];
                } else if (controller.property === 'posY') {
                    controller.object.posY = currentConfig.position[1];
                } else if (controller.property === 'posZ') {
                    controller.object.posZ = currentConfig.position[2];
                } else if (controller.property === 'intensity') {
                    controller.object.intensity = currentConfig.intensity;
                } else if (controller.property === 'color') {
                    controller.object.color = currentConfig.color;
                }

                // Mettre à jour l'affichage du contrôleur
                controller.updateDisplay();
            });
        }
    }, [isNightMode]);

    // Configuration du GUI de debug - IMPORTANT: n'initialiser qu'une seule fois
    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists and not already initialized
        if (debug?.active && debug?.showGui && gui && !guiInitializedRef.current) {
            console.log("Setting up lights debug UI");
            guiInitializedRef.current = true;

            // Create lights folder
            const lightsFolder = gui.addFolder(guiConfig.lights.folder);
            folderRef.current = lightsFolder;
            if (guiConfig.gui.closeFolders) {
                lightsFolder.close();
            }

            // Ajouter un contrôle pour les helpers
            const helpersParams = {
                showHelpers: debug?.showLightHelpers || false
            };

            const helpersControl = lightsFolder.add(helpersParams, 'showHelpers')
                .name('Show Light Helpers');

            helpersControl.onChange(value => {
                // Mettre à jour le state pour que d'autres composants puissent y accéder
                const currentDebug = useStore.getState().debug;
                useStore.getState().setDebug({
                    ...currentDebug,
                    showLightHelpers: value
                });

                // Mettre à jour la visibilité des helpers
                if (lightHelperRef.current) {
                    lightHelperRef.current.visible = value;
                }

                if (shadowCameraHelperRef.current) {
                    shadowCameraHelperRef.current.visible = value;
                }
            });

            // Ajouter un contrôle pour basculer entre jour et nuit
            const nightModeParams = {
                nightMode: isNightMode
            };

            const nightModeControl = lightsFolder.add(nightModeParams, 'nightMode')
                .name('Night Mode');

            nightModeControl.onChange(value => {
                setIsNightMode(value);
                updateDebugConfig('lights.nightMode.value', value);

                // Mettre à jour la référence pour appliquer les changements immédiatement
                lightSettingsRef.current.isNightMode = value;
                lightSettingsRef.current.needsUpdate = true;
                // saveLightSettings();
            });

            // Dossier pour afficher les valeurs actuelles
            const currentValuesFolder = lightsFolder.addFolder('Active Light Values');

            // Objet pour afficher les valeurs de lumière de jour et de nuit
            const lightValues = {
                activeMode: isNightMode ? "Night" : "Day",
                posX: isNightMode ? nightLightConfig.position[0] : dayLightConfig.position[0],
                posY: isNightMode ? nightLightConfig.position[1] : dayLightConfig.position[1],
                posZ: isNightMode ? nightLightConfig.position[2] : dayLightConfig.position[2],
                intensity: isNightMode ? nightLightConfig.intensity : dayLightConfig.intensity,
                color: isNightMode ? nightLightConfig.color : dayLightConfig.color,
            };

            // Ajouter les contrôles en lecture seule
            currentValuesFolder.add(lightValues, 'activeMode').name('Active Mode').listen();
            currentValuesFolder.add(lightValues, 'posX').name('Position X').listen();
            currentValuesFolder.add(lightValues, 'posY').name('Position Y').listen();
            currentValuesFolder.add(lightValues, 'posZ').name('Position Z').listen();
            currentValuesFolder.add(lightValues, 'intensity').name('Intensity').listen();
            currentValuesFolder.addColor(lightValues, 'color').name('Color').listen();

            debugLightValuesRef.current = currentValuesFolder;

            // Dossier pour modifier les valeurs de jour/nuit
            const dayNightSettingsFolder = lightsFolder.addFolder('Day/Night Settings');

            // Paramètres pour la lumière de jour
            const daySettingsFolder = dayNightSettingsFolder.addFolder('Day Light');

            // Créer un objet avec les valeurs de la configuration jour
            const daySettings = {
                intensity: dayLightConfig.intensity,
                color: dayLightConfig.color,
                posX: dayLightConfig.position[0],
                posY: dayLightConfig.position[1],
                posZ: dayLightConfig.position[2]
            };

            // Ajouter les contrôleurs
            // Modifier les contrôleurs pour le mode jour pour qu'ils mettent également à jour la lumière active
            daySettingsFolder.add(daySettings, 'intensity', 0, 100000).name('Intensity').onChange(value => {
                // Mettre à jour la configuration
                lightSettingsRef.current.day.intensity = value;
                lightSettingsRef.current.needsUpdate = true;

                // Sauvegarder le paramètre
                localStorage.setItem('lightSettings.day.intensity', String(value));

                // Mettre à jour les valeurs d'affichage
                if (!isNightMode) {
                    lightValues.intensity = value;
                }

                // Mettre à jour la configuration de debug aussi
                updateDebugConfig('lights.dayLight.intensity', value);
            });

            daySettingsFolder.addColor(daySettings, 'color').name('Color').onChange(value => {
                // Mettre à jour la configuration
                lightSettingsRef.current.day.color = value;
                lightSettingsRef.current.needsUpdate = true;

                // Sauvegarder le paramètre
                localStorage.setItem('lightSettings.day.color', value);

                // Mettre à jour les valeurs d'affichage
                if (!isNightMode) {
                    lightValues.color = value;
                }

                // Mettre à jour la configuration de debug aussi
                updateDebugConfig('lights.dayLight.color', value);
            });

            // daySettingsFolder.add(daySettings, 'posX', -200, 200).name('Position X').onChange(value => {
            //     // Mettre à jour la configuration
            //     lightSettingsRef.current.day.position[0] = value;
            //     lightSettingsRef.current.needsUpdate = true;
            //
            //     // Sauvegarder le paramètre
            //     localStorage.setItem('lightSettings.day.position', JSON.stringify(lightSettingsRef.current.day.position));
            //
            //     // Mettre à jour les valeurs d'affichage
            //     if (!isNightMode) {
            //         lightValues.posX = value;
            //     }
            //
            //     // Mettre à jour la configuration de debug aussi
            //     updateDebugConfig('lights.dayLight.position.x', value);
            // });
            //
            // daySettingsFolder.add(daySettings, 'posY', -200, 200).name('Position Y').onChange(value => {
            //     // Mettre à jour la configuration
            //     lightSettingsRef.current.day.position[1] = value;
            //     lightSettingsRef.current.needsUpdate = true;
            //
            //     // Sauvegarder le paramètre
            //     localStorage.setItem('lightSettings.day.position', JSON.stringify(lightSettingsRef.current.day.position));
            //
            //     // Mettre à jour les valeurs d'affichage
            //     if (!isNightMode) {
            //         lightValues.posY = value;
            //     }
            //
            //     // Mettre à jour la configuration de debug aussi
            //     updateDebugConfig('lights.dayLight.position.y', value);
            // });
            //
            // daySettingsFolder.add(daySettings, 'posZ', -200, 200).name('Position Z').onChange(value => {
            //     // Mettre à jour la configuration
            //     lightSettingsRef.current.day.position[2] = value;
            //     lightSettingsRef.current.needsUpdate = true;
            //
            //     // Sauvegarder le paramètre
            //     localStorage.setItem('lightSettings.day.position', JSON.stringify(lightSettingsRef.current.day.position));
            //
            //     // Mettre à jour les valeurs d'affichage
            //     if (!isNightMode) {
            //         lightValues.posZ = value;
            //     }
            //
            //     // Mettre à jour la configuration de debug aussi
            //     updateDebugConfig('lights.dayLight.position.z', value);
            // });

            // Paramètres pour la lumière de nuit
            const nightSettingsFolder = dayNightSettingsFolder.addFolder('Night Light');

            // Créer un objet avec les valeurs de la configuration nuit
            const nightSettings = {
                intensity: nightLightConfig.intensity,
                color: nightLightConfig.color,
                posX: nightLightConfig.position[0],
                posY: nightLightConfig.position[1],
                posZ: nightLightConfig.position[2]
            };

            // Ajouter les contrôleurs pour le mode nuit de la même façon
            nightSettingsFolder.add(nightSettings, 'intensity', 0, 100000).name('Intensity').onChange(value => {
                // Mettre à jour la configuration
                lightSettingsRef.current.night.intensity = value;
                lightSettingsRef.current.needsUpdate = true;

                // Sauvegarder le paramètre
                // localStorage.setItem('lightSettings.night.intensity', String(value));

                // Mettre à jour les valeurs d'affichage
                if (isNightMode) {
                    lightValues.intensity = value;
                }

                // Mettre à jour la configuration de debug aussi
                updateDebugConfig('lights.nightLight.intensity', value);
            });

            nightSettingsFolder.addColor(nightSettings, 'color').name('Color').onChange(value => {
                // Mettre à jour la configuration
                lightSettingsRef.current.night.color = value;
                lightSettingsRef.current.needsUpdate = true;

                // Sauvegarder le paramètre
                // localStorage.setItem('lightSettings.night.color', value);

                // Mettre à jour les valeurs d'affichage
                if (isNightMode) {
                    lightValues.color = value;
                }

                // Mettre à jour la configuration de debug aussi
                updateDebugConfig('lights.nightLight.color', value);
            });

            // nightSettingsFolder.add(nightSettings, 'posX', -200, 200).name('Position X').onChange(value => {
            //     // Mettre à jour la configuration
            //     lightSettingsRef.current.night.position[0] = value;
            //     lightSettingsRef.current.needsUpdate = true;
            //
            //     // Sauvegarder le paramètre
            //     localStorage.setItem('lightSettings.night.position', JSON.stringify(lightSettingsRef.current.night.position));
            //
            //     // Mettre à jour les valeurs d'affichage
            //     if (isNightMode) {
            //         lightValues.posX = value;
            //     }
            //
            //     // Mettre à jour la configuration de debug aussi
            //     updateDebugConfig('lights.nightLight.position.x', value);
            // });
            //
            // nightSettingsFolder.add(nightSettings, 'posY', -200, 200).name('Position Y').onChange(value => {
            //     // Mettre à jour la configuration
            //     lightSettingsRef.current.night.position[1] = value;
            //     lightSettingsRef.current.needsUpdate = true;
            //
            //     // Sauvegarder le paramètre
            //     localStorage.setItem('lightSettings.night.position', JSON.stringify(lightSettingsRef.current.night.position));
            //
            //     // Mettre à jour les valeurs d'affichage
            //     if (isNightMode) {
            //         lightValues.posY = value;
            //     }
            //
            //     // Mettre à jour la configuration de debug aussi
            //     updateDebugConfig('lights.nightLight.position.y', value);
            // });
            //
            // nightSettingsFolder.add(nightSettings, 'posZ', -200, 200).name('Position Z').onChange(value => {
            //     // Mettre à jour la configuration
            //     lightSettingsRef.current.night.position[2] = value;
            //     lightSettingsRef.current.needsUpdate = true;
            //
            //     // Sauvegarder le paramètre
            //     localStorage.setItem('lightSettings.night.position', JSON.stringify(lightSettingsRef.current.night.position));
            //
            //     // Mettre à jour les valeurs d'affichage
            //     if (isNightMode) {
            //         lightValues.posZ = value;
            //     }
            //
            //     // Mettre à jour la configuration de debug aussi
            //     updateDebugConfig('lights.nightLight.position.z', value);
            // });

            // Pour le reste des éléments GUI courants, trouver les lumières dans la scène
            const lights = [];
            scene.traverse((object) => {
                if (object.isLight) {
                    lights.push(object);
                }
            });

            console.log("Found lights:", lights);

            // Create a subfolder for each light
            const ambientLights = [];
            scene.traverse((object) => {
                if (object.isAmbientLight) {
                    ambientLights.push(object);
                }
            });

            console.log("Found ambient lights:", ambientLights);

// Create a subfolder only for ambient lights
            ambientLights.forEach((light, index) => {
                const lightType = "Ambient"; // Force le type à "Ambient"
                const lightFolder = lightsFolder.addFolder(`${lightType} ${index + 1}`);

                // Le reste du code reste identique mais n'affiche que les contrôles pertinents pour les lumières ambiantes
                if (guiConfig.gui.closeFolders) {
                    lightFolder.close();
                }

                // Chemin de base pour les valeurs par défaut
                const basePath = `lights.defaults.${lightType}.${index}`;

                // Get saved light values or use defaults from config
                const savedVisible = getDebugConfigValue(`lights.${lightType}.${index}.visible`,
                    getDefaultValue(`${basePath}.visible`, light.visible));
                const savedIntensity = getDebugConfigValue(`lights.${lightType}.${index}.intensity`,
                    getDefaultValue(`${basePath}.intensity`, light.intensity));
                const savedColor = getDebugConfigValue(`lights.${lightType}.${index}.color`,
                    getDefaultValue(`${basePath}.color`, '#' + light.color.getHexString()));

                // Apply saved values
                light.visible = savedVisible;
                light.intensity = savedIntensity;
                light.color.set(savedColor);

                // Common light properties
                const visibleControl = lightFolder.add(light, 'visible')
                    .name(guiConfig.lights.common.visible.name);

                visibleControl.onChange(value => {
                    updateDebugConfig(`lights.${lightType}.${index}.visible`, value);
                    gl.render(scene, camera);
                });

                const intensityControl = lightFolder.add(
                    light,
                    'intensity',
                    guiConfig.lights.common.intensity.min,
                    guiConfig.lights.common.intensity.max,
                    guiConfig.lights.common.intensity.step
                ).name(guiConfig.lights.common.intensity.name);

                intensityControl.onChange(value => {
                    updateDebugConfig(`lights.${lightType}.${index}.intensity`, value);
                    gl.render(scene, camera);
                });

                // Color control
                const lightParams = {
                    color: savedColor
                };

                const colorControl = lightFolder.addColor(lightParams, 'color')
                    .name(guiConfig.lights.common.color.name);

                colorControl.onChange(value => {
                    light.color.set(value);
                    updateDebugConfig(`lights.${lightType}.${index}.color`, value);
                    gl.render(scene, camera);
                });
            });
        }
        return () => {
            if (folderRef.current && gui) {
                folderRef.current = null;
            }
            if (debugLightValuesRef.current && gui) {
                debugLightValuesRef.current = null;
            }
        };
    }, [debug?.active, debug?.showGui, gui, scene, isNightMode, gl, camera]);

    // Mettre à jour l'état du contrôleur de mode nuit quand isNightMode change
    useEffect(() => {
        if (gui && folderRef.current) {
            // Chercher le contrôleur nightMode dans les contrôleurs du dossier
            const nightModeController = folderRef.current.controllers.find(
                controller => controller.property === 'nightMode'
            );

            // Si on trouve le contrôleur et que sa valeur ne correspond pas à l'état actuel
            if (nightModeController && nightModeController.object.nightMode !== isNightMode) {
                // Mettre à jour l'objet du contrôleur silencieusement (sans déclencher onChange)
                nightModeController.object.nightMode = isNightMode;
                // Forcer la mise à jour de l'affichage du contrôleur
                nightModeController.updateDisplay();
            }

            // Mettre à jour les valeurs actuelles dans le dossier d'affichage
            if (debugLightValuesRef.current) {
                const config = isNightMode ? nightLightConfig : dayLightConfig;
                const controllers = debugLightValuesRef.current.controllers;

                // Mettre à jour chaque contrôleur
                controllers.forEach(controller => {
                    if (controller.property === 'activeMode') {
                        controller.object.activeMode = isNightMode ? "Night" : "Day";
                    } else if (controller.property === 'posX') {
                        controller.object.posX = config.position[0];
                    } else if (controller.property === 'posY') {
                        controller.object.posY = config.position[1];
                    } else if (controller.property === 'posZ') {
                        controller.object.posZ = config.position[2];
                    } else if (controller.property === 'intensity') {
                        controller.object.intensity = config.intensity;
                    } else if (controller.property === 'color') {
                        controller.object.color = config.color;
                    }
                    controller.updateDisplay();
                });
            }
        }
    }, [isNightMode, gui]);

    return (
        <>
            <ambientLight intensity={isNightMode ? 0.1 : 0.2} /> {/* Lumière ambiante plus faible la nuit */}

            {/* Lumière conditionnelle basée sur le mode jour/nuit */}
            {!isNightMode ? (
                // Lumière de jour
                <pointLight
                    ref={directionalLightRef}
                    position={dayLightConfig.position}
                    intensity={dayLightConfig.intensity}
                    color={dayLightConfig.color}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-bias={-0.0005}
                />
            ) : (
                // Lumière de nuit
                <pointLight
                    ref={directionalLightRef}
                    position={nightLightConfig.position}
                    intensity={nightLightConfig.intensity}
                    color={nightLightConfig.color}
                    castShadow
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                    shadow-bias={-0.0005}
                />
            )}
        </>
    );
}