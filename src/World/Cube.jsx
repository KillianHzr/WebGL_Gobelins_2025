import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Cube() {
    const cubeRef = useRef()

    // Animation
    useFrame((state, delta) => {
        if (cubeRef.current) {
            cubeRef.current.rotation.y += delta * 0.5
        }
    })

    return (
        <mesh ref={cubeRef}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ff5533" />
        </mesh>
    )
}