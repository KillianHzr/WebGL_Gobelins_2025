import React, { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Experience from './Experience'
import useStore from './Store/useStore'
import CaptureInterface from './Utils/CaptureInterface.jsx'
import ScannerInterface from './Utils/ScannerInterface.jsx'

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
        <>
            {/* Camera interface - outside Canvas */}
            <CaptureInterface />

            {/* Scanner interface - outside Canvas */}
            <ScannerInterface />

            <Canvas
                gl={{ preserveDrawingBuffer: true }}
                shadows
            >
                <Experience />
            </Canvas>
        </>
    )
}