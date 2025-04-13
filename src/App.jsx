import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import Experience from './Experience'
import useStore from './Store/useStore'
import AssetManager from './Assets/AssetManager'
import { EventBus, EventEmitterProvider } from './Utils/EventEmitter'

export default function App() {
    const { loaded, setLoaded } = useStore()
    const assetManagerRef = useRef(null)
    const [assetsLoaded, setAssetsLoaded] = useState(false)

    // Handle asset loading
    useEffect(() => {
        // Créer une référence globale à l'AssetManager
        if (assetManagerRef.current) {
            window.assetManager = assetManagerRef.current;
            console.log('AssetManager reference set to window.assetManager');
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
    }, [assetManagerRef.current]);

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
            />

            {/* Loading indicator (optional) */}
            {!loaded && (
                <div className="loading-overlay">
                    <div className="loading-bar"></div>
                    <div className="loading-text">Loading...</div>
                </div>
            )}

            {/* Canvas for 3D content */}
            <Canvas
                gl={{ preserveDrawingBuffer: true }}
                shadows
            >
                <Experience />
            </Canvas>
        </EventEmitterProvider>
    )
}