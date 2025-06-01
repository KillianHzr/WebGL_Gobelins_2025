import React, { useState, useEffect, useCallback, useRef } from 'react';
import WebGLLoadingManager from './WebGLLoadingManager';
import DesktopLanding from './DesktopLanding';
import useStore from '../Store/useStore';

/**
 * LoadingScreen component - Version améliorée avec WebGLLoadingManager
 * Affiche une barre de progression fiable et des transitions fluides
 */
const LoadingScreen = ({ onComplete }) => {
    const { debug } = useStore();
    const [loadingComplete, setLoadingComplete] = useState(false);
    const [loadingFadeOut, setLoadingFadeOut] = useState(false);
    const [showLanding, setShowLanding] = useState(!debug?.skipIntro);
    const [landingEnabled, setLandingEnabled] = useState(false);
    const [blackScreenTransition, setBlackScreenTransition] = useState(false);
    const [displayProgress, setDisplayProgress] = useState(0);
    const [currentPhase, setCurrentPhase] = useState('Initialisation...');
    const animationFrameRef = useRef(null);

    // Messages de chargement selon la phase
    const getPhaseMessage = (phase, progress) => {
        if (progress < 10) return "Initialisation du moteur 3D...";
        if (progress < 40) return "Chargement des modèles 3D...";
        if (progress < 60) return "Application des textures...";
        if (progress < 80) return "Construction de la scène...";
        if (progress < 90) return "Compilation des shaders...";
        if (progress < 100) return "Finalisation du rendu...";
        return "Localisation du vison...";
    };

    // Si on doit sauter l'intro, on appelle onComplete immédiatement
    useEffect(() => {
        if (debug?.skipIntro && onComplete) {
            console.log("Debug mode: skipping intro and loading screen");
            onComplete();
        }
    }, [debug, onComplete]);

    // Callback pour quand le chargement WebGL est terminé
    const handleLoadingComplete = useCallback(() => {
        if (debug?.skipIntro) {
            console.log("Loading complete, skipping landing page due to debug mode");
            if (onComplete) onComplete();
            return;
        }

        console.log("WebGL loading complete, transitioning to landing page");

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        setDisplayProgress(100);
        setCurrentPhase("Chargement terminé");
        setLoadingFadeOut(true);

        setTimeout(() => {
            setLandingEnabled(true);
            setLoadingComplete(true);
        }, 1000);
    }, [debug, onComplete]);

    const handleEnterExperience = useCallback(() => {
        console.log("Entering experience - starting transition");
        setBlackScreenTransition(true);

        setTimeout(() => {
            if (onComplete) onComplete();
        }, 400);
    }, [onComplete]);

    // Utiliser le nouveau WebGLLoadingManager
    const { progress, phase, detailed, isComplete } = WebGLLoadingManager({
        onComplete: handleLoadingComplete
    });

    // Animation fluide du progress bar
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

    // Mettre à jour le message de phase
    useEffect(() => {
        const message = getPhaseMessage(phase, displayProgress);
        setCurrentPhase(message);
    }, [phase, displayProgress]);

    // Debug logging
    useEffect(() => {
        if (debug?.active) {
            console.log(`Loading: ${Math.round(displayProgress)}% - ${currentPhase}`);
            if (detailed) {
                console.log('Detailed progress:', detailed);
            }
        }
    }, [displayProgress, currentPhase, detailed, debug]);

    // Format du pourcentage affiché
    const formattedPercentage = Math.round(displayProgress);

    // Si on est en mode debug avec skipIntro, ne rien afficher
    if (debug?.skipIntro) {
        return null;
    }

    return (
        <>
            {/* Desktop landing page - toujours rendu derrière le loading */}
            {showLanding && (
                <DesktopLanding
                    onEnterExperience={handleEnterExperience}
                    enabled={landingEnabled}
                />
            )}

            {/* Écran de chargement avec barre de progression WebGL */}
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

                        <div className="loading-percentage">
                            {currentPhase}
                        </div>

                        {/* Informations détaillées pour le debug */}
                        {debug?.active && detailed && (
                            <div className="loading-debug" style={{
                                position: 'absolute',
                                bottom: '20px',
                                left: '20px',
                                fontSize: '12px',
                                color: '#666',
                                fontFamily: 'monospace'
                            }}>
                                <div>Assets: {Math.round(detailed.assets)}%</div>
                                <div>Textures: {Math.round(detailed.textures)}%</div>
                                <div>Scène: {Math.round(detailed.scene)}%</div>
                                <div>Shaders: {Math.round(detailed.shaders)}%</div>
                                {window.renderer && (
                                    <>
                                        <div>Triangles: {window.renderer.info.render.triangles}</div>
                                        <div>Draw calls: {window.renderer.info.render.calls}</div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Transition écran noir */}
            {blackScreenTransition && (
                <div className="black-screen-transition"></div>
            )}
        </>
    );
};

export default LoadingScreen;