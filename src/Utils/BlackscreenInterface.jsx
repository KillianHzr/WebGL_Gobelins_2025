import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';
import { audioManager } from './AudioManager';
import {EventBus} from "./EventEmitter.jsx";

export default function BlackscreenInterface() {
    const [isVisible, setIsVisible] = useState(false);

    // Récupérer les données nécessaires du store
    const interaction = useStore(state => state.interaction);
    // Récupérer la fonction triggerEnding du store
    const triggerEnding = useStore(state => state.triggerEnding);

    // Surveiller les changements d'état pour savoir quand afficher l'interface
    useEffect(() => {
        if (interaction?.showBlackscreenInterface) {
            console.log("Blackscreen interface triggered - showing black screen");
            setIsVisible(true);

            // Jouer un son si nécessaire
            if (audioManager && audioManager.playSound) {
                audioManager.playSound('blackscreen');
            }

            // Créer un timer pour l'écran noir puis déclencher l'ending
            const timer = setTimeout(() => {
                console.log("Blackscreen completed, triggering ending landing");

                // Cacher l'interface écran noir
                setIsVisible(false);

                // Désactiver l'affichage dans le store
                if (interaction?.setShowBlackscreenInterface) {
                    interaction.setShowBlackscreenInterface(false);
                }

                // Compléter l'interaction
                if (interaction?.completeInteraction) {
                    interaction.completeInteraction();
                }

                // Déclencher l'écran de fin (ending landing)
                if (triggerEnding) {
                    console.log("Triggering ending landing from BlackscreenInterface");
                    triggerEnding();
                } else {
                    console.error("triggerEnding function not available in store");
                }
            }, 2000); // Écran noir pendant 2 secondes

            // Nettoyage du timer si le composant est démonté avant la fin du délai
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [interaction?.showBlackscreenInterface, interaction, triggerEnding]);

    useEffect(() => {
        const handleCaptureComplete = () => {
            console.log("Capture interface completed, transitioning to digital ambience");

            // Transition vers l'ambiance digitale
            if (window.audioManager && typeof window.audioManager.playDigitalAmbience === 'function') {
                window.audioManager.playDigitalAmbience(3000); // Fondu sur 3 secondes
            } else if (window.parent && window.parent.audioManager &&
                typeof window.parent.audioManager.playDigitalAmbience === 'function') {
                window.parent.audioManager.playDigitalAmbience(3000);
            }
        };

        // S'abonner à l'événement de complétion de l'interface de capture
        const subscription = EventBus.on('interface-action', (data) => {
            if (data.type === 'capture' && data.action === 'close' && data.result === 'complete') {
                handleCaptureComplete();
            }
        });

        return () => {
            subscription();
        };
    }, []);

    // Ne rien rendre si l'interface n'est pas visible
    if (!isVisible) return null;

    return (
        <>
            {/* Interface voile noir */}
            <div className="blackscreen"> </div>
        </>
    );
}