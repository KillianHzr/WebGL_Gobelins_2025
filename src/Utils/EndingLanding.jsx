import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { narrationManager } from './NarrationManager';
import { EventBus } from './EventEmitter';
import FollowingEyes from './FollowingEyes'; // Import your new component

/**
 * EndingLanding component
 * Shows messages with fade transitions and then scroll to Call to Action
 */
const EndingLanding = ({ onLearnMore }) => {
    const containerRef = useRef(null);
    const blocksRef = useRef([]);
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const [canScroll, setCanScroll] = useState(false);
    const narrationEndedListenerRef = useRef(null);
    const messagesRef = useRef([]);
    const wheelHandlerRef = useRef(null);

    // Messages data
    const messages = [
        {
            id: 'Scene99_Message1',
            texts: [
                ' La forêt <strong>ravagée</strong>. La rivière <strong>asséchée</strong>. Le vison… <strong>mort</strong>.',
                'Tu pensais simplement poser des questions à <strong>Célia</strong>. Mais chaque réponse à tes requêtes… <strong>avait un prix</strong>.',
            ]
        },
        {
            id: 'Scene99_Message2',
            texts: [
                'Résumer un seul panneau ? <strong>250 mL d\'eau.</strong>',
                'Analyser une simple photo ? <strong>250 mL encore</strong>.',
                'Discuter avec Célia ? <strong>500 mL de plus.</strong>',
                'Discuter avec Célia ? <strong>500 mL de plus.</strong>',
                'Mais chaque jour, c\'est <strong>1 milliard de requêtes.</strong> \n' +
                'Résultat : <strong>500 millions de litres d\'eau</strong>, assez pour remplir <strong>200 piscines olympiques</strong>.'
            ]
        },
        {
            id: 'Scene99_Message3',
            texts: [
                'Cette fois, c\'était le <strong>vison d\'Europe</strong>. Demain, <strong>une autre espèce</strong>. Et un jour, <strong>ce sera nous</strong>.',
                'La réalité est là. <strong>L\'intelligence Artificielle</strong> n\'est plus un fantasme. ',
            ]
        },
        {
            id: 'Scene99_Message4',
            texts: []
        }
    ];

    // Register GSAP plugins
    useEffect(() => {
        gsap.registerPlugin(ScrollToPlugin);

        // Initialize fade-in animation
        gsap.to('.ending-landing', {
            opacity: 1,
            duration: 1,
            delay: 0.2
        });

        // Start with the first message
        startMessageSequence();

        // Handle wheel events to prevent scrolling during messages
        const handleWheel = (e) => {
            if (!canScroll) {
                e.preventDefault();
                return;
            }
            // If canScroll is true, remove this handler to allow normal scrolling
            const container = containerRef.current;
            if (container && wheelHandlerRef.current) {
                container.removeEventListener('wheel', wheelHandlerRef.current);
                wheelHandlerRef.current = null;
                console.log('Scroll handler removed - normal scrolling enabled');
            }
        };

        // Store the handler reference
        wheelHandlerRef.current = handleWheel;

        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            const container = containerRef.current;
            if (container && wheelHandlerRef.current) {
                container.removeEventListener('wheel', wheelHandlerRef.current);
                wheelHandlerRef.current = null;
            }

            // Clean up narration listener safely
            if (narrationEndedListenerRef.current) {
                try {
                    narrationEndedListenerRef.current();
                } catch (error) {
                    console.warn('Error during cleanup:', error);
                }
                narrationEndedListenerRef.current = null;
            }
        };
    }, []);

    // Start the message sequence
    const startMessageSequence = () => {
        console.log('Starting message sequence');
        showMessage(0);
        playNarration('Scene99_Message1');
    };

    // Show a specific message with fade in
    const showMessage = (messageIndex) => {
        console.log(`Showing message ${messageIndex}`);
        setCurrentMessageIndex(messageIndex);

        // Hide all messages first
        messagesRef.current.forEach((messageEl, index) => {
            if (messageEl) {
                gsap.set(messageEl, { opacity: 0 });
            }
        });

        // Show the current message with fade in
        const currentMessageEl = messagesRef.current[messageIndex];
        if (currentMessageEl) {
            gsap.to(currentMessageEl, {
                opacity: 1,
                duration: 0.8,
                ease: 'power2.out'
            });
        }
    };

    // Hide current message with fade out
    const hideCurrentMessage = () => {
        const currentMessageEl = messagesRef.current[currentMessageIndex];
        if (currentMessageEl) {
            gsap.to(currentMessageEl, {
                opacity: 0,
                duration: 0.8,
                ease: 'power2.out'
            });
        }
    };

    // Play narration and set up listener
    const playNarration = (narrationId) => {
        console.log(`Playing narration: ${narrationId}`);

        // Clean up previous listeners
        if (narrationEndedListenerRef.current) {
            try {
                narrationEndedListenerRef.current();
            } catch (error) {
                console.warn('Error cleaning up previous listener:', error);
            }
            narrationEndedListenerRef.current = null;
        }

        // Set up listener for narration end
        const cleanup = EventBus.on('narration-ended', (data) => {
            if (data && data.narrationId === narrationId) {
                console.log(`Narration ${narrationId} ended`);

                // Clean up this listener immediately
                if (narrationEndedListenerRef.current) {
                    try {
                        narrationEndedListenerRef.current();
                    } catch (error) {
                        console.warn('Error cleaning up narration listener:', error);
                    }
                    narrationEndedListenerRef.current = null;
                }

                // Handle narration end with delay to avoid race conditions
                setTimeout(() => {
                    handleNarrationEnd(narrationId);
                }, 100);
            }
        });

        narrationEndedListenerRef.current = cleanup;

        // Hide subtitles for ending narrations
        const subtitleElement = document.getElementById('narration-subtitle');
        if (subtitleElement) {
            subtitleElement.style.display = 'none';
        }

        // Play the narration with delay
        setTimeout(() => {
            try {
                narrationManager.playNarration(narrationId);
            } catch (error) {
                console.error('Error playing narration:', error);
                // Fallback: proceed to next step
                setTimeout(() => handleNarrationEnd(narrationId), 5000);
            }
        }, 200);
    };

    // Handle narration end
    const handleNarrationEnd = (narrationId) => {
        console.log(`Handling end of narration: ${narrationId}`);

        if (narrationId === 'Scene99_Message1') {
            // Fade out first message, wait, then show second
            hideCurrentMessage();
            setTimeout(() => {
                showMessage(1);
                playNarration('Scene99_Message2');
            }, 1800); // 800ms fade + 1000ms wait
        } else if (narrationId === 'Scene99_Message2') {
            // Fade out second message, wait, then show third
            hideCurrentMessage();
            setTimeout(() => {
                showMessage(2);
                playNarration('Scene99_Message3');
            }, 1800); // 800ms fade + 1000ms wait
        } else if (narrationId === 'Scene99_Message3') {
            // Don't fade out the third message, but scroll to Call to Action
            console.log('Third message complete, scrolling to Call to Action');
            setTimeout(() => {
                scrollToCallToAction();
            }, 1000);
        } else if (narrationId === 'Scene99_Message4') {
            // Final message complete
            console.log('Final message complete');
        }
    };

    // Scroll to Call to Action
    const scrollToCallToAction = () => {
        console.log('Scrolling to Call to Action');
        setCanScroll(true);

        // Calculate the height to scroll to (100vh in pixels)
        const scrollTarget = window.innerHeight;

        // Try GSAP first, with fallback to native scroll
        if (containerRef.current) {
            try {
                gsap.to(containerRef.current, {
                    scrollTo: { y: scrollTarget, autoKill: true },
                    duration: 1.5,
                    ease: 'power2.inOut',
                    onComplete: () => {
                        console.log('Scroll to Call to Action complete, playing Scene99_Message4');
                        // Play Scene99_Message4 after scroll completes
                        setTimeout(() => {
                            playNarration('Scene99_Message4');
                        }, 500);
                    },
                    onError: (error) => {
                        console.warn('GSAP scroll error, using fallback:', error);
                        // Fallback to native smooth scroll
                        containerRef.current.scrollTo({
                            top: scrollTarget,
                            behavior: 'smooth'
                        });
                        // Play Scene99_Message4 after fallback scroll
                        setTimeout(() => {
                            playNarration('Scene99_Message4');
                        }, 2000); // Longer delay for native scroll
                    }
                });
            } catch (error) {
                console.warn('GSAP scroll failed, using native scroll:', error);
                // Immediate fallback to native smooth scroll
                containerRef.current.scrollTo({
                    top: scrollTarget,
                    behavior: 'smooth'
                });
                // Play Scene99_Message4 after fallback scroll
                setTimeout(() => {
                    playNarration('Scene99_Message4');
                }, 2000); // Longer delay for native scroll
            }
        }
    };

    // Add message to refs
    const addMessageRef = (index, el) => {
        if (el) {
            messagesRef.current[index] = el;
        }
    };

    // Add block to refs
    const addToRefs = (el) => {
        if (el && !blocksRef.current.includes(el)) {
            blocksRef.current.push(el);
        }
    };

    const handleLearnMore = () => {
        if (onLearnMore) onLearnMore();
    };

    return (
        <div className="ending-landing" ref={containerRef}>
            {/* Messages Block - Single block that displays all messages */}
            <div className="ending-block ending-messages-block" ref={addToRefs}>
                <div className="ending-block-content">
                    {/* Fixed Assets that stay visible throughout all messages */}
                    <div className="ending-asset ending-asset-right first-asset">
                        <img src="/images/Assets_1.png" alt="AI Myth illustration" />
                    </div>
                    <div className="ending-asset ending-asset-right third-asset">
                        <img src="/images/Assets_3.png" alt="Digital rights illustration" />
                    </div>

                    {/* Messages that fade in/out */}
                    {messages.map((message, index) => (
                        <div
                            key={message.id}
                            className={`ending-message ${currentMessageIndex === index ? 'active' : ''}`}
                            ref={(el) => addMessageRef(index, el)}
                        >
                            <div className="ending-text-container">
                                {message.texts.map((text, textIndex) => (
                                    <p
                                        key={textIndex}
                                        className="ending-text"
                                        dangerouslySetInnerHTML={{ __html: text }}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Call to Action Block */}
            <div className="ending-block" ref={addToRefs}>
                <div className="ending-block-content">
                    <div className="ending-landing-school-logo">
                        <img src="/images/Logo-LQDN_Full.png" alt="LQDN Logo" />
                    </div>
                    <button
                        className="ending-landing-cta"
                        onClick={handleLearnMore}
                    >
                        Je veux en savoir plus !
                    </button>
                </div>
                {/* Replace the static SVG with the following eyes component */}
                <FollowingEyes className="ending-asset eye-1" />
                <FollowingEyes className="ending-asset eye-2" />
                <FollowingEyes className="ending-asset eye-3" variant="inverted" />
                <div className="ending-credits">
                    <div className="ending-credits-names">
                        <span className="ending-credits-name">ANTOINE VENET</span>
                        <span className="ending-credits-name">KILLIAN HERZER</span>
                        <span className="ending-credits-name">VALENTIN GASSEND</span>
                        <span className="ending-credits-name">HUGO PINNA</span>
                        <span className="ending-credits-name">MELISSE CLIVAZ</span>
                    </div>
                    <div className="ending-credits-names line-2">
                        <span className="ending-credits-name">LUCAS BENEVAUT</span>
                        <span className="ending-credits-name">ALEXANDRE LHOSTE</span>
                        <span className="ending-credits-name">VICTOR LETISSE–PILLON</span>
                    </div>
                </div>
            </div>

            {/* Credits Block */}
            <div className="ending-block" ref={addToRefs}>
                <div className="ending-block-content">
                    <div className="ending-credits-container">
                        <div className="ending-project-logo-small">
                            <img src="/images/loader.gif" alt="Gobelins Logo" />
                        </div>
                        <div className="ending-credits">
                            <div className="ending-credits-names">
                                <span className="ending-credits-name">ANTOINE VENET</span>
                                <span className="ending-credits-name">KILLIAN HERZER</span>
                                <span className="ending-credits-name">VALENTIN GASSEND</span>
                                <span className="ending-credits-name">HUGO PINNA</span>
                                <span className="ending-credits-name">MELISSE CLIVAZ</span>
                            </div>
                            <div className="ending-credits-names line-2">
                                <span className="ending-credits-name">LUCAS BENEVAUT</span>
                                <span className="ending-credits-name">ALEXANDRE LHOSTE</span>
                                <span className="ending-credits-name">VICTOR LETISSE–PILLON</span>
                            </div>
                        </div>
                        <div className="ending-logos">
                            <div className="ending-logo-item">
                                <img src="/images/Gobelins_Logo_full.png" alt="Gobelins Logo" />
                            </div>
                            <div className="ending-logo-item">
                                <img src="/images/Logo-LQDN.png" alt="LQDN Logo" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EndingLanding;