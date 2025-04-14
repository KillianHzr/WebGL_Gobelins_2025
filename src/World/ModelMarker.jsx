// src/Components/ModelMarker.jsx
import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import useMarkerSystem from '../Hooks/useMarkerSystem';
import ObjectMarker from '../Utils/ObjectMarker';
import useStore from '../Store/useStore';

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
                         ...props                   // Autres props à passer au groupe
                     }) => {
    const modelRef = useRef();
    const { interaction } = useStore();

    // Utiliser le hook de système de marqueur
    const {
        hovered,
        markerVisible,
        handleMarkerClick,
        markerProps,
        setMarkerVisible
    } = useMarkerSystem(modelRef, {
        id,
        markerType: interactionType,
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
            setMarkerVisible(true);
        }
    }, [alwaysVisible]);

    // Vérifier si le marqueur doit être affiché basé sur l'état d'interaction
    const shouldShowMarker =
        alwaysVisible ||
        (markerVisible && (
            !requiredStep ||
            (interaction?.waitingForInteraction && interaction.currentStep === requiredStep)
        ));

    // Ajouter des logs en mode debug
    useEffect(() => {
        if (debug) {
            console.log(`[ModelMarker] Initialized: ${id}`);
            console.log(`[ModelMarker] Required step: ${requiredStep || 'any'}`);
        }
    }, []);

    return (
        <group ref={modelRef} {...props}>
            {/* Le modèle / mesh à envelopper */}
            {children}

            {/* Marqueur interactif */}
            {shouldShowMarker && (
                <ObjectMarker
                    objectRef={modelRef}
                    markerType={interactionType}
                    hovered={true} // Forcé à true car shouldShowMarker est déjà vérifié
                    color={markerColor}
                    scale={markerScale}
                    text={markerText}
                    onClick={handleMarkerClick}
                    positionOptions={{
                        alwaysBetweenCameraAndObject: true,
                        ...positionOptions
                    }}
                    custom={customMarker}
                />
            )}
        </group>
    );
};

export default ModelMarker;