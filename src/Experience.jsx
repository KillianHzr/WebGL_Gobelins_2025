import React, { useEffect, Suspense } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useStore from './Store/useStore'
import ScrollControls from './Core/ScrollControls'
import DebugInitializer from "./Utils/DebugInitializer.jsx"
import { EventEmitterProvider } from './Utils/EventEmitter'
import { OrbitControls } from "@react-three/drei"
import Map from './World/Map' // Nouveau composant Map importé

export default function Experience() {
    const { debug, loaded, setLoaded } = useStore();
    const { scene } = useThree();

    // État pour les contrôles de caméra
    const orbitControlsEnabled = useStore(state => state.orbitControlsEnabled || false);

    // Afficher l'UI de Theatre.js si le mode debug est activé
    useEffect(() => {
        if (debug?.active && debug?.showTheatre && window.__theatreStudio) {
            window.__theatreStudio.ui.restore();
        }

        setLoaded(true);
    }, [debug, setLoaded]);

    return (
        <EventEmitterProvider>
            {/* Initialize debug mode */}
            <DebugInitializer />

            {/* OrbitControls conditionnel */}
            {orbitControlsEnabled && <OrbitControls enableDamping dampingFactor={0.05} />}

            <ScrollControls>
                {/* Éclairage */}
                <ambientLight intensity={0.3} />
                <directionalLight
                    position={[10, 20, 5]}
                    intensity={1.5}
                    castShadow
                    shadow-camera-far={100}
                    shadow-camera-left={-20}
                    shadow-camera-right={20}
                    shadow-camera-top={20}
                    shadow-camera-bottom={-20}
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <hemisphereLight intensity={0.4} />

                {/* Environment */}
                <color attach="background" args={['#87CEEB']} />

                {loaded && (
                    <>
                        <Suspense fallback={null}>
                            <Map />
                        </Suspense>
                        <fog attach="fog" args={['#87CEEB', 1, 100]} />
                    </>
                )}
            </ScrollControls>
        </EventEmitterProvider>
    )
}