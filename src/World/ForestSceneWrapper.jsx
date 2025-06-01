import React, {useState, useEffect, useRef} from 'react';
import ForestScene from './ForestScene';
import {EventBus} from '../Utils/EventEmitter';
import templateManager from '../Config/TemplateManager';

export default function ForestSceneWrapper() {
    const [assetsReady, setAssetsReady] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const assetCheckAttemptsRef = useRef(0);
    const alreadyCheckedRef = useRef(false);
    const maxRetryAttempts = 15;
    const stabilityDelay = 1000;

    useEffect(() => {
        // Émettre immédiatement un événement pour indiquer le début du processus
        EventBus.trigger('forest-loading-progress', {
            phase: 'INITIALIZING',
            phaseLabel: 'Initialisation du système forestier...',
            phaseProgress: 0,
            totalProgress: 0,
            isComplete: false
        });

        assetCheckAttemptsRef.current = 0;

        const requiredAssetsInfo = templateManager.getRequiredAssets();
        const requiredModels = requiredAssetsInfo.map(asset => asset.name);

        const handleAssetsReady = () => {
            if (alreadyCheckedRef.current) return;

            console.log("ForestSceneWrapper :: Assets loaded, checking models...");
            alreadyCheckedRef.current = true;

            // Émettre un événement de progression pour la vérification des modèles
            EventBus.trigger('forest-loading-progress', {
                phase: 'CHECKING_MODELS',
                phaseLabel: 'Vérification des modèles 3D...',
                phaseProgress: 0,
                totalProgress: 2,
                isComplete: false
            });

            checkAssets();
        };

        const isModelReallyAvailable = (modelName) => {
            if (!window.assetManager) return false;

            try {
                if (typeof window.assetManager.getItem === 'function') {
                    const model = window.assetManager.getItem(modelName);
                    if (model) {
                        if (model.scene) {
                            return true;
                        }
                        return true;
                    }
                }

                if (window.assetManager.items && window.assetManager.items[modelName]) {
                    return true;
                }

                return false;
            } catch (error) {
                console.error(`Error checking model ${modelName}:`, error);
                return false;
            }
        };

        const areAllRequiredModelsAvailable = () => {
            const availableModels = requiredModels.filter(isModelReallyAvailable);
            const missingModels = requiredModels.filter(model => !isModelReallyAvailable(model));

            if (missingModels.length > 0) {
                console.log(`ForestSceneWrapper :: Missing models: ${missingModels.join(', ')}`);
            }

            // Émettre la progression de vérification des modèles
            const progressPercent = (availableModels.length / requiredModels.length) * 100;
            EventBus.trigger('forest-loading-progress', {
                phase: 'CHECKING_MODELS',
                phaseLabel: `Vérification modèles: ${availableModels.length}/${requiredModels.length}`,
                phaseProgress: progressPercent,
                totalProgress: 2 + (progressPercent * 0.03), // 3% max pour cette phase
                isComplete: false
            });

            return availableModels.length === requiredModels.length;
        };

        let stabilityTimeoutId;

        const checkAssets = () => {
            assetCheckAttemptsRef.current += 1;
            console.log(`ForestSceneWrapper :: Checking assets (attempt ${assetCheckAttemptsRef.current}/${maxRetryAttempts})`);

            // Émettre la progression de la vérification
            const attemptProgress = (assetCheckAttemptsRef.current / maxRetryAttempts) * 100;
            EventBus.trigger('forest-loading-progress', {
                phase: 'CHECKING_ASSETS',
                phaseLabel: `Vérification assets (tentative ${assetCheckAttemptsRef.current}/${maxRetryAttempts})`,
                phaseProgress: attemptProgress,
                totalProgress: 3 + (attemptProgress * 0.02), // 2% max pour cette phase
                isComplete: false
            });

            try {
                if (!window.assetManager) {
                    console.log("ForestSceneWrapper :: AssetManager not found");
                    if (assetCheckAttemptsRef.current < maxRetryAttempts) {
                        setIsRetrying(true);
                        setTimeout(checkAssets, 500);
                        return;
                    }
                }

                if (areAllRequiredModelsAvailable()) {
                    console.log("ForestSceneWrapper :: All required models are available, waiting for stability...");

                    // Émettre un événement de modèles disponibles
                    EventBus.trigger('forest-loading-progress', {
                        phase: 'MODELS_READY',
                        phaseLabel: 'Modèles prêts, préparation de la scène...',
                        phaseProgress: 100,
                        totalProgress: 5,
                        isComplete: false
                    });

                    EventBus.trigger('forest-models-available', { status: 'ready' });

                    if (stabilityTimeoutId) {
                        clearTimeout(stabilityTimeoutId);
                    }

                    stabilityTimeoutId = setTimeout(() => {
                        console.log("ForestSceneWrapper :: Stability period complete, rendering scene");

                        // Émettre le début du rendu de la scène
                        EventBus.trigger('forest-loading-progress', {
                            phase: 'SCENE_RENDERING',
                            phaseLabel: 'Démarrage du rendu forestier...',
                            phaseProgress: 0,
                            totalProgress: 5,
                            isComplete: false
                        });

                        EventBus.trigger('forest-scene-rendering');
                        setAssetsReady(true);
                        setIsRetrying(false);
                    }, stabilityDelay);

                    return;
                }

                console.log("ForestSceneWrapper :: Some models are not yet available, will retry...");

                if (assetCheckAttemptsRef.current < maxRetryAttempts) {
                    setIsRetrying(true);
                    setTimeout(checkAssets, 500);
                } else {
                    console.error("ForestSceneWrapper :: Max retry attempts reached for models");

                    const availableModels = requiredModels.filter(isModelReallyAvailable);
                    const missingModels = requiredModels.filter(model => !isModelReallyAvailable(model));

                    console.log(`ForestSceneWrapper :: Final check: ${availableModels.length}/${requiredModels.length} models available`);
                    console.log(`ForestSceneWrapper :: Missing models: ${missingModels.join(', ')}`);

                    setTimeout(() => {
                        const finalAvailableModels = requiredModels.filter(isModelReallyAvailable);
                        if (finalAvailableModels.length > 0) {
                            console.log(`ForestSceneWrapper :: Final attempt with ${finalAvailableModels.length} models`);

                            // Émettre un événement de rendu avec modèles partiels
                            EventBus.trigger('forest-loading-progress', {
                                phase: 'PARTIAL_RENDERING',
                                phaseLabel: `Rendu partiel (${finalAvailableModels.length} modèles)...`,
                                phaseProgress: 0,
                                totalProgress: 5,
                                isComplete: false
                            });

                            EventBus.trigger('forest-scene-rendering');
                            setAssetsReady(true);
                        } else {
                            console.error("ForestSceneWrapper :: No models available, cannot render scene");

                            // Émettre un événement d'erreur
                            EventBus.trigger('forest-loading-progress', {
                                phase: 'ERROR',
                                phaseLabel: 'Erreur: Aucun modèle disponible',
                                phaseProgress: 0,
                                totalProgress: 5,
                                isComplete: false
                            });
                        }
                    }, 2000);
                }
            } catch (err) {
                console.error("Error checking assets:", err);
                if (assetCheckAttemptsRef.current < maxRetryAttempts) {
                    setIsRetrying(true);
                    setTimeout(checkAssets, 500);
                } else {
                    setTimeout(() => {
                        try {
                            const finalCheck = areAllRequiredModelsAvailable();
                            console.log(`ForestSceneWrapper :: Emergency final check: ${finalCheck ? 'Success' : 'Failed'}`);
                            if (finalCheck) {
                                EventBus.trigger('forest-scene-rendering');
                                setAssetsReady(true);
                            }
                        } catch (finalErr) {
                            console.error("Final check error:", finalErr);
                        }
                    }, 2000);
                }
            }
        };

        const unsubscribe = EventBus.on('ready', handleAssetsReady);

        if (window.assetManager && window.assetManager.items) {
            alreadyCheckedRef.current = true;
            setTimeout(checkAssets, 500);
        }

        return () => {
            unsubscribe();
            if (stabilityTimeoutId) {
                clearTimeout(stabilityTimeoutId);
            }
        };
    }, []);

    // Retourner la scène forestière seulement quand tout est prêt
    return assetsReady ? <ForestScene/> : null;
}