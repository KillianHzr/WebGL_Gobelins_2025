import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { MeshBasicMaterial, BackSide, EquirectangularReflectionMapping } from 'three';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EventBus } from '../Utils/EventEmitter';

const SkySphere = () => {
    const { camera } = useThree();
    const meshRef = useRef();
    const transitionMeshRef = useRef();

    // État pour l'environnement actuel et les transitions
    const [currentEnvironment, setCurrentEnvironment] = useState('day');
    const [targetEnvironment, setTargetEnvironment] = useState('day');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [transitionProgress, setTransitionProgress] = useState(0);

    // NOUVEAU: Facteurs de luminosité pour chaque environnement
    const BRIGHTNESS_FACTORS = {
        day: 1.0,        // Luminosité normale
        goddess: 0.6,    // Légèrement réduite
        night: 0.0      // TRÈS réduite pour l'obscurité !
    };

    // Configuration des seuils avec zones de transition cohérentes
    const ENVIRONMENT_CONFIG = {
        day: {
            stable: { min: 0.0, max: 0.25 },
            transition: { start: 0.25, end: 0.4 }
        },
        goddess: {
            stable: { min: 0.40, max: 0.40 },
            transition: { start: 0.45, end: 0.50 }
        },
        night: {
            stable: { min: 0.50, max: 1.0 },
            transition: null
        }
    };

    // Références pour éviter les synchronisations inutiles
    const lastSyncedEnvironment = useRef('day');
    const isInitialized = useRef(false);
    const lastScrollProgress = useRef(0);
    const updateTimeoutRef = useRef(null);

    // Charger les trois textures d'environnement
    const dayTexture = useLoader(RGBELoader, './textures/desktop/environmentMap/dayclouds.hdr');
    const goddessTexture = useLoader(RGBELoader, './textures/desktop/environmentMap/test.hdr');
    const nightTexture = useLoader(RGBELoader, './textures/desktop/environmentMap/nightclouds.hdr');

    // Mapper les textures par nom d'environnement
    const textures = useMemo(() => ({
        day: dayTexture,
        goddess: goddessTexture,
        night: nightTexture
    }), [dayTexture, goddessTexture, nightTexture]);

    // Configuration initiale des textures
    useEffect(() => {
        Object.values(textures).forEach(texture => {
            if (texture) {
                texture.mapping = EquirectangularReflectionMapping;
                texture.flipY = false;
                texture.needsUpdate = true;
            }
        });
        console.log('🌌 SkySphere: Textures configurées avec contrôle de luminosité');
    }, [textures]);

    // ✅ CORRECTION: Fonction pour analyser l'état basé sur la progression du scroll (useCallback stable)
    const analyzeScrollState = useCallback((normalizedProgress) => {
        // Transition day → goddess
        if (normalizedProgress >= ENVIRONMENT_CONFIG.day.transition.start &&
            normalizedProgress <= ENVIRONMENT_CONFIG.day.transition.end) {
            const transitionProgress = (normalizedProgress - ENVIRONMENT_CONFIG.day.transition.start) /
                (ENVIRONMENT_CONFIG.day.transition.end - ENVIRONMENT_CONFIG.day.transition.start);
            return {
                type: 'transition',
                current: 'day',
                target: 'goddess',
                progress: Math.max(0, Math.min(1, transitionProgress)),
                zone: 'day-to-goddess'
            };
        }

        // Transition goddess → night
        if (normalizedProgress >= ENVIRONMENT_CONFIG.goddess.transition.start &&
            normalizedProgress <= ENVIRONMENT_CONFIG.goddess.transition.end) {
            const transitionProgress = (normalizedProgress - ENVIRONMENT_CONFIG.goddess.transition.start) /
                (ENVIRONMENT_CONFIG.goddess.transition.end - ENVIRONMENT_CONFIG.goddess.transition.start);
            return {
                type: 'transition',
                current: 'goddess',
                target: 'night',
                progress: Math.max(0, Math.min(1, transitionProgress)),
                zone: 'goddess-to-night'
            };
        }

        // Environnements stables
        if (normalizedProgress <= ENVIRONMENT_CONFIG.day.stable.max) {
            return { type: 'stable', current: 'day', target: 'day', progress: 1, zone: 'day-stable' };
        } else if (normalizedProgress >= ENVIRONMENT_CONFIG.goddess.stable.min &&
            normalizedProgress <= ENVIRONMENT_CONFIG.goddess.stable.max) {
            return { type: 'stable', current: 'goddess', target: 'goddess', progress: 1, zone: 'goddess-stable' };
        } else if (normalizedProgress >= ENVIRONMENT_CONFIG.night.stable.min) {
            return { type: 'stable', current: 'night', target: 'night', progress: 1, zone: 'night-stable' };
        }

        return { type: 'stable', current: 'day', target: 'day', progress: 1, zone: 'default' };
    }, []); // ✅ Pas de dependencies - fonction pure

    // Fonction d'easing smooth pour les transitions
    const smoothStep = useCallback((t) => {
        const clamped = Math.max(0, Math.min(1, t));
        return clamped * clamped * (3 - 2 * clamped);
    }, []);

    // NOUVEAU: Calculer l'opacité ajustée selon l'environnement
    const getAdjustedOpacity = useCallback((environment, baseOpacity) => {
        const brightnessFactor = BRIGHTNESS_FACTORS[environment] || 1.0;
        return baseOpacity * brightnessFactor;
    }, []);

    // ✅ CORRECTION: Handler stable pour timeline position avec debounce
    const stableHandleTimelinePosition = useCallback((data) => {
        if (!data || typeof data.position !== 'number') {
            console.warn('🌌 SkySphere: Données de position invalides:', data);
            return;
        }

        const { position: normalizedPosition } = data;
        const validPosition = Math.max(0, Math.min(1, normalizedPosition));

        // Debounce pour éviter les calculs excessifs
        if (Math.abs(validPosition - lastScrollProgress.current) < 0.001) {
            return;
        }

        // Clear previous timeout
        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
        }

        // Débounce avec priorité 0 (immédiat pour SkySphere)
        updateTimeoutRef.current = setTimeout(() => {
            lastScrollProgress.current = validPosition;

            // Analyser l'état actuel basé sur la progression
            const scrollState = analyzeScrollState(validPosition);

            // Logic de mise à jour (inchangée)
            if (scrollState.type === 'transition') {
                if (!isTransitioning ||
                    currentEnvironment !== scrollState.current ||
                    targetEnvironment !== scrollState.target) {

                    console.log(`🌌 SkySphere: Transition ${scrollState.zone} à ${(validPosition * 100).toFixed(1)}%`);

                    EventBus.trigger('environment-transition-started', {
                        from: scrollState.current,
                        to: scrollState.target,
                        source: 'scroll-progress',
                        type: 'smooth-scroll',
                        zone: scrollState.zone
                    });

                    setCurrentEnvironment(scrollState.current);
                    setTargetEnvironment(scrollState.target);
                    setIsTransitioning(true);
                }
                setTransitionProgress(scrollState.progress);

            } else if (scrollState.type === 'stable') {
                if (isTransitioning) {
                    console.log(`🌌 SkySphere: Stable ${scrollState.zone} à ${(validPosition * 100).toFixed(1)}%`);

                    setCurrentEnvironment(scrollState.current);
                    setTargetEnvironment(scrollState.current);
                    setIsTransitioning(false);
                    setTransitionProgress(0);
                    lastSyncedEnvironment.current = scrollState.current;

                    EventBus.trigger('environment-transition-completed', {
                        to: scrollState.current,
                        source: 'scroll-progress',
                        type: 'smooth-scroll',
                        zone: scrollState.zone
                    });

                } else if (scrollState.current !== currentEnvironment) {
                    console.log(`🌌 SkySphere: Changement direct vers ${scrollState.current}`);
                    setCurrentEnvironment(scrollState.current);
                    setTargetEnvironment(scrollState.current);
                    lastSyncedEnvironment.current = scrollState.current;
                }
            }
        }, 0); // Immédiat pour SkySphere (priorité la plus haute)

    }, [analyzeScrollState, isTransitioning, currentEnvironment, targetEnvironment]); // ✅ Dependencies stables

    // NOUVEAU: Matériau principal avec contrôle de luminosité
    const currentMaterial = useMemo(() => {
        const currentTexture = textures[currentEnvironment];
        if (!currentTexture) return null;

        let opacity = isTransitioning ? smoothStep(1 - transitionProgress) : 1;

        // APPLIQUER LE FACTEUR DE LUMINOSITÉ
        opacity = getAdjustedOpacity(currentEnvironment, opacity);

        console.log(`🌌 Current material opacity for ${currentEnvironment}:`, opacity);

        return new MeshBasicMaterial({
            map: currentTexture,
            side: BackSide,
            transparent: true, // Toujours transparent pour le contrôle d'opacité
            opacity: opacity
        });
    }, [textures, currentEnvironment, isTransitioning, transitionProgress, smoothStep, getAdjustedOpacity]);

    // NOUVEAU: Matériau de transition avec contrôle de luminosité
    const transitionMaterial = useMemo(() => {
        if (!isTransitioning) return null;

        const targetTexture = textures[targetEnvironment];
        if (!targetTexture) return null;

        let opacity = smoothStep(transitionProgress);

        // APPLIQUER LE FACTEUR DE LUMINOSITÉ
        opacity = getAdjustedOpacity(targetEnvironment, opacity);

        console.log(`🌌 Transition material opacity for ${targetEnvironment}:`, opacity);

        return new MeshBasicMaterial({
            map: targetTexture,
            side: BackSide,
            transparent: true,
            opacity: opacity
        });
    }, [textures, targetEnvironment, isTransitioning, transitionProgress, smoothStep, getAdjustedOpacity]);

    // Nettoyer les anciens matériaux pour éviter les fuites mémoire
    const cleanupMaterial = useCallback((mesh, newMaterial) => {
        if (mesh?.current?.material && mesh.current.material !== newMaterial) {
            if (mesh.current.material.dispose) {
                mesh.current.material.dispose();
            }
        }
    }, []);

    // Mettre à jour les matériaux des meshes
    useEffect(() => {
        if (meshRef.current && currentMaterial) {
            cleanupMaterial(meshRef, currentMaterial);
            meshRef.current.material = currentMaterial;
        }

        if (transitionMeshRef.current && transitionMaterial) {
            cleanupMaterial(transitionMeshRef, transitionMaterial);
            transitionMeshRef.current.material = transitionMaterial;
        }

        return () => {
            if (meshRef.current?.material?.dispose) {
                meshRef.current.material.dispose();
            }
            if (transitionMeshRef.current?.material?.dispose) {
                transitionMeshRef.current.material.dispose();
            }
        };
    }, [currentMaterial, transitionMaterial, cleanupMaterial]);

    // ✅ CORRECTION: Écouter la progression normalisée du scroll avec handler stable (une seule fois)
    useEffect(() => {
        console.log('🌌 SkySphere: Setting up priority timeline position listener');

        const unsubscribeTimeline = EventBus.on('timeline-position-normalized', stableHandleTimelinePosition);

        // Debug check en développement
        if (process.env.NODE_ENV === 'development') {
            setTimeout(() => {
                const activeListeners = EventBus.getActiveListeners();
                const timelineListeners = activeListeners.filter(([id]) =>
                    id.includes('timeline-position-normalized')
                );
                if (timelineListeners.length > 2) {
                    console.warn('⚠️ SkySphere: Trop de listeners timeline détectés!', timelineListeners.length);
                }
            }, 100);
        }

        return () => {
            console.log('🌌 SkySphere: Cleaning up timeline position listener');
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
            }
            if (typeof unsubscribeTimeline === 'function') {
                unsubscribeTimeline();
            }
        };
    }, []); // ✅ Pas de dependencies - setup une seule fois

    // Synchronisation initiale
    useEffect(() => {
        if (!isInitialized.current) {
            let syncInterval;
            let syncTimeout;

            const checkAndSync = () => {
                if (typeof window !== 'undefined' && window.sceneEnvironment) {
                    const currentEnv = window.sceneEnvironment.getCurrentEnvironment();
                    if (currentEnv && currentEnv !== currentEnvironment) {
                        console.log(`🌌 SkySphere: Synchronisation initiale avec ${currentEnv}`);
                        setCurrentEnvironment(currentEnv);
                        setTargetEnvironment(currentEnv);
                        lastSyncedEnvironment.current = currentEnv;
                    }
                    isInitialized.current = true;
                    return true;
                }
                return false;
            };

            if (!checkAndSync()) {
                syncInterval = setInterval(() => {
                    if (checkAndSync()) {
                        clearInterval(syncInterval);
                        clearTimeout(syncTimeout);
                    }
                }, 500);

                syncTimeout = setTimeout(() => {
                    clearInterval(syncInterval);
                    if (!isInitialized.current) {
                        console.warn('🌌 SkySphere: Timeout de synchronisation');
                        isInitialized.current = true;
                    }
                }, 10000);
            }

            return () => {
                if (syncInterval) clearInterval(syncInterval);
                if (syncTimeout) clearTimeout(syncTimeout);
            };
        }
    }, [currentEnvironment]);

    // Mettre à jour la position des sphères
    useFrame(() => {
        if (meshRef.current && camera) {
            meshRef.current.position.copy(camera.position);
        }
        if (transitionMeshRef.current && camera) {
            transitionMeshRef.current.position.copy(camera.position);
        }
    });

    // Fonctions de debug étendues
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.skySphereDEBUG = {
                getCurrentEnvironment: () => currentEnvironment,
                getTargetEnvironment: () => targetEnvironment,
                isTransitioning: () => isTransitioning,
                getTransitionProgress: () => transitionProgress,
                getLastSyncedEnvironment: () => lastSyncedEnvironment.current,
                isInitialized: () => isInitialized.current,
                getTexturesStatus: () => ({
                    day: !!dayTexture,
                    goddess: !!goddessTexture,
                    night: !!nightTexture
                }),
                getCurrentMaterial: () => meshRef.current?.material,
                getTransitionMaterial: () => transitionMeshRef.current?.material,
                getEnvironmentConfig: () => ENVIRONMENT_CONFIG,
                analyzeScrollState: (progress) => {
                    try {
                        return analyzeScrollState(progress);
                    } catch (error) {
                        console.error('🌌 SkySphere: Erreur dans analyzeScrollState:', error);
                        return null;
                    }
                },
                getCurrentScrollProgress: () => lastScrollProgress.current,

                // NOUVELLES FONCTIONS DE DEBUG POUR LA LUMINOSITÉ
                getBrightnessFactor: (env) => BRIGHTNESS_FACTORS[env] || 1.0,
                setBrightnessFactor: (env, factor) => {
                    BRIGHTNESS_FACTORS[env] = factor;
                    console.log(`🌌 SkySphere: Facteur de luminosité ${env} défini à ${factor}`);
                    // Forcer une mise à jour
                    setCurrentEnvironment(currentEnvironment);
                },
                getCurrentOpacity: () => meshRef.current?.material?.opacity || 0,
                getTransitionOpacity: () => transitionMeshRef.current?.material?.opacity || 0,

                testScrollPosition: (progress) => {
                    try {
                        const state = analyzeScrollState(progress);
                        console.log(`🌌 SkySphere: Test à ${(progress * 100).toFixed(1)}%:`, state);
                        return state;
                    } catch (error) {
                        console.error('🌌 SkySphere: Erreur dans testScrollPosition:', error);
                        return null;
                    }
                },
                forceTransition: (from, to, progress = 0.5) => {
                    try {
                        const validProgress = Math.max(0, Math.min(1, progress));
                        console.log(`🌌 SkySphere: Transition forcée ${from} → ${to} (${(validProgress * 100).toFixed(1)}%)`);
                        setCurrentEnvironment(from);
                        setTargetEnvironment(to);
                        setIsTransitioning(true);
                        setTransitionProgress(validProgress);
                    } catch (error) {
                        console.error('🌌 SkySphere: Erreur dans forceTransition:', error);
                    }
                },
                forceStable: (env) => {
                    try {
                        if (!['day', 'goddess', 'night'].includes(env)) {
                            console.error('🌌 SkySphere: Environnement invalide:', env);
                            return;
                        }
                        console.log(`🌌 SkySphere: État stable forcé vers ${env}`);
                        setCurrentEnvironment(env);
                        setTargetEnvironment(env);
                        setIsTransitioning(false);
                        setTransitionProgress(0);
                    } catch (error) {
                        console.error('🌌 SkySphere: Erreur dans forceStable:', error);
                    }
                },
                getDetailedState: () => ({
                    currentEnvironment,
                    targetEnvironment,
                    isTransitioning,
                    transitionProgress,
                    lastScrollProgress: lastScrollProgress.current,
                    currentOpacity: meshRef.current?.material?.opacity || 0,
                    targetOpacity: transitionMeshRef.current?.material?.opacity || 0,
                    brightnessFactor: BRIGHTNESS_FACTORS[currentEnvironment] || 1.0,
                    targetBrightnessFactor: BRIGHTNESS_FACTORS[targetEnvironment] || 1.0
                }),

                // ✅ NOUVELLES FONCTIONS DE DEBUG POUR LES LISTENERS
                checkEventListeners: () => {
                    const activeListeners = EventBus.getActiveListeners();
                    const timelineListeners = activeListeners.filter(([id]) =>
                        id.includes('timeline-position-normalized')
                    );

                    console.group('🔍 SkySphere Timeline Listeners Debug');
                    console.log('Total timeline listeners:', timelineListeners.length);
                    timelineListeners.forEach(([id, info]) => {
                        console.log(`- ${id}:`, info);
                    });
                    console.groupEnd();

                    return timelineListeners;
                },

                cleanupListeners: () => {
                    console.log('🧹 SkySphere: Nettoyage forcé des listeners...');
                    EventBus.off('timeline-position-normalized');
                    console.log('✅ Listeners timeline nettoyés');
                }
            };
        }

        return () => {
            if (typeof window !== 'undefined') {
                delete window.skySphereDEBUG;
            }
        };
    }, [currentEnvironment, targetEnvironment, isTransitioning, transitionProgress, textures, analyzeScrollState, smoothStep]);

    // Validation des textures avant le rendu
    if (!dayTexture || !goddessTexture || !nightTexture) {
        console.log('🌌 SkySphere: Attente des textures...');
        return null;
    }

    if (!currentMaterial) {
        console.log('🌌 SkySphere: Matériau principal non prêt...');
        return null;
    }

    return (
        <group>
            {/* Sphère principale (environnement actuel) */}
            <mesh ref={meshRef} material={currentMaterial}>
                <sphereGeometry args={[36.7, 64, 64]} />
            </mesh>

            {/* Sphère de transition (environnement cible) */}
            {isTransitioning && transitionMaterial && (
                <mesh ref={transitionMeshRef} material={transitionMaterial}>
                    <sphereGeometry args={[36.6, 64, 64]} />
                </mesh>
            )}
        </group>
    );
};

export default SkySphere;