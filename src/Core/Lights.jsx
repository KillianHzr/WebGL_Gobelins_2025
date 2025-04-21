import {useEffect, useRef} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {getDefaultValue, initializeLight} from '../Utils/defaultValues';

export default function Lights() {
    const {scene} = useThree();
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const folderRef = useRef(null);

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

    return null;
}