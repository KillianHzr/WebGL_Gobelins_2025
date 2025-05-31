import React, {useCallback, useState} from "react";
import {Html} from "@react-three/drei";

const DoubleButtonConfirmMarker = React.memo(function DoubleButtonConfirmMarker({
                                                                                    id,
                                                                                    text,
                                                                                    buttonHovered,
                                                                                    setButtonHovered,
                                                                                    onClick,
                                                                                    onPointerEnter,
                                                                                    onPointerLeave,
                                                                                    stopAllPropagation,
                                                                                    EventBus,
                                                                                    MARKER_EVENTS
                                                                                }) {
    const [clickCount, setClickCount] = useState(0);
    const [buttonsVisible, setButtonsVisible] = useState(true);
    const [leftHovered, setLeftHovered] = useState(false);
    const [rightHovered, setRightHovered] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Animation de disparition/réapparition des boutons
    const animateButtons = useCallback(() => {
        if (isAnimating) return;

        setIsAnimating(true);
        setButtonsVisible(false);

        // Réapparition après 500ms
        setTimeout(() => {
            setButtonsVisible(true);
            setIsAnimating(false);
        }, 500);
    }, [isAnimating]);

    // Gestion du clic sur "arrête le massacre"
    const handleMassacreClick = useCallback((e) => {
        stopAllPropagation(e);

        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        console.log(`Clic sur "Arrête le massacre" - ${newClickCount}/3`);

        if (newClickCount < 3) {
            // Première et deuxième fois : animer la disparition/réapparition
            animateButtons();
        } else {
            // Troisième fois : les boutons restent et deviennent des boutons d'action
            console.log("Transformation en boutons d'action !");
        }
    }, [clickCount, animateButtons, stopAllPropagation]);

    // Gestion du clic sur les boutons d'action (après 3 clics)
    const handleActionClick = useCallback((e) => {
        stopAllPropagation(e);

        console.log("Clic sur bouton d'action - ouverture interface");

        if (onClick) {
            onClick({
                type: 'confirm'
            });
        }

        // Émettre l'événement d'interaction complète
        EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
            id,
            type: 'confirm'
        });
    }, [onClick, id, stopAllPropagation, EventBus, MARKER_EVENTS]);

    return (
        <Html
            className="marker-button confirm double-button"
            position={[0, 0, 0.002]}
            center
        >
            <div
                className={`double-button-container ${buttonsVisible ? 'visible' : 'hidden'} ${isAnimating ? 'animating' : ''}`}>
                {/* Bouton de gauche - Style marker-button */}
                <div className="marker-button confirm left-marker">
                    <div
                        className={`marker-button-inner confirm ${leftHovered ? 'marker-button-inner-hovered' : ''} ${clickCount >= 3 ? 'action-state' : 'massacre-state'}`}
                        onMouseEnter={(e) => {
                            stopAllPropagation(e);
                            setLeftHovered(true);
                            if (onPointerEnter) onPointerEnter(e);
                        }}
                        onMouseLeave={(e) => {
                            stopAllPropagation(e);
                            setLeftHovered(false);
                            if (onPointerLeave) onPointerLeave(e);
                        }}
                        onClick={clickCount >= 3 ? handleActionClick : handleMassacreClick}
                    >
                        <div className="marker-button-inner-text confirm">
                            {clickCount >= 3 ? text : "Arrête le massacre"}
                        </div>
                    </div>
                </div>

                {/* Bouton de droite - Style marker-button */}
                <div
                    className={`marker-button confirm right-marker`}
                    style={{
                        opacity: 1,
                        // transform: clickCount >= 3 ? 'scale(1)' : 'scale(0.8)',
                        transition: 'all 0.4s ease'
                    }}
                >
                    <div
                        className={`marker-button-inner confirm ${rightHovered ? 'marker-button-inner-hovered' : ''} action-state`}
                        onMouseEnter={(e) => {
                            stopAllPropagation(e);
                            setRightHovered(true);
                            if (onPointerEnter) onPointerEnter(e);
                        }}
                        onMouseLeave={(e) => {
                            stopAllPropagation(e);
                            setRightHovered(false);
                            if (onPointerLeave) onPointerLeave(e);
                        }}
                        onClick={handleActionClick}

                    >
                        <div className="marker-button-inner-text confirm">
                            {text}
                        </div>
                    </div>
                </div>
            </div>
        </Html>
    );
});

export default DoubleButtonConfirmMarker;