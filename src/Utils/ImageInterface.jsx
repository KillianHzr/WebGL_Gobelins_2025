import React, { useEffect, useState, useRef } from 'react';
import useStore from '../Store/useStore';
import { EventBus } from './EventEmitter';
import { audioManager } from './AudioManager';

export default function ImageInterface() {
    const [isVisible, setIsVisible] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [imageSource, setImageSource] = useState('/images/Panneau_Info.png'); // Default image
    const [isLoading, setIsLoading] = useState(false); // Pour gérer le délai d'ouverture
    const interaction = useStore(state => state.interaction);
    const holdTimerRef = useRef(null);
    const holdStartTimeRef = useRef(null);
    const openTimeoutRef = useRef(null); // Référence pour le timeout d'ouverture
    const holdDuration = 2000; // 2 seconds hold time

    // Monitor state changes to determine when to display the interface
    useEffect(() => {
        if (interaction?.showImageInterface) {
            // Si une image source est fournie, la sauvegarder
            if (interaction.imageInterfaceSource) {
                setImageSource(interaction.imageInterfaceSource);
            }

            // Commencer le délai de chargement
            setIsLoading(true);

            // Définir un timeout de 2 secondes avant d'afficher l'interface
            openTimeoutRef.current = setTimeout(() => {
                setIsVisible(true);
                setIsLoading(false);
            }, 2000);
        } else {
            // Annuler le timeout si l'interface est cachée
            if (openTimeoutRef.current) {
                clearTimeout(openTimeoutRef.current);
                openTimeoutRef.current = null;
            }

            setIsVisible(false);
            setIsLoading(false);

            // Clean up holding state if we hide the interface
            if (isHolding) {
                stopHolding();
            }
        }
    }, [interaction?.showImageInterface, interaction?.imageInterfaceSource]);

    // Track mouse movement
    useEffect(() => {
        if (!isVisible) return;

        const handleMouseMove = (e) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isVisible]);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (holdTimerRef.current) {
                clearInterval(holdTimerRef.current);
            }
            if (openTimeoutRef.current) {
                clearTimeout(openTimeoutRef.current);
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

    // Calculate button position following cursor
    const getButtonStyle = () => {
        return {
            left: `${mousePosition.x}px`,
            top: `${mousePosition.y}px`,
        };
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
        <div
            className="image-interface"
            onMouseDown={startHolding}
            onMouseUp={stopHolding}
            onMouseLeave={stopHolding}
        >
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

                    {/* Follow cursor hold button */}
                    <div
                        className="image-interface-hold-button"
                        style={getButtonStyle()}
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
                </>
            )}
        </div>
    );
}