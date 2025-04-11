import React, { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import useStore from './Store/useStore'
import Cube from './World/Cube'
import Debug from './Utils/Debug'
import Stats from './Utils/Stats'
import DebugInitializer from './Utils/DebugInitializer.jsx'
import Camera from './Core/Camera'
import Controls from './Core/Controls'
import Lights from './Core/Lights'
import { getDefaultValue, initializeLight } from './Utils/defaultValues'

export default function Experience() {
    const { loaded, debug } = useStore()
    const { scene } = useThree()
    const ambientLightRef = useRef()
    const directionalLightRef = useRef()

    // Appliquer les valeurs par défaut aux lumières lors du montage
    useEffect(() => {
        // Initialiser les lumières avec les valeurs du guiConfig si le mode debug n'est pas actif
        if (!debug?.active) {
            scene.traverse((object) => {
                if (object.isLight) {
                    const lightType = object.type.replace('Light', '');

                    // Trouver l'index de cette lumière parmi les autres du même type
                    let index = 0;
                    let foundLights = 0;
                    scene.traverse((obj) => {
                        if (obj.isLight && obj.type === object.type) {
                            if (obj === object) {
                                index = foundLights;
                            }
                            foundLights++;
                        }
                    });

                    // Initialiser avec les valeurs par défaut
                    initializeLight(object, lightType, index);
                }
            });
        }
    }, [scene, debug]);

    return (
        <>
            {/* Initialize debug mode based on URL hash */}
            <DebugInitializer />

            {/* Debug Tools - only render if debug mode is active */}
            {debug?.active && debug?.showStats && <Stats />}
            {debug?.active && debug?.showGui && <Debug />}
            {debug?.active && debug?.showGui && <Camera />}
            {debug?.active && debug?.showGui && <Controls />}
            {debug?.active && debug?.showGui && <Lights />}

            {/* Lights with default values from config */}
            <ambientLight
                ref={ambientLightRef}
                intensity={getDefaultValue('lights.defaults.Ambient.0.intensity', 0.5)}
            />
            <directionalLight
                ref={directionalLightRef}
                position={[1, 2, 3]}
                intensity={getDefaultValue('lights.defaults.Directional.0.intensity', 1.5)}
                castShadow={getDefaultValue('lights.defaults.Directional.0.castShadow', true)}
            />

            {/* Controls */}
            <OrbitControls makeDefault />

            {/* Objects */}
            {loaded && <Cube />}

            {/* Ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
                <planeGeometry args={[10, 10]} />
                <shadowMaterial transparent opacity={0.4} />
            </mesh>
        </>
    )
}