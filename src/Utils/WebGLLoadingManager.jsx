import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventBus } from './EventEmitter.jsx';
import useStore from '../Store/useStore';

/**
 * WebGLLoadingManager - Système de loading robuste pour Three.js
 * VERSION AMÉLIORÉE avec suivi de la progression de la forêt
 */
const WebGLLoadingManager = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [loadingPhase, setLoadingPhase] = useState('Initialisation...');
    const [detailedProgress, setDetailedProgress] = useState({
        assets: 0,
        textures: 0,
        geometries: 0,
        shaders: 0,
        scene: 0,
        forest: 0
    });

    const progressRef = useRef(0);
    const isCompleteRef = useRef(false);
    const loadingManagerRef = useRef(null);
    const webglCheckIntervalRef = useRef(null);
    const renderCheckCountRef = useRef(0);
    const shaderCompilationRef = useRef({ total: 0, compiled: 0 });
    const sceneObjectsCountRef = useRef(0);
    const lastProgressUpdate = useRef(Date.now());

    // NOUVEAU: États pour la progression de la forêt
    const forestProgressRef = useRef(0);
    const [forestPhase, setForestPhase] = useState('En attente...');
    const assetsProgressRef = useRef(0);

    // NOUVEAU: Poids des différentes phases de chargement
    const LOADING_WEIGHTS = {
        ASSETS: 25,        // 25% pour les assets de base
        WEBGL_INIT: 5,     // 5% pour l'initialisation WebGL
        FOREST: 70         // 70% pour la création de la forêt (le plus lourd!)
    };

    // Fonction pour calculer la progression globale
    const calculateGlobalProgress = useCallback((assetsProgress, forestProgress) => {
        const weightedAssetsProgress = (assetsProgress / 100) * LOADING_WEIGHTS.ASSETS;
        const weightedWebGLProgress = (renderCheckCountRef.current >= 3 ? 1 : 0) * LOADING_WEIGHTS.WEBGL_INIT;
        const weightedForestProgress = (forestProgress / 100) * LOADING_WEIGHTS.FOREST;

        const totalProgress = weightedAssetsProgress + weightedWebGLProgress + weightedForestProgress;

        return Math.min(100, totalProgress);
    }, []);

    // Fonction pour terminer le chargement (sortie du scope attachToThreeLoadingManager)
    const completeLoading = useCallback(() => {
        if (isCompleteRef.current) return;

        isCompleteRef.current = true;
        setLoadingPhase('Chargement terminé!');
        setProgress(100);
        progressRef.current = 100;

        setDetailedProgress({
            assets: 100,
            textures: 100,
            geometries: 100,
            shaders: 100,
            scene: 100,
            forest: 100
        });

        // Arrêter la surveillance
        if (webglCheckIntervalRef.current) {
            clearInterval(webglCheckIntervalRef.current);
            webglCheckIntervalRef.current = null;
        }

        console.log('🎉 Chargement WebGL ET Forêt complètement terminé');

        setTimeout(() => {
            if (onComplete) onComplete();
        }, 500);
    }, [onComplete]);

    // Fonction pour vérifier si le chargement est complet
    const checkCompletionConditions = useCallback(() => {
        const assetsComplete = assetsProgressRef.current >= 100;
        const forestComplete = forestProgressRef.current >= 100;

        console.log(`🔍 Vérification completion: Assets=${assetsComplete} (${assetsProgressRef.current}%), Forest=${forestComplete} (${forestProgressRef.current}%)`);

        if (assetsComplete && forestComplete && !isCompleteRef.current) {
            console.log('✅ Toutes les conditions de completion sont remplies!');
            completeLoading();
            return true;
        }

        return false;
    }, [completeLoading]);

    // Fonction pour détecter si WebGL est prêt et rendu
    const checkWebGLRenderState = useCallback(() => {
        try {
            if (!window.renderer) return false;

            const renderer = window.renderer;
            const gl = renderer.getContext();

            if (!gl) return false;

            const webglState = {
                contextLost: gl.isContextLost(),
                framebufferComplete: gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
                hasActiveTextures: gl.getParameter(gl.ACTIVE_TEXTURE) !== null,
                hasPrograms: renderer.info.programs?.length > 0
            };

            const renderInfo = renderer.info.render;
            const hasActiveRender = renderInfo.calls > 0 && renderInfo.triangles > 0;

            const scene = window.scene;
            const hasSceneContent = scene && scene.children.length > 0;

            let totalObjects = 0;
            if (scene) {
                scene.traverse(() => totalObjects++);
            }

            const isReady = !webglState.contextLost &&
                webglState.framebufferComplete &&
                hasActiveRender &&
                hasSceneContent &&
                totalObjects > 50;

            if (isReady) {
                renderCheckCountRef.current++;
                if (renderCheckCountRef.current >= 3) {
                    return true;
                }
            } else {
                renderCheckCountRef.current = 0;
            }

            setDetailedProgress(prev => ({
                ...prev,
                scene: Math.min(100, (totalObjects / 100) * 100),
                shaders: Math.min(100, ((renderer.info.programs?.length || 0) / 10) * 100)
            }));

            return false;

        } catch (error) {
            console.warn('Erreur lors de la vérification WebGL:', error);
            return false;
        }
    }, []);

    // NOUVEAU: Écouteur pour la progression de la forêt
    useEffect(() => {
        const handleForestProgress = (data) => {
            console.log(`🌲 WebGLLoadingManager reçoit progression forêt: ${data.totalProgress.toFixed(1)}%`);

            forestProgressRef.current = data.totalProgress;
            setForestPhase(data.phaseLabel);

            setDetailedProgress(prev => ({
                ...prev,
                forest: data.totalProgress
            }));

            // Recalculer la progression globale
            const globalProgress = calculateGlobalProgress(
                assetsProgressRef.current,
                data.totalProgress
            );

            setProgress(globalProgress);
            progressRef.current = globalProgress;

            // Mettre à jour la phase affichée si on est dans la phase forêt
            if (data.totalProgress > 0) {
                setLoadingPhase(data.phaseLabel);
            }

            // Vérifier les conditions de completion
            if (data.totalProgress >= 100) {
                console.log('🌲 Forêt à 100%, vérification des conditions de completion...');
                checkCompletionConditions();
            }
        };

        const handleForestReady = () => {
            console.log('🌲 Événement forest-ready reçu!');
            forestProgressRef.current = 100;

            setDetailedProgress(prev => ({
                ...prev,
                forest: 100
            }));

            // Recalculer la progression finale
            const finalProgress = calculateGlobalProgress(assetsProgressRef.current, 100);
            setProgress(finalProgress);
            progressRef.current = finalProgress;

            // Forcer la completion immédiatement
            console.log('🌲 Forest-ready: Forçage immédiat de la completion');
            completeLoading();
        };

        const forestProgressCleanup = EventBus.on('forest-loading-progress', handleForestProgress);
        const forestReadyCleanup = EventBus.on('forest-ready', handleForestReady);

        return () => {
            forestProgressCleanup();
            forestReadyCleanup();
        };
    }, [calculateGlobalProgress, completeLoading, checkCompletionConditions]);

    // Surveillance avancée du THREE.LoadingManager
    useEffect(() => {
        let threeLoadingManager = null;

        const attachToThreeLoadingManager = async () => {
            if (window.assetManager && window.assetManager.loadingManager) {
                threeLoadingManager = window.assetManager.loadingManager;
            } else {
                const {LoadingManager} = await import('three');
                threeLoadingManager = new LoadingManager();
                window.globalLoadingManager = threeLoadingManager;
            }

            loadingManagerRef.current = threeLoadingManager;

            threeLoadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
                console.log(`Début du chargement assets: ${itemsLoaded}/${itemsTotal} (${url})`);
                setLoadingPhase('Chargement des assets 3D...');
            };

            threeLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
                const assetProgress = (itemsLoaded / itemsTotal) * 100;
                assetsProgressRef.current = assetProgress;

                setDetailedProgress(prev => ({
                    ...prev,
                    assets: assetProgress
                }));

                // Recalculer la progression globale
                const globalProgress = calculateGlobalProgress(assetProgress, forestProgressRef.current);
                setProgress(globalProgress);
                progressRef.current = globalProgress;

                if (url.includes('.jpg') || url.includes('.png') || url.includes('.webp')) {
                    setLoadingPhase('Chargement des textures...');
                } else if (url.includes('.glb') || url.includes('.gltf')) {
                    setLoadingPhase('Chargement des modèles 3D...');
                }
            };

            threeLoadingManager.onLoad = () => {
                console.log('THREE.LoadingManager: Tous les assets sont chargés');
                assetsProgressRef.current = 100;

                setDetailedProgress(prev => ({
                    ...prev,
                    assets: 100,
                    textures: 100
                }));

                // Recalculer avec assets complets
                const globalProgress = calculateGlobalProgress(100, forestProgressRef.current);
                setProgress(globalProgress);
                progressRef.current = globalProgress;

                setLoadingPhase('Assets chargés, préparation de la scène...');

                // Vérifier les conditions de completion
                console.log('📦 Assets à 100%, vérification des conditions de completion...');
                checkCompletionConditions();
            };

            threeLoadingManager.onError = (url) => {
                console.error(`Erreur de chargement: ${url}`);
            };
        };

        // Fonction pour terminer le chargement
        // SUPPRIMÉ - maintenant défini au niveau supérieur

        const updateProgress = (newProgress) => {
            const clampedProgress = Math.max(progressRef.current, Math.min(100, newProgress));
            progressRef.current = clampedProgress;
            setProgress(clampedProgress);
            lastProgressUpdate.current = Date.now();
        };

        const initializeLoading = async () => {
            try {
                setLoadingPhase('Ajustement des jumelles...');
                updateProgress(2);

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

                // Passer à la phase suivante seulement si aucun asset à charger
                setTimeout(() => {
                    if (progressRef.current < 10) {
                        console.log('Aucun asset détecté, attente de la forêt...');
                        setLoadingPhase('En attente de la scène forestière...');
                    }
                }, 2000);

            } catch (error) {
                console.error('Erreur lors de l\'initialisation du loading:', error);
                setTimeout(completeLoading, 5000);
            }
        };

        initializeLoading();

        // Écouteurs d'événements de backup
        const handleBackupEvents = () => {
            const cleanups = [
                EventBus.on('assets-ready', () => {
                    console.log('Événement assets-ready reçu');
                    assetsProgressRef.current = 100;
                    if (progressRef.current < 30) {
                        const globalProgress = calculateGlobalProgress(100, forestProgressRef.current);
                        updateProgress(globalProgress);
                    }
                    checkCompletionConditions();
                })
            ];

            return () => cleanups.forEach(cleanup => cleanup());
        };

        const backupCleanup = handleBackupEvents();

        // Timeout de sécurité réduit avec logs détaillés
        const safetyTimeout = setTimeout(() => {
            if (!isCompleteRef.current) {
                console.warn('⏰ Timeout de sécurité atteint, état actuel:');
                console.warn(`📦 Assets: ${assetsProgressRef.current}%`);
                console.warn(`🌲 Forêt: ${forestProgressRef.current}%`);
                console.warn(`🎯 Progression globale: ${progressRef.current}%`);
                console.warn('🔧 Forçage de la completion du loading');
                completeLoading();
            }
        }, 45000); // Réduit à 45 secondes

        return () => {
            if (webglCheckIntervalRef.current) {
                clearInterval(webglCheckIntervalRef.current);
            }
            clearTimeout(safetyTimeout);
            backupCleanup();
            isCompleteRef.current = false;
        };
    }, [onComplete, checkWebGLRenderState, calculateGlobalProgress, completeLoading, checkCompletionConditions]);

    // Interface de progression détaillée pour le debug
    const getDetailedStatus = () => {
        return {
            phase: loadingPhase,
            forestPhase: forestPhase,
            progress: progress,
            webglReady: checkWebGLRenderState(),
            renderCalls: window.renderer?.info?.render?.calls || 0,
            triangles: window.renderer?.info?.render?.triangles || 0,
            sceneObjects: sceneObjectsCountRef.current,
            shaders: window.renderer?.info?.programs?.length || 0,
            detailed: detailedProgress,
            weights: LOADING_WEIGHTS
        };
    };

    // Exposer l'état pour le debug
    useEffect(() => {
        window.loadingStatus = getDetailedStatus;
    }, [progress, loadingPhase, forestPhase, detailedProgress]);

    return {
        progress,
        phase: loadingPhase,
        forestPhase: forestPhase,
        detailed: detailedProgress,
        isComplete: isCompleteRef.current
    };
};

export default WebGLLoadingManager;