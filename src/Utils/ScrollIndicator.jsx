import React, { useState, useEffect, useRef } from 'react';
import { EventBus } from './EventEmitter';

const ScrollIndicator = () => {
    const [showIndicator, setShowIndicator] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    const hasScrolledAfterMission = useRef(false);
    const missionNarrationStarted = useRef(false);
    const indicatorShown = useRef(false);
    const timerRef = useRef(null);
    const fadeTimerRef = useRef(null);
    const lastScrollPosition = useRef(0);

    useEffect(() => {
        console.log('ScrollIndicator: Component mounted and listening for events');

        // Fonction pour déclencher le fade out
        const triggerFadeOut = () => {
            if (!hasScrolledAfterMission.current) {
                console.log('ScrollIndicator: Triggering fade out transition');
                hasScrolledAfterMission.current = true;
                setFadeOut(true);

                // Nettoyer le timer d'apparition s'il est encore actif
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }

                // Masquer complètement l'indicateur après la transition de 2s
                fadeTimerRef.current = setTimeout(() => {
                    console.log('ScrollIndicator: Fade out complete, hiding indicator');
                    setShowIndicator(false);
                    setFadeOut(false);
                }, 2000);
            }
        };

        // Écouter le début de la narration Scene01_Mission
        const handleNarrationStarted = (data) => {
            console.log('ScrollIndicator: Narration started event received:', data);

            if (data && data.narrationId === 'Scene01_Mission') {
                console.log('ScrollIndicator: Scene01_Mission narration started, setting timer for 2s');
                missionNarrationStarted.current = true;

                // Démarrer le timer de 2 secondes
                timerRef.current = setTimeout(() => {
                    // Vérifier que l'utilisateur n'a pas encore scrollé
                    if (!hasScrolledAfterMission.current && !indicatorShown.current) {
                        console.log('ScrollIndicator: Showing scroll indicator after 2s delay');
                        setShowIndicator(true);
                        indicatorShown.current = true;
                    } else {
                        console.log('ScrollIndicator: Not showing indicator - already scrolled or shown:', {
                            hasScrolled: hasScrolledAfterMission.current,
                            alreadyShown: indicatorShown.current
                        });
                    }
                }, 2000);
            }
        };

        // Écouter les changements de position de timeline pour détecter le scroll
        const handleTimelinePosition = (data) => {
            if (!missionNarrationStarted.current) return;

            const currentPosition = data.rawPosition || data.position || 0;

            // Détecter si l'utilisateur a scrollé (changement de position)
            if (Math.abs(currentPosition - lastScrollPosition.current) > 0.1) {
                triggerFadeOut();
            }

            lastScrollPosition.current = currentPosition;
        };

        // Écouter également les événements de scroll direct (pour plus de robustesse)
        const handleScrollEvent = () => {
            if (missionNarrationStarted.current) {
                console.log('ScrollIndicator: Direct scroll event detected, triggering fade out');
                triggerFadeOut();
            }
        };

        // S'abonner aux événements
        const narrationStartedSub = EventBus.on('narration-started', handleNarrationStarted);
        const timelinePositionSub = EventBus.on('timeline-position-normalized', handleTimelinePosition);

        console.log('ScrollIndicator: Event listeners set up');

        // Écouter les événements de scroll sur le canvas également
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.addEventListener('wheel', handleScrollEvent, { passive: true });
            canvas.addEventListener('touchmove', handleScrollEvent, { passive: true });
            console.log('ScrollIndicator: Canvas scroll listeners added');
        } else {
            console.log('ScrollIndicator: Canvas not found, scroll listeners not added');
        }

        return () => {
            console.log('ScrollIndicator: Cleaning up component');

            // Nettoyer les abonnements
            narrationStartedSub();
            timelinePositionSub();

            // Nettoyer les timers
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            if (fadeTimerRef.current) {
                clearTimeout(fadeTimerRef.current);
            }

            // Nettoyer les event listeners du canvas
            if (canvas) {
                canvas.removeEventListener('wheel', handleScrollEvent);
                canvas.removeEventListener('touchmove', handleScrollEvent);
            }
        };
    }, []); // RETIRER les dépendances problématiques

    // Log when showIndicator changes
    useEffect(() => {
        console.log('ScrollIndicator: showIndicator changed to:', showIndicator);
    }, [showIndicator]);

    // Log when fadeOut changes
    useEffect(() => {
        console.log('ScrollIndicator: fadeOut changed to:', fadeOut);
    }, [fadeOut]);

    // Ne pas rendre si l'indicateur ne doit pas être affiché
    if (!showIndicator) {
        return null;
    }

    console.log('ScrollIndicator: Rendering scroll indicator');

    return (
        <div
            className="scrollToStart"
            style={{
                opacity: fadeOut ? 0 : 1,
                transition: 'opacity 2s ease-out'
            }}
        >
            <svg width="16" height="40" viewBox="0 0 16 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.66671 30.6667L8.00004 34L11.3334 30.6667" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.16211 0.00976562C12.2151 0.21542 15.4383 3.56688 15.4385 7.6709V16.4385L15.4277 16.833C15.2223 20.8863 11.8709 24.1094 7.7666 24.1094L7.37207 24.0996C3.44966 23.9006 0.304238 20.7555 0.105469 16.833L0.0957031 16.4385V7.6709C0.0958794 3.43451 3.53024 0.000272417 7.7666 0L8.16211 0.00976562ZM7.7666 2C4.6348 2.00027 2.09588 4.53908 2.0957 7.6709V16.4385C2.09577 19.5704 4.63474 22.1091 7.7666 22.1094C10.8987 22.1094 13.4384 19.5706 13.4385 16.4385V7.6709C13.4383 4.53892 10.8986 2 7.7666 2ZM7.76758 4.38379C8.37261 4.38404 8.86328 4.87441 8.86328 5.47949V7.6709C8.86328 8.27598 8.37261 8.76635 7.76758 8.7666C7.16233 8.7666 6.6709 8.27614 6.6709 7.6709V5.47949C6.6709 4.87425 7.16233 4.38379 7.76758 4.38379Z" fill="#F9F9F9"/>
            </svg>
        </div>
    );
};

export default ScrollIndicator;