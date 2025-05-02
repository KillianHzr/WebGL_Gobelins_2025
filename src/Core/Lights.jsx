// Mise à jour du fichier Lights.jsx pour implémenter l'interface GUI visible dans l'image
import {useEffect, useRef, useState} from 'react';
import {useThree, useFrame} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {DirectionalLight, DirectionalLightHelper, CameraHelper} from "three";
import * as THREE from 'three';

// Configuration centralisée des lumières
export const LightConfig = {
    modes: {
        day: {
            ambientIntensity: 0.2,
            ambientColor: "#FFFFFF",
            mainLight: {
                position: [53.764, 31.716, -56.134],
                intensity: 9000, // Ajusté selon l'image
                color: "#d6c0b3", // Ajusté selon l'image
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        },
        night: {
            ambientIntensity: 0.1,
            ambientColor: "#333366",
            mainLight: {
                position: [53.764, 31.716, -56.134], // Garde la même position
                intensity: 13100, // Ajusté selon l'image
                color: "#6a74fb", // Ajusté selon l'image
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        }
    },
    // Reste de la configuration inchangée...
};

export default function Lights() {
    const {scene, gl, camera} = useThree();
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const folderRef = useRef(null);
    const debugLightValuesRef = useRef(null);
    const directionalLightRef = useRef();
    const ambientLightRef = useRef();
    const lightHelperRef = useRef();
    const shadowCameraHelperRef = useRef();
    const guiInitializedRef = useRef(false);

    // État pour le mode nuit
    const [nightMode, setNightMode] = useState(false);

    // Récupérer la position de défilement et la longueur totale depuis le store
    const timelinePosition = useStore(state => state.timelinePosition);
    const sequenceLength = useStore(state => state.sequenceLength);

    // Calculer le facteur de transition (0 = jour, 1 = nuit)
    const [transitionFactor, setTransitionFactor] = useState(0);

    // Définir les valeurs actives
    const [activeMode, setActiveMode] = useState('Day');
    const [activeValues, setActiveValues] = useState({
        positionX: 53.764,
        positionY: 31.716,
        positionZ: -56.134,
        intensity: 9000,
        color: "#d6c0b3"
    });

    // Référence aux paramètres d'éclairage actuels
    const lightSettingsRef = useRef({
        day: {
            position: [53.764, 31.716, -56.134],
            intensity: 9000,
            color: "#d6c0b3"
        },
        night: {
            position: [53.764, 31.716, -56.134], // Même position pour jour/nuit
            intensity: 13100,
            color: "#6a74fb"
        },
        current: {
            position: [53.764, 31.716, -56.134],
            intensity: 9000,
            color: "#d6c0b3",
            ambientIntensity: 0.2,
            ambientColor: "#FFFFFF"
        },
        needsUpdate: true,
        shadowMapSize: Number(guiConfig.renderer.shadowMap.mapSize.default),
        shadowBias: Number(guiConfig.renderer.shadowMap.bias.default),
        shadowNormalBias: Number(guiConfig.renderer.shadowMap.normalBias.default)
    });

    // Gérer le changement de mode nuit
    useEffect(() => {
        if (nightMode) {
            // Appliquer directement les valeurs du mode nuit
            const nightConfig = LightConfig.modes.night;
            lightSettingsRef.current.current = {
                position: nightConfig.mainLight.position,
                intensity: nightConfig.mainLight.intensity,
                color: nightConfig.mainLight.color,
                ambientIntensity: nightConfig.ambientIntensity,
                ambientColor: nightConfig.ambientColor
            };

            // Mettre à jour l'état d'affichage actif
            setActiveMode('Night');
            setActiveValues({
                positionX: nightConfig.mainLight.position[0],
                positionY: nightConfig.mainLight.position[1],
                positionZ: nightConfig.mainLight.position[2],
                intensity: nightConfig.mainLight.intensity,
                color: nightConfig.mainLight.color
            });
        } else {
            // Appliquer directement les valeurs du mode jour
            const dayConfig = LightConfig.modes.day;
            lightSettingsRef.current.current = {
                position: dayConfig.mainLight.position,
                intensity: dayConfig.mainLight.intensity,
                color: dayConfig.mainLight.color,
                ambientIntensity: dayConfig.ambientIntensity,
                ambientColor: dayConfig.ambientColor
            };

            // Mettre à jour l'état d'affichage actif
            setActiveMode('Day');
            setActiveValues({
                positionX: dayConfig.mainLight.position[0],
                positionY: dayConfig.mainLight.position[1],
                positionZ: dayConfig.mainLight.position[2],
                intensity: dayConfig.mainLight.intensity,
                color: dayConfig.mainLight.color
            });
        }

        // Forcer une mise à jour des lumières
        lightSettingsRef.current.needsUpdate = true;

    }, [nightMode]);

    // Mise à jour du facteur de transition en fonction de la position du scroll
    // (Uniquement si le mode nuit automatique est activé)
    useEffect(() => {
        if (sequenceLength > 0 && !nightMode) {
            const startTransition = sequenceLength * 0.1;
            const endTransition = sequenceLength * 0.7;

            if (timelinePosition < startTransition) {
                setTransitionFactor(0); // Jour complet
            } else if (timelinePosition > endTransition) {
                setTransitionFactor(1); // Nuit complète
            } else {
                // Interpolation linéaire entre jour et nuit
                const normalizedPosition = (timelinePosition - startTransition) / (endTransition - startTransition);
                setTransitionFactor(normalizedPosition);
            }

            // Forcer une mise à jour des lumières
            lightSettingsRef.current.needsUpdate = true;
        }
    }, [timelinePosition, sequenceLength, nightMode]);

    // Mise à jour des valeurs d'éclairage en fonction du facteur de transition
    // (Uniquement si le mode nuit manuel n'est pas activé)
    useEffect(() => {
        if (!nightMode) {
            const dayConfig = LightConfig.modes.day;
            const nightConfig = LightConfig.modes.night;

            // Fonction pour interpoler linéairement entre deux valeurs
            const lerp = (start, end, factor) => start + (end - start) * factor;

            // Fonction pour interpoler entre deux couleurs
            const lerpColor = (startColor, endColor, factor) => {
                const startColor3 = new THREE.Color(startColor);
                const endColor3 = new THREE.Color(endColor);
                const resultColor = new THREE.Color();

                resultColor.r = lerp(startColor3.r, endColor3.r, factor);
                resultColor.g = lerp(startColor3.g, endColor3.g, factor);
                resultColor.b = lerp(startColor3.b, endColor3.b, factor);

                return '#' + resultColor.getHexString();
            };

            // Fonction pour interpoler entre deux positions
            const lerpPosition = (startPos, endPos, factor) => {
                return [
                    lerp(startPos[0], endPos[0], factor),
                    lerp(startPos[1], endPos[1], factor),
                    lerp(startPos[2], endPos[2], factor)
                ];
            };

            // Mise à jour des valeurs interpolées
            lightSettingsRef.current.current = {
                position: lerpPosition(
                    dayConfig.mainLight.position,
                    nightConfig.mainLight.position,
                    transitionFactor
                ),
                intensity: lerp(
                    dayConfig.mainLight.intensity,
                    nightConfig.mainLight.intensity,
                    transitionFactor
                ),
                color: lerpColor(
                    dayConfig.mainLight.color,
                    nightConfig.mainLight.color,
                    transitionFactor
                ),
                ambientIntensity: lerp(
                    dayConfig.ambientIntensity,
                    nightConfig.ambientIntensity,
                    transitionFactor
                ),
                ambientColor: lerpColor(
                    dayConfig.ambientColor || "#FFFFFF",
                    nightConfig.ambientColor || "#333366",
                    transitionFactor
                )
            };

            // Mettre à jour l'affichage des valeurs actives
            setActiveValues({
                positionX: lightSettingsRef.current.current.position[0],
                positionY: lightSettingsRef.current.current.position[1],
                positionZ: lightSettingsRef.current.current.position[2],
                intensity: lightSettingsRef.current.current.intensity,
                color: lightSettingsRef.current.current.color
            });

            // Mettre à jour le mode actif en fonction du facteur de transition
            if (transitionFactor > 0.5) {
                setActiveMode('Night');
            } else {
                setActiveMode('Day');
            }

            // Marquer que les lumières doivent être mises à jour
            lightSettingsRef.current.needsUpdate = true;
        }
    }, [transitionFactor, nightMode]);

    // useFrame pour appliquer les mises à jour d'éclairage en temps réel
    useFrame(() => {
        // Si des mises à jour sont nécessaires
        if (lightSettingsRef.current.needsUpdate) {
            lightSettingsRef.current.needsUpdate = false;

            // Appliquer les changements à la lumière directionnelle
            if (directionalLightRef.current) {
                const current = lightSettingsRef.current.current;

                // Mettre à jour l'intensité et la couleur
                directionalLightRef.current.intensity = current.intensity;
                directionalLightRef.current.color.set(current.color);

                // Mettre à jour la position
                directionalLightRef.current.position.set(
                    current.position[0],
                    current.position[1],
                    current.position[2]
                );

                // Mettre à jour les ombres
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

                // Mettre à jour la lumière ambiante si elle existe
                if (ambientLightRef.current) {
                    ambientLightRef.current.intensity = current.ambientIntensity;
                    ambientLightRef.current.color.set(current.ambientColor);
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

    // Effets et setup du directional light et des helpers (inchangés)...

    // Configuration du GUI de debug - Ajout de l'interface montrée dans l'image
    useEffect(() => {
        // Add debug controls if debug mode is active and GUI exists and not already initialized
        if (debug?.active && debug?.showGui && gui && !guiInitializedRef.current) {
            console.log("Setting up lights debug UI");
            guiInitializedRef.current = true;

            // Create lights folder
            const lightsFolder = gui.addFolder("Lights");
            folderRef.current = lightsFolder;

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

            // Ajouter le toggle Night Mode
            const nightModeParams = {
                nightMode: nightMode
            };

            const nightModeControl = lightsFolder.add(nightModeParams, 'nightMode')
                .name('Night Mode');

            nightModeControl.onChange(value => {
                setNightMode(value);
            });

            // Créer le dossier des valeurs actives
            const activeLightValuesFolder = lightsFolder.addFolder("Active Light Values");

            // Paramètres pour les valeurs actives
            const activeModeObj = { mode: activeMode };
            const posXObj = { value: activeValues.positionX };
            const posYObj = { value: activeValues.positionY };
            const posZObj = { value: activeValues.positionZ };
            const intensityObj = { value: activeValues.intensity };
            const colorObj = { value: activeValues.color };

            // Ajouter les contrôles en lecture seule
            activeLightValuesFolder.add(activeModeObj, 'mode')
                .name('Active Mode')
                .listen()
                .disable();

            activeLightValuesFolder.add(posXObj, 'value')
                .name('Position X')
                .listen()
                .disable();

            activeLightValuesFolder.add(posYObj, 'value')
                .name('Position Y')
                .listen()
                .disable();

            activeLightValuesFolder.add(posZObj, 'value')
                .name('Position Z')
                .listen()
                .disable();

            activeLightValuesFolder.add(intensityObj, 'value')
                .name('Intensity')
                .listen()
                .disable();

            activeLightValuesFolder.addColor(colorObj, 'value')
                .name('Color')
                .listen()
                .disable();

            // Dossier pour les paramètres jour/nuit
            const dayNightSettingsFolder = lightsFolder.addFolder("Day/Night Settings");

            // Créer le sous-dossier Day Light
            const dayLightFolder = dayNightSettingsFolder.addFolder("Day Light");

            // Paramètres pour le jour
            const dayLightParams = {
                intensity: LightConfig.modes.day.mainLight.intensity,
                color: LightConfig.modes.day.mainLight.color
            };

            // Contrôles pour le jour
            const dayIntensityControl = dayLightFolder.add(dayLightParams, 'intensity', 0, 20000)
                .name('Intensity');

            const dayColorControl = dayLightFolder.addColor(dayLightParams, 'color')
                .name('Color');

            // Gestionnaires d'événements pour mettre à jour les valeurs
            dayIntensityControl.onChange(value => {
                LightConfig.modes.day.mainLight.intensity = value;
                lightSettingsRef.current.day.intensity = value;

                if (!nightMode) {
                    // Forcer une mise à jour
                    lightSettingsRef.current.needsUpdate = true;
                }
            });

            dayColorControl.onChange(value => {
                LightConfig.modes.day.mainLight.color = value;
                lightSettingsRef.current.day.color = value;

                if (!nightMode) {
                    // Forcer une mise à jour
                    lightSettingsRef.current.needsUpdate = true;
                }
            });

            // Créer le sous-dossier Night Light
            const nightLightFolder = dayNightSettingsFolder.addFolder("Night Light");

            // Paramètres pour la nuit
            const nightLightParams = {
                intensity: LightConfig.modes.night.mainLight.intensity,
                color: LightConfig.modes.night.mainLight.color
            };

            // Contrôles pour la nuit
            const nightIntensityControl = nightLightFolder.add(nightLightParams, 'intensity', 0, 20000)
                .name('Intensity');

            const nightColorControl = nightLightFolder.addColor(nightLightParams, 'color')
                .name('Color');

            // Gestionnaires d'événements pour mettre à jour les valeurs
            nightIntensityControl.onChange(value => {
                LightConfig.modes.night.mainLight.intensity = value;
                lightSettingsRef.current.night.intensity = value;

                if (nightMode) {
                    // Forcer une mise à jour
                    lightSettingsRef.current.needsUpdate = true;
                }
            });

            nightColorControl.onChange(value => {
                LightConfig.modes.night.mainLight.color = value;
                lightSettingsRef.current.night.color = value;

                if (nightMode) {
                    // Forcer une mise à jour
                    lightSettingsRef.current.needsUpdate = true;
                }
            });

            // Ajouter un dossier pour la lumière ambiante
            const ambientLightFolder = lightsFolder.addFolder("Ambient 1");

            // Paramètres pour la lumière ambiante
            const ambientLightParams = {
                enabled: true,
                intensity: 0,
                color: "#ffffff"
            };

            // Contrôles pour la lumière ambiante
            ambientLightFolder.add(ambientLightParams, 'enabled')
                .name('Enabled')
                .onChange(value => {
                    if (ambientLightRef.current) {
                        ambientLightRef.current.visible = value;
                    }
                });

            ambientLightFolder.add(ambientLightParams, 'intensity', 0, 1, 0.01)
                .name('Intensity')
                .onChange(value => {
                    if (ambientLightRef.current) {
                        ambientLightRef.current.intensity = value;
                    }
                });

            ambientLightFolder.addColor(ambientLightParams, 'color')
                .name('Color')
                .onChange(value => {
                    if (ambientLightRef.current) {
                        ambientLightRef.current.color.set(value);
                    }
                });

            // Stocker les références pour la mise à jour
            debugLightValuesRef.current = {
                activeModeObj,
                posXObj,
                posYObj,
                posZObj,
                intensityObj,
                colorObj
            };
        }

        // Nettoyage lors du démontage
        return () => {
            if (folderRef.current && gui) {
                gui.removeFolder(folderRef.current);
                folderRef.current = null;
            }
            debugLightValuesRef.current = null;
        };
    }, [debug?.active, debug?.showGui, gui, scene, nightMode]);

    // Effet pour mettre à jour l'interface de debug lorsque les valeurs actives changent
    useEffect(() => {
        if (debugLightValuesRef.current) {
            debugLightValuesRef.current.activeModeObj.mode = activeMode;
            debugLightValuesRef.current.posXObj.value = activeValues.positionX;
            debugLightValuesRef.current.posYObj.value = activeValues.positionY;
            debugLightValuesRef.current.posZObj.value = activeValues.positionZ;
            debugLightValuesRef.current.intensityObj.value = activeValues.intensity;
            debugLightValuesRef.current.colorObj.value = activeValues.color;
        }
    }, [activeMode, activeValues]);

    return (
        <>
            {/* Lumière ambiante */}
            <ambientLight
                ref={ambientLightRef}
                intensity={lightSettingsRef.current.current.ambientIntensity}
                color={lightSettingsRef.current.current.ambientColor}
            />

            {/* Lumière principale (point light) */}
            <pointLight
                ref={directionalLightRef}
                position={lightSettingsRef.current.current.position}
                intensity={lightSettingsRef.current.current.intensity}
                color={lightSettingsRef.current.current.color}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-bias={-0.0005}
            />
        </>
    );
}