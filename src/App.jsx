import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Experience from './Experience'
import useStore from './Store/useStore'

export default function App() {
    const { loaded, setLoaded } = useStore()

    // Handle asset loading
    useEffect(() => {
        // Simulate asset loading - in real app, you'd load assets here
        const loadAssets = async () => {
            await new Promise(resolve => setTimeout(resolve, 100))
            setLoaded(true)
        }

        loadAssets()
    }, [])

    return (
        <Canvas
            camera={{
                fov: 45,
                near: 0.1,
                far: 200,
                position: [3, 2, 6]
            }}
        >
            <Experience />
        </Canvas>
    )
}