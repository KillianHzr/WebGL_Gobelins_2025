import React, { useEffect, useState, useRef } from 'react';
import useStore from '../Store/useStore';
import { EventBus } from './EventEmitter';
import { audioManager } from './AudioManager';

export default function ImageInterface() {
    const [isVisible, setIsVisible] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const [imageSource, setImageSource] = useState('/images/Panneau_Info.png'); // Default image
    const [isLoading, setIsLoading] = useState(false); // Pour gérer le délai d'ouverture
    const [showButton, setShowButton] = useState(false); // Nouveau état pour contrôler l'affichage du bouton
    const [expectedNarrationId, setExpectedNarrationId] = useState(null); // Pour suivre quelle narration on attend

    const interaction = useStore(state => state.interaction);
    const holdTimerRef = useRef(null);
    const holdStartTimeRef = useRef(null);
    const openTimeoutRef = useRef(null); // Référence pour le timeout d'ouverture
    const narrationListenerRef = useRef(null); // Référence pour l'écouteur de narration
    const holdDuration = 2000; // 2 seconds hold time

    // Monitor state changes to determine when to display the interface
    useEffect(() => {
        if (interaction?.showImageInterface) {
            // Si une image source est fournie, la sauvegarder
            if (interaction.imageInterfaceSource) {
                setImageSource(interaction.imageInterfaceSource);
            }

            // Déterminer quelle narration nous attendons basée sur l'image
            let expectedNarration = null;
            if (interaction.imageInterfaceSource && interaction.imageInterfaceSource.includes('Panneau_Info')) {
                expectedNarration = 'Scene02_PanneauInformation';
            }
            // Ajouter d'autres correspondances si nécessaire - vous pouvez étendre cette logique

            console.log('ImageInterface: Expected narration for this interface:', expectedNarration);
            setExpectedNarrationId(expectedNarration);

            // Commencer le délai de chargement
            setIsLoading(true);
            setShowButton(false); // S'assurer que le bouton est caché initialement

            // Définir un timeout de 2 secondes avant d'afficher l'interface
            openTimeoutRef.current = setTimeout(() => {
                setIsVisible(true);
                setIsLoading(false);

                // IMPORTANT: Ne JAMAIS afficher le bouton immédiatement
                // Le bouton ne s'affichera qu'après l'événement narration-ended
                console.log('ImageInterface: Interface visible, waiting for narration to end before showing button');
            }, 2000);
        } else {
            // Annuler le timeout si l'interface est cachée
            if (openTimeoutRef.current) {
                clearTimeout(openTimeoutRef.current);
                openTimeoutRef.current = null;
            }

            setIsVisible(false);
            setIsLoading(false);
            setShowButton(false);
            setExpectedNarrationId(null);

            // Clean up holding state if we hide the interface
            if (isHolding) {
                stopHolding();
            }
        }
    }, [interaction?.showImageInterface, interaction?.imageInterfaceSource]);

    // Écouter les événements de fin de narration
    useEffect(() => {
        let fallbackTimeoutRef = null;

        const handleNarrationEnded = (data) => {
            console.log('ImageInterface: Narration ended event received:', data);

            // Si c'est la narration que nous attendions, afficher le bouton
            if (expectedNarrationId && data && data.narrationId === expectedNarrationId) {
                console.log(`ImageInterface: Expected narration ${expectedNarrationId} ended, showing button`);
                setShowButton(true);

                // Nettoyer le timeout de fallback car la narration s'est terminée normalement
                if (fallbackTimeoutRef) {
                    clearTimeout(fallbackTimeoutRef);
                    fallbackTimeoutRef = null;
                }
            }
            // Si aucune narration spécifique n'est attendue, afficher le bouton pour toute narration qui se termine
            else if (!expectedNarrationId && data && data.narrationId) {
                console.log(`ImageInterface: No specific narration expected, showing button after any narration (${data.narrationId})`);
                setShowButton(true);

                if (fallbackTimeoutRef) {
                    clearTimeout(fallbackTimeoutRef);
                    fallbackTimeoutRef = null;
                }
            }
        };

        // S'abonner à l'événement de fin de narration
        narrationListenerRef.current = EventBus.on('narration-ended', handleNarrationEnded);

        // Mécanisme de fallback : afficher le bouton après 15 secondes maximum
        // au cas où l'événement de narration ne serait pas reçu
        if (isVisible) {
            fallbackTimeoutRef = setTimeout(() => {
                console.log('ImageInterface: Fallback timeout reached, showing button anyway');
                setShowButton(true);
            }, 400); // 15 secondes de délai maximum
        }

        return () => {
            // Nettoyer l'écouteur lors du démontage
            if (narrationListenerRef.current && typeof narrationListenerRef.current === 'function') {
                narrationListenerRef.current();
            }

            // Nettoyer le timeout de fallback
            if (fallbackTimeoutRef) {
                clearTimeout(fallbackTimeoutRef);
            }
        };
    }, [expectedNarrationId, isVisible]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (holdTimerRef.current) {
                clearInterval(holdTimerRef.current);
            }
            if (openTimeoutRef.current) {
                clearTimeout(openTimeoutRef.current);
            }
            if (narrationListenerRef.current && typeof narrationListenerRef.current === 'function') {
                narrationListenerRef.current();
            }
        };
    }, []);

    // Start the holding process
    const startHolding = () => {
        // Play sound effect
        if (audioManager) {
            audioManager.playSound('click', { volume: 0.5 });
        }

        setIsHolding(true);
        setHoldProgress(0);
        holdStartTimeRef.current = Date.now();

        // Create interval to update progress
        holdTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - holdStartTimeRef.current;
            const progress = Math.min((elapsed / holdDuration) * 100, 100);
            setHoldProgress(progress);

            if (progress >= 100) {
                completeHolding();
            }
        }, 50);
    };

    // Stop the holding process without completing
    const stopHolding = () => {
        if (holdTimerRef.current) {
            clearInterval(holdTimerRef.current);
            holdTimerRef.current = null;
        }

        setIsHolding(false);
        setHoldProgress(0);

        // Emit an event to indicate that the hold was canceled
        EventBus.trigger('interface-action', {
            type: 'image',
            action: 'cancel',
            result: 'incomplete'
        });
    };

    // Complete the holding process successfully
    const completeHolding = () => {
        if (holdTimerRef.current) {
            clearInterval(holdTimerRef.current);
            holdTimerRef.current = null;
        }

        setIsHolding(false);
        setHoldProgress(0);

        // Play completion sound
        if (audioManager) {
            audioManager.playSound('click', { volume: 0.8 });
        }

        setIsVisible(false);
        setShowButton(false);

        if (interaction?.setShowImageInterface) {
            interaction.setShowImageInterface(false);
        }

        // Emit an event to indicate that the interface has been closed
        EventBus.trigger('interface-action', {
            type: 'image',
            action: 'close',
            result: 'complete'
        });

        if (interaction?.completeInteraction) {
            interaction.completeInteraction();

            // Jump to next chapter if doJumpToChapter is available
            if (window.doJumpToChapter) {
                window.doJumpToChapter(0.01);
            }
        }
    };

    // Calculate progress circle size and style - similaire au Scanner
    const getProgressStyle = () => {
        if (!isHolding) {
            return {
                width: '72px',
                height: '72px'
            };
        }

        // Base size without progress - same as Scanner
        const baseSize = 72;
        const maxGrowth = 16;
        const progressGrowth = (holdProgress / 100) * maxGrowth;

        return {
            width: `${baseSize + progressGrowth}px`,
            height: `${baseSize + progressGrowth}px`,
            borderColor: '#F9FEFF'
        };
    };

    if (!isVisible && !isLoading) return null;

    return (
        <div className="image-interface">
            {isLoading ? (
                // Afficher un indicateur de chargement
                <div className="loading-indicator">
                    <div className="loading-spinner"></div>
                </div>
            ) : (
                <>
                    <div className="image-container">
                        <img src={imageSource} alt="Information" />
                    </div>

                    {/* Fixed hold button at bottom of screen - only show when narration is done */}
                    {showButton && (
                        <div
                            className="image-interface-hold-button image-interface-hold-button-fixed"
                            onMouseDown={startHolding}
                            onMouseUp={stopHolding}
                            onMouseLeave={stopHolding}
                        >
                            <div
                                className={`image-interface-hold-button-inner ${
                                    isHolding
                                        ? 'image-interface-hold-button-inner-active'
                                        : 'image-interface-hold-button-inner-default'
                                }`}
                            >
                                <div className="image-interface-hold-button-inner-text">
                                    Maintiens
                                </div>
                                <div
                                    className="image-interface-hold-button-inner-progress"
                                    style={getProgressStyle()}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}