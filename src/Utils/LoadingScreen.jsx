import React, { useState, useEffect, useCallback, useRef } from 'react';
import LoadingManager from './LoadingManager';
import DesktopLanding from './DesktopLanding';
import useStore from '../Store/useStore';

/**
 * LoadingScreen component
 * Displays a loading progress bar and transitions to landing page when complete
 */
const LoadingScreen = ({ onComplete }) => {
    const { debug } = useStore();  // Récupérer l'état debug du store
    const [loadingComplete, setLoadingComplete] = useState(false);
    const [loadingFadeOut, setLoadingFadeOut] = useState(false);
    const [showLanding, setShowLanding] = useState(!debug?.skipIntro); // Condition basée sur skipIntro
    const [landingEnabled, setLandingEnabled] = useState(false);
    const [blackScreenTransition, setBlackScreenTransition] = useState(false);
    const [displayProgress, setDisplayProgress] = useState(0);
    const animationFrameRef = useRef(null);

    // Si on doit sauter l'intro, on appelle onComplete immédiatement
    useEffect(() => {
        if (debug?.skipIntro && onComplete) {
            console.log("Debug mode: skipping intro and loading screen");
            onComplete();
        }
    }, [debug, onComplete]);

    // Callback pour quand le chargement est terminé
    const handleLoadingComplete = useCallback(() => {
        if (debug?.skipIntro) {
            // Si on doit sauter l'intro, ne pas afficher l'écran de chargement
            console.log("Loading complete, skipping landing page due to debug mode");
            if (onComplete) onComplete();
            return;
        }

        console.log("Loading complete, transitioning to landing page");

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        setDisplayProgress(100);
        setLoadingFadeOut(true);

        setTimeout(() => {
            setLandingEnabled(true);
            setLoadingComplete(true);
        }, 1000);
    }, [debug, onComplete]);

    const handleEnterExperience = useCallback(() => {
        console.log("Entering experience - starting first fade to black");
        setBlackScreenTransition(true);

        setTimeout(() => {
            if (onComplete) onComplete();
        }, 400);
    }, [onComplete]);

    // Get loading progress from the LoadingManager
    const { progress } = LoadingManager({
        onComplete: handleLoadingComplete
    });

    // Smoothly animate the progress bar for better visual feedback
    useEffect(() => {
        if (progress > displayProgress) {
            const animateProgress = () => {
                setDisplayProgress(prev => {
                    const gap = progress - prev;
                    const increment = Math.max(0.5, Math.min(2, gap / 10));
                    const next = Math.min(progress, prev + increment);

                    if (next < progress) {
                        animationFrameRef.current = requestAnimationFrame(animateProgress);
                    }

                    return next;
                });
            };

            animationFrameRef.current = requestAnimationFrame(animateProgress);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [progress, displayProgress]);

    useEffect(() => {
        console.log(`Loading screen - Actual progress: ${progress}%, Displayed: ${Math.round(displayProgress)}%`);
    }, [progress, displayProgress]);

    // Additional progress event listeners to catch any missed events
    useEffect(() => {
        const handleForestReady = () => {
            console.log("Loading screen caught forest-ready event");
            if (!loadingComplete) {
                handleLoadingComplete();
            }
        };

        // Listen for forest ready event directly
        const forestReadyUnsubscribe = window.EventBus?.on('forest-ready', handleForestReady);
        const forestSceneReadyUnsubscribe = window.EventBus?.on('forest-scene-ready', handleForestReady);

        // Check logs for "Forest est prête" periodically
        const checkInterval = setInterval(() => {
            if (!loadingComplete && console.logs && console.logs.join(' ').includes("Forest est prête")) {
                console.log("Loading screen detected 'Forest est prête' in logs");
                handleLoadingComplete();
            }
        }, 1000);

        return () => {
            if (forestReadyUnsubscribe) forestReadyUnsubscribe();
            if (forestSceneReadyUnsubscribe) forestSceneReadyUnsubscribe();
            clearInterval(checkInterval);
        };
    }, [loadingComplete, handleLoadingComplete]);

    // Format the displayed percentage
    const formattedPercentage = Math.round(displayProgress);

    // Si on est en mode debug avec skipIntro, ne rien afficher
    if (debug?.skipIntro) {
        return null;
    }

    return (
        <>
            {/* Desktop landing page - always rendered behind loading */}
            {showLanding && (
                <DesktopLanding
                    onEnterExperience={handleEnterExperience}
                    enabled={landingEnabled}
                />
            )}

            {/* Loading progress bar */}
            {!loadingComplete && (
                <div className={`loading-screen ${loadingFadeOut ? 'fade-out' : ''}`}>
                    <div className="loading-content">
                        <div className="loading-logo">
                            <img src="/images/loader.gif" alt="Gobelins Logo" />
                        </div>
                        <div className="loading-progress-container">
                            <div
                                className="loading-progress-bar"
                                style={{ width: `${formattedPercentage}%` }}
                            ></div>
                        </div>
                        <div className="loading-percentage">{formattedPercentage}%</div>
                    </div>
                </div>
            )}

            {/* Black screen transition */}
            {blackScreenTransition && (
                <div className="black-screen-transition"></div>
            )}
        </>
    );
};

export default LoadingScreen;