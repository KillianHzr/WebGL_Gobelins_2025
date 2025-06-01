// File: YourComponentPath/GrassField.js

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, RepeatWrapping, ShaderMaterial, DoubleSide, Vector3, Color, BufferAttribute, BufferGeometry } from 'three';
import { useGLTF } from '@react-three/drei';
import { gsap } from 'gsap';

const GrassField = ({ grassTextureIndex = 0, onLoaded }) => {
  const meshRef = useRef();
  const BLADE_COUNT = 100000;
  const BLADE_WIDTH = 0.1;
  const BLADE_HEIGHT = 0.2;
  const BLADE_HEIGHT_VARIATION = 0.05;

  const grassTextures = useLoader(TextureLoader, [
    './textures/desktop/ground/grass.jpg',
    './textures/desktop/ground/grass_night.jpg',
    './textures/desktop/ground/grass_kawai.jpg',
    './textures/desktop/ground/grass_goddess.jpg',
  ]);
  const cloudTexture = useLoader(TextureLoader, './textures/desktop/ground/cloud.jpg');
  useMemo(() => {
    cloudTexture.wrapS = cloudTexture.wrapT = RepeatWrapping;
  }, [cloudTexture]);

  const timeUniform = useRef({ type: 'f', value: 0.0 });
  const progress = useRef({ type: 'f', value: 0.0 });
  const startTime = useRef(Date.now());
  const previousGrassTextureIndex = useRef(0);


  const getGrassTexture = () => {
    console.log('🖼️ Changement de texture d\'herbe :', previousGrassTextureIndex.current, '→', grassTextureIndex);
    return [grassTextures[previousGrassTextureIndex.current], grassTextures[grassTextureIndex]];
  };
  const { nodes } = useGLTF('/models/Ground.glb'); // <-- Remplace par ton vrai chemin
  const targetMesh = nodes?.Retopo_Plane002; // <-- Remplace 'Ground' par le nom exact de ton mesh
  useEffect(() => {
    if (!targetMesh) {
      console.warn('⚠️ Mesh cible "Retopo_Plane002" non trouvé dans le modèle GLTF.');
    } else {
      console.log('✅ Mesh cible trouvé :', targetMesh.name || 'Ground');
    }
  }, [targetMesh]);
  const generateBlade = useCallback((center, vArrOffset, uv) => {
    const MID_WIDTH = BLADE_WIDTH * 0.5;
    const TIP_OFFSET = 0.1;
    const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;

    const yaw = Math.random() * Math.PI * 2;
    const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const tipBend = Math.random() * Math.PI * 2;
    const tipBendUnitVec = new Vector3(Math.sin(tipBend), 0, -Math.cos(tipBend));

    const bl = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(BLADE_WIDTH / 2));
    const br = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(-BLADE_WIDTH / 2));
    const tl = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(MID_WIDTH / 2)).setY(center.y + height / 2);
    const tr = new Vector3().addVectors(center, yawUnitVec.clone().multiplyScalar(-MID_WIDTH / 2)).setY(center.y + height / 2);
    const tc = new Vector3().addVectors(center, tipBendUnitVec.clone().multiplyScalar(TIP_OFFSET)).setY(center.y + height);

    const darkGreen = new Color(0.005, 0.015, 0.005);
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
      vArrOffset, vArrOffset + 1, vArrOffset + 2,
      vArrOffset + 2, vArrOffset + 4, vArrOffset + 3,
      vArrOffset + 3, vArrOffset, vArrOffset + 2
    ];

    return { verts, indices };
  }, []);

  const grassMaterial = useMemo(() => {
    console.log('🧪 ShaderMaterial pour l\'herbe initialisé');
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

        gl_Position = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      varying vec2 cloudUV;
      varying vec3 vColor;
      uniform sampler2D uGrassTextures[2];
      uniform sampler2D uCloudTexture;
      uniform float uProgress;

      void main() {
        float contrast = 1.2;
        float brightness = -0.1;

        vec3 startTexture = texture2D(uGrassTextures[0], vUv).rgb * contrast + vec3(brightness);
        vec3 endTexture = texture2D(uGrassTextures[1], vUv).rgb * contrast + vec3(brightness);
        vec3 finalTexture = mix(startTexture, endTexture, uProgress);

        vec3 cloudColor = texture2D(uCloudTexture, cloudUV).rgb * contrast + vec3(brightness);
        vec3 blendedColor = mix(finalTexture, cloudColor, 0.15);

        vec3 greenTint = vec3(0.05, 0.4, 0.1);
        blendedColor = mix(blendedColor, blendedColor * greenTint, 0.7);
        blendedColor.g = min(blendedColor.g * 1.1, 1.0);

        vec3 grassColor = vColor * 1.5;
        blendedColor = mix(blendedColor, blendedColor * grassColor, 0.5);
        blendedColor *= 0.8;

        gl_FragColor = vec4(blendedColor, 1.0);
      }`,
    vertexColors: true,
    side: DoubleSide,
    });
  }, [cloudTexture, grassTextures]);

  const generateField = useCallback(() => {
    if (!targetMesh?.geometry) {
      console.error('❌ Aucune géométrie trouvée sur le mesh cible.');
      return;
    }

    console.log('🌱 Génération de', BLADE_COUNT, 'brins sur la surface du modèle');

    const positions = [], uvs = [], indices = [], colors = [];
    const geom = targetMesh.geometry.clone();
    geom.computeBoundingBox();
    geom.computeVertexNormals();

    const positionAttr = geom.attributes.position;
    const surfaceMin = geom.boundingBox.min;
    const surfaceMax = geom.boundingBox.max;

    for (let i = 0; i < BLADE_COUNT; i++) {
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

      const blade = generateBlade(pos, i * 5, uv);
      blade.verts.forEach(v => {
        positions.push(...v.pos);
        uvs.push(...v.uvArray);
        colors.push(...v.color);
      });
      indices.push(...blade.indices);
    }

    const grassGeometry = new BufferGeometry();
    grassGeometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    grassGeometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    grassGeometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    grassGeometry.setIndex(indices);
    grassGeometry.computeVertexNormals();

    if (meshRef.current) {
      meshRef.current.geometry = grassGeometry;
      meshRef.current.material = grassMaterial;
      console.log('✅ Champ d\'herbe appliqué au mesh personnalisé');
    }
  }, [targetMesh, grassMaterial, generateBlade]);

  useEffect(() => {
    generateField();
    if (onLoaded) onLoaded();
  }, [generateField, onLoaded]);

  useEffect(() => {
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
  }, [grassTextureIndex, getGrassTexture, grassMaterial]);

  useFrame(() => {
    const elapsedTime = (Date.now() - startTime.current) * 0.6;
    timeUniform.current.value = elapsedTime;
  });

  return (
      <mesh ref={meshRef} position={[0, 15.15, 0]}>
        <bufferGeometry />
      </mesh>
  );
};

const convertRange = (val, oldMin, oldMax, newMin, newMax) =>
    ((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin;

useGLTF.preload('/models/Ground.glb'); // Préchargement

export default GrassField;
