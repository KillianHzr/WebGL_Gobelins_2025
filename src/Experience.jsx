import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import useStore from './store/useStore'
import Cube from './World/Cube'

export default function Experience() {
    const { loaded } = useStore()

    return (
        <>
            {/* Lights */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[1, 2, 3]} intensity={1.5} />

            {/* Controls */}
            <OrbitControls makeDefault />

            {/* Objects */}
            {loaded && <Cube />}
        </>
    )
}