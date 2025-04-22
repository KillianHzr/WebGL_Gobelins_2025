import React, { useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Utilisation d'un seul modèle à la fois pour chaque instance
export function TreeModel({ position, scale, rotation, modelIndex = 0 }) {
    const ref = useRef()

    // Sélectionner le modèle en fonction de l'index
    const modelPath = modelIndex % 2 === 0 ? '/models/tree2.glb' : '/models/tree3.glb'

    // Charger le modèle
    const { scene } = useGLTF(modelPath)

    useEffect(() => {
        if (scene && ref.current) {
            // Clone la scène pour éviter des problèmes avec les références
            const clonedScene = scene.clone()

            // Nettoyer le groupe actuel
            while (ref.current.children.length > 0) {
                ref.current.remove(ref.current.children[0])
            }

            // Ajouter le contenu cloné
            ref.current.add(clonedScene)

            // Activer les ombres
            ref.current.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true
                    node.receiveShadow = true
                }
            })
        }
    }, [scene])

    return <group ref={ref} position={position} rotation={rotation} scale={scale} />
}

// Version de secours simple si le modèle ne charge pas
export function TreeFallback(props) {
    return (
        <group {...props}>
            <mesh castShadow receiveShadow position={[0, 2, 0]}>
                <cylinderGeometry args={[0.2, 0.4, 4, 8]} />
                <meshStandardMaterial color="#8B4513" roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow position={[0, 5, 0]}>
                <coneGeometry args={[1.5, 4, 8]} />
                <meshStandardMaterial color="#2d572c" roughness={0.8} />
            </mesh>
        </group>
    )
}

// Précharger les modèles
useGLTF.preload('/models/tree2.glb')
useGLTF.preload('/models/tree3.glb')