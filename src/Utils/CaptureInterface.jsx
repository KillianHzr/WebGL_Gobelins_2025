import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';
import { audioManager } from './AudioManager';

export default function CaptureInterface() {
    const [isVisible, setIsVisible] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [isButtonHovered, setIsButtonHovered] = useState(false);
    const [isButtonPressed, setIsButtonPressed] = useState(false);

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
        setIsButtonPressed(true);

        // Réinitialiser le zoom au moment où l'effet de flash commence
        if (camera && cameraInitialZoom !== null && currentZoomLevel !== 0) {
            camera.zoom = cameraInitialZoom;
            camera.updateProjectionMatrix();
            setCurrentZoomLevel(0);
        }

        setIsVisible(false);
        setIsFlashing(true);

        setTimeout(() => {
            setIsButtonPressed(false);
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
                        <div
                            style={{
                                position: 'absolute',
                                width: '88px',
                                height: '88px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                flexShrink: 0,
                                aspectRatio: 1,
                                borderRadius: '999px',
                                border: '1.5px solid #F9FEFF',
                                pointerEvents: 'auto',
                                bottom: '-44px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                boxShadow: isButtonHovered ? '0px 0px 12px 6px rgba(255, 255, 255, 0.60)' : '0px 0px 8px 4px rgba(255, 255, 255, 0.50)',
                                backdropFilter: 'blur(2px)',
                                transition: 'box-shadow 0.3s ease, transform 0.15s ease',
                            }}
                        >
                            <div
                                onClick={handleCaptureClick}
                                onMouseDown={() => setIsButtonPressed(true)}
                                onMouseUp={() => setIsButtonPressed(false)}
                                onMouseEnter={() => setIsButtonHovered(true)}
                                onMouseLeave={() => {
                                    setIsButtonHovered(false);
                                    setIsButtonPressed(false);
                                }}
                                style={{
                                    position: 'absolute',
                                    width: '88px',
                                    height: '88px',
                                    display: 'flex',
                                    padding: '8px',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px',
                                    flexShrink: 0,
                                    aspectRatio: 1,
                                    borderRadius: '999px',
                                    border: '1.5px solid #F9FEFF',
                                    background: isButtonPressed
                                        ? 'rgba(249, 254, 255, 0.70)'
                                        : isButtonHovered
                                            ? 'rgba(249, 254, 255, 0.60)'
                                            : 'rgba(249, 254, 255, 0.50)',
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                    transform: isButtonPressed ? 'scale(0.95)' : 'scale(1)',
                                    transition: 'background 0.3s ease, transform 0.15s ease',
                                }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        maxWidth: '56px',
                                        height: '100%',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        color: '#F9FEFF',
                                        textAlign: 'center',
                                        fontFamily: 'Albert Sans',
                                        fontSize: '12px',
                                        fontStyle: 'normal',
                                        fontWeight: 600,
                                        lineHeight: 'normal',
                                        textShadow: isButtonHovered ? '0px 0px 4px rgba(255, 255, 255, 0.6)' : 'none',
                                        transition: 'text-shadow 0.3s ease',
                                    }}
                                >
                                    Prend la photo
                                </div>
                            </div>
                        </div>
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