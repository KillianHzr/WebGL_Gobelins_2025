import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {useAnimationFrame} from "../Utils/AnimationManager.js";
import {EventBus} from "../Utils/EventEmitter.jsx";

/**
 * Flashlight Component - World/Flashlight.jsx
 * Version avec clignottement réaliste, activation directe à 70% du scroll (0 → 15) et clignottement automatique à 80%
 */

export default function Flashlight() {
    const {camera, scene, gl} = useThree();
    const flashlightRef = useRef();
    const flashlightTargetRef = useRef(new THREE.Object3D());
    const configRef = useRef(guiConfig.flashlight);

    // Références pour éviter les mises à jour d'état excessives
    const initializedRef = useRef(false);
    const guiInitializedRef = useRef(false);
    const normalizedPositionRef = useRef(0);
    const targetIntensityRef = useRef(0);
    const currentIntensityRef = useRef(0);
    const forceUpdateRef = useRef(0);
    const autoFlickerTriggeredRef = useRef(false);

    // État pour stocker l'intensité normale (pour pouvoir y revenir)
    const [normalIntensity] = useState(configRef.current.intensity.default);

    // Configuration des seuils d'activation de la lampe torche
    const flashlightThresholdsRef = useRef({
        activationThreshold: 0.66,        // Activation directe à 70% du scroll
        targetIntensity: 15,             // Intensité cible (passage direct de 0 à 15)
        flickerActivationThreshold: 0.8  // Déclenchement du clignottement à 80%
    });

    // *** NOUVEAU: Références pour le clignottement avec pattern binaire naturel ***
    const flickerRef = useRef({
        enabled: false,
        intensity: 1.0,
        frequency: 3.0,          // Fréquence plus rapide pour des patterns courts
        irregularity: 0.3,       // Moins d'irrégularité pour plus de contrôle
        microFlicker: 0.1,       // Micro-clignotements réduits
        duration: 0,
        startTime: 0,
        currentPhase: 0,
        noiseOffset: Math.random() * 1000,
        patternIndex: 0,
        isActive: false,
        repeatCount: 3,          // Nombre de répétitions
        currentRepeat: 0,        // Répétition actuelle
        lastPatternTime: 0       // Pour tracker les répétitions
    });

    // Patterns de clignottement binaires avec remontée progressive
    const flickerPatternsRef = useRef([
        // Pattern 1: Arrêt brutal + remontée progressive courte
        [0, 0, 0.2, 0, 0.4, 0.7, 1],
        // Pattern 2: Double arrêt + remontée rapide
        [0, 0, 0.2, 0, 0, 0.4, 0.7, 1, 1, 1],
        // Pattern 3: Arrêt + flicker remontée
        [0, 0, 0, 0.2, 0, 0.4, 0.2, 0.6, 0.9, 1],
        // Pattern 4: Panne progressive puis remontée
        [1, 0.5, 0.2, 0, 0, 0, 0.3, 0.7, 1, 1]
    ]);

    // État pour stocker les paramètres de direction
    const [directionParams, setDirectionParams] = useState({
        offsetX: 0,
        offsetY: 0,
        offsetZ: -0.25,
        distance: 1
    });

    // État pour stocker les paramètres avancés
    const [advancedParams, setAdvancedParams] = useState({
        angle: 0.271,
        penumbra: 1,
        distance: 50,
        decay: 1.1
    });

    // Accéder aux états depuis le store
    const flashlightState = useStore(state => state.flashlight);
    const updateFlashlightState = useStore(state => state.updateFlashlightState);
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    // *** NOUVEAU: Fonction pour calculer l'intensité de clignottement binaire ***
    const calculateFlickerIntensity = (time, baseIntensity) => {
        const flicker = flickerRef.current;
        if (!flicker.enabled || !flicker.isActive) return baseIntensity;

        const pattern = flickerPatternsRef.current[flicker.patternIndex % flickerPatternsRef.current.length];
        const patternSpeed = flicker.frequency;
        const timeSinceStart = time - flicker.startTime;

        // Calculer la progression dans le pattern
        const patternProgress = (timeSinceStart * patternSpeed) % pattern.length;
        const patternIndex = Math.floor(patternProgress);
        const patternValue = pattern[patternIndex];

        // Interpolation douce pour éviter les changements trop brutaux
        const nextIndex = (patternIndex + 1) % pattern.length;
        const nextValue = pattern[nextIndex];
        const t = patternProgress - patternIndex;
        const smoothValue = THREE.MathUtils.lerp(patternValue, nextValue, t * 0.4);

        // Vérifier si on a terminé une répétition complète
        // Vérifier si on a terminé une répétition complète
        const currentCycle = Math.floor(timeSinceStart * patternSpeed / pattern.length);
        if (currentCycle > flicker.currentRepeat) {
            flicker.currentRepeat = currentCycle;

            // Émettre l'événement de fin de répétition
            EventBus.trigger('flashlight-repeat-completed', {
                repeatNumber: flicker.currentRepeat,
                totalRepeats: flicker.repeatCount,
                patternIndex: flicker.patternIndex,
                time: time
            });

            console.log(`Flashlight: Répétition ${flicker.currentRepeat}/${flicker.repeatCount} terminée`);

            // Vérifier si on a atteint le nombre de répétitions souhaité
            if (flicker.currentRepeat >= flicker.repeatCount) {
                flicker.isActive = false;
                console.log('Flashlight: Clignottement terminé après toutes les répétitions');

                // NOUVEAU: Émettre l'événement de fin complète du clignottement
                EventBus.trigger('flashlight-flicker-completely-finished', {
                    patternIndex: flicker.patternIndex,
                    totalRepeats: flicker.repeatCount,
                    time: time,
                    finalIntensity: baseIntensity
                });

                console.log('🔦 Flashlight: Événement de fin complète de clignottement émis');

                return baseIntensity;
            }
        }
        // Ajouter un léger bruit pour le naturel, mais moins que avant
        let finalValue = smoothValue;
        if (flicker.irregularity > 0) {
            const noise = Math.sin(time * 15 + flicker.noiseOffset) * 0.5 + 0.5;
            finalValue = THREE.MathUtils.lerp(smoothValue, smoothValue * noise, flicker.irregularity * 0.2);
        }

        // Micro-flicker léger pendant la remontée
        if (flicker.microFlicker > 0 && smoothValue > 0.3 && smoothValue < 0.9) {
            const microNoise = Math.sin(time * 25 + flicker.noiseOffset * 3) * 0.5 + 0.5;
            finalValue = THREE.MathUtils.lerp(finalValue, finalValue * microNoise, flicker.microFlicker);
        }

        // Appliquer l'intensité du clignottement
        const intensity = baseIntensity * THREE.MathUtils.lerp(1, finalValue, flicker.intensity);

        return Math.max(0, Math.min(intensity, baseIntensity));
    };

    // *** NOUVEAU: Fonction pour démarrer le clignottement avec répétitions ***
    const triggerFlicker = (duration = 0, patternIndex = null, repeatCount = 3) => {
        const flicker = flickerRef.current;
        flicker.isActive = true;
        flicker.startTime = performance.now() * 0.001;
        flicker.currentRepeat = 0;
        flicker.repeatCount = repeatCount;

        if (patternIndex !== null) {
            flicker.patternIndex = patternIndex;
        } else {
            // Pattern aléatoire
            flicker.patternIndex = Math.floor(Math.random() * flickerPatternsRef.current.length);
        }

        // Calculer la durée pour le nombre de répétitions spécifié
        if (duration === 0 && repeatCount > 0) {
            const pattern = flickerPatternsRef.current[flicker.patternIndex];
            const singlePatternDuration = pattern.length / flicker.frequency;
            flicker.duration = singlePatternDuration * repeatCount;
        } else {
            flicker.duration = duration;
        }

        // Nouveau offset de bruit pour la variabilité
        flicker.noiseOffset = Math.random() * 1000;

        console.log(`Flashlight: Clignottement déclenché (pattern: ${flicker.patternIndex}, répétitions: ${repeatCount})`);
    };

    // Écouter l'événement de position normalisée de la timeline avec debug
    useEffect(() => {
        const handleTimelinePositionUpdate = (data) => {
            const previousPosition = normalizedPositionRef.current;
            normalizedPositionRef.current = data.position;

            // Debug log pour suivre les changements significatifs
            if (Math.abs(data.position - previousPosition) > 0.05) {
                console.log(`Flashlight: Position normalisée mise à jour: ${(data.position * 100).toFixed(1)}%`);
            }
        };

        const subscription = EventBus.on('timeline-position-normalized', handleTimelinePositionUpdate);

        // Log de démarrage
        console.log('Flashlight: Écoute des événements de position normalisée démarrée');

        return () => {
            subscription();
            console.log('Flashlight: Écoute des événements de position normalisée arrêtée');
        };
    }, []);

    // INITIALISATION - création de la cible
    useEffect(() => {
        if (!initializedRef.current) {
            scene.add(flashlightTargetRef.current);
            flashlightTargetRef.current.name = "flashlightTarget";

            const direction = new THREE.Vector3(
                directionParams.offsetX,
                directionParams.offsetY,
                directionParams.offsetZ
            );
            direction.normalize();
            direction.applyQuaternion(camera.quaternion);
            const targetPosition = camera.position.clone().add(direction.multiplyScalar(directionParams.distance));
            flashlightTargetRef.current.position.copy(targetPosition);

            updateFlashlightState({
                autoActivate: true,
                active: true,
                intensity: 0,
                normalIntensity: normalIntensity,
                preloadState: 'initialized',
                direction: {...directionParams},
                advanced: {...advancedParams}
            });

            console.log('Flashlight: Composant initialisé avec activation automatique');
            initializedRef.current = true;
        }

        return () => {
            if (flashlightTargetRef.current) {
                scene.remove(flashlightTargetRef.current);
            }
        };
    }, [scene, camera, updateFlashlightState, normalIntensity, directionParams, advancedParams]);

    // Configuration de la flashlight une fois créée
    useEffect(() => {
        if (!flashlightRef.current) return;

        const flashlight = flashlightRef.current;

        flashlight.intensity = 0;
        flashlight.angle = advancedParams.angle;
        flashlight.penumbra = advancedParams.penumbra;
        flashlight.distance = advancedParams.distance;
        flashlight.decay = advancedParams.decay;
        flashlight.color.set(configRef.current.color.default);

        flashlight.castShadow = configRef.current.shadows.enabled.default;

        if (flashlight.shadow) {
            flashlight.shadow.mapSize.width = configRef.current.shadows.mapSize.default;
            flashlight.shadow.mapSize.height = configRef.current.shadows.mapSize.default;
            flashlight.shadow.bias = configRef.current.shadows.bias.default;
            flashlight.shadow.normalBias = configRef.current.shadows.normalBias.default;
            flashlight.shadow.needsUpdate = true;
        }

        flashlight.target = flashlightTargetRef.current;
        flashlight.visible = true;

        gl.render(scene, camera);

        updateFlashlightState({
            preloadState: 'ready'
        });

        console.log('Flashlight: Configuration terminée');
    }, [flashlightRef.current, scene, camera, gl, updateFlashlightState, advancedParams]);

    // Écouter les événements du GUI au lieu de créer le GUI directement
    useEffect(() => {
        if (!debug?.active) return;

        console.log('Flashlight: Écoute des événements GUI démarrée');

        // Écouter tous les événements de contrôle de la flashlight
        const subscriptions = [
            EventBus.on('flashlight-active-changed', (data) => {
                if (flashlightRef.current) {
                    const newIntensity = data.active ? (flashlightState.normalIntensity || normalIntensity) : 0;
                    targetIntensityRef.current = newIntensity;
                    updateFlashlightState({
                        active: data.active,
                        intensity: newIntensity,
                        manuallyToggled: true
                    });
                    console.log(`Flashlight: État actif changé: ${data.active}`);
                }
            }),

            EventBus.on('flashlight-auto-activate-changed', (data) => {
                updateFlashlightState({
                    autoActivate: data.autoActivate,
                    manuallyToggled: !data.autoActivate
                });
                console.log(`Flashlight: Activation automatique: ${data.autoActivate}`);
            }),

            EventBus.on('flashlight-flicker-enabled-changed', (data) => {
                flickerRef.current.enabled = data.enabled;
                console.log(`Flashlight: Clignottement activé: ${data.enabled}`);
            }),

            EventBus.on('flashlight-flicker-intensity-changed', (data) => {
                flickerRef.current.intensity = data.intensity;
            }),

            EventBus.on('flashlight-flicker-frequency-changed', (data) => {
                flickerRef.current.frequency = data.frequency;
            }),

            EventBus.on('flashlight-flicker-irregularity-changed', (data) => {
                flickerRef.current.irregularity = data.irregularity;
            }),

            EventBus.on('flashlight-flicker-micro-changed', (data) => {
                flickerRef.current.microFlicker = data.microFlicker;
            }),

            EventBus.on('flashlight-flicker-pattern-changed', (data) => {
                flickerRef.current.patternIndex = data.patternIndex;
            }),

            EventBus.on('flashlight-flicker-triggered', (data) => {
                triggerFlicker(data.duration, data.patternIndex, data.repeatCount || 3);
            }),

            EventBus.on('flashlight-flicker-stopped', () => {
                flickerRef.current.isActive = false;
                console.log('Flashlight: Clignottement arrêté');
            }),

            EventBus.on('flashlight-threshold-changed', (data) => {
                if (data.activationThreshold !== undefined) {
                    flashlightThresholdsRef.current.activationThreshold = data.activationThreshold;
                    console.log(`Flashlight: Seuil d'activation: ${(data.activationThreshold * 100).toFixed(1)}%`);
                }
                if (data.targetIntensity !== undefined) {
                    flashlightThresholdsRef.current.targetIntensity = data.targetIntensity;
                    console.log(`Flashlight: Intensité cible: ${data.targetIntensity}`);
                }
                if (data.flickerActivationThreshold !== undefined) {
                    flashlightThresholdsRef.current.flickerActivationThreshold = data.flickerActivationThreshold;
                    console.log(`Flashlight: Seuil de clignottement automatique: ${(data.flickerActivationThreshold * 100).toFixed(1)}%`);
                }
            }),

            EventBus.on('flashlight-intensity-changed', (data) => {
                if (flashlightRef.current) {
                    targetIntensityRef.current = data.intensity;
                    updateFlashlightState({intensity: data.intensity});
                    forceUpdateRef.current++;
                }
            }),

            EventBus.on('flashlight-normal-intensity-changed', (data) => {
                updateFlashlightState({normalIntensity: data.normalIntensity});
                if (flashlightRef.current && flashlightState.active) {
                    targetIntensityRef.current = data.normalIntensity;
                    updateFlashlightState({intensity: data.normalIntensity});
                }
                console.log(`Flashlight: Intensité normale: ${data.normalIntensity}`);
            }),

            EventBus.on('flashlight-color-changed', (data) => {
                if (flashlightRef.current) {
                    flashlightRef.current.color.set(data.color);
                }
            }),

            EventBus.on('flashlight-angle-changed', (data) => {
                if (flashlightRef.current) {
                    flashlightRef.current.angle = data.angle;
                }
                setAdvancedParams(prev => ({ ...prev, angle: data.angle }));
            }),

            EventBus.on('flashlight-penumbra-changed', (data) => {
                if (flashlightRef.current) {
                    flashlightRef.current.penumbra = data.penumbra;
                }
                setAdvancedParams(prev => ({ ...prev, penumbra: data.penumbra }));
            }),

            EventBus.on('flashlight-distance-changed', (data) => {
                if (flashlightRef.current) {
                    flashlightRef.current.distance = data.distance;
                }
                setAdvancedParams(prev => ({ ...prev, distance: data.distance }));
            }),

            EventBus.on('flashlight-decay-changed', (data) => {
                if (flashlightRef.current) {
                    flashlightRef.current.decay = data.decay;
                }
                setAdvancedParams(prev => ({ ...prev, decay: data.decay }));
            }),

            EventBus.on('flashlight-position-changed', (data) => {
                setDirectionParams(prev => ({
                    ...prev,
                    ...data
                }));
            }),

            EventBus.on('flashlight-direction-changed', (data) => {
                setDirectionParams(prev => ({
                    ...prev,
                    offsetX: data.offsetX !== undefined ? data.offsetX : prev.offsetX,
                    offsetY: data.offsetY !== undefined ? data.offsetY : prev.offsetY,
                    offsetZ: data.offsetZ !== undefined ? data.offsetZ : prev.offsetZ,
                    distance: data.distance !== undefined ? data.distance : prev.distance
                }));
            }),

            EventBus.on('flashlight-shadows-changed', (data) => {
                if (flashlightRef.current && flashlightRef.current.shadow) {
                    if (data.enabled !== undefined) {
                        flashlightRef.current.castShadow = data.enabled;
                    }
                    if (data.mapSize !== undefined) {
                        flashlightRef.current.shadow.mapSize.width = data.mapSize;
                        flashlightRef.current.shadow.mapSize.height = data.mapSize;
                        flashlightRef.current.shadow.needsUpdate = true;
                    }
                    if (data.bias !== undefined) {
                        flashlightRef.current.shadow.bias = data.bias;
                    }
                    if (data.normalBias !== undefined) {
                        flashlightRef.current.shadow.normalBias = data.normalBias;
                    }
                }
            })
        ];

        return () => {
            subscriptions.forEach(unsub => {
                if (typeof unsub === 'function') {
                    unsub();
                }
            });
            console.log('Flashlight: Écoute des événements GUI arrêtée');
        };
    }, [debug, flashlightState, updateFlashlightState, normalIntensity]);

    // Animation et logique de mise à jour avec clignottement
    useAnimationFrame(() => {
        if (!flashlightRef.current) return;

        const currentTime = performance.now() * 0.001; // Temps en secondes

        // ACTIVATION AUTOMATIQUE DE L'INTENSITÉ
        if (flashlightState.autoActivate && !flashlightState.manuallyToggled) {
            const thresholds = flashlightThresholdsRef.current;
            const position = normalizedPositionRef.current;

            // Déclenchement automatique du clignottement à 80%
            if (position >= thresholds.flickerActivationThreshold && !autoFlickerTriggeredRef.current) {
                autoFlickerTriggeredRef.current = true;

                // Activer le clignottement avec un pattern binaire (pattern 0) pour 3 répétitions
                flickerRef.current.enabled = true;
                triggerFlicker(0, 0, 1); // 3 répétitions, pattern arrêt brutal + remontée

                console.log(`Flashlight: Clignottement automatique déclenché à ${(position * 100).toFixed(1)}%`);
            }

            // Réinitialiser le flag si on redescend en dessous de 80%
            if (position < thresholds.flickerActivationThreshold && autoFlickerTriggeredRef.current) {
                autoFlickerTriggeredRef.current = false;
                flickerRef.current.enabled = false;
                flickerRef.current.isActive = false;
                console.log(`Flashlight: Clignottement automatique arrêté (position: ${(position * 100).toFixed(1)}%)`);
            }

            // Logique d'activation de la lumière (70%)
            if (position >= thresholds.activationThreshold) {
                // Dès qu'on atteint 70%, passer directement à l'intensité cible (15)
                const targetIntensity = thresholds.targetIntensity;

                if (targetIntensityRef.current !== targetIntensity) {
                    targetIntensityRef.current = targetIntensity;
                    console.log(`Flashlight: Activation directe à ${targetIntensity} (position: ${(position * 100).toFixed(1)}%)`);
                    updateFlashlightState({intensity: targetIntensity});
                }
            } else if (position < thresholds.activationThreshold && targetIntensityRef.current > 0) {
                // En dessous du seuil de 70%, éteindre la lampe
                targetIntensityRef.current = 0;

                if (flashlightState.intensity > 0.05) {
                    console.log(`Flashlight: Extinction automatique (position: ${(position * 100).toFixed(1)}% < ${(thresholds.activationThreshold * 100).toFixed(1)}%)`);
                    updateFlashlightState({intensity: 0});
                }
            }
        }

        // Transition fluide de l'intensité
        if (Math.abs(currentIntensityRef.current - targetIntensityRef.current) > 0.001) {
            const smoothingFactor = 0.1;
            const newIntensity = THREE.MathUtils.lerp(
                currentIntensityRef.current,
                targetIntensityRef.current,
                smoothingFactor
            );
            currentIntensityRef.current = newIntensity;
        } else if (currentIntensityRef.current !== targetIntensityRef.current) {
            currentIntensityRef.current = targetIntensityRef.current;
        }

        // Appliquer le clignottement
        let finalIntensity = currentIntensityRef.current;
        if (flickerRef.current.enabled) {
            finalIntensity = calculateFlickerIntensity(currentTime, currentIntensityRef.current);
        }

        // Appliquer l'intensité finale à la lumière
        flashlightRef.current.intensity = finalIntensity;

        // Mise à jour de la position et orientation de la lampe
        if (flashlightTargetRef.current) {
            const offsetPosition = new THREE.Vector3(0.0, 0.0, 0.0);
            offsetPosition.applyQuaternion(camera.quaternion);
            flashlightRef.current.position.copy(camera.position).add(offsetPosition);

            const direction = new THREE.Vector3(
                directionParams.offsetX,
                directionParams.offsetY,
                directionParams.offsetZ
            );
            direction.normalize();
            direction.applyQuaternion(camera.quaternion);

            const targetPosition = camera.position.clone().add(direction.multiplyScalar(directionParams.distance));
            flashlightTargetRef.current.position.copy(targetPosition);
            flashlightTargetRef.current.updateMatrixWorld();

            // Ajuster dynamiquement la couleur en fonction de l'intensité
            if (flashlightRef.current.intensity > 0) {
                const normalizedIntensity = flashlightRef.current.intensity / normalIntensity;
                const warmColor = new THREE.Color("#ffbb77");
                const brightColor = new THREE.Color("#ffffff");

                const resultColor = new THREE.Color();
                resultColor.r = THREE.MathUtils.lerp(warmColor.r, brightColor.r, normalizedIntensity);
                resultColor.g = THREE.MathUtils.lerp(warmColor.g, brightColor.g, normalizedIntensity);
                resultColor.b = THREE.MathUtils.lerp(warmColor.b, brightColor.b, normalizedIntensity);

                flashlightRef.current.color.copy(resultColor);
            }
        }
    }, 'camera');

    const optimizedShadowMapSize = Math.min(configRef.current.shadows.mapSize.default, 1024);

    return (
        <spotLight
            ref={flashlightRef}
            position={[0, 0, 0]}
            intensity={0.0}
            angle={advancedParams.angle}
            penumbra={advancedParams.penumbra}
            distance={advancedParams.distance}
            decay={advancedParams.decay}
            color={configRef.current.color.default}
            castShadow={configRef.current.shadows.enabled.default}
            shadow-mapSize-width={optimizedShadowMapSize}
            shadow-mapSize-height={optimizedShadowMapSize}
            shadow-bias={configRef.current.shadows.bias.default}
            shadow-normalBias={configRef.current.shadows.normalBias.default}
            visible={true}
        />
    );
}