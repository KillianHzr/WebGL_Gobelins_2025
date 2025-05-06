import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import useStore from './Store/useStore'
import CaptureInterface from './Utils/CaptureInterface.jsx'
import ScannerInterface from './Utils/ScannerInterface.jsx'
import AssetManager from './Assets/AssetManager'
import { EventBus, EventEmitterProvider } from './Utils/EventEmitter'
import ResponsiveLanding from './Utils/ResponsiveLanding'
import LoadingScreen from './Utils/LoadingScreen'
import MainLayout from './Utils/MainLayout'

export default function App() {
    const { loaded, setLoaded } = useStore()
    const assetManagerRef = useRef(null)
    const [assetsLoaded, setAssetsLoaded] = useState(false)
    const [isAssetManagerInitialized, setIsAssetManagerInitialized] = useState(false)
    const [isDesktopView, setIsDesktopView] = useState(false)
    const [showExperience, setShowExperience] = useState(false)
    const [showMainLayout, setShowMainLayout] = useState(false)
    const canvasRef = useRef(null)

    // Check viewport width on mount and resize
    useEffect(() => {
        const checkViewport = () => {
            setIsDesktopView(window.innerWidth >= 992);
        };

        checkViewport();

        window.addEventListener('resize', checkViewport);

        return () => window.removeEventListener('resize', checkViewport);
    }, []);

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
        console.log("User entered experience - preparing 3D content");

        // Set a flag to show the 3D content after a delay that matches the black screen animation
        setTimeout(() => {
            console.log("Black screen transition in progress - preparing 3D content");
            setShowExperience(true);

            // Focus on canvas after showing it
            setTimeout(() => {
                if (canvasRef.current) {
                    canvasRef.current.focus();
                }
            }, 100);

            setTimeout(() => {
                narrationManager.playNarration('Scene01_Mission');
                console.log("Lecture de la narration Scene01_Mission après transition");
            }, 2000);
        }, 800); // This should match when the black screen is at full opacity
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
                key="assetManager"
            />

            {/* Loading Screen and Desktop Landing */}
            {!showExperience && (
                <LoadingScreen onComplete={handleEnterExperience} />
            )}

            {/* Main Layout - only show after assets are loaded */}
            {showMainLayout && <MainLayout />}

            {/* Interfaces - only show when experience is visible */}
            {showExperience && (
                <>
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
                    gl={{ preserveDrawingBuffer: true }}
                    shadows
                >
                    <Experience />
                </Canvas>
            </div>
        </EventEmitterProvider>
    )
}