import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import useStore from './Store/useStore'
import CaptureInterface from './Utils/CaptureInterface.jsx'
import ScannerInterface from './Utils/ScannerInterface.jsx'
import BlackscreenInterface from "./Utils/BlackscreenInterface.jsx";
import AssetManager from './Assets/AssetManager'
import { EventBus, EventEmitterProvider } from './Utils/EventEmitter'
import ResponsiveLanding from './Utils/ResponsiveLanding'
import LoadingScreen from './Utils/LoadingScreen'
import MainLayout from './Utils/MainLayout'
import EndingLanding from './Utils/EndingLanding';
import { narrationManager } from './Utils/NarrationManager'

export default function App() {
    const { loaded, setLoaded, endingLandingVisible } = useStore()
    const assetManagerRef = useRef(null)
    const [assetsLoaded, setAssetsLoaded] = useState(false)
    const [isAssetManagerInitialized, setIsAssetManagerInitialized] = useState(false)
    const [isDesktopView, setIsDesktopView] = useState(false)
    const [showExperience, setShowExperience] = useState(false)
    const [showMainLayout, setShowMainLayout] = useState(false)
    const [showEndingLanding, setShowEndingLanding] = useState(false)
    const canvasRef = useRef(null)
    const narrationEndedRef = useRef(false)

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
    const handleEnterExperience = () => {
        console.log("User entered experience - preparing transition");
        narrationEndedRef.current = false;

        // Set a flag to show the black screen transition
        setShowExperience(false);

        // Set up the black screen transition first
        setTimeout(() => {
            console.log("Black screen transition in progress - preparing to play Scene00_Radio");

            // Set up a listener for the narration ended event
            const narrationEndedListener = EventBus.on('narration-ended', (data) => {
                if (data && data.narrationId === 'Scene00_Radio') {
                    console.log("Scene00_Radio narration completed, proceeding to 3D scene");
                    narrationEndedRef.current = true;

                    // Transition to 3D scene after narration ends
                    setShowExperience(true);

                    // Focus on canvas after showing it
                    setTimeout(() => {
                        if (canvasRef.current) {
                            canvasRef.current.focus();
                        }

                        // Play the next narration after showing the 3D scene
                        setTimeout(() => {
                            narrationManager.playNarration('Scene01_Mission');
                            console.log("Lecture de la narration Scene01_Mission après transition");
                        }, 2000);
                    }, 100);

                    // Remove this listener as it's no longer needed
                    narrationEndedListener();
                }
            });

            // Play the Scene00_Radio narration
            narrationManager.playNarration('Scene00_Radio');
            console.log("Lecture de la narration Scene00_Radio pendant l'écran noir");

            // Fallback in case the narration-ended event isn't fired
            // Get the audio duration if possible or use a default value (e.g., 30 seconds)
            const defaultDuration = 30000; // 30 seconds in ms
            setTimeout(() => {
                if (!narrationEndedRef.current) {
                    console.log("Fallback: Scene00_Radio didn't fire ended event, proceeding anyway");
                    narrationEndedRef.current = true;

                    // Transition to 3D scene after the fallback duration
                    setShowExperience(true);

                    // Focus on canvas after showing it
                    setTimeout(() => {
                        if (canvasRef.current) {
                            canvasRef.current.focus();
                        }

                        // Play the next narration after showing the 3D scene
                        setTimeout(() => {
                            narrationManager.playNarration('Scene01_Mission');
                            console.log("Lecture de la narration Scene01_Mission après transition (fallback)");
                        }, 2000);
                    }, 100);
                }
            }, defaultDuration);
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
            <AssetManager
                ref={assetManagerRef}
                onReady={onAssetsReady}
                key="assetManager" // Clé stable pour éviter les remontages
            />

            {/* Loading Screen and Desktop Landing */}
            {!showExperience && (
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
        </EventEmitterProvider>
    )
}