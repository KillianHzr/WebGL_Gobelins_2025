import React, { useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import useStore from '../Store/useStore'

export default function Map() {
    const mapRef = useRef()
    const { scene } = useGLTF('/models/MapScene.glb')
    const { debug, gui } = useStore()

    useEffect(() => {
        if (mapRef.current && scene) {
            mapRef.current.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true
                    node.receiveShadow = true
                }
            })
        }
    }, [scene, debug, gui])

    return <primitive ref={mapRef} object={scene} />
}

// Preload the model
useGLTF.preload('/models/MapScene.glb')