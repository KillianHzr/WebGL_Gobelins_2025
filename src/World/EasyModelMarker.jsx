import React, { useRef, useState, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { ModelMarker, INTERACTION_TYPES } from '../Utils/EnhancedObjectMarker';
import { EventBus } from '../Utils/EventEmitter';
import MARKER_EVENTS from "../Utils/EventEmitter.jsx";
import { audioManager } from '../Utils/AudioManager';
import OutlineEffect from '../Utils/OutlineEffect';
import GlowEffectDebug from '../Utils/GlowEffectDebug';
import useStore from '../Store/useStore';
import { textureManager } from '../Config/TextureManager';

/**
 * Composant simple pour ajouter un marqueur à n'importe quel modèle 3D
 */
export default function EasyModelMarker({
                                            // Props du modèle
                                            modelPath = null,
                                            position = [0, 0, 0],
                                            scale = [1, 1, 1],
                                            rotation = [0, 0, 0],
                                            color = "#5533ff",

                                            // Props du marqueur
                                            markerId = `marker-${Math.random().toString(36).substr(2, 9)}`,
                                            markerType = INTERACTION_TYPES.CLICK,
                                            markerText = "Interagir",
                                            markerColor = "#44ff44",
                                            markerOffset = 0.8,
                                            markerAxis = 'y',
                                            alwaysVisible = false,

                                            // Props de callback
                                            onInteract = null,

                                            // Props avancées
                                            modelProps = {},
                                            nodeProps = {},
                                            useBox = false,
                                            playSound = true,

                                            // Props d'effet visuel
                                            showOutline = true,
                                            outlineColor = "#ffffff",
                                            outlineThickness = 1.5,
                                            outlineIntensity = 1,
                                            outlinePulse = true,
                                            outlinePulseSpeed = 2,

                                            // Props d'interaction spécifiques
                                            requiredStep = null,

                                            // Props pour les textures
                                            textureModelId = null,
                                            useTextures = true,

                                            // Props pour enfants personnalisés
                                            children,
                                        }) {
    const modelRef = useRef();
    const [hovered, setHovered] = useState(false);
    const [active, setActive] = useState(false);
    const [isMarkerHovered, setIsMarkerHovered] = useState(false);

    // Accéder à l'état d'interaction global
    const interaction = useStore(state => state.interaction);
    const [isWaitingForInteraction, setIsWaitingForInteraction] = useState(false);
    const [isInteractionCompleted, setIsInteractionCompleted] = useState(false);

    // Charger le modèle GLTF si un chemin est fourni
    const gltf = modelPath ? useGLTF(modelPath) : null;

    // Utiliser le composant de debug pour l'effet de glow
    const { effectSettings, updateEffectRef } = GlowEffectDebug({ objectRef: modelRef });

    // Gestion des textures
    useEffect(() => {
        // Vérifier si l'objet a un modèle 3D et si nous devons appliquer des textures
        if (modelRef.current && gltf && useTextures && textureModelId) {
            // Appliquer les textures au modèle
            const applyTextures = async () => {
                try {
                    await textureManager.applyTexturesToModel(textureModelId, modelRef.current);
                    console.log(`[EasyModelMarker] Textures appliquées à ${markerId} (${textureModelId})`);
                } catch (error) {
                    console.error(`[EasyModelMarker] Erreur lors de l'application des textures:`, error);
                }
            };

            applyTextures();
        }
    }, [gltf, modelRef.current, useTextures, textureModelId, markerId]);

    // Personnaliser les paramètres d'effet
    useEffect(() => {
        if (updateEffectRef && updateEffectRef.current) {
            updateEffectRef.current.color = outlineColor;
            updateEffectRef.current.thickness = outlineThickness;
            updateEffectRef.current.intensity = outlineIntensity;
            // Désactiver complètement la pulsation si outlinePulse est false
            updateEffectRef.current.pulseSpeed = outlinePulse ? outlinePulseSpeed : 0;

            // Force une mise à jour immédiate pour arrêter tout mouvement existant
            if (!outlinePulse && updateEffectRef.current.pulseRef) {
                updateEffectRef.current.pulseRef.current = { value: 0, direction: 0 };
            }
        }
    }, [outlineColor, outlineThickness, outlineIntensity, outlinePulseSpeed, outlinePulse, updateEffectRef]);

    // Surveiller l'état d'interaction pour activer l'effet de glow
    useEffect(() => {
        // Vérifier si ce modèle est l'objet qui nécessite une interaction
        const isCurrentInteractionTarget = interaction?.waitingForInteraction &&
            (requiredStep ? interaction.currentStep === requiredStep : false);

        setIsWaitingForInteraction(isCurrentInteractionTarget);

        if (isCurrentInteractionTarget) {
            console.log(`[EasyModelMarker] ${markerId} is waiting for interaction: ${interaction.currentStep}`);
        }
    }, [interaction?.waitingForInteraction, interaction?.currentStep, requiredStep, markerId]);

    // Réinitialiser l'état d'interaction complétée lorsque l'étape change
    useEffect(() => {
        if (interaction && interaction.currentStep) {
            setIsInteractionCompleted(false);
        }
    }, [interaction?.currentStep]);

    // Gérer l'interaction avec le marqueur
    const handleMarkerInteraction = (eventData = {}) => {
        console.log(`Interaction avec le marqueur ${markerId}:`, eventData);

        // Jouer un son si activé
        if (playSound && audioManager) {
            const soundType = markerType.includes('drag') ? 'drag' : 'click';
            const fadeTime = markerType.includes('drag') ? 800 :
                markerType === INTERACTION_TYPES.LONG_PRESS ? 400 : 0;

            audioManager.playSound(soundType, {
                volume: 0.8,
                fade: markerType.includes('drag') || markerType === INTERACTION_TYPES.LONG_PRESS,
                fadeTime
            });
        }

        // Vérifier si l'interaction est attendue et la compléter
        if (interaction?.waitingForInteraction && isWaitingForInteraction) {
            interaction.completeInteraction();
            console.log(`Interaction ${markerId} complétée via ${eventData.type || markerType}`);

            // Mettre à jour l'état
            setIsInteractionCompleted(true);
        }

        // Appeler le callback personnalisé
        if (onInteract) {
            onInteract(eventData);
        }

        // Émettre l'événement d'interaction complète
        EventBus.trigger(MARKER_EVENTS.INTERACTION_COMPLETE, {
            id: markerId,
            type: markerType
        });
    };

    // Fonction pour déterminer si le contour doit être affiché
    const shouldShowOutline = () => {
        // Ne pas afficher le contour si le marqueur est survolé ou si showOutline est false
        if (isMarkerHovered || !showOutline) {
            return false;
        }

        // Si un requiredStep est spécifié, vérifier si nous sommes à cette étape
        // avant de montrer l'outline au survol
        if (requiredStep) {
            const isCorrectStep = interaction?.currentStep === requiredStep &&
                interaction?.waitingForInteraction;

            // Afficher le contour seulement si:
            // - L'objet est en attente d'interaction (isWaitingForInteraction)
            // - OU si alwaysVisible est true
            // - OU si l'objet est survolé ET que nous sommes à la bonne étape d'interaction
            return isWaitingForInteraction || alwaysVisible || (hovered && isCorrectStep);
        } else {
            // Comportement par défaut pour les objets sans requiredStep
            return isWaitingForInteraction || alwaysVisible || hovered;
        }
    };

    // Handlers pour le survol du marqueur
    const handleMarkerPointerEnter = (e) => {
        console.log(`[EasyModelMarker] Marker ${markerId} hover enter`);
        setIsMarkerHovered(true);
        // S'assurer que la visibilité du marqueur est correctement gérée
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
    };

    const handleMarkerPointerLeave = (e) => {
        console.log(`[EasyModelMarker] Marker ${markerId} hover leave`);
        setIsMarkerHovered(false);
        // S'assurer que la visibilité du marqueur est correctement gérée
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }
    };

    return (
        <ModelMarker
            id={markerId}
            markerType={markerType}
            markerColor={markerColor}
            markerText={markerText}
            onInteract={handleMarkerInteraction}
            positionOptions={{
                offset: markerOffset,
                preferredAxis: markerAxis
            }}
            // Montrer le marqueur uniquement si en attente d'interaction et que l'interaction n'est pas encore complétée
            alwaysVisible={false}
            requiredStep={requiredStep}
            onPointerEnter={handleMarkerPointerEnter}
            onPointerLeave={handleMarkerPointerLeave}
            showMarkerOnHover={true}
        >
            {/* Si children est fourni, utiliser les enfants personnalisés */}
            {children ? (
                <>
                    {React.Children.map(children, child =>
                        React.cloneElement(child, { ref: modelRef })
                    )}

                    {/* Ajouter l'effet de contour */}
                    {active ? null : (
                        <OutlineEffect
                            objectRef={modelRef}
                            active={shouldShowOutline()}
                            color={effectSettings.color}
                            thickness={effectSettings.thickness}
                            intensity={effectSettings.intensity}
                            pulseSpeed={outlinePulse ? effectSettings.pulseSpeed : 0}
                            ref={updateEffectRef}
                        />
                    )}
                </>
            ) : (
                <>
                    {/* Si useBox est true, utiliser une boxGeometry */}
                    {useBox ? (
                        <mesh
                            ref={modelRef}
                            position={position}
                            rotation={rotation}
                            scale={scale}
                            onPointerOver={() => setHovered(true)}
                            onPointerOut={() => setHovered(false)}
                            castShadow
                            {...modelProps}
                        >
                            <boxGeometry args={[1, 1, 1]} />
                            <meshStandardMaterial color={color} />
                        </mesh>
                    ) : (
                        /* Sinon, si un chemin de modèle est fourni et qu'il est chargé, utiliser le modèle */
                        modelPath && gltf ? (
                            <primitive
                                ref={modelRef}
                                object={gltf.scene}
                                position={position}
                                rotation={rotation}
                                scale={scale}
                                onPointerOver={() => setHovered(true)}
                                onPointerOut={() => setHovered(false)}
                                castShadow
                                {...modelProps}
                                {...nodeProps}
                            />
                        ) : null
                    )}

                    {/* Ajouter l'effet de contour */}
                    {active ? null : (
                        <OutlineEffect
                            objectRef={modelRef}
                            active={shouldShowOutline()}
                            color={effectSettings.color}
                            thickness={effectSettings.thickness}
                            intensity={effectSettings.intensity}
                            pulseSpeed={outlinePulse ? effectSettings.pulseSpeed : 0}
                            ref={updateEffectRef}
                        />
                    )}
                </>
            )}
        </ModelMarker>
    );
}