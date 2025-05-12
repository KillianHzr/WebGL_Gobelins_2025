import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

/**
 * EndingLanding component
 * Shows a multi-block ending screen with information about the project and its impact
 */
const EndingLanding = ({ onLearnMore }) => {
    const containerRef = useRef(null);
    const blocksRef = useRef([]);

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

            if (!containerRef.current) return;

            const direction = e.deltaY > 0 ? 1 : -1;
            const blocks = blocksRef.current;

            // Find the current visible block
            const scrollTop = containerRef.current.scrollTop;
            const currentBlockIndex = Math.round(scrollTop / window.innerHeight);

            // Calculate target block
            const targetBlockIndex = Math.max(0, Math.min(blocks.length - 1, currentBlockIndex + direction));

            // Scroll to target block
            gsap.to(containerRef.current, {
                scrollTo: { y: targetBlockIndex * window.innerHeight, autoKill: true },
                duration: 0.8,
                ease: 'power2.out'
            });
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
    }, []);

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
            </div>

            {/* Block 6 - Credits */}
            <div className="ending-block" ref={addToRefs}>
                <div className="ending-block-content">
                    <div className="ending-credits-container">
                        <div className="ending-project-logo-small">
                            <img src="/images/loader.webp" alt="Gobelins Logo" />
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