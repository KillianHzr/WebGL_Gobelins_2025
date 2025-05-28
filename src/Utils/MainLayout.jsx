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
        </div>
    );
};

export default MainLayout;