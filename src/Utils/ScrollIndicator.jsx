import React, { useState, useEffect, useRef } from 'react';

const ScrollIndicator = () => {
    const [showIndicator, setShowIndicator] = useState(true); // Visible par défaut
    const [fadeOut, setFadeOut] = useState(false);
    const hasScrolledRef = useRef(false);
    const fadeTimerRef = useRef(null);

    // Seuil minimum de scroll pour déclencher la disparition
    const MIN_SCROLL_THRESHOLD = 1; // pixels de deltaY minimum

    useEffect(() => {
        console.log('🎯 ScrollIndicator: Component mounted - waiting for user scroll');

        // Fonction pour déclencher le fade out
        const triggerFadeOut = () => {
            if (!hasScrolledRef.current) {
                console.log('🎯 ScrollIndicator: User scrolled - triggering fade out');
                hasScrolledRef.current = true;
                setFadeOut(true);

                // Masquer complètement l'indicateur après la transition de 2s
                fadeTimerRef.current = setTimeout(() => {
                    console.log('🎯 ScrollIndicator: Fade out complete, hiding indicator forever');
                    setShowIndicator(false);
                    setFadeOut(false);
                }, 2000);
            }
        };

        // Gestionnaire d'événement de scroll de la souris
        const handleWheelScroll = (event) => {
            // Vérifier que le scroll est vers l'avant (deltaY > 0) et significatif
            const isScrollingForward = event.deltaY > 0;
            const scrollMagnitude = Math.abs(event.deltaY);

            if (isScrollingForward && scrollMagnitude >= MIN_SCROLL_THRESHOLD && !hasScrolledRef.current) {
                console.log('🎯 ScrollIndicator: Forward scroll detected:', {
                    deltaY: event.deltaY,
                    magnitude: scrollMagnitude,
                    threshold: MIN_SCROLL_THRESHOLD,
                    direction: 'forward'
                });

                triggerFadeOut();
            }
        };

        // Gestionnaire d'événement pour les gestes tactiles (mobile/trackpad)
        const handleTouchMove = (event) => {
            if (!hasScrolledRef.current) {
                console.log('🎯 ScrollIndicator: Touch movement detected - triggering fade out');
                triggerFadeOut();
            }
        };

        // Ajouter les écouteurs d'événements
        document.addEventListener('wheel', handleWheelScroll, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });

        console.log('🎯 ScrollIndicator: Listening for user scroll events');

        return () => {
            console.log('🎯 ScrollIndicator: Cleaning up');

            // Nettoyer les écouteurs d'événements
            document.removeEventListener('wheel', handleWheelScroll);
            document.removeEventListener('touchmove', handleTouchMove);

            // Nettoyer le timer
            if (fadeTimerRef.current) {
                clearTimeout(fadeTimerRef.current);
            }
        };
    }, []);

    // Ne pas rendre si l'indicateur ne doit pas être affiché
    if (!showIndicator) {
        return null;
    }

    return (
        <div
            className="scrollToStart"
            style={{
                opacity: fadeOut ? 0 : 1,
                transition: 'opacity 2s ease-out',
            }}
        >
            <svg width="16" height="40" viewBox="0 0 16 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.66671 30.6667L8.00004 34L11.3334 30.6667" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.16211 0.00976562C12.2151 0.21542 15.4383 3.56688 15.4385 7.6709V16.4385L15.4277 16.833C15.2223 20.8863 11.8709 24.1094 7.7666 24.1094L7.37207 24.0996C3.44966 23.9006 0.304238 20.7555 0.105469 16.833L0.0957031 16.4385V7.6709C0.0958794 3.43451 3.53024 0.000272417 7.7666 0L8.16211 0.00976562ZM7.7666 2C4.6348 2.00027 2.09588 4.53908 2.0957 7.6709V16.4385C2.09577 19.5704 4.63474 22.1091 7.7666 22.1094C10.8987 22.1094 13.4384 19.5706 13.4385 16.4385V7.6709C13.4383 4.53892 10.8986 2 7.7666 2ZM7.76758 4.38379C8.37261 4.38404 8.86328 4.87441 8.86328 5.47949V7.6709C8.86328 8.27598 8.37261 8.76635 7.76758 8.7666C7.16233 8.7666 6.6709 8.27614 6.6709 7.6709V5.47949C6.6709 4.87425 7.16233 4.38379 7.76758 4.38379Z" fill="#F9F9F9"/>
            </svg>
            <p>Scroll pour débuter ta mission</p>
        </div>
    );
};

export default ScrollIndicator;