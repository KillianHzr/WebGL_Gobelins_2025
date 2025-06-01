import React, { useEffect, useRef, useState } from 'react';

const FollowingEyes = ({ className = "", variant = "normal" }) => {
    const svgRef = useRef(null);
    const leftPupilRef = useRef(null);
    const rightPupilRef = useRef(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isHoveringButton, setIsHoveringButton] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePos({ x: e.clientX, y: e.clientY });
        };

        document.addEventListener('mousemove', handleMouseMove);
        return () => document.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Effect to handle button hover for brightness effect
    useEffect(() => {
        const handleButtonHover = (isHovering) => {
            setIsHoveringButton(isHovering);
        };

        const setupButtonListeners = () => {
            const button = document.querySelector('.ending-landing-cta');
            if (button) {
                const onMouseEnter = () => handleButtonHover(true);
                const onMouseLeave = () => handleButtonHover(false);

                button.addEventListener('mouseenter', onMouseEnter);
                button.addEventListener('mouseleave', onMouseLeave);

                return () => {
                    button.removeEventListener('mouseenter', onMouseEnter);
                    button.removeEventListener('mouseleave', onMouseLeave);
                };
            }
            return null;
        };

        // Setup listeners immediately if button exists
        let cleanup = setupButtonListeners();

        // If button doesn't exist yet, set up a MutationObserver to wait for it
        if (!cleanup) {
            const observer = new MutationObserver(() => {
                if (!cleanup) {
                    cleanup = setupButtonListeners();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            return () => {
                observer.disconnect();
                if (cleanup) cleanup();
            };
        }

        return cleanup;
    }, []);

    useEffect(() => {
        if (!svgRef.current || !leftPupilRef.current || !rightPupilRef.current) return;

        const svg = svgRef.current;
        const leftPupil = leftPupilRef.current;
        const rightPupil = rightPupilRef.current;

        // Get SVG position and dimensions
        const svgRect = svg.getBoundingClientRect();
        const svgCenterX = svgRect.left + svgRect.width / 2;
        const svgCenterY = svgRect.top + svgRect.height / 2;

        // Calculate relative mouse position
        const relativeX = mousePos.x - svgCenterX;
        const relativeY = mousePos.y - svgCenterY;

        // Eye dimensions and centers (approximated from the SVG viewBox)
        const leftEyeCenterX = 24; // Approximate center of left eye in SVG coordinates
        const rightEyeCenterX = 102; // Approximate center of right eye in SVG coordinates
        const eyeCenterY = 20; // Approximate vertical center of both eyes

        // Maximum movement range for pupils (to keep them inside the eyes)
        const maxMoveX = 6; // Maximum horizontal movement
        const maxMoveY = 4; // Maximum vertical movement

        // Calculate pupil movements based on mouse position
        // Scale the movement based on distance from center
        const scaleFactor = 0.02; // Adjust this to make eyes more or less sensitive

        let leftMoveX = relativeX * scaleFactor;
        let leftMoveY = relativeY * scaleFactor;
        let rightMoveX = relativeX * scaleFactor;
        let rightMoveY = relativeY * scaleFactor;

        // For inverted variant, we don't need to flip the movements
        // The pupils should always follow the cursor in the same direction
        // regardless of the SVG orientation

        // Constrain movements to keep pupils inside eyes
        leftMoveX = Math.max(-maxMoveX, Math.min(maxMoveX, leftMoveX));
        leftMoveY = Math.max(-maxMoveY, Math.min(maxMoveY, leftMoveY));
        rightMoveX = Math.max(-maxMoveX, Math.min(maxMoveX, rightMoveX));
        rightMoveY = Math.max(-maxMoveY, Math.min(maxMoveY, rightMoveY));

        // Apply transformations to pupils
        leftPupil.style.transform = `translate(${leftMoveX}px, ${leftMoveY}px)`;
        rightPupil.style.transform = `translate(${rightMoveX}px, ${rightMoveY}px)`;

    }, [mousePos, variant]);

    const getSVGStyle = () => {
        const baseStyle = { width: '100%', height: 'auto' };
        if (isHoveringButton) {
            return {
                ...baseStyle,
                filter: 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.8)) brightness(1.2)',
                transition: 'filter 0.3s ease'
            };
        }
        return {
            ...baseStyle,
            filter: 'none',
            transition: 'filter 0.3s ease'
        };
    };

    const renderNormalSVG = () => (
        <svg
            ref={svgRef}
            width="134"
            height="40"
            viewBox="0 0 134 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={getSVGStyle()}
        >
            <g clipPath="url(#clip0_2818_5309)">
                {/* Left Eye (white part) */}
                <path
                    d="M48.2254 5.39795V6.80479H54.5728V8.38887H57.5748V9.97295H60.743V11.557H62.3271V13.1411H63.9222L63.9111 14.548H65.3291V23.8752H63.9111L63.9222 25.4593L62.3271 25.4482V27.0434L60.743 27.0323V28.6164H57.5748V30.2004H54.5728V31.6073H49.8095V33.1914H40.4712V34.7754H26.5468V33.1914H17.1974V31.6073H12.6113V30.2004H7.85907V28.6164H6.44115V27.0323H3.27299V23.8752H1.68891V20.8843L0.09375 20.7735V19.3002H1.68891V14.548H3.27299V13.1411H4.85707V11.557H6.44115V9.97295H9.44315V8.38887H12.6113V6.80479H18.7815V5.39795H48.2254Z"
                    fill="#F4FFF6"
                />

                {/* Left Eye Pupil (black part that follows cursor) */}
                <path
                    ref={leftPupilRef}
                    d="M43.9796 10V11.311H45.2906V12.622H46.6134V13.933H47.9244V17.8661H49.2354V20.4881H47.9244V24.4094H46.6134V25.7204H45.2906V27.0314H43.9796V28.3424H39.8457V29.8424H37.2237V28.3424H33.2788V27.0314H31.956L31.9678 25.7204H30.645V24.4094H29.334V13.933H30.645V12.622H31.9678L31.956 11.311H33.2788V10H43.9796Z"
                    fill="#000B04"
                    style={{
                        transformOrigin: 'center',
                        transition: 'transform 0.1s ease-out'
                    }}
                />

                {/* Right Eye (white part) */}
                <path
                    d="M116.229 5.39795V6.80479H122.399V8.38887H125.568V9.97295H128.747V11.557H130.154V13.1411H131.738V14.548H133.333V23.8752H131.738V25.4593L130.154 25.4482V27.0434L128.747 27.0323V28.6164H125.568V30.2004H122.399V31.6073H117.813V33.1914H108.475V34.7754H94.5395V33.1914H85.2012V31.6073H80.4379V30.2004H75.8518V28.6164H74.2677V27.0323H71.2768V23.8752H69.6816V14.548H71.2768L71.2657 13.1411H72.6836V11.557H74.2677V9.97295H77.447V8.38887H80.4379V6.80479H86.7853V5.39795H116.229Z"
                    fill="#F4FFF6"
                />

                {/* Right Eye Pupil (black part that follows cursor) */}
                <path
                    ref={rightPupilRef}
                    d="M111.968 10V11.311H113.279V12.622H114.59V13.933H115.913V17.8661H117.224V20.4881H115.913V24.4094H114.59V25.7204H113.279V27.0314H111.968V28.3424H108.024V29.8424H105.201V28.3424H101.268V27.0314H99.9449V25.7204H98.6338V24.4094H97.3228V20.4881L96 20.37V19.1771H97.3228V13.933H98.6338V12.622H99.9449V11.311H101.268V10H111.968Z"
                    fill="#000B04"
                    style={{
                        transformOrigin: 'center',
                        transition: 'transform 0.1s ease-out'
                    }}
                />
            </g>
            <defs>
                <clipPath id="clip0_2818_5309">
                    <rect width="133.333" height="40" fill="white"/>
                </clipPath>
            </defs>
        </svg>
    );

    const renderInvertedSVG = () => (
        <svg
            ref={svgRef}
            width="134"
            height="40"
            viewBox="0 0 134 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={getSVGStyle()}
        >
            <g clipPath="url(#clip0_2818_5310)">
                {/* Right Eye (white part) - was oeil 2 */}
                <path
                    d="M85.1086 34.6021V33.1952H78.7612V31.6111H75.7592V30.027H72.591V28.443H71.0069V26.8589H69.4118L69.4228 25.452H68.0049V16.1248H69.4228L69.4118 14.5407L71.0069 14.5518V12.9566L72.591 12.9677V11.3836H75.7592V9.79956H78.7612V8.39272H83.5245V6.80864H92.8628V5.22456H106.787V6.80864H116.137V8.39272H120.723V9.79956H125.475V11.3836H126.893V12.9677H130.061V16.1248H131.645V19.1157L133.24 19.2265V20.6998H131.645V25.452H130.061V26.8589H128.477V28.443H126.893V30.027H123.891V31.6111H120.723V33.1952H114.553V34.6021H85.1086Z"
                    fill="#F4FFF6"
                />

                {/* Right Eye Pupil (black part that follows cursor) */}
                <path
                    ref={rightPupilRef}
                    d="M89.3544 30V28.689H88.0434V27.378H86.7206V26.067H85.4096V22.1339H84.0985V19.5119H85.4096V15.5906H86.7206V14.2796H88.0434V12.9686H89.3544V11.6576H93.4883V10.1576H96.1103V11.6576H100.055V12.9686H101.378L101.366 14.2796H102.689V15.5906H104V26.067H102.689V27.378H101.366L101.378 28.689H100.055V30H89.3544Z"
                    fill="#000B04"
                    style={{
                        transformOrigin: 'center',
                        transition: 'transform 0.1s ease-out'
                    }}
                />

                {/* Left Eye (white part) - was oeil 1 */}
                <path
                    d="M17.1048 34.6021V33.1952H10.9346V31.6111H7.76644V30.027H4.5872V28.443H3.18035V26.8589H1.59628V25.452H0.00112232V16.1248H1.59628V14.5407L3.18035 14.5518V12.9566L4.5872 12.9677V11.3836H7.76644V9.79956H10.9346V8.39272H15.5207V6.80864H24.859V5.22456H38.7945V6.80864H48.1328V8.39272H52.8961V9.79956H57.4822V11.3836H59.0663V12.9677H62.0572V16.1248H63.6523V25.452H62.0572L62.0683 26.8589H60.6503V28.443H59.0663V30.027H55.887V31.6111H52.8961V33.1952H46.5487V34.6021H17.1048Z"
                    fill="#F4FFF6"
                />

                {/* Left Eye Pupil (black part that follows cursor) */}
                <path
                    ref={leftPupilRef}
                    d="M21.3656 30V28.689H20.0546V27.378H18.7435V26.067H17.4207V22.1339H16.1097V19.5119H17.4207V15.5906H18.7435V14.2796H20.0546V12.9686H21.3656V11.6576H25.3104V10.1576H28.1332V11.6576H32.0663V12.9686H33.3891V14.2796H34.7001V15.5906H36.0112V19.5119L37.334 19.63V20.8229H36.0112V26.067H34.7001V27.378H33.3891V28.689H32.0663V30H21.3656Z"
                    fill="#000B04"
                    style={{
                        transformOrigin: 'center',
                        transition: 'transform 0.1s ease-out'
                    }}
                />
            </g>
            <defs>
                <clipPath id="clip0_2818_5310">
                    <rect width="133.333" height="40" fill="white" transform="matrix(-1 0 0 -1 133.334 40)"/>
                </clipPath>
            </defs>
        </svg>
    );

    return (
        <div className={`following-eyes ${className}`}>
            {variant === "inverted" ? renderInvertedSVG() : renderNormalSVG()}
        </div>
    );
};

export default FollowingEyes;