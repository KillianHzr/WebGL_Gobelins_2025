// Mise à jour du fichier Lights.jsx pour implémenter l'interface GUI visible dans l'image
import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {DirectionalLight, DirectionalLightHelper, CameraHelper} from "three";
import * as THREE from 'three';

// Configuration centralisée des lumières
export const LightConfig = {
    modes: {
        day: {
            ambientIntensity: 1.0,
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
            position: LightConfig.modes.day.mainLight.position,
            intensity: LightConfig.modes.day.mainLight.intensity,
            color: LightConfig.modes.day.mainLight.color
        },
        night: {
            position: LightConfig.modes.night.mainLight.position,
            intensity: LightConfig.modes.night.mainLight.intensity,
            color: LightConfig.modes.night.mainLight.color
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
                    debug ? dayConfig.ambientIntensity : 1.0,
                    debug ? nightConfig.ambientIntensity : 1.0,
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
            if (transitionFactor > 0.7) {
                setActiveMode('Night');
            } else {
                setActiveMode('Day');
            }

            // Marquer que les lumières doivent être mises à jour
            lightSettingsRef.current.needsUpdate = true;
        }
    }, [transitionFactor, nightMode]);

    return (
        <>
            {/* Lumière ambiante */}
            <ambientLight
                ref={ambientLightRef}
                intensity={lightSettingsRef.current.current.ambientIntensity}
                color={lightSettingsRef.current.current.ambientColor}
            />
            {/*<spotLight*/}
            {/*    position={[-6, 1, 14]}*/}
            {/*    intensity={20.5}*/}
            {/*    angle={Math.PI / 4}*/}
            {/*    penumbra={0.5}*/}
            {/*    distance={15}*/}
            {/*    castShadow*/}
            {/*    shadow-bias={-0.001}*/}
            {/*    decay={1.5}*/}
            {/*    visible={true}*/}
            {/*/>*/}
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