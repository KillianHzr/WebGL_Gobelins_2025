import React, { useState, useEffect } from 'react';
import { narrationManager } from './NarrationManager';
import { EventBus } from './EventEmitter';

/**
 * EndingLanding component
 * Shows a black screen ending with narration and call-to-action
 */
const EndingLanding = ({ onLearnMore }) => {
    const [narrationEnded, setNarrationEnded] = useState(false);
    const [fadeIn, setFadeIn] = useState(false);

    // Start fade-in animation when component mounts
    useEffect(() => {
        // Fade in the component
        setTimeout(() => {
            setFadeIn(true);
        }, 100);

        // Play the ending narration
        narrationManager.playNarration('SceneGenerique');

        // Listen for narration-ended event
        const narrationEndedListener = EventBus.on('narration-ended', (data) => {
            if (data && data.narrationId === 'SceneGenerique') {
                console.log('Ending narration completed, showing CTA elements');
                setNarrationEnded(true);
            }
        });

        // Apply centered subtitle style
        const subtitleElement = document.getElementById('narration-subtitle');
        if (subtitleElement) {
            // Save original style to restore later
            const originalStyle = {
                bottom: subtitleElement.style.bottom,
                left: subtitleElement.style.left,
                transform: subtitleElement.style.transform,
                textAlign: subtitleElement.style.textAlign,
                width: subtitleElement.style.width,
                fontSize: subtitleElement.style.fontSize
            };

            // Update style to center vertically and horizontally
            subtitleElement.style.bottom = 'auto';
            subtitleElement.style.top = '50%';
            subtitleElement.style.transform = 'translate(-50%, -50%)';
            subtitleElement.style.textAlign = 'center';
            subtitleElement.style.width = '80%';
            subtitleElement.style.fontSize = '16px';

            // Additional styling for strong elements inside subtitles
            const style = document.createElement('style');
            style.id = 'ending-subtitle-style';
            style.textContent = `
            #narration-subtitle strong {
                color: #F9FFFB;
                font-weight: 900;
                font-size: 24px;
                line-height: 80px;
            }
        `;
            document.head.appendChild(style);

            // Restore original style on cleanup
            return () => {
                narrationEndedListener();
                if (subtitleElement) {
                    subtitleElement.style.bottom = originalStyle.bottom || '40px';
                    subtitleElement.style.top = '';
                    subtitleElement.style.transform = originalStyle.transform || 'translateX(-50%)';
                    subtitleElement.style.textAlign = originalStyle.textAlign || 'center';
                    subtitleElement.style.width = originalStyle.width || '90%';
                    subtitleElement.style.fontSize = originalStyle.fontSize || '16px';
                }

                // Remove the custom style
                const customStyle = document.getElementById('ending-subtitle-style');
                if (customStyle) {
                    customStyle.remove();
                }
            };
        }

        return narrationEndedListener;
    }, []);

    const handleLearnMore = () => {
        if (onLearnMore) onLearnMore();
    };

    return (
        <div className={`ending-landing ${fadeIn ? 'fade-in' : ''}`}>
            <div className="ending-landing-content">
                {narrationEnded && (
                    <>
                        <div className="ending-landing-school-logo">
                            <img src="/images/Logo-LQDN.png" alt="LQDN Logo" />
                        </div>
                        <button
                            className="ending-landing-cta"
                            onClick={handleLearnMore}
                        >
                            Je veux en savoir plus !
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default EndingLanding;