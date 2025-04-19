import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';
import { audioManager } from './AudioManager';

export default function CaptureInterface() {
    const [isVisible, setIsVisible] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [showNotification, setShowNotification] = useState(false);

    // Récupérer les états liés à la caméra depuis le store
    const camera = useStore(state => state.camera);
    const cameraInitialZoom = useStore(state => state.cameraInitialZoom);
    const currentZoomLevel = useStore(state => state.currentZoomLevel);
    const setCurrentZoomLevel = useStore(state => state.setCurrentZoomLevel);

    const interaction = useStore(state => state.interaction);

    // Surveiller les changements d'état pour savoir quand afficher l'interface
    useEffect(() => {
        if (interaction?.showCaptureInterface) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [interaction?.showCaptureInterface]);

    // Mettre à jour le zoom de la caméra lorsque le niveau de zoom change
    useEffect(() => {
        if (camera && cameraInitialZoom !== null) {
            // Calculer le facteur de zoom basé sur le niveau actuel
            // Chaque niveau ajoute ou retire 20% de zoom
            const zoomFactor = 1 + (currentZoomLevel * 0.2);
            camera.zoom = cameraInitialZoom * zoomFactor;
            camera.updateProjectionMatrix();
        }
    }, [currentZoomLevel, camera, cameraInitialZoom]);

    // Gérer le clic sur le bouton de zoom +
    const handleZoomIn = () => {
        console.log("Zoom in clicked, current level:", currentZoomLevel);
        if (currentZoomLevel < 3) {
            setCurrentZoomLevel(currentZoomLevel + 1);
            // Jouer un son de clic si disponible
            if (audioManager && audioManager.playSound) {
                audioManager.playSound('click');
            }
        }
    };

    // Gérer le clic sur le bouton de zoom -
    const handleZoomOut = () => {
        console.log("Zoom out clicked, current level:", currentZoomLevel);
        if (currentZoomLevel > -3) {
            setCurrentZoomLevel(currentZoomLevel - 1);
            // Jouer un son de clic si disponible
            if (audioManager && audioManager.playSound) {
                audioManager.playSound('click');
            }
        }
    };

    // Gérer le clic sur le bouton de capture
    const handleCaptureClick = () => {
        audioManager.playSound('capture');

        // Réinitialiser le zoom au moment où l'effet de flash commence
        if (camera && cameraInitialZoom !== null && currentZoomLevel !== 0) {
            camera.zoom = cameraInitialZoom;
            camera.updateProjectionMatrix();
            setCurrentZoomLevel(0);
        }

        setIsVisible(false);
        setIsFlashing(true);

        setTimeout(() => {
            setIsFlashing(false);

            if (interaction?.setShowCaptureInterface) {
                interaction.setShowCaptureInterface(false);
            }

            setShowNotification(true);

            setTimeout(() => {
                setShowNotification(false);
            }, 3000);

            if (interaction?.completeInteraction) {
                interaction.completeInteraction();
            }
        }, 1000);
    };

    if (!isVisible && !isFlashing && !showNotification) return null;

    // Calculer la position de l'indicateur de zoom
    const zoomIndicatorPosition = 50 - (currentZoomLevel * 16.7);

    return (
        <>
            {/* Interface de l'appareil photo */}
            {isVisible && (
                <div className="camera-interface">
                    {/* Viewport avec l'image de border */}
                    <div className="camera-viewport">
                        {/* Ajout des éléments de coin inférieurs */}
                        <div className="camera-viewport-corner-bl"></div>
                        <div className="camera-viewport-corner-br"></div>

                        {/* Ajout du cercle de visée au centre */}
                        <div className="camera-viewport-target"></div>
                        <div className="camera-viewport-zoom">
                            {/* Nouvel indicateur de zoom */}
                            <div
                                className="camera-viewport-zoom-indicator"
                                style={{ top: `${zoomIndicatorPosition}%` }}
                            ></div>
                            {/* Bouton de zoom + */}
                            <div
                                className="camera-viewport-zoom-plus"
                                onClick={handleZoomIn}
                            >
                                <div className="camera-viewport-zoom-plus-icon"></div>
                            </div>
                            {/* Bouton de zoom - */}
                            <div
                                className="camera-viewport-zoom-minus"
                                onClick={handleZoomOut}
                            >
                                <div className="camera-viewport-zoom-minus-icon"></div>
                            </div>
                        </div>
                        {/* Bouton de capture repositionné dans le viewport */}
                        <button
                            onClick={handleCaptureClick}
                            className="camera-button"
                        >
                            <span className="camera-objective"></span>
                        </button>
                    </div>
                </div>
            )}

            {/* Effet de flash */}
            {isFlashing && (
                <div className="camera-flash" />
            )}

            {/* Notification */}
            {showNotification && (
                <div className="camera-notification">
                    Photo prise avec succès
                </div>
            )}
        </>
    );
}