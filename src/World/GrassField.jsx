// File: GrassField.jsx - Version ULTRA-OPTIMISÉE avec Instancing + Caching

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, ShaderMaterial, DoubleSide, Vector3, Color, BufferAttribute, BufferGeometry, InstancedMesh, Matrix4, InstancedBufferAttribute, DataTexture, RGBAFormat, UnsignedByteType } from 'three';
import { useGLTF } from '@react-three/drei';
import { gsap } from 'gsap';
import { useAnimationFrame, animationManager } from '../Utils/AnimationManager';

// 🚀 NOUVEAU : Cache global pour les géométries
const GEOMETRY_CACHE = new Map();
const WEIGHTMAP_CACHE = new Map();

// Configuration des niveaux de qualité avec instancing
const QUALITY_PRESETS = {
    ULTRA: {
        bladeCount: 100000, // 🚀 Augmenté grâce à l'instancing
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 5,
        animationQuality: 'low',
        performanceMode: 'high',
        animationThrottling: {
            animation: 2,
            physics: 4,
            ui: 8
        }
    },
    HIGH: {
        bladeCount: 80000, // 🚀 Augmenté
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 5,
        animationQuality: 'medium',
        performanceMode: 'high',
        animationThrottling: {
            wind: 1,
            texture: 2,
            physics: 2,
            ui: 4
        }
    },
    MEDIUM: {
        bladeCount: 50000, // 🚀 Augmenté
        enableWind: true,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 3,
        animationQuality: 'low',
        performanceMode: 'medium',
        animationThrottling: {
            wind: 2,
            texture: 4,
            physics: 3,
            ui: 6
        }
    },
    LOW: {
        bladeCount: 25000, // 🚀 Augmenté
        enableWind: false,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: false,
        enableWeightMap: false,
        bladeComplexity: 3,
        animationQuality: 'none',
        performanceMode: 'low',
        animationThrottling: {
            wind: 1,
            texture: 8,
            physics: 6,
            ui: 10
        }
    }
};

// 🚀 NOUVEAU : Fonction pour créer une weightmap optimisée
const createOptimizedWeightMap = async (texture, intensity, threshold, smoothing) => {
    const cacheKey = `${texture.image.src}-${intensity}-${threshold}-${smoothing}`;

    if (WEIGHTMAP_CACHE.has(cacheKey)) {
        return WEIGHTMAP_CACHE.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = texture.image;

    // Utiliser une résolution optimisée (pas forcément full-res)
    const targetSize = 1024; // Résolution optimale pour les performances
    canvas.width = targetSize;
    canvas.height = targetSize;

    ctx.drawImage(img, 0, 0, targetSize, targetSize);
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);

    // Pré-calculer les valeurs optimisées en Uint8Array pour de meilleures perfs
    const optimizedData = new Uint8Array(targetSize * targetSize);

    for (let i = 0; i < imageData.data.length; i += 4) {
        const grayscale = imageData.data[i] / 255.0;
        const inverted = 1.0 - grayscale;
        const smoothed = Math.max(0, (inverted - threshold) / (1 - threshold));
        const final = Math.min(1.0, Math.pow(smoothed, 1 / (smoothing + 0.1)) * intensity);

        optimizedData[i / 4] = Math.round(final * 255);
    }

    const result = {
        data: optimizedData,
        width: targetSize,
        height: targetSize
    };

    WEIGHTMAP_CACHE.set(cacheKey, result);
    return result;
};

// 🚀 NOUVEAU : Fonction pour créer une géométrie de brin de base
const createBaseBladeGeometry = (complex = false) => {
    const BLADE_WIDTH = 0.05;
    const BLADE_HEIGHT = 0.2;

    const geometry = new BufferGeometry();

    if (complex) {
        // Géométrie complexe (5 vertices)
        const vertices = new Float32Array([
            -BLADE_WIDTH/2, 0, 0,     // Bottom left
            BLADE_WIDTH/2, 0, 0,      // Bottom right
            BLADE_WIDTH/4, BLADE_HEIGHT/2, 0,   // Mid right
            -BLADE_WIDTH/4, BLADE_HEIGHT/2, 0,  // Mid left
            0, BLADE_HEIGHT, 0         // Top center
        ]);

        const indices = [
            0, 1, 2,  // Bottom triangle
            2, 4, 3,  // Top triangle
            3, 0, 2   // Left triangle
        ];

        const colors = new Float32Array([
            0, 0, 0,  // Black (bottom)
            0, 0, 0,  // Black (bottom)
            0.5, 0.5, 0.5,  // Gray (mid)
            0.5, 0.5, 0.5,  // Gray (mid)
            1, 1, 1   // White (top)
        ]);

        geometry.setAttribute('position', new BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new BufferAttribute(colors, 3));
        geometry.setIndex(indices);
    } else {
        // Géométrie simple (3 vertices)
        const vertices = new Float32Array([
            -BLADE_WIDTH/2, 0, 0,     // Bottom left
            BLADE_WIDTH/2, 0, 0,      // Bottom right
            0, BLADE_HEIGHT, 0        // Top center
        ]);

        const indices = [0, 1, 2];

        const colors = new Float32Array([
            0, 0, 0,  // Black
            0, 0, 0,  // Black
            1, 1, 1   // White
        ]);

        geometry.setAttribute('position', new BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new BufferAttribute(colors, 3));
        geometry.setIndex(indices);
    }

    // UV mapping simple
    const uvs = new Float32Array(geometry.attributes.position.count * 2);
    for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] = Math.random();     // U
        uvs[i + 1] = Math.random(); // V
    }
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));

    geometry.computeVertexNormals();
    return geometry;
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
                        colorVariation = 0.0,
                        enablePerformanceOptimization = true,
                        customThrottling = {}
                    }) => {
    const instancedMeshRef = useRef();
    const [isLoaded, setIsLoaded] = useState(false);

    // Merge preset avec config custom
    const config = useMemo(() => ({
        ...QUALITY_PRESETS[quality],
        ...customConfig
    }), [quality, customConfig]);

    // Configuration du système d'animation centralisé
    useEffect(() => {
        if (enablePerformanceOptimization) {
            animationManager.setPerformanceMode(config.performanceMode);
            const throttling = { ...config.animationThrottling, ...customThrottling };
            Object.entries(throttling).forEach(([category, interval]) => {
                animationManager.setThrottling(category, interval);
            });
        }
    }, [quality, config.performanceMode, config.animationThrottling, customThrottling, enablePerformanceOptimization]);

    const BLADE_COUNT = config.bladeCount;

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

    // Uniforms optimisés
    const timeUniform = useRef({ type: 'f', value: 0.0 });
    const progress = useRef({ type: 'f', value: 0.0 });
    const startTime = useRef(Date.now());
    const previousGrassTextureIndex = useRef(0);

    // 🚀 NOUVEAU : Weightmap optimisée
    const optimizedWeightMap = useRef(null);

    // Échantillonnage optimisé de la weightMap
    const sampleWeightMap = useCallback((u, v) => {
        if (!config.enableWeightMap || !optimizedWeightMap.current) {
            return 1.0;
        }

        const { data, width, height } = optimizedWeightMap.current;
        const x = Math.floor(u * width) % width;
        const y = Math.floor((1 - v) * height) % height;

        return data[y * width + x] / 255.0;
    }, [config.enableWeightMap]);

    // Création de la weightmap optimisée
    useEffect(() => {
        if (!config.enableWeightMap || !weightMapTexture) return;

        createOptimizedWeightMap(weightMapTexture, weightMapIntensity, weightMapThreshold, weightMapSmoothing)
            .then(result => {
                optimizedWeightMap.current = result;
                console.log('✅ WeightMap optimisée chargée:', result.width, 'x', result.height);
            });
    }, [weightMapTexture, config.enableWeightMap, weightMapIntensity, weightMapThreshold, weightMapSmoothing]);

    // Chargement du modèle 3D
    const { nodes } = config.enableSurfacePlacement ?
        useGLTF('/models/Ground.glb') : { nodes: null };
    const targetMesh = nodes?.Retopo_Plane002;

    // 🚀 NOUVEAU : Shader material optimisé avec instancing
    const grassMaterial = useMemo(() => {
        const vertexShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            ${config.enableWind ? 'uniform float iTime;' : ''}
            
            // 🚀 Instanced attributes
            attribute float windOffset;
            attribute float heightMultiplier;
            attribute vec2 bladeUV;

            void main() {
                vUv = bladeUV;
                ${config.enableClouds ? 'cloudUV = bladeUV;' : ''}
                vColor = color;
                
                // Utiliser la position transformée par la matrice d'instance
                vec3 cpos = position;
                cpos.y *= heightMultiplier; // Appliquer la variation de hauteur
                
                // Appliquer la transformation d'instance
                vec4 instancePosition = instanceMatrix * vec4(cpos, 1.0);

                ${config.enableWind ? `
                    float waveSize = 10.0;
                    float tipDistance = 0.1;
                    float centerDistance = 0.025;

                    if (color.x > 0.6) {
                        instancePosition.x += sin((iTime / 500.0) + windOffset) * tipDistance;
                    } else if (color.x > 0.0) {
                        instancePosition.x += sin((iTime / 500.0) + windOffset) * centerDistance;
                    }
                ` : ''}

                ${config.enableClouds ? `
                    cloudUV.x += ${config.enableWind ? 'iTime / 20000.0' : '0.0'};
                    cloudUV.y += ${config.enableWind ? 'iTime / 10000.0' : '0.0'};
                ` : ''}

                gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
            }`;

        const fragmentShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            
            uniform sampler2D uGrassTextures[2];
            ${config.enableClouds ? 'uniform sampler2D uCloudTexture;' : ''}
            ${config.enableTextureTransitions ? 'uniform float uProgress;' : ''}
            
            uniform float uGrassHue;
            uniform float uGrassSaturation;
            uniform float uGrassBrightness;
            uniform float uColorVariation;

            // 🚀 OPTIMISÉ : LUT pré-calculée pour HSV (approximation rapide)
            vec3 fastHsv2rgb(vec3 c) {
                vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
                return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
            }

            void main() {
                const float contrast = 0.05;
                const float brightness = 0.01;

                ${config.enableTextureTransitions ? `
                    vec3 startTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast + brightness;
                    vec3 endTexture = texture2D(uGrassTextures[1], vUv).rgb * contrast + brightness;
                    vec3 finalTexture = mix(startTexture, endTexture, uProgress);
                ` : `
                    vec3 finalTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast + brightness;
                `}

                ${config.enableClouds ? `
                    vec3 cloudColor = texture2D(uCloudTexture, cloudUV).rgb * contrast + brightness;
                    vec3 blendedColor = mix(finalTexture, cloudColor, 0.3);
                ` : `
                    vec3 blendedColor = finalTexture;
                `}

                // 🚀 OPTIMISÉ : Calculs de couleur simplifiés
                float hueVariation = sin(vUv.x * 10.0) * sin(vUv.y * 10.0) * uColorVariation * 0.1;
                float finalHue = uGrassHue + hueVariation;
                
                float heightFactor = vColor.r;
                float satMultiplier = 0.7 + heightFactor * 0.6;
                float brightMultiplier = uGrassBrightness * (0.3 + heightFactor * 0.7);
                
                vec3 grassColorHSV = vec3(finalHue, uGrassSaturation * satMultiplier, brightMultiplier);
                vec3 grassColorRGB = fastHsv2rgb(grassColorHSV);
                
                vec3 finalColor = mix(blendedColor, blendedColor * grassColorRGB * 2.0, 0.8);
                
                // 🚀 OPTIMISÉ : Saturation simplifiée
                float gray = dot(finalColor, vec3(0.299, 0.587, 0.114));
                finalColor = mix(vec3(gray), finalColor, 1.4);
                
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

    // 🚀 NOUVEAU : Génération des instances avec cache
    const generateInstances = useCallback(() => {
        const cacheKey = `${quality}-${config.enableSurfacePlacement}-${config.enableWeightMap}-${BLADE_COUNT}-${weightMapPath}`;

        if (GEOMETRY_CACHE.has(cacheKey)) {
            console.log('📦 Utilisation du cache pour:', cacheKey);
            return GEOMETRY_CACHE.get(cacheKey);
        }

        console.log('🌱 Génération de', BLADE_COUNT, 'instances avec qualité', quality);

        const matrices = [];
        const windOffsets = [];
        const heightMultipliers = [];
        const bladeUVs = [];

        // Générer les positions
        const positions = config.enableSurfacePlacement ?
            generateSurfacePositions() : generateFlatPositions();

        positions.forEach(({ pos, uv, weight = 1.0 }) => {
            // Matrice de transformation
            const matrix = new Matrix4();
            const heightMult = config.enableWeightMap ? 0.5 + (weight * 0.5) : 1.0;
            const heightVar = 1.0 + (Math.random() - 0.5) * 0.2; // Variation de hauteur

            // Rotation aléatoire
            const yaw = Math.random() * Math.PI * 2;
            matrix.makeRotationY(yaw);
            matrix.setPosition(pos.x, pos.y, pos.z);

            matrices.push(matrix);
            windOffsets.push(Math.random() * Math.PI * 2); // Offset pour le vent
            heightMultipliers.push(heightMult * heightVar);
            bladeUVs.push(uv[0], uv[1]);
        });

        const result = {
            matrices,
            windOffsets: new Float32Array(windOffsets),
            heightMultipliers: new Float32Array(heightMultipliers),
            bladeUVs: new Float32Array(bladeUVs),
            count: positions.length
        };

        GEOMETRY_CACHE.set(cacheKey, result);
        return result;
    }, [config, quality, BLADE_COUNT, weightMapPath]);

    // Génération des positions sur surface 3D
    const generateSurfacePositions = useCallback(() => {
        if (!targetMesh?.geometry) {
            console.error('❌ Aucune géométrie trouvée sur le mesh cible.');
            return [];
        }

        const positions = [];
        const geom = targetMesh.geometry.clone();
        geom.computeBoundingBox();

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
                (pos.x - surfaceMin.x) / (surfaceMax.x - surfaceMin.x),
                (pos.z - surfaceMin.z) / (surfaceMax.z - surfaceMin.z)
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

    // Génération des positions plates
    const generateFlatPositions = useCallback(() => {
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

    // 🚀 NOUVEAU : Création de l'InstancedMesh
    useEffect(() => {
        if (!instancedMeshRef.current) return;

        const baseGeometry = createBaseBladeGeometry(config.enableComplexGeometry);
        const instances = generateInstances();

        // Créer l'InstancedMesh
        instancedMeshRef.current.geometry = baseGeometry;
        instancedMeshRef.current.material = grassMaterial;
        instancedMeshRef.current.count = instances.count;

        // Appliquer les matrices d'instances
        instances.matrices.forEach((matrix, i) => {
            instancedMeshRef.current.setMatrixAt(i, matrix);
        });

        // 🚀 NOUVEAU : Ajouter les attributs d'instance
        instancedMeshRef.current.geometry.setAttribute(
            'windOffset',
            new InstancedBufferAttribute(instances.windOffsets, 1)
        );
        instancedMeshRef.current.geometry.setAttribute(
            'heightMultiplier',
            new InstancedBufferAttribute(instances.heightMultipliers, 1)
        );
        instancedMeshRef.current.geometry.setAttribute(
            'bladeUV',
            new InstancedBufferAttribute(instances.bladeUVs, 2)
        );

        instancedMeshRef.current.instanceMatrix.needsUpdate = true;

        console.log('✅ InstancedMesh créé avec', instances.count, 'brins');
        setIsLoaded(true);
        if (onLoaded) onLoaded();
    }, [generateInstances, grassMaterial, config.enableComplexGeometry, onLoaded]);

    // Animation du vent optimisée
    useAnimationFrame((state, delta) => {
        if (config.enableWind && config.animationQuality !== 'none') {
            const elapsedTime = (Date.now() - startTime.current) * 0.3;
            timeUniform.current.value = elapsedTime;
        }
    }, 'animation');

    // Gestion des mises à jour de couleur
    useEffect(() => {
        const colorUpdateCallback = () => {
            if (grassMaterial.uniforms.uGrassHue) {
                grassMaterial.uniforms.uGrassHue.value = grassHue;
                grassMaterial.uniforms.uGrassSaturation.value = grassSaturation;
                grassMaterial.uniforms.uGrassBrightness.value = grassBrightness;
                grassMaterial.uniforms.uColorVariation.value = colorVariation;
            }
        };

        if (enablePerformanceOptimization) {
            const callbackId = animationManager.addCallback('ui', colorUpdateCallback);
            return () => animationManager.removeCallback('ui', callbackId);
        } else {
            colorUpdateCallback();
        }
    }, [grassMaterial, grassHue, grassSaturation, grassBrightness, colorVariation, enablePerformanceOptimization]);

    // Transitions de textures
    useEffect(() => {
        if (!config.enableTextureTransitions) {
            grassMaterial.uniforms.uGrassTextures.value = [grassTextures[grassTextureIndex], grassTextures[grassTextureIndex]];
            return;
        }

        grassMaterial.uniforms.uGrassTextures.value = [grassTextures[previousGrassTextureIndex.current], grassTextures[grassTextureIndex]];

        gsap.to(progress.current, {
            value: 1,
            duration: 2,
            onComplete: () => {
                previousGrassTextureIndex.current = grassTextureIndex;
                grassMaterial.uniforms.uGrassTextures.value = [grassTextures[grassTextureIndex], grassTextures[grassTextureIndex]];
                progress.current.value = 0.0;
            }
        });
    }, [grassTextureIndex, grassMaterial, config.enableTextureTransitions]);

    // Monitoring des performances
    useAnimationFrame((state, delta) => {
        const stats = animationManager.getStats();

        if (stats.frameCount % 180 === 0 && window.location.search.includes('debug')) {
            console.log(`🔍 GrassField Performance - ${quality}:`, {
                frameTime: `${stats.lastFrameTime.toFixed(2)}ms`,
                avgFrameTime: `${stats.averageFrameTime.toFixed(2)}ms`,
                instanceCount: instancedMeshRef.current?.count || 0,
                throttling: stats.throttleConfig
            });
        }
    }, 'analytics');

    return (
        <instancedMesh
            ref={instancedMeshRef}
            args={[null, null, BLADE_COUNT]}
            position={[0, 15.15, 0]}
        />
    );
};

export default GrassField;