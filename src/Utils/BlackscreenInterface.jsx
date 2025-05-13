import React, { useEffect, useState } from 'react';
import useStore from '../Store/useStore';
import { audioManager } from './AudioManager';

export default function BlackscreenInterface() {
    const [isVisible, setIsVisible] = useState(false);

    // Récupérer les données nécessaires du store
    const interaction = useStore(state => state.interaction);
    // Récupérer la fonction triggerEnding du store
    const triggerEnding = useStore(state => state.triggerEnding);

    // Surveiller les changements d'état pour savoir quand afficher l'interface
    useEffect(() => {
        if (interaction?.showBlackscreenInterface) {
            setIsVisible(true);

            // Jouer un son si nécessaire
            if (audioManager && audioManager.playSound) {
                audioManager.playSound('blackscreen');
            }

            // Créer un timer pour valider automatiquement l'interaction après 2000ms
            const timer = setTimeout(() => {
                console.log("Blackscreen interaction completed automatically after 2000ms");

                // Cacher l'interface
                setIsVisible(false);

                // Désactiver l'affichage dans le store
                if (interaction?.setShowBlackscreenInterface) {
                    interaction.setShowBlackscreenInterface(false);
                }

                // Compléter l'interaction
                if (interaction?.completeInteraction) {
                    interaction.completeInteraction();
                }

                // Déclencher l'écran de fin (ending landing) puisque c'est la fin de l'expérience
                if (triggerEnding) {
                    console.log("Triggering ending landing from BlackscreenInterface");
                    triggerEnding();
                }
            }, 500);

            // Nettoyage du timer si le composant est démonté avant la fin du délai
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [interaction?.showBlackscreenInterface, interaction, triggerEnding]);

    // Ne rien rendre si l'interface n'est pas visible
    if (!isVisible) return null;

    return (
        <>
            {/* Interface voile noir */}
            <div className="blackscreen"> </div>
        </>
    );
}