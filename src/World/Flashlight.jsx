import React, {useEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {useAnimationFrame} from "../Utils/AnimationManager.js";
import {EventBus} from "../Utils/EventEmitter.jsx";

/**
 * Flashlight Component - World/Flashlight.jsx
 * Version avec clignottement réaliste
 */


// todo: boucle 3x la rapide et trigger là a la progression du scroll
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

    // État pour stocker l'intensité normale (pour pouvoir y revenir)
    const [normalIntensity] = useState(configRef.current.intensity.default);

    // Configuration des seuils d'activation de la lampe torche
    const flashlightThresholdsRef = useRef({
        startActivation: 0.65,
        fullActivation: 0.8
    });

    // *** NOUVEAU: Références pour le clignottement ***
    const flickerRef = useRef({
        enabled: false,
        intensity: 1.0,          // Intensité du clignottement (0-1)
        frequency: 2.0,          // Fréquence base en Hz
        irregularity: 0.7,       // Irrégularité (0-1)
        microFlicker: 0.2,       // Micro-clignotements (0-1)
        duration: 2.0,           // Durée en secondes (0 = infini)
        startTime: 0,
        currentPhase: 0,
        noiseOffset: Math.random() * 1000,
        patternIndex: 0,
        isActive: false
    });

    // Patterns de clignottement prédéfinis (séquences réalistes)
    const flickerPatternsRef = useRef([
        // Pattern 1: Clignottement rapide avec pauses
        [1, 0.8, 0.2, 1, 0, 0.2, 0, 1, 0.4, 1],
        // Pattern 2: Clignottement irrégulier
        [0.8, 0.2, 1, 0.1, 0.6, 0.3, 1, 0.1, 0.4, 0.7, 1],
        // Pattern 3: Micro-clignotements
        [1, 0.9, 0.8, 0.9, 1, 0.8, 0.9, 1, 0.7, 0.9, 1],
        // Pattern 4: Défaillance progressive
        [1, 0.8, 0.6, 0.4, 0.2, 0.1, 0.3, 0.6, 0.8, 1]
    ]);

    // État pour stocker les paramètres de direction
    const [directionParams, setDirectionParams] = useState({
        offsetX: 0,
        offsetY: -0.03,
        offsetZ: -0.25,
        distance: 1
    });

    // État pour stocker les paramètres avancés
    const [advancedParams, setAdvancedParams] = useState({
        angle: 0.25,
        penumbra: 1,
        distance: 15,
        decay: 1.1
    });

    // Accéder aux états depuis le store
    const flashlightState = useStore(state => state.flashlight);
    const updateFlashlightState = useStore(state => state.updateFlashlightState);
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    // *** NOUVEAU: Fonction pour calculer l'intensité de clignottement ***
    const calculateFlickerIntensity = (time, baseIntensity) => {
        const flicker = flickerRef.current;
        if (!flicker.enabled || !flicker.isActive) return baseIntensity;

        // Vérifier la durée si elle est définie
        if (flicker.duration > 0 && time - flicker.startTime > flicker.duration) {
            flicker.isActive = false;
            return baseIntensity;
        }

        let intensity = baseIntensity;

        // Pattern prédéfini
        const pattern = flickerPatternsRef.current[flicker.patternIndex % flickerPatternsRef.current.length];
        const patternSpeed = flicker.frequency * 2;
        const patternProgress = (time * patternSpeed) % pattern.length;
        const patternValue = pattern[Math.floor(patternProgress)];

        // Interpolation entre les valeurs du pattern
        const nextIndex = (Math.floor(patternProgress) + 1) % pattern.length;
        const nextValue = pattern[nextIndex];
        const t = patternProgress - Math.floor(patternProgress);
        const smoothPattern = THREE.MathUtils.lerp(patternValue, nextValue, t * 0.3);

        // Bruit pour l'irrégularité
        const noise1 = Math.sin(time * flicker.frequency * 3.14159 + flicker.noiseOffset) * 0.5 + 0.5;
        const noise2 = Math.sin(time * flicker.frequency * 6.28318 + flicker.noiseOffset * 2) * 0.3 + 0.7;
        const noise3 = Math.sin(time * flicker.frequency * 12.56636 + flicker.noiseOffset * 3) * 0.1 + 0.9;

        // Combiner pattern et bruit
        let flickerMultiplier = smoothPattern;
        flickerMultiplier *= THREE.MathUtils.lerp(1, noise1 * noise2 * noise3, flicker.irregularity);

        // Micro-clignotements haute fréquence
        if (flicker.microFlicker > 0) {
            const microNoise = Math.sin(time * 50 + flicker.noiseOffset * 5) * 0.5 + 0.5;
            const microIntensity = THREE.MathUtils.lerp(1, microNoise, flicker.microFlicker * 0.1);
            flickerMultiplier *= microIntensity;
        }

        // Appliquer l'intensité du clignottement
        intensity = baseIntensity * THREE.MathUtils.lerp(1, flickerMultiplier, flicker.intensity);

        // S'assurer que l'intensité reste dans les limites
        return Math.max(0, Math.min(intensity, baseIntensity));
    };

    // *** NOUVEAU: Fonction pour démarrer le clignottement ***
    const triggerFlicker = (duration = 0, patternIndex = null) => {
        const flicker = flickerRef.current;
        flicker.isActive = true;
        flicker.startTime = performance.now() * 0.001;
        flicker.duration = duration;

        if (patternIndex !== null) {
            flicker.patternIndex = patternIndex;
        } else {
            // Pattern aléatoire
            flicker.patternIndex = Math.floor(Math.random() * flickerPatternsRef.current.length);
        }

        // Nouveau offset de bruit pour la variabilité
        flicker.noiseOffset = Math.random() * 1000;
    };

    // Écouter l'événement de position normalisée de la timeline
    useEffect(() => {
        const handleTimelinePositionUpdate = (data) => {
            normalizedPositionRef.current = data.position;
        };

        const subscription = EventBus.on('timeline-position-normalized', handleTimelinePositionUpdate);
        return () => {
            subscription();
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

    }, [flashlightRef.current, scene, camera, gl, updateFlashlightState, advancedParams]);

    // GUI setup avec contrôles de clignottement
    useEffect(() => {
        // Debug logging pour identifier le problème
        console.log('Flashlight GUI Effect:', {
            debugActive: debug?.active,
            guiExists: !!gui,
            initialized: guiInitializedRef.current,
            flashlightState: !!flashlightState
        });

        if (debug?.active && gui && !guiInitializedRef.current) {
            console.log('Creating Flashlight GUI folder...');

            let flashlightFolder = gui.folders?.find(folder => folder.name === 'Flashlight');

            if (!flashlightFolder) {
                try {
                    // Utiliser la méthode addFolder originale pour éviter le système de profils
                    const originalAddFolder = gui.constructor.prototype.addFolder;
                    flashlightFolder = originalAddFolder.call(gui, 'Flashlight');
                    console.log('Flashlight folder created successfully');

                    // S'assurer que le dossier est visible
                    if (flashlightFolder.domElement) {
                        flashlightFolder.domElement.style.display = 'block';
                        flashlightFolder.domElement.style.visibility = 'visible';
                        console.log('Flashlight folder visibility set');
                    }
                } catch (error) {
                    console.error('Error creating Flashlight folder:', error);
                    return;
                }
            }

            const flashlightProxy = {
                // État principal
                active: flashlightState.active,
                autoActivate: flashlightState.autoActivate || true,
                intensity: flashlightState.intensity || 0,
                normalIntensity: flashlightState.normalIntensity || configRef.current.intensity.default,
                color: configRef.current.color.default,

                // Seuils d'activation
                startActivationThreshold: flashlightThresholdsRef.current.startActivation,
                fullActivationThreshold: flashlightThresholdsRef.current.fullActivation,

                // *** NOUVEAU: Paramètres de clignottement ***
                flickerEnabled: flickerRef.current.enabled,
                flickerIntensity: flickerRef.current.intensity,
                flickerFrequency: flickerRef.current.frequency,
                flickerIrregularity: flickerRef.current.irregularity,
                flickerMicroFlicker: flickerRef.current.microFlicker,
                flickerDuration: flickerRef.current.duration,
                flickerPattern: 0,

                // Fonctions de déclenchement
                triggerFlicker1s: () => triggerFlicker(1, 0),
                triggerFlicker3s: () => triggerFlicker(3, 1),
                triggerFlicker5s: () => triggerFlicker(5, 2),
                triggerFlickerInfinite: () => triggerFlicker(0, 3),
                stopFlicker: () => {
                    flickerRef.current.isActive = false;
                },

                // Paramètres avancés
                angle: advancedParams.angle,
                penumbra: advancedParams.penumbra,
                distance: advancedParams.distance,
                decay: advancedParams.decay,

                // Direction
                directionX: directionParams.offsetX,
                directionY: directionParams.offsetY,
                directionZ: directionParams.offsetZ,
                directionDistance: directionParams.distance,

                // État système
                preloadState: flashlightState.preloadState || 'pending',

                // Ombres
                shadowsEnabled: configRef.current.shadows.enabled.default,
                shadowMapSize: configRef.current.shadows.mapSize.default,
                shadowBias: configRef.current.shadows.bias.default,
                shadowNormalBias: configRef.current.shadows.normalBias.default
            };

            // Contrôles de base (inchangés)
            flashlightFolder.add(flashlightProxy, 'active')
                .name('Activer')
                .onChange(value => {
                    if (flashlightRef.current) {
                        const newIntensity = value ? flashlightProxy.normalIntensity : 0;
                        targetIntensityRef.current = newIntensity;
                        updateFlashlightState({
                            active: value,
                            intensity: newIntensity,
                            manuallyToggled: true
                        });
                    }
                });

            flashlightFolder.add(flashlightProxy, 'autoActivate')
                .name('Activation automatique')
                .onChange(value => {
                    updateFlashlightState({
                        autoActivate: value,
                        manuallyToggled: !value
                    });
                });

            // *** NOUVEAU: Section Clignottement ***
            // Utiliser la méthode addFolder originale pour éviter le système de profils
            const originalAddSubFolder = flashlightFolder.constructor.prototype.addFolder;
            const flickerFolder = originalAddSubFolder.call(flashlightFolder, '🔦 Clignottement');
            console.log('Flicker folder created');

            // S'assurer que le sous-dossier est visible
            if (flickerFolder.domElement) {
                flickerFolder.domElement.style.display = 'block';
                flickerFolder.domElement.style.visibility = 'visible';
                console.log('Flicker folder visibility set');
            }

            // Activer/désactiver le clignottement
            flickerFolder.add(flashlightProxy, 'flickerEnabled')
                .name('Activer clignottement')
                .onChange(value => {
                    flickerRef.current.enabled = value;
                });

            // Intensité du clignottement
            flickerFolder.add(flashlightProxy, 'flickerIntensity', 0, 1, 0.01)
                .name('Intensité clignottement')
                .onChange(value => {
                    flickerRef.current.intensity = value;
                });

            // Fréquence
            flickerFolder.add(flashlightProxy, 'flickerFrequency', 0.1, 10, 0.1)
                .name('Fréquence (Hz)')
                .onChange(value => {
                    flickerRef.current.frequency = value;
                });

            // Irrégularité
            flickerFolder.add(flashlightProxy, 'flickerIrregularity', 0, 1, 0.01)
                .name('Irrégularité')
                .onChange(value => {
                    flickerRef.current.irregularity = value;
                });

            // Micro-clignotements
            flickerFolder.add(flashlightProxy, 'flickerMicroFlicker', 0, 1, 0.01)
                .name('Micro-clignotements')
                .onChange(value => {
                    flickerRef.current.microFlicker = value;
                });

            // Pattern de clignottement
            flickerFolder.add(flashlightProxy, 'flickerPattern', {
                'Rapide avec pauses': 0,
                'Irrégulier': 1,
                'Micro-clignotements': 2,
                'Défaillance progressive': 3
            })
                .name('Pattern')
                .onChange(value => {
                    flickerRef.current.patternIndex = parseInt(value);
                });

            // Séparateur
            flickerFolder.add({separator: '--- Déclenchement ---'}, 'separator').name('');

            // Boutons de déclenchement
            flickerFolder.add(flashlightProxy, 'triggerFlicker1s')
                .name('⚡ Clignotter 1s (Rapide)');

            flickerFolder.add(flashlightProxy, 'triggerFlicker3s')
                .name('⚡ Clignotter 3s (Irrégulier)');

            flickerFolder.add(flashlightProxy, 'triggerFlicker5s')
                .name('⚡ Clignotter 5s (Micro)');

            flickerFolder.add(flashlightProxy, 'triggerFlickerInfinite')
                .name('⚡ Clignotter infini (Défaillance)');

            flickerFolder.add(flashlightProxy, 'stopFlicker')
                .name('🛑 Arrêter clignottement');

            // Durée personnalisée
            flickerFolder.add(flashlightProxy, 'flickerDuration', 0, 10, 0.1)
                .name('Durée (s, 0=infini)')
                .onChange(value => {
                    flickerRef.current.duration = value;
                });

            // Reste du GUI (seuils, intensité, etc.) - inchangé
            flashlightFolder.add(flashlightProxy, 'startActivationThreshold', 0, 1, 0.01)
                .name('Seuil début activation')
                .onChange(value => {
                    flashlightThresholdsRef.current.startActivation = value;
                });

            flashlightFolder.add(flashlightProxy, 'fullActivationThreshold', 0, 1, 0.01)
                .name('Seuil activation complète')
                .onChange(value => {
                    flashlightThresholdsRef.current.fullActivation = value;
                });

            const intensityController = flashlightFolder.add(
                flashlightProxy,
                'intensity',
                0,
                configRef.current.intensity.max,
                configRef.current.intensity.step
            )
                .name('Intensité actuelle')
                .onChange(value => {
                    if (flashlightRef.current) {
                        targetIntensityRef.current = value;
                        updateFlashlightState({intensity: value});
                        forceUpdateRef.current++;
                    }
                });

            flashlightFolder.add(
                flashlightProxy,
                'normalIntensity',
                configRef.current.intensity.min,
                configRef.current.intensity.max,
                configRef.current.intensity.step
            )
                .name('Intensité normale')
                .onChange(value => {
                    updateFlashlightState({normalIntensity: value});
                    if (flashlightRef.current && flashlightProxy.active) {
                        targetIntensityRef.current = value;
                        flashlightProxy.intensity = value;
                        intensityController.setValue(value);
                        updateFlashlightState({intensity: value});
                    }
                });

            // S'assurer que le dossier principal et de clignottement sont visibles
            if (flashlightFolder.domElement) {
                flashlightFolder.domElement.style.display = 'block';
            }
            if (flickerFolder.domElement) {
                flickerFolder.domElement.style.display = 'block';
            }

            // Fermer le dossier de clignottement par défaut mais le garder visible
            if (guiConfig.gui.closeFolders) {
                flickerFolder.close();
            }

            guiInitializedRef.current = true;

        }
    }, [debug, gui, flashlightState, updateFlashlightState, directionParams, advancedParams]);
// Remplacer l'effet GUI dans Flashlight.jsx par ceci :

// Écouter les événements du GUI au lieu de créer le GUI directement
    useEffect(() => {
        if (!debug?.active) return;

        console.log('Flashlight listening for GUI events');

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
                }
            }),

            EventBus.on('flashlight-auto-activate-changed', (data) => {
                updateFlashlightState({
                    autoActivate: data.autoActivate,
                    manuallyToggled: !data.autoActivate
                });
            }),

            EventBus.on('flashlight-flicker-enabled-changed', (data) => {
                flickerRef.current.enabled = data.enabled;
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
                const flicker = flickerRef.current;
                flicker.isActive = true;
                flicker.startTime = performance.now() * 0.001;
                flicker.duration = data.duration;
                flicker.patternIndex = data.patternIndex;
                flicker.noiseOffset = Math.random() * 1000;
            }),

            EventBus.on('flashlight-flicker-stopped', () => {
                flickerRef.current.isActive = false;
            }),

            EventBus.on('flashlight-threshold-changed', (data) => {
                if (data.startActivation !== undefined) {
                    flashlightThresholdsRef.current.startActivation = data.startActivation;
                }
                if (data.fullActivation !== undefined) {
                    flashlightThresholdsRef.current.fullActivation = data.fullActivation;
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

            if (position >= thresholds.startActivation) {
                let intensity = 0;

                if (position >= thresholds.fullActivation) {
                    intensity = flashlightState.normalIntensity || normalIntensity;
                } else {
                    const progressFactor = (position - thresholds.startActivation) /
                        (thresholds.fullActivation - thresholds.startActivation);
                    intensity = (flashlightState.normalIntensity || normalIntensity) * progressFactor;
                }

                targetIntensityRef.current = intensity;

                if (Math.abs(flashlightState.intensity - intensity) > 0.05) {
                    updateFlashlightState({intensity: intensity});
                }
            } else if (position < thresholds.startActivation && targetIntensityRef.current > 0) {
                targetIntensityRef.current = 0;

                if (flashlightState.intensity > 0.05) {
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

        // *** NOUVEAU: Appliquer le clignottement ***
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