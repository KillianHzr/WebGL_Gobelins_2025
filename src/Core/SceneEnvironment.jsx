import { useEffect, useRef, useState } from 'react';
import { useThree, useLoader, useFrame } from '@react-three/fiber';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EquirectangularReflectionMapping, Color } from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import { EventBus } from '../Utils/EventEmitter';

/**
 * Composant qui gère l'environment map dans la scène avec transitions fluides
 * Version simplifiée et fonctionnelle sans shader personnalisé
 */
const SceneEnvironment = () => {
    const { scene } = useThree();
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    // États pour les transitions fluides
    const [currentEnvironmentIndex, setCurrentEnvironmentIndex] = useState(0);

    // Références pour suivre l'état
    const guiInitializedRef = useRef(false);
    const transitionStateRef = useRef({
        isTransitioning: false,
        fromIndex: 0,
        toIndex: 0,
        progress: 0,
        targetProgress: 0
    });

    // Charger les environment maps
    const dayEnvMap = useLoader(RGBELoader, './textures/desktop/environmentMap/dayclouds.hdr');
    const goddessEnvMap = useLoader(RGBELoader, './textures/desktop/environmentMap/goddessclouds.hdr');
    const nightEnvMap = useLoader(RGBELoader, './textures/desktop/environmentMap/nightclouds.hdr');

    // Configuration de base pour l'environment
    const envConfigRef = useRef({
        enabled: true,
        enableAutoTransition: true,
        intensity: guiConfig.scene?.environment?.intensity?.default || 1,
        transitionSpeed: 0.02, // Vitesse de transition (0.001 = très lent, 0.1 = rapide)
        // Points de transition basés sur la timeline
        dayStart: guiConfig.scene?.environment?.timeline?.dayStart?.default || 0.0,
        goddessStart: guiConfig.scene?.environment?.timeline?.goddessStart?.default || 0.4,
        nightStart: guiConfig.scene?.environment?.timeline?.nightStart?.default || 0.7
    });

    // Mapper les environment maps et leurs noms
    const environmentMaps = [dayEnvMap, goddessEnvMap, nightEnvMap];
    const environmentNames = ['day', 'goddess', 'night'];

    // Initialiser les environment maps
    useEffect(() => {
        if (!scene || !dayEnvMap || !goddessEnvMap || !nightEnvMap) return;

        console.log('🌍 Initializing smooth environment transition system (simple version)...');

        // Configurer le mapping pour chaque environment map
        environmentMaps.forEach(envMap => {
            if (envMap) {
                envMap.mapping = EquirectangularReflectionMapping;
                envMap.flipY = false;
            }
        });

        // Initialiser avec l'environment par défaut
        scene.environment = dayEnvMap;
        scene.background = dayEnvMap;
        setCurrentEnvironmentIndex(0);

        // Vérification des textures chargées
        console.log('🌍 Environment maps status:', {
            day: dayEnvMap ? 'Loaded' : 'Failed',
            goddess: goddessEnvMap ? 'Loaded' : 'Failed',
            night: nightEnvMap ? 'Loaded' : 'Failed'
        });

        console.log('🌍 Simple environment system initialized successfully');

        // Nettoyage lors du démontage
        return () => {
            if (scene.environment) {
                scene.environment = null;
                scene.background = null;
            }
        };
    }, [scene, dayEnvMap, goddessEnvMap, nightEnvMap]);

    // Fonction pour déterminer l'environment ciblé selon la position
    const getTargetEnvironmentFromPosition = (progress) => {
        const config = envConfigRef.current;

        if (progress < config.goddessStart) {
            return 0; // day
        } else if (progress < config.nightStart) {
            return 1; // goddess
        } else {
            return 2; // night
        }
    };

    // Fonction pour déclencher une transition fluide
    const startTransition = (targetIndex) => {
        if (targetIndex === currentEnvironmentIndex) return;

        console.log(`🌍 Starting transition: ${environmentNames[currentEnvironmentIndex]} → ${environmentNames[targetIndex]}`);

        transitionStateRef.current = {
            isTransitioning: true,
            fromIndex: currentEnvironmentIndex,
            toIndex: targetIndex,
            progress: 0,
            targetProgress: 1
        };

        // Émettre un événement de début de transition
        EventBus.trigger('environment-transition-started', {
            from: environmentNames[currentEnvironmentIndex],
            to: environmentNames[targetIndex]
        });
    };

    // Animation frame pour gérer les transitions fluides
    useFrame((state, delta) => {
        const transition = transitionStateRef.current;

        if (!transition.isTransitioning) return;

        // Avancer la progression de la transition
        transition.progress += envConfigRef.current.transitionSpeed;

        if (transition.progress >= 1) {
            // Transition terminée
            transition.progress = 1;
            transition.isTransitioning = false;

            // Appliquer l'environment final
            const finalEnv = environmentMaps[transition.toIndex];
            if (finalEnv) {
                scene.environment = finalEnv;
                scene.background = finalEnv;
                setCurrentEnvironmentIndex(transition.toIndex);

                console.log(`🌍 Transition completed to: ${environmentNames[transition.toIndex]}`);

                // Émettre un événement de fin de transition
                EventBus.trigger('environment-transition-completed', {
                    from: environmentNames[transition.fromIndex],
                    to: environmentNames[transition.toIndex],
                    currentEnvironment: environmentNames[transition.toIndex]
                });
            }
        } else {
            // Transition en cours - créer un effet de fondu
            // Pour simuler un fondu, on peut jouer avec l'intensité ou changer directement
            // à mi-parcours pour un effet de transition rapide mais fluide
            if (transition.progress >= 0.5 && scene.environment !== environmentMaps[transition.toIndex]) {
                scene.environment = environmentMaps[transition.toIndex];
                scene.background = environmentMaps[transition.toIndex];
            }
        }
    });

    // Initialiser les contrôles GUI en mode debug
    useEffect(() => {
        if (debug?.active && gui && !guiInitializedRef.current) {
            // Trouver ou créer le dossier Scene
            let sceneFolder = gui.folders?.find(folder => folder.name === 'Scene');
            if (!sceneFolder) {
                sceneFolder = gui.addFolder('Scene');
            }

            // Créer un dossier pour l'environment
            const envFolder = sceneFolder.addFolder('Environment (Working)');

            // Objet pour le contrôle
            const envControls = {
                currentEnvironment: environmentNames[currentEnvironmentIndex],
                intensity: envConfigRef.current.intensity,
                transitionSpeed: envConfigRef.current.transitionSpeed,
                enableAutoTransition: envConfigRef.current.enableAutoTransition,
                testTransition: () => {
                    // Test de transition vers l'environment suivant
                    const nextIndex = (currentEnvironmentIndex + 1) % environmentNames.length;
                    startTransition(nextIndex);
                }
            };

            // Contrôle manuel d'environment
            envFolder.add(envControls, 'currentEnvironment', environmentNames)
                .name('Environment actuel')
                .onChange(value => {
                    const targetIndex = environmentNames.indexOf(value);
                    if (targetIndex !== -1) {
                        startTransition(targetIndex);
                    }
                });

            // Contrôle de l'intensité
            envFolder.add(envControls, 'intensity', 0, 3, 0.01)
                .name('Intensité')
                .onChange(value => {
                    envConfigRef.current.intensity = value;
                    // Note: L'intensité directe de l'environment map n'est pas disponible
                    // mais on peut l'utiliser pour des effets futurs
                });

            // Contrôle de la vitesse de transition
            envFolder.add(envControls, 'transitionSpeed', 0.001, 0.1, 0.001)
                .name('Vitesse transition')
                .onChange(value => {
                    envConfigRef.current.transitionSpeed = value;
                });

            // Contrôle des transitions automatiques
            envFolder.add(envControls, 'enableAutoTransition')
                .name('Transitions automatiques')
                .onChange(value => {
                    envConfigRef.current.enableAutoTransition = value;
                    console.log(`🌍 Transitions automatiques ${value ? 'activées' : 'désactivées'}`);
                });

            // Bouton de test
            envFolder.add(envControls, 'testTransition')
                .name('Test transition');

            // Contrôles de timeline
            const timelineFolder = envFolder.addFolder('Timeline');

            timelineFolder.add(envConfigRef.current, 'dayStart', 0, 1, 0.01)
                .name('Début jour')
                .onChange(() => {
                    console.log('🌍 Point de transition jour mis à jour:', envConfigRef.current.dayStart);
                });
            timelineFolder.add(envConfigRef.current, 'goddessStart', 0, 1, 0.01)
                .name('Début goddess')
                .onChange(() => {
                    console.log('🌍 Point de transition goddess mis à jour:', envConfigRef.current.goddessStart);
                });
            timelineFolder.add(envConfigRef.current, 'nightStart', 0, 1, 0.01)
                .name('Début night')
                .onChange(() => {
                    console.log('🌍 Point de transition night mis à jour:', envConfigRef.current.nightStart);
                });

            // Debug info
            const debugInfo = {
                currentProgress: 0,
                isTransitioning: false,
                transitionProgress: 0
            };

            timelineFolder.add(debugInfo, 'currentProgress', 0, 1, 0.001)
                .name('Position scroll')
                .listen();

            timelineFolder.add(debugInfo, 'isTransitioning')
                .name('En transition')
                .listen();

            timelineFolder.add(debugInfo, 'transitionProgress', 0, 1, 0.01)
                .name('Progrès transition')
                .listen();

            // Stocker les contrôleurs pour les mettre à jour
            envFolder.userData = { debugInfo, envControls };

            guiInitializedRef.current = true;
            console.log('🌍 GUI Environment initialisé (version fonctionnelle)');
        }
    }, [debug, gui, currentEnvironmentIndex]);

    // Écouter les événements de position de scroll depuis ScrollControls
    useEffect(() => {
        const handleTimelinePositionUpdate = (data) => {
            if (!envConfigRef.current.enableAutoTransition) return;

            const scrollProgress = data.position; // Position déjà normalisée (0-1)

            // Déterminer l'environment cible
            const targetIndex = getTargetEnvironmentFromPosition(scrollProgress);

            // Déclencher la transition si nécessaire
            if (targetIndex !== currentEnvironmentIndex && !transitionStateRef.current.isTransitioning) {
                startTransition(targetIndex);
            }

            // Mettre à jour les informations de debug si disponibles
            if (debug?.active && gui) {
                const envFolder = gui.folders?.find(folder => folder.name === 'Scene')?.folders?.find(folder => folder.name === 'Environment (Working)');
                if (envFolder?.userData) {
                    envFolder.userData.debugInfo.currentProgress = scrollProgress;
                    envFolder.userData.debugInfo.isTransitioning = transitionStateRef.current.isTransitioning;
                    envFolder.userData.debugInfo.transitionProgress = transitionStateRef.current.progress;
                    envFolder.userData.envControls.currentEnvironment = environmentNames[currentEnvironmentIndex];
                }
            }
        };

        // S'abonner aux événements de position de timeline
        const timelineSubscription = EventBus.on('timeline-position-normalized', handleTimelinePositionUpdate);

        return () => {
            timelineSubscription();
        };
    }, [currentEnvironmentIndex, debug, gui]);

    // Exposer les fonctions d'environment globalement
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.sceneEnvironment = {
                getCurrentEnvironment: () => environmentNames[currentEnvironmentIndex],
                getCurrentIndex: () => currentEnvironmentIndex,
                isTransitioning: () => transitionStateRef.current.isTransitioning,
                getTransitionProgress: () => transitionStateRef.current.progress,
                getAvailableEnvironments: () => environmentNames,
                forceTransition: (envName) => {
                    const index = environmentNames.indexOf(envName);
                    if (index !== -1) {
                        startTransition(index);
                        return true;
                    }
                    return false;
                },
                getTransitionPoints: () => ({
                    day: envConfigRef.current.dayStart,
                    goddess: envConfigRef.current.goddessStart,
                    night: envConfigRef.current.nightStart
                }),
                setTransitionPoint: (envName, value) => {
                    const key = `${envName}Start`;
                    if (envConfigRef.current[key] !== undefined) {
                        envConfigRef.current[key] = Math.max(0, Math.min(1, value));
                        console.log(`🌍 Point de transition ${envName} mis à jour: ${envConfigRef.current[key]}`);
                        return true;
                    }
                    return false;
                },
                setTransitionSpeed: (speed) => {
                    envConfigRef.current.transitionSpeed = Math.max(0.001, Math.min(0.1, speed));
                    console.log(`🌍 Vitesse de transition mise à jour: ${envConfigRef.current.transitionSpeed}`);
                },
                toggleAutoTransition: () => {
                    envConfigRef.current.enableAutoTransition = !envConfigRef.current.enableAutoTransition;
                    console.log(`🌍 Transitions automatiques ${envConfigRef.current.enableAutoTransition ? 'activées' : 'désactivées'}`);
                    return envConfigRef.current.enableAutoTransition;
                },
                // Diagnostics
                getStatus: () => ({
                    currentEnvironment: environmentNames[currentEnvironmentIndex],
                    currentIndex: currentEnvironmentIndex,
                    isTransitioning: transitionStateRef.current.isTransitioning,
                    transitionFrom: transitionStateRef.current.isTransitioning ? environmentNames[transitionStateRef.current.fromIndex] : null,
                    transitionTo: transitionStateRef.current.isTransitioning ? environmentNames[transitionStateRef.current.toIndex] : null,
                    transitionProgress: transitionStateRef.current.progress,
                    environmentsLoaded: {
                        day: !!dayEnvMap,
                        goddess: !!goddessEnvMap,
                        night: !!nightEnvMap
                    }
                }),
                testAllTransitions: () => {
                    console.log('🌍 Testing all transitions...');
                    let index = 0;
                    const testNext = () => {
                        if (index < environmentNames.length) {
                            console.log(`🌍 Testing transition to: ${environmentNames[index]}`);
                            startTransition(index);
                            index++;
                            setTimeout(testNext, 3000); // 3 secondes entre chaque test
                        } else {
                            console.log('🌍 All transitions tested');
                        }
                    };
                    testNext();
                }
            };

            console.log('🌍 SceneEnvironment: API fonctionnelle exposée via window.sceneEnvironment');
        }

        return () => {
            if (typeof window !== 'undefined') {
                delete window.sceneEnvironment;
            }
        };
    }, [currentEnvironmentIndex]);

    // Ce composant ne rend rien visuellement, il modifie uniquement scene.environment et scene.background
    return null;
};

export default SceneEnvironment;