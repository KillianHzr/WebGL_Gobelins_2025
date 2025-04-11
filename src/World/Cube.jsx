import React, { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Cube({ position = [0, 0, 0], scale = 1, color = '#ff5533' }) {
    const cubeRef = useRef()
    const [hovered, setHovered] = useState(false)
    const [active, setActive] = useState(false)

    // Animation
    useFrame((state, delta) => {
        if (cubeRef.current) {
            cubeRef.current.rotation.y += delta * (active ? 1.5 : 0.5)
            cubeRef.current.rotation.x += delta * (active ? 0.5 : 0.2)

            if (hovered && !active) {
                cubeRef.current.scale.x = THREE.MathUtils.lerp(cubeRef.current.scale.x, scale * 1.2, 0.1)
                cubeRef.current.scale.y = THREE.MathUtils.lerp(cubeRef.current.scale.y, scale * 1.2, 0.1)
                cubeRef.current.scale.z = THREE.MathUtils.lerp(cubeRef.current.scale.z, scale * 1.2, 0.1)
            } else if (!hovered && !active) {
                cubeRef.current.scale.x = THREE.MathUtils.lerp(cubeRef.current.scale.x, scale, 0.1)
                cubeRef.current.scale.y = THREE.MathUtils.lerp(cubeRef.current.scale.y, scale, 0.1)
                cubeRef.current.scale.z = THREE.MathUtils.lerp(cubeRef.current.scale.z, scale, 0.1)
            }
        }
    })

    return (
        <mesh
            ref={cubeRef}
            position={position}
            scale={scale}
            onClick={() => setActive(!active)}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            castShadow
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
                color={active ? '#ffffff' : color}
                metalness={active ? 0.8 : 0.3}
                roughness={active ? 0.2 : 0.7}
            />
        </mesh>
    )
}