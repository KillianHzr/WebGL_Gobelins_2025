import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Experience from './Experience'
import useStore from './Store/useStore'
import CaptureInterface from './Utils/CaptureInterface.jsx'
import ScannerInterface from './Utils/ScannerInterface.jsx'
import AssetManager from './Assets/AssetManager'
import { EventBus, EventEmitterProvider } from './Utils/EventEmitter'
import SubtitleComponent from './Utils/SubtitleComponent'

export default function App() {
    const { loaded, setLoaded } = useStore()
    const assetManagerRef = useRef(null)
    const [assetsLoaded, setAssetsLoaded] = useState(false)
    const [isAssetManagerInitialized, setIsAssetManagerInitialized] = useState(false)

    // Handle asset loading
    useEffect(() => {
        // Créer une référence globale à l'AssetManager
        if (assetManagerRef.current && !isAssetManagerInitialized) {
            window.assetManager = assetManagerRef.current;
            console.log('AssetManager reference set to window.assetManager');
            setIsAssetManagerInitialized(true);
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
    }, [isAssetManagerInitialized, setLoaded]); // Dépendances stables

    const onAssetsReady = () => {
        // Callback passé au AssetManager
        console.log("Assets ready callback triggered");
        setAssetsLoaded(true);
    };

    return (
        <EventEmitterProvider>
            {/* Asset Manager component */}
            <AssetManager
                ref={assetManagerRef}
                onReady={onAssetsReady}
                key="assetManager" // Clé stable pour éviter les remontages
            />
            <CaptureInterface />

            {/* Scanner interface - outside Canvas */}
            <ScannerInterface />
            {/* Canvas for 3D content */}
            <Canvas
                gl={{ preserveDrawingBuffer: true }}
                shadows
            >
                <Experience />
            </Canvas>

            <SubtitleComponent />
        </EventEmitterProvider>
    )
}