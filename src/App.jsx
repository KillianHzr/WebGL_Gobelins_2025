import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import useStore from './Store/useStore'
import CaptureInterface from './Utils/CaptureInterface.jsx'
import ScannerInterface from './Utils/ScannerInterface.jsx'
import BlackscreenInterface from "./Utils/BlackscreenInterface.jsx";
import ImageInterface from "./Utils/ImageInterface.jsx"
import AssetManager from './Assets/AssetManager'
import { EventBus, EventEmitterProvider, MARKER_EVENTS } from './Utils/EventEmitter'
import ResponsiveLanding from './Utils/ResponsiveLanding'
import LoadingScreen from './Utils/LoadingScreen'
import MainLayout from './Utils/MainLayout'
import EndingLanding from './Utils/EndingLanding';
import { narrationManager } from './Utils/NarrationManager'
import RandomSoundDebugger from './Utils/RandomSoundDebugger';
import CustomCursor from './Utils/CustomCursor'; // Add this import

export default function App() {
    const { loaded, setLoaded, endingLandingVisible, debug } = useStore()
    const assetManagerRef = useRef(null)
    const [assetsLoaded, setAssetsLoaded] = useState(false)
    const [isAssetManagerInitialized, setIsAssetManagerInitialized] = useState(false)
    const [isDesktopView, setIsDesktopView] = useState(false)
    const [showExperience, setShowExperience] = useState(false)
    const [showMainLayout, setShowMainLayout] = useState(false)
    const [showEndingLanding, setShowEndingLanding] = useState(false)
    const canvasRef = useRef(null)
    const narrationEndedRef = useRef(false)

    // Si nous sommes en mode debug avec skipIntro, afficher directement l'expérience
    useEffect(() => {
        if (debug?.skipIntro) {
            console.log("Debug mode: showing experience immediately");
            setShowExperience(true);

            // Mettre canvasRef visible immédiatement aussi
            if (canvasRef.current) {
                canvasRef.current.style.visibility = 'visible';
                canvasRef.current.focus();
            }

            // On peut aussi déclencher directement la narration Scene01_Mission si nécessaire
            setTimeout(() => {
                narrationManager.playNarration('Scene01_Mission');
            }, 500);
        }
    }, [debug]);

    // Check viewport width on mount and resize
    useEffect(() => {
        const checkViewport = () => {
            setIsDesktopView(window.innerWidth >= 992);
        };

        checkViewport();

        window.addEventListener('resize', checkViewport);

        return () => window.removeEventListener('resize', checkViewport);
    }, []);

    // Subscribe to ending landing visibility changes
    useEffect(() => {
        // Set initial state
        setShowEndingLanding(endingLandingVisible || false);

        // Subscribe to store changes
        const unsubscribe = useStore.subscribe(
            state => state.endingLandingVisible,
            visible => {
                setShowEndingLanding(visible);
                // When showing ending, hide the experience
                if (visible && canvasRef.current) {
                    canvasRef.current.style.visibility = 'hidden';
                } else if (!visible && canvasRef.current && showExperience) {
                    canvasRef.current.style.visibility = 'visible';
                }
            }
        );

        return unsubscribe;
    }, [endingLandingVisible, showExperience]);

    // Only initialize asset manager when in desktop view
    useEffect(() => {
        if (!isDesktopView) return;

        // Créer une référence globale à l'AssetManager
        if (assetManagerRef.current && !isAssetManagerInitialized) {
            window.assetManager = assetManagerRef.current;
            console.log('AssetManager reference set to window.assetManager');
            setIsAssetManagerInitialized(true);

            // Make EventBus globally available for LoadingManager
            window.EventBus = EventBus;
        }

        // Émettre un événement pour prévenir quand
        // les composants que les assets sont prêts
        const handleForestSceneReady = () => {
            console.log("Forest scene fully loaded");
            setLoaded(true);
        };

        // S'abonner à l'événement 'forest-scene-ready'
        const forestSceneReadyUnsubscribe = EventBus.on('forest-scene-ready', handleForestSceneReady);

        return () => {
            forestSceneReadyUnsubscribe();
        };
    }, [isAssetManagerInitialized, setLoaded, isDesktopView]);

    // Écouteur d'événements pour les interactions avec les panneaux
    useEffect(() => {
        // Fonction plus robuste avec plus de debugging
        const handlePanelInteraction = (data) => {
            console.log("Événement d'interaction détecté:", data);

            // Vérifier les identifiants sous différentes formes possibles
            const checkInteraction = (data, panelIds, narrationId) => {
                // Vérifier plusieurs propriétés possibles qui pourraient contenir l'identifiant
                const possibleIdFields = [
                    data.requiredStep,
                    data.id,
                    data.markerId,
                    data.step
                ];

                // Vérifier si l'un des identifiants correspond à l'un des panelIds
                for (const field of possibleIdFields) {
                    if (!field) continue;

                    for (const panelId of panelIds) {
                        if (field === panelId || field.includes(panelId)) {
                            console.log(`Match trouvé pour ${panelId} - Lancement narration ${narrationId}`);
                            narrationManager.playNarration(narrationId);
                            return true;
                        }
                    }
                }
                return false;
            };

            // Essayer pour le panneau de départ (plusieurs identifiants possibles)
            checkInteraction(
                data,
                ['initialStartStop', 'DirectionPanelStartInteractive', 'DirectionPanel'],
                'Scene02_PanneauInformation'
            );

            // Essayer pour le panneau digital (plusieurs identifiants possibles)
            checkInteraction(
                data,
                ['tenthStop', 'DigitalDirectionPanelEndInteractive', 'DigitalDirectionPanel'],
                'Scene09_ClairiereDigitalisee'
            );
        };

        // Écouter TOUS les événements possiblement liés aux interactions
        const subscriptions = [
            EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handlePanelInteraction),
            EventBus.on('INTERACTION_COMPLETE', handlePanelInteraction), // Format alternatif
            EventBus.on('marker:interaction:complete', handlePanelInteraction), // Format alternatif
            EventBus.on('interaction-complete', handlePanelInteraction), // Format alternatif

            // Écouter aussi l'événement de clic qui pourrait être émis avant l'interaction complète
            EventBus.on(MARKER_EVENTS.MARKER_CLICK, handlePanelInteraction),
            EventBus.on('marker:click', handlePanelInteraction)
        ];

        // Journalisation pour débugger
        console.log("Écouteurs d'événements pour les interactions des panneaux configurés");
        console.log("MARKER_EVENTS.INTERACTION_COMPLETE =", MARKER_EVENTS.INTERACTION_COMPLETE);

        // Nettoyage de tous les écouteurs
        return () => {
            subscriptions.forEach(unsub => {
                if (typeof unsub === 'function') {
                    unsub();
                }
            });
        };
    }, []);

    useEffect(() => {
        const handleAllEvents = (data) => {
            // Filtrer pour ne voir que les événements liés aux interactions
            if (data && (
                (typeof data.id === 'string' && (
                    data.id.includes('Direction') ||
                    data.id.includes('Stop') ||
                    data.id.includes('Panel')
                )) ||
                (typeof data.requiredStep === 'string' && (
                    data.requiredStep.includes('Stop') ||
                    data.requiredStep.includes('initialStart')
                ))
            )) {
                console.log("Événement potentiellement intéressant:", EventBus.getActiveListeners());
            }
        };

        // Ajouter des écouteurs pour plusieurs événements génériques
        const subscriptions = [
            EventBus.on('*', handleAllEvents) // Wildcard (si supporté)
        ];

        // Nettoyage
        return () => {
            subscriptions.forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
        };
    }, []);

    useEffect(() => {
        // Sauvegarde de la fonction trigger originale
        const originalTrigger = EventBus.trigger;

        // Remplacement par notre fonction augmentée
        EventBus.trigger = function(eventName, data) {
            // Appel de la fonction originale d'abord
            const result = originalTrigger.call(this, eventName, data);

            // Maintenant, notre logique spécifique
            if (eventName === MARKER_EVENTS.INTERACTION_COMPLETE ||
                eventName === 'INTERACTION_COMPLETE' ||
                eventName === 'marker:interaction:complete' ||
                (typeof eventName === 'string' && eventName.indexOf && eventName.indexOf('interaction:complete') !== -1)) {

                console.log(`[EventBus] Événement capturé: ${eventName}`, data);

                // Pour le panneau de départ
                if (data && (
                    (data.requiredStep === 'initialStartStop') ||
                    (data.id && (data.id === 'initialStartStop' || data.id.includes('DirectionPanel')))
                )) {
                    console.log("Long press sur le panneau d'information détecté - lancement narration");
                    // Léger délai pour éviter les conflits
                    setTimeout(() => {
                        narrationManager.playNarration('Scene02_PanneauInformation');
                    }, 100);
                }

                // Pour le panneau digital
                if (data && (
                    (data.requiredStep === 'tenthStop') ||
                    (data.id && (data.id === 'tenthStop' || data.id.includes('DigitalDirectionPanel')))
                )) {
                    console.log("Long press sur le panneau digital détecté - lancement narration");
                    // Léger délai pour éviter les conflits
                    setTimeout(() => {
                        narrationManager.playNarration('Scene09_ClairiereDigitalisee');
                    }, 100);
                }
            }

            return result;
        };

        // Nettoyage - restaurer la fonction originale
        return () => {
            EventBus.trigger = originalTrigger;
        };
    }, []);

    useEffect(() => {
        // Exposer via window pour débug et accès direct
        window.playPanelNarrations = {
            startPanel: () => {
                console.log("Lancement manuel de la narration du panneau de départ");
                narrationManager.playNarration('Scene02_PanneauInformation');
            },
            digitalPanel: () => {
                console.log("Lancement manuel de la narration du panneau digital");
                narrationManager.playNarration('Scene09_ClairiereDigitalisee');
            }
        };
    }, []);
    
    const onAssetsReady = () => {
        // Callback passé au AssetManager
        if (assetsLoaded) {
            return;
        }
        console.log("Assets ready callback triggered");
        setAssetsLoaded(true);

        // Émettre un événement pour le LoadingManager
        EventBus.trigger('assetsInitialized', { count: assetManagerRef.current?.assetsToLoad?.length || 0 });
    };

    // Callback when user clicks "Découvre ta mission" button
    // Dans App.jsx, modifiez la fonction handleEnterExperience comme suit
    const handleEnterExperience = () => {
        console.log("User entered experience - preparing transition");
        narrationEndedRef.current = false;

        // Set a flag to show the black screen transition
        setShowExperience(false);

        // Set up the black screen transition first
        setTimeout(() => {
            console.log("Black screen transition in progress - preparing to play radio on sound");

            // Jouer le son radio_on.wav
            if (window.audioManager && typeof window.audioManager.playSound === 'function') {
                window.audioManager.playSound('radio-on');
                console.log("Playing radio on sound");
            }

            // Attendre 1 seconde avant de jouer la première narration
            setTimeout(() => {
                console.log("Delay complete, playing Scene00_Radio1 narration");

                // Set up a listener for the narration ended event
                const narrationEndedListener = EventBus.on('narration-ended', (data) => {
                    if (data && data.narrationId === 'Scene00_Radio1') {
                        console.log("Scene00_Radio1 narration completed, playing Scene00_Radio2 after delay");

                        // Attendre 1 seconde avant de jouer Scene00_Radio2
                        setTimeout(() => {
                            narrationManager.playNarration('Scene00_Radio2');
                            console.log("Lecture de la narration Scene00_Radio2");
                        }, 500);
                    }
                    else if (data && data.narrationId === 'Scene00_Radio2') {
                        console.log("Scene00_Radio2 narration completed, playing radio off sound");

                        // Jouer le son radio_off.wav après la fin de la deuxième narration
                        if (window.audioManager && typeof window.audioManager.playSound === 'function') {
                            window.audioManager.playSound('radio-off');
                            console.log("Playing radio off sound");
                        }

                        // Attendre que le son radio off se termine avant de continuer
                        setTimeout(() => {
                            console.log("Radio off sound complete, proceeding to 3D scene");
                            narrationEndedRef.current = true;

                            // Transition to 3D scene after narration ends
                            setShowExperience(true);

                            // Focus on canvas after showing it
                            if (canvasRef.current) {
                                canvasRef.current.focus();
                            }

                            // Démarrer l'ambiance nature en fondu
                            if (audioManager && typeof audioManager.playNatureAmbience === 'function') {
                                console.log("Starting nature ambience after radio narrations");
                                audioManager.playNatureAmbience(3000); // Fondu sur 3 secondes
                            }

                            // Play the next narration after showing the 3D scene
                            setTimeout(() => {
                                narrationManager.playNarration('Scene01_Mission');
                                console.log("Lecture de la narration Scene01_Mission après transition");
                            }, 2000);
                        }, 1000); // Attendre 1 seconde pour le son radio off
                    }
                });

                // Play the Scene00_Radio1 narration
                narrationManager.playNarration('Scene00_Radio1');
                console.log("Lecture de la narration Scene00_Radio1 pendant l'écran noir");

                // Fallback in case the narration-ended events aren't fired
                // Augmenter la durée pour tenir compte des deux narrations + délai
                const defaultDuration = 60000; // 60 seconds in ms
                setTimeout(() => {
                    if (!narrationEndedRef.current) {
                        console.log("Fallback: Scene00_Radio narrations didn't fire ended events, proceeding anyway");
                        narrationEndedRef.current = true;

                        // Transition to 3D scene after the fallback duration
                        setShowExperience(true);

                        // Focus on canvas after showing it
                        if (canvasRef.current) {
                            canvasRef.current.focus();
                        }

                        // Play the next narration after showing the 3D scene
                        setTimeout(() => {
                            narrationManager.playNarration('Scene01_Mission');
                            console.log("Lecture de la narration Scene01_Mission après transition (fallback)");
                        }, 2000);
                    }
                }, defaultDuration);
            }, 1000); // Délai d'1 seconde avant de jouer la première narration
        }, 800); // This should match when the black screen is at full opacity
    };

    // Handle the "learn more" button click in ending landing
    const handleLearnMore = () => {
        // Open the Gobelins website in a new tab
        window.open('https://www.gobelins.fr/', '_blank');
    };

    // Show MainLayout when loading is complete (on landing page)
    useEffect(() => {
        if (assetsLoaded) {
            console.log("Assets loaded - showing MainLayout");
            setShowMainLayout(true);
        }
    }, [assetsLoaded]);

    if (!isDesktopView) {
        return <ResponsiveLanding />;
    }

    return (
        <EventEmitterProvider>
            {/* Asset Manager component */}
            <CustomCursor />
            <AssetManager
                ref={assetManagerRef}
                onReady={onAssetsReady}
                key="assetManager" // Clé stable pour éviter les remontages
            />

            {/* Loading Screen and Desktop Landing */}
            {!showExperience && !debug?.skipIntro && (
                <LoadingScreen onComplete={handleEnterExperience} />
            )}

            {/* Main Layout - only show after assets are loaded */}
            {showMainLayout && <MainLayout />}

            {/* Ending Landing - shows when triggered */}
            {showEndingLanding && (
                <EndingLanding onLearnMore={handleLearnMore} />
            )}

            {/* Interfaces - only show when experience is visible */}
            {showExperience && (
                <>
                    <BlackscreenInterface/>
                    <CaptureInterface />
                    <ScannerInterface />
                    <ImageInterface />
                </>
            )}

            {/* Canvas for 3D content */}
            <div
                ref={canvasRef}
                style={{
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    visibility: showExperience ? 'visible' : 'hidden',
                    opacity: showExperience ? 1 : 0,
                    transition: 'opacity 1s ease',
                    transitionDelay: '0.5s',
                    zIndex: 2,
                    backgroundColor: '#000'
                }}
                tabIndex={0}
            >
                <Canvas
                    style={{
                        backgroundColor: '#000',
                    }}
                    gl={{ preserveDrawingBuffer: true }}
                    shadows
                >
                    <Experience />
                </Canvas>
            </div>
            <RandomSoundDebugger />
        </EventEmitterProvider>
    )
}