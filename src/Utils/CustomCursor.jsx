import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import useStore from '../Store/useStore';

const CustomCursor = () => {
    const cursorRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const endingLandingVisible = useStore(state => state.endingLandingVisible);

    // Set up cursor following behavior with GSAP
    useEffect(() => {
        // Hide default cursor
        document.body.style.cursor = 'none';

        const cursor = cursorRef.current;
        let mouseX = 0;
        let mouseY = 0;
        let cursorX = 0;
        let cursorY = 0;

        // Create GSAP animation context
        const cursorAnimation = gsap.context(() => {
            // Update cursor position with smooth animation
            gsap.ticker.add(() => {
                if (!cursor) return;

                // Apply smooth lerping effect - reduced from 0.15 to 0.3 for less smoothing
                const speed = 0.3;
                cursorX += (mouseX - cursorX) * speed;
                cursorY += (mouseY - cursorY) * speed;

                // Apply the transform with GPU acceleration
                gsap.set(cursor, {
                    x: cursorX,
                    y: cursorY,
                    force3D: true
                });
            });
        });

        // Mouse move event handler
        const onMouseMove = (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            // Show cursor once we have position data
            if (!isVisible) {
                setIsVisible(true);
            }
        };

        // Mouse leave event handler
        const onMouseLeave = () => {
            setIsVisible(false);
        };

        // Mouse enter event handler
        const onMouseEnter = () => {
            setIsVisible(true);
        };

        // Add event listeners
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseleave', onMouseLeave);
        document.addEventListener('mouseenter', onMouseEnter);

        // Cleanup
        return () => {
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseleave', onMouseLeave);
            document.removeEventListener('mouseenter', onMouseEnter);
            cursorAnimation.revert();
        };
    }, [isVisible]);

    // Handle click effect
    useEffect(() => {
        const handleMouseDown = () => {
            if (cursorRef.current) {
                cursorRef.current.classList.add('cursor-click');
            }
        };

        const handleMouseUp = () => {
            if (cursorRef.current) {
                cursorRef.current.classList.remove('cursor-click');
            }
        };

        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Special handler for links and interactive elements
    useEffect(() => {
        const handleInteractiveElems = () => {
            const interactiveElements = document.querySelectorAll(`
                a, 
                button, 
                [role="button"],
                .camera-viewport-zoom-indicator,
                .camera-viewport-zoom-plus,
                .camera-viewport-zoom-minus
            `);
            const onInteractiveEnter = () => {
                if (cursorRef.current) {
                    cursorRef.current.classList.add('cursor-interactive');
                }
            };

            const onInteractiveLeave = () => {
                if (cursorRef.current) {
                    cursorRef.current.classList.remove('cursor-interactive');
                }
            };

            interactiveElements.forEach(el => {
                el.addEventListener('mouseenter', onInteractiveEnter);
                el.addEventListener('mouseleave', onInteractiveLeave);
            });

            return () => {
                interactiveElements.forEach(el => {
                    el.removeEventListener('mouseenter', onInteractiveEnter);
                    el.removeEventListener('mouseleave', onInteractiveLeave);
                });
            };
        };

        // Set up the observers for interactive elements
        const cleanup = handleInteractiveElems();

        // Re-detect interactive elements when DOM changes
        const observer = new MutationObserver(handleInteractiveElems);
        observer.observe(document.body, { childList: true, subtree: true });

        return () => {
            cleanup();
            observer.disconnect();
        };
    }, []);

    return (
        <div
            ref={cursorRef}
            className={`custom-cursor ${isVisible ? 'visible' : ''} ${endingLandingVisible ? 'pixelated' : ''}`}
        >
            <div className="cursor-border"></div>
            <div className="cursor-dot"></div>
        </div>
    );
};

export default CustomCursor;