import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { MeshBasicMaterial, BackSide, EquirectangularReflectionMapping } from 'three';
import { useMemo, useRef, useState, useEffect } from 'react';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EventBus } from '../Utils/EventEmitter';

const SkySphere = () => {
    const { camera } = useThree();
    const meshRef = useRef();

    // État pour l'environnement actuel et forcer les re-renders
    const [currentEnvironment, setCurrentEnvironment] = useState('day');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);

    // NOUVEAU: Configuration des seuils de progression pour chaque environnement
    const ENVIRONMENT_THRESHOLDS = {
        day: { min: 0.0, max: 0.35 },      // 0% à 35%
        goddess: { min: 0.35, max: 0.70 }, // 35% à 70%
        night: { min: 0.70, max: 1.0 }     // 70% à 100%
    };

    // Référence pour éviter les synchronisations inutiles
    const lastSyncedEnvironment = useRef('day');
    const isInitialized = useRef(false);
    const lastScrollProgress = useRef(0);

    // Charger les trois textures d'environnement
    const dayTexture = useLoader(RGBELoader, './textures/desktop/environmentMap/dayclouds.hdr');
    const goddessTexture = useLoader(RGBELoader, './textures/desktop/environmentMap/godnessclouds.hdr');
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
        console.log('🌌 SkySphere: Textures configurées pour les transitions (flipY=false)');
    }, [textures]);

    // NOUVEAU: Fonction pour déterminer l'environnement basé sur la progression du scroll
    const getEnvironmentFromProgress = (normalizedProgress) => {
        if (normalizedProgress >= ENVIRONMENT_THRESHOLDS.night.min) {
            return 'night';
        } else if (normalizedProgress >= ENVIRONMENT_THRESHOLDS.goddess.min) {
            return 'goddess';
        } else {
            return 'day';
        }
    };

    // Fonction pour changer d'environnement et forcer le re-render
    const changeEnvironment = (newEnvironment, source = 'unknown') => {
        if (newEnvironment !== currentEnvironment) {
            console.log(`🌌 SkySphere: Changement d'environnement ${currentEnvironment} → ${newEnvironment} (source: ${source})`);

            // Émettre un événement de début de transition
            EventBus.trigger('environment-transition-started', {
                from: currentEnvironment,
                to: newEnvironment,
                source: source
            });

            setCurrentEnvironment(newEnvironment);
            lastSyncedEnvironment.current = newEnvironment;
            setForceUpdate(prev => prev + 1); // Force le re-render du matériau

            // Émettre un événement de fin de transition après un court délai
            setTimeout(() => {
                EventBus.trigger('environment-transition-completed', {
                    to: newEnvironment,
                    source: source
                });
            }, 100);
        }
    };

    // Créer un NOUVEAU matériau à chaque changement d'environnement
    const material = useMemo(() => {
        const currentTexture = textures[currentEnvironment];
        if (!currentTexture) {
            console.warn(`🌌 SkySphere: Texture non trouvée pour l'environnement ${currentEnvironment}`);
            return null;
        }

        // Créer un nouveau matériau à chaque fois
        const newMaterial = new MeshBasicMaterial({
            map: currentTexture,
            side: BackSide,
        });

        console.log(`🌌 SkySphere: NOUVEAU matériau créé avec texture ${currentEnvironment}`);
        return newMaterial;
    }, [textures, currentEnvironment, forceUpdate]); // Dépend de forceUpdate pour recréer

    // Mettre à jour directement le mesh quand le matériau change
    useEffect(() => {
        if (meshRef.current && material) {
            // Disposer de l'ancien matériau s'il existe
            if (meshRef.current.material && meshRef.current.material !== material) {
                meshRef.current.material.dispose();
            }

            // Assigner le nouveau matériau directement
            meshRef.current.material = material;
            meshRef.current.material.needsUpdate = true;

            console.log(`🌌 SkySphere: Matériau assigné directement au mesh pour ${currentEnvironment}`);
        }
    }, [material, currentEnvironment]);

    // MODIFIÉ: Écouter la progression normalisée du scroll pour changer automatiquement d'environnement
    useEffect(() => {
        const handleTimelinePosition = (data) => {
            const { position: normalizedPosition } = data;

            // Éviter les mises à jour trop fréquentes
            if (Math.abs(normalizedPosition - lastScrollProgress.current) < 0.01) {
                return;
            }

            lastScrollProgress.current = normalizedPosition;

            // Déterminer le nouvel environnement basé sur la progression
            const newEnvironment = getEnvironmentFromProgress(normalizedPosition);

            // Changer l'environnement si nécessaire
            if (newEnvironment !== currentEnvironment && !isTransitioning) {
                console.log(`🌌 SkySphere: Transition automatique à ${(normalizedPosition * 100).toFixed(1)}% → ${newEnvironment}`);
                changeEnvironment(newEnvironment, 'scroll-progress');
            }
        };

        const unsubscribeTimeline = EventBus.on('timeline-position-normalized', handleTimelinePosition);

        return () => {
            unsubscribeTimeline();
        };
    }, [currentEnvironment, isTransitioning]);

    // Synchronisation initiale optimisée avec SceneEnvironment (garde le système existant en backup)
    useEffect(() => {
        if (!isInitialized.current) {
            const checkAndSync = () => {
                if (typeof window !== 'undefined' && window.sceneEnvironment) {
                    const currentEnv = window.sceneEnvironment.getCurrentEnvironment();
                    if (currentEnv && currentEnv !== currentEnvironment) {
                        console.log(`🌌 SkySphere: Synchronisation initiale avec ${currentEnv}`);
                        changeEnvironment(currentEnv, 'scene-environment-sync');
                    }
                    isInitialized.current = true;
                    return true;
                }
                return false;
            };

            if (!checkAndSync()) {
                const syncInterval = setInterval(() => {
                    if (checkAndSync()) {
                        clearInterval(syncInterval);
                    }
                }, 500);

                setTimeout(() => {
                    clearInterval(syncInterval);
                    if (!isInitialized.current) {
                        console.warn('🌌 SkySphere: Timeout de synchronisation avec SceneEnvironment');
                        isInitialized.current = true;
                    }
                }, 10000);

                return () => clearInterval(syncInterval);
            }
        }
    }, [currentEnvironment]);

    // Écouter les événements de transition d'environnement (garde le système existant)
    useEffect(() => {
        const handleTransitionStarted = (data) => {
            console.log(`🌌 SkySphere: Début de transition ${data.from} → ${data.to} (source: ${data.source || 'unknown'})`);
            setIsTransitioning(true);

            // Changer immédiatement vers la nouvelle texture seulement si ce n'est pas notre propre événement
            if (data.source !== 'scroll-progress') {
                changeEnvironment(data.to, 'external-event');
            }
        };

        const handleTransitionCompleted = (data) => {
            console.log(`🌌 SkySphere: Transition terminée vers ${data.to} (source: ${data.source || 'unknown'})`);
            setIsTransitioning(false);

            // S'assurer que nous sommes dans le bon état final seulement si ce n'est pas notre propre événement
            if (data.source !== 'scroll-progress') {
                changeEnvironment(data.to, 'external-event-complete');
            }
        };

        // S'abonner aux événements
        const unsubscribeStart = EventBus.on('environment-transition-started', handleTransitionStarted);
        const unsubscribeComplete = EventBus.on('environment-transition-completed', handleTransitionCompleted);

        return () => {
            unsubscribeStart();
            unsubscribeComplete();
        };
    }, [currentEnvironment]);

    // Mettre à jour la position de la sphère pour qu'elle suive la caméra
    useFrame(() => {
        if (meshRef.current && camera) {
            meshRef.current.position.copy(camera.position);
        }
    });

    // MODIFIÉ: Exposer les fonctions de debug globalement avec nouvelles informations
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.skySphereDEBUG = {
                getCurrentEnvironment: () => currentEnvironment,
                isTransitioning: () => isTransitioning,
                getLastSyncedEnvironment: () => lastSyncedEnvironment.current,
                isInitialized: () => isInitialized.current,
                getTexturesStatus: () => ({
                    day: !!dayTexture,
                    goddess: !!goddessTexture,
                    night: !!nightTexture
                }),
                getCurrentMaterial: () => meshRef.current?.material,
                getCurrentTexture: () => meshRef.current?.material?.map,
                forceSync: () => {
                    if (window.sceneEnvironment) {
                        const sceneEnv = window.sceneEnvironment.getCurrentEnvironment();
                        if (sceneEnv) {
                            changeEnvironment(sceneEnv, 'force-sync');
                            console.log(`🌌 SkySphere: Synchronisation forcée vers ${sceneEnv}`);
                        }
                    }
                },
                forceUpdateTexture: (envName) => {
                    if (textures[envName]) {
                        changeEnvironment(envName, 'force-update');
                        console.log(`🌌 SkySphere: Texture forcée vers ${envName}`);
                    }
                },
                getMeshRef: () => meshRef.current,
                getForceUpdateCounter: () => forceUpdate,
                // NOUVEAU: Fonctions de debug pour le système basé sur le scroll
                getEnvironmentThresholds: () => ENVIRONMENT_THRESHOLDS,
                getEnvironmentFromProgress: (progress) => getEnvironmentFromProgress(progress),
                getCurrentScrollProgress: () => lastScrollProgress.current,
                testProgressTransition: (progress) => {
                    const env = getEnvironmentFromProgress(progress);
                    changeEnvironment(env, 'test');
                    console.log(`🌌 SkySphere: Test transition à ${(progress * 100).toFixed(1)}% → ${env}`);
                }
            };
        }

        return () => {
            if (typeof window !== 'undefined') {
                delete window.skySphereDEBUG;
            }
        };
    }, [currentEnvironment, isTransitioning, textures, forceUpdate]);

    // Ne pas rendre si les textures ne sont pas chargées
    if (!dayTexture || !goddessTexture || !nightTexture) {
        console.log('🌌 SkySphere: Attente des textures...');
        return null;
    }

    // Ne pas rendre si le matériau n'est pas prêt
    if (!material) {
        console.log('🌌 SkySphere: Matériau non prêt...');
        return null;
    }

    return (
        <mesh ref={meshRef} material={material}>
            <sphereGeometry args={[37.5, 64, 64]} />
        </mesh>
    );
};

export default SkySphere;