import React, { useState, useEffect } from 'react';

/**
 * DesktopLanding component
 * Shows a landing page for desktop users after loading completes
 */
const DesktopLanding = ({ onEnterExperience, enabled = false }) => {
    const [fadeOut, setFadeOut] = useState(false);

    const handleEnterClick = () => {
        if (!enabled) return;

        setFadeOut(true);

        if (onEnterExperience) onEnterExperience();
    };

    return (
        <div className={`desktop-landing ${fadeOut ? 'fade-out' : ''}`}>
            <div className="desktop-landing-content">
                <div className="desktop-landing-project-logo">
                    <img src="/images/logo-holder.png" alt="Project logo" />
                </div>

                <button
                    className={`desktop-landing-cta ${!enabled ? 'disabled' : ''}`}
                    onClick={handleEnterClick}
                    disabled={!enabled}
                >
                    Découvre ta mission
                </button>

                <p className="desktop-landing-message">
                    Projet Gobelins pour La Quadrature du Net
                </p>
            </div>
        </div>
    );
};

export default DesktopLanding;