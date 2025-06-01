import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {DirectionalLight, DirectionalLightHelper, CameraHelper} from "three";
import * as THREE from 'three';
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

    // États pour la synchronisation
    const [cameraReady, setCameraReady] = useState(false);
    const [lightsInitialized, setLightsInitialized] = useState(false);

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
        day: LightConfig.modes.day,
        transition1: LightConfig.modes.transition1,
        transition2: LightConfig.modes.transition2,
        night: LightConfig.modes.night,
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

    // Référence pour les updates debounced
    const updateTimeoutRef = useRef(null);

    // Écouter l'initialisation de la caméra
    useEffect(() => {
        console.log('💡 Lights: Setting up camera initialization listener');

        const handleCameraInitialized = (data) => {
            console.log('💡 Lights: Camera initialized, starting lights system');
            setCameraReady(true);
        };

        // S'abonner à l'événement d'initialisation de la caméra
        const cameraInitSubscription = EventBus.on('camera-initialized', handleCameraInitialized);

        // Vérifier immédiatement si la caméra est déjà prête
        const immediateCheck = setTimeout(() => {
            if (!cameraReady) {
                console.log('💡 Lights: Checking if camera is already ready...');
                // Vérifier si l'état de la caméra dans le store indique qu'elle est prête
                const store = useStore.getState();
                if (store.cameraModel || camera) {
                    console.log('💡 Lights: Camera seems ready from store, proceeding');
                    setCameraReady(true);
                }
            }
        }, 2000);

        // Timeout de sécurité au cas où l'événement ne serait jamais déclenché
        const safetyTimeout = setTimeout(() => {
            if (!cameraReady) {
                console.warn('💡 Lights: Camera initialization timeout, starting lights anyway');
                setCameraReady(true);
            }
        }, 8000); // 8 secondes maximum

        return () => {
            if (typeof cameraInitSubscription === 'function') {
                cameraInitSubscription();
            }
            clearTimeout(safetyTimeout);
            clearTimeout(immediateCheck);
        };
    }, [cameraReady, camera]);

    // Initialiser le système d'éclairage une fois que la caméra est prête
    useEffect(() => {
        if (!cameraReady || lightsInitialized) return;

        console.log('💡 Initializing lights system...');

        // Marquer comme initialisé
        setLightsInitialized(true);

        // Notifier que le système d'éclairage est prêt
        EventBus.trigger('lights-initialized', {
            ready: true,
            currentMode: activeMode
        });

        console.log('💡 Lights system initialized and ready');
    }, [cameraReady, lightsInitialized, activeMode]);

    // ✅ CORRECTION: Écouter l'événement de position normalisée de la timeline avec priorité
    useEffect(() => {
        if (!lightsInitialized) return;

        const handleTimelinePositionUpdate = (data) => {
            if (!data || typeof data.position !== 'number') {
                console.warn('💡 Lights: Données de position invalides:', data);
                return;
            }

            // Debounce pour éviter les updates trop fréquents
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }

            updateTimeoutRef.current = setTimeout(() => {
                setNormalizedPosition(data.position);
            }, 5); // Délai de 5ms pour priorité 1 (après SkySphere)
        };

        console.log('💡 Lights: Setting up priority timeline position listener');
        const subscription = EventBus.on('timeline-position-normalized', handleTimelinePositionUpdate);

        // Debug check en développement
        if (process.env.NODE_ENV === 'development') {
            setTimeout(() => {
                const activeListeners = EventBus.getActiveListeners();
                const timelineListeners = activeListeners.filter(([id]) =>
                    id.includes('timeline-position-normalized')
                );
                if (timelineListeners.length > 2) {
                    console.warn('⚠️ Lights: Trop de listeners timeline détectés!', timelineListeners.length);
                }
            }, 100);
        }

        return () => {
            console.log('💡 Lights: Cleaning up timeline position listener');
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
            if (typeof subscription === 'function') {
                subscription();
            }
        };
    }, [lightsInitialized]); // ✅ Seule dépendance nécessaire

    // Gérer le changement de mode nuit forcé
    useEffect(() => {
        if (!lightsInitialized) return;

        if (forcedNightMode) {
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
    }, [forcedNightMode, lightsInitialized]);

    // Fonction pour calculer le facteur de transition en fonction de la position normalisée
    const calculateTransitionFactor = (position) => {
        const {
            startDayToTransition1,
            startTransition1ToTransition2,
            startTransition2ToNight,
            completeNight
        } = LightConfig.transitionThresholds;

        if (position < startDayToTransition1) {
            return 0;
        } else if (position >= completeNight) {
            return 1;
        } else if (position >= startTransition2ToNight) {
            return 0.66 + 0.34 * (position - startTransition2ToNight) / (completeNight - startTransition2ToNight);
        } else if (position >= startTransition1ToTransition2) {
            return 0.33 + 0.33 * (position - startTransition1ToTransition2) / (startTransition2ToNight - startTransition1ToTransition2);
        } else {
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
            startMode = LightConfig.modes.day;
            endMode = LightConfig.modes.day;
            localFactor = 0;
            setActiveMode('Day');
        } else if (factor < 0.33) {
            // Jour -> Transition1
            startMode = LightConfig.modes.day;
            endMode = LightConfig.modes.transition1;
            localFactor = factor / 0.33;
            setActiveMode('Day → Sunset');
        } else if (factor < 0.66) {
            // Transition1 -> Transition2
            startMode = LightConfig.modes.transition1;
            endMode = LightConfig.modes.transition2;
            localFactor = (factor - 0.33) / 0.33;
            setActiveMode('Sunset → Dusk');
        } else if (factor < 1) {
            // Transition2 -> Nuit
            startMode = LightConfig.modes.transition2;
            endMode = LightConfig.modes.night;
            localFactor = (factor - 0.66) / 0.34;
            setActiveMode('Dusk → Night');
        } else {
            // Nuit complète
            startMode = LightConfig.modes.night;
            endMode = LightConfig.modes.night;
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

    // ✅ CORRECTION: Mettre à jour l'éclairage lorsque la position normalisée change (avec debounce)
    useEffect(() => {
        if (!lightsInitialized) return;

        // Debounce pour éviter les updates trop fréquents
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        updateTimeoutRef.current = setTimeout(() => {
            updateLightingBasedOnPosition(normalizedPosition);
        }, 16); // ~60fps

        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
        };
    }, [normalizedPosition, lightsInitialized]); // ✅ Dependencies claires

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
        if (!lightsInitialized) return;

        let frameId;
        const smoothingFactor = 0.3; // Plus petit = transition plus lente

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
    }, [lightsInitialized]);

    // Ajouter cet useEffect dans Lights.jsx pour écouter les événements GUI
    useEffect(() => {
        if (!debug?.active || !lightsInitialized) return;

        console.log('💡 Lights: Setting up GUI event listeners');

        const subscriptions = [
            // Mode d'éclairage
            EventBus.on('lights-mode-changed', (data) => {
                console.log('💡 Lights mode changed:', data.mode);
                if (data.mode === 'auto') {
                    setForcedNightMode(false);
                    // Reprendre le mode automatique basé sur la position
                    updateLightingBasedOnPosition(normalizedPosition);
                } else if (data.mode === 'night') {
                    setForcedNightMode(true);
                } else if (data.mode === 'day') {
                    setForcedNightMode(false);
                    // Forcer le mode jour
                    const dayConfig = LightConfig.modes.day;
                    lightSettingsRef.current.current = {
                        position: dayConfig.mainLight.position,
                        intensity: dayConfig.mainLight.intensity,
                        color: dayConfig.mainLight.color,
                        ambientIntensity: dayConfig.ambientIntensity,
                        ambientColor: dayConfig.ambientColor
                    };
                    setActiveMode('Day (Forced)');
                    lightSettingsRef.current.needsUpdate = true;
                }
            }),

            EventBus.on('lights-night-mode-forced', (data) => {
                console.log('💡 Night mode forced:', data.forced);
                setForcedNightMode(data.forced);
            }),

            // Lumière principale - visibilité
            EventBus.on('lights-main-visibility-changed', (data) => {
                if (directionalLightRef.current) {
                    directionalLightRef.current.visible = data.visible;
                }
            }),

            // Lumière principale - position
            EventBus.on('lights-main-position-changed', (data) => {
                if (directionalLightRef.current) {
                    directionalLightRef.current.position.set(...data.position);
                    // Mettre à jour les paramètres de référence
                    lightSettingsRef.current.current.position = data.position;
                }
            }),

            // Lumière principale - intensité
            EventBus.on('lights-main-intensity-changed', (data) => {
                if (directionalLightRef.current) {
                    directionalLightRef.current.intensity = data.intensity;
                    lightSettingsRef.current.current.intensity = data.intensity;
                    // Mettre à jour l'affichage
                    setActiveValues(prev => ({ ...prev, intensity: data.intensity }));
                }
            }),

            // Lumière principale - couleur
            EventBus.on('lights-main-color-changed', (data) => {
                if (directionalLightRef.current) {
                    directionalLightRef.current.color.set(data.color);
                    lightSettingsRef.current.current.color = data.color;
                    // Mettre à jour l'affichage
                    setActiveValues(prev => ({ ...prev, color: data.color }));
                }
            }),

            // Lumière principale - ombres
            EventBus.on('lights-main-shadow-changed', (data) => {
                if (directionalLightRef.current) {
                    directionalLightRef.current.castShadow = data.castShadow;
                }
            }),

            // Lumière ambiante - visibilité
            EventBus.on('lights-ambient-visibility-changed', (data) => {
                if (ambientLightRef.current) {
                    ambientLightRef.current.visible = data.visible;
                }
            }),

            // Lumière ambiante - intensité
            EventBus.on('lights-ambient-intensity-changed', (data) => {
                if (ambientLightRef.current) {
                    ambientLightRef.current.intensity = data.intensity;
                    lightSettingsRef.current.current.ambientIntensity = data.intensity;
                }
            }),

            // Lumière ambiante - couleur
            EventBus.on('lights-ambient-color-changed', (data) => {
                if (ambientLightRef.current) {
                    ambientLightRef.current.color.set(data.color);
                    lightSettingsRef.current.current.ambientColor = data.color;
                }
            }),

            // Seuils de transition
            EventBus.on('lights-threshold-changed', (data) => {
                console.log('💡 Threshold changed:', data.threshold, data.value);
                LightConfig.transitionThresholds[data.threshold] = data.value;
                // Recalculer l'éclairage avec les nouveaux seuils
                updateLightingBasedOnPosition(normalizedPosition);
            }),

            // Paramètres d'ombre
            EventBus.on('lights-shadow-mapsize-changed', (data) => {
                if (directionalLightRef.current && directionalLightRef.current.shadow) {
                    directionalLightRef.current.shadow.mapSize.width = data.mapSize;
                    directionalLightRef.current.shadow.mapSize.height = data.mapSize;
                    directionalLightRef.current.shadow.needsUpdate = true;
                }
                lightSettingsRef.current.shadowMapSize = data.mapSize;
            }),

            EventBus.on('lights-shadow-bias-changed', (data) => {
                if (directionalLightRef.current && directionalLightRef.current.shadow) {
                    directionalLightRef.current.shadow.bias = data.bias;
                    directionalLightRef.current.shadow.needsUpdate = true;
                }
                lightSettingsRef.current.shadowBias = data.bias;
            }),

            EventBus.on('lights-shadow-normal-bias-changed', (data) => {
                if (directionalLightRef.current && directionalLightRef.current.shadow) {
                    directionalLightRef.current.shadow.normalBias = data.normalBias;
                    directionalLightRef.current.shadow.needsUpdate = true;
                }
                lightSettingsRef.current.shadowNormalBias = data.normalBias;
            }),

            EventBus.on('lights-shadow-radius-changed', (data) => {
                if (directionalLightRef.current && directionalLightRef.current.shadow) {
                    directionalLightRef.current.shadow.radius = data.radius;
                    directionalLightRef.current.shadow.needsUpdate = true;
                }
            }),

            // Presets
            EventBus.on('lights-preset-applied', (data) => {
                console.log('💡 Applying preset:', data.preset);

                if (data.preset === 'day') {
                    const dayConfig = LightConfig.modes.day;
                    lightSettingsRef.current.current = {
                        position: dayConfig.mainLight.position,
                        intensity: dayConfig.mainLight.intensity,
                        color: dayConfig.mainLight.color,
                        ambientIntensity: dayConfig.ambientIntensity,
                        ambientColor: dayConfig.ambientColor
                    };
                    setActiveMode('Day (Preset)');
                    setForcedNightMode(false);
                } else if (data.preset === 'night') {
                    const nightConfig = LightConfig.modes.night;
                    lightSettingsRef.current.current = {
                        position: nightConfig.mainLight.position,
                        intensity: nightConfig.mainLight.intensity,
                        color: nightConfig.mainLight.color,
                        ambientIntensity: nightConfig.ambientIntensity,
                        ambientColor: nightConfig.ambientColor
                    };
                    setActiveMode('Night (Preset)');
                    setForcedNightMode(true);
                }

                lightSettingsRef.current.needsUpdate = true;
            })
        ];

        return () => {
            console.log('💡 Lights: Cleaning up GUI event listeners');
            subscriptions.forEach(unsub => {
                if (typeof unsub === 'function') {
                    unsub();
                }
            });
        };
    }, [debug, normalizedPosition, lightsInitialized]);

    // Ajouter aussi cet useEffect pour envoyer les valeurs actuelles au GUI
    useEffect(() => {
        if (!debug?.active || !lightsInitialized) return;

        // Envoyer les valeurs actuelles au GUI toutes les 100ms
        const interval = setInterval(() => {
            EventBus.trigger('lights-values-updated', {
                currentMode: activeMode,
                normalizedPosition: normalizedPosition,
                transitionFactor: transitionFactor,
                mainLightIntensity: smoothedLightRef.current.intensity,
                ambientIntensity: smoothedLightRef.current.ambientIntensity,
                mainLightColor: smoothedLightRef.current.color,
                ambientColor: smoothedLightRef.current.ambientColor,
                position: smoothedLightRef.current.position
            });
        }, 100);

        return () => clearInterval(interval);
    }, [debug, activeMode, normalizedPosition, transitionFactor, lightsInitialized]);

    // Ajouter des logs de diagnostic
    useEffect(() => {
        if (!debug?.active || !lightsInitialized) return;

        console.log('=== LIGHTS DEBUG DIAGNOSTICS ===');
        console.log('Current mode:', activeMode);
        console.log('Normalized position:', normalizedPosition);
        console.log('Transition factor:', transitionFactor);
        console.log('Forced night mode:', forcedNightMode);
        console.log('Active values:', activeValues);
        console.log('Light settings:', lightSettingsRef.current);
    }, [debug, activeMode, normalizedPosition, transitionFactor, forcedNightMode, activeValues, lightsInitialized]);

    // Ne rendre les lumières que si le système est prêt
    if (!lightsInitialized) {
        return null;
    }

    return (
        <>
            {/* Lumière ambiante */}
            <ambientLight
                ref={ambientLightRef}
                intensity={smoothedLightRef.current.ambientIntensity}
                color={smoothedLightRef.current.ambientColor}
            />
            {/* Lumière principale (point light) */}
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

            {/* Ajout de lumières secondaires pour enrichir l'ambiance */}
            {transitionFactor > 0.5 && (
                <>
                    {/* Lumière lunaire bleue */}
                    <pointLight
                        position={[20, 40, 10]}
                        intensity={2000 * Math.max(0, transitionFactor - 0.5) * 2}
                        color="#8eabff"
                        distance={100}
                    />

                    {/* Lumières secondaires pour les effets nocturnes */}
                    {transitionFactor > 0.8 && (
                        <pointLight
                            position={[-30, 5, -20]}
                            intensity={500}
                            color="#4287f5"
                            distance={40}
                        />
                    )}
                </>
            )}
        </>
    );
}