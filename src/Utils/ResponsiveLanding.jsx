import React, { useState, useRef, useEffect } from 'react';

/**
 * ResponsiveLanding component
 * Displays a landing page for mobile/tablet users with an integrated video popup
 */
const ResponsiveLanding = () => {
    const [isVideoPopupOpen, setIsVideoPopupOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const videoRef = useRef(null);

    // Video teaser URL - Update with your actual video URL
    const videoTeaserUrl = '/videos/teaser.mp4';

    // Handle escape key to close the popup
    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape' && isVideoPopupOpen) {
                setIsVideoPopupOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => document.removeEventListener('keydown', handleEscKey);
    }, [isVideoPopupOpen]);

    // Monitor fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Toggle fullscreen mode
    const toggleFullscreen = () => {
        if (videoRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                videoRef.current.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            }
        }
    };

    // Toggle play/pause when clicking on the video
    const togglePlayPause = () => {
        if (videoRef.current) {
            if (videoRef.current.paused) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    };

    return (
        <div className="responsive-landing">
            <div className="responsive-landing-content">
                <div className="responsive-landing-school-logo">
                    <img src="/images/Gobelins_Logo.svg" alt="School logo" />
                </div>

                <div className="responsive-landing-project-logo">
                    <img src="/images/logo-holder.png" alt="Project logo" />
                </div>

                <button
                    className="responsive-landing-cta"
                    onClick={() => setIsVideoPopupOpen(true)}
                >
                    Regarde le teaser
                </button>

                <p className="responsive-landing-message">
                    Cette randonnée se parcourt sur Desktop
                </p>
            </div>

            {/* Video Popup integrated in the same component */}
            {isVideoPopupOpen && (
                <div className="responsive-landing-popup-overlay" onClick={() => setIsVideoPopupOpen(false)}>
                    <div className="responsive-landing-popup-container" onClick={e => e.stopPropagation()}>
                        <div className="responsive-landing-popup-header">
                            <button className="responsive-landing-popup-close" onClick={() => setIsVideoPopupOpen(false)}>×</button>
                        </div>
                        <div className="responsive-landing-popup-content">
                            <video
                                ref={videoRef}
                                className={`responsive-landing-popup-player ${isFullscreen ? 'with-controls' : 'no-controls'}`}
                                src={videoTeaserUrl}
                                controls={isFullscreen}
                                autoPlay
                                onClick={togglePlayPause}
                            />
                            {!isFullscreen && (
                                <div className="responsive-landing-popup-play-overlay" onClick={togglePlayPause}>
                                    {/* Optional: Add play/pause icon here */}
                                </div>
                            )}
                        </div>
                        <div className="responsive-landing-popup-footer">
                            <button className="responsive-landing-popup-fullscreen" onClick={toggleFullscreen}>
                                Plein écran
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResponsiveLanding;