import {useEffect, useRef, useState} from 'react';
import {useThree, useFrame} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {getDefaultValue, initializeLight} from '../Utils/defaultValues';
import {DirectionalLight, DirectionalLightHelper, CameraHelper} from "three";

import * as THREE from 'three';

// Configuration centralisée des lumières directement depuis Lights.jsx
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
            ambientColor: "#333366", // Couleur ambiante bleue pour la nuit
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

    // Récupérer la position de défilement et la longueur totale depuis le store
    const timelinePosition = useStore(state => state.timelinePosition);
    const sequenceLength = useStore(state => state.sequenceLength);

    // Calculer le facteur de transition (0 = jour, 1 = nuit)
    const [transitionFactor, setTransitionFactor] = useState(0);

    // Référence aux paramètres d'éclairage actuels - avec l'ajout du mode interpolé
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
        // Nouvel objet pour stocker les valeurs d'interpolation courantes
        current: {
            position: [53.764, 31.716, -56.134], // Valeur initiale en mode jour
            intensity: 13000,                     // Valeur initiale en mode jour
            color: "#FFEAC6",                     // Valeur initiale en mode jour
            ambientIntensity: 0.2,                // Valeur initiale en mode jour
            ambientColor: "#FFFFFF"               // Valeur initiale en mode jour
        },
        needsUpdate: true,
        // Paramètres pour les ombres
        shadowMapSize: Number(guiConfig.renderer.shadowMap.mapSize.default),
        shadowBias: Number(guiConfig.renderer.shadowMap.bias.default),
        shadowNormalBias: Number(guiConfig.renderer.shadowMap.normalBias.default)
    });

    // Mise à jour du facteur de transition en fonction de la position du scroll
    useEffect(() => {
        if (sequenceLength > 0) {
            const startTransition = sequenceLength * 0.3;
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
    }, [timelinePosition, sequenceLength]);

    // Mise à jour des valeurs d'éclairage en fonction du facteur de transition
    useEffect(() => {
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

        // Marquer que les lumières doivent être mises à jour
        lightSettingsRef.current.needsUpdate = true;

        console.log(`Transition jour/nuit: ${transitionFactor.toFixed(2)}`);

    }, [transitionFactor]);

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

    // Ajouter la lumière directionnelle à la scène et ses helpers
    useEffect(() => {
        // Créer la lumière directionnelle (soleil)
        if (!directionalLightRef.current) {
            const directionalLight = scene.children.find(
                (child) => child.isDirectionalLight && child.name === 'TopLeftLight'
            );

            if (!directionalLight) {
                console.log("Adding directional light to the scene");
                const newLight = new DirectionalLight('#FFE9C1', 7.5);

                // Utiliser les valeurs interpolées actuelles
                const current = lightSettingsRef.current.current;

                newLight.color.set(current.color);
                newLight.intensity = current.intensity;
                newLight.position.set(...current.position);

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

    // Configuration du GUI de debug - Ajout du contrôle du facteur de transition
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

            // Dossier pour afficher les valeurs actuelles
            const currentValuesFolder = lightsFolder.addFolder('Day/Night Transition');

            // Objet pour afficher les valeurs interpolées
            const transitionValues = {
                factor: transitionFactor
            };

            // Objets séparés pour chaque propriété à suivre
            const posXObj = { posX: lightSettingsRef.current.current.position[0] };
            const posYObj = { posY: lightSettingsRef.current.current.position[1] };
            const posZObj = { posZ: lightSettingsRef.current.current.position[2] };
            const intensityObj = { intensity: lightSettingsRef.current.current.intensity };
            const colorObj = { color: lightSettingsRef.current.current.color };
            const ambientIntensityObj = { ambientIntensity: lightSettingsRef.current.current.ambientIntensity };
            const ambientColorObj = { ambientColor: lightSettingsRef.current.current.ambientColor };

            // Ajouter les contrôles
            currentValuesFolder.add(transitionValues, 'factor', 0, 1)
                .name('Jour (0) → Nuit (1)')
                .listen()
                .onChange(value => {
                    // Permettre de manipuler manuellement la transition en mode debug
                    setTransitionFactor(value);
                });

            currentValuesFolder.add(posXObj, 'posX').name('Position X').listen();
            currentValuesFolder.add(posYObj, 'posY').name('Position Y').listen();
            currentValuesFolder.add(posZObj, 'posZ').name('Position Z').listen();
            currentValuesFolder.add(intensityObj, 'intensity').name('Intensity').listen();
            currentValuesFolder.addColor(colorObj, 'color').name('Color').listen();
            currentValuesFolder.add(ambientIntensityObj, 'ambientIntensity').name('Ambient Intensity').listen();
            currentValuesFolder.addColor(ambientColorObj, 'ambientColor').name('Ambient Color').listen();

            debugLightValuesRef.current = {
                folder: currentValuesFolder,
                objects: {
                    transitionValues,
                    posXObj,
                    posYObj,
                    posZObj,
                    intensityObj,
                    colorObj,
                    ambientIntensityObj,
                    ambientColorObj
                }
            };
        }

        return () => {
            if (folderRef.current && gui) {
                folderRef.current = null;
            }
            if (debugLightValuesRef.current && gui) {
                debugLightValuesRef.current = null;
            }
        };
    }, [debug?.active, debug?.showGui, gui, scene]);

    // Effet séparé pour mettre à jour l'interface de debug
    useEffect(() => {
        // Mettre à jour l'interface de debug quand le facteur de transition change
        if (debugLightValuesRef.current && debugLightValuesRef.current.objects) {
            const current = lightSettingsRef.current.current;
            const objects = debugLightValuesRef.current.objects;

            // Mettre à jour chaque valeur
            objects.transitionValues.factor = transitionFactor;
            objects.posXObj.posX = current.position[0];
            objects.posYObj.posY = current.position[1];
            objects.posZObj.posZ = current.position[2];
            objects.intensityObj.intensity = current.intensity;
            objects.colorObj.color = current.color;
            objects.ambientIntensityObj.ambientIntensity = current.ambientIntensity;
            objects.ambientColorObj.ambientColor = current.ambientColor;
        }
    }, [transitionFactor]);

    return (
        <>
            {/* Lumière ambiante qui s'adapte au facteur jour/nuit */}
            <ambientLight
                ref={ambientLightRef}
                intensity={lightSettingsRef.current.current.ambientIntensity}
                color={lightSettingsRef.current.current.ambientColor}
            />

            {/* Lumière directionnelle qui s'adapte au facteur jour/nuit */}
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