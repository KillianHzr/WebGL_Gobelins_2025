import React from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import useStore from './Store/useStore'
import Cube from './World/Cube'
import Debug from './Utils/Debug'
import Stats from './Utils/Stats'
import DebugInitializer from './Utils/DebugInitializer.jsx'
import Camera from './Core/Camera'
import Controls from './Core/Controls'
import Lights from './Core/Lights'

export default function Experience() {
    const { loaded, debug } = useStore()

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