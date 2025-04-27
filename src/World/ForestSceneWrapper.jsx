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
    const stabilityDelay = 1000; // Délai de stabilité en ms

    useEffect(() => {
        // Réinitialiser le compteur de tentatives à chaque montage du composant
        assetCheckAttemptsRef.current = 0;

        // Liste des modèles requis pour la scène forestière - récupérée du gestionnaire de templates
        const requiredAssetsInfo = templateManager.getRequiredAssets();
        const requiredModels = requiredAssetsInfo.map(asset => asset.name);
        console.log("Modèles requis pour la forêt:", requiredModels);

        // S'abonner à l'événement 'ready' de l'AssetManager
        const handleAssetsReady = () => {
            if (alreadyCheckedRef.current) return;

            console.log("ForestSceneWrapper :: Assets loaded, checking models...");
            alreadyCheckedRef.current = true;

            // Attendre un peu plus longtemps avant la première vérification
            setTimeout(() => {
                checkAssets();
            }, 500);
        };

        // Fonction plus robuste pour vérifier si un modèle spécifique est réellement accessible
        const isModelReallyAvailable = (modelName) => {
            if (!window.assetManager) return false;

            try {
                // Vérifier d'abord via getItem
                if (typeof window.assetManager.getItem === 'function') {
                    const model = window.assetManager.getItem(modelName);
                    if (model) {
                        // Pour un GLTF, vérifier que la scène est disponible
                        if (model.scene) {
                            return true;
                        }
                        // Pour d'autres types de modèles/assets
                        return true;
                    }
                }

                // Vérifier directement dans items comme plant de secours
                if (window.assetManager.items && window.assetManager.items[modelName]) {
                    return true;
                }

                return false;
            } catch (error) {
                console.error(`Error checking model ${modelName}:`, error);
                return false;
            }
        };

        // Vérifier tous les modèles requis
        const areAllRequiredModelsAvailable = () => {
            // Vérifier si tous les modèles requis sont disponibles
            const availableModels = requiredModels.filter(isModelReallyAvailable);
            console.log(`ForestSceneWrapper :: Available models: ${availableModels.length}/${requiredModels.length} - ${availableModels.join(', ')}`);

            const missingModels = requiredModels.filter(model => !isModelReallyAvailable(model));
            if (missingModels.length > 0) {
                console.log(`ForestSceneWrapper :: Missing models: ${missingModels.join(', ')}`);
            }

            return availableModels.length === requiredModels.length;
        };

        // Déclarer une variable pour stocker l'ID du timeout de stabilité
        let stabilityTimeoutId;

        const checkAssets = () => {
            // Incrémenter le compteur de tentatives
            assetCheckAttemptsRef.current += 1;
            console.log(`ForestSceneWrapper :: Checking assets (attempt ${assetCheckAttemptsRef.current}/${maxRetryAttempts})`);

            try {
                // Vérification de base: est-ce que l'AssetManager existe?
                if (!window.assetManager) {
                    console.log("ForestSceneWrapper :: AssetManager not found");
                    if (assetCheckAttemptsRef.current < maxRetryAttempts) {
                        setIsRetrying(true);
                        setTimeout(checkAssets, 500);
                        return;
                    }
                }

                // Journaliser l'état des items de l'AssetManager
                if (window.assetManager) {
                    if (window.assetManager.items) {
                        console.log("ForestSceneWrapper :: AssetManager items:", Object.keys(window.assetManager.items));
                    } else {
                        console.log("ForestSceneWrapper :: AssetManager items not found");
                    }
                }

                // Vérification plus précise: est-ce que tous les modèles requis sont disponibles?
                if (areAllRequiredModelsAvailable()) {
                    console.log("ForestSceneWrapper :: All required models are available, waiting for stability...");

                    // Annuler tout timeout de stabilité précédent
                    if (stabilityTimeoutId) {
                        clearTimeout(stabilityTimeoutId);
                    }

                    // Attendre un délai de stabilité avant de rendre la scène
                    // Cela donne le temps aux modèles d'être complètement initialisés
                    stabilityTimeoutId = setTimeout(() => {
                        console.log("ForestSceneWrapper :: Stability period complete, rendering scene");
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

                    // Vérifier combien de modèles sont disponibles
                    const availableModels = requiredModels.filter(isModelReallyAvailable);
                    const missingModels = requiredModels.filter(model => !isModelReallyAvailable(model));

                    console.log(`ForestSceneWrapper :: Final check: ${availableModels.length}/${requiredModels.length} models available`);
                    console.log(`ForestSceneWrapper :: Missing models: ${missingModels.join(', ')}`);

                    // Si au moins certains modèles sont disponibles, on peut essayer d'afficher la scène
                    // Mais d'abord, attendons un peu plus longtemps pour donner une dernière chance
                    setTimeout(() => {
                        const finalAvailableModels = requiredModels.filter(isModelReallyAvailable);
                        if (finalAvailableModels.length > 0) {
                            console.log(`ForestSceneWrapper :: Final attempt with ${finalAvailableModels.length} models`);
                            setAssetsReady(true);
                        } else {
                            console.error("ForestSceneWrapper :: No models available, cannot render scene");
                        }
                    }, 2000); // Attendre 2 secondes de plus pour une dernière vérification
                }
            } catch (err) {
                console.error("Error checking assets:", err);
                if (assetCheckAttemptsRef.current < maxRetryAttempts) {
                    setIsRetrying(true);
                    setTimeout(checkAssets, 500);
                } else {
                    // Dernier essai après un délai supplémentaire
                    setTimeout(() => {
                        try {
                            const finalCheck = areAllRequiredModelsAvailable();
                            console.log(`ForestSceneWrapper :: Emergency final check: ${finalCheck ? 'Success' : 'Failed'}`);
                            if (finalCheck) {
                                setAssetsReady(true);
                            }
                        } catch (finalErr) {
                            console.error("Final check error:", finalErr);
                        }
                    }, 2000);
                }
            }
        };

        // S'abonner à l'événement ready
        const unsubscribe = EventBus.on('ready', handleAssetsReady);

        // Si l'assetManager est déjà prêt, vérifier directement mais avec un délai
        if (window.assetManager && window.assetManager.items) {
            alreadyCheckedRef.current = true;
            setTimeout(checkAssets, 500);
        }

        return () => {
            unsubscribe();
            // Nettoyer le timeout de stabilité si le composant est démonté
            if (stabilityTimeoutId) {
                clearTimeout(stabilityTimeoutId);
            }
        };
    }, []);

    // Si les assets ne sont pas prêts, retourner un placeholder ou null
    if (!assetsReady) {
        return (
            <group>
                {/* Placeholder pendant le chargement */}
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[1, 1, 1]}/>
                    <meshStandardMaterial color={isRetrying ? "#ff5500" : "#00ff00"}/>
                </mesh>
                {isRetrying && (
                    <mesh position={[0, 2, 0]}>
                        <sphereGeometry args={[0.5, 16, 16]}/>
                        <meshStandardMaterial color={"#ffbb00"}/>
                    </mesh>
                )}
            </group>
        );
    }

    // Assets prêts, afficher la scène forestière
    return <ForestScene/>;
}