import React, {useEffect, useState} from 'react';
import useStore from '../Store/useStore';
import {audioManager} from './AudioManager';
import {EventBus} from '../Utils/EventEmitter'; // Import EventBus

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

    // Function to toggle scene groups visibility
    const toggleSceneGroups = () => {

        // todo: changer la référence direct en reférecence dans le store
        // Apply directly to references if available
        if (window.endGroupRef && window.endGroupRef.current) {
            window.endGroupRef.current.visible = false;
        }

        if (window.screenGroupRef && window.screenGroupRef.current) {
            window.screenGroupRef.current.visible = true;
        }

        // Emit events to notify other components
        EventBus.trigger('end-group-visibility-changed', false);
        EventBus.trigger('screen-group-visibility-changed', true);

        console.log('Scene groups toggled: endGroup=off, screenGroup=on');
    };

    // Gérer le clic sur le bouton de capture
    const handleCaptureClick = () => {
        // Jouer le son de capture
        audioManager.playSound('capture');
        setIsButtonPressed(true);

        // Réinitialiser le zoom
        if (camera && cameraInitialZoom !== null && currentZoomLevel !== 0) {
            camera.zoom = cameraInitialZoom;
            camera.updateProjectionMatrix();
            setCurrentZoomLevel(0);
        }

        // Déclencher la transition audio DIRECTEMENT
        console.log("Starting digital ambience transition from CaptureInterface");

        // Accéder à audioManager de manière sûre
        if (window.audioManager && typeof window.audioManager.playDigitalAmbience === 'function') {
            window.audioManager.playDigitalAmbience(0); // Pas de fondu, changement immédiat
        } else if (audioManager && typeof audioManager.playDigitalAmbience === 'function') {
            audioManager.playDigitalAmbience(0); // Pas de fondu, changement immédiat
        } else {
            console.error("No audioManager available for digital ambience!");

            try {
                const digitalSound = new Howl({
                    src: ['/audios/compos/MoodDigitalLoop.mp3'],
                    loop: true,
                    volume: 2,
                    autoplay: true
                });

                // Stocker globalement pour debug
                window.digitalSound = digitalSound;
            } catch (e) {
                console.error("Failed to create fallback sound:", e);
            }
        }

        setIsVisible(false);
        setIsFlashing(true);
        toggleSceneGroups();

        setTimeout(() => {
            // Reste de la fonction inchangé
            setIsButtonPressed(false);
            setIsFlashing(false);

            window.doJumpToChapter(0.6)
            if (interaction?.setShowCaptureInterface) {
                interaction.setShowCaptureInterface(false);
            }

            if (interaction?.completeInteraction) {
                interaction.completeInteraction();
            }
        }, 6000);
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
                                style={{top: `${zoomIndicatorPosition}%`}}
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
                            className={`camera-interface-capture-button ${isButtonHovered ? 'camera-interface-capture-button-hover' : ''}`}
                        >
                            <div
                                className={`camera-interface-capture-button-inner ${
                                    isButtonPressed ? 'camera-interface-capture-button-inner-pressed' : ''
                                } ${
                                    isButtonHovered
                                        ? 'camera-interface-capture-button-inner-hovered'
                                        : 'camera-interface-capture-button-inner-default'
                                }`}
                                onClick={handleCaptureClick}
                                onMouseDown={() => setIsButtonPressed(true)}
                                onMouseUp={() => setIsButtonPressed(false)}
                                onMouseEnter={() => setIsButtonHovered(true)}
                                onMouseLeave={() => {
                                    setIsButtonHovered(false);
                                    setIsButtonPressed(false);
                                }}
                            >
                                <div
                                    className="camera-interface-capture-button-inner-text"
                                >
                                    Capture
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Effet de flash */}
            {isFlashing && (
                <div className="camera-flash"/>
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