import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {getDefaultValue, initializeLight} from '../Utils/defaultValues';
import {DirectionalLight, DirectionalLightHelper, CameraHelper} from "three";

export default function Lights() {
    const {scene} = useThree();
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const folderRef = useRef(null);
    const directionalLightRef = useRef();
    const lightHelperRef = useRef();
    const shadowCameraHelperRef = useRef();

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

    // Initialiser les lumières avec les valeurs par défaut du config au montage
    useEffect(() => {
        if (!debug?.active) {
            // Appliquer les valeurs par défaut uniquement si le mode debug n'est pas actif
            scene.traverse((object) => {
                if (object.isLight) {
                    const lightType = object.type.replace('Light', '');

                    // Trouver l'index de cette lumière
                    let index = 0;
                    let count = 0;
                    scene.traverse((obj) => {
                        if (obj.isLight && obj.type === object.type) {
                            if (obj === object) index = count;
                            count++;
                        }
                    });

                    // Initialiser avec les valeurs par défaut
                    initializeLight(object, lightType, index);
                }
            });
        }
    }, [scene, debug]);

    // Configuration du GUI de debug
    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists
        if (debug?.active && debug?.showGui && gui) {
            console.log("Setting up lights debug UI");

            // Create lights folder
            const lightsFolder = gui.addFolder(guiConfig.lights.folder);
            folderRef.current = lightsFolder;
            if (guiConfig.gui.closeFolders) {
                lightsFolder.close()
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

            // Find all lights in the scene
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
                    const savedDistance = getDebugConfigValue(`lights.${lightType}.${index}.distance`,
                        getDefaultValue(`${pointPath}.distance`, light.distance));

                    // Apply saved values
                    light.decay = savedDecay;
                    light.distance = savedDistance;

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

        // Cleanup function
        return () => {
            if (folderRef.current && gui) {
                folderRef.current = null;
            }
        };
    }, [debug, gui, scene, updateDebugConfig, getDebugConfigValue]);

    return (
        <>
            {/*<ambientLight intensity={0.3} /> /!* Lumière ambiante légère *!/*/}
            <directionalLight
                ref={directionalLightRef}
                position={[-20, 30, 20]}
                intensity={7.5}
                color="#FFE9C1"
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-bias={-0.0005}
            />
        </>
    );
}