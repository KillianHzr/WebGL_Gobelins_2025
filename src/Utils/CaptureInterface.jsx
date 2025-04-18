import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';
import { audioManager } from './AudioManager';

export default function CaptureInterface() {
    const [isVisible, setIsVisible] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const interaction = useStore(state => state.interaction);

    // Surveiller les changements d'état pour savoir quand afficher l'interface
    useEffect(() => {
        if (interaction?.showCaptureInterface) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [interaction?.showCaptureInterface]);

    // Gérer le clic sur le bouton de capture
    const handleCaptureClick = () => {
        audioManager.playSound('capture');

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
                            <div className="camera-viewport-zoom-plus"></div>
                            <div className="camera-viewport-zoom-minus"></div>
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