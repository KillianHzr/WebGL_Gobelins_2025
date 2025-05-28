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

    // Créer le shader d'eau avec éclairage Three.js intégré
    const waterShader = useMemo(() => {
        // Charger les textures
        const textureLoader = new THREE.TextureLoader();
        const noise = textureLoader.load("https://i.imgur.com/gPz7iPX.jpg");
        const dudv = textureLoader.load("https://i.imgur.com/hOIsXiZ.png");
        const flowMap = textureLoader.load("https://i.imgur.com/hOIsXiZ.png");

        noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
        noise.minFilter = THREE.NearestFilter;
        noise.magFilter = THREE.NearestFilter;
        dudv.wrapS = dudv.wrapT = THREE.RepeatWrapping;
        flowMap.wrapS = flowMap.wrapT = THREE.RepeatWrapping;

        // Utiliser MeshStandardMaterial comme base et modifier avec onBeforeCompile
        const material = new THREE.MeshStandardMaterial({
            transparent: true,
            roughness: 0.1,
            metalness: 0.0,
            color: new THREE.Color(0x3F7DCE),
        });

        // Ajouter nos uniforms personnalisés
        material.userData = {
            time: { value: 0 },
            tNoise: { value: noise },
            tDudv: { value: dudv },
            tFlow: { value: flowMap },
            useUVFlow: { value: 0.0 },
            baseSize: { value: BASE_SHADER_SIZE },
            meshSize: { value: meshSize },
            topDarkColor: { value: new THREE.Color(0xB2CBEB) },
            bottomDarkColor: { value: new THREE.Color(0xB2CBEB) },
            topLightColor: { value: new THREE.Color(0x3F7DCE) },
            bottomLightColor: { value: new THREE.Color(0x3F7DCE) }
        };

        // Modifier le shader via onBeforeCompile pour conserver l'éclairage Three.js
        material.onBeforeCompile = (shader) => {
            // Ajouter nos uniforms au shader
            shader.uniforms.time = material.userData.time;
            shader.uniforms.tNoise = material.userData.tNoise;
            shader.uniforms.tDudv = material.userData.tDudv;
            shader.uniforms.tFlow = material.userData.tFlow;
            shader.uniforms.useUVFlow = material.userData.useUVFlow;
            shader.uniforms.baseSize = material.userData.baseSize;
            shader.uniforms.meshSize = material.userData.meshSize;
            shader.uniforms.topDarkColor = material.userData.topDarkColor;
            shader.uniforms.bottomDarkColor = material.userData.bottomDarkColor;
            shader.uniforms.topLightColor = material.userData.topLightColor;
            shader.uniforms.bottomLightColor = material.userData.bottomLightColor;

            // Ajouter les déclarations d'uniforms dans le vertex shader
            shader.vertexShader = `
                uniform float time;
                uniform vec2 baseSize;
                uniform vec2 meshSize;
                varying vec2 vWaterUv;
                varying vec3 vWaterPosition;
                
                ${shader.vertexShader}
            `.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // Calculer les UV pour l'eau
                vWaterUv = uv;
                vWaterPosition = position;
                `
            );

            // Modifier le fragment shader pour notre effet d'eau
            shader.fragmentShader = `
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
                
                varying vec2 vWaterUv;
                varying vec3 vWaterPosition;
                
                const float strength = 0.03;
                const float FLOW_SPEED = 0.3;
                
                float customRound(float a) {
                    return floor(a + 0.5);
                }
                
                vec2 getFlowDirection(vec2 uv) {
                    vec2 flow = texture2D(tFlow, uv).rg * 2.0 - 1.0;
                    if (length(flow) < 0.1) {
                        return vec2(0.0, 1.0);
                    }
                    return flow;
                }
                
                vec3 getWaterColor() {
                    float patternScale = 3.0;
                    
                    vec2 fixedScaleUV = vec2(
                        vWaterUv.x * (meshSize.x / baseSize.x),
                        vWaterUv.y * (meshSize.y / baseSize.y)
                    ) * patternScale;
                    
                    float flowSpeed = 0.2;
                    float flowOffset = time * flowSpeed;
                    
                    vec2 flowDirection;
                    if (useUVFlow > 0.5) {
                        flowDirection = getFlowDirection(vWaterUv);
                        flowOffset *= length(flowDirection);
                    } else {
                        flowDirection = vec2(0.0, 1.0);
                    }
                    
                    // Première couche
                    vec2 dudvUV1 = vec2(fixedScaleUV.x, fixedScaleUV.y + flowOffset);
                    if (useUVFlow > 0.5) {
                        dudvUV1 -= flowDirection * flowOffset * 0.2;
                    }
                    vec2 displacement1 = texture2D(tDudv, dudvUV1).rg;
                    displacement1 = ((displacement1 * 2.0) - 1.0) * strength;
                    
                    // Deuxième couche
                    vec2 dudvUV2 = vec2(fixedScaleUV.x * 1.4 + 0.23, fixedScaleUV.y * 0.8 + flowOffset * 1.3);
                    if (useUVFlow > 0.5) {
                        dudvUV2 -= flowDirection * flowOffset * 0.3;
                    }
                    vec2 displacement2 = texture2D(tDudv, dudvUV2).rg;
                    displacement2 = ((displacement2 * 2.0) - 1.0) * strength * 0.7;
                    
                    vec2 displacement = displacement1 + displacement2;
                    
                    // Pattern de bruit
                    vec2 noiseUV = vec2(
                        fixedScaleUV.x * 1.5 + displacement.x,
                        (fixedScaleUV.y / 3.0) + flowOffset + displacement.y
                    );
                    
                    if (useUVFlow > 0.5) {
                        noiseUV -= flowDirection * sin(flowOffset * 2.0) * 0.05;
                    }
                    
                    float noise = texture2D(tNoise, noiseUV).r;
                    noise = customRound(noise * 8.0) / 8.0;
                    
                    // Mélange de couleurs
                    vec3 waterColor = mix(
                        mix(bottomDarkColor, topDarkColor, vWaterUv.y), 
                        mix(bottomLightColor, topLightColor, vWaterUv.y), 
                        noise * 0.8 + 0.2
                    );
                    
                    return waterColor;
                }
                
                ${shader.fragmentShader}
            `.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                
                // Appliquer notre couleur d'eau
                vec3 waterColor = getWaterColor();
                diffuseColor.rgb = waterColor;
                `
            );
        };

        return material;
    }, [meshSize]);

    // Appliquer le shader au modèle lorsqu'il est chargé
    useEffect(() => {
        if (waterModel && waterShader) {
            const clonedModel = waterModel.clone();

            let meshCount = 0;
            clonedModel.traverse((node) => {
                if (node.isMesh) {
                    meshCount++;
                    node.material = waterShader;
                    node.material.needsUpdate = true;

                    // Configurer les propriétés pour les ombres et l'éclairage
                    node.castShadow = false;
                    node.receiveShadow = true;
                }
            });

            console.log(`Applied water shader to ${meshCount} meshes in WaterPlane model`);

            if (modelRef.current) {
                while (modelRef.current.children.length > 0) {
                    modelRef.current.remove(modelRef.current.children[0]);
                }
                modelRef.current.add(clonedModel);
            }
        }
    }, [waterModel, waterShader]);

    // Animer le shader
    useAnimationFrame(() => {
        if (waterShader && waterShader.userData) {
            waterShader.userData.time.value = clock.current.getElapsedTime() * FLOW_SPEED;
        }
    }, 'animation');

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