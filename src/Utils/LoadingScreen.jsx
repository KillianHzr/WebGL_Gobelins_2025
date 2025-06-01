import React, { useState, useEffect, useCallback, useRef } from 'react';
import WebGLLoadingManager from './WebGLLoadingManager';
import DesktopLanding from './DesktopLanding';
import useStore from '../Store/useStore';

/**
 * LoadingScreen component - Version améliorée avec progression détaillée de la forêt
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
    const [forestPhase, setForestPhase] = useState('');
    const animationFrameRef = useRef(null);

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
        setForestPhase("Forêt complètement chargée!");
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

    // Utiliser le nouveau WebGLLoadingManager avec progression forestière
    const { progress, phase, forestPhase: currentForestPhase, detailed, isComplete } = WebGLLoadingManager({
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

    // Mettre à jour les phases affichées
    useEffect(() => {
        setCurrentPhase(phase);
    }, [phase]);

    useEffect(() => {
        if (currentForestPhase) {
            setForestPhase(currentForestPhase);
        }
    }, [currentForestPhase]);

    // Debug logging
    useEffect(() => {
        if (debug?.active) {
            console.log(`Loading: ${Math.round(displayProgress)}% - ${currentPhase}`);
            if (forestPhase) {
                console.log(`Forest: ${forestPhase}`);
            }
            if (detailed) {
                console.log('Detailed progress:', detailed);
            }
        }
    }, [displayProgress, currentPhase, forestPhase, detailed, debug]);

    // Format du pourcentage affiché
    const formattedPercentage = Math.round(displayProgress);

    // Fonction pour déterminer le message principal à afficher
    const getMainMessage = () => {
        if (detailed && detailed.forest > 0) {
            return forestPhase || currentPhase;
        }
        return currentPhase;
    };

    // Fonction pour déterminer le message secondaire
    const getSecondaryMessage = () => {
        if (detailed) {
            if (detailed.forest > 0) {
                return `Forêt: ${Math.round(detailed.forest)}% • Assets: ${Math.round(detailed.assets)}%`;
            } else if (detailed.assets > 0) {
                return `Chargement des modèles et textures...`;
            }
        }
        return null;
    };

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

            {/* Écran de chargement avec barre de progression améliorée */}
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
                            {getMainMessage()}
                        </div>

                        {/* Informations détaillées pour le debug */}
                        {debug?.active && detailed && (
                            <div className="loading-debug" style={{
                                position: 'absolute',
                                bottom: '20px',
                                left: '20px',
                                fontSize: '11px',
                                color: '#666',
                                fontFamily: 'monospace',
                                lineHeight: '1.4'
                            }}>
                                <div><strong>Progression détaillée:</strong></div>
                                <div>📦 Assets: {Math.round(detailed.assets)}%</div>
                                <div>🌲 Forêt: {Math.round(detailed.forest)}%</div>
                                <div>🎨 Textures: {Math.round(detailed.textures)}%</div>
                                <div>🖥️  Scène: {Math.round(detailed.scene)}%</div>
                                <div>⚡ Shaders: {Math.round(detailed.shaders)}%</div>

                                {window.renderer && (
                                    <>
                                        <div style={{ marginTop: '8px' }}>
                                            <strong>Rendu:</strong>
                                        </div>
                                        <div>🔺 Triangles: {window.renderer.info.render.triangles.toLocaleString()}</div>
                                        <div>📞 Draw calls: {window.renderer.info.render.calls}</div>
                                    </>
                                )}

                                {forestPhase && forestPhase !== currentPhase && (
                                    <div style={{ marginTop: '8px', color: '#4a9' }}>
                                        🌿 {forestPhase}
                                    </div>
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