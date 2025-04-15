import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import useStore from '../Store/useStore';

/**
 * Composant qui crée un effet de contour lumineux (glow) pour les objets interactifs
 * @param {Object} props - Propriétés du composant
 * @param {React.RefObject} props.objectRef - Référence à l'objet à entourer
 * @param {boolean} props.active - Indique si l'effet est actif
 * @param {string} props.color - Couleur de l'effet (par défaut blanc)
 * @param {number} props.intensity - Intensité de l'effet (1-10)
 * @param {number} props.pulseSpeed - Vitesse de pulsation (0 pour désactiver)
 * @returns {React.Component} Composant de l'effet
 */
const OutlineEffect = ({
                           objectRef,
                           active = false,
                           color = '#ffffff',
                           thickness = 0.05,
                           intensity = 5,
                           pulseSpeed = 1.5
                       }) => {
    const outlineMeshRef = useRef();
    const materialRef = useRef();
    const { scene } = useThree();

    // Variables pour l'animation de pulsation
    const pulseRef = useRef({
        value: 0,
        direction: 1
    });

    // Créer le matériau d'outline une seule fois
    useEffect(() => {
        materialRef.current = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                intensity: { value: intensity },
                pulse: { value: 0 }
            },
            vertexShader: `
        void main() {
          vec3 pos = position;
          // Ajuster légèrement les vertices vers l'extérieur
          // pour créer l'effet d'outline
          vec3 normal = normalize(normalMatrix * normal);
          pos += normal * ${thickness.toFixed(4)};
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 color;
        uniform float intensity;
        uniform float pulse;

        void main() {
          // Combiner la couleur de base avec l'intensité et la pulsation
          float glowIntensity = intensity * (1.0 + 0.5 * pulse);
          gl_FragColor = vec4(color * glowIntensity, 1.0);
        }
      `,
            side: THREE.BackSide,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }, [color, intensity, thickness]);

    // Mettre à jour l'outline lorsque l'objet cible change
    useEffect(() => {
        if (!objectRef?.current || !materialRef.current) return;

        // Nettoyer l'ancien mesh s'il existe
        if (outlineMeshRef.current) {
            scene.remove(outlineMeshRef.current);
            outlineMeshRef.current.geometry.dispose();
        }

        // Créer un nouveau mesh basé sur la géométrie de l'objet cible
        const targetGeometry = objectRef.current.geometry;
        if (targetGeometry) {
            const outlineMesh = new THREE.Mesh(targetGeometry.clone(), materialRef.current);

            // Copier la transformation de l'objet cible
            outlineMesh.position.copy(objectRef.current.position);
            outlineMesh.rotation.copy(objectRef.current.rotation);
            outlineMesh.scale.copy(objectRef.current.scale);

            // Suivre les transformations de l'objet parent
            outlineMesh.userData.target = objectRef.current;

            // Référencer le mesh pour les mises à jour
            outlineMeshRef.current = outlineMesh;

            // Rendre invisible par défaut (jusqu'à ce que 'active' soit true)
            outlineMesh.visible = active;

            // Ajouter à la scène
            scene.add(outlineMesh);
        }

        // Nettoyer lors du démontage
        return () => {
            if (outlineMeshRef.current) {
                scene.remove(outlineMeshRef.current);
                outlineMeshRef.current.geometry.dispose();
            }
        };
    }, [objectRef?.current, scene, materialRef.current]);

    // Mettre à jour la visibilité en fonction de l'état 'active'
    useEffect(() => {
        if (outlineMeshRef.current) {
            outlineMeshRef.current.visible = active;
        }
    }, [active]);

    // Animation de l'effet de pulsation
    useFrame((state, delta) => {
        if (!outlineMeshRef.current || !materialRef.current || pulseSpeed === 0) return;

        // Mettre à jour la position et la rotation pour suivre l'objet cible
        if (objectRef?.current) {
            outlineMeshRef.current.position.copy(objectRef.current.position);
            outlineMeshRef.current.rotation.copy(objectRef.current.rotation);
            outlineMeshRef.current.scale.copy(objectRef.current.scale);
        }

        // Mettre à jour l'effet de pulsation
        if (active && pulseSpeed > 0) {
            // Calculer la nouvelle valeur de pulsation
            pulseRef.current.value += delta * pulseSpeed * pulseRef.current.direction;

            // Inverser la direction si nécessaire
            if (pulseRef.current.value >= 1) {
                pulseRef.current.value = 1;
                pulseRef.current.direction = -1;
            } else if (pulseRef.current.value <= 0) {
                pulseRef.current.value = 0;
                pulseRef.current.direction = 1;
            }

            // Mettre à jour l'uniform du shader
            materialRef.current.uniforms.pulse.value = pulseRef.current.value;
        }
    });

    // Ce composant ne rend rien directement, l'effet est ajouté à la scène
    return null;
};

export default OutlineEffect;