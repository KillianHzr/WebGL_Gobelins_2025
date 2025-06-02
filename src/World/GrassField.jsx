// File: GrassField.jsx - Version ULTRA-OPTIMISÉE avec Frustum Culling + LOD + Memory Management

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, ShaderMaterial, DoubleSide, Vector3, Color, BufferAttribute, BufferGeometry, InstancedMesh, Matrix4, InstancedBufferAttribute, DataTexture, RGBAFormat, UnsignedByteType, Frustum, Matrix4 as ThreeMatrix4, Box3, Sphere } from 'three';
import { useGLTF } from '@react-three/drei';
import { gsap } from 'gsap';
import { useAnimationFrame, animationManager } from '../Utils/AnimationManager';

// 🚀 NOUVEAU : Cache global pour les géométries avec TTL
const GEOMETRY_CACHE = new Map();
const WEIGHTMAP_CACHE = new Map();
const TEXTURE_CACHE = new Map();

// 🚀 NOUVEAU : Memory management pour le cache
const CACHE_TTL = 300000; // 5 minutes
const cleanupCaches = () => {
    const now = Date.now();
    [GEOMETRY_CACHE, WEIGHTMAP_CACHE, TEXTURE_CACHE].forEach(cache => {
        for (const [key, value] of cache.entries()) {
            if (value.timestamp && (now - value.timestamp > CACHE_TTL)) {
                cache.delete(key);
            }
        }
    });
};

// Nettoyage automatique du cache
setInterval(cleanupCaches, 60000); // Toutes les minutes

// Configuration des niveaux de qualité avec LOD dynamique et culling
const QUALITY_PRESETS = {
    ULTRA: {
        bladeCount: 3000000,
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: false,
        enableFrustumCulling: true,
        enableLOD: true,
        cullingDistance: 100,
        lodDistances: [15, 30, 60, 100],
        lodMultipliers: [1.0, 0.8, 0.5, 0.2],
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
        bladeCount: 500000,
        enableWind: true,
        enableClouds: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        enableFrustumCulling: true,
        enableLOD: true,
        cullingDistance: 80,
        lodDistances: [12, 25, 50, 80],
        lodMultipliers: [1.0, 0.7, 0.4, 0.15],
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
        bladeCount: 200000,
        enableWind: true,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        enableFrustumCulling: true,
        enableLOD: true,
        cullingDistance: 60,
        lodDistances: [10, 20, 40, 60],
        lodMultipliers: [1.0, 0.6, 0.3, 0.1],
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
        bladeCount: 50000,
        enableWind: false,
        enableClouds: false,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: false,
        enableWeightMap: false,
        enableFrustumCulling: true,
        enableLOD: true,
        cullingDistance: 40,
        lodDistances: [8, 15, 25, 40],
        lodMultipliers: [1.0, 0.5, 0.2, 0.05],
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

// 🚀 NOUVEAU : Fonction pour créer une weightmap optimisée avec vérification de chargement
const createOptimizedWeightMap = async (texture, intensity, threshold, smoothing) => {
    // Vérifier que la texture et son image sont disponibles
    if (!texture || !texture.image) {
        console.warn('⚠️ Texture ou image non disponible pour la weightmap');
        return null;
    }

    // Attendre que l'image soit complètement chargée
    const img = texture.image;
    if (!img.complete || !img.naturalWidth) {
        await new Promise((resolve, reject) => {
            if (img.complete && img.naturalWidth) {
                resolve();
                return;
            }

            const onLoad = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                resolve();
            };

            const onError = () => {
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
                reject(new Error('Erreur de chargement de l\'image'));
            };

            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
        });
    }

    // Créer une clé de cache sécurisée
    const imageSrc = img.src || img.currentSrc || `texture-${Date.now()}`;
    const cacheKey = `${imageSrc}-${intensity}-${threshold}-${smoothing}`;

    if (WEIGHTMAP_CACHE.has(cacheKey)) {
        return WEIGHTMAP_CACHE.get(cacheKey);
    }

    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

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
            height: targetSize,
            timestamp: Date.now()
        };

        WEIGHTMAP_CACHE.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error('❌ Erreur lors de la création de la weightmap:', error);
        return null;
    }
};

// 🚀 NOUVEAU : Fonction pour créer une géométrie de brin optimisée avec geometry pooling
const createOptimizedBladeGeometry = (complex = false) => {
    const cacheKey = `blade-geometry-${complex}`;

    if (GEOMETRY_CACHE.has(cacheKey)) {
        const cached = GEOMETRY_CACHE.get(cacheKey);
        return cached.geometry.clone();
    }

    const BLADE_WIDTH = 0.02; // Légèrement réduit
    const BLADE_HEIGHT = 0.3; // Légèrement réduit

    const geometry = new BufferGeometry();

    if (complex) {
        // Géométrie complexe optimisée (4 vertices au lieu de 5)
        const vertices = new Float32Array([
            -BLADE_WIDTH/2, 0, 0,           // Bottom left
            BLADE_WIDTH/2, 0, 0,            // Bottom right
            BLADE_WIDTH/3, BLADE_HEIGHT*0.6, 0,  // Mid point
            0, BLADE_HEIGHT, 0              // Top center
        ]);

        const indices = [
            0, 1, 2,  // Bottom triangle
            0, 2, 3   // Top triangle
        ];

        const colors = new Float32Array([
            0.1, 0.2, 0.1,  // Dark green (bottom)
            0.1, 0.2, 0.1,  // Dark green (bottom)
            0.4, 0.6, 0.4,  // Mid green
            0.7, 0.9, 0.7   // Light green (top)
        ]);

        geometry.setAttribute('position', new BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new BufferAttribute(colors, 3));
        geometry.setIndex(indices);
    } else {
        // Géométrie simple ultra-optimisée
        const vertices = new Float32Array([
            -BLADE_WIDTH/2, 0, 0,     // Bottom left
            BLADE_WIDTH/2, 0, 0,      // Bottom right
            0, BLADE_HEIGHT, 0        // Top center
        ]);

        const indices = [0, 1, 2];

        const colors = new Float32Array([
            0.1, 0.2, 0.1,  // Dark green
            0.1, 0.2, 0.1,  // Dark green
            0.7, 0.9, 0.7   // Light green
        ]);

        geometry.setAttribute('position', new BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new BufferAttribute(colors, 3));
        geometry.setIndex(indices);
    }

    // UV mapping optimisé
    const uvCount = geometry.attributes.position.count;
    const uvs = new Float32Array(uvCount * 2);
    for (let i = 0; i < uvCount; i++) {
        uvs[i * 2] = i / (uvCount - 1);     // U gradient
        uvs[i * 2 + 1] = i % 2;             // V alternance
    }
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));

    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const cached = {
        geometry,
        timestamp: Date.now()
    };
    GEOMETRY_CACHE.set(cacheKey, cached);

    return geometry.clone();
};

// 🚀 NOUVEAU : Classe pour la gestion du LOD et culling basé sur la position de la caméra
class GrassCullingManager {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.frustum = new Frustum();
        this.cameraMatrix = new ThreeMatrix4();
        this.instances = [];
        this.instancePositions = []; // Cache des positions pour éviter les recalculs
        this.visibleInstances = new Set();
        this.lastUpdate = 0;
        this.updateInterval = 50; // Update every 50ms pour plus de réactivité
        this.lodOpacities = null; // Référence vers les opacités LOD
        this.needsLODUpdate = false;
        this.batchSize = 100; // Nombre d'instances à traiter par frame
        this.currentBatchIndex = 0;
    }

    addInstance(matrix, index, distance) {
        const position = new Vector3().setFromMatrixPosition(matrix);
        this.instances.push({ matrix, index, distance });
        this.instancePositions.push(position);
    }

    setLODOpacityBuffer(lodOpacities) {
        this.lodOpacities = lodOpacities;
    }

    updateVisibility(config) {
        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) return;

        this.cameraMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);

        this.visibleInstances.clear();
        const cameraPos = this.camera.position;
        const maxDistance = config.cullingDistance;

        // Mise à jour par batch pour éviter les pics de performance
        const startIndex = this.currentBatchIndex;
        const endIndex = Math.min(startIndex + this.batchSize, this.instances.length);

        for (let i = startIndex; i < endIndex; i++) {
            const instance = this.instances[i];
            const position = this.instancePositions[i];
            const distance = cameraPos.distanceTo(position);

            // Distance culling
            if (distance > maxDistance) {
                if (this.lodOpacities && config.enableLOD) {
                    this.lodOpacities.setX(i, 0.0);
                }
                continue;
            }

            // Frustum culling
            if (config.enableFrustumCulling) {
                const sphere = new Sphere(position, 0.2);
                if (!this.frustum.intersectsSphere(sphere)) {
                    if (this.lodOpacities && config.enableLOD) {
                        this.lodOpacities.setX(i, 0.0);
                    }
                    continue;
                }
            }

            // LOD basé sur la distance en temps réel
            let opacity = 1.0;
            if (config.enableLOD) {
                opacity = this.calculateLODOpacity(distance, config);
                if (this.lodOpacities) {
                    this.lodOpacities.setX(i, opacity);
                    this.needsLODUpdate = true;
                }
            }

            if (opacity > 0.01) {
                this.visibleInstances.add(instance.index);
            }
        }

        // Passer au batch suivant
        this.currentBatchIndex = endIndex;
        if (this.currentBatchIndex >= this.instances.length) {
            this.currentBatchIndex = 0;
            this.lastUpdate = now;
        }
    }

    calculateLODOpacity(distance, config) {
        const { lodDistances, lodMultipliers } = config;

        // Interpolation douce entre les niveaux LOD
        for (let i = 0; i < lodDistances.length - 1; i++) {
            if (distance <= lodDistances[i]) {
                return lodMultipliers[i];
            } else if (distance <= lodDistances[i + 1]) {
                // Interpolation linéaire entre deux niveaux LOD
                const t = (distance - lodDistances[i]) / (lodDistances[i + 1] - lodDistances[i]);
                return lodMultipliers[i] * (1 - t) + lodMultipliers[i + 1] * t;
            }
        }

        // Au-delà de la distance maximale
        return lodMultipliers[lodMultipliers.length - 1];
    }

    updateLODAttributes() {
        if (this.needsLODUpdate && this.lodOpacities) {
            this.lodOpacities.needsUpdate = true;
            this.needsLODUpdate = false;
            return true;
        }
        return false;
    }

    getVisibleCount() {
        return this.visibleInstances.size;
    }

    isVisible(index) {
        return this.visibleInstances.has(index);
    }

    reset() {
        this.instances = [];
        this.instancePositions = [];
        this.visibleInstances.clear();
        this.lodOpacities = null;
        this.currentBatchIndex = 0;
    }
}

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
    const cullingManagerRef = useRef();
    const [isLoaded, setIsLoaded] = useState(false);
    const [visibleInstanceCount, setVisibleInstanceCount] = useState(0);

    const { camera, scene } = useThree();

    // Merge preset avec config custom
    const config = useMemo(() => ({
        ...QUALITY_PRESETS[quality],
        ...customConfig
    }), [quality, customConfig]);

    // 🚀 NOUVEAU : Initialiser le culling manager
    useEffect(() => {
        cullingManagerRef.current = new GrassCullingManager(camera, scene);
        return () => {
            if (cullingManagerRef.current) {
                cullingManagerRef.current.reset();
            }
        };
    }, [camera, scene]);

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

    // 🚀 NOUVEAU : Chargement des textures avec cache et vérification
    const loadTextureWithCache = useCallback((url) => {
        if (TEXTURE_CACHE.has(url)) {
            return TEXTURE_CACHE.get(url);
        }

        const loader = new TextureLoader();
        const texture = loader.load(
            url,
            // onLoad
            (texture) => {
                texture.wrapS = texture.wrapT = RepeatWrapping;
                console.log(`✅ Texture chargée: ${url}`);
            },
            // onProgress
            undefined,
            // onError
            (error) => {
                console.error(`❌ Erreur de chargement de texture: ${url}`, error);
            }
        );

        texture.wrapS = texture.wrapT = RepeatWrapping;
        TEXTURE_CACHE.set(url, texture);
        return texture;
    }, []);

    // Chargement des textures optimisé avec fallback
    const grassTextures = useMemo(() => {
        try {
            return [loadTextureWithCache('./textures/desktop/ground/grass.jpg')];
        } catch (error) {
            console.error('❌ Erreur lors du chargement des textures d\'herbe:', error);
            return [new TextureLoader().load('./textures/desktop/ground/grass.jpg')];
        }
    }, [loadTextureWithCache]);

    const cloudTexture = useMemo(() => {
        if (!config.enableClouds) return null;
        try {
            return loadTextureWithCache('./textures/desktop/ground/cloud.jpg');
        } catch (error) {
            console.error('❌ Erreur lors du chargement de la texture de nuages:', error);
            return null;
        }
    }, [config.enableClouds, loadTextureWithCache]);

    const weightMapTexture = useMemo(() => {
        if (!config.enableWeightMap) return null;
        try {
            return loadTextureWithCache(weightMapPath);
        } catch (error) {
            console.error('❌ Erreur lors du chargement de la weightmap:', error);
            return null;
        }
    }, [config.enableWeightMap, weightMapPath, loadTextureWithCache]);

    // Uniforms optimisés
    const timeUniform = useRef({ type: 'f', value: 0.0 });
    const progress = useRef({ type: 'f', value: 0.0 });
    const startTime = useRef(Date.now());
    const previousGrassTextureIndex = useRef(0);

    // 🚀 CONSERVÉ : Weightmap optimisée (non modifiée)
    const optimizedWeightMap = useRef(null);

    // 🚀 CONSERVÉ : Échantillonnage optimisé de la weightMap avec fallback sécurisé
    const sampleWeightMap = useCallback((u, v) => {
        if (!config.enableWeightMap || !optimizedWeightMap.current || !optimizedWeightMap.current.data) {
            return 1.0;
        }

        try {
            const { data, width, height } = optimizedWeightMap.current;
            const x = Math.floor(u * width) % width;
            const y = Math.floor((1 - v) * height) % height;
            const index = y * width + x;

            if (index >= 0 && index < data.length) {
                return data[index] / 255.0;
            }
            return 1.0;
        } catch (error) {
            console.warn('⚠️ Erreur lors de l\'échantillonnage de la weightmap:', error);
            return 1.0;
        }
    }, [config.enableWeightMap]);

    // 🚀 NOUVEAU : Création de la weightmap optimisée avec gestion d'erreur
    useEffect(() => {
        if (!config.enableWeightMap || !weightMapTexture) return;

        createOptimizedWeightMap(weightMapTexture, weightMapIntensity, weightMapThreshold, weightMapSmoothing)
            .then(result => {
                if (result) {
                    optimizedWeightMap.current = result;
                    console.log('✅ WeightMap optimisée chargée:', result.width, 'x', result.height);
                } else {
                    console.warn('⚠️ Impossible de créer la weightmap, utilisation de la distribution uniforme');
                    optimizedWeightMap.current = null;
                }
            })
            .catch(error => {
                console.error('❌ Erreur lors du chargement de la weightmap:', error);
                optimizedWeightMap.current = null;
            });
    }, [weightMapTexture, config.enableWeightMap, weightMapIntensity, weightMapThreshold, weightMapSmoothing]);

    // Chargement du modèle 3D
    const { nodes } = config.enableSurfacePlacement ?
        useGLTF('/models/Ground.glb') : { nodes: null };
    const targetMesh = nodes?.Retopo_Plane002;

    // 🚀 NOUVEAU : Shader material ultra-optimisé
    const grassMaterial = useMemo(() => {
        const vertexShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            varying float vOpacity;
            ${config.enableWind ? 'uniform float iTime;' : ''}
            
            // Instanced attributes
            attribute float windOffset;
            attribute float heightMultiplier;
            attribute vec2 bladeUV;
            attribute float lodOpacity;

            void main() {
                vUv = bladeUV;
                vColor = color;
                vOpacity = lodOpacity;
                
                ${config.enableClouds ? 'cloudUV = bladeUV * 2.0;' : ''}
                
                vec3 cpos = position;
                cpos.y *= heightMultiplier;
                
                vec4 instancePosition = instanceMatrix * vec4(cpos, 1.0);

                ${config.enableWind ? `
                    float waveSpeed = 0.002;
                    float waveSize = 8.0;
                    float tipDistance = 0.08;
                    float centerDistance = 0.02;

                    float wave = sin((iTime * waveSpeed) + windOffset);
                    
                    if (color.r > 0.6) {
                        instancePosition.x += wave * tipDistance;
                        instancePosition.z += cos((iTime * waveSpeed * 0.7) + windOffset) * tipDistance * 0.3;
                    } else if (color.r > 0.3) {
                        instancePosition.x += wave * centerDistance;
                    }
                ` : ''}

                ${config.enableClouds ? `
                    cloudUV.x += ${config.enableWind ? 'iTime * 0.00005' : '0.0'};
                    cloudUV.y += ${config.enableWind ? 'iTime * 0.00002' : '0.0'};
                ` : ''}

                gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
            }`;

        const fragmentShader = /* glsl */`
            varying vec2 vUv;
            ${config.enableClouds ? 'varying vec2 cloudUV;' : ''}
            varying vec3 vColor;
            varying float vOpacity;
            
            uniform sampler2D uGrassTextures[2];
            ${config.enableClouds ? 'uniform sampler2D uCloudTexture;' : ''}
            ${config.enableTextureTransitions ? 'uniform float uProgress;' : ''}
            
            uniform float uGrassHue;
            uniform float uGrassSaturation;
            uniform float uGrassBrightness;
            uniform float uColorVariation;

            // Optimized HSV conversion
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }

            void main() {
                // Early alpha test for LOD
                if (vOpacity < 0.01) discard;
                
                const float contrast = 0.06;
                const float brightness = 0.02;

                ${config.enableTextureTransitions ? `
                    vec3 tex1 = texture2D(uGrassTextures[0], vUv).rgb;
                    vec3 tex2 = texture2D(uGrassTextures[1], vUv).rgb;
                    vec3 finalTexture = mix(tex1, tex2, uProgress) * contrast + brightness;
                ` : `
                    vec3 finalTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast + brightness;
                `}

                ${config.enableClouds ? `
                    vec3 cloudColor = texture2D(uCloudTexture, cloudUV).rgb * contrast + brightness;
                    vec3 blendedColor = mix(finalTexture, cloudColor, 0.25);
                ` : `
                    vec3 blendedColor = finalTexture;
                `}

                // Optimized color calculation
                float hueVar = sin(vUv.x * 12.0 + vUv.y * 8.0) * uColorVariation * 0.08;
                float finalHue = uGrassHue + hueVar;
                
                float heightFactor = vColor.r;
                float satMult = 0.75 + heightFactor * 0.5;
                float brightMult = uGrassBrightness * (0.4 + heightFactor * 0.6);
                
                vec3 grassHSV = vec3(finalHue, uGrassSaturation * satMult, brightMult);
                vec3 grassRGB = hsv2rgb(grassHSV);
                
                vec3 finalColor = mix(blendedColor, blendedColor * grassRGB * 1.8, 0.85);
                
                // Simple saturation boost
                float lum = dot(finalColor, vec3(0.299, 0.587, 0.114));
                finalColor = mix(vec3(lum), finalColor, 1.3);
                
                gl_FragColor = vec4(finalColor, vOpacity);
            }`;

        const uniforms = {
            uGrassTextures: { value: grassTextures && grassTextures[0] ? [grassTextures[0], grassTextures[0]] : [] },
            uGrassHue: { value: grassHue },
            uGrassSaturation: { value: grassSaturation },
            uGrassBrightness: { value: grassBrightness },
            uColorVariation: { value: colorVariation },
            ...(config.enableWind && { iTime: timeUniform.current }),
            ...(config.enableClouds && cloudTexture && { uCloudTexture: { value: cloudTexture } }),
            ...(config.enableTextureTransitions && { uProgress: progress.current }),
        };

        return new ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
            vertexColors: true,
            side: DoubleSide,
            transparent: config.enableLOD,
            depthWrite: !config.enableLOD,
        });
    }, [cloudTexture, grassTextures, quality, config, grassHue, grassSaturation, grassBrightness, colorVariation]);

    // 🚀 NOUVEAU : Génération des instances avec cache et culling data
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
        const lodOpacities = [];

        // Générer les positions
        const positions = config.enableSurfacePlacement ?
            generateSurfacePositions() : generateFlatPositions();

        // Reset culling manager
        if (cullingManagerRef.current) {
            cullingManagerRef.current.reset();
        }

        positions.forEach(({ pos, uv, weight = 1.0 }, index) => {
            const matrix = new Matrix4();
            const heightMult = config.enableWeightMap ? 0.6 + (weight * 0.4) : 1.0;
            const heightVar = 0.9 + (Math.random() * 0.2);

            // Rotation optimisée
            const yaw = Math.random() * 6.28318; // 2*PI pré-calculé
            matrix.makeRotationY(yaw);
            matrix.setPosition(pos.x, pos.y, pos.z);

            matrices.push(matrix);
            windOffsets.push(Math.random() * 6.28318);
            heightMultipliers.push(heightMult * heightVar);
            bladeUVs.push(uv[0], uv[1]);

            // LOD opacity initial (sera mis à jour en temps réel)
            let opacity = 1.0;
            if (config.enableLOD && camera) {
                const distance = camera.position.distanceTo(pos);
                opacity = 1.0;
            }
            lodOpacities.push(opacity);

            // Ajouter au culling manager avec position précalculée
            if (cullingManagerRef.current) {
                const distance = camera ? camera.position.distanceTo(pos) : 0;
                cullingManagerRef.current.addInstance(matrix, index, distance);
            }
        });

        const result = {
            matrices,
            windOffsets: new Float32Array(windOffsets),
            heightMultipliers: new Float32Array(heightMultipliers),
            bladeUVs: new Float32Array(bladeUVs),
            lodOpacities: new Float32Array(lodOpacities),
            count: positions.length,
            timestamp: Date.now()
        };

        GEOMETRY_CACHE.set(cacheKey, result);
        return result;
    }, [config, quality, BLADE_COUNT, weightMapPath, camera]);

    // 🚀 CONSERVÉ : Génération des positions sur surface 3D (non modifié)
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

    // 🚀 CONSERVÉ : Génération des positions plates (non modifié)
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

    // 🚀 NOUVEAU : Création de l'InstancedMesh avec attributes optimisés et LOD temps réel
    useEffect(() => {
        if (!instancedMeshRef.current) return;

        const baseGeometry = createOptimizedBladeGeometry(config.enableComplexGeometry);
        const instances = generateInstances();

        instancedMeshRef.current.geometry = baseGeometry;
        instancedMeshRef.current.material = grassMaterial;
        instancedMeshRef.current.count = instances.count;

        // Appliquer les matrices d'instances
        instances.matrices.forEach((matrix, i) => {
            instancedMeshRef.current.setMatrixAt(i, matrix);
        });

        // Ajouter les attributs d'instance optimisés
        const geometry = instancedMeshRef.current.geometry;
        geometry.setAttribute('windOffset', new InstancedBufferAttribute(instances.windOffsets, 1));
        geometry.setAttribute('heightMultiplier', new InstancedBufferAttribute(instances.heightMultipliers, 1));
        geometry.setAttribute('bladeUV', new InstancedBufferAttribute(instances.bladeUVs, 2));

        // LOD opacity attribute - référence gardée pour les mises à jour temps réel
        const lodOpacityAttribute = new InstancedBufferAttribute(instances.lodOpacities, 1);
        geometry.setAttribute('lodOpacity', lodOpacityAttribute);

        // Connecter le buffer LOD au culling manager pour les mises à jour temps réel
        if (cullingManagerRef.current && config.enableLOD) {
            cullingManagerRef.current.setLODOpacityBuffer(lodOpacityAttribute);
        }

        instancedMeshRef.current.instanceMatrix.needsUpdate = true;
        instancedMeshRef.current.frustumCulled = !config.enableFrustumCulling; // Disable built-in culling if we use custom

        console.log('✅ InstancedMesh optimisé créé avec', instances.count, 'brins et LOD temps réel');
        setIsLoaded(true);
        if (onLoaded) onLoaded();
    }, [generateInstances, grassMaterial, config.enableComplexGeometry, config.enableFrustumCulling, config.enableLOD, onLoaded]);

    // 🚀 NOUVEAU : Animation avec culling et LOD updates en temps réel
    useFrame((state, delta) => {
        // Wind animation
        if (config.enableWind && config.animationQuality !== 'none') {
            const elapsedTime = (Date.now() - startTime.current) * 0.25;
            timeUniform.current.value = elapsedTime;
        }

        // Update culling et LOD basé sur la position de la caméra
        if (cullingManagerRef.current && (config.enableFrustumCulling || config.enableLOD)) {
            cullingManagerRef.current.updateVisibility(config);

            // Mettre à jour les attributs LOD si nécessaire
            if (config.enableLOD) {
                const updated = cullingManagerRef.current.updateLODAttributes();
                if (updated && instancedMeshRef.current?.geometry) {
                    // Force refresh du rendering
                    instancedMeshRef.current.geometry.attributes.lodOpacity.needsUpdate = true;
                }
            }

            const visibleCount = cullingManagerRef.current.getVisibleCount();
            if (visibleCount !== visibleInstanceCount) {
                setVisibleInstanceCount(visibleCount);
            }
        }
    });

    // Gestion des mises à jour de couleur optimisée
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

    // Transitions de textures optimisées avec vérification
    useEffect(() => {
        if (!grassTextures || !grassTextures[0] || !grassMaterial.uniforms.uGrassTextures) return;

        if (!config.enableTextureTransitions) {
            grassMaterial.uniforms.uGrassTextures.value = [grassTextures[grassTextureIndex] || grassTextures[0], grassTextures[grassTextureIndex] || grassTextures[0]];
            return;
        }

        const currentTexture = grassTextures[grassTextureIndex] || grassTextures[0];
        const previousTexture = grassTextures[previousGrassTextureIndex.current] || grassTextures[0];

        grassMaterial.uniforms.uGrassTextures.value = [previousTexture, currentTexture];

        gsap.to(progress.current, {
            value: 1,
            duration: 1.5,
            ease: "power2.inOut",
            onComplete: () => {
                previousGrassTextureIndex.current = grassTextureIndex;
                grassMaterial.uniforms.uGrassTextures.value = [currentTexture, currentTexture];
                progress.current.value = 0.0;
            }
        });
    }, [grassTextureIndex, grassMaterial, config.enableTextureTransitions, grassTextures]);

    // 🚀 NOUVEAU : Monitoring des performances avancé
    useAnimationFrame((state, delta) => {
        const stats = animationManager.getStats();

        if (stats.frameCount % 300 === 0 && window.location.search.includes('debug')) {
            const memInfo = performance.memory ? {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576),
                total: Math.round(performance.memory.totalJSHeapSize / 1048576)
            } : 'N/A';

            console.log(`🔍 GrassField Performance - ${quality}:`, {
                frameTime: `${stats.lastFrameTime.toFixed(2)}ms`,
                avgFrameTime: `${stats.averageFrameTime.toFixed(2)}ms`,
                instanceCount: instancedMeshRef.current?.count || 0,
                visibleInstances: visibleInstanceCount,
                culling: config.enableFrustumCulling || config.enableLOD,
                memory: memInfo,
                cacheSize: {
                    geometry: GEOMETRY_CACHE.size,
                    weightmap: WEIGHTMAP_CACHE.size,
                    texture: TEXTURE_CACHE.size
                }
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