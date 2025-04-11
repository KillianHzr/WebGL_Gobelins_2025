import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import useStore from './Store/useStore'
import Cube from './World/Cube'
import ScrollControls from './Core/ScrollControls'

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
        <ScrollControls>
            {/* Lights */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[1, 2, 3]} intensity={1.5} />
            <color attach="background" args={['#1e1e2f']} />
            <fog attach="fog" color="#1e1e2f" near={1} far={15} />

            {/* Objects */}
            {loaded && (
                <>
                    <Cube position={[-2, 0, 0]} scale={1} color="#ff5533" />
                    <Cube position={[0, 0, -2]} scale={1.5} color="#5eead4" />
                    <Cube position={[2, 0, -4]} scale={2} color="#ffcc00" />
                </>
            )}
        </ScrollControls>
    )
}