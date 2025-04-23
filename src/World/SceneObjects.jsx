import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {useAnimations, useGLTF} from '@react-three/drei';
import EasyModelMarker from './EasyModelMarker';
import sceneObjectManager from '../Config/SceneObjectManager';
import { textureManager } from '../Config/TextureManager';
import useStore from '../Store/useStore';
import { EventBus } from '../Utils/EventEmitter';
import MARKER_EVENTS from "../Utils/EventEmitter";

// Activer ou désactiver les logs pour le débogage
const DEBUG_SCENE_OBJECTS = false;

// Helper pour les logs conditionnels
const debugLog = (message, ...args) => {
    if (DEBUG_SCENE_OBJECTS) console.log(`[SceneObjects] ${message}`, ...args);
};

/**
 * Composant pour afficher un objet statique individuel avec textures
 * Version optimisée pour éviter les problèmes de performance
 */
const StaticObject = React.memo(function StaticObject({
                                                          path,
                                                          position,
                                                          rotation,
                                                          scale,
                                                          castShadow = true,
                                                          receiveShadow = true,
                                                          visible = true,
                                                          textureModelId = null,
                                                          useTextures = true,
                                                          // Nouvelles propriétés pour les animations
                                                          playAnimation = false,
                                                          animationName = null,
                                                          animationLoop = true,
                                                          animationClamp = false,
                                                          animationTimeScale = 1.0,
                                                          onAnimationComplete = null
                                                      }) {
    const objectRef = useRef();
    const isComponentMounted = useRef(true);
    const animationRef = useRef(null);
    const currentAnimationRef = useRef(null);

    // Utiliser useMemo pour éviter de recharger le modèle à chaque re-render
    const { scene: modelScene, animations } = useGLTF(path);

    // Cloner le modèle une seule fois avec useMemo
    const model = useMemo(() => modelScene.clone(), [modelScene]);

    // Utiliser useAnimations pour gérer les animations
    const { actions, mixer } = useAnimations(animations, objectRef);

    // Référence pour suivre l'état de lecture
    const animationState = useRef({
        isPlaying: false,
        currentName: null,
        loop: animationLoop,
        clamp: animationClamp,
        timeScale: animationTimeScale
    });

    // Mettre à jour l'animation lorsque les props changent
    useEffect(() => {
        if (!objectRef.current || !mixer || !actions || Object.keys(actions).length === 0) return;

        // Si l'animation doit être jouée
        if (playAnimation && animationName) {
            // Si c'est une nouvelle animation ou si l'animation était arrêtée
            if (animationName !== animationState.current.currentName || !animationState.current.isPlaying) {
                // Arrêter l'animation en cours si elle existe
                if (currentAnimationRef.current) {
                    currentAnimationRef.current.stop();
                }

                const action = actions[animationName];
                if (action) {
                    // Configurer l'animation
                    action.reset();
                    action.clampWhenFinished = animationClamp;
                    action.timeScale = animationTimeScale;
                    action.setLoop(animationLoop ? THREE.LoopRepeat : THREE.LoopOnce);

                    // Démarrer l'animation
                    action.play();

                    // Mettre à jour les références
                    currentAnimationRef.current = action;
                    animationState.current = {
                        isPlaying: true,
                        currentName: animationName,
                        loop: animationLoop,
                        clamp: animationClamp,
                        timeScale: animationTimeScale
                    };

                    debugLog(`Animation "${animationName}" démarrée sur ${textureModelId || path}`);

                    // Gérer la fin d'animation si elle n'est pas en boucle
                    if (!animationLoop && onAnimationComplete && mixer) {
                        // Nettoyer d'abord tout écouteur existant
                        if (animationRef.current) {
                            mixer.removeEventListener('finished', animationRef.current);
                        }

                        // Créer une nouvelle fonction de rappel pour cet événement spécifique
                        const finishCallback = (e) => {
                            if (isComponentMounted.current && e.action === action) {
                                debugLog(`Animation "${animationName}" terminée`);
                                animationState.current.isPlaying = false;
                                onAnimationComplete(animationName);
                            }
                        };

                        // Stocker la référence pour le nettoyage ultérieur
                        animationRef.current = finishCallback;

                        // Ajouter l'écouteur
                        mixer.addEventListener('finished', finishCallback);
                    }
                } else {
                    console.warn(`Animation "${animationName}" non trouvée dans le modèle ${textureModelId || path}`);
                }
            } else if (currentAnimationRef.current) {
                // Mettre à jour les paramètres de l'animation en cours si nécessaire
                if (animationState.current.loop !== animationLoop) {
                    currentAnimationRef.current.setLoop(animationLoop ? THREE.LoopRepeat : THREE.LoopOnce);
                    animationState.current.loop = animationLoop;
                }

                if (animationState.current.timeScale !== animationTimeScale) {
                    currentAnimationRef.current.timeScale = animationTimeScale;
                    animationState.current.timeScale = animationTimeScale;
                }

                if (animationState.current.clamp !== animationClamp) {
                    currentAnimationRef.current.clampWhenFinished = animationClamp;
                    animationState.current.clamp = animationClamp;
                }
            }
        } else if (!playAnimation && animationState.current.isPlaying && currentAnimationRef.current) {
            // Arrêter l'animation si playAnimation est passé à false
            currentAnimationRef.current.stop();
            animationState.current.isPlaying = false;
            debugLog(`Animation "${animationState.current.currentName}" arrêtée sur ${textureModelId || path}`);
        }
    }, [playAnimation, animationName, animationLoop, animationClamp, animationTimeScale, actions, mixer, path, textureModelId, onAnimationComplete]);

    // Mettre à jour le mixer d'animation à chaque frame si des animations sont en cours
    useFrame((state, delta) => {
        if (mixer && animationState.current.isPlaying) {
            mixer.update(delta);
        }
    });

    // Appliquer les textures au modèle après le montage - avec optimisations
    useEffect(() => {
        if (!objectRef.current || !useTextures || !textureModelId || !textureManager) return;

        let isApplyingTextures = true;

        const applyTextures = async () => {
            try {
                await textureManager.applyTexturesToModel(textureModelId, objectRef.current);

                // Vérifier si le composant est toujours monté avant de logger
                if (isComponentMounted.current && isApplyingTextures) {
                    debugLog(`Textures appliquées à ${textureModelId}`);
                }
            } catch (error) {
                if (isComponentMounted.current && isApplyingTextures) {
                    console.error(`Erreur lors de l'application des textures:`, error);
                }
            }
        };

        applyTextures();

        // Nettoyage
        return () => {
            isApplyingTextures = false;
        };
    }, [textureModelId, useTextures]);

    // Nettoyer lors du démontage
    useEffect(() => {
        isComponentMounted.current = true;

        return () => {
            isComponentMounted.current = false;

            // Arrêter toutes les animations en cours
            if (mixer) {
                mixer.stopAllAction();

                // Supprimer l'écouteur d'événement si présent
                if (animationRef.current) {
                    mixer.removeEventListener('finished', animationRef.current);
                }
            }
        };
    }, [mixer]);

    // Éviter les re-rendus inutiles des attributs de primitive
    const primitiveProps = useMemo(() => ({
        position,
        rotation,
        scale,
        castShadow,
        receiveShadow,
        visible
    }), [position, rotation, scale, castShadow, receiveShadow, visible]);

    return (
        <primitive
            ref={objectRef}
            object={model}
            {...primitiveProps}
        />
    );
});

/**
 * Composant pour afficher les objets statiques (non-interactifs) dans la scène
 * Version optimisée
 */
/**
 * Composant pour afficher les objets statiques (non-interactifs) dans la scène
 * Version optimisée avec support des animations
 */
export const StaticObjects = React.memo(function StaticObjects({ filter = {} }) {
    const [placements, setPlacements] = useState([]);
    const { scene } = useThree();
    const lastFilter = useRef(filter);

    // Fonction de mise à jour des placements optimisée
    const updatePlacements = useCallback(() => {
        const staticPlacements = sceneObjectManager.getStaticPlacements(filter);
        setPlacements(staticPlacements);
    }, [filter]);

    // Récupérer les placements au chargement et lorsque le filtre change
    useEffect(() => {
        // Vérifier si le filtre a changé
        if (JSON.stringify(lastFilter.current) !== JSON.stringify(filter)) {
            lastFilter.current = filter;
            updatePlacements();
        } else {
            // Mise à jour initiale
            updatePlacements();
        }
    }, [filter, updatePlacements]);

    // Optimiser le rendu avec useMemo
    const staticObjects = useMemo(() => {
        return placements.map((placement, index) => {
            const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
            if (!objectConfig) return null;

            // Obtenir les informations sur les textures
            const textureModelId = sceneObjectManager.getTextureModelId(placement.objectKey);
            const useTextures = placement.useTextures !== undefined ?
                placement.useTextures : sceneObjectManager.doesObjectUseTextures(placement.objectKey);

            const key = `static-${placement.objectKey}-${index}`;

            // Ajouter les informations d'animations si présentes
            const animationProps = placement.animation ? {
                playAnimation: placement.animation.play,
                animationName: placement.animation.name,
                animationLoop: placement.animation.loop,
                animationClamp: placement.animation.clamp,
                animationTimeScale: placement.animation.timeScale,
                onAnimationComplete: (animName) => {
                    if (placement.animation.onComplete) {
                        placement.animation.onComplete(animName, index);
                    }

                    // Si l'animation n'est pas en boucle, mettre à jour le placement pour indiquer qu'elle est terminée
                    if (!placement.animation.loop) {
                        const updatedPlacement = { ...placement };
                        updatedPlacement.animation.play = false;
                        sceneObjectManager.updatePlacement(index, updatedPlacement);

                        // Mettre à jour l'état local
                        setPlacements(prevPlacements => {
                            const newPlacements = [...prevPlacements];
                            newPlacements[index] = updatedPlacement;
                            return newPlacements;
                        });
                    }
                }
            } : {};

            return (
                <StaticObject
                    key={key}
                    path={objectConfig.path}
                    position={placement.position}
                    rotation={placement.rotation}
                    scale={placement.scale}
                    castShadow={placement.castShadow}
                    receiveShadow={placement.receiveShadow}
                    visible={placement.visible}
                    textureModelId={textureModelId}
                    useTextures={useTextures}
                    {...animationProps}
                />
            );
        });
    }, [placements, setPlacements]);

    return (
        <group name="static-objects">
            {staticObjects}
        </group>
    );
});
/**
 * Composant pour gérer et afficher les objets interactifs dans la scène
 * Version optimisée
 */
export const InteractiveObjects = React.memo(function InteractiveObjects({ filter = {} }) {
    const [placements, setPlacements] = useState([]);
    const interaction = useStore(state => state.interaction);
    const eventListenerRef = useRef(null);
    const lastFilter = useRef(filter);
    const lastInteractionStep = useRef(interaction?.currentStep);

    // Fonction de mise à jour des placements optimisée
    const updatePlacements = useCallback(() => {
        const interactivePlacements = sceneObjectManager.getInteractivePlacements(filter);
        setPlacements(interactivePlacements);
    }, [filter]);

    // Gestionnaire d'événement optimisé
    const handleInteractionComplete = useCallback(() => {
        updatePlacements();
    }, [updatePlacements]);

    // Récupérer les placements et configurer les écouteurs d'événements
    useEffect(() => {
        updatePlacements();

        // S'abonner aux événements avec gestion des erreurs
        try {
            // Nettoyer l'écouteur précédent s'il existe
            if (eventListenerRef.current) {
                eventListenerRef.current();
                eventListenerRef.current = null;
            }

            // Ajouter le nouvel écouteur
            eventListenerRef.current = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);
        } catch (error) {
            console.error("Error setting up event listener in InteractiveObjects:", error);
        }

        // Nettoyer les écouteurs
        return () => {
            try {
                if (eventListenerRef.current) {
                    eventListenerRef.current();
                    eventListenerRef.current = null;
                }
            } catch (error) {
                console.warn("Error cleaning up event listener in InteractiveObjects:", error);
            }
        };
    }, [filter, handleInteractionComplete, updatePlacements]);

    // Mettre à jour lorsque l'étape d'interaction change
    useEffect(() => {
        if (interaction && interaction.currentStep !== lastInteractionStep.current) {
            lastInteractionStep.current = interaction.currentStep;
            updatePlacements();
        }
    }, [interaction?.currentStep, updatePlacements]);

    // Optimiser le rendu avec useMemo
    const interactiveObjects = useMemo(() => {
        return placements.map((placement, index) => {
            const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
            if (!objectConfig) return null;

            // Obtenir les informations sur les textures
            const textureModelId = sceneObjectManager.getTextureModelId(placement.objectKey);
            const useTextures = placement.useTextures !== undefined ?
                placement.useTextures : sceneObjectManager.doesObjectUseTextures(placement.objectKey);

            // Optimisation: créer un objet de props unique pour chaque marqueur, sans la key
            const markerProps = {
                modelPath: objectConfig.path,
                position: placement.position,
                rotation: placement.rotation,
                scale: placement.scale,
                markerId: placement.markerId,
                markerType: placement.markerType,
                markerText: placement.markerText,
                markerColor: placement.markerColor,
                markerOffset: placement.markerOffset,
                markerAxis: placement.markerAxis,
                outlineColor: placement.outlineColor,
                outlinePulse: placement.outlinePulse,
                requiredStep: placement.requiredStep,
                textureModelId: textureModelId,
                useTextures: useTextures,
                interfaceToShow: objectConfig.interaction?.interfaceToShow
            };

            // IMPORTANT: Garantir que la key est unique et bien définie
            // Utiliser placement.markerId s'il existe, sinon créer une clé unique avec index
            const markerKey = placement.markerId || `interactive-${placement.objectKey}-${index}`;

            return (
                <EasyModelMarker
                    key={markerKey}
                    {...markerProps}
                    onInteract={(event) => {
                        debugLog(`Interaction avec ${placement.markerId}:`, event);
                        if (placement.onInteract) {
                            placement.onInteract(event);
                        }
                    }}
                />
            );
        });
    }, [placements]);

    return (
        <group name="interactive-objects">
            {interactiveObjects}
        </group>
    );
});

/**
 * Composant pour afficher un seul objet interactif
 * Version optimisée
 */
export const SingleInteractiveObject = React.memo(function SingleInteractiveObject({
                                                                                       objectKey,
                                                                                       position,
                                                                                       options = {}
                                                                                   }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    // Early return si l'objet n'est pas valide
    if (!objectConfig || !objectConfig.interactive) {
        console.error(`Objet interactif "${objectKey}" non trouvé ou non interactif.`);
        return null;
    }

    const markerId = options.markerId || `${objectKey}-single`;
    const textureModelId = sceneObjectManager.getTextureModelId(objectKey);
    const useTextures = options.useTextures !== undefined ?
        options.useTextures : sceneObjectManager.doesObjectUseTextures(objectKey);

    // Optimisation: utiliser useMemo pour les props
    const markerProps = useMemo(() => ({
        modelPath: objectConfig.path,
        position: position || [0, 0, 0],
        rotation: options.rotation || [0, 0, 0],
        scale: options.scale || objectConfig.scale || [1, 1, 1],
        markerId: markerId,
        markerType: options.markerType || objectConfig.interaction.type,
        markerText: options.markerText || objectConfig.interaction.text,
        markerColor: options.markerColor || objectConfig.interaction.color,
        markerOffset: options.markerOffset || objectConfig.interaction.offset,
        markerAxis: options.markerAxis || objectConfig.interaction.axis,
        outlineColor: options.outlineColor || objectConfig.interaction.color,
        outlinePulse: options.outlinePulse !== undefined ? options.outlinePulse : true,
        requiredStep: options.requiredStep || null,
        textureModelId: textureModelId,
        useTextures: useTextures
    }), [
        objectConfig,
        position,
        options,
        markerId,
        textureModelId,
        useTextures
    ]);

    // Gérer l'interaction avec le callback mémorisé
    const handleInteract = useCallback((event) => {
        debugLog(`Interaction avec ${markerId}:`, event);
        if (options.onInteract) {
            options.onInteract(event);
        }
    }, [markerId, options.onInteract]);

    return <EasyModelMarker {...markerProps} onInteract={handleInteract} />;
});

/**
 * Composant pour afficher un seul objet statique
 * Version optimisée
 */
export const SingleStaticObject = React.memo(function SingleStaticObject({
                                                                             objectKey,
                                                                             position,
                                                                             options = {}
                                                                         }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    // Early return si l'objet n'est pas valide
    if (!objectConfig || objectConfig.interactive) {
        console.error(`Objet statique "${objectKey}" non trouvé ou est interactif.`);
        return null;
    }

    const textureModelId = sceneObjectManager.getTextureModelId(objectKey);
    const useTextures = options.useTextures !== undefined ?
        options.useTextures : sceneObjectManager.doesObjectUseTextures(objectKey);

    // Préparer les propriétés d'animation si elles sont fournies
    const animationProps = {};
    if (options.animation) {
        // Vérifier si l'animation existe dans la configuration de l'objet
        const availableAnimations = sceneObjectManager.getAvailableAnimations(objectKey);
        const animationExists = availableAnimations.includes(options.animation.name);

        if (options.animation.name && animationExists) {
            // Récupérer les paramètres par défaut de l'animation
            const animDefaults = objectConfig.animations?.[options.animation.name] || {};

            animationProps.playAnimation = options.animation.play !== undefined ? options.animation.play : false;
            animationProps.animationName = options.animation.name;
            animationProps.animationLoop = options.animation.loop !== undefined ? options.animation.loop : (animDefaults.defaultLoop || true);
            animationProps.animationClamp = options.animation.clamp !== undefined ? options.animation.clamp : (animDefaults.defaultClamp || false);
            animationProps.animationTimeScale = options.animation.timeScale !== undefined ? options.animation.timeScale : (animDefaults.defaultTimeScale || 1.0);

            if (options.animation.onComplete) {
                animationProps.onAnimationComplete = options.animation.onComplete;
            }
        } else if (options.animation.name) {
            console.warn(`Animation "${options.animation.name}" non trouvée pour l'objet "${objectKey}". Animations disponibles: ${availableAnimations.join(', ') || 'aucune'}`);
        }
    }

    // Optimisation: utiliser useMemo pour les props
    const staticProps = useMemo(() => ({
        path: objectConfig.path,
        position: position || [0, 0, 0],
        rotation: options.rotation || [0, 0, 0],
        scale: options.scale || objectConfig.scale || [1, 1, 1],
        castShadow: options.castShadow !== undefined ? options.castShadow : true,
        receiveShadow: options.receiveShadow !== undefined ? options.receiveShadow : true,
        visible: options.visible !== undefined ? options.visible : true,
        textureModelId: textureModelId,
        useTextures: useTextures,
        ...animationProps
    }), [
        objectConfig,
        position,
        options,
        textureModelId,
        useTextures,
        animationProps
    ]);

    return <StaticObject {...staticProps} />;
});
/**
 * Composant principal qui affiche tous les objets de scène
 * Utilise les deux sous-composants pour objets statiques et interactifs
 * Version optimisée
 */
const SceneObjects = React.memo(function SceneObjects({
                                                          staticFilter = {},
                                                          interactiveFilter = {}
                                                      }) {
    return (
        <group name="scene-objects">
            <StaticObjects filter={staticFilter} />
            <InteractiveObjects filter={interactiveFilter} />
        </group>
    );
});

export default SceneObjects;