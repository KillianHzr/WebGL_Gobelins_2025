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
                <p className="desktop-landing-logos">
                    <img src="/images/Gobelins_Logo_full.png" alt="Project logo" />
                    <img src="/images/Logo-LQDN.png" alt="Project logo" />
                </p>

                <div className="desktop-landing-project-logo">
                    <img src="/images/LeLayon_Logo.svg" alt="Project logo" />
                </div>

                <button
                    className={`desktop-landing-cta ${!enabled ? 'disabled' : ''}`}
                    onClick={handleEnterClick}
                    disabled={!enabled}
                >
                    Découvre ta mission
                </button>

                <p className="desktop-landing-message">
                    Pour une immersion complète, utilise un casque.
                </p>
            </div>
        </div>
    );
};

export default DesktopLanding;