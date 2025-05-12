import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

/**
 * EndingLanding component
 * Shows a multi-block ending screen with information about the project and its impact
 */
const EndingLanding = ({ onLearnMore }) => {
    const containerRef = useRef(null);
    const blocksRef = useRef([]);
    const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
    const [isScrolling, setIsScrolling] = useState(false);
    const arrowRefs = useRef({});

    // Register GSAP plugins
    useEffect(() => {
        gsap.registerPlugin(ScrollToPlugin);

        // Initialize fade-in animation
        gsap.to('.ending-landing', {
            opacity: 1,
            duration: 1,
            delay: 0.2
        });

        const handleWheel = (e) => {
            e.preventDefault();

            if (!containerRef.current || isScrolling) return;

            const direction = e.deltaY > 0 ? 1 : -1;
            const blocks = blocksRef.current;

            // Find the current visible block
            const scrollTop = containerRef.current.scrollTop;
            const visibleBlockIndex = Math.round(scrollTop / window.innerHeight);

            // Calculate target block
            const targetBlockIndex = Math.max(0, Math.min(blocks.length - 1, visibleBlockIndex + direction));

            // Determine if we're scrolling between the last two blocks
            const isScrollingBetweenLastBlocks =
                (visibleBlockIndex === blocks.length - 2 && targetBlockIndex === blocks.length - 1) ||
                (visibleBlockIndex === blocks.length - 1 && targetBlockIndex === blocks.length - 2);

            // Check if the user is trying to scroll backwards (not on last blocks)
            const isScrollingBackwards = direction < 0 && !isScrollingBetweenLastBlocks;

            // Check if we're scrolling TO the penultimate block
            const isScrollingToPenultimateBlock = targetBlockIndex === blocks.length - 2;

            // Only proceed if:
            // 1. We're actually changing blocks, AND
            // 2. We're either scrolling forward OR between the last two blocks
            if (targetBlockIndex !== visibleBlockIndex && !isScrollingBackwards) {
                // Set scrolling state to true
                setIsScrolling(true);

                // Update the current block index
                setCurrentBlockIndex(targetBlockIndex);

                // Get the arrow element for the current block
                const currentArrow = arrowRefs.current[`arrow-${visibleBlockIndex}`];

                // Fade out the current arrow
                if (currentArrow) {
                    gsap.to(currentArrow, {
                        opacity: 0,
                        duration: 0.3,
                        ease: "power1.out"
                    });
                }

                // Scroll to target block
                gsap.to(containerRef.current, {
                    scrollTo: { y: targetBlockIndex * window.innerHeight, autoKill: true },
                    duration: 0.8,
                    ease: 'power2.out',
                    onComplete: () => {
                        // Reset opacity of new arrow
                        const newArrow = arrowRefs.current[`arrow-${targetBlockIndex}`];
                        if (newArrow) {
                            gsap.to(newArrow, {
                                opacity: 1,
                                duration: 0.3
                            });
                        }

                        // Set scroll delay based on target block
                        let scrollDelay;

                        if (isScrollingBetweenLastBlocks) {
                            scrollDelay = 0; // No delay between last blocks
                        } else if (isScrollingToPenultimateBlock) {
                            scrollDelay = 1000; // 1 second delay for penultimate block
                            console.log("Setting 1s delay for penultimate block");
                        } else {
                            scrollDelay = 4000; // Default 4 seconds
                        }

                        console.log(`Scroll delay: ${scrollDelay}ms for block index ${targetBlockIndex}`);

                        // After appropriate delay, allow scrolling again
                        setTimeout(() => {
                            setIsScrolling(false);
                            console.log("Scroll unlocked");
                        }, scrollDelay);
                    }
                });
            }
        };

        // Add wheel event listener to container
        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheel);
            }
        };
    }, [isScrolling]);

    // Add block to refs
    const addToRefs = (el) => {
        if (el && !blocksRef.current.includes(el)) {
            blocksRef.current.push(el);
        }
    };

    // Add arrow ref
    const addArrowRef = (index, el) => {
        if (el) {
            arrowRefs.current[`arrow-${index}`] = el;
        }
    };

    const handleLearnMore = () => {
        if (onLearnMore) onLearnMore();
    };

    // Render a scroll indicator if needed
    const renderScrollIndicator = (blockIndex) => {
        // Don't show on the last block or second-to-last block
        if (blockIndex === blocksRef.current.length - 1 ||
            blockIndex === blocksRef.current.length - 2) return null;

        // Show only on the current block
        if (blockIndex !== currentBlockIndex) return null;

        // For first block, show arrow immediately
        if (blockIndex === 0) {
            return (
                <div
                    className={`scroll-indicator scroll-indicator-${blockIndex}`}
                    ref={(el) => addArrowRef(blockIndex, el)}
                >
                    <div className="scroll-arrow">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 14.975q-.2 0-.375-.062T11.3 14.7l-4.6-4.6q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l3.9 3.9l3.9-3.9q.275-.275.7-.275t.7.275t.275.7t-.275.7l-4.6 4.6q-.15.15-.325.213t-.375.062"/>
                        </svg>
                    </div>
                </div>
            );
        }

        // For other blocks, show dots when scrolling, then arrow
        return (
            <div
                className={`scroll-indicator scroll-indicator-${blockIndex}`}
                ref={(el) => addArrowRef(blockIndex, el)}
            >
                {isScrolling ? (
                    <div className="loading-dots">...</div>
                ) : (
                    <div className="scroll-arrow">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 14.975q-.2 0-.375-.062T11.3 14.7l-4.6-4.6q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l3.9 3.9l3.9-3.9q.275-.275.7-.275t.7.275t.275.7t-.275.7l-4.6 4.6q-.15.15-.325.213t-.375.062"/>
                        </svg>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="ending-landing" ref={containerRef}>
            {/* Block 1 - Project Introduction */}
            <div className="ending-block" ref={addToRefs}>
                <div className="ending-block-content">
                    <p className="ending-project-message">
                        Un projet Gobelins pour La Quadrature du Net
                    </p>
                    <div className="ending-project-logo">
                        <img src="/images/LeLayon_Logo.svg" alt="Project logo" />
                    </div>
                    <p className="ending-project-legend">
                        La ballade qui a tout changé
                    </p>
                </div>
                {renderScrollIndicator(0)}
            </div>

            {/* Block 2 - The AI Myth */}
            <div className="ending-block" ref={addToRefs}>
                <div className="ending-block-content">
                    <div className="ending-text-container">
                        <p className="ending-text">
                            Quand on entend parler <strong>d'intelligence artificielle</strong>, c'est l'histoire d'un <strong>mythe moderne</strong> qui nous est racontée.
                        </p>
                        <p className="ending-text">
                            Celui d'une <strong>IA miraculeuse</strong> censée sauver le monde.
                        </p>
                        <p className="ending-text">
                            Mais derrière cette illusion se trouve une <strong>réalité bien plus tangible</strong>, avec des <strong>conséquences bien réelles</strong>.
                        </p>
                    </div>
                </div>
                <div className="ending-asset ending-asset-right first-asset">
                    <img src="/images/Assets_1.png" alt="AI Myth illustration" />
                </div>
                {renderScrollIndicator(1)}
            </div>

            {/* Block 3 - Environmental Impact */}
            <div className="ending-block" ref={addToRefs}>
                <div className="ending-block-content">
                    <div className="ending-text-container">
                        <p className="ending-text">
                            <strong>Une requête par IA</strong> consomme autant d'énergie que <strong>dix recherches sur Internet</strong>.
                        </p>
                        <p className="ending-text">
                            <strong>Une image générée par IA</strong> nécessite <strong>entre deux et cinq litres d'eau</strong>.
                        </p>
                        <p className="ending-text">
                            Non. Ce n'est pas de l'IA. <strong>C'est l'exploitation de la planète</strong>.
                        </p>
                    </div>
                </div>
                <div className="ending-asset ending-asset-left second-asset">
                    <img src="/images/Assets_2.png" alt="Environmental impact illustration" />
                </div>
                {renderScrollIndicator(2)}
            </div>

            {/* Block 4 - Digital Rights */}
            <div className="ending-block" ref={addToRefs}>
                <div className="ending-block-content">
                    <div className="ending-text-container">
                        <p className="ending-text">
                            Dans un monde où le numérique progresse à une vitesse vertigineuse, des associations comme <strong>La Quadrature du Net luttent pour nos droits et pour la planète</strong>.
                        </p>
                        <p className="ending-text">
                            En commençant par <strong>déconstruire les mythes autour du fantasme</strong> de l'intelligence artificielle.
                        </p>
                        <p className="ending-text">
                            <strong>Le progrès a un coût. À toi de décider qui le paie.</strong>
                        </p>
                    </div>
                </div>
                <div className="ending-asset ending-asset-right third-asset">
                    <img src="/images/Assets_3.png" alt="Digital rights illustration" />
                </div>
                {renderScrollIndicator(3)}
            </div>

            {/* Block 5 - Call to Action */}
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
                <div className="ending-asset fourth-asset">
                    <img src="/images/Assets_4.png" alt="AI Myth illustration" />
                </div>
                {/* No arrow indicator for the second-to-last block */}
            </div>

            {/* Block 6 - Credits */}
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