import {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
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
            type: THREE.CineonToneMapping,
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
    const {scene} = useThree();
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const folderRef = useRef(null);
    const debugLightValuesRef = useRef(null);
    const directionalLightRef = useRef();
    const lightHelperRef = useRef();
    const shadowCameraHelperRef = useRef();
    const guiInitializedRef = useRef(false);
    const [isNightMode, setIsNightMode] = useState(false);

    // Configuration des données pour l'éclairage jour/nuit
    const dayLightConfig = {
        position: [53.764, 31.716, -56.134],
        intensity: 13000,
        color: "#FFEAC6"
    };

    const nightLightConfig = {
        position: [171.443, 32.282, -81.040],
        intensity: 20870.28 * 2,
        color: "#B4B5FF"
    };

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
                newLight.position.set(-20, 30, 20); // Position plus élevée et décalée
                newLight.castShadow = true;
                newLight.shadow.mapSize.width = 2048; // Augmenter la résolution
                newLight.shadow.mapSize.height = 2048;
                newLight.shadow.bias = -0.0005; // Ajuster le bias pour éviter les artefacts
                newLight.shadow.camera.near = 0.1;
                newLight.shadow.camera.far = 200; // Augmenter la distance

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
    }, [getDebugConfigValue]);

    // Mettre à jour les valeurs de debug lorsque le mode jour/nuit change
    useEffect(() => {
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
                dayLightConfig.intensity = value;
                updateDebugConfig('lights.dayLight.intensity', value);

                // Si nous sommes en mode jour, mettre à jour directement la lumière active
                if (!isNightMode && directionalLightRef.current) {
                    directionalLightRef.current.intensity = value;
                }

                if (!isNightMode) {
                    lightValues.intensity = value;
                }
            });

            daySettingsFolder.addColor(daySettings, 'color').name('Color').onChange(value => {
                dayLightConfig.color = value;
                updateDebugConfig('lights.dayLight.color', value);

                // Si nous sommes en mode jour, mettre à jour directement la lumière active
                if (!isNightMode && directionalLightRef.current) {
                    directionalLightRef.current.color.set(value);
                }

                if (!isNightMode) {
                    lightValues.color = value;
                }
            });

            // daySettingsFolder.add(daySettings, 'posX', -200, 200).name('Position X').onChange(value => {
            //     dayLightConfig.position[0] = value;
            //     updateDebugConfig('lights.dayLight.position.x', value);
            //
            //     // Si nous sommes en mode jour, mettre à jour directement la lumière active
            //     if (!isNightMode && directionalLightRef.current) {
            //         directionalLightRef.current.position.x = value;
            //     }
            //
            //     if (!isNightMode) {
            //         lightValues.posX = value;
            //     }
            // });
            //
            // daySettingsFolder.add(daySettings, 'posY', -200, 200).name('Position Y').onChange(value => {
            //     dayLightConfig.position[1] = value;
            //     updateDebugConfig('lights.dayLight.position.y', value);
            //
            //     // Si nous sommes en mode jour, mettre à jour directement la lumière active
            //     if (!isNightMode && directionalLightRef.current) {
            //         directionalLightRef.current.position.y = value;
            //     }
            //
            //     if (!isNightMode) {
            //         lightValues.posY = value;
            //     }
            // });
            //
            // daySettingsFolder.add(daySettings, 'posZ', -200, 200).name('Position Z').onChange(value => {
            //     dayLightConfig.position[2] = value;
            //     updateDebugConfig('lights.dayLight.position.z', value);
            //
            //     // Si nous sommes en mode jour, mettre à jour directement la lumière active
            //     if (!isNightMode && directionalLightRef.current) {
            //         directionalLightRef.current.position.z = value;
            //     }
            //
            //     if (!isNightMode) {
            //         lightValues.posZ = value;
            //     }
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

            // Ajouter les contrôleurs


// Modifier les contrôleurs pour le mode nuit de la même façon
            nightSettingsFolder.add(nightSettings, 'intensity', 0, 100000).name('Intensity').onChange(value => {
                nightLightConfig.intensity = value;
                updateDebugConfig('lights.nightLight.intensity', value);

                // Si nous sommes en mode nuit, mettre à jour directement la lumière active
                if (isNightMode && directionalLightRef.current) {
                    directionalLightRef.current.intensity = value;
                }

                if (isNightMode) {
                    lightValues.intensity = value;
                }
            });

            nightSettingsFolder.addColor(nightSettings, 'color').name('Color').onChange(value => {
                nightLightConfig.color = value;
                updateDebugConfig('lights.nightLight.color', value);

                // Si nous sommes en mode nuit, mettre à jour directement la lumière active
                if (isNightMode && directionalLightRef.current) {
                    directionalLightRef.current.color.set(value);
                }

                if (isNightMode) {
                    lightValues.color = value;
                }
            });

            nightSettingsFolder.add(nightSettings, 'posX', -200, 200).name('Position X').onChange(value => {
                nightLightConfig.position[0] = value;
                updateDebugConfig('lights.nightLight.position.x', value);

                // Si nous sommes en mode nuit, mettre à jour directement la lumière active
                if (isNightMode && directionalLightRef.current) {
                    directionalLightRef.current.position.x = value;
                }

                if (isNightMode) {
                    lightValues.posX = value;
                }
            });

            nightSettingsFolder.add(nightSettings, 'posY', -200, 200).name('Position Y').onChange(value => {
                nightLightConfig.position[1] = value;
                updateDebugConfig('lights.nightLight.position.y', value);

                // Si nous sommes en mode nuit, mettre à jour directement la lumière active
                if (isNightMode && directionalLightRef.current) {
                    directionalLightRef.current.position.y = value;
                }

                if (isNightMode) {
                    lightValues.posY = value;
                }
            });

            nightSettingsFolder.add(nightSettings, 'posZ', -200, 200).name('Position Z').onChange(value => {
                nightLightConfig.position[2] = value;
                updateDebugConfig('lights.nightLight.position.z', value);

                // Si nous sommes en mode nuit, mettre à jour directement la lumière active
                if (isNightMode && directionalLightRef.current) {
                    directionalLightRef.current.position.z = value;
                }

                if (isNightMode) {
                    lightValues.posZ = value;
                }
            });
            // Pour le reste des éléments GUI courants, trouver les lumières dans la scène
            const lights = [];
            scene.traverse((object) => {
                if (object.isLight) {
                    lights.push(object);
                }
            });

            console.log("Found lights:", lights);

            // Create a subfolder for each light
            lights.forEach((light, index) => {
                const lightType = light.type.replace('Light', '');
                const lightFolder = lightsFolder.addFolder(`${lightType} ${index + 1}`);

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

                    // Mettre à jour la visibilité des helpers
                    if (light === directionalLightRef.current) {
                        if (lightHelperRef.current) {
                            lightHelperRef.current.visible = value && (debug?.showLightHelpers || false);
                        }

                        if (shadowCameraHelperRef.current) {
                            shadowCameraHelperRef.current.visible = value && (debug?.showLightHelpers || false);
                        }
                    }
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

                    // Mettre à jour le helper si nécessaire
                    if (light === directionalLightRef.current && lightHelperRef.current) {
                        lightHelperRef.current.update();
                    }
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

                    // Mettre à jour le helper si nécessaire
                    if (light === directionalLightRef.current && lightHelperRef.current) {
                        lightHelperRef.current.update();
                    }
                });

                // Position control if the light has a position
                if (light.position) {
                    // Get saved position values from defaults or current position
                    const savedPosX = getDebugConfigValue(`lights.${lightType}.${index}.position.x`,
                        getDefaultValue(`${basePath}.position.x`, light.position.x));
                    const savedPosY = getDebugConfigValue(`lights.${lightType}.${index}.position.y`,
                        getDefaultValue(`${basePath}.position.y`, light.position.y));
                    const savedPosZ = getDebugConfigValue(`lights.${lightType}.${index}.position.z`,
                        getDefaultValue(`${basePath}.position.z`, light.position.z));

                    // Apply saved position
                    light.position.set(savedPosX, savedPosY, savedPosZ);

                    const posFolder = lightFolder.addFolder(guiConfig.lights.position.folder);
                    if (guiConfig.gui.closeFolders) posFolder.close();

                    const posXControl = posFolder.add(
                        light.position,
                        'x',
                        guiConfig.lights.position.x.min,
                        guiConfig.lights.position.x.max,
                        guiConfig.lights.position.x.step
                    ).name(guiConfig.lights.position.x.name);

                    posXControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.position.x`, value);

                        // Mettre à jour les helpers si nécessaire
                        if (light === directionalLightRef.current) {
                            if (lightHelperRef.current) lightHelperRef.current.update();
                            if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                        }
                    });

                    const posYControl = posFolder.add(
                        light.position,
                        'y',
                        guiConfig.lights.position.y.min,
                        guiConfig.lights.position.y.max,
                        guiConfig.lights.position.y.step
                    ).name(guiConfig.lights.position.y.name);

                    posYControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.position.y`, value);

                        // Mettre à jour les helpers si nécessaire
                        if (light === directionalLightRef.current) {
                            if (lightHelperRef.current) lightHelperRef.current.update();
                            if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                        }
                    });

                    const posZControl = posFolder.add(
                        light.position,
                        'z',
                        guiConfig.lights.position.z.min,
                        guiConfig.lights.position.z.max,
                        guiConfig.lights.position.z.step
                    ).name(guiConfig.lights.position.z.name);

                    posZControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.position.z`, value);

                        // Mettre à jour les helpers si nécessaire
                        if (light === directionalLightRef.current) {
                            if (lightHelperRef.current) lightHelperRef.current.update();
                            if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                        }
                    });
                }

                // Ajout des contrôles de rotation pour les lumières directionnelles
                if (light.isDirectionalLight) {
                    const rotFolder = lightFolder.addFolder('Rotation');
                    if (guiConfig.gui.closeFolders) rotFolder.close();

                    // Obtenir ou initialiser les valeurs de rotation en degrés
                    const savedRotX = getDebugConfigValue(`lights.${lightType}.${index}.rotation.x`,
                        getDefaultValue(`${basePath}.rotation.x`, light.rotation.x * 180 / Math.PI));
                    const savedRotY = getDebugConfigValue(`lights.${lightType}.${index}.rotation.y`,
                        getDefaultValue(`${basePath}.rotation.y`, light.rotation.y * 180 / Math.PI));
                    const savedRotZ = getDebugConfigValue(`lights.${lightType}.${index}.rotation.z`,
                        getDefaultValue(`${basePath}.rotation.z`, light.rotation.z * 180 / Math.PI));

                    // Créer un objet pour stocker les valeurs en degrés pour l'interface
                    const rotationParams = {
                        x: savedRotX,
                        y: savedRotY,
                        z: savedRotZ
                    };

                    // Ajouter les contrôles de rotation
                    const rotXControl = rotFolder.add(
                        rotationParams,
                        'x',
                        -180,
                        180,
                        1
                    ).name('X (deg)');

                    rotXControl.onChange(value => {
                        light.rotation.x = value * Math.PI / 180;
                        updateDebugConfig(`lights.${lightType}.${index}.rotation.x`, value);

                        // Mettre à jour les helpers
                        if (light === directionalLightRef.current) {
                            if (lightHelperRef.current) lightHelperRef.current.update();
                            if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                        }
                    });

                    const rotYControl = rotFolder.add(
                        rotationParams,
                        'y',
                        -180,
                        180,
                        1
                    ).name('Y (deg)');

                    rotYControl.onChange(value => {
                        light.rotation.y = value * Math.PI / 180;
                        updateDebugConfig(`lights.${lightType}.${index}.rotation.y`, value);

                        // Mettre à jour les helpers
                        if (light === directionalLightRef.current) {
                            if (lightHelperRef.current) lightHelperRef.current.update();
                            if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                        }
                    });

                    const rotZControl = rotFolder.add(
                        rotationParams,
                        'z',
                        -180,
                        180,
                        1
                    ).name('Z (deg)');

                    rotZControl.onChange(value => {
                        light.rotation.z = value * Math.PI / 180;
                        updateDebugConfig(`lights.${lightType}.${index}.rotation.z`, value);

                        // Mettre à jour les helpers
                        if (light === directionalLightRef.current) {
                            if (lightHelperRef.current) lightHelperRef.current.update();
                            if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                        }
                    });
                }

                // Specific controls based on light type
                if (light.isDirectionalLight || light.isSpotLight) {
                    // Get saved shadow values from defaults
                    const savedCastShadow = getDebugConfigValue(`lights.${lightType}.${index}.castShadow`,
                        getDefaultValue(`${basePath}.castShadow`, light.castShadow));

                    // Apply saved shadow setting
                    light.castShadow = savedCastShadow;

                    // Add shadow controls
                    const shadowFolder = lightFolder.addFolder(guiConfig.lights.shadows.folder);
                    if (guiConfig.gui.closeFolders) shadowFolder.close();

                    const castShadowControl = shadowFolder.add(
                        light,
                        'castShadow'
                    ).name(guiConfig.lights.shadows.castShadow.name);

                    castShadowControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.castShadow`, value);

                        // Mettre à jour la visibilité du shadow camera helper
                        if (light === directionalLightRef.current && shadowCameraHelperRef.current) {
                            shadowCameraHelperRef.current.visible = value && (debug?.showLightHelpers || false);
                        }
                    });

                    if (light.shadow) {
                        // Get saved shadow details from defaults
                        const shadowBasePath = `${basePath}.shadow`;
                        const savedBias = getDebugConfigValue(`lights.${lightType}.${index}.shadow.bias`,
                            getDefaultValue(`${shadowBasePath}.bias`, light.shadow.bias));
                        const savedNormalBias = getDebugConfigValue(`lights.${lightType}.${index}.shadow.normalBias`,
                            getDefaultValue(`${shadowBasePath}.normalBias`, light.shadow.normalBias));
                        const savedRadius = getDebugConfigValue(`lights.${lightType}.${index}.shadow.radius`,
                            getDefaultValue(`${shadowBasePath}.radius`, light.shadow.radius));
                        const savedMapSize = getDebugConfigValue(`lights.${lightType}.${index}.shadow.mapSize`,
                            getDefaultValue(`${shadowBasePath}.mapSize`, light.shadow.mapSize.width));

                        // Apply saved shadow settings
                        light.shadow.bias = savedBias;
                        light.shadow.normalBias = savedNormalBias;
                        light.shadow.radius = savedRadius;
                        light.shadow.mapSize.set(savedMapSize, savedMapSize);

                        // Add shadow detail controls
                        const biasControl = shadowFolder.add(
                            light.shadow,
                            'bias',
                            guiConfig.lights.shadows.bias.min,
                            guiConfig.lights.shadows.bias.max,
                            guiConfig.lights.shadows.bias.step
                        ).name(guiConfig.lights.shadows.bias.name);

                        biasControl.onChange(value => {
                            updateDebugConfig(`lights.${lightType}.${index}.shadow.bias`, value);
                        });

                        const normalBiasControl = shadowFolder.add(
                            light.shadow,
                            'normalBias',
                            guiConfig.lights.shadows.normalBias.min,
                            guiConfig.lights.shadows.normalBias.max,
                            guiConfig.lights.shadows.normalBias.step
                        ).name(guiConfig.lights.shadows.normalBias.name);

                        normalBiasControl.onChange(value => {
                            updateDebugConfig(`lights.${lightType}.${index}.shadow.normalBias`, value);
                        });

                        const radiusControl = shadowFolder.add(
                            light.shadow,
                            'radius',
                            guiConfig.lights.shadows.radius.min,
                            guiConfig.lights.shadows.radius.max,
                            guiConfig.lights.shadows.radius.step
                        ).name(guiConfig.lights.shadows.radius.name);

                        radiusControl.onChange(value => {
                            updateDebugConfig(`lights.${lightType}.${index}.shadow.radius`, value);
                        });

                        // Shadow map size as a dropdown
                        const shadowParams = {
                            mapSize: savedMapSize
                        };

                        const mapSizeControl = shadowFolder.add(
                            shadowParams,
                            'mapSize',
                            guiConfig.lights.shadows.mapSizes.options
                        ).name(guiConfig.lights.shadows.mapSizes.name);

                        mapSizeControl.onChange(value => {
                            light.shadow.mapSize.set(value, value);
                            // Need to update the shadow map
                            light.shadow.map?.dispose();
                            light.shadow.map = null;
                            light.shadow.camera.updateProjectionMatrix();
                            light.shadow.needsUpdate = true;
                            updateDebugConfig(`lights.${lightType}.${index}.shadow.mapSize`, value);
                        });

                        // Ajouter des contrôles pour les paramètres de la caméra d'ombre
                        if (light.isDirectionalLight) {
                            const cameraFolder = shadowFolder.addFolder('Shadow Camera');
                            if (guiConfig.gui.closeFolders) cameraFolder.close();

                            // Récupérer les paramètres sauvegardés pour la caméra
                            const savedLeft = getDebugConfigValue(`lights.${lightType}.${index}.shadow.camera.left`,
                                getDefaultValue(`${shadowBasePath}.camera.left`, light.shadow.camera.left));
                            const savedRight = getDebugConfigValue(`lights.${lightType}.${index}.shadow.camera.right`,
                                getDefaultValue(`${shadowBasePath}.camera.right`, light.shadow.camera.right));
                            const savedTop = getDebugConfigValue(`lights.${lightType}.${index}.shadow.camera.top`,
                                getDefaultValue(`${shadowBasePath}.camera.top`, light.shadow.camera.top));
                            const savedBottom = getDebugConfigValue(`lights.${lightType}.${index}.shadow.camera.bottom`,
                                getDefaultValue(`${shadowBasePath}.camera.bottom`, light.shadow.camera.bottom));
                            const savedNear = getDebugConfigValue(`lights.${lightType}.${index}.shadow.camera.near`,
                                getDefaultValue(`${shadowBasePath}.camera.near`, light.shadow.camera.near));
                            const savedFar = getDebugConfigValue(`lights.${lightType}.${index}.shadow.camera.far`,
                                getDefaultValue(`${shadowBasePath}.camera.far`, light.shadow.camera.far));

                            // Appliquer les valeurs sauvegardées
                            light.shadow.camera.left = savedLeft;
                            light.shadow.camera.right = savedRight;
                            light.shadow.camera.top = savedTop;
                            light.shadow.camera.bottom = savedBottom;
                            light.shadow.camera.near = savedNear;
                            light.shadow.camera.far = savedFar;

                            // Ajouter contrôles pour le frustum de la caméra
                            const leftControl = cameraFolder.add(
                                light.shadow.camera,
                                'left',
                                -50,
                                0,
                                1
                            ).name('Left');

                            leftControl.onChange(value => {
                                updateDebugConfig(`lights.${lightType}.${index}.shadow.camera.left`, value);
                                light.shadow.camera.updateProjectionMatrix();
                                if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                            });

                            const rightControl = cameraFolder.add(
                                light.shadow.camera,
                                'right',
                                0,
                                50,
                                1
                            ).name('Right');

                            rightControl.onChange(value => {
                                updateDebugConfig(`lights.${lightType}.${index}.shadow.camera.right`, value);
                                light.shadow.camera.updateProjectionMatrix();
                                if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                            });

                            const topControl = cameraFolder.add(
                                light.shadow.camera,
                                'top',
                                0,
                                50,
                                1
                            ).name('Top');

                            topControl.onChange(value => {
                                updateDebugConfig(`lights.${lightType}.${index}.shadow.camera.top`, value);
                                light.shadow.camera.updateProjectionMatrix();
                                if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                            });

                            const bottomControl = cameraFolder.add(
                                light.shadow.camera,
                                'bottom',
                                -50,
                                0,
                                1
                            ).name('Bottom');

                            bottomControl.onChange(value => {
                                updateDebugConfig(`lights.${lightType}.${index}.shadow.camera.bottom`, value);
                                light.shadow.camera.updateProjectionMatrix();
                                if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                            });

                            const nearControl = cameraFolder.add(
                                light.shadow.camera,
                                'near',
                                0.1,
                                10,
                                0.1
                            ).name('Near');

                            nearControl.onChange(value => {
                                updateDebugConfig(`lights.${lightType}.${index}.shadow.camera.near`, value);
                                light.shadow.camera.updateProjectionMatrix();
                                if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                            });

                            const farControl = cameraFolder.add(
                                light.shadow.camera,
                                'far',
                                10,
                                200,
                                5
                            ).name('Far');

                            farControl.onChange(value => {
                                updateDebugConfig(`lights.${lightType}.${index}.shadow.camera.far`, value);
                                light.shadow.camera.updateProjectionMatrix();
                                if (shadowCameraHelperRef.current) shadowCameraHelperRef.current.update();
                            });
                        }
                    }
                }

                // Specific controls for different light types
                if (light.isSpotLight) {
                    const spotPath = `${basePath}`;
                    // Get saved spotlight values from defaults
                    const savedAngle = getDebugConfigValue(`lights.${lightType}.${index}.angle`,
                        getDefaultValue(`${spotPath}.angle`, light.angle));
                    const savedPenumbra = getDebugConfigValue(`lights.${lightType}.${index}.penumbra`,
                        getDefaultValue(`${spotPath}.penumbra`, light.penumbra));
                    const savedDecay = getDebugConfigValue(`lights.${lightType}.${index}.decay`,
                        getDefaultValue(`${spotPath}.decay`, light.decay));

                    // Apply saved values
                    light.angle = savedAngle;
                    light.penumbra = savedPenumbra;
                    light.decay = savedDecay;

                    // Add spotlight controls
                    const angleControl = lightFolder.add(
                        light,
                        'angle',
                        guiConfig.lights.spotLight.angle.min,
                        guiConfig.lights.spotLight.angle.max,
                        guiConfig.lights.spotLight.angle.step
                    ).name(guiConfig.lights.spotLight.angle.name);

                    angleControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.angle`, value);
                    });

                    const penumbraControl = lightFolder.add(
                        light,
                        'penumbra',
                        guiConfig.lights.spotLight.penumbra.min,
                        guiConfig.lights.spotLight.penumbra.max,
                        guiConfig.lights.spotLight.penumbra.step
                    ).name(guiConfig.lights.spotLight.penumbra.name);

                    penumbraControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.penumbra`, value);
                    });

                    const decayControl = lightFolder.add(
                        light,
                        'decay',
                        guiConfig.lights.spotLight.decay.min,
                        guiConfig.lights.spotLight.decay.max,
                        guiConfig.lights.spotLight.decay.step
                    ).name(guiConfig.lights.spotLight.decay.name);

                    decayControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.decay`, value);
                    });
                }

                if (light.isPointLight) {
                    const pointPath = `${basePath}`;
                    // Get saved pointlight values from defaults
                    const savedDecay = getDebugConfigValue(`lights.${lightType}.${index}.decay`,
                        getDefaultValue(`${pointPath}.decay`, light.decay));
                    // const savedDistance = getDebugConfigValue(`lights.${lightType}.${index}.distance`,
                    //     getDefaultValue(`${pointPath}.distance`, light.distance));

                    // Apply saved values
                    light.decay = savedDecay;
                    // light.distance = savedDistance;

                    // Add pointlight controls
                    const decayControl = lightFolder.add(
                        light,
                        'decay',
                        guiConfig.lights.pointLight.decay.min,
                        guiConfig.lights.pointLight.decay.max,
                        guiConfig.lights.pointLight.decay.step
                    ).name(guiConfig.lights.pointLight.decay.name);

                    decayControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.decay`, value);
                    });

                    const distanceControl = lightFolder.add(
                        light,
                        'distance',
                        guiConfig.lights.pointLight.distance.min,
                        guiConfig.lights.pointLight.distance.max,
                        guiConfig.lights.pointLight.distance.step
                    ).name(guiConfig.lights.pointLight.distance.name);

                    distanceControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.distance`, value);
                    });
                }

                if (light.isRectAreaLight) {
                    const rectPath = `${basePath}`;
                    // Get saved rectarealight values from defaults
                    const savedWidth = getDebugConfigValue(`lights.${lightType}.${index}.width`,
                        getDefaultValue(`${rectPath}.width`, light.width));
                    const savedHeight = getDebugConfigValue(`lights.${lightType}.${index}.height`,
                        getDefaultValue(`${rectPath}.height`, light.height));

                    // Apply saved values
                    light.width = savedWidth;
                    light.height = savedHeight;

                    // Add rectarealight controls
                    const widthControl = lightFolder.add(
                        light,
                        'width',
                        guiConfig.lights.rectAreaLight.width.min,
                        guiConfig.lights.rectAreaLight.width.max,
                        guiConfig.lights.rectAreaLight.width.step
                    ).name(guiConfig.lights.rectAreaLight.width.name);

                    widthControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.width`, value);
                    });

                    const heightControl = lightFolder.add(
                        light,
                        'height',
                        guiConfig.lights.rectAreaLight.height.min,
                        guiConfig.lights.rectAreaLight.height.max,
                        guiConfig.lights.rectAreaLight.height.step
                    ).name(guiConfig.lights.rectAreaLight.height.name);

                    heightControl.onChange(value => {
                        updateDebugConfig(`lights.${lightType}.${index}.height`, value);
                    });
                }
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
    }, [debug?.active, debug?.showGui, gui]);
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