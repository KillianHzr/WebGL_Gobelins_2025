import './Utils/GlobalLogger';
import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import useStore from './Store/useStore'
import CaptureInterface from './Utils/CaptureInterface.jsx'
import ScannerInterface from './Utils/ScannerInterface.jsx'
import BlackscreenInterface from "./Utils/BlackscreenInterface.jsx";
import ImageInterface from "./Utils/ImageInterface.jsx"
import VideoInterface from './Utils/VideoInterface.jsx'
import AssetManager from './Assets/AssetManager'
import { EventBus, EventEmitterProvider, MARKER_EVENTS } from './Utils/EventEmitter'
import ResponsiveLanding from './Utils/ResponsiveLanding'
import LoadingScreen from './Utils/LoadingScreen'
import MainLayout from './Utils/MainLayout'
import EndingLanding from './Utils/EndingLanding';
import { narrationManager } from './Utils/NarrationManager'
import RandomSoundDebugger from './Utils/RandomSoundDebugger';
import BonusSoundsDebugger from './Utils/BonusSoundsDebugger';
import CustomCursor from './Utils/CustomCursor';
import ScrollIndicator from './Utils/ScrollIndicator.jsx';

export default function App() {
    const { loaded, setLoaded, endingLandingVisible, debug } = useStore()
    const assetManagerRef = useRef(null)
    const [assetsLoaded, setAssetsLoaded] = useState(false)
    const [isAssetManagerInitialized, setIsAssetManagerInitialized] = useState(false)
    const [isDesktopView, setIsDesktopView] = useState(false)
    const [showExperience, setShowExperience] = useState(false)
    const [showMainLayout, setShowMainLayout] = useState(false)
    const [showEndingLanding, setShowEndingLanding] = useState(false)
    const [showVideoInterface, setShowVideoInterface] = useState(false)
    const [scene3DDisabled, setScene3DDisabled] = useState(false) // NOUVEAU: État pour désactiver complètement la 3D
    const canvasRef = useRef(null)
    const experienceRef = useRef(null) // NOUVEAU: Référence vers Experience
    const narrationEndedRef = useRef(false)

    // Fonction pour désactiver complètement la scène 3D
    const disable3DScene = () => {
        console.log('🚫 Désactivation complète de la scène 3D pour optimiser les performances...');

        try {
            // 1. Marquer la scène comme désactivée
            setScene3DDisabled(true);

            // 2. Cacher le canvas
            if (canvasRef.current) {
                canvasRef.current.style.display = 'none';
                canvasRef.current.style.visibility = 'hidden';
            }

            // 3. Arrêter tous les loops d'animation et de rendu
            if (window.animationFrameId) {
                cancelAnimationFrame(window.animationFrameId);
                window.animationFrameId = null;
            }

            // 4. Nettoyer les ressources Three.js si possible
            if (window.renderer) {
                console.log('🧹 Nettoyage du renderer Three.js...');

                // Arrêter le rendu
                window.renderer.setAnimationLoop(null);

                // Disposer des ressources
                if (window.renderer.dispose) {
                    window.renderer.dispose();
                }

                // Nettoyer le contexte WebGL
                const gl = window.renderer.getContext();
                if (gl && gl.getExtension('WEBGL_lose_context')) {
                    gl.getExtension('WEBGL_lose_context').loseContext();
                }
            }

            // 5. Nettoyer la scène Three.js
            if (window.scene) {
                console.log('🧹 Nettoyage de la scène Three.js...');

                // Traverser et disposer tous les objets
                window.scene.traverse((object) => {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                    if (object.texture) {
                        object.texture.dispose();
                    }
                });

                // Vider la scène
                while (window.scene.children.length > 0) {
                    window.scene.remove(window.scene.children[0]);
                }
            }

            // 6. Nettoyer les managers et caches
            if (window.textureManager && typeof window.textureManager.dispose === 'function') {
                window.textureManager.dispose();
            }

            if (window.forestLoadingComplete) {
                window.forestLoadingComplete = false;
            }

            // 7. Arrêter les sons d'ambiance pour économiser les ressources
            if (window.audioManager && typeof window.audioManager.stopNatureAmbience === 'function') {
                window.audioManager.stopNatureAmbience();
            }

            // 8. Forcer le garbage collection si disponible
            if (window.gc) {
                window.gc();
            }

            console.log('✅ Scène 3D complètement désactivée - performances optimisées pour l\'ending');

            // 9. Émettre un événement pour informer les autres composants
            EventBus.trigger('3d-scene-disabled', {
                timestamp: Date.now(),
                reason: 'ending-landing-active'
            });

        } catch (error) {
            console.error('❌ Erreur lors de la désactivation de la scène 3D:', error);
        }
    };

    // NOUVEAU: Fonction pour réactiver la scène 3D si nécessaire
    const enable3DScene = () => {
        console.log('🔄 Réactivation de la scène 3D...');

        setScene3DDisabled(false);

        if (canvasRef.current) {
            canvasRef.current.style.display = 'block';
            canvasRef.current.style.visibility = 'visible';
        }

        EventBus.trigger('3d-scene-enabled', {
            timestamp: Date.now()
        });
    };

    // Forcer le reload/réinitialisation de la caméra
    const forceReloadCamera = () => {
        console.log("🎥 FORCE RELOAD CAMERA: Starting camera system reload...");

        try {
            const store = useStore.getState();
            const cameraModel = store.cameraModel;

            if (!cameraModel) {
                if (window.assetManager && typeof window.assetManager.getItem === 'function') {
                    const freshCameraModel = window.assetManager.getItem('Camera');
                    if (freshCameraModel) {
                        console.log("🎥 FORCE RELOAD CAMERA: Found camera model in AssetManager");

                        const combinedModel = {
                            scene: freshCameraModel.scene?.clone() || freshCameraModel.scene,
                            animations: freshCameraModel.animations || []
                        };

                        store.setCameraModel(combinedModel);

                        EventBus.trigger('camera-glb-reloaded', {
                            cameraModel: combinedModel,
                            forced: true
                        });
                    }
                }
            } else {
                console.log("🎥 FORCE RELOAD CAMERA: Camera model found in store, triggering reload event");

                EventBus.trigger('camera-glb-reloaded', {
                    cameraModel: cameraModel,
                    forced: true
                });
            }

            EventBus.trigger('force-reinitialize-scroll-controls', {
                reason: 'camera-reload',
                timestamp: Date.now()
            });

            console.log("🎥 FORCE RELOAD CAMERA: Camera reload events triggered");

        } catch (error) {
            console.error("🎥 FORCE RELOAD CAMERA: Error during camera reload:", error);
        }
    };

    // Si nous sommes en mode debug avec skipIntro, afficher directement l'expérience
    useEffect(() => {
        if (debug?.skipIntro) {
            console.log("Debug mode: showing experience immediately");
            setShowExperience(true);

            if (canvasRef.current) {
                canvasRef.current.style.visibility = 'visible';
                canvasRef.current.focus();
            }

            setTimeout(() => {
                forceReloadCamera();
            }, 1000);

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

    // MODIFIÉ: Subscribe to ending landing visibility changes avec désactivation 3D
    useEffect(() => {
        setShowEndingLanding(endingLandingVisible || false);

        const unsubscribe = useStore.subscribe(
            state => state.endingLandingVisible,
            visible => {
                setShowEndingLanding(visible);

                if (visible) {
                    // NOUVEAU: Désactiver complètement la 3D quand l'ending landing est affiché
                    console.log('🎬 Ending landing affiché - désactivation de la scène 3D...');
                    setTimeout(() => {
                        disable3DScene();
                    }, 1000); // Délai pour permettre une transition fluide
                } else if (!visible && canvasRef.current && showExperience && !scene3DDisabled) {
                    // Réactiver seulement si la 3D n'est pas explicitement désactivée
                    canvasRef.current.style.visibility = 'visible';
                }
            }
        );

        return unsubscribe;
    }, [endingLandingVisible, showExperience, scene3DDisabled]);

    // Only initialize asset manager when in desktop view
    useEffect(() => {
        if (!isDesktopView) return;

        if (assetManagerRef.current && !isAssetManagerInitialized) {
            window.assetManager = assetManagerRef.current;
            console.log('AssetManager reference set to window.assetManager');
            setIsAssetManagerInitialized(true);
            window.EventBus = EventBus;
        }

        const handleForestSceneReady = () => {
            console.log("Forest scene fully loaded");
            setLoaded(true);
        };

        const forestSceneReadyUnsubscribe = EventBus.on('forest-scene-ready', handleForestSceneReady);

        return () => {
            forestSceneReadyUnsubscribe();
        };
    }, [isAssetManagerInitialized, setLoaded, isDesktopView]);

    // Écouteur d'événements pour les interactions avec les panneaux
    useEffect(() => {
        const handlePanelInteraction = (data) => {
            console.log("Événement d'interaction détecté:", data);

            const checkInteraction = (data, panelIds, narrationId) => {
                const possibleIdFields = [
                    data.requiredStep,
                    data.id,
                    data.markerId,
                    data.step
                ];

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

            checkInteraction(
                data,
                ['initialStartStop', 'DirectionPanelStartInteractive', 'DirectionPanel'],
                'Scene02_PanneauInformation'
            );

            checkInteraction(
                data,
                ['tenthStop', 'DigitalDirectionPanelEndInteractive', 'DigitalDirectionPanel'],
                'Scene09_ClairiereDigitalisee'
            );
        };

        const subscriptions = [
            EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handlePanelInteraction),
            EventBus.on('INTERACTION_COMPLETE', handlePanelInteraction),
            EventBus.on('marker:interaction:complete', handlePanelInteraction),
            EventBus.on('interaction-complete', handlePanelInteraction),
            EventBus.on(MARKER_EVENTS.MARKER_CLICK, handlePanelInteraction),
            EventBus.on('marker:click', handlePanelInteraction)
        ];

        console.log("Écouteurs d'événements pour les interactions des panneaux configurés");

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

        const subscriptions = [
            EventBus.on('*', handleAllEvents)
        ];

        return () => {
            subscriptions.forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
        };
    }, []);

    useEffect(() => {
        const originalTrigger = EventBus.trigger;

        EventBus.trigger = function(eventName, data) {
            const result = originalTrigger.call(this, eventName, data);

            if (eventName === MARKER_EVENTS.INTERACTION_COMPLETE ||
                eventName === 'INTERACTION_COMPLETE' ||
                eventName === 'marker:interaction:complete' ||
                (typeof eventName === 'string' && eventName.indexOf && eventName.indexOf('interaction:complete') !== -1)) {

                console.log(`[EventBus] Événement capturé: ${eventName}`, data);

                if (data && (
                    (data.requiredStep === 'initialStartStop') ||
                    (data.id && (data.id === 'initialStartStop' || data.id.includes('DirectionPanel')))
                )) {
                    console.log("Long press sur le panneau d'information détecté - lancement narration");
                    setTimeout(() => {
                        narrationManager.playNarration('Scene02_PanneauInformation');
                    }, 100);
                }

                if (data && (
                    (data.requiredStep === 'tenthStop') ||
                    (data.id && (data.id === 'tenthStop' || data.id.includes('DigitalDirectionPanel')))
                )) {
                    console.log("Long press sur le panneau digital détecté - lancement narration");
                    setTimeout(() => {
                        narrationManager.playNarration('Scene09_ClairiereDigitalisee');
                    }, 100);
                }
            }

            return result;
        };

        return () => {
            EventBus.trigger = originalTrigger;
        };
    }, []);

    useEffect(() => {
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

        window.forceReloadCamera = forceReloadCamera;
        window.useStore = useStore;

        // Exposer les fonctions de contrôle 3D
        window.disable3DScene = disable3DScene;
        window.enable3DScene = enable3DScene;
    }, []);

    const onAssetsReady = () => {
        if (assetsLoaded) {
            return;
        }
        console.log("Assets ready callback triggered");
        setAssetsLoaded(true);
        EventBus.trigger('assetsInitialized', { count: assetManagerRef.current?.assetsToLoad?.length || 0 });
    };

    const handleEnterExperience = () => {
        console.log("User entered experience - preparing video transition");
        narrationEndedRef.current = false;

        setShowExperience(false);
        setShowVideoInterface(true);

        // Jouer le son radio-on au début de la vidéo
        if (window.audioManager && typeof window.audioManager.playSound === 'function') {
            window.audioManager.playSound('radio-on');
            console.log("Playing radio on sound before video");
        }
    };

    const handleVideoEnd = () => {
        console.log("Video ended, proceeding to 3D scene");

        setShowVideoInterface(false);
        narrationEndedRef.current = true;

        // Jouer le son radio-off à la fin de la vidéo
        if (window.audioManager && typeof window.audioManager.playSound === 'function') {
            window.audioManager.playSound('radio-off');
            console.log("Playing radio off sound after video");
        }

        setTimeout(() => {
            console.log("Radio off sound complete, proceeding to 3D scene");

            console.log("🎥 FORCING CAMERA RELOAD BEFORE SHOWING 3D SCENE");
            forceReloadCamera();

            setShowExperience(true);

            if (canvasRef.current) {
                canvasRef.current.focus();
            }

            setTimeout(() => {
                if (window.audioManager && typeof window.audioManager.playNatureAmbience === 'function') {
                    console.log("Starting nature ambience after camera reload and video");
                    window.audioManager.playNatureAmbience(3000);
                }

                setTimeout(() => {
                    narrationManager.playNarration('Scene01_Mission');
                    console.log("Lecture de la narration Scene01_Mission après transition et camera reload");
                }, 2000);
            }, 1500);
        }, 1000);
    };

    const handleLearnMore = () => {
        window.open('https://www.laquadrature.net/donner/', '_blank');
    };

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
            <CustomCursor />
            <AssetManager
                ref={assetManagerRef}
                onReady={onAssetsReady}
                key="assetManager"
            />

            {!showExperience && !debug?.skipIntro && (
                <LoadingScreen onComplete={handleEnterExperience} />
            )}

            {showVideoInterface && (
                <VideoInterface
                    isVisible={showVideoInterface}
                    videoSrc="/videos/Scene00_Intro.mov"
                    onVideoEnd={handleVideoEnd}
                    autoPlay={true}
                    muted={false}
                />
            )}

            {showMainLayout && <MainLayout />}

            {showEndingLanding && (
                <EndingLanding onLearnMore={handleLearnMore} />
            )}

            {/* Interfaces - seulement si la 3D n'est pas désactivée */}
            {showExperience && !scene3DDisabled && (
                <>
                    <BlackscreenInterface/>
                    <CaptureInterface />
                    <ScannerInterface />
                    <ImageInterface />
                    <ScrollIndicator />
                </>
            )}

            {/* Canvas pour le contenu 3D - conditionnel */}
            {!scene3DDisabled && (
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
                        gl={{
                            preserveDrawingBuffer: true,
                            // NOUVEAU: Optimisations WebGL pour meilleures performances
                            antialias: false, // Désactiver l'antialiasing pour de meilleures perfs
                            alpha: false,     // Pas besoin de transparence
                            depth: true,      // Garder le depth buffer
                            stencil: false,   // Désactiver le stencil buffer
                            powerPreference: "high-performance" // Privilégier les performances
                        }}
                        shadows
                        // NOUVEAU: Configuration optimisée pour les performances
                        dpr={Math.min(window.devicePixelRatio, 2)} // Limiter le pixel ratio
                        performance={{ min: 0.5 }} // Ajustement automatique des performances
                    >
                        <Experience ref={experienceRef} />
                    </Canvas>
                </div>
            )}

            {scene3DDisabled && (
                <div style={{
                    position: 'fixed',
                    bottom: '10px',
                    right: '10px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    zIndex: 1000,
                    pointerEvents: 'none'
                }}>
                    🚫 Scène 3D désactivée pour optimiser les performances
                </div>
            )}

            <RandomSoundDebugger />
            <BonusSoundsDebugger />
        </EventEmitterProvider>
    )
}