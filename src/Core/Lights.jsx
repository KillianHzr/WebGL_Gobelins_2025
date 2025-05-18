import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import * as THREE from "three";
import {EventBus} from "../Utils/EventEmitter.jsx";

// Configuration centralisée des lumières
export const LightConfig = {
    modes: {
        day: {
            ambientIntensity: 1.0,
            ambientColor: "#FFFFFF",
            mainLight: {
                position: [53.764, 31.716, -56.134],
                intensity: 9000,
                color: "#d6c0b3",
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        },
        night: {
            ambientIntensity: 0.1,
            ambientColor: "#333366",
            mainLight: {
                position: [53.764, 31.716, -56.134],
                intensity: 13100,
                color: "#6a74fb",
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        },
        // Ajout de nouveaux états intermédiaires pour une transition plus fluide
        transition1: { // 25% du parcours
            ambientIntensity: 0.7,
            ambientColor: "#FFF0D6",
            mainLight: {
                position: [53.764, 31.716, -56.134],
                intensity: 10000,
                color: "#e5b28e",
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        },
        transition2: { // 50% du parcours
            ambientIntensity: 0.4,
            ambientColor: "#B0C0E6",
            mainLight: {
                position: [53.764, 31.716, -56.134],
                intensity: 11500,
                color: "#a18ecd",
                shadowMapSize: 2048,
                shadowBias: -0.0005
            }
        }
    },
    // Paramètres de transition
    transitionThresholds: {
        startDayToTransition1: 0.15, // 15% du parcours
        startTransition1ToTransition2: 0.35, // 35% du parcours
        startTransition2ToNight: 0.60, // 60% du parcours
        completeNight: 0.80 // 80% du parcours
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

    // État pour le mode nuit forcé (override)
    const [forcedNightMode, setForcedNightMode] = useState(false);

    // État pour la position normalisée de la timeline
    const [normalizedPosition, setNormalizedPosition] = useState(0);

    // Facteur de transition (0 = jour, 1 = nuit)
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
        day: {...LightConfig.modes.day},
        transition1: {...LightConfig.modes.transition1},
        transition2: {...LightConfig.modes.transition2},
        night: {...LightConfig.modes.night},
        current: {
            position: LightConfig.modes.day.mainLight.position,
            intensity: LightConfig.modes.day.mainLight.intensity,
            color: LightConfig.modes.day.mainLight.color,
            ambientIntensity: LightConfig.modes.day.ambientIntensity,
            ambientColor: LightConfig.modes.day.ambientColor
        },
        needsUpdate: true,
        shadowMapSize: Number(guiConfig.renderer.shadowMap.mapSize.default),
        shadowBias: Number(guiConfig.renderer.shadowMap.bias.default),
        shadowNormalBias: Number(guiConfig.renderer.shadowMap.normalBias.default)
    });

    // État pour les lumières secondaires configurables via le debugger
    const [secondaryLights, setSecondaryLights] = useState({
        moonLight: {
            enabled: true,
            intensity: 2000,
            color: "#8eabff",
            position: [20, 40, 10]
        },
        secondaryLight: {
            enabled: true,
            intensity: 500,
            color: "#4287f5",
            position: [-30, 5, -20]
        }
    });

    // Écouter les événements provenant du debugger pour mettre à jour les configurations
    useEffect(() => {
        // Drapeau pour éviter les mises à jour en cascade
        let isProcessingUpdate = false;

        const handleLightConfigUpdate = (config) => {
            // Éviter les mises à jour en cascade
            if (isProcessingUpdate) return;
            isProcessingUpdate = true;

            // Mettre à jour la référence aux paramètres d'éclairage
            let modeChanged = false;

            if (config.forcedNightMode !== undefined) {
                // Si le mode est explicitement défini, le traiter en priorité
                if (forcedNightMode !== config.forcedNightMode) {
                    setForcedNightMode(config.forcedNightMode);
                    modeChanged = true;
                }
            }

            if (config.day) {
                lightSettingsRef.current.day = config.day;
            }

            if (config.night) {
                lightSettingsRef.current.night = config.night;
            }

            if (config.transition1) lightSettingsRef.current.transition1 = config.transition1;
            if (config.transition2) lightSettingsRef.current.transition2 = config.transition2;
            if (config.transitionThresholds) lightSettingsRef.current.transitionThresholds = config.transitionThresholds;

            // Si le mode a changé, mettre à jour en fonction du nouveau mode
            if (!modeChanged) {
                if (forcedNightMode) {
                    // En mode nuit forcé, mettre à jour directement avec les valeurs de nuit
                    const nightConfig = lightSettingsRef.current.night;
                    lightSettingsRef.current.current = {
                        position: nightConfig.mainLight.position,
                        intensity: nightConfig.mainLight.intensity,
                        color: nightConfig.mainLight.color,
                        ambientIntensity: nightConfig.ambientIntensity,
                        ambientColor: nightConfig.ambientColor
                    };

                    // Mettre à jour l'état d'affichage actif
                    setActiveMode('Night (Forced)');
                    setActiveValues({
                        positionX: nightConfig.mainLight.position[0],
                        positionY: nightConfig.mainLight.position[1],
                        positionZ: nightConfig.mainLight.position[2],
                        intensity: nightConfig.mainLight.intensity,
                        color: nightConfig.mainLight.color
                    });
                } else {
                    // Forcer une mise à jour basée sur la position actuelle
                    updateLightingBasedOnPosition(normalizedPosition);
                }
            }

            // Marquer que les lumières doivent être mises à jour
            lightSettingsRef.current.needsUpdate = true;

            // Réinitialiser le drapeau après un court délai
            setTimeout(() => {
                isProcessingUpdate = false;
            }, 50);
        };

        // Nouveaux gestionnaires pour les mises à jour d'ambiance spécifiques au mode
        const handleDayAmbientUpdate = (data) => {
            // Éviter les mises à jour en cascade
            if (isProcessingUpdate) return;
            isProcessingUpdate = true;

            // Mettre à jour uniquement les paramètres d'ambiance du jour
            const updatedDay = {...lightSettingsRef.current.day};
            if (data.ambientIntensity !== undefined) {
                updatedDay.ambientIntensity = data.ambientIntensity;
            }
            if (data.ambientColor !== undefined) {
                updatedDay.ambientColor = data.ambientColor;
            }
            lightSettingsRef.current.day = updatedDay;

            // Si nous sommes en mode jour ou si on force le mode jour, appliquer directement les changements
            if (!forcedNightMode || data.forceDay) {
                if (data.forceDay && forcedNightMode) {
                    setForcedNightMode(false);
                }

                if (data.ambientIntensity !== undefined) {
                    lightSettingsRef.current.current.ambientIntensity = data.ambientIntensity;
                }
                if (data.ambientColor !== undefined) {
                    lightSettingsRef.current.current.ambientColor = data.ambientColor;
                }
                lightSettingsRef.current.needsUpdate = true;
                // Forcer une mise à jour du composant
                setActiveMode(prev => prev === 'Day' ? 'Day (Updated)' : 'Day');
            }

            // Réinitialiser le drapeau après un court délai
            setTimeout(() => {
                isProcessingUpdate = false;
            }, 50);
        };

        const handleNightAmbientUpdate = (data) => {
            // Éviter les mises à jour en cascade
            if (isProcessingUpdate) return;
            isProcessingUpdate = true;

            // Mettre à jour uniquement les paramètres d'ambiance de la nuit
            const updatedNight = {...lightSettingsRef.current.night};
            if (data.ambientIntensity !== undefined) {
                updatedNight.ambientIntensity = data.ambientIntensity;
            }
            if (data.ambientColor !== undefined) {
                updatedNight.ambientColor = data.ambientColor;
            }
            lightSettingsRef.current.night = updatedNight;

            // Si nous sommes en mode nuit ou si on force le mode nuit, appliquer directement les changements
            if (forcedNightMode || data.forceNight) {
                if (data.forceNight && !forcedNightMode) {
                    setForcedNightMode(true);
                }

                if (data.ambientIntensity !== undefined) {
                    lightSettingsRef.current.current.ambientIntensity = data.ambientIntensity;
                }
                if (data.ambientColor !== undefined) {
                    lightSettingsRef.current.current.ambientColor = data.ambientColor;
                }
                lightSettingsRef.current.needsUpdate = true;
                // Forcer une mise à jour du composant
                setActiveMode(prev => prev === 'Night (Forced)' ? 'Night (Updated)' : 'Night (Forced)');
            }

            // Réinitialiser le drapeau après un court délai
            setTimeout(() => {
                isProcessingUpdate = false;
            }, 50);
        };

        const handleForcedNightMode = (data) => {
            setForcedNightMode(data.enabled);
        };

        // Gestion des lumières secondaires
        const handleSecondaryLightUpdate = (data) => {
            if (data.type === 'moon') {
                setSecondaryLights(prev => ({
                    ...prev,
                    moonLight: {
                        ...prev.moonLight,
                        ...data.settings
                    }
                }));
            } else if (data.type === 'secondary') {
                setSecondaryLights(prev => ({
                    ...prev,
                    secondaryLight: {
                        ...prev.secondaryLight,
                        ...data.settings
                    }
                }));
            }
        };

        // S'abonner aux événements
        const subscriptions = [
            EventBus.on('light-config-update', handleLightConfigUpdate),
            EventBus.on('day-ambient-update', handleDayAmbientUpdate),
            EventBus.on('night-ambient-update', handleNightAmbientUpdate),
            EventBus.on('forced-night-mode', handleForcedNightMode),
            EventBus.on('secondary-light-update', handleSecondaryLightUpdate)
        ];

        // Nettoyage
        return () => {
            subscriptions.forEach(unsubscribe => unsubscribe());
        };
    }, [normalizedPosition, forcedNightMode]);

    // Écouter l'événement de position normalisée de la timeline
    useEffect(() => {
        const handleTimelinePositionUpdate = (data) => {
            setNormalizedPosition(data.position);
        };

        // S'abonner à l'événement
        const subscription = EventBus.on('timeline-position-normalized', handleTimelinePositionUpdate);

        // Nettoyage
        return () => {
            subscription();
        };
    }, []);

    // Gérer le changement de mode nuit forcé
    useEffect(() => {
        if (forcedNightMode) {
            // Appliquer directement les valeurs du mode nuit
            const nightConfig = lightSettingsRef.current.night;
            lightSettingsRef.current.current = {
                position: nightConfig.mainLight.position,
                intensity: nightConfig.mainLight.intensity,
                color: nightConfig.mainLight.color,
                ambientIntensity: nightConfig.ambientIntensity,
                ambientColor: nightConfig.ambientColor
            };

            // Mettre à jour l'état d'affichage actif
            setActiveMode('Night (Forced)');
            setActiveValues({
                positionX: nightConfig.mainLight.position[0],
                positionY: nightConfig.mainLight.position[1],
                positionZ: nightConfig.mainLight.position[2],
                intensity: nightConfig.mainLight.intensity,
                color: nightConfig.mainLight.color
            });
        } else {
            // Forcer une mise à jour basée sur la position actuelle
            updateLightingBasedOnPosition(normalizedPosition);
        }

        // Forcer une mise à jour des lumières
        lightSettingsRef.current.needsUpdate = true;

        // Émission d'un événement pour mettre à jour le débugger
        EventBus.trigger('light-external-config-update', {
            forcedNightMode,
            normalizedPosition
        });
    }, [forcedNightMode]);

    // Fonction pour calculer le facteur de transition en fonction de la position normalisée
    // Cette fonction utilise une courbe plus naturelle avec plusieurs étapes
    const calculateTransitionFactor = (position) => {
        // Utiliser les seuils de transition qui peuvent être mis à jour via le debugger
        const {
            startDayToTransition1,
            startTransition1ToTransition2,
            startTransition2ToNight,
            completeNight
        } = lightSettingsRef.current.transitionThresholds || LightConfig.transitionThresholds;

        if (position < startDayToTransition1) {
            // Jour complet (0)
            return 0;
        } else if (position >= completeNight) {
            // Nuit complète (1)
            return 1;
        } else if (position >= startTransition2ToNight) {
            // Transition2 -> Nuit (0.66 -> 1.0)
            return 0.66 + 0.34 * (position - startTransition2ToNight) / (completeNight - startTransition2ToNight);
        } else if (position >= startTransition1ToTransition2) {
            // Transition1 -> Transition2 (0.33 -> 0.66)
            return 0.33 + 0.33 * (position - startTransition1ToTransition2) / (startTransition2ToNight - startTransition1ToTransition2);
        } else {
            // Jour -> Transition1 (0 -> 0.33)
            return 0.33 * (position - startDayToTransition1) / (startTransition1ToTransition2 - startDayToTransition1);
        }
    };

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

    // Fonction pour mettre à jour les paramètres d'éclairage en fonction du facteur de transition
    const updateLightingBasedOnPosition = (position) => {
        // Si le mode nuit est forcé, ne rien faire
        if (forcedNightMode) return;

        // Calculer le facteur de transition (0-1)
        const factor = calculateTransitionFactor(position);
        setTransitionFactor(factor);

        // Déterminer les modes à interpoler et le facteur local
        let startMode, endMode, localFactor;

        if (factor <= 0) {
            // Jour complet
            startMode = lightSettingsRef.current.day;
            endMode = lightSettingsRef.current.day;
            localFactor = 0;
            setActiveMode('Day');
        } else if (factor < 0.33) {
            // Jour -> Transition1
            startMode = lightSettingsRef.current.day;
            endMode = lightSettingsRef.current.transition1;
            localFactor = factor / 0.33;
            setActiveMode('Day → Sunset');
        } else if (factor < 0.66) {
            // Transition1 -> Transition2
            startMode = lightSettingsRef.current.transition1;
            endMode = lightSettingsRef.current.transition2;
            localFactor = (factor - 0.33) / 0.33;
            setActiveMode('Sunset → Dusk');
        } else if (factor < 1) {
            // Transition2 -> Nuit
            startMode = lightSettingsRef.current.transition2;
            endMode = lightSettingsRef.current.night;
            localFactor = (factor - 0.66) / 0.34;
            setActiveMode('Dusk → Night');
        } else {
            // Nuit complète
            startMode = lightSettingsRef.current.night;
            endMode = lightSettingsRef.current.night;
            localFactor = 1;
            setActiveMode('Night');
        }

        // Interpoler les valeurs
        lightSettingsRef.current.current = {
            position: lerpPosition(
                startMode.mainLight.position,
                endMode.mainLight.position,
                localFactor
            ),
            intensity: lerp(
                startMode.mainLight.intensity,
                endMode.mainLight.intensity,
                localFactor
            ),
            color: lerpColor(
                startMode.mainLight.color,
                endMode.mainLight.color,
                localFactor
            ),
            ambientIntensity: lerp(
                startMode.ambientIntensity,
                endMode.ambientIntensity,
                localFactor
            ),
            ambientColor: lerpColor(
                startMode.ambientColor,
                endMode.ambientColor,
                localFactor
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

        // Marquer que les lumières doivent être mises à jour
        lightSettingsRef.current.needsUpdate = true;
    };

    // Mettre à jour l'éclairage lorsque la position normalisée change
    useEffect(() => {
        updateLightingBasedOnPosition(normalizedPosition);
    }, [normalizedPosition]);

    // Lissage supplémentaire pour éviter les changements brusques
    const smoothedLightRef = useRef({
        position: lightSettingsRef.current.current.position,
        intensity: lightSettingsRef.current.current.intensity,
        color: lightSettingsRef.current.current.color,
        ambientIntensity: lightSettingsRef.current.current.ambientIntensity,
        ambientColor: lightSettingsRef.current.current.ambientColor
    });

    // Effet pour la mise à jour fluide des lumières avec animation
    useEffect(() => {
        let frameId;
        const smoothingFactor = 0.05; // Plus petit = transition plus lente

        const updateFrame = () => {
            // Récupérer les valeurs cibles actuelles
            const target = lightSettingsRef.current.current;
            const current = smoothedLightRef.current;

            // Interpoler vers les valeurs cibles
            current.intensity = lerp(current.intensity, target.intensity, smoothingFactor);
            current.ambientIntensity = lerp(current.ambientIntensity, target.ambientIntensity, smoothingFactor);

            // Interpoler les couleurs
            const targetColor = new THREE.Color(target.color);
            const currentColor = new THREE.Color(current.color);
            currentColor.r = lerp(currentColor.r, targetColor.r, smoothingFactor);
            currentColor.g = lerp(currentColor.g, targetColor.g, smoothingFactor);
            currentColor.b = lerp(currentColor.b, targetColor.b, smoothingFactor);
            current.color = '#' + currentColor.getHexString();

            const targetAmbientColor = new THREE.Color(target.ambientColor);
            const currentAmbientColor = new THREE.Color(current.ambientColor);
            currentAmbientColor.r = lerp(currentAmbientColor.r, targetAmbientColor.r, smoothingFactor);
            currentAmbientColor.g = lerp(currentAmbientColor.g, targetAmbientColor.g, smoothingFactor);
            currentAmbientColor.b = lerp(currentAmbientColor.b, targetAmbientColor.b, smoothingFactor);
            current.ambientColor = '#' + currentAmbientColor.getHexString();

            // Interpoler la position
            current.position = current.position.map((val, idx) =>
                lerp(val, target.position[idx], smoothingFactor)
            );

            // Mettre à jour les lumières
            if (directionalLightRef.current) {
                directionalLightRef.current.intensity = current.intensity;
                directionalLightRef.current.color.set(current.color);
                directionalLightRef.current.position.set(...current.position);
            }

            if (ambientLightRef.current) {
                ambientLightRef.current.intensity = current.ambientIntensity;
                ambientLightRef.current.color.set(current.ambientColor);
            }

            // Continuer la boucle d'animation
            frameId = requestAnimationFrame(updateFrame);
        };

        // Démarrer la boucle d'animation
        frameId = requestAnimationFrame(updateFrame);

        // Nettoyage
        return () => {
            cancelAnimationFrame(frameId);
        };
    }, []);

    return (
        <>
            {/* MODE JOUR - Visible uniquement quand nous ne sommes pas en mode nuit */}
            {!forcedNightMode && (
                <>
                    {/* Lumière ambiante jour - valeurs exactes */}
                    <ambientLight
                        ref={ambientLightRef}
                        intensity={lightSettingsRef.current.current.ambientIntensity}
                        color={lightSettingsRef.current.current.ambientColor}
                    />
                    {/* Lumière principale jour */}
                    <pointLight
                        ref={directionalLightRef}
                        position={smoothedLightRef.current.position}
                        intensity={smoothedLightRef.current.intensity}
                        color={smoothedLightRef.current.color}
                        castShadow
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                        shadow-bias={-0.0005}
                    />
                </>
            )}

            {/* MODE NUIT - Visible uniquement en mode nuit */}
            {forcedNightMode && (
                <>
                    {/* Lumière ambiante nuit - valeurs exactes */}
                    <ambientLight
                        intensity={lightSettingsRef.current.current.ambientIntensity}
                        color={lightSettingsRef.current.current.ambientColor}
                    />
                    {/* Lumière principale nuit */}
                    <pointLight
                        position={lightSettingsRef.current.current.position}
                        intensity={lightSettingsRef.current.current.intensity}
                        color={lightSettingsRef.current.current.color}
                        castShadow
                        shadow-mapSize-width={2048}
                        shadow-mapSize-height={2048}
                        shadow-bias={-0.0005}
                    />

                    {/* Lumières secondaires spécifiques au mode nuit */}
                    {secondaryLights.moonLight.enabled && (
                        <pointLight
                            position={secondaryLights.moonLight.position}
                            intensity={secondaryLights.moonLight.intensity}
                            color={secondaryLights.moonLight.color}
                            distance={100}
                        />
                    )}

                    {secondaryLights.secondaryLight.enabled && (
                        <pointLight
                            position={secondaryLights.secondaryLight.position}
                            intensity={secondaryLights.secondaryLight.intensity}
                            color={secondaryLights.secondaryLight.color}
                            distance={40}
                        />
                    )}
                </>
            )}
        </>
    );
}