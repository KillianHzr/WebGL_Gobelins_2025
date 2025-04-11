import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import useStore from './Store/useStore'
import Cube from './World/Cube'
import ScrollControls from './Core/ScrollControls'

export default function Experience() {
    const { loaded } = useStore()

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