import React, { useRef, useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import sceneObjectManager from '../Config/SceneObjectManager';
import {useAnimationFrame} from "../Utils/AnimationManager.js";

export default function WaterPlane() {
    const modelRef = useRef();
    const clock = useRef(new THREE.Clock());

    // Facteur de ralentissement pour l'eau
    const FLOW_SPEED = 0.3;

    // Taille de base du shader (en unités Three.js)
    // Cette taille sert de référence pour la répétition du pattern
    const BASE_SHADER_SIZE = new THREE.Vector2(2, 2);

    // Obtenir le placement depuis sceneObjectManager
    const placement = useMemo(() => {
        const placements = sceneObjectManager.getPlacements({objectKey: 'WaterPlane'});
        return placements.length > 0 ? placements[0] : {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1]
        };
    }, []);

    // Calculer la taille du mesh pour l'échelle du shader
    const meshSize = useMemo(() => {
        const defaultSize = new THREE.Vector2(20, 20);

        if (placement.scale) {
            return new THREE.Vector2(
                placement.scale[0] * 10,
                placement.scale[2] * 10
            );
        }

        return defaultSize;
    }, [placement]);

    // Charger le modèle WaterPlane
    const { scene: waterModel } = useGLTF('/models/forest/river/River.glb');

    // Créer le shader d'eau amélioré qui combine le style original avec le suivi des courbes
    const waterShader = useMemo(() => {
        // Charger les textures
        const textureLoader = new THREE.TextureLoader();
        const noise = textureLoader.load("https://i.imgur.com/gPz7iPX.jpg");
        const dudv = textureLoader.load("https://i.imgur.com/hOIsXiZ.png");
        // Cette texture sera à remplacer par votre vraie flow map
        const flowMap = textureLoader.load("https://i.imgur.com/hOIsXiZ.png");

        noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
        noise.minFilter = THREE.NearestFilter;
        noise.magFilter = THREE.NearestFilter;
        dudv.wrapS = dudv.wrapT = THREE.RepeatWrapping;
        flowMap.wrapS = flowMap.wrapT = THREE.RepeatWrapping;

        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                tNoise: { value: noise },
                tDudv: { value: dudv },
                tFlow: { value: flowMap },
                useUVFlow: { value: 0.0 }, // 0.0 = mode original, 1.0 = utiliser les UV
                baseSize: { value: BASE_SHADER_SIZE },
                meshSize: { value: meshSize },
                topDarkColor: { value: new THREE.Color(0xB2CBEB) }, // Bleu plus clair et plus lumineux
                bottomDarkColor: { value: new THREE.Color(0xB2CBEB) },
                topLightColor: { value: new THREE.Color(0x3F7DCE) }, // Bleu moyen moins profond
                bottomLightColor: { value: new THREE.Color(0x3F7DCE) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform sampler2D tNoise;
                uniform sampler2D tDudv;
                uniform sampler2D tFlow;
                uniform float useUVFlow;
                uniform vec2 baseSize;
                uniform vec2 meshSize;
                uniform vec3 topDarkColor;
                uniform vec3 bottomDarkColor;
                uniform vec3 topLightColor;
                uniform vec3 bottomLightColor;
                
                varying vec2 vUv;
                varying vec3 vPosition;
                
                const float strength = 0.03; // Augmenté pour plus de mouvement
                const float FLOW_SPEED = 0.3;
                
                // Fonction auxiliaire pour arrondir (création du banding)
                float customRound(float a) {
                    return floor(a + 0.5);
                }
                
                vec2 getFlowDirection(vec2 uv) {
                    // Lire la direction du flow à partir de la texture de flow
                    // Normaliser de [0,1] à [-1,1]
                    vec2 flow = texture2D(tFlow, uv).rg * 2.0 - 1.0;
                    // Si aucune texture de flow n'est appliquée correctement, utiliser une direction par défaut
                    if (length(flow) < 0.1) {
                        return vec2(0.0, 1.0); // Direction par défaut descendante
                    }
                    return flow;
                }
                
                void main() {
                    // Taille fixe du pattern (comme dans le shader original)
                    // Augmentation de l'échelle pour des détails plus fins
                    float patternScale = 3.0; // Valeur augmentée de 1.0 à 3.0 pour des détails plus fins
                    
                    // Coordonnées UV répétées sans étirement (comme dans le shader original)
                    vec2 fixedScaleUV = vec2(
                        vUv.x * (meshSize.x / baseSize.x),
                        vUv.y * (meshSize.y / baseSize.y)
                    ) * patternScale;
                    
                    // Animation de déplacement
                    float flowSpeed = 0.2;
                    float flowOffset = time * flowSpeed;
                    
                    // Direction du flux (selon le mode)
                    vec2 flowDirection;
                    if (useUVFlow > 0.5) {
                        // Utiliser les UVs pour orienter le flux
                        flowDirection = getFlowDirection(vUv);
                        // Ajuster l'offset selon la direction du flux
                        flowOffset *= length(flowDirection);
                    } else {
                        // Direction par défaut pour le mode original
                        flowDirection = vec2(0.0, 1.0);
                    }
                    
                    // Création de plusieurs couches avec des fréquences différentes (comme dans le shader original)
                    
                    // Première couche - pattern principal avec animation verticale
                    // Inversion du sens du courant en utilisant + flowOffset au lieu de - flowOffset
                    vec2 dudvUV1 = vec2(fixedScaleUV.x, fixedScaleUV.y + flowOffset);
                    // Appliquer la direction du flux si activé
                    if (useUVFlow > 0.5) {
                        dudvUV1 -= flowDirection * flowOffset * 0.2; // Signe inversé ici aussi
                    }
                    vec2 displacement1 = texture2D(tDudv, dudvUV1).rg;
                    displacement1 = ((displacement1 * 2.0) - 1.0) * strength;
                    
                    // Deuxième couche - pattern secondaire décalé (comme dans le shader original)
                    // Inversion du sens du courant ici aussi
                    vec2 dudvUV2 = vec2(fixedScaleUV.x * 1.4 + 0.23, fixedScaleUV.y * 0.8 + flowOffset * 1.3);
                    // Appliquer la direction du flux si activé
                    if (useUVFlow > 0.5) {
                        dudvUV2 -= flowDirection * flowOffset * 0.3; // Signe inversé ici aussi
                    }
                    vec2 displacement2 = texture2D(tDudv, dudvUV2).rg;
                    displacement2 = ((displacement2 * 2.0) - 1.0) * strength * 0.7;
                    
                    // Mélange des deux couches de déplacement
                    vec2 displacement = displacement1 + displacement2;
                    
                    // Pattern de bruit animé pour l'effet de mouvement de l'eau (comme dans le shader original)
                    // Inversion du sens du courant ici aussi et augmentation des détails
                    vec2 noiseUV = vec2(
                        fixedScaleUV.x * 1.5 + displacement.x, // Multiplié par 1.5 pour plus de détails
                        (fixedScaleUV.y / 3.0) + flowOffset + displacement.y // Divisé par 3.0 au lieu de 5.0
                    );
                    
                    // Appliquer légèrement la direction du flux si activé
                    if (useUVFlow > 0.5) {
                        noiseUV -= flowDirection * sin(flowOffset * 2.0) * 0.05; // Signe inversé
                    }
                    
                    float noise = texture2D(tNoise, noiseUV).r;
                    
                    // Banding plus subtil avec plus de niveaux pour un effet d'eau plus naturel
                    noise = customRound(noise * 8.0) / 8.0; // 8 niveaux au lieu de 5
                    
                    // Mélange de couleurs basé sur la position Y avec un effet plus fluide
                    vec3 color = mix(
                        mix(bottomDarkColor, topDarkColor, vUv.y), 
                        mix(bottomLightColor, topLightColor, vUv.y), 
                        noise * 0.8 + 0.2 // Adoucit le contraste entre les deux couleurs
                    );
                    
                    gl_FragColor = vec4(color, 1);
                }
            `,
            transparent: true
        });
    }, [meshSize]);

    // Appliquer le shader au modèle lorsqu'il est chargé
    useEffect(() => {
        // S'assurer que le modèle est chargé
        if (waterModel && waterShader) {
            // Cloner le modèle pour éviter de modifier l'original
            const clonedModel = waterModel.clone();

            // Appliquer le shader à tous les meshes du modèle
            let meshCount = 0;
            clonedModel.traverse((node) => {
                if (node.isMesh) {
                    meshCount++;
                    node.material = waterShader;
                    node.material.needsUpdate = true;
                }
            });

            console.log(`Applied water shader to ${meshCount} meshes in WaterPlane model`);

            // Remplacer le contenu du modelRef par le modèle cloné
            if (modelRef.current) {
                // Vider le groupe actuel
                while (modelRef.current.children.length > 0) {
                    modelRef.current.remove(modelRef.current.children[0]);
                }

                // Ajouter le modèle cloné
                modelRef.current.add(clonedModel);
            }
        }
    }, [waterModel, waterShader]);

    // Animer le shader
    useAnimationFrame(() => {
        if (waterShader) {
            waterShader.uniforms.time.value = clock.current.getElapsedTime() * FLOW_SPEED;
        }
    }, 'animation'); // Catégorie 'animation'


    return (
        <group
            ref={modelRef}
            position={placement.position}
            rotation={placement.rotation}
            scale={placement.scale}
        />
    );
}

// Précharger le modèle
useGLTF.preload('/models/forest/river/River.glb');