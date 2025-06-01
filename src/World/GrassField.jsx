// File: GrassField.jsx - Version avec Culling et LOD fonctionnels

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, ShaderMaterial, DoubleSide, Vector3, Color, BufferAttribute, BufferGeometry } from 'three';
import { useGLTF } from '@react-three/drei';
import { gsap } from 'gsap';

// 🚀 Configuration des niveaux de qualité OPTIMISÉE
const QUALITY_PRESETS = {
    ULTRA: {
        bladeCount: 25000,
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        animationQuality: 'high',
        cullingDistance: 28 // Distance de culling
    },
    HIGH: {
        bladeCount: 15000,
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: false,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        animationQuality: 'medium',
        cullingDistance: 10
    },
    MEDIUM: {
        bladeCount: 8000,
        enableWind: true,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: true,
        enableWeightMap: false,
        animationQuality: 'low',
        cullingDistance: 50
    },
    LOW: {
        bladeCount: 3000,
        enableWind: false,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: false,
        enableWeightMap: false,
        animationQuality: 'none',
        cullingDistance: 30
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
                        grassHue = 0.3,
                        grassSaturation = 1.0,
                        grassBrightness = 1.0,
                        colorVariation = 0.0
                    }) => {
    const meshRef = useRef();

    // Merge preset avec config custom (défini en premier)
    const config = useMemo(() => ({
        ...QUALITY_PRESETS[quality],
        ...customConfig
    }), [quality, customConfig]);

    // 🆕 Accès à la caméra pour le culling
    const { camera } = useThree();

    // 🆕 Uniform pour la position de la caméra (culling GPU)
    const cameraPositionUniform = useRef({ value: new Vector3(0, 20, 0) }); // Position initiale raisonnable
    const cullingDistanceUniform = useRef({ value: config.cullingDistance });
    const [isCameraReady, setIsCameraReady] = useState(false);

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

    // Optimisation : Cache pour les calculs coûteux
    const calculationCache = useRef(new Map());

    // Throttling pour les updates
    const lastUpdateTime = useRef(0);
    const UPDATE_INTERVAL = 16; // ~60fps max

    // Mise à jour de la distance de culling
    useEffect(() => {
        cullingDistanceUniform.current.value = config.cullingDistance;
    }, [config.cullingDistance]);

    // Échantillonnage de la weightMap (optimisé)
    const sampleWeightMap = useCallback((u, v) => {
        if (!config.enableWeightMap || !weightMapImageData.current) {
            return 1.0;
        }

        const cacheKey = `${Math.floor(u * 100)}_${Math.floor(v * 100)}`;
        if (calculationCache.current.has(cacheKey)) {
            return calculationCache.current.get(cacheKey);
        }

        const { width, height, data } = weightMapImageData.current;
        const x = Math.floor(u * width) % width;
        const y = Math.floor((1 - v) * height) % height;

        const pixelIndex = (y * width + x) * 4;
        const grayscaleValue = data[pixelIndex] / 255.0;

        const invertedValue = 1.0 - grayscaleValue;
        const smoothed = Math.max(0, (invertedValue - weightMapThreshold) / (1 - weightMapThreshold));
        const finalValue = Math.min(1.0, Math.pow(smoothed, 1 / (weightMapSmoothing + 0.1)) * weightMapIntensity);

        calculationCache.current.set(cacheKey, finalValue);

        if (calculationCache.current.size > 1000) {
            const firstKey = calculationCache.current.keys().next().value;
            calculationCache.current.delete(firstKey);
        }

        return finalValue;
    }, [config.enableWeightMap, weightMapThreshold, weightMapSmoothing, weightMapIntensity]);

    // Création du canvas pour lire les pixels de la weightMap
    useEffect(() => {
        if (!config.enableWeightMap || !weightMapTexture) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        weightMapCanvas.current = canvas;

        const img = weightMapTexture.image;
        const scaleFactor = 0.5;
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        weightMapImageData.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

        console.log('✅ WeightMap chargée (optimisée):', canvas.width, 'x', canvas.height);
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

    // Génération de brin simple (optimisée)
    const generateSimpleBlade = useCallback((center, vArrOffset, uv, heightMultiplier = 1.0) => {
        const height = (BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION) * heightMultiplier;
        const yaw = Math.random() * Math.PI * 2;
        const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));

        const bl = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(BLADE_WIDTH / 2));
        const br = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(-BLADE_WIDTH / 2));
        const tc = new Vector3().copy(center).setY(center.y + height);

        const black = [0, 0, 0];
        const white = [1.0, 1.0, 1.0];

        const verts = [
            { pos: bl.toArray(), uvArray: uv, color: black },
            { pos: br.toArray(), uvArray: uv, color: black },
            { pos: tc.toArray(), uvArray: uv, color: white },
        ];

        const indices = [vArrOffset, vArrOffset + 1, vArrOffset + 2];

        return { verts, indices };
    }, [BLADE_HEIGHT, BLADE_HEIGHT_VARIATION, BLADE_WIDTH]);

    // Génération de brin complexe (optimisée)
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

        const black = [0, 0, 0];
        const gray = [0.5, 0.5, 0.5];
        const white = [1.0, 1.0, 1.0];

        const verts = [
            { pos: bl.toArray(), uvArray: uv, color: black },
            { pos: br.toArray(), uvArray: uv, color: black },
            { pos: tr.toArray(), uvArray: uv, color: gray },
            { pos: tl.toArray(), uvArray: uv, color: gray },
            { pos: tc.toArray(), uvArray: uv, color: white },
        ];

        const indices = [
            vArrOffset, vArrOffset + 1, vArrOffset + 2,
            vArrOffset + 2, vArrOffset + 4, vArrOffset + 3,
            vArrOffset + 3, vArrOffset, vArrOffset + 2
        ];

        return { verts, indices };
    }, [BLADE_HEIGHT, BLADE_HEIGHT_VARIATION, BLADE_WIDTH]);

    // Shader material avec culling GPU OPTIMISÉ
    const grassMaterial = useMemo(() => {
        const vertexShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            varying float vCulled; // 🆕 Variable pour indiquer si le vertex est culled
            ${config.enableWind ? 'uniform float iTime;' : ''}
            
            // 🎯 Uniforms pour le culling GPU
            uniform vec3 uCameraPosition;
            uniform float uCullingDistance;

            void main() {
                vUv = uv;
                ${config.enableClouds ? 'cloudUV = uv;' : ''}
                vColor = color;
                vCulled = 0.0; // Par défaut, pas culled
                vec3 cpos = position;

                ${config.enableWind ? `
                    float waveSize = 10.0;
                    float tipDistance = 0.1;
                    float centerDistance = 0.025;

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

                // 🎯 Culling GPU : calculer la distance à la caméra
                vec3 worldPosition = (modelMatrix * vec4(cpos, 1.0)).xyz;
                float distanceToCamera = distance(worldPosition, uCameraPosition);
                
                // Vérifier que la caméra est initialisée
                float cameraDistanceFromOrigin = distance(uCameraPosition, vec3(0.0, 0.0, 0.0));
                
                // 🚨 FIX : Au lieu de déplacer à l'infini, marquer comme culled
                if (distanceToCamera > uCullingDistance && cameraDistanceFromOrigin > 1.0) {
                    vCulled = 1.0;
                    // Déplacer hors de l'écran de manière propre (derrière la caméra)
                    gl_Position = vec4(0.0, -2.0, -1.0, -1.0);
                } else {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
                }
            }`;

        const fragmentShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            
            uniform sampler2D uGrassTextures[2];
            ${config.enableClouds ? 'uniform sampler2D uCloudTexture;' : ''}
            ${config.enableTextureTransitions ? 'uniform float uProgress;' : ''}
            
            uniform vec3 uGrassColorBase;
            uniform vec3 uGrassColorTip;
            uniform float uColorVariation;

            void main() {
                float contrast = 0.05;
                float brightness = 0.01;

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

                float heightFactor = vColor.r;
                float hueVariation = sin(vUv.x * 10.0) * sin(vUv.y * 10.0) * uColorVariation * 0.1;
                vec3 grassColor = mix(uGrassColorBase, uGrassColorTip, heightFactor);
                grassColor.rgb += hueVariation;
                vec3 finalColor = mix(blendedColor, blendedColor * grassColor * 2.0, 0.8);
                
                gl_FragColor = vec4(finalColor, 1.0);
            }`;

        const hsvToRgb = (h, s, v) => {
            const c = v * s;
            const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
            const m = v - c;
            let r = 0, g = 0, b = 0;

            if (0 <= h && h < 1/6) { r = c; g = x; b = 0; }
            else if (1/6 <= h && h < 2/6) { r = x; g = c; b = 0; }
            else if (2/6 <= h && h < 3/6) { r = 0; g = c; b = x; }
            else if (3/6 <= h && h < 4/6) { r = 0; g = x; b = c; }
            else if (4/6 <= h && h < 5/6) { r = x; g = 0; b = c; }
            else if (5/6 <= h && h < 1) { r = c; g = 0; b = x; }

            return [r + m, g + m, b + m];
        };

        const baseColor = hsvToRgb(grassHue, grassSaturation * 0.7, grassBrightness * 0.3);
        const tipColor = hsvToRgb(grassHue, grassSaturation, grassBrightness);

        const uniforms = {
            uGrassTextures: { value: [grassTextures[0], grassTextures[0]] },
            uGrassColorBase: { value: baseColor },
            uGrassColorTip: { value: tipColor },
            uColorVariation: { value: colorVariation },
            // 🎯 Uniforms pour le culling GPU
            uCameraPosition: cameraPositionUniform.current,
            uCullingDistance: cullingDistanceUniform.current,
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

    // Placement sur surface 3D (optimisé)
    const generateSurfacePlacement = useCallback(() => {
        if (!targetMesh?.geometry) {
            console.error('❌ Aucune géométrie trouvée sur le mesh cible.');
            return [];
        }

        const positions = [];
        const geom = targetMesh.geometry.clone();
        geom.computeBoundingBox();

        if (!geom.attributes.normal) {
            geom.computeVertexNormals();
        }

        const positionAttr = geom.attributes.position;
        const surfaceMin = geom.boundingBox.min;
        const surfaceMax = geom.boundingBox.max;

        const candidateCount = config.enableWeightMap ? BLADE_COUNT * 1.5 : BLADE_COUNT;
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

    // Placement plat (optimisé)
    const generateFlatPlacement = useCallback(() => {
        const positions = [];
        const fieldSize = 50;

        const candidateCount = config.enableWeightMap ? BLADE_COUNT * 1.5 : BLADE_COUNT;
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

    // Génération du champ (version standard optimisée)
    const generateField = useCallback(() => {
        console.log('🌱 Génération de', BLADE_COUNT, 'brins avec qualité', quality, '(avec culling GPU)');

        const bladePositions = config.enableSurfacePlacement ?
            generateSurfacePlacement() : generateFlatPlacement();

        if (bladePositions.length === 0) return;

        const positions = [];
        const uvs = [];
        const colors = [];
        const indices = [];

        // Choisir la fonction de génération selon la config globale
        const generateBlade = config.enableComplexGeometry ? generateComplexBlade : generateSimpleBlade;
        const verticesPerBlade = config.enableComplexGeometry ? 5 : 3;

        bladePositions.forEach(({ pos, uv, weight = 1.0 }, i) => {
            const vArrOffset = i * verticesPerBlade;
            const heightMultiplier = config.enableWeightMap ? 0.5 + (weight * 0.5) : 1.0;

            const blade = generateBlade(pos, vArrOffset, uv, heightMultiplier);

            blade.verts.forEach(v => {
                positions.push(...v.pos);
                uvs.push(...v.uvArray);
                colors.push(...v.color);
            });

            indices.push(...blade.indices);
        });

        const positionsArray = new Float32Array(positions);
        const uvsArray = new Float32Array(uvs);
        const colorsArray = new Float32Array(colors);

        const grassGeometry = new BufferGeometry();
        grassGeometry.setAttribute('position', new BufferAttribute(positionsArray, 3));
        grassGeometry.setAttribute('uv', new BufferAttribute(uvsArray, 2));
        grassGeometry.setAttribute('color', new BufferAttribute(colorsArray, 3));
        grassGeometry.setIndex(indices);
        grassGeometry.computeVertexNormals();

        if (meshRef.current) {
            meshRef.current.geometry = grassGeometry;
            meshRef.current.material = grassMaterial;
            console.log('✅ Champ d\'herbe avec culling GPU appliqué avec', bladePositions.length, 'brins');
        }
    }, [generateSurfacePlacement, generateFlatPlacement, generateComplexBlade, generateSimpleBlade, config, grassMaterial, BLADE_COUNT, quality]);

    // Initialisation
    useEffect(() => {
        generateField();
        if (onLoaded) onLoaded();
    }, [generateField, onLoaded]);

    // Transitions de textures et mise à jour des uniforms (throttlé)
    useEffect(() => {
        const now = Date.now();
        if (now - lastUpdateTime.current < UPDATE_INTERVAL) return;
        lastUpdateTime.current = now;

        if (grassMaterial.uniforms.uGrassColorBase) {
            const hsvToRgb = (h, s, v) => {
                const c = v * s;
                const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
                const m = v - c;
                let r = 0, g = 0, b = 0;

                if (0 <= h && h < 1/6) { r = c; g = x; b = 0; }
                else if (1/6 <= h && h < 2/6) { r = x; g = c; b = 0; }
                else if (2/6 <= h && h < 3/6) { r = 0; g = c; b = x; }
                else if (3/6 <= h && h < 4/6) { r = 0; g = x; b = c; }
                else if (4/6 <= h && h < 5/6) { r = x; g = 0; b = c; }
                else if (5/6 <= h && h < 1) { r = c; g = 0; b = x; }

                return [r + m, g + m, b + m];
            };

            const baseColor = hsvToRgb(grassHue, grassSaturation * 0.7, grassBrightness * 0.3);
            const tipColor = hsvToRgb(grassHue, grassSaturation, grassBrightness);

            grassMaterial.uniforms.uGrassColorBase.value = baseColor;
            grassMaterial.uniforms.uGrassColorTip.value = tipColor;
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

    // Animation avec mise à jour de la position caméra pour culling GPU
    useFrame(() => {
        // Animation du vent
        if (config.enableWind && config.animationQuality !== 'none') {
            const now = Date.now();
            if (now - lastUpdateTime.current >= UPDATE_INTERVAL) {
                const elapsedTime = (now - startTime.current) * 0.3;
                timeUniform.current.value = elapsedTime;
                lastUpdateTime.current = now;
            }
        }

        // 🎯 Mise à jour de la position caméra pour le culling GPU
        if (camera && camera.position) {
            // Vérifier que la caméra a une position valide
            const camPos = camera.position;
            if (camPos.x !== 0 || camPos.y !== 0 || camPos.z !== 0) {
                cameraPositionUniform.current.value.copy(camPos);
                if (!isCameraReady) {
                    setIsCameraReady(true);
                    console.log('📷 Caméra initialisée pour le culling:', camPos.x.toFixed(2), camPos.y.toFixed(2), camPos.z.toFixed(2));
                }
            }
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