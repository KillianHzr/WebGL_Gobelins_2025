import React, {useCallback, useState, useEffect} from "react";
import {Html} from "@react-three/drei";
import {narrationManager} from "./NarrationManager";

// Stockage global pour persister l'état des interactions CONFIRM
const confirmInteractionStates = new Map();

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

    // Fonction pour obtenir l'état persistant
    const getPersistentState = useCallback(() => {
        if (!confirmInteractionStates.has(id)) {
            confirmInteractionStates.set(id, {
                clickCount: 0,
                showActionState: false,
                isCompleted: false
            });
        }
        return confirmInteractionStates.get(id);
    }, [id]);

    // Fonction pour mettre à jour l'état persistant
    const updatePersistentState = useCallback((updates) => {
        const currentState = getPersistentState();
        const newState = { ...currentState, ...updates };
        confirmInteractionStates.set(id, newState);
        return newState;
    }, [id, getPersistentState]);

    // États locaux basés sur l'état persistant
    const persistentState = getPersistentState();
    const [clickCount, setClickCount] = useState(persistentState.clickCount);
    const [showActionState, setShowActionState] = useState(persistentState.showActionState);
    const [isCompleted, setIsCompleted] = useState(persistentState.isCompleted);

    // États locaux pour l'UI
    const [buttonsOpacity, setButtonsOpacity] = useState(1);
    const [leftHovered, setLeftHovered] = useState(false);
    const [rightHovered, setRightHovered] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Synchroniser l'état local avec l'état persistant au montage
    useEffect(() => {
        const state = getPersistentState();
        setClickCount(state.clickCount);
        setShowActionState(state.showActionState);
        setIsCompleted(state.isCompleted);
    }, [getPersistentState]);

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
                updatePersistentState({ showActionState: true });
            }
            setButtonsOpacity(1);
            setIsAnimating(false);
        }, 2000);
    }, [isAnimating, updatePersistentState]);

    // Gestion du clic sur "arrête le massacre"
    const handleMassacreClick = useCallback((e) => {
        stopAllPropagation(e);

        // Si déjà complété, ne pas permettre de nouvelles interactions
        if (isCompleted) return;

        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        // Mettre à jour l'état persistant
        updatePersistentState({ clickCount: newClickCount });

        console.log(`Clic sur "Arrête le massacre" - ${newClickCount}/3`);

        // NOUVEAU : Déclencher les narrations selon le nombre de clics
        try {
            switch (newClickCount) {
                case 1:
                    console.log("Déclenchement narration Scene10_Photo1");
                    narrationManager.playNarration('Scene10_Photo1');
                    break;
                case 2:
                    console.log("Déclenchement narration Scene10_Photo2");
                    narrationManager.playNarration('Scene10_Photo2');
                    break;
                case 3:
                    console.log("Déclenchement narration Scene10_Photo3");
                    narrationManager.playNarration('Scene10_Photo3');
                    break;
                default:
                    console.log(`Aucune narration définie pour le clic ${newClickCount}`);
            }
        } catch (error) {
            console.error("Erreur lors du déclenchement de la narration:", error);
        }

        // Animation pour tous les clics, avec indication si c'est le 3ème
        const isThirdClick = newClickCount >= 3;
        animateButtons(isThirdClick);

        if (isThirdClick) {
            console.log("Transformation en boutons d'action !");
        }
    }, [clickCount, animateButtons, stopAllPropagation, isCompleted, updatePersistentState]);

    // Gestion du clic sur les boutons d'action (après 3 clics)
    const handleActionClick = useCallback((e) => {
        stopAllPropagation(e);

        console.log("Clic sur bouton d'action - ouverture interface");

        // Marquer comme complété dans l'état persistant
        setIsCompleted(true);
        updatePersistentState({ isCompleted: true });

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
    }, [onClick, id, stopAllPropagation, EventBus, MARKER_EVENTS, updatePersistentState]);

    // Écouter les événements de réinitialisation si nécessaire
    useEffect(() => {
        const handleReset = (data) => {
            if (data.markerId === id) {
                console.log(`Réinitialisation de l'état pour ${id}`);
                setClickCount(0);
                setShowActionState(false);
                setIsCompleted(false);
                updatePersistentState({
                    clickCount: 0,
                    showActionState: false,
                    isCompleted: false
                });
            }
        };

        // Écouter un événement de réinitialisation si nécessaire
        const cleanup = EventBus.on('reset-confirm-interaction', handleReset);
        return cleanup;
    }, [id, EventBus, updatePersistentState]);

    // Si l'interaction est complétée, ne plus afficher le composant
    if (isCompleted) {
        return null;
    }

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
                            {/* Afficher le compteur de clics en mode debug */}
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

// Fonction utilitaire pour réinitialiser l'état d'un marqueur spécifique
export const resetConfirmInteraction = (markerId) => {
    if (confirmInteractionStates.has(markerId)) {
        confirmInteractionStates.delete(markerId);
        console.log(`État réinitialisé pour le marqueur ${markerId}`);
    }
};

// Fonction utilitaire pour obtenir l'état actuel d'un marqueur
export const getConfirmInteractionState = (markerId) => {
    return confirmInteractionStates.get(markerId) || {
        clickCount: 0,
        showActionState: false,
        isCompleted: false
    };
};

export default DoubleButtonConfirmMarker;