// Modification du système d'initialisation
// pour utiliser une caméra par défaut si Camera.glb n'est pas disponible

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EventBus } from '../Utils/EventEmitter.jsx';
import useStore from '../Store/useStore';
import { CameraAnimatorGLB } from './CameraAnimatorGLB';

// Créateur d'animation pour caméra par défaut
function createDefaultCameraAnimation(camera) {
    // Créer une animation synthétique qui déplace la caméra le long d'un chemin
    const duration = 30; // 30 secondes d'animation
    const keyframes = 100; // Nombre de keyframes

    // Paramètres de chemin
    const path = {
        start: new THREE.Vector3(0, 1.6, 0),
        end: new THREE.Vector3(0, 1.6, -150),
        midPoints: [
            { position: new THREE.Vector3(-5, 2, -30), lookAt: new THREE.Vector3(0, 1.5, -35) },
            { position: new THREE.Vector3(5, 2, -60), lookAt: new THREE.Vector3(0, 1.5, -65) },
            { position: new THREE.Vector3(-8, 2, -90), lookAt: new THREE.Vector3(0, 1.5, -95) },
            { position: new THREE.Vector3(8, 2, -120), lookAt: new THREE.Vector3(0, 1.5, -125) }
        ]
    };

    // Créer des times pour l'animation (0 à duration)
    const times = new Float32Array(keyframes);
    for (let i = 0; i < keyframes; i++) {
        times[i] = duration * (i / (keyframes - 1));
    }

    // Calculer les positions pour chaque keyframe
    // Utiliser une courbe de Bézier pour un mouvement plus fluide
    const positions = new Float32Array(keyframes * 3);
    const rotations = new Float32Array(keyframes * 3);

    // Créer un objet caméra pour calculer les rotations
    const dummyCamera = new THREE.PerspectiveCamera();
    const lookAtVector = new THREE.Vector3();

    for (let i = 0; i < keyframes; i++) {
        const t = i / (keyframes - 1); // 0 à 1

        // Calculer la position interpolée
        // Mouvement sinusoïdal pour x, linéaire pour z
        let x = Math.sin(t * Math.PI * 2) * 5;
        let y = 1.6 + Math.sin(t * Math.PI) * 0.4;
        let z = path.start.z + (path.end.z - path.start.z) * t;

        // Appliquer des variations basées sur les midPoints
        path.midPoints.forEach((point, idx) => {
            const influence = Math.max(0, 1 - Math.abs((t - (idx + 1) / (path.midPoints.length + 1)) * (path.midPoints.length + 1) * 2));
            x += (point.position.x - x) * influence * 0.5;
            y += (point.position.y - y) * influence * 0.5;
        });

        // Stocker la position
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Calculer la rotation (regarder vers l'avant avec des variations)
        let lookAtX = 0;
        let lookAtY = 1.5;
        let lookAtZ = z - 5; // Regarder 5 unités devant

        // Appliquer des variations de lookAt basées sur les midPoints
        path.midPoints.forEach((point, idx) => {
            const influence = Math.max(0, 1 - Math.abs((t - (idx + 1) / (path.midPoints.length + 1)) * (path.midPoints.length + 1) * 2));
            lookAtX += (point.lookAt.x - lookAtX) * influence;
            lookAtY += (point.lookAt.y - lookAtY) * influence;
            lookAtZ += (point.lookAt.z - lookAtZ) * influence;
        });

        lookAtVector.set(lookAtX, lookAtY, lookAtZ);
        dummyCamera.position.set(x, y, z);
        dummyCamera.lookAt(lookAtVector);

        // Stocker la rotation
        rotations[i * 3] = dummyCamera.rotation.x;
        rotations[i * 3 + 1] = dummyCamera.rotation.y;
        rotations[i * 3 + 2] = dummyCamera.rotation.z;
    }

    // Créer les tracks d'animation
    const posXTrack = new THREE.KeyframeTrack('camera.position[x]', times, positions.filter((_, i) => i % 3 === 0));
    const posYTrack = new THREE.KeyframeTrack('camera.position[y]', times, positions.filter((_, i) => i % 3 === 1));
    const posZTrack = new THREE.KeyframeTrack('camera.position[z]', times, positions.filter((_, i) => i % 3 === 2));

    const rotXTrack = new THREE.KeyframeTrack('camera.rotation[x]', times, rotations.filter((_, i) => i % 3 === 0));
    const rotYTrack = new THREE.KeyframeTrack('camera.rotation[y]', times, rotations.filter((_, i) => i % 3 === 1));
    const rotZTrack = new THREE.KeyframeTrack('camera.rotation[z]', times, rotations.filter((_, i) => i % 3 === 2));

    // Créer le clip d'animation
    const clip = new THREE.AnimationClip('Action.006', duration, [
        posXTrack, posYTrack, posZTrack,
        rotXTrack, rotYTrack, rotZTrack
    ]);

    // Créer un objet similaire à ce qu'aurait retourné l'AssetManager pour un GLB
    const fakeCameraModel = new THREE.Object3D();
    fakeCameraModel.name = "FakeCamera";
    fakeCameraModel.add(camera.clone());

    const fakeGLBModel = {
        scene: fakeCameraModel,
        animations: [clip]
    };

    console.log('Animation de caméra synthétique créée', clip);

    return fakeGLBModel;
}

// Hook d'initialisation pour une caméra par défaut
export function useCameraInitializer() {
    const { camera } = useThree();
    const cameraAnimatorRef = useRef(null);
    const animationInitializedRef = useRef(false);

    // Fonction pour initialiser avec un modèle GLB donné ou créer un modèle par défaut
    const initializeCamera = (model) => {
        if (animationInitializedRef.current) return;

        try {
            // Créer l'animateur GLB
            cameraAnimatorRef.current = new CameraAnimatorGLB(model, camera, 'action.003');
            console.log('Animateur de caméra initialisé avec succès');

            // Mettre à jour le store
            useStore.getState().setCameraModel(model.scene);
            if (model.animations && model.animations.length > 0) {
                useStore.getState().setCameraAnimation(model.animations[0]);
                useStore.getState().setAvailableCameraAnimations(model.animations);
            }

            // Informer les autres composants
            EventBus.trigger('camera-animator-ready', {
                animator: cameraAnimatorRef.current
            });

            animationInitializedRef.current = true;
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la caméra:', error);
        }
    };

    useEffect(() => {
        if (!camera || animationInitializedRef.current) return;

        console.log('Initialisation de la caméra...');

        // Fonction pour essayer de charger le modèle depuis l'AssetManager
        const tryLoadCameraModel = () => {
            if (window.assetManager && typeof window.assetManager.getItem === 'function') {
                const cameraModel = window.assetManager.getItem('Camera');
                if (cameraModel && (cameraModel.scene || cameraModel.animations)) {
                    console.log('Modèle de caméra GLB chargé depuis AssetManager');
                    initializeCamera(cameraModel);
                    return true;
                }
            }
            return false;
        };

        // Essayer de charger depuis l'AssetManager
        const modelLoaded = tryLoadCameraModel();

        // Si pas de modèle, créer un modèle par défaut
        if (!modelLoaded) {
            console.log('Création d\'un modèle de caméra par défaut');
            const defaultModel = createDefaultCameraAnimation(camera);
            initializeCamera(defaultModel);

            // Écouter les événements de chargement au cas où le vrai modèle serait chargé plus tard
            const assetManagerReadyHandler = () => {
                // Essayer de nouveau après l'événement ready
                setTimeout(() => {
                    if (!animationInitializedRef.current) {
                        tryLoadCameraModel();
                    }
                }, 500);
            };

            const subscription = EventBus.on('ready', assetManagerReadyHandler);

            return () => {
                subscription();
            };
        }
    }, [camera]);

    return cameraAnimatorRef;
}

export default useCameraInitializer;