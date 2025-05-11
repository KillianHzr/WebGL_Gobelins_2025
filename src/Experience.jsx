import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import useStore from './Store/useStore'
import ScrollControls from './Core/ScrollControls'
import DebugInitializer from "./Utils/DebugInitializer.jsx";
import Debug from "./Utils/Debug.jsx";
import Camera from "./Core/Camera.jsx";
import CameraSwitcher from './Utils/CameraSwitcher.jsx';
import Controls from "./Core/Controls.jsx";
import Lights from "./Core/Lights.jsx";
import MaterialControls from "./Core/MaterialControls.jsx";
import PostProcessing from "./Core/PostProcessing.jsx";
import Stats from "./Utils/Stats.jsx";
import RayCaster from "./Utils/RayCaster.jsx";
import { EventBus, EventEmitterProvider } from './Utils/EventEmitter';
import ForestSceneWrapper from './World/ForestSceneWrapper';
import AudioManagerComponent from './Utils/AudioManager';
import InteractiveMarkersProvider from './Utils/MarkerSystem';
import MARKER_EVENTS from "./Utils/EventEmitter.jsx";
import SceneObjects from './World/SceneObjects';
import guiConfig from "./Config/guiConfig.js";
import Flashlight from "./World/Flashlight.jsx";
import SceneFog from "./Core/SceneFog.jsx";
import NarrationTriggers from './Utils/NarrationTriggers';
import * as THREE from 'three';

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Experience] ${message}`, ...args);
    }
};

export default function Experience() {
    const { loaded, debug, setCamera, setCameraInitialZoom } = useStore()
    const { scene, camera, gl } = useThree()
    const eventListenersRef = useRef([]);
    const isMountedRef = useRef(true);

    // Refs pour la gestion des FPS et l'optimisation
    const frameCountRef = useRef(0);
    const lastFrameTimeRef = useRef(performance.now());
    const fpsRef = useRef(60);
    const lowPerformanceModeRef = useRef(false);
    const initialSettingsRef = useRef(null);
    const [showFPS, setShowFPS] = useState(debug);

    // État pour suivre les performances
    const [performanceStats, setPerformanceStats] = useState({
        fps: 60,
        isLowPerformanceMode: false,
        pixelRatio: 0,
        lastOptimization: null
    });

    // Sauvegarder les paramètres initiaux au premier rendu
    useEffect(() => {
        if (!gl || initialSettingsRef.current) return;

        // Appliquer les paramètres de base
        const debugConfig = guiConfig.renderer;
        gl.shadowMap.enabled = debugConfig.shadowMap.enabled.default;
        gl.shadowMap.type = debugConfig.shadowMap.type.default;
        gl.toneMapping = debugConfig.toneMapping.default;
        gl.toneMappingExposure = debugConfig.toneMappingExposure.default;

        // Limiter la résolution pour de meilleures performances
        const devicePixelRatio = window.devicePixelRatio || 1;
        const optimalPixelRatio = Math.min(devicePixelRatio, 2);
        gl.setPixelRatio(optimalPixelRatio);

        // Sauvegarder les paramètres initiaux
        initialSettingsRef.current = {
            pixelRatio: optimalPixelRatio,
            shadowMapEnabled: gl.shadowMap.enabled,
            shadowMapType: gl.shadowMap.type,
            toneMapping: gl.toneMapping,
            toneMappingExposure: gl.toneMappingExposure
        };

        // Charger le mode performance sauvegardé
        try {
            const savedPerformanceMode = localStorage.getItem('lowPerformanceMode');
            if (savedPerformanceMode === 'true') {
                lowPerformanceModeRef.current = true;
                applyLowPerformanceSettings();
                debugLog('Mode basse performance chargé depuis localStorage');
            }
        } catch (e) {
            console.warn("Erreur lors du chargement des préférences de performance", e);
        }

        debugLog('Renderer initialized with settings:', initialSettingsRef.current);
    }, [gl]);

    // Fonction pour mesurer les performances
    useFrame((state, delta) => {
        if (!gl || !isMountedRef.current || !initialSettingsRef.current) return;

        // Incrémenter le compteur de frames
        frameCountRef.current++;

        // Mesurer les FPS à intervalles réguliers
        const now = performance.now();
        if (now - lastFrameTimeRef.current >= 1000) {
            const currentFPS = frameCountRef.current;
            fpsRef.current = currentFPS;
            frameCountRef.current = 0;
            lastFrameTimeRef.current = now;

            // Mettre à jour l'état des performances
            setPerformanceStats(prev => ({
                ...prev,
                fps: currentFPS,
                isLowPerformanceMode: lowPerformanceModeRef.current,
                pixelRatio: gl.getPixelRatio()
            }));

            // Afficher les FPS en mode debug
            if (debug && showFPS) {
                console.log(`FPS: ${currentFPS}, Mode: ${lowPerformanceModeRef.current ? 'Basse performance' : 'Standard'}, PixelRatio: ${gl.getPixelRatio()}`);
            }

            // Adapter dynamiquement en fonction des FPS mesurés
            if (currentFPS < 30 && !lowPerformanceModeRef.current) {
                lowPerformanceModeRef.current = true;
                applyLowPerformanceSettings();
                setPerformanceStats(prev => ({
                    ...prev,
                    isLowPerformanceMode: true,
                    lastOptimization: Date.now()
                }));
            }
            else if (currentFPS > 50 && lowPerformanceModeRef.current) {
                // Ne restaurer les paramètres que si les FPS sont stables pendant plus de 5 secondes
                const timeSinceLastOptimization = Date.now() - (performanceStats.lastOptimization || 0);
                if (timeSinceLastOptimization > 5000) {
                    lowPerformanceModeRef.current = false;
                    restoreHighPerformanceSettings();
                    setPerformanceStats(prev => ({
                        ...prev,
                        isLowPerformanceMode: false,
                        lastOptimization: Date.now()
                    }));
                }
            }
        }
    });

    // Fonction pour appliquer les paramètres de basse performance
    const applyLowPerformanceSettings = () => {
        if (!gl || !initialSettingsRef.current) return;

        debugLog('Application des paramètres basse performance');

        // 1. Réduire la résolution
        // gl.setPixelRatio(1);

        // 2. Réduire la qualité des ombres
        if (gl.shadowMap.enabled) {
            gl.userData = gl.userData || {};
            gl.userData.originalShadowMapType = gl.shadowMap.type;
            gl.shadowMap.type = THREE.PCFShadowMap; // Type d'ombre moins coûteux
        }


        // Sauvegarder la préférence
        try {
            localStorage.setItem('lowPerformanceMode', 'true');
        } catch (e) {
            console.warn("Impossible de sauvegarder les préférences de performance", e);
        }
    };

    // Fonction pour restaurer les paramètres de haute performance
    const restoreHighPerformanceSettings = () => {
        if (!gl || !initialSettingsRef.current) return;

        debugLog('Restauration des paramètres haute performance');

        // 1. Restaurer la résolution
        gl.setPixelRatio(initialSettingsRef.current.pixelRatio);

        // 2. Restaurer la qualité des ombres
        if (gl.shadowMap.enabled && gl.userData && gl.userData.originalShadowMapType) {
            gl.shadowMap.type = gl.userData.originalShadowMapType;
        }

        // 3. Restaurer les post-traitements
        const postProcessing = scene.getObjectByName('PostProcessing');
        if (postProcessing && postProcessing.userData &&
            postProcessing.userData.composer &&
            postProcessing.userData.originalPassesState) {

            const composer = postProcessing.userData.composer;

            // Restaurer l'état des passes
            postProcessing.userData.originalPassesState.forEach(originalPass => {
                const pass = composer.passes.find(p => p.name === originalPass.name);
                if (pass) {
                    pass.enabled = originalPass.enabled;
                }
            });

            // Restaurer les intensités de grain
            composer.passes.forEach(pass => {
                if (pass.uniforms && pass.uniforms.grainIntensity &&
                    pass.userData && pass.userData.originalGrainIntensity) {
                    pass.uniforms.grainIntensity.value = pass.userData.originalGrainIntensity;
                }
            });
        }

        // 4. Restaurer le brouillard
        if (scene.fog && scene.userData && scene.userData.originalFog) {
            scene.fog.near = scene.userData.originalFog.near;
            scene.fog.far = scene.userData.originalFog.far;
        }

        // 5. Restaurer la distance de vue de la caméra
        if (camera && camera.userData && camera.userData.originalFar) {
            camera.far = camera.userData.originalFar;
            camera.updateProjectionMatrix();
        }

        // Sauvegarder la préférence
        try {
            localStorage.setItem('lowPerformanceMode', 'false');
        } catch (e) {
            console.warn("Impossible de sauvegarder les préférences de performance", e);
        }
    };

    // Gestion des événements des marqueurs (optimisée)
    useEffect(() => {
        if (!isMountedRef.current) return;

        // Utiliser un objet pour stocker les gestionnaires
        const handlers = {
            markerClick: (data) => {
                debugLog('Marqueur cliqué:', data);
            },

            interactionRequired: (data) => {
                // Utiliser getState pour accéder au store sans créer de dépendance
                const store = useStore.getState();
                const interaction = store.interaction;

                if (interaction &&
                    typeof interaction.setWaitingForInteraction === 'function' &&
                    typeof interaction.setCurrentStep === 'function') {
                    interaction.setWaitingForInteraction(true);
                    interaction.setCurrentStep(data.id);
                }
            },

            markerHover: (data) => {
                debugLog('Marqueur survolé:', data);
            }
        };

        // Abonnements avec gestion d'erreur
        const subscriptions = [];
        try {
            subscriptions.push(
                EventBus.on(MARKER_EVENTS.MARKER_CLICK, handlers.markerClick),
                EventBus.on(MARKER_EVENTS.INTERACTION_REQUIRED, handlers.interactionRequired),
                EventBus.on(MARKER_EVENTS.MARKER_HOVER, handlers.markerHover)
            );

            // Stocker les références
            eventListenersRef.current = subscriptions;
        } catch (error) {
            console.error('Erreur lors de la configuration des gestionnaires d\'événements:', error);
        }

        // Nettoyage
        return () => {
            subscriptions.forEach(unsub => {
                try {
                    if (typeof unsub === 'function') unsub();
                } catch (err) {
                    console.warn('Erreur lors du nettoyage des abonnements:', err);
                }
            });
        };
    }, []);

    // Configuration de la caméra
    useEffect(() => {
        if (!camera) return;
        setCamera(camera);
        setCameraInitialZoom(camera.zoom);
    }, [camera, setCamera, setCameraInitialZoom]);

    // Gestion du montage/démontage
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Analyse de la scène (désactivée en production pour des raisons de performance)
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development' || !scene || !debug) return;

        console.log("🔍 Attente du chargement complet de la scène...");

        const analyzeTimer = setTimeout(() => {
            if (scene.children.length > 0) {
                console.log("🔍 Analyse de la scène en cours...");
                analyzeScene(scene);
            }
        }, 5000);

        return () => clearTimeout(analyzeTimer);
    }, [scene, loaded, debug]);

    // Optimiser le rendu de la scène forestière
    const forestScene = useMemo(() => <ForestSceneWrapper/>, []);

    return (
        <EventEmitterProvider>
            <DebugInitializer/>
            <AudioManagerComponent/>
            <NarrationTriggers/>
            <CameraSwitcher/>
            <SceneFog />

            {debug && <Stats />}
            {debug && <Debug />}

            <Camera/>
            <Controls/>
            <Lights/>
            <MaterialControls/>
            <PostProcessing/>

            <RayCaster>
                <InteractiveMarkersProvider>
                    <ScrollControls>
                        <SceneObjects/>
                        {forestScene}
                        <Flashlight/>
                    </ScrollControls>
                </InteractiveMarkersProvider>
            </RayCaster>

        </EventEmitterProvider>
    )
}

// Fonction d'analyse de scène (uniquement exécutée en développement)
function analyzeScene(scene) {
    if (!scene) return;

    console.log("=== ANALYSE DE LA SCÈNE THREE.JS ===");

    // Collections pour les statistiques
    const geometries = new Map();
    const materials = new Map();
    let objectCount = 0;

    // Parcourir la scène de manière efficace
    const stack = [scene];

    while (stack.length > 0) {
        const object = stack.pop();
        objectCount++;

        // Analyser les géométries
        if (object.geometry) {
            const geo = object.geometry;
            const geoId = geo.uuid;

            if (!geometries.has(geoId)) {
                // Extraire les informations de géométrie
                const vertexCount = geo.attributes?.position?.count || 'N/A';
                const faceCount = geo.index
                    ? geo.index.count / 3
                    : (geo.attributes?.position
                        ? geo.attributes.position.count / 3
                        : 'N/A');

                geometries.set(geoId, {
                    uuid: geoId,
                    name: object.name || geo.name || 'Sans nom',
                    type: geo.type || 'Type inconnu',
                    vertexCount,
                    faceCount,
                    objectName: object.name || 'Sans nom'
                });
            }
        }

        // Analyser les matériaux
        if (object.material) {
            const processMaterial = (mat) => {
                if (!mat) return;

                const matId = mat.uuid;
                if (!materials.has(matId)) {
                    materials.set(matId, {
                        uuid: matId,
                        name: mat.name || 'Sans nom',
                        type: mat.type || 'Type inconnu',
                        color: mat.color ? `#${mat.color.getHexString()}` : 'N/A',
                        transparent: mat.transparent || false,
                        opacity: mat.opacity !== undefined ? mat.opacity : 1,
                        wireframe: mat.wireframe || false,
                        objectName: object.name || 'Sans nom',
                        maps: {
                            diffuse: mat.map ? (mat.map.name || 'Texture sans nom') : null,
                            normal: mat.normalMap ? (mat.normalMap.name || 'Normal map sans nom') : null,
                            roughness: mat.roughnessMap ? (mat.roughnessMap.name || 'Roughness map sans nom') : null,
                            metalness: mat.metalnessMap ? (mat.metalnessMap.name || 'Metalness map sans nom') : null,
                            ambient: mat.aoMap ? (mat.aoMap.name || 'AO map sans nom') : null
                        }
                    });
                }
            };

            if (Array.isArray(object.material)) {
                object.material.forEach(processMaterial);
            } else {
                processMaterial(object.material);
            }
        }

        // Ajouter les enfants à la pile
        if (object.children && object.children.length > 0) {
            for (let i = 0; i < object.children.length; i++) {
                stack.push(object.children[i]);
            }
        }
    }

    // Statistiques de base
    console.log(`Nombre total d'objets dans la scène: ${objectCount}`);
    console.log(`Nombre de géométries uniques: ${geometries.size}`);
    console.log(`Nombre de matériaux uniques: ${materials.size}`);

    // Calculer les statistiques avancées
    let totalVertices = 0;
    let totalFaces = 0;

    geometries.forEach(geo => {
        if (typeof geo.vertexCount === 'number') {
            totalVertices += geo.vertexCount;
        }
        if (typeof geo.faceCount === 'number') {
            totalFaces += geo.faceCount;
        }
    });

    console.log(`Total des vertices: ${totalVertices}`);
    console.log(`Total des faces: ${totalFaces}`);

    // Afficher les géométries les plus lourdes
    const geometryArray = Array.from(geometries.values());
    const heavyGeometries = geometryArray
        .filter(geo => typeof geo.vertexCount === 'number')
        .sort((a, b) => b.vertexCount - a.vertexCount)
        .slice(0, 10);

    console.log("\n=== GÉOMÉTRIES LES PLUS LOURDES ===");
    heavyGeometries.forEach((geo, index) => {
        console.log(`${index + 1}. ${geo.objectName}: ${geo.vertexCount} vertices, ${geo.faceCount} faces`);
    });

    return {
        objectCount,
        geometryCount: geometries.size,
        materialCount: materials.size,
        totalVertices,
        totalFaces,
        heavyGeometries
    };
}