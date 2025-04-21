import React, {useEffect} from 'react'
import {Canvas} from '@react-three/fiber'
import Experience from './Experience'
import useStore from './Store/useStore'

export default function App() {
    const {loaded, setLoaded} = useStore()

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
            gl={{preserveDrawingBuffer: true}}
            shadows
        >
            <Experience/>
        </Canvas>
    )
}