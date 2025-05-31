import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventBus } from './EventEmitter.jsx';
import useStore from '../Store/useStore';

/**
 * WebGLLoadingManager - Système de loading robuste pour Three.js
 *
 * Surveillance directe de :
 * - THREE.LoadingManager global
 * - État du rendu WebGL
 * - Compilation des shaders
 * - Chargement des géométries et textures
 * - Initialisation complète de la scène
 */
const WebGLLoadingManager = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [loadingPhase, setLoadingPhase] = useState('Initialisation...');
    const [detailedProgress, setDetailedProgress] = useState({
        assets: 0,
        textures: 0,
        geometries: 0,
        shaders: 0,
        scene: 0
    });

    const progressRef = useRef(0);
    const isCompleteRef = useRef(false);
    const loadingManagerRef = useRef(null);
    const webglCheckIntervalRef = useRef(null);
    const renderCheckCountRef = useRef(0);
    const shaderCompilationRef = useRef({ total: 0, compiled: 0 });
    const sceneObjectsCountRef = useRef(0);
    const lastProgressUpdate = useRef(Date.now());

    // Phase de chargement avec pourcentages
    const LOADING_PHASES = {
        INITIALIZING: { min: 0, max: 10, label: 'Initialisation du moteur 3D...' },
        LOADING_ASSETS: { min: 10, max: 20, label: 'Chargement des modèles 3D...' },
        LOADING_TEXTURES: { min: 20, max: 30, label: 'Application des textures...' },
        BUILDING_SCENE: { min: 40, max: 50, label: 'Construction de la scène...' },
        COMPILING_SHADERS: { min: 50, max: 60, label: 'Compilation des shaders...' },
        FINALIZING: { min: 60, max: 100, label: 'Finalisation du rendu...' }
    };

    // Fonction pour détecter si WebGL est prêt et rendu
    const checkWebGLRenderState = useCallback(() => {
        try {
            // Vérifier si le renderer existe et est actif
            if (!window.renderer) return false;

            const renderer = window.renderer;
            const gl = renderer.getContext();

            if (!gl) return false;

            // Vérifier l'état WebGL
            const webglState = {
                contextLost: gl.isContextLost(),
                framebufferComplete: gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
                hasActiveTextures: gl.getParameter(gl.ACTIVE_TEXTURE) !== null,
                hasPrograms: renderer.info.programs?.length > 0
            };

            // Vérifier si des objets sont rendus
            const renderInfo = renderer.info.render;
            const hasActiveRender = renderInfo.calls > 0 && renderInfo.triangles > 0;

            // Vérifier la scène
            const scene = window.scene;
            const hasSceneContent = scene && scene.children.length > 0;

            // Compter les objets de la scène de manière récursive
            let totalObjects = 0;
            if (scene) {
                scene.traverse(() => totalObjects++);
            }

            // La scène est considérée comme prête si :
            const isReady = !webglState.contextLost &&
                           webglState.framebufferComplete &&
                           hasActiveRender &&
                           hasSceneContent &&
                           totalObjects > 50; // Seuil minimum d'objets dans la scène

            if (isReady) {
                renderCheckCountRef.current++;

                // Exiger plusieurs frames de rendu stable avant de considérer comme terminé
                if (renderCheckCountRef.current >= 3) {
                    return true;
                }
            } else {
                renderCheckCountRef.current = 0;
            }

            // Mettre à jour les statistiques détaillées
            setDetailedProgress(prev => ({
                ...prev,
                scene: Math.min(100, (totalObjects / 100) * 100), // Estimé sur 100 objets minimum
                shaders: Math.min(100, ((renderer.info.programs?.length || 0) / 10) * 100)
            }));

            return false;

        } catch (error) {
            console.warn('Erreur lors de la vérification WebGL:', error);
            return false;
        }
    }, []);

    // Surveillance avancée du THREE.LoadingManager
    useEffect(() => {
        let threeLoadingManager = null;

        // Fonction pour s'attacher au LoadingManager de Three.js
        const attachToThreeLoadingManager = async () => {
            // Essayer de récupérer le LoadingManager depuis l'AssetManager
            if (window.assetManager && window.assetManager.loadingManager) {
                threeLoadingManager = window.assetManager.loadingManager;
            } else {
                // Créer un LoadingManager global si nécessaire
                const {LoadingManager} = await import('three');
                threeLoadingManager = new LoadingManager();
                window.globalLoadingManager = threeLoadingManager;
            }

            loadingManagerRef.current = threeLoadingManager;

            // Configuration des callbacks du LoadingManager
            threeLoadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
                console.log(`Début du chargement: ${itemsLoaded}/${itemsTotal} (${url})`);
                setLoadingPhase(LOADING_PHASES.LOADING_ASSETS.label);

                const assetProgress = Math.min(40, (itemsLoaded / itemsTotal) * 30 + 10);
                updateProgress(assetProgress);
            };

            threeLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
                console.log(`Progression: ${itemsLoaded}/${itemsTotal} - ${url}`);

                // Calculer la progression des assets (10-40%)
                const assetProgress = Math.min(40, (itemsLoaded / itemsTotal) * 30 + 10);
                updateProgress(assetProgress);

                setDetailedProgress(prev => ({
                    ...prev,
                    assets: (itemsLoaded / itemsTotal) * 100
                }));

                // Déterminer le type de resource pour ajuster la phase
                if (url.includes('.jpg') || url.includes('.png') || url.includes('.webp')) {
                    setLoadingPhase(LOADING_PHASES.LOADING_TEXTURES.label);
                } else if (url.includes('.glb') || url.includes('.gltf')) {
                    setLoadingPhase(LOADING_PHASES.LOADING_ASSETS.label);
                }
            };

            threeLoadingManager.onLoad = () => {
                console.log('THREE.LoadingManager: Tous les assets sont chargés');
                setLoadingPhase(LOADING_PHASES.BUILDING_SCENE.label);
                updateProgress(60);

                setDetailedProgress(prev => ({
                    ...prev,
                    assets: 100,
                    textures: 100
                }));

                // Commencer la surveillance WebGL après le chargement des assets
                startWebGLMonitoring();
            };

            threeLoadingManager.onError = (url) => {
                console.error(`Erreur de chargement: ${url}`);
            };
        };

        // Fonction pour démarrer la surveillance WebGL
        const startWebGLMonitoring = () => {
            setLoadingPhase(LOADING_PHASES.COMPILING_SHADERS.label);
            updateProgress(80);

            webglCheckIntervalRef.current = setInterval(() => {
                const isWebGLReady = checkWebGLRenderState();

                if (isWebGLReady && !isCompleteRef.current) {
                    completeLoading();
                } else {
                    // Augmenter progressivement le pourcentage pendant la vérification
                    const currentProgress = progressRef.current;
                    if (currentProgress < 95) {
                        updateProgress(Math.min(95, currentProgress + 0.5));
                    }
                }
            }, 100); // Vérifier toutes les 100ms
        };

        // Fonction pour terminer le chargement
        const completeLoading = () => {
            if (isCompleteRef.current) return;

            isCompleteRef.current = true;
            setLoadingPhase('Chargement terminé');
            updateProgress(100);

            setDetailedProgress({
                assets: 100,
                textures: 100,
                geometries: 100,
                shaders: 100,
                scene: 100
            });

            // Arrêter la surveillance
            if (webglCheckIntervalRef.current) {
                clearInterval(webglCheckIntervalRef.current);
                webglCheckIntervalRef.current = null;
            }

            console.log('🎉 Chargement WebGL complètement terminé');

            // Délai pour s'assurer que tout est stable
            setTimeout(() => {
                if (onComplete) onComplete();
            }, 500);
        };

        // Fonction pour mettre à jour le progrès de manière lissée
        const updateProgress = (newProgress) => {
            const clampedProgress = Math.max(progressRef.current, Math.min(100, newProgress));
            progressRef.current = clampedProgress;
            setProgress(clampedProgress);
            lastProgressUpdate.current = Date.now();
        };

        // Initialiser le système
        const initializeLoading = async () => {
            try {
                setLoadingPhase(LOADING_PHASES.INITIALIZING.label);
                updateProgress(5);

                // Attendre que l'AssetManager soit disponible
                const waitForAssetManager = () => {
                    return new Promise((resolve) => {
                        const checkAssetManager = () => {
                            if (window.assetManager) {
                                resolve();
                            } else {
                                setTimeout(checkAssetManager, 100);
                            }
                        };
                        checkAssetManager();
                    });
                };

                await waitForAssetManager();
                await attachToThreeLoadingManager();

                // Si aucun asset à charger, passer directement à la surveillance WebGL
                setTimeout(() => {
                    if (progressRef.current < 20) {
                        console.log('Aucun asset détecté, passage à la surveillance WebGL');
                        startWebGLMonitoring();
                    }
                }, 2000);

            } catch (error) {
                console.error('Erreur lors de l\'initialisation du loading:', error);
                // En cas d'erreur, essayer de terminer quand même
                setTimeout(completeLoading, 5000);
            }
        };

        initializeLoading();

        // Écouteurs d'événements de backup pour s'assurer qu'on ne rate rien
        const handleBackupEvents = () => {
            // Événements de l'ancien système pour compatibilité
            const cleanups = [
                EventBus.on('forest-ready', () => {
                    console.log('Événement forest-ready reçu');
                    if (progressRef.current < 85) updateProgress(85);
                }),
                EventBus.on('forest-scene-ready', () => {
                    console.log('Événement forest-scene-ready reçu');
                    if (progressRef.current < 90) updateProgress(90);
                }),
                EventBus.on('assets-ready', () => {
                    console.log('Événement assets-ready reçu');
                    if (progressRef.current < 60) updateProgress(60);
                })
            ];

            return () => cleanups.forEach(cleanup => cleanup());
        };

        const backupCleanup = handleBackupEvents();

        // Timeout de sécurité pour éviter un chargement infini
        const safetyTimeout = setTimeout(() => {
            if (!isCompleteRef.current) {
                console.warn('Timeout de sécurité atteint, forçage de la completion du loading');
                completeLoading();
            }
        }, 30000); // 30 secondes max

        // Nettoyage
        return () => {
            if (webglCheckIntervalRef.current) {
                clearInterval(webglCheckIntervalRef.current);
            }
            clearTimeout(safetyTimeout);
            backupCleanup();
            isCompleteRef.current = false;
        };
    }, [onComplete, checkWebGLRenderState]);

    // Interface de progression détaillée pour le debug
    const getDetailedStatus = () => {
        return {
            phase: loadingPhase,
            progress: progress,
            webglReady: checkWebGLRenderState(),
            renderCalls: window.renderer?.info?.render?.calls || 0,
            triangles: window.renderer?.info?.render?.triangles || 0,
            sceneObjects: sceneObjectsCountRef.current,
            shaders: window.renderer?.info?.programs?.length || 0,
            detailed: detailedProgress
        };
    };

    // Exposer l'état pour le debug
    useEffect(() => {
        window.loadingStatus = getDetailedStatus;
    }, [progress, loadingPhase, detailedProgress]);

    return {
        progress,
        phase: loadingPhase,
        detailed: detailedProgress,
        isComplete: isCompleteRef.current
    };
};

export default WebGLLoadingManager;