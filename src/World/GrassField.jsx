// File: GrassField.jsx

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, ShaderMaterial, DoubleSide, Vector3, Color, BufferAttribute, BufferGeometry } from 'three';
import { useGLTF } from '@react-three/drei';
import { gsap } from 'gsap';

// Configuration des niveaux de qualité
const QUALITY_PRESETS = {
    ULTRA: {
        bladeCount: 10000,
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 5,
        animationQuality: 'high'
    },
    HIGH: {
        bladeCount: 35000,
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 5,
        animationQuality: 'medium'
    },
    MEDIUM: {
        bladeCount: 20000,
        enableWind: true,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 3,
        animationQuality: 'low'
    },
    LOW: {
        bladeCount: 8000,
        enableWind: false,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: false,
        enableWeightMap: false,
        bladeComplexity: 3,
        animationQuality: 'none'
    }
};

const GrassField = ({
                        grassTextureIndex = 0,
                        onLoaded,
                        quality = 'ULTRA',
                        customConfig = {},
                        weightMapPath = './textures/desktop/ground/grass_weightmap.png',
                        weightMapIntensity = 1.0,
                        weightMapThreshold = 0.1,
                        weightMapSmoothing = 0.2,
                        // Nouveaux paramètres de couleur et saturation
                        grassHue = 0.33, // 0.0-1.0 (0=rouge, 0.25=vert, 0.5=cyan, 0.75=violet)
                        grassSaturation = 1.0, // 0.0-1.0 (0=gris, 1=couleur pure)
                        grassBrightness = 0.1, // 0.0-1.0 (0=noir, 1=blanc)
                        colorVariation = 0.0 // 0.0-1.0 variation de couleur entre brins
                    }) => {
    const meshRef = useRef();

    // Merge preset avec config custom
    const config = useMemo(() => ({
        ...QUALITY_PRESETS[quality],
        ...customConfig
    }), [quality, customConfig]);

    // Constants basées sur la config
    const BLADE_COUNT = config.bladeCount;
    const BLADE_WIDTH = 0.05;
    const BLADE_HEIGHT = 0.3;
    const BLADE_HEIGHT_VARIATION = 0.1;

    // Chargement des textures
    const grassTextures = useLoader(TextureLoader, [
        './textures/desktop/ground/grass.jpg',
    ]);

    const cloudTexture = config.enableClouds ?
        useLoader(TextureLoader, './textures/desktop/ground/cloud.jpg') : null;

    const weightMapTexture = config.enableWeightMap ?
        useLoader(TextureLoader, weightMapPath) : null;

    useMemo(() => {
        if (cloudTexture) {
            cloudTexture.wrapS = cloudTexture.wrapT = RepeatWrapping;
        }
    }, [cloudTexture]);

    const timeUniform = useRef({ type: 'f', value: 0.0 });
    const progress = useRef({ type: 'f', value: 0.0 });
    const startTime = useRef(Date.now());
    const previousGrassTextureIndex = useRef(0);
    const weightMapCanvas = useRef(null);
    const weightMapImageData = useRef(null);

    // Échantillonnage de la weightMap
    const sampleWeightMap = useCallback((u, v) => {
        if (!config.enableWeightMap || !weightMapImageData.current) {
            return 1.0;
        }

        const { width, height, data } = weightMapImageData.current;
        const x = Math.floor(u * width) % width;
        const y = Math.floor((1 - v) * height) % height;

        const pixelIndex = (y * width + x) * 4;
        const grayscaleValue = data[pixelIndex] / 255.0;

        // INVERSER : Noir = herbe maximale, Blanc = pas d'herbe
        const invertedValue = 1.0 - grayscaleValue;
        const smoothed = Math.max(0, (invertedValue - weightMapThreshold) / (1 - weightMapThreshold));
        const finalValue = Math.pow(smoothed, 1 / (weightMapSmoothing + 0.1));

        return Math.min(1.0, finalValue * weightMapIntensity);
    }, [config.enableWeightMap, weightMapThreshold, weightMapSmoothing, weightMapIntensity]);

    // Création du canvas pour lire les pixels de la weightMap
    useEffect(() => {
        if (!config.enableWeightMap || !weightMapTexture) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        weightMapCanvas.current = canvas;

        const img = weightMapTexture.image;
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);
        weightMapImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

        console.log('✅ WeightMap chargée:', canvas.width, 'x', canvas.height);
    }, [weightMapTexture, config.enableWeightMap]);

    const getGrassTexture = () => {
        if (!config.enableTextureTransitions) {
            return [grassTextures[grassTextureIndex], grassTextures[grassTextureIndex]];
        }
        return [grassTextures[previousGrassTextureIndex.current], grassTextures[grassTextureIndex]];
    };

    // Chargement du modèle 3D
    const { nodes } = config.enableSurfacePlacement ?
        useGLTF('/models/Ground.glb') : { nodes: null };
    const targetMesh = nodes?.Retopo_Plane002;

    // Génération de brin simple (LOW/MEDIUM quality)
    const generateSimpleBlade = useCallback((center, vArrOffset, uv, heightMultiplier = 1.0) => {
        const height = (BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION) * heightMultiplier;
        const yaw = Math.random() * Math.PI * 2;
        const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));

        const bl = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(BLADE_WIDTH / 2));
        const br = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(-BLADE_WIDTH / 2));
        const tc = new Vector3().copy(center).setY(center.y + height);

        // Système de couleurs simplifié : 3 variants comme dans paste.txt
        const black = new Color(0, 0, 0);      // Base
        const gray = new Color(0.5, 0.5, 0.5); // Milieu
        const white = new Color(1.0, 1.0, 1.0); // Pointe

        const verts = [
            { pos: bl.toArray(), uvArray: uv, color: black.toArray() },  // Base gauche
            { pos: br.toArray(), uvArray: uv, color: black.toArray() },  // Base droite
            { pos: tc.toArray(), uvArray: uv, color: white.toArray() },  // Pointe
        ];

        const indices = [vArrOffset, vArrOffset + 1, vArrOffset + 2];

        return { verts, indices };
    }, [BLADE_HEIGHT, BLADE_HEIGHT_VARIATION, BLADE_WIDTH]);

    // Génération de brin complexe (HIGH/ULTRA quality) - comme dans paste.txt
    const generateComplexBlade = useCallback((center, vArrOffset, uv, heightMultiplier = 1.0) => {
        const MID_WIDTH = BLADE_WIDTH * 0.5;
        const TIP_OFFSET = 0.1;
        const height = (BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION) * heightMultiplier;

        const yaw = Math.random() * Math.PI * 2;
        const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
        const tipBend = Math.random() * Math.PI * 2;
        const tipBendUnitVec = new Vector3(Math.sin(tipBend), 0, -Math.cos(tipBend));

        const bl = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(BLADE_WIDTH / 2));
        const br = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(-BLADE_WIDTH / 2));
        const tl = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(MID_WIDTH / 2)).setY(center.y + height / 2);
        const tr = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(-MID_WIDTH / 2)).setY(center.y + height / 2);
        const tc = new Vector3().addVectors(center, tipBendUnitVec.clone().multiplyScalar(TIP_OFFSET)).setY(center.y + height);

        // Système de couleurs simplifié : exactement comme dans paste.txt
        const black = new Color(0, 0, 0);      // Base
        const gray = new Color(0.5, 0.5, 0.5); // Milieu
        const white = new Color(1.0, 1.0, 1.0); // Pointe

        const verts = [
            { pos: bl.toArray(), uvArray: uv, color: black.toArray() },  // Base gauche
            { pos: br.toArray(), uvArray: uv, color: black.toArray() },  // Base droite
            { pos: tr.toArray(), uvArray: uv, color: gray.toArray() },   // Milieu droite
            { pos: tl.toArray(), uvArray: uv, color: gray.toArray() },   // Milieu gauche
            { pos: tc.toArray(), uvArray: uv, color: white.toArray() },  // Pointe
        ];

        const indices = [
            vArrOffset, vArrOffset + 1, vArrOffset + 2,
            vArrOffset + 2, vArrOffset + 4, vArrOffset + 3,
            vArrOffset + 3, vArrOffset, vArrOffset + 2
        ];

        return { verts, indices };
    }, [BLADE_HEIGHT, BLADE_HEIGHT_VARIATION, BLADE_WIDTH]);

    // Sélection de la fonction de génération selon la qualité
    const generateBlade = config.enableComplexGeometry ? generateComplexBlade : generateSimpleBlade;

    // Shader material avec contrôle de couleur et saturation
    const grassMaterial = useMemo(() => {
        const vertexShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            ${config.enableWind ? 'uniform float iTime;' : ''}

            void main() {
                vUv = uv;
                ${config.enableClouds ? 'cloudUV = uv;' : ''}
                vColor = color;
                vec3 cpos = position;

                ${config.enableWind ? `
                    float waveSize = 10.0;
                    float tipDistance = 0.3;
                    float centerDistance = 0.1;

                    if (color.x > 0.6) {
                        cpos.x += sin((iTime / 500.0) + (uv.x * waveSize)) * tipDistance;
                    } else if (color.x > 0.0) {
                        cpos.x += sin((iTime / 500.0) + (uv.x * waveSize)) * centerDistance;
                    }
                ` : ''}

                ${config.enableClouds ? `
                    cloudUV.x += ${config.enableWind ? 'iTime / 20000.0' : '0.0'};
                    cloudUV.y += ${config.enableWind ? 'iTime / 10000.0' : '0.0'};
                ` : ''}

                gl_Position = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
            }`;

        const fragmentShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            
            uniform sampler2D uGrassTextures[2];
            ${config.enableClouds ? 'uniform sampler2D uCloudTexture;' : ''}
            ${config.enableTextureTransitions ? 'uniform float uProgress;' : ''}
            
            // Paramètres de couleur
            uniform float uGrassHue;
            uniform float uGrassSaturation;
            uniform float uGrassBrightness;
            uniform float uColorVariation;

            // Fonction HSV vers RGB
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            // Fonction pour ajouter de la saturation à une couleur existante
            vec3 adjustSaturation(vec3 color, float saturation) {
                float gray = dot(color, vec3(0.299, 0.587, 0.114));
                return mix(vec3(gray), color, saturation);
            }

            void main() {
                float contrast = 1.0;
                float brightness = 0.1;

                ${config.enableTextureTransitions ? `
                    vec3 startTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast;
                    startTexture = startTexture + vec3(brightness);
                    
                    vec3 endTexture = texture2D(uGrassTextures[1], vUv).rgb * contrast;
                    endTexture = endTexture + vec3(brightness);
                    
                    vec3 finalTexture = mix(startTexture, endTexture, uProgress);
                ` : `
                    vec3 finalTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast;
                    finalTexture = finalTexture + vec3(brightness);
                `}

                ${config.enableClouds ? `
                    vec3 cloudColor = texture2D(uCloudTexture, cloudUV).rgb * contrast;
                    cloudColor = cloudColor + vec3(brightness);
                    vec3 blendedColor = mix(finalTexture, cloudColor, 0.3);
                ` : `
                    vec3 blendedColor = finalTexture;
                `}

                // Génération de la couleur de base de l'herbe
                // Variation de teinte basée sur la position pour plus de naturel
                float hueVariation = (sin(vUv.x * 10.0) * sin(vUv.y * 10.0)) * uColorVariation * 0.1;
                float finalHue = uGrassHue + hueVariation;
                
                // Variation de saturation basée sur vColor (noir=base, gris=milieu, blanc=pointe)
                float heightFactor = vColor.r; // 0=base, 0.5=milieu, 1=pointe
                float saturationMultiplier = 0.7 + (heightFactor * 0.6); // Plus saturé vers la pointe
                
                // Variation de luminosité
                float brightnessMultiplier = uGrassBrightness * (0.3 + heightFactor * 0.7);
                
                // Création de la couleur HSV
                vec3 grassColorHSV = vec3(finalHue, uGrassSaturation * saturationMultiplier, brightnessMultiplier);
                vec3 grassColorRGB = hsv2rgb(grassColorHSV);
                
                // Mélange avec la texture
                vec3 finalColor = mix(blendedColor, blendedColor * grassColorRGB * 2.0, 0.8);
                
                // Augmentation globale de la saturation
                finalColor = adjustSaturation(finalColor, 1.4);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }`;

        const uniforms = {
            uGrassTextures: { value: [grassTextures[0], grassTextures[0]] },
            uGrassHue: { value: grassHue },
            uGrassSaturation: { value: grassSaturation },
            uGrassBrightness: { value: grassBrightness },
            uColorVariation: { value: colorVariation },
            ...(config.enableWind && { iTime: timeUniform.current }),
            ...(config.enableClouds && { uCloudTexture: { value: cloudTexture } }),
            ...(config.enableTextureTransitions && { uProgress: progress.current }),
        };

        return new ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            vertexColors: true,
            side: DoubleSide,
        });
    }, [cloudTexture, grassTextures, quality, config, grassHue, grassSaturation, grassBrightness, colorVariation]);

    // Placement sur surface 3D
    const generateSurfacePlacement = useCallback(() => {
        if (!targetMesh?.geometry) {
            console.error('❌ Aucune géométrie trouvée sur le mesh cible.');
            return [];
        }

        const positions = [];
        const geom = targetMesh.geometry.clone();
        geom.computeBoundingBox();
        geom.computeVertexNormals();

        const positionAttr = geom.attributes.position;
        const surfaceMin = geom.boundingBox.min;
        const surfaceMax = geom.boundingBox.max;

        const candidateCount = config.enableWeightMap ? BLADE_COUNT * 3 : BLADE_COUNT;
        let placedCount = 0;

        for (let i = 0; i < candidateCount && placedCount < BLADE_COUNT; i++) {
            const triIndex = Math.floor(Math.random() * geom.index.count / 3) * 3;
            const idx0 = geom.index.array[triIndex];
            const idx1 = geom.index.array[triIndex + 1];
            const idx2 = geom.index.array[triIndex + 2];

            const v0 = new Vector3().fromBufferAttribute(positionAttr, idx0);
            const v1 = new Vector3().fromBufferAttribute(positionAttr, idx1);
            const v2 = new Vector3().fromBufferAttribute(positionAttr, idx2);

            const r1 = Math.random();
            const r2 = Math.random();
            const sqrtR1 = Math.sqrt(r1);
            const pos = new Vector3()
                .addScaledVector(v0, 1 - sqrtR1)
                .addScaledVector(v1, sqrtR1 * (1 - r2))
                .addScaledVector(v2, sqrtR1 * r2);

            const uv = [
                convertRange(pos.x, surfaceMin.x, surfaceMax.x, 0, 1),
                convertRange(pos.z, surfaceMin.z, surfaceMax.z, 0, 1)
            ];

            const weightValue = sampleWeightMap(uv[0], uv[1]);
            const shouldPlace = Math.random() < weightValue;

            if (shouldPlace) {
                positions.push({ pos, uv, weight: weightValue });
                placedCount++;
            }
        }

        return positions;
    }, [targetMesh, BLADE_COUNT, config.enableWeightMap, sampleWeightMap]);

    // Placement plat
    const generateFlatPlacement = useCallback(() => {
        const positions = [];
        const fieldSize = 50;

        const candidateCount = config.enableWeightMap ? BLADE_COUNT * 3 : BLADE_COUNT;
        let placedCount = 0;

        for (let i = 0; i < candidateCount && placedCount < BLADE_COUNT; i++) {
            const x = (Math.random() - 0.5) * fieldSize;
            const z = (Math.random() - 0.5) * fieldSize;
            const pos = new Vector3(x, 0, z);
            const uv = [(x + fieldSize/2) / fieldSize, (z + fieldSize/2) / fieldSize];

            const weightValue = sampleWeightMap(uv[0], uv[1]);
            const shouldPlace = Math.random() < weightValue;

            if (shouldPlace) {
                positions.push({ pos, uv, weight: weightValue });
                placedCount++;
            }
        }

        return positions;
    }, [BLADE_COUNT, config.enableWeightMap, sampleWeightMap]);

    // Génération du champ
    const generateField = useCallback(() => {
        console.log('🌱 Génération de', BLADE_COUNT, 'brins avec qualité', quality);

        const positions = [], uvs = [], indices = [], colors = [];

        const bladePositions = config.enableSurfacePlacement ?
            generateSurfacePlacement() : generateFlatPlacement();

        if (bladePositions.length === 0) return;

        bladePositions.forEach(({ pos, uv, weight = 1.0 }, i) => {
            const vArrOffset = i * config.bladeComplexity;
            const heightMultiplier = config.enableWeightMap ? 0.5 + (weight * 0.5) : 1.0;

            const blade = generateBlade(pos, vArrOffset, uv, heightMultiplier);

            blade.verts.forEach(v => {
                positions.push(...v.pos);
                uvs.push(...v.uvArray);
                colors.push(...v.color);
            });
            indices.push(...blade.indices);
        });

        const grassGeometry = new BufferGeometry();
        grassGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
        grassGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
        grassGeometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
        grassGeometry.setIndex(indices);
        grassGeometry.computeVertexNormals();

        if (meshRef.current) {
            meshRef.current.geometry = grassGeometry;
            meshRef.current.material = grassMaterial;
            console.log('✅ Champ d\'herbe appliqué avec', bladePositions.length, 'brins');
        }
    }, [generateBlade, grassMaterial, config, quality, generateSurfacePlacement, generateFlatPlacement]);

    useEffect(() => {
        generateField();
        if (onLoaded) onLoaded();
    }, [generateField, onLoaded]);

    // Transitions de textures et mise à jour des uniforms
    useEffect(() => {
        // Mise à jour des uniforms de couleur
        if (grassMaterial.uniforms.uGrassHue) {
            grassMaterial.uniforms.uGrassHue.value = grassHue;
            grassMaterial.uniforms.uGrassSaturation.value = grassSaturation;
            grassMaterial.uniforms.uGrassBrightness.value = grassBrightness;
            grassMaterial.uniforms.uColorVariation.value = colorVariation;
        }

        if (!config.enableTextureTransitions) {
            grassMaterial.uniforms.uGrassTextures.value = [grassTextures[grassTextureIndex], grassTextures[grassTextureIndex]];
            return;
        }

        grassMaterial.uniforms.uGrassTextures.value = getGrassTexture();
        gsap.to(progress.current, {
            value: 1,
            duration: 2,
            onComplete: () => {
                previousGrassTextureIndex.current = grassTextureIndex;
                grassMaterial.uniforms.uGrassTextures.value = getGrassTexture();
                progress.current.value = 0.0;
            }
        });
    }, [grassTextureIndex, getGrassTexture, grassMaterial, config.enableTextureTransitions, grassHue, grassSaturation, grassBrightness, colorVariation]);

    // Animation
    useFrame(() => {
        if (config.enableWind && config.animationQuality !== 'none') {
            const elapsedTime = (Date.now() - startTime.current) * 0.6;
            timeUniform.current.value = elapsedTime;
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 15.15, 0]}>
            <bufferGeometry />
        </mesh>
    );
};

const convertRange = (val, oldMin, oldMax, newMin, newMax) =>
    ((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin;

export default GrassField;