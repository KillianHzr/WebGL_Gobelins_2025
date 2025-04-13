import React, { useState, useEffect } from 'react';
import ForestScene from './ForestScene';
import { EventBus } from '../Utils/EventEmitter';

export default function ForestSceneWrapper() {
    const [assetsReady, setAssetsReady] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        // S'abonner à l'événement 'ready' de l'AssetManager
        const handleAssetsReady = () => {
            console.log("ForestSceneWrapper :: Assets loaded, checking models...");

            // Vérifier après un court délai pour s'assurer que les modèles sont disponibles
            setTimeout(() => {
                checkAssets();
            }, 300);
        };

        const checkAssets = () => {
            // Vérifier si l'AssetManager est bien initialisé
            if (!window.assetManager) {
                console.log("AssetManager not yet available, will retry...");
                setIsRetrying(true);
                setTimeout(checkAssets, 500);
                return;
            }

            // Vérifier si les assets sont disponibles
            try {
                // Il n'est pas nécessaire que tous les modèles soient chargés, seulement un ou deux pour démarrer
                const modelsLoaded = !!window.assetManager.items &&
                    (window.assetManager.items['Map'] ||
                        window.assetManager.items['Tree1'] ||
                        window.assetManager.items['Tree2'] ||
                        window.assetManager.items['Tree3']);

                if (modelsLoaded) {
                    console.log("ForestSceneWrapper :: Models are available, rendering scene");
                    setAssetsReady(true);
                    setIsRetrying(false);
                } else {
                    console.log("ForestSceneWrapper :: Models not yet available, will retry...");
                    setIsRetrying(true);
                    setTimeout(checkAssets, 500);
                }
            } catch (err) {
                console.error("Error checking assets:", err);
                setIsRetrying(true);
                setTimeout(checkAssets, 500);
            }
        };

        // S'abonner à l'événement ready
        const unsubscribe = EventBus.on('ready', handleAssetsReady);

        // Vérifier immédiatement au cas où l'événement a déjà été déclenché
        checkAssets();

        return () => {
            unsubscribe();
        };
    }, []);

    // Si les assets ne sont pas prêts, retourner un placeholder ou null
    if (!assetsReady) {
        return (
            <group>
                {/* Placeholder pendant le chargement */}
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color={isRetrying ? "#ff5500" : "#00ff00"} />
                </mesh>
                {isRetrying && (
                    <mesh position={[0, 2, 0]}>
                        <sphereGeometry args={[0.5, 16, 16]} />
                        <meshStandardMaterial color={"#ffbb00"} />
                    </mesh>
                )}
            </group>
        );
    }

    // Assets prêts, afficher la scène forestière
    return <ForestScene />;
}