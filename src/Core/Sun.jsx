import { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EventBus } from '../Utils/EventEmitter.jsx';

export function Sun({ refProp }) {
    const meshRef = useRef();
    const materialRef = useRef();
    const { camera, size } = useThree();

    const [lightDirection, setLightDirection] = useState(new THREE.Vector3(1, 0.5, -0.5));
    const [currentColor, setCurrentColor] = useState("#f4d03f");
    const [currentIntensity, setCurrentIntensity] = useState(1);
    const [isNight, setIsNight] = useState(false);

    // Synchroniser avec les lumières
    useEffect(() => {
        const subscription = EventBus.on('lights-values-updated', (data) => {
            if (data.position) {
                const lightPos = new THREE.Vector3(...data.position);
                setLightDirection(lightPos.normalize());
            }

            if (data.mainLightColor) {
                setCurrentColor(data.mainLightColor);
            }

            if (data.transitionFactor !== undefined) {
                const intensity = Math.max(0.3, 1 - data.transitionFactor * 0.7);
                setCurrentIntensity(intensity);
                setIsNight(data.transitionFactor > 0.7);
            }
        });

        return () => subscription();
    }, []);

    // Positionner le soleil pour qu'il reste visible
    useFrame(() => {
        if (!meshRef.current || !camera) return;

        // Calculer la position idéale du soleil
        const cameraPos = camera.position.clone();
        const baseDistance = 60;

        // Position idéale dans la direction de la lumière
        let targetPos = cameraPos.clone().add(
            lightDirection.clone().multiplyScalar(baseDistance)
        );

        // Projeter en coordonnées écran pour vérifier la visibilité
        const screenPos = targetPos.clone().project(camera);

        // Si le soleil sort des limites de l'écran, le repositionner
        const margin = 0.15; // Marge pour garder le soleil visible
        let needsRepositioning = false;

        if (Math.abs(screenPos.x) > (1 - margin) || Math.abs(screenPos.y) > (1 - margin)) {
            needsRepositioning = true;
        }

        if (needsRepositioning) {
            // Limiter la position écran aux bords visibles
            screenPos.x = Math.max(-(1 - margin), Math.min((1 - margin), screenPos.x));
            screenPos.y = Math.max(-(1 - margin), Math.min((1 - margin), screenPos.y));
            screenPos.z = Math.min(0.9, Math.max(-0.9, screenPos.z)); // Eviter les positions trop proches/lointaines

            // Reconvertir en position 3D
            targetPos = screenPos.unproject(camera);

            // Assurer une distance minimale de la caméra
            const dirFromCamera = targetPos.sub(cameraPos).normalize();
            targetPos = cameraPos.clone().add(dirFromCamera.multiplyScalar(baseDistance * 0.8));
        }

        // Appliquer la position
        meshRef.current.position.copy(targetPos);

        // Animation et intensité
        if (materialRef.current) {
            const time = Date.now() * 0.001;
            const pulse = Math.sin(time * 0.5) * 0.1 + 0.9;

            // Réduire l'intensité si le soleil a été repositionné artificiellement
            const intensityMultiplier = needsRepositioning ? 0.7 : 1.0;

            materialRef.current.emissiveIntensity = currentIntensity * pulse * intensityMultiplier;

            // Ajuster la taille selon la distance
            const distanceToCamera = meshRef.current.position.distanceTo(cameraPos);
            const scale = Math.max(0.5, Math.min(2.0, 50 / distanceToCamera));
            meshRef.current.scale.setScalar(scale);
        }
    });

    // Référence pour les God Rays
    useEffect(() => {
        if (refProp && meshRef.current) {
            refProp.current = meshRef.current;
        }
    }, [refProp]);

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[2.5, 16, 16]} />
            <meshBasicMaterial
                ref={materialRef}
                color={currentColor}
                emissive={currentColor}
                emissiveIntensity={currentIntensity}
                toneMapped={false}
                transparent={true}
                opacity={isNight ? 0.8 : 1.0} // Légèrement transparent la nuit
            />
        </mesh>
    );
}