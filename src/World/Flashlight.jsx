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
 * Réduction d'intensité pour la prise de photo
 */

export default function Flashlight() {
    const {camera, scene, gl} = useThree();
    const flashlightRef = useRef();
    const flashlightTargetRef = useRef(new THREE.Object3D());
    const configRef = useRef(guiConfig.flashlight);
    const firstActivationRef = useRef(false);

    // Références pour éviter les mises à jour d'état excessives
    const initializedRef = useRef(false);
    const guiInitializedRef = useRef(false);
    const normalizedPositionRef = useRef(0);
    const targetIntensityRef = useRef(0);
    const currentIntensityRef = useRef(0);
    const forceUpdateRef = useRef(0);
    const autoFlickerTriggeredRef = useRef(false);

    // Référence pour tracker la réduction d'intensité due à la photo
    const photoReductionRef = useRef({
        isReduced: false,
        originalIntensity: 0,
        reductionFactor: 1.0,
        isAnimating: false,
        animationStartTime: 0,
        animationDuration: 2000,
        startIntensity: 0,
        targetIntensity: 0
    });

    // État pour stocker l'intensité normale (pour pouvoir y revenir)
    const [normalIntensity] = useState(configRef.current.intensity.default);

    // Configuration des seuils d'activation de la lampe torche
    const flashlightThresholdsRef = useRef({
        activationThreshold: 0.66,        // Activation directe à 70% du scroll
        targetIntensity: 30,             // Intensité cible (passage direct de 0 à 15)
        flickerActivationThreshold: 0.8  // Déclenchement du clignottement à 80%
    });

    // *** Références pour le clignottement avec pattern binaire naturel ***
    const flickerRef = useRef({
        enabled: false,
        intensity: 1.0,
        frequency: 6.0,          // Fréquence plus rapide pour des patterns courts
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
        [0, 0, 1, 0, 0, 1, 0, 1, 1, 1],
        // Pattern 3: Arrêt + flicker remontée
        [0, 0, 0, 1, 0, 1, 0, 0, 1, 1],
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
        angle: 0.21,
        penumbra: 0.1,
        distance: 50,
        decay: 1.1
    });

    // Accéder aux états depuis le store
    const flashlightState = useStore(state => state.flashlight);
    const updateFlashlightState = useStore(state => state.updateFlashlightState);
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    const calculateFlickerIntensity = (time, baseIntensity) => {
        const flicker = flickerRef.current;
        if (!flicker.enabled || !flicker.isActive) return baseIntensity;

        // Pattern spécifique : 1, 0, 1, 0, 0, 0, 1, 1
        const customPattern = [1, 0, 1, 1, 0, 0, 0, 1];
        const pattern = customPattern; // Utilise le pattern personnalisé au lieu de celui des refs
        const patternSpeed = flicker.frequency;
        const timeSinceStart = time - flicker.startTime;

        // Calculer la progression dans le pattern
        const patternProgress = (timeSinceStart * patternSpeed) % pattern.length;
        const patternIndex = Math.floor(patternProgress);
        const patternValue = pattern[patternIndex];

        // Pas d'interpolation - changements brutaux instantanés
        let smoothValue = patternValue; // Utilise directement la valeur du pattern sans transition

        // Ajouter un long moment d'extinction avant la dernière répétition
        const cycleProgress = (timeSinceStart * patternSpeed) / pattern.length;
        const nextCycleWillBeLast = Math.floor(cycleProgress + 1) >= flicker.repeatCount;

        // Si on approche de la dernière répétition, ajouter une pause sombre brutale
        if (nextCycleWillBeLast && flicker.currentRepeat < flicker.repeatCount - 1) {
            const pauseProgress = (cycleProgress % 1);
            if (pauseProgress > 0.3 && pauseProgress < 0.9) {
                smoothValue = 0; // Extinction complète et brutale pendant 60% du cycle
            }
        }

        // Vérification des cycles (inchangée)
        const currentCycle = Math.floor(timeSinceStart * patternSpeed / pattern.length);
        if (currentCycle > flicker.currentRepeat) {
            flicker.currentRepeat = currentCycle;

            EventBus.trigger('flashlight-repeat-completed', {
                repeatNumber: flicker.currentRepeat,
                totalRepeats: flicker.repeatCount,
                patternIndex: flicker.patternIndex,
                time: time
            });

            console.log(`Flashlight: Répétition ${flicker.currentRepeat}/${flicker.repeatCount} terminée`);

            if (flicker.currentRepeat >= flicker.repeatCount) {
                flicker.isActive = false;
                console.log('Flashlight: Clignottement terminé après toutes les répétitions');

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

        // Appliquer l'intensité du clignottement directement (pas de bruit)
        let finalValue = smoothValue;

        // Appliquer l'intensité du clignottement avec possibilité d'extinction complète
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

        // Offset de bruit pour la variabilité
        flicker.noiseOffset = Math.random() * 1000;

        console.log(`Flashlight: Clignottement déclenché (pattern: ${flicker.patternIndex}, répétitions: ${repeatCount})`);
    };

    // Fonction pour réduire l'intensité pour la prise de photo avec animation progressive
    const reduceIntensityForPhoto = (reductionFactor = 0.15, duration = 1200, immediate = false) => {
        const photoReduction = photoReductionRef.current;

        if (photoReduction.isAnimating) {
            console.log('📸 Flashlight: Animation déjà en cours, ignorer la nouvelle demande');
            return;
        }

        if (!photoReduction.isReduced) {
            // Première réduction - sauvegarder l'intensité originale
            photoReduction.originalIntensity = targetIntensityRef.current;
            photoReduction.isReduced = true;
            photoReduction.reductionFactor = reductionFactor;

            console.log(`📸 Flashlight: Début de la réduction ${immediate ? 'IMMÉDIATE' : 'progressive'} d'intensité sur ${duration}ms`);
            console.log(`📸 Intensité: ${photoReduction.originalIntensity} → ${photoReduction.originalIntensity * reductionFactor}`);
        } else {
            // Réduction supplémentaire - appliquer sur l'intensité actuelle
            photoReduction.reductionFactor *= reductionFactor;
            console.log(`📸 Flashlight: Réduction supplémentaire - nouveau facteur: ${photoReduction.reductionFactor}`);
        }

        let startIntensity = targetIntensityRef.current;

        // CORRECTION PRINCIPALE : Réduction immédiate au clic
        if (immediate) {
            const immediateReductionFactor = 0.3; // Réduction immédiate à 30%
            const immediateIntensity = targetIntensityRef.current * immediateReductionFactor;

            // Appliquer IMMÉDIATEMENT sans animation
            targetIntensityRef.current = immediateIntensity;
            currentIntensityRef.current = immediateIntensity;
            startIntensity = immediateIntensity;

            console.log(`📸 Flashlight: ⚡ RÉDUCTION IMMÉDIATE APPLIQUÉE - intensité: ${immediateIntensity}`);

            // Mettre à jour le store immédiatement
            updateFlashlightState({
                intensity: immediateIntensity
            });

            // Forcer la mise à jour de la lumière THREE.js immédiatement
            if (flashlightRef.current) {
                flashlightRef.current.intensity = immediateIntensity;
                console.log(`📸 Flashlight: ⚡ Intensité THREE.js mise à jour immédiatement: ${immediateIntensity}`);
            }
        }

        // Animation progressive vers l'intensité finale (plus basse)
        photoReduction.isAnimating = true;
        photoReduction.animationStartTime = performance.now();
        photoReduction.animationDuration = duration;
        photoReduction.startIntensity = startIntensity;
        photoReduction.targetIntensity = photoReduction.originalIntensity * photoReduction.reductionFactor;

        console.log(`📸 Flashlight: Animation progressive configurée - de ${photoReduction.startIntensity} vers ${photoReduction.targetIntensity}`);
    };

    // Fonction pour animer progressivement la réduction
    const animatePhotoReduction = (currentTime) => {
        const photoReduction = photoReductionRef.current;

        if (!photoReduction.isAnimating) return;

        const elapsed = currentTime - photoReduction.animationStartTime;
        const progress = Math.min(elapsed / photoReduction.animationDuration, 1);

        // Utiliser une courbe d'animation plus naturelle (ease-out)
        const easeOutProgress = 1 - Math.pow(1 - progress, 3);

        // Interpoler entre l'intensité de départ et l'intensité cible
        const currentIntensity = THREE.MathUtils.lerp(
            photoReduction.startIntensity,
            photoReduction.targetIntensity,
            easeOutProgress
        );

        // Appliquer la nouvelle intensité
        targetIntensityRef.current = currentIntensity;

        // Vérifier si l'animation est terminée
        if (progress >= 1) {
            photoReduction.isAnimating = false;
            targetIntensityRef.current = photoReduction.targetIntensity;

            console.log(`📸 Flashlight: Animation de réduction terminée - intensité finale: ${photoReduction.targetIntensity}`);

            updateFlashlightState({
                intensity: photoReduction.targetIntensity
            });
        }
    };

    // Fonction pour restaurer l'intensité originale
    const restoreOriginalIntensity = () => {
        const photoReduction = photoReductionRef.current;

        if (photoReduction.isReduced) {
            console.log(`📸 Flashlight: Restauration de l'intensité originale: ${photoReduction.originalIntensity}`);

            // Arrêter l'animation en cours si elle existe
            photoReduction.isAnimating = false;

            targetIntensityRef.current = photoReduction.originalIntensity;
            updateFlashlightState({
                intensity: photoReduction.originalIntensity
            });

            // Réinitialiser l'état de réduction
            photoReduction.isReduced = false;
            photoReduction.reductionFactor = 1.0;
            photoReduction.originalIntensity = 0;
        }
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
        // if (!debug?.active) return;

        // console.log('Flashlight: Écoute des événements GUI démarrée');

        // Écouter tous les événements de contrôle de la flashlight
        const subscriptions = [
            // Écouter l'événement de prise de photo
            EventBus.on('flashlight-photo-taken', (data) => {
                console.log('📸 Flashlight: Événement de prise de photo reçu:', data);

                if (data.action === 'reduce-intensity') {
                    const reductionFactor = data.reductionFactor || 0.1; // Plus agressif par défaut
                    const duration = data.duration || 1200; // Plus rapide par défaut
                    const immediate = data.immediate !== undefined ? data.immediate : true; // Immédiat par défaut

                    console.log(`📸 Flashlight: Paramètres - facteur: ${reductionFactor}, durée: ${duration}, immédiat: ${immediate}`);
                    reduceIntensityForPhoto(reductionFactor, duration, immediate);
                } else if (data.action === 'restore-intensity') {
                    restoreOriginalIntensity();
                }
            }),

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
                let targetIntensity = thresholds.targetIntensity;

                // Appliquer la réduction de photo si active, mais seulement si pas en cours d'animation
                const photoReduction = photoReductionRef.current;
                if (photoReduction.isReduced && !photoReduction.isAnimating) {
                    targetIntensity = photoReduction.originalIntensity * photoReduction.reductionFactor;
                }

                if (targetIntensityRef.current !== targetIntensity && !photoReduction.isAnimating) {
                    targetIntensityRef.current = targetIntensity;
                    console.log(`Flashlight: Activation directe à ${targetIntensity} (position: ${(position * 100).toFixed(1)}%)`);
                    updateFlashlightState({intensity: targetIntensity});

                    // Émettre un événement la première fois que la flashlight s'allume
                    if (!firstActivationRef.current) {
                        firstActivationRef.current = true;

                        // Sauvegarder l'intensité originale pour les réductions futures
                        if (!photoReduction.isReduced) {
                            photoReduction.originalIntensity = thresholds.targetIntensity;
                        }

                        EventBus.trigger('flashlight-first-activation', {
                            normalizedPosition: position,
                            timestamp: Date.now(),
                            intensity: targetIntensity
                        });

                        console.log(`🔦 Flashlight: Première activation - DÉSACTIVATION COMPLÈTE du scroll arrière`);
                    }
                }
            } else if (position < thresholds.activationThreshold && targetIntensityRef.current > 0 && !photoReduction.isAnimating) {
                // En dessous du seuil de 70%, éteindre la lampe (sauf si animation en cours)
                targetIntensityRef.current = 0;

                if (flashlightState.intensity > 0.05) {
                    console.log(`Flashlight: Extinction automatique (position: ${(position * 100).toFixed(1)}% < ${(thresholds.activationThreshold * 100).toFixed(1)}%)`);
                    updateFlashlightState({intensity: 0});
                }
            }
        }

        // Transition fluide de l'intensité (sauf si animation photo en cours)
        const photoReduction = photoReductionRef.current;
        if (!photoReduction.isAnimating && Math.abs(currentIntensityRef.current - targetIntensityRef.current) > 0.001) {
            const smoothingFactor = 0.1;
            const newIntensity = THREE.MathUtils.lerp(
                currentIntensityRef.current,
                targetIntensityRef.current,
                smoothingFactor
            );
            currentIntensityRef.current = newIntensity;
        } else if (!photoReduction.isAnimating && currentIntensityRef.current !== targetIntensityRef.current) {
            currentIntensityRef.current = targetIntensityRef.current;
        }

        // Animer la réduction progressive pour la prise de photo
        animatePhotoReduction(currentTime * 1000); // Convertir en millisecondes

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