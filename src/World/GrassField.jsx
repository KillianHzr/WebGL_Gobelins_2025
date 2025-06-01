// File: YourComponentPath/GrassField.js

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, ShaderMaterial, DoubleSide, Vector3, Color, BufferAttribute, BufferGeometry } from 'three';
import { gsap } from 'gsap'

const GrassField = ({ grassTextureIndex = 0, onLoaded }) => {
  const meshRef = useRef();

  const PLANE_SIZE = 20;
  const BLADE_COUNT = 20000;
  const BLADE_WIDTH = 0.1;
  const BLADE_HEIGHT = 0.2;
  const BLADE_HEIGHT_VARIATION = 0.1;

  const grassTextures = useLoader(TextureLoader, [
    './textures/desktop/ground/grass.jpg',
    './textures/desktop/ground/grass_night.jpg',
    './textures/desktop/ground/grass_kawai.jpg',
    './textures/desktop/ground/grass_goddess.jpg',
  ]);

  const cloudTexture = useLoader(TextureLoader, './textures/desktop/ground/cloud.jpg');

  // Set texture wrapping mode
  useMemo(() => {
    cloudTexture.wrapS = cloudTexture.wrapT = RepeatWrapping;
  }, [cloudTexture]);

  const timeUniform = useRef({ type: 'f', value: 0.0 });
  const progress = useRef({ type: 'f', value: 0.0 });
  const startTime = useRef(Date.now());

  const previousGrassTextureIndex = useRef(0)

  const getGrassTexture = () => {
    return [grassTextures[previousGrassTextureIndex.current], grassTextures[grassTextureIndex]]
  };

  const generateBlade = useCallback((center, vArrOffset, uv) => {
    const MID_WIDTH = BLADE_WIDTH * 0.5;
    const TIP_OFFSET = 0.1;
    const height = BLADE_HEIGHT + (Math.random() * BLADE_HEIGHT_VARIATION);

    const yaw = Math.random() * Math.PI * 2;
    const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const tipBend = Math.random() * Math.PI * 2;
    const tipBendUnitVec = new Vector3(Math.sin(tipBend), 0, -Math.cos(tipBend));

    const bl = new Vector3().addVectors(center, new Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * 1));
    const br = new Vector3().addVectors(center, new Vector3().copy(yawUnitVec).multiplyScalar((BLADE_WIDTH / 2) * -1));
    const tl = new Vector3().addVectors(center, new Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * 1));
    const tr = new Vector3().addVectors(center, new Vector3().copy(yawUnitVec).multiplyScalar((MID_WIDTH / 2) * -1));
    const tc = new Vector3().addVectors(center, new Vector3().copy(tipBendUnitVec).multiplyScalar(TIP_OFFSET));

    tl.y += height / 2;
    tr.y += height / 2;
    tc.y += height;

    // Couleurs vertes plus sombres pour les brins d'herbe
    const darkGreen = new Color(0.05, 0.15, 0.05);
    const mediumGreen = new Color(0.1, 0.3, 0.1);
    const lightGreen = new Color(0.15, 0.4, 0.15);

    const verts = [
      { pos: bl.toArray(), uvArray: uv, color: darkGreen.toArray() },
      { pos: br.toArray(), uvArray: uv, color: darkGreen.toArray() },
      { pos: tr.toArray(), uvArray: uv, color: mediumGreen.toArray() },
      { pos: tl.toArray(), uvArray: uv, color: mediumGreen.toArray() },
      { pos: tc.toArray(), uvArray: uv, color: lightGreen.toArray() },
    ];

    const indices = [
      vArrOffset,
      vArrOffset + 1,
      vArrOffset + 2,
      vArrOffset + 2,
      vArrOffset + 4,
      vArrOffset + 3,
      vArrOffset + 3,
      vArrOffset,
      vArrOffset + 2
    ];

    return { verts, indices };
  }, [BLADE_WIDTH, BLADE_HEIGHT, BLADE_HEIGHT_VARIATION]);

  const grassMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uCloudTexture: { value: cloudTexture },
        uGrassTextures: { value: [grassTextures[0], grassTextures[1]] },
        iTime: timeUniform.current,
        uProgress: progress.current,
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying vec2 cloudUV;
        varying vec3 vColor;
        uniform float iTime;
        
        void main() {
            vUv = uv;
            cloudUV = uv;
            vColor = color;
            vec3 cpos = position;
    
            // Apply simple wave effect only (no cursor interaction)
            float waveSize = 10.0;
            float tipDistance = 0.15;
            float centerDistance = 0.05;
    
            if (color.x > 0.6) {
                cpos.x += sin((iTime / 1000.0) + (uv.x * waveSize)) * tipDistance;
            } else if (color.x > 0.0) {
                cpos.x += sin((iTime / 1000.0) + (uv.x * waveSize)) * centerDistance;
            }
    
            cloudUV.x += iTime / 20000.0;
            cloudUV.y += iTime / 10000.0;
    
            vec4 worldPosition = vec4(cpos, 1.0);
            vec4 mvPosition = modelViewMatrix * worldPosition;
            gl_Position = projectionMatrix * mvPosition;
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv;
        varying vec2 cloudUV;
        varying vec3 vColor;

        uniform sampler2D uGrassTextures[2];
        uniform sampler2D uCloudTexture;
        uniform float uProgress;
    
        void main() {
          // Contraste modéré et luminosité réduite pour un vert plus sombre
          float contrast = 1.2;
          float brightness = -0.1;
    
          vec3 startTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast;
          startTexture = startTexture + vec3(brightness);
          
          vec3 endTexture = texture2D(uGrassTextures[1], vUv).rgb * contrast;
          endTexture = endTexture + vec3(brightness);
    
          vec3 finalTexture = mix(startTexture, endTexture, uProgress);
    
          vec3 cloudColor = texture2D(uCloudTexture, cloudUV).rgb * contrast;
          cloudColor = cloudColor + vec3(brightness);
    
          vec3 blendedColor = mix(finalTexture, cloudColor, 0.15);
          
          // Teinte verte plus sombre et plus naturelle
          vec3 greenTint = vec3(0.05, 0.4, 0.1);
          blendedColor = mix(blendedColor, blendedColor * greenTint, 0.7);
          
          // Saturation du vert plus modérée
          blendedColor.g = min(blendedColor.g * 1.1, 1.0);
          
          // Utilisation des couleurs vertex sombres
          vec3 grassColor = vColor * 1.5;
          blendedColor = mix(blendedColor, blendedColor * grassColor, 0.5);
          
          // Assombrissement général
          blendedColor = blendedColor * 0.8;
          
          gl_FragColor = vec4(blendedColor, 1.0);
        }
      `,
      vertexColors: true,
      side: DoubleSide,
    });
  }, [cloudTexture, grassTextures]);

  const generateField = useCallback(() => {
    console.log('🌱 Génération du champ d\'herbe sur plane simple...');

    const positions = [];
    const uvs = [];
    const indices = [];
    const colors = [];

    for (let i = 0; i < BLADE_COUNT; i++) {
      const VERTEX_COUNT = 5;
      const surfaceMin = PLANE_SIZE / 2 * -1;
      const surfaceMax = PLANE_SIZE / 2;
      const radius = PLANE_SIZE / 2;

      const r = radius * Math.sqrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      // Position fixe sur le plane y=0 (pas de raycasting)
      const z = 0;

      const pos = new Vector3(x, z, y);
      const uv = [convertRange(pos.x, surfaceMin, surfaceMax, 0, 1), convertRange(pos.z, surfaceMin, surfaceMax, 0, 1)];

      const blade = generateBlade(pos, i * VERTEX_COUNT, uv);
      blade.verts.forEach(vert => {
        positions.push(...vert.pos);
        uvs.push(...vert.uvArray);
        colors.push(...vert.color);
      });
      blade.indices.forEach(indice => indices.push(indice));
    }

    const geom = new BufferGeometry();
    geom.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geom.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    if (meshRef.current) {
      meshRef.current.geometry = geom;
      meshRef.current.material = grassMaterial;
      console.log('✅ Champ d\'herbe généré avec succès sur plane simple');
    }
  }, [grassMaterial, BLADE_COUNT, PLANE_SIZE, generateBlade]);

  useEffect(() => {
    console.log('🌱 Génération immédiate du champ d\'herbe...');
    generateField();
    if (onLoaded) onLoaded();
  }, [generateField, onLoaded]);

  useEffect(() => {
    grassMaterial.uniforms.uGrassTextures.value = getGrassTexture()
    gsap
        .to(progress.current, {
          value: 1,
          duration: 2,
          onComplete: () => {
            previousGrassTextureIndex.current = grassTextureIndex
            grassMaterial.uniforms.uGrassTextures.value = getGrassTexture()
            progress.current.value = 0.0
          }
        })
  }, [grassTextureIndex, grassMaterial, getGrassTexture])

  useFrame(() => {
    const elapsedTime = (Date.now() - startTime.current) * .6; // Convert to seconds
    timeUniform.current.value = elapsedTime;
  });

  return (
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <bufferGeometry />
      </mesh>
  );

};

const convertRange = (val, oldMin, oldMax, newMin, newMax) => {
  return (((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin)) + newMin;
};

export default GrassField;