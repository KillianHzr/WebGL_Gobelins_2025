// src/Components/ModelMarker.jsx
import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import useMarkerSystem from '../Hooks/useMarkerSystem';
import ObjectMarker from '../Utils/ObjectMarker';
import useStore from '../Store/useStore';
import { EventBus } from '../Utils/EventEmitter';
import { MARKER_EVENTS } from '../Utils/markerEvents';
import EnhancedObjectMarker, { INTERACTION_TYPES } from '../Utils/EnhancedObjectMarker';
import { audioManager } from '../Utils/AudioManager';

/**
 * Composant qui ajoute un marqueur interactif à n'importe quel modèle 3D
 */
const ModelMarker = ({
                         children,                  // Le modèle à envelopper
                         id = 'model-marker',       // Identifiant unique du marqueur
                         interactionType = 'click', // Type d'interaction (click, drag, etc.)
                         requiredStep = null,       // Étape requise pour l'interaction
                         markerColor = '#44ff44',   // Couleur du marqueur
                         markerScale = 1,           // Échelle du marqueur
                         markerText = 'Interagir',  // Texte affiché sur le marqueur
                         enableInteraction = true,  // Activer les interactions
                         showMarkerOnHover = true,  // Montrer le marqueur au survol
                         onInteract = null,         // Callback lors de l'interaction
                         positionOptions = {},      // Options de positionnement du marqueur
                         customMarker = null,       // Marqueur personnalisé
                         debug = false,             // Mode debug
                         alwaysVisible = false,     // Toujours afficher le marqueur, même sans survol
                         markerType = null,         // Type de marqueur spécifique (pour EnhancedObjectMarker)
                         ...props                   // Autres props à passer au groupe
                     }) => {
    const modelRef = useRef();
    const { interaction } = useStore();

    // État pour suivre si l'objet est survolé
    const [isHovered, setHovered] = useState(false);
    const [isMarkerHovered, setMarkerHovered] = useState(false);

    // État pour mémoriser si le marqueur doit rester visible
    const [keepMarkerVisible, setKeepMarkerVisible] = useState(false);

    // Déterminer le vrai type d'interaction (compatible avec INTERACTION_TYPES)
    const resolveInteractionType = () => {
        // Si markerType est spécifié, l'utiliser directement
        if (markerType) return markerType;

        // Sinon, convertir interactionType vers le format INTERACTION_TYPES
        if (interactionType.includes('drag')) {
            if (interactionType.includes('left')) return INTERACTION_TYPES.DRAG_LEFT;
            if (interactionType.includes('right')) return INTERACTION_TYPES.DRAG_RIGHT;
            if (interactionType.includes('up')) return INTERACTION_TYPES.DRAG_UP;
            if (interactionType.includes('down')) return INTERACTION_TYPES.DRAG_DOWN;
            return INTERACTION_TYPES.DRAG_RIGHT; // Par défaut
        }
        if (interactionType.includes('long') || interactionType.includes('press')) {
            return INTERACTION_TYPES.LONG_PRESS;
        }
        return INTERACTION_TYPES.CLICK;
    };

    // Type d'interaction effectif
    const actualInteractionType = resolveInteractionType();

    // Utiliser le hook de système de marqueur
    const {
        hovered,
        markerVisible,
        handleMarkerClick,
        markerProps,
        setMarkerVisible
    } = useMarkerSystem(modelRef, {
        id,
        markerType: actualInteractionType,
        markerColor,
        markerText,
        markerScale,
        interactionType,
        requiredInteractionStep: requiredStep,
        autoShowMarker: showMarkerOnHover,
        onInteractionComplete: onInteract,
        enableRaycast: enableInteraction,
        debugMode: debug,
        ...positionOptions
    });

    // Forcer l'affichage du marqueur si alwaysVisible est true
    useEffect(() => {
        if (alwaysVisible) {
            setKeepMarkerVisible(true);
            setMarkerVisible(true);
        }
    }, [alwaysVisible, setMarkerVisible]);

    // Vérifier si le marqueur doit être affiché basé sur l'état d'interaction
    useEffect(() => {
        const isRequiredForInteraction = interaction?.waitingForInteraction &&
            (!requiredStep || interaction.currentStep === requiredStep);

        if (isRequiredForInteraction) {
            setKeepMarkerVisible(true);
            setMarkerVisible(true);
        } else if (!alwaysVisible && !isHovered && !isMarkerHovered) {
            setKeepMarkerVisible(false);
        }
    }, [interaction?.waitingForInteraction, interaction?.currentStep, requiredStep, alwaysVisible, isHovered, isMarkerHovered]);

    // Le marqueur devrait être visible si:
    // 1. Il est explicitement défini comme toujours visible
    // 2. Il est actuellement survolé
    // 3. Il est nécessaire pour une interaction
    // 4. keekMarkerVisible a été défini à true
    const shouldShowMarker =
        alwaysVisible ||
        markerVisible ||
        isHovered ||
        isMarkerHovered ||
        keepMarkerVisible ||
        (interaction?.waitingForInteraction && (!requiredStep || interaction.currentStep === requiredStep));

    // Gérer le survol du marqueur
    const handleMarkerPointerEnter = () => {
        setIsMarkerHovered(true);
        setKeepMarkerVisible(true); // Garder le marqueur visible
    };

    const handleMarkerPointerLeave = () => {
        setIsMarkerHovered(false);
        // Le marqueur reste visible grâce à keepMarkerVisible
    };

    // Gérer l'interaction avec le marqueur (clic, drag, long press)
    // Gérer l'interaction avec le marqueur (clic, drag, long press)
    const handleInteraction = (eventData = {}) => {
        if (debug) {
            console.log(`[ModelMarker] Interaction détectée:`, eventData);
        }

        // Type d'interaction reçu
        const eventType = eventData.type || actualInteractionType || 'click';

        // Déterminer quel son jouer
        let soundType = 'click';
        if (eventType.includes('drag')) {
            soundType = 'drag';
        } else if (eventType === 'longPress') {
            soundType = 'click'; // Ou son spécifique
        }

        // Jouer le son
        if (audioManager) {
            audioManager.playSound(soundType, {
                volume: 0.8,
                fade: eventType !== 'click',
                fadeTime: eventType.includes('drag') ? 800 : 400
            });
        }

        // Vérification directe: est-ce que le type reçu correspond exactement à ce qui est attendu?
        const isCorrectInteractionType = actualInteractionType === eventType;

        // Appeler le callback onInteract si fourni, en transmettant les données exactes
        if (onInteract) {
            onInteract(eventData);
        }

        // Compléter l'interaction si on est dans le bon contexte et avec le bon type
        if (interaction?.waitingForInteraction &&
            (!requiredStep || interaction.currentStep === requiredStep) &&
            isCorrectInteractionType) {

            interaction.completeInteraction();

            if (debug) {
                console.log(`[ModelMarker] Interaction complétée: ${requiredStep || 'aucune étape spécifiée'} (type: ${eventType})`);
            }

            // Émettre un événement
            EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
                id,
                type: actualInteractionType
            });

            // Réinitialiser l'état du marqueur
            setKeepMarkerVisible(false);
        } else if (interaction?.waitingForInteraction && !isCorrectInteractionType) {
            console.log(`[ModelMarker] Type d'interaction incorrect: attendu ${actualInteractionType}, reçu ${eventType}`);
        }
    };

    return (
        <group ref={modelRef} {...props}>
            {/* Le modèle / mesh à envelopper */}
            {React.Children.map(children, child =>
                React.cloneElement(child, {
                    onPointerOver: () => setHovered(true),
                    onPointerOut: () => setHovered(false)
                })
            )}

            {/* Marqueur interactif amélioré */}
            {shouldShowMarker && (
                <EnhancedObjectMarker
                    objectRef={modelRef}
                    markerType={actualInteractionType}
                    hovered={true} // Forcé à true car shouldShowMarker est déjà vérifié
                    color={markerColor}
                    scale={markerScale}
                    text={markerText}
                    onClick={handleInteraction}
                    positionOptions={{
                        alwaysBetweenCameraAndObject: true,
                        ...positionOptions
                    }}
                    custom={customMarker}
                    id={id}
                    animate={true}
                    pulseAnimation={true}
                    keepVisible={true}
                    onPointerEnter={handleMarkerPointerEnter}
                    onPointerLeave={handleMarkerPointerLeave}
                />
            )}
        </group>
    );
};

export default ModelMarker;