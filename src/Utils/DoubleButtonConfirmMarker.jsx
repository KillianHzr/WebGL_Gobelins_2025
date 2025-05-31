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
    const [buttonsOpacity, setButtonsOpacity] = useState(1);
    const [leftHovered, setLeftHovered] = useState(false);
    const [rightHovered, setRightHovered] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showActionState, setShowActionState] = useState(false); // Nouvel état pour contrôler l'affichage

    // Animation de disparition/réapparition des boutons avec opacité
    const animateButtons = useCallback((isThirdClick = false) => {
        if (isAnimating) return;

        setIsAnimating(true);
        setButtonsOpacity(0);

        // Réapparition après 2000ms (2 secondes)
        setTimeout(() => {
            // Si c'est le 3ème clic, changer l'état d'affichage maintenant
            if (isThirdClick) {
                setShowActionState(true);
            }
            setButtonsOpacity(1);
            setIsAnimating(false);
        }, 2000);
    }, [isAnimating]);

    // Gestion du clic sur "arrête le massacre"
    const handleMassacreClick = useCallback((e) => {
        stopAllPropagation(e);

        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        console.log(`Clic sur "Arrête le massacre" - ${newClickCount}/3`);

        // Animation pour tous les clics, avec indication si c'est le 3ème
        const isThirdClick = newClickCount >= 3;
        animateButtons(isThirdClick);

        if (isThirdClick) {
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
                className="double-button-container"
                style={{
                    opacity: buttonsOpacity,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: buttonsOpacity === 0 ? 'none' : 'auto'
                }}
            >
                {/* Bouton de gauche - Style marker-button */}
                <div className="marker-button confirm left-marker">
                    <div
                        className={`marker-button-inner confirm ${leftHovered ? 'marker-button-inner-hovered' : ''} ${showActionState ? 'action-state' : 'massacre-state'}`}
                        style={{
                            pointerEvents: buttonsOpacity === 0 ? 'none' : 'auto'
                        }}
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
                        onClick={showActionState ? handleActionClick : handleMassacreClick}
                    >
                        <div className="marker-button-inner-text confirm">
                            {showActionState ? text : "Arrête le massacre"}
                        </div>
                    </div>
                </div>

                {/* Bouton de droite - Style marker-button */}
                <div
                    className={`marker-button confirm right-marker`}
                    style={{
                        opacity: 1,
                        transition: 'all 0.4s ease'
                    }}
                >
                    <div
                        className={`marker-button-inner confirm ${rightHovered ? 'marker-button-inner-hovered' : ''} action-state`}
                        style={{
                            pointerEvents: buttonsOpacity === 0 ? 'none' : 'auto'
                        }}
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