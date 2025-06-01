// File: GrassField.jsx

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, ShaderMaterial, DoubleSide, Vector3, Color, BufferAttribute, BufferGeometry } from 'three';
import { useGLTF } from '@react-three/drei';
import { gsap } from 'gsap';

// Configuration des niveaux de qualité
const QUALITY_PRESETS = {
    ULTRA: {
        bladeCount: 5000,
        enableWind: true,
        enableClouds: true,
        enableColorVariation: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true, // Nouvelle feature
        bladeComplexity: 5, // 5 vertices par brin
        animationQuality: 'high'
    },
    HIGH: {
        bladeCount: 50000,
        enableWind: true,
        enableClouds: true,
        enableColorVariation: true,
        enableComplexGeometry: true,
        enableTextureTransitions: true,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 5,
        animationQuality: 'medium'
    },
    MEDIUM: {
        bladeCount: 25000,
        enableWind: true,
        enableClouds: false,
        enableColorVariation: true,
        enableComplexGeometry: false,
        enableTextureTransitions: false,
        enableSurfacePlacement: true,
        enableWeightMap: true,
        bladeComplexity: 3, // 3 vertices par brin
        animationQuality: 'low'
    },
    LOW: {
        bladeCount: 10000,
        enableWind: false,
        enableClouds: false,
        enableColorVariation: false,
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
                        quality = 'ULTRA', // ULTRA, HIGH, MEDIUM, LOW
                        customConfig = {}, // Pour override des settings spécifiques
                        weightMapPath = './textures/desktop/ground/grass_weightmap.png', // Chemin vers la weightMap
                        weightMapIntensity = 1.0, // Intensité de l'effet (0 = ignoré, 1 = plein effet)
                        weightMapThreshold = 0.1, // Seuil minimum pour placer de l'herbe (0-1)
                        weightMapSmoothing = 0.2 // Lissage pour éviter les transitions abruptes
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

    // Chargement conditionnel des textures
    const grassTextures = useLoader(TextureLoader, [
        './textures/desktop/ground/grass.jpg',
    ]);

    const cloudTexture = config.enableClouds ?
        useLoader(TextureLoader, './textures/desktop/ground/cloud.jpg') : null;

    // Chargement conditionnel de la weightMap
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

    // Feature: Échantillonnage de la weightMap
    const sampleWeightMap = useCallback((u, v) => {
        if (!config.enableWeightMap || !weightMapImageData.current) {
            return 1.0; // Pas de weightMap = densité maximale partout
        }

        // Convertir UV (0-1) en coordonnées pixel
        const { width, height, data } = weightMapImageData.current;
        const x = Math.floor(u * width) % width;
        const y = Math.floor((1 - v) * height) % height; // Inverser Y pour correspondre à UV

        // Obtenir la valeur du pixel (rouge car image B&W)
        const pixelIndex = (y * width + x) * 4;
        const grayscaleValue = data[pixelIndex] / 255.0; // Normaliser 0-1

        // INVERSER : Noir (0) = herbe maximale, Blanc (1) = pas d'herbe
        const invertedValue = 1.0 - grayscaleValue;

        // Appliquer le lissage et le seuil
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
        console.log('🖼️ Changement de texture d\'herbe :', previousGrassTextureIndex.current, '→', grassTextureIndex);
        return [grassTextures[previousGrassTextureIndex.current], grassTextures[grassTextureIndex]];
    };

    // Chargement conditionnel du modèle 3D
    const { nodes } = config.enableSurfacePlacement ?
        useGLTF('/models/Ground.glb') : { nodes: null };
    const targetMesh = nodes?.Retopo_Plane002;

    useEffect(() => {
        if (config.enableSurfacePlacement && !targetMesh) {
            console.warn('⚠️ Mesh cible "Retopo_Plane002" non trouvé dans le modèle GLTF.');
        } else if (config.enableSurfacePlacement) {
            console.log('✅ Mesh cible trouvé :', targetMesh.name || 'Ground');
        }
    }, [targetMesh, config.enableSurfacePlacement]);

    // Feature: Génération de brin simple (LOW/MEDIUM quality)
    const generateSimpleBlade = useCallback((center, vArrOffset, uv) => {
        const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;
        const yaw = Math.random() * Math.PI * 2;
        const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));

        const bl = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(BLADE_WIDTH / 2));
        const br = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(-BLADE_WIDTH / 2));
        const tc = new Vector3().copy(center).setY(center.y + height);

        const baseColor = config.enableColorVariation ?
            new Color(0.1, 0.3, 0.1) : new Color(0.2, 0.4, 0.2);
        const tipColor = config.enableColorVariation ?
            new Color(0.15, 0.4, 0.15) : new Color(0.2, 0.4, 0.2);

        const verts = [
            { pos: bl.toArray(), uvArray: uv, color: baseColor.toArray() },
            { pos: br.toArray(), uvArray: uv, color: baseColor.toArray() },
            { pos: tc.toArray(), uvArray: uv, color: tipColor.toArray() },
        ];

        const indices = [vArrOffset, vArrOffset + 1, vArrOffset + 2];

        return { verts, indices };
    }, [config.enableColorVariation]);

    // Feature: Génération de brin complexe (HIGH/ULTRA quality)
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

        const colors = config.enableColorVariation ? {
            darkGreen: new Color(0.005, 0.015, 0.005),
            mediumGreen: new Color(0.1, 0.3, 0.1),
            lightGreen: new Color(0.15, 0.4, 0.15)
        } : {
            darkGreen: new Color(0.1, 0.2, 0.1),
            mediumGreen: new Color(0.1, 0.2, 0.1),
            lightGreen: new Color(0.1, 0.2, 0.1)
        };

        const verts = [
            { pos: bl.toArray(), uvArray: uv, color: colors.darkGreen.toArray() },
            { pos: br.toArray(), uvArray: uv, color: colors.darkGreen.toArray() },
            { pos: tr.toArray(), uvArray: uv, color: colors.mediumGreen.toArray() },
            { pos: tl.toArray(), uvArray: uv, color: colors.mediumGreen.toArray() },
            { pos: tc.toArray(), uvArray: uv, color: colors.lightGreen.toArray() },
        ];

        const indices = [
            vArrOffset, vArrOffset + 1, vArrOffset + 2,
            vArrOffset + 2, vArrOffset + 4, vArrOffset + 3,
            vArrOffset + 3, vArrOffset, vArrOffset + 2
        ];

        return { verts, indices };
    }, [config.enableColorVariation, BLADE_HEIGHT, BLADE_HEIGHT_VARIATION, BLADE_WIDTH]);

    // Sélection de la fonction de génération selon la qualité
    const generateBlade = config.enableComplexGeometry ? generateComplexBlade : generateSimpleBlade;

    // Feature: Shader material avec options conditionnelles
    const grassMaterial = useMemo(() => {
        console.log('🧪 ShaderMaterial pour l\'herbe initialisé avec qualité:', quality);

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
          float tipDistance = 0.15;
          float centerDistance = 0.05;

          if (color.x > 0.6) {
            cpos.x += sin((iTime / 1000.0) + (uv.x * waveSize)) * tipDistance;
          } else if (color.x > 0.0) {
            cpos.x += sin((iTime / 1000.0) + (uv.x * waveSize)) * centerDistance;
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

      void main() {
        float contrast = 1.2;
        float brightness = -0.1;

        ${config.enableTextureTransitions ? `
          vec3 startTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast + vec3(brightness);
          vec3 endTexture = texture2D(uGrassTextures[1], vUv).rgb * contrast + vec3(brightness);
          vec3 finalTexture = mix(startTexture, endTexture, uProgress);
        ` : `
          vec3 finalTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast + vec3(brightness);
        `}

        vec3 blendedColor = finalTexture;

        ${config.enableClouds ? `
          vec3 cloudColor = texture2D(uCloudTexture, cloudUV).rgb * contrast + vec3(brightness);
          blendedColor = mix(finalTexture, cloudColor, 0.15);
        ` : ''}

        ${config.enableColorVariation ? `
          vec3 greenTint = vec3(0.05, 0.4, 0.1);
          blendedColor = mix(blendedColor, blendedColor * greenTint, 0.7);
          blendedColor.g = min(blendedColor.g * 1.1, 1.0);

          vec3 grassColor = vColor * 1.5;
          blendedColor = mix(blendedColor, blendedColor * grassColor, 0.5);
        ` : ''}

        blendedColor *= 0.8;
        gl_FragColor = vec4(blendedColor, 1.0);
      }`;

        const uniforms = {
            uGrassTextures: { value: [grassTextures[0], grassTextures[1]] },
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
    }, [cloudTexture, grassTextures, quality, config]);

    // Feature: Placement sur surface 3D vs placement plat
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

        // Générer plus de candidats que nécessaire pour compenser la weightMap
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

            // Vérifier la weightMap avant de placer le brin
            const weightValue = sampleWeightMap(uv[0], uv[1]);
            const shouldPlace = Math.random() < weightValue;

            if (shouldPlace) {
                positions.push({ pos, uv, weight: weightValue });
                placedCount++;
            }
        }

        console.log(`🗺️ WeightMap: ${placedCount}/${BLADE_COUNT} brins placés`);
        return positions;
    }, [targetMesh, BLADE_COUNT, config.enableWeightMap, sampleWeightMap]);

    const generateFlatPlacement = useCallback(() => {
        const positions = [];
        const fieldSize = 50;

        // Générer plus de candidats si weightMap activée
        const candidateCount = config.enableWeightMap ? BLADE_COUNT * 3 : BLADE_COUNT;
        let placedCount = 0;

        for (let i = 0; i < candidateCount && placedCount < BLADE_COUNT; i++) {
            const x = (Math.random() - 0.5) * fieldSize;
            const z = (Math.random() - 0.5) * fieldSize;
            const pos = new Vector3(x, 0, z);
            const uv = [(x + fieldSize/2) / fieldSize, (z + fieldSize/2) / fieldSize];

            // Vérifier la weightMap
            const weightValue = sampleWeightMap(uv[0], uv[1]);
            const shouldPlace = Math.random() < weightValue;

            if (shouldPlace) {
                positions.push({ pos, uv, weight: weightValue });
                placedCount++;
            }
        }

        if (config.enableWeightMap) {
            console.log(`🗺️ WeightMap: ${placedCount}/${BLADE_COUNT} brins placés (flat)`);
        }
        return positions;
    }, [BLADE_COUNT, config.enableWeightMap, sampleWeightMap]);

    const generateField = useCallback(() => {
        console.log('🌱 Génération de', BLADE_COUNT, 'brins avec qualité', quality);

        const positions = [], uvs = [], indices = [], colors = [];

        // Choix de la méthode de placement
        const bladePositions = config.enableSurfacePlacement ?
            generateSurfacePlacement() : generateFlatPlacement();

        if (bladePositions.length === 0) return;

        bladePositions.forEach(({ pos, uv, weight = 1.0 }, i) => {
            const vArrOffset = i * config.bladeComplexity;

            // Variation de la hauteur basée sur la weightMap
            const originalHeight = BLADE_HEIGHT;
            if (config.enableWeightMap && weight !== undefined) {
                // Les zones avec moins de poids ont des brins plus courts
                const heightMultiplier = 0.5 + (weight * 0.5); // Entre 0.5 et 1.0
                pos.y = pos.y; // Garder la position Y originale mais on modifiera la hauteur dans generateBlade

                // Passer le multiplicateur de hauteur comme paramètre supplémentaire
                const blade = generateBlade(pos, vArrOffset, uv, heightMultiplier);

                blade.verts.forEach(v => {
                    positions.push(...v.pos);
                    uvs.push(...v.uvArray);
                    colors.push(...v.color);
                });
                indices.push(...blade.indices);
            } else {
                const blade = generateBlade(pos, vArrOffset, uv);

                blade.verts.forEach(v => {
                    positions.push(...v.pos);
                    uvs.push(...v.uvArray);
                    colors.push(...v.color);
                });
                indices.push(...blade.indices);
            }
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
    }, [generateBlade, grassMaterial, config, quality, generateSurfacePlacement, generateFlatPlacement, BLADE_HEIGHT]);

    useEffect(() => {
        generateField();
        if (onLoaded) onLoaded();
    }, [generateField, onLoaded]);

    // Feature: Transitions de textures conditionnelles
    useEffect(() => {
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
    }, [grassTextureIndex, getGrassTexture, grassMaterial, config.enableTextureTransitions]);

    // Feature: Animation conditionnelle
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

// Préchargement conditionnel
// useGLTF.preload('/models/Ground.glb');

export default GrassField;