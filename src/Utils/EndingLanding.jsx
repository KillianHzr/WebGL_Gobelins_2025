import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { narrationManager } from './NarrationManager';
import { EventBus } from './EventEmitter';

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
    const narrationEndedListenerRef = useRef(null);

    // Map pour associer les blocks aux narrations
    const blockNarrationMap = {
        1: 'Scene99_Message1', // Block 2 - The AI Myth
        2: 'Scene99_Message2', // Block 3 - Environmental Impact
        3: 'Scene99_Message3'  // Block 4 - Digital Rights
    };

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

                        // Vérifier si ce bloc a une narration associée
                        const narrationId = blockNarrationMap[targetBlockIndex];

                        if (narrationId) {
                            console.log(`Bloc ${targetBlockIndex} atteint, narration associée: ${narrationId}`);

                            // Nettoyer les écouteurs précédents si existants
                            if (narrationEndedListenerRef.current) {
                                narrationEndedListenerRef.current();
                            }

                            // Configurer un écouteur pour la fin de narration
                            narrationEndedListenerRef.current = EventBus.on('narration-ended', (data) => {
                                if (data && data.narrationId === narrationId) {
                                    console.log(`Narration ${narrationId} terminée`);

                                    setIsScrolling(false);
                                    console.log("Défilement débloqué après narration");

                                    // Nettoyer cet écouteur
                                    if (narrationEndedListenerRef.current) {
                                        narrationEndedListenerRef.current();
                                        narrationEndedListenerRef.current = null;
                                    }
                                }
                            });

                            setTimeout(() => {
                                console.log(`Lecture de la narration: ${narrationId}`);

                                // Sauvegarder l'état d'affichage des sous-titres
                                const subtitleElement = document.getElementById('narration-subtitle');
                                let originalDisplayStyle = null;

                                if (subtitleElement) {
                                    originalDisplayStyle = subtitleElement.style.display;
                                    subtitleElement.style.display = 'none'; // Cacher les sous-titres
                                }

                                // Jouer la narration
                                narrationManager.playNarration(narrationId);

                                // Configurer un fallback au cas où l'événement de fin n'est pas déclenché
                                // On estime une durée de narration maximale de 30 secondes
                                setTimeout(() => {
                                    if (isScrolling) {
                                        console.log(`Fallback: déblocage du défilement après timeout pour ${narrationId}`);
                                        setIsScrolling(false);
                                    }

                                    // Restaurer l'état d'affichage des sous-titres
                                    if (subtitleElement && originalDisplayStyle !== null) {
                                        subtitleElement.style.display = originalDisplayStyle;
                                    }
                                }, 30000);
                            }, 200);
                        } else if (isScrollingBetweenLastBlocks) {
                            // Pas de délai entre les derniers blocs s'il n'y a pas de narration
                            setIsScrolling(false);
                            console.log("Défilement débloqué immédiatement (dernier bloc sans narration)");
                        } else if (isScrollingToPenultimateBlock) {
                            // 1 seconde de délai pour le bloc avant-dernier s'il n'a pas de narration
                            setTimeout(() => {
                                setIsScrolling(false);
                                console.log("Défilement débloqué après 1s (avant-dernier bloc)");
                            }, 1000);
                        } else {
                            // Délai par défaut pour les blocs sans narration
                            setTimeout(() => {
                                setIsScrolling(false);
                                console.log("Défilement débloqué après le délai par défaut");
                            }, 1000);
                        }
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

            // Nettoyer l'écouteur de fin de narration
            if (narrationEndedListenerRef.current) {
                narrationEndedListenerRef.current();
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

        // Show custom animated arrow for all blocks
        return (
            <div
                className={`scroll-indicator scroll-indicator-${blockIndex}`}
                ref={(el) => addArrowRef(blockIndex, el)}
            >
                <div className={`custom-arrow ${isScrolling ? '' : 'active'}`}>
                    <div className="arrow-line line-left"></div>
                    <div className="arrow-line line-right"></div>
                </div>
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