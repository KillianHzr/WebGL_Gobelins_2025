import React, { useState, useRef, useEffect } from 'react';
import useStore from '../Store/useStore';
import { EventBus } from './EventEmitter';

const VideoInterface = ({
                            isVisible,
                            videoSrc,
                            onVideoEnd,
                            showCloseButton = false,
                            autoPlay = true,
                            muted = false
                        }) => {
    const videoRef = useRef(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (!isVisible || !videoRef.current) return;

        const video = videoRef.current;

        const handleLoadStart = () => {
            console.log('📹 VideoInterface: Video loading started');
            setIsLoading(true);
            setHasError(false);
        };

        const handleCanPlay = () => {
            console.log('📹 VideoInterface: Video can play');
            setIsLoading(false);

            if (autoPlay) {
                video.play()
                    .then(() => {
                        console.log('📹 VideoInterface: Video started playing');
                        setIsPlaying(true);
                    })
                    .catch(error => {
                        console.error('📹 VideoInterface: Error playing video:', error);
                        setHasError(true);
                    });
            }
        };

        const handlePlay = () => {
            console.log('📹 VideoInterface: Video playing');
            setIsPlaying(true);
        };

        const handlePause = () => {
            console.log('📹 VideoInterface: Video paused');
            setIsPlaying(false);
        };

        const handleEnded = () => {
            console.log('📹 VideoInterface: Video ended');
            setIsPlaying(false);

            // Émettre un événement pour informer que la vidéo est terminée
            EventBus.trigger('video-ended', {
                videoSrc,
                timestamp: Date.now()
            });

            // Appeler le callback si fourni
            if (onVideoEnd) {
                onVideoEnd();
            }
        };

        const handleError = (event) => {
            console.error('📹 VideoInterface: Video error:', event);
            setHasError(true);
            setIsLoading(false);
        };

        // Ajouter les écouteurs d'événements
        video.addEventListener('loadstart', handleLoadStart);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('error', handleError);

        // Démarrer le chargement de la vidéo
        if (videoSrc) {
            video.src = videoSrc;
            video.load();
        }

        // Nettoyage
        return () => {
            video.removeEventListener('loadstart', handleLoadStart);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('error', handleError);
        };
    }, [isVisible, videoSrc, autoPlay, onVideoEnd]);

    const handleClose = () => {
        if (onVideoEnd) {
            onVideoEnd();
        }
    };

    const handleVideoClick = () => {
        // Désactivé - pas de contrôles de pause
        return;
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="video-interface">
            <div className="video-container">
                {hasError && (
                    <div className="video-error">
                        <p>Erreur lors du chargement de la vidéo</p>
                        <button onClick={handleClose}>Continuer</button>
                    </div>
                )}

                <video
                    ref={videoRef}
                    className="video-player"
                    muted={muted}
                    playsInline
                    style={{
                        display: isLoading || hasError ? 'none' : 'block',
                        pointerEvents: 'none'
                    }}
                />

                {showCloseButton && !isLoading && !hasError && (
                    <button className="video-close-button" onClick={handleClose}>
                        ✕
                    </button>
                )}
            </div>

            <style jsx="true">{`
                .video-interface {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #000;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .video-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .video-player {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    pointer-events: none;
                }

                .video-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: 'Arial', sans-serif;
                }

                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-top: 3px solid white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .video-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: 'Arial', sans-serif;
                    text-align: center;
                }

                .video-error button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: white;
                    color: black;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                }

                .video-error button:hover {
                    background: #f0f0f0;
                }

                .video-close-button {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1001;
                }

                .video-close-button:hover {
                    background: rgba(0, 0, 0, 0.9);
                }
            `}</style>
        </div>
    );
};

export default VideoInterface;