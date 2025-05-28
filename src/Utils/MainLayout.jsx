import React from 'react';
import useStore from '../Store/useStore';
import { Howler } from 'howler';
import MapProgress from './MapProgress';

/**
 * MainLayout component
 * Persistent layout that shows after loading completes
 * Contains school logo and audio button
 */
const MainLayout = () => {
    const { audio, audio: { muted, setVolume } } = useStore();
    const volumeValue = Howler.volume() || 1;

    // Handler for audio button click
    const handleAudioToggle = () => {
        const newMutedState = !muted;
        const newVolume = newMutedState ? 0 : volumeValue || 0.5; // Default to 0.5 if volume was 0

        setVolume(newMutedState ? 0 : newVolume);
        Howler.volume(newMutedState ? 0 : newVolume);

        useStore.getState().audio.muted = newMutedState;
    };

    return (
        <div className="main-layout">
            {/* School logo in top-left */}
            <div className="main-layout-logo">
                <img src="/images/logo-small.svg" alt="Layon Logo" />
            </div>

            {/* Map progress in center */}
            <div className="main-layout-map">
                <MapProgress />
            </div>

            {/* Audio button */}
            <div className="main-layout-audio-controls">
                <button
                    className="main-layout-audio-button"
                    onClick={handleAudioToggle}
                    aria-label={muted ? "Unmute sound" : "Mute sound"}
                >
                    {muted || volumeValue === 0 ? (
                        // Muted audio icon
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 7V9" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6.3501 7V9" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.6499 7L9.6499 9" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M13 7L13 9" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    ) : (
                        // Unmuted audio icon
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6.66675V8.66675" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6.33334 3.33325V11.9999" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M9.66666 2L9.66666 14" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M13 5.66675L13 9.66675" stroke="#F9FFFB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    )}
                </button>
            </div>

            <div className="scrollToStart">
                <svg width="16" height="40" viewBox="0 0 16 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.66671 30.6667L8.00004 34L11.3334 30.6667" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.16211 0.00976562C12.2151 0.21542 15.4383 3.56688 15.4385 7.6709V16.4385L15.4277 16.833C15.2223 20.8863 11.8709 24.1094 7.7666 24.1094L7.37207 24.0996C3.44966 23.9006 0.304238 20.7555 0.105469 16.833L0.0957031 16.4385V7.6709C0.0958794 3.43451 3.53024 0.000272417 7.7666 0L8.16211 0.00976562ZM7.7666 2C4.6348 2.00027 2.09588 4.53908 2.0957 7.6709V16.4385C2.09577 19.5704 4.63474 22.1091 7.7666 22.1094C10.8987 22.1094 13.4384 19.5706 13.4385 16.4385V7.6709C13.4383 4.53892 10.8986 2 7.7666 2ZM7.76758 4.38379C8.37261 4.38404 8.86328 4.87441 8.86328 5.47949V7.6709C8.86328 8.27598 8.37261 8.76635 7.76758 8.7666C7.16233 8.7666 6.6709 8.27614 6.6709 7.6709V5.47949C6.6709 4.87425 7.16233 4.38379 7.76758 4.38379Z" fill="#F9F9F9"/>
                </svg>
                <p>Scroll pour débuter ta mission.</p>
            </div>
        </div>
    );
};

export default MainLayout;