import React, { useEffect, useRef, useState, Suspense, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import useStore from './Store/useStore'
import ScrollControls from './Core/ScrollControls'
import DebugInitializer from "./Utils/DebugInitializer.jsx"
import { EventEmitterProvider } from './Utils/EventEmitter'
import { TreeModel, TreeFallback } from './World/TreeModel'
import {OrbitControls} from "@react-three/drei";

export default function Experience() {
    const { debug, loaded, setLoaded } = useStore();
    const { scene } = useThree();

    // État pour les contrôles de caméra
    const orbitControlsEnabled = useStore(state => state.orbitControlsEnabled || false);

    // Afficher l'UI de Theatre.js si le mode debug est activé
    useEffect(() => {
        if (debug?.active && debug?.showTheatre && window.__theatreStudio) {
            window.__theatreStudio.ui.restore();
        }

        setLoaded(true);
    }, [debug, setLoaded]);

    return (
        <EventEmitterProvider>
            {/* Initialize debug mode */}
            <DebugInitializer />

            {/* OrbitControls conditionnel */}
            {orbitControlsEnabled && <OrbitControls enableDamping dampingFactor={0.05} />}

            <ScrollControls>
                {/* Éclairage */}
                <ambientLight intensity={0.3} />
                <directionalLight
                    position={[10, 20, 5]}
                    intensity={1.5}
                    castShadow
                    shadow-camera-far={100}
                    shadow-camera-left={-20}
                    shadow-camera-right={20}
                    shadow-camera-top={20}
                    shadow-camera-bottom={-20}
                    shadow-mapSize-width={2048}
                    shadow-mapSize-height={2048}
                />
                <hemisphereLight intensity={0.4} />

                {/* Environment */}
                <color attach="background" args={['#87CEEB']} />

                {loaded && (
                    <>
                        <GroundPlane />
                        <TreesGroup />
                        <fog attach="fog" args={['#87CEEB', 1, 100]} />
                    </>
                )}
            </ScrollControls>
        </EventEmitterProvider>
    )
}

// Composant pour le terrain - plus étroit mais plus long
function GroundPlane() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, -150]} receiveShadow>
            <planeGeometry args={[40, 400]} /> {/* Largeur réduite à 40, longueur réduite à 400 */}
            <meshStandardMaterial color="#2d572c" roughness={0.8} />
        </mesh>
    )
}

// Composant pour gérer un groupe d'arbres adaptés au nouveau terrain
function TreesGroup() {
    const treesCount = 100;

    // Générer des positions aléatoires pour les arbres
    const treePositions = useMemo(() => {
        const positions = [];
        for (let i = 0; i < treesCount; i++) {
            // Distribuer les arbres sur la zone ajustée
            const x = Math.random() * 35 - 17.5; // de -17.5 à 17.5 (terrain de largeur 40)
            const z = Math.random() * 380 - 330; // de -330 à 50 (terrain de longueur 400)
            const scale = 0.8 + Math.random() * 0.6; // Taille variée
            const rotation = Math.random() * Math.PI * 2; // Rotation aléatoire
            const modelType = Math.floor(Math.random() * 2); // 0 ou 1 pour le type d'arbre

            positions.push({
                position: [x, 0, z],
                scale: scale,
                rotation: [0, rotation, 0],
                modelIndex: modelType,
                key: i
            });
        }
        return positions;
    }, []);

    return (
        <group>
            {treePositions.map((props, index) => (
                <Suspense key={index} fallback={<TreeFallback {...props} />}>
                    <TreeModel
                        position={props.position}
                        scale={props.scale}
                        rotation={props.rotation}
                        modelIndex={props.modelIndex}
                    />
                </Suspense>
            ))}
        </group>
    );
}