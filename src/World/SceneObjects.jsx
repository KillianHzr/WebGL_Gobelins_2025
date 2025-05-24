import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {useAnimations, useGLTF} from '@react-three/drei';
import EasyModelMarker from './EasyModelMarker';
import sceneObjectManager from '../Config/SceneObjectManager';
import {textureManager} from '../Config/TextureManager';
import useStore from '../Store/useStore';
import MARKER_EVENTS, {EventBus} from '../Utils/EventEmitter';
import * as THREE from 'three';
import {FrontSide, LoopOnce, LoopRepeat} from 'three';
import {useAnimationFrame} from "../Utils/AnimationManager.js";
import { modelAnimationManager, ANIMATION_EVENTS } from '../Config/ModelAnimationManager';

// Activer ou désactiver les logs pour le débogage
const DEBUG_SCENE_OBJECTS = false;

// Fonction utilitaire pour le logging conditionnel
const debugLog = (...args) => {
    if (DEBUG_SCENE_OBJECTS) {
        console.log(...args);
    }
};

/**
 * Composant pour afficher un objet statique individuel avec textures
 * Version optimisée et synchronisée
 */
export const StaticObject = React.memo(function StaticObject({
                                                                 path,
                                                                 position,
                                                                 rotation,
                                                                 quaternion,
                                                                 scale,
                                                                 castShadow = true,
                                                                 receiveShadow = true,
                                                                 visible = true,
                                                                 textureModelId = null,
                                                                 useTextures = true,
                                                                 playAnimation = false,
                                                                 animationName = null,
                                                                 animationLoop = true,
                                                                 animationClamp = false,
                                                                 animationTimeScale = 1.0,
                                                                 onAnimationComplete = null,
                                                                 objectKey = null
                                                             }) {
    const objectRef = useRef();
    const isComponentMounted = useRef(true);
    const animationRef = useRef(null);
    const currentAnimationRef = useRef(null);
    const isGroundObjectRef = useRef(false);
    const registrationState = useRef({
        isRegistered: false,
        registrationId: null
    });

    // Utiliser useMemo pour éviter de recharger le modèle à chaque re-render
    const {scene: modelScene, animations} = useGLTF(path);

    // Cloner le modèle une seule fois avec useMemo
    const model = useMemo(() => {
        const clonedModel = modelScene.clone();

        // Déterminer si c'est un objet de type sol
        const isGroundObject = path.toLowerCase().includes('ground') ||
            textureModelId?.toLowerCase().includes('ground');
        isGroundObjectRef.current = isGroundObject;

        // Appliquer les propriétés d'ombre de manière appropriée
        clonedModel.traverse((child) => {
            if (child.isMesh) {
                if (isGroundObject) {
                    child.castShadow = false;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.roughness = 0.8;
                        child.material.metalness = 0.2;
                        child.material.shadowSide = FrontSide;
                        child.material.needsUpdate = true;
                    }
                } else {
                    child.castShadow = castShadow;
                    child.receiveShadow = receiveShadow;
                    if (child.material) {
                        child.material.needsUpdate = true;
                    }
                }
            }
        });

        return clonedModel;
    }, [modelScene, path, textureModelId, castShadow, receiveShadow]);

    // Utiliser useAnimations pour gérer les animations locales
    const {actions, mixer} = useAnimations(animations, objectRef);

    // État local des animations
    const animationState = useRef({
        isPlaying: false,
        currentName: null,
        loop: animationLoop,
        clamp: animationClamp,
        timeScale: animationTimeScale
    });

    // Enregistrer le modèle avec le gestionnaire d'animations (une seule fois)
    useEffect(() => {
        if (!objectRef.current || !mixer || !animations || !textureModelId) return;

        // Créer un ID d'enregistrement unique basé sur le modèle et son UUID
        const registrationId = `${textureModelId}-${objectRef.current.uuid}`;

        // Vérifier si déjà enregistré avec ce même ID
        if (registrationState.current.isRegistered &&
            registrationState.current.registrationId === registrationId) {
            debugLog(`Modèle ${textureModelId} déjà enregistré avec ID ${registrationId}`);
            return;
        }

        // Enregistrer avec le ModelAnimationManager
        if (animations.length > 0) {
            debugLog(`🎭 Enregistrement du modèle ${textureModelId} avec ${animations.length} animations`);
            modelAnimationManager.registerModel(textureModelId, objectRef.current, animations);

            // Marquer comme enregistré
            registrationState.current = {
                isRegistered: true,
                registrationId: registrationId
            };

            // Informer le SceneObjectManager
            if (objectKey) {
                sceneObjectManager.registerLoadedModelWithAnimations(objectKey, objectRef.current, { animations });
            }

            // 🎯 DÉCLENCHEMENT DES ANIMATIONS PAR DÉFAUT
            // Attendre un court délai pour s'assurer que tout est configuré
            setTimeout(() => {
                // Vérifier si ce modèle a des animations par défaut à jouer
                const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);
                if (objectConfig && objectConfig.defaultAnimations && objectConfig.animations) {
                    objectConfig.defaultAnimations.forEach(animKey => {
                        const animConfig = objectConfig.animations[animKey];
                        if (animConfig && animConfig.autoplay) {
                            console.log(`🎬 Déclenchement animation par défaut: ${animKey} pour ${textureModelId}`);

                            // Trouver l'action correspondante dans les actions locales
                            const localAction = actions[animConfig.animationName];
                            if (localAction) {
                                // Configurer et jouer l'animation localement
                                localAction.reset();
                                localAction.timeScale = animConfig.timeScale || 1.0;
                                localAction.clampWhenFinished = animConfig.clampWhenFinished || false;
                                localAction.setLoop(
                                    animConfig.loop !== false ? LoopRepeat : LoopOnce,
                                    animConfig.loopCount === -1 ? Infinity : (animConfig.loopCount || 1)
                                );

                                localAction.play();

                                // Mettre à jour l'état local
                                currentAnimationRef.current = localAction;
                                animationState.current = {
                                    isPlaying: true,
                                    currentName: animConfig.animationName,
                                    loop: animConfig.loop !== false,
                                    clamp: animConfig.clampWhenFinished || false,
                                    timeScale: animConfig.timeScale || 1.0
                                };

                                console.log(`✅ Animation par défaut "${animKey}" (${animConfig.animationName}) démarrée pour ${textureModelId}`);
                            } else {
                                console.warn(`❌ Action locale "${animConfig.animationName}" non trouvée pour ${textureModelId}`);
                                console.log('Actions disponibles:', Object.keys(actions));
                            }
                        }
                    });
                }
            }, 200); // Délai pour s'assurer que les actions sont prêtes
        }

        return () => {
            // Nettoyer lors du démontage seulement
            if (registrationState.current.isRegistered) {
                debugLog(`Nettoyage de l'enregistrement pour ${textureModelId}`);
                registrationState.current = {
                    isRegistered: false,
                    registrationId: null
                };
            }
        };
    }, [textureModelId, objectKey, actions]); // Ajouter actions aux dépendances

    // Gérer les animations locales (indépendamment du ModelAnimationManager)
    useEffect(() => {
        if (!objectRef.current || !mixer || !actions || Object.keys(actions).length === 0) return;

        if (playAnimation && animationName) {
            if (animationName !== animationState.current.currentName || !animationState.current.isPlaying) {
                // Arrêter l'animation en cours
                if (currentAnimationRef.current) {
                    currentAnimationRef.current.stop();
                }

                const action = actions[animationName];
                if (action) {
                    // Configurer l'animation
                    action.reset();
                    action.clampWhenFinished = animationClamp;
                    action.timeScale = animationTimeScale;
                    action.setLoop(animationLoop ? LoopRepeat : LoopOnce);

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

                    debugLog(`Animation locale "${animationName}" démarrée sur ${textureModelId || path}`);

                    // Gérer la fin d'animation
                    if (!animationLoop && onAnimationComplete && mixer) {
                        if (animationRef.current) {
                            mixer.removeEventListener('finished', animationRef.current);
                        }

                        const finishCallback = (e) => {
                            if (isComponentMounted.current && e.action === action) {
                                debugLog(`Animation locale "${animationName}" terminée`);
                                animationState.current.isPlaying = false;
                                onAnimationComplete(animationName);
                            }
                        };

                        animationRef.current = finishCallback;
                        mixer.addEventListener('finished', finishCallback);
                    }
                } else {
                    console.warn(`Animation "${animationName}" non trouvée dans le modèle ${textureModelId || path}`);
                }
            }
        } else if (!playAnimation && animationState.current.isPlaying && currentAnimationRef.current) {
            currentAnimationRef.current.stop();
            animationState.current.isPlaying = false;
            debugLog(`Animation locale arrêtée sur ${textureModelId || path}`);
        }
    }, [playAnimation, animationName, animationLoop, animationClamp, animationTimeScale, actions, mixer, path, textureModelId, onAnimationComplete]);

    // Écouter les événements d'animation du ModelAnimationManager
    useEffect(() => {
        if (!textureModelId || !mixer || !actions) return;

        const handleAnimationStart = (data) => {
            if (data.modelId === textureModelId && data.animationKey && actions[data.animationKey]) {
                // Arrêter l'animation locale en cours
                if (currentAnimationRef.current) {
                    currentAnimationRef.current.stop();
                }

                const action = actions[data.animationKey];
                if (action) {
                    action.reset();
                    action.timeScale = data.options?.timeScale || 1.0;
                    action.clampWhenFinished = data.options?.clampWhenFinished || false;
                    action.setLoop(
                        data.options?.loop === false ? LoopOnce : LoopRepeat,
                        data.options?.loopCount || Infinity
                    );

                    if (data.options?.fadeInDuration > 0) {
                        action.fadeIn(data.options.fadeInDuration);
                    } else {
                        action.play();
                    }

                    currentAnimationRef.current = action;
                    animationState.current.isPlaying = true;
                    animationState.current.currentName = data.animationKey;

                    debugLog(`Animation globale ${data.animationKey} démarrée pour ${textureModelId}`);
                }
            }
        };

        const handleAnimationStop = (data) => {
            if (data.modelId === textureModelId && data.animationKey && actions[data.animationKey]) {
                const action = actions[data.animationKey];
                if (action) {
                    if (data.options?.fadeOutDuration > 0) {
                        action.fadeOut(data.options.fadeOutDuration);
                    } else {
                        action.stop();
                    }

                    if (currentAnimationRef.current === action) {
                        currentAnimationRef.current = null;
                        animationState.current.isPlaying = false;
                    }

                    debugLog(`Animation globale ${data.animationKey} arrêtée pour ${textureModelId}`);
                }
            }
        };

        const handleStopAllAnimations = (data) => {
            if (!data.modelId || data.modelId === textureModelId) {
                mixer.stopAllAction();
                currentAnimationRef.current = null;
                animationState.current.isPlaying = false;
                debugLog(`Toutes les animations arrêtées pour ${textureModelId}`);
            }
        };

        // S'abonner aux événements
        const startListener = EventBus.on(ANIMATION_EVENTS.MODEL_ANIMATION_START, handleAnimationStart);
        const stopListener = EventBus.on(ANIMATION_EVENTS.MODEL_ANIMATION_STOP, handleAnimationStop);
        const stopAllListener = EventBus.on(ANIMATION_EVENTS.STOP_ALL_ANIMATIONS, handleStopAllAnimations);

        return () => {
            startListener();
            stopListener();
            stopAllListener();
        };
    }, [textureModelId, mixer, actions]);

    // Mettre à jour le mixer d'animation local à chaque frame
    useAnimationFrame((state, delta) => {
        if (mixer && animationState.current.isPlaying) {
            mixer.update(delta);
        }
    }, 'animation');

    // Appliquer les textures au modèle après le montage
    useEffect(() => {
        if (!objectRef.current || !useTextures || !textureModelId || !textureManager) return;

        let isApplyingTextures = true;

        const applyTextures = async () => {
            try {
                await textureManager.applyTexturesToModel(textureModelId, objectRef.current);
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

        return () => {
            isApplyingTextures = false;
        };
    }, [textureModelId, useTextures]);

    // Nettoyer lors du démontage
    useEffect(() => {
        isComponentMounted.current = true;

        return () => {
            isComponentMounted.current = false;

            if (mixer) {
                mixer.stopAllAction();
                if (animationRef.current) {
                    mixer.removeEventListener('finished', animationRef.current);
                }
            }
        };
    }, [mixer]);


// Configuration dynamique des écouteurs d'événements pour les animationTriggers
    useEffect(() => {
        if (!objectRef.current || !mixer || !actions || !textureModelId || !objectKey) return;

        // Récupérer la configuration de l'objet
        const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);
        if (!objectConfig || !objectConfig.animationTriggers) return;

        console.log(`🎮 Configuration d'écouteurs dynamiques pour ${objectKey}`);

        // Créer des écouteurs pour tous les triggers définis dans la configuration
        const cleanupFunctions = [];

        Object.entries(objectConfig.animationTriggers).forEach(([eventName, triggerConfig]) => {
            console.log(`📡 Configuration écouteur pour événement "${eventName}" sur ${objectKey}`);

            const handleAnimationEvent = (data) => {
                console.log(`🎬 Événement "${eventName}" reçu pour ${objectKey}:`, data);

                const animationKey = triggerConfig.animation;
                const animationConfig = objectConfig.animations[animationKey];

                if (!animationConfig) {
                    console.warn(`❌ Configuration animation "${animationKey}" manquante pour ${objectKey}`);
                    return;
                }

                // Rechercher l'action correspondante en utilisant le nom réel de l'animation
                const animationName = animationConfig.animationName;
                const targetAction = actions[animationName] || actions[animationKey];

                // Si pas trouvée, essayer de chercher par nom de clip
                let foundAction = targetAction;
                if (!foundAction) {
                    for (const key in actions) {
                        if (actions[key]._clip && actions[key]._clip.name === animationName) {
                            foundAction = actions[key];
                            break;
                        }
                    }
                }

                if (foundAction) {
                    console.log(`🎬 Déclenchement animation "${animationKey}" (${animationName}) sur ${objectKey}`);

                    // Arrêter l'animation en cours si nécessaire
                    if (currentAnimationRef.current) {
                        currentAnimationRef.current.stop();
                    }

                    // Configurer l'animation en combinant la config de base et les options du trigger
                    foundAction.reset();
                    foundAction.timeScale = triggerConfig.options?.timeScale || animationConfig.timeScale || 1.0;
                    foundAction.clampWhenFinished = animationConfig.clampWhenFinished || false;

                    // Gérer les boucles selon la configuration du trigger
                    const loopCount = triggerConfig.options?.loopCount !== undefined ?
                        triggerConfig.options.loopCount :
                        (animationConfig.loopCount !== undefined ? animationConfig.loopCount : 1);

                    if (loopCount === -1) {
                        foundAction.setLoop(THREE.LoopRepeat, Infinity);
                    } else if (loopCount === 0) {
                        foundAction.setLoop(THREE.LoopOnce);
                    } else {
                        foundAction.setLoop(THREE.LoopRepeat, loopCount);
                    }

                    // Jouer l'animation
                    foundAction.play();

                    // Mettre à jour les références
                    currentAnimationRef.current = foundAction;
                    animationState.current = {
                        isPlaying: true,
                        currentName: animationName,
                        loop: loopCount !== 0,
                        clamp: animationConfig.clampWhenFinished || false,
                        timeScale: triggerConfig.options?.timeScale || animationConfig.timeScale || 1.0
                    };

                    console.log(`✅ Animation "${animationKey}" (${animationName}) démarrée sur ${objectKey} avec:`);
                    console.log(`   - timeScale: ${foundAction.timeScale}`);
                    console.log(`   - loopCount: ${loopCount}`);
                    console.log(`   - clampWhenFinished: ${foundAction.clampWhenFinished}`);

                } else {
                    console.warn(`❌ Animation "${animationName}" non trouvée pour ${objectKey}`);
                    console.log('Actions disponibles:', Object.keys(actions).map(key => ({
                        key: key,
                        clipName: actions[key]._clip ? actions[key]._clip.name : 'clip inconnu'
                    })));

                    // Debug supplémentaire
                    console.log(`Configuration ${objectKey}:`, {
                        animationKey,
                        animationName,
                        triggerOptions: triggerConfig.options,
                        baseConfig: animationConfig
                    });
                }
            };

            // S'abonner à l'événement
            try {
                if (window.EventBus && typeof window.EventBus.on === 'function') {
                    const cleanup = window.EventBus.on(eventName, handleAnimationEvent);
                    cleanupFunctions.push(cleanup);
                    console.log(`✅ Écouteur dynamique pour "${eventName}" enregistré sur ${objectKey}`);
                } else {
                    console.warn(`⚠️ EventBus non disponible pour l'écouteur ${eventName}`);
                }
            } catch (error) {
                console.error(`❌ Erreur lors de l'enregistrement de l'écouteur pour "${eventName}":`, error);
            }
        });

        // Fonction de nettoyage qui supprime tous les écouteurs
        return () => {
            cleanupFunctions.forEach(cleanup => {
                try {
                    cleanup();
                } catch (error) {
                    console.warn(`⚠️ Erreur lors du nettoyage d'un écouteur:`, error);
                }
            });
        };
    }, [objectKey, textureModelId, mixer, actions]);


    // Propriétés de la primitive optimisées
    const primitiveProps = useMemo(() => {
        const props = {
            position,
            scale,
            castShadow: isGroundObjectRef.current ? false : castShadow,
            receiveShadow: isGroundObjectRef.current ? true : receiveShadow,
            visible
        };

        if (quaternion) {
            props.quaternion = quaternion;
        } else {
            props.rotation = rotation;
        }

        return props;
    }, [position, rotation, quaternion, scale, castShadow, receiveShadow, visible]);

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
 * Version optimisée et synchronisée
 */
export const StaticObjects = React.memo(function StaticObjects({filter = {}}) {
    const [placements, setPlacements] = useState([]);
    const {scene} = useThree();
    const lastFilter = useRef(filter);

    // Fonction de mise à jour des placements optimisée
    const updatePlacements = useCallback(() => {
        const staticPlacements = sceneObjectManager.getStaticPlacements(filter);
        setPlacements(staticPlacements);
    }, [filter]);

    // Récupérer les placements au chargement
    useEffect(() => {
        if (JSON.stringify(lastFilter.current) !== JSON.stringify(filter)) {
            lastFilter.current = filter;
            updatePlacements();
        } else {
            updatePlacements();
        }

        // Corrections de matériaux une seule fois
        if (textureManager && typeof textureManager.fixAllPlantMaterials === 'function') {
            textureManager.fixAllPlantMaterials();
        }
        if (scene && textureManager && typeof textureManager.forceEmissiveOnObjects === 'function') {
            textureManager.forceEmissiveOnObjects(scene);
        }
    }, [filter, updatePlacements, scene]);

    // Écouter les événements de trigger d'animation
    useEffect(() => {
        const handleAnimationTrigger = (data) => {
            const { objectKey, trigger, options = {} } = data;

            const placementIndex = placements.findIndex(p => p.objectKey === objectKey);

            if (placementIndex !== -1) {
                const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);
                if (!objectConfig || !objectConfig.animationTriggers || !objectConfig.animationTriggers[trigger]) {
                    return;
                }

                const triggerConfig = objectConfig.animationTriggers[trigger];

                setPlacements(prevPlacements => {
                    const newPlacements = [...prevPlacements];
                    const placement = {...newPlacements[placementIndex]};

                    if (triggerConfig.stop) {
                        if (placement.animation) {
                            placement.animation.play = false;
                        }
                    } else {
                        placement.animation = {
                            play: true,
                            name: triggerConfig.animation,
                            loop: triggerConfig.options?.loop !== false,
                            clamp: triggerConfig.options?.clampWhenFinished || false,
                            timeScale: triggerConfig.options?.timeScale || 1.0,
                            ...options
                        };
                    }

                    newPlacements[placementIndex] = placement;
                    return newPlacements;
                });

                debugLog(`Animation trigger "${trigger}" appliqué à ${objectKey}`);
            }
        };

        const triggerListener = EventBus.on('trigger_animation', handleAnimationTrigger);

        return () => {
            triggerListener();
        };
    }, [placements]);


    // Rendu optimisé des objets statiques
    const staticObjects = useMemo(() => {
        return placements.map((placement, index) => {
            const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
            if (!objectConfig) return null;

            const textureModelId = sceneObjectManager.getTextureModelId(placement.objectKey);
            const useTextures = placement.useTextures !== undefined ?
                placement.useTextures : sceneObjectManager.doesObjectUseTextures(placement.objectKey);

            const key = `static-${placement.objectKey}-${index}-${objectConfig.path}`;

            // Propriétés d'animation
            let animationProps = {};

            if (placement.animation) {
                animationProps = {
                    playAnimation: placement.animation.play,
                    animationName: placement.animation.name,
                    animationLoop: placement.animation.loop,
                    animationClamp: placement.animation.clamp,
                    animationTimeScale: placement.animation.timeScale,
                    onAnimationComplete: (animName) => {
                        if (placement.animation.onComplete) {
                            placement.animation.onComplete(animName, index);
                        }

                        if (!placement.animation.loop) {
                            const updatedPlacement = {...placement};
                            updatedPlacement.animation.play = false;
                            sceneObjectManager.updatePlacement(index, updatedPlacement);

                            setPlacements(prevPlacements => {
                                const newPlacements = [...prevPlacements];
                                newPlacements[index] = updatedPlacement;
                                return newPlacements;
                            });
                        }
                    }
                };
            } else if (objectConfig.defaultAnimations && objectConfig.animations) {
                const defaultAnim = objectConfig.defaultAnimations[0];
                if (defaultAnim && objectConfig.animations[defaultAnim]) {
                    const animConfig = objectConfig.animations[defaultAnim];

                    animationProps = {
                        playAnimation: animConfig.autoplay === true,
                        animationName: animConfig.animationName,
                        animationLoop: animConfig.loop !== false,
                        animationClamp: animConfig.clampWhenFinished || false,
                        animationTimeScale: animConfig.timeScale || 1.0,
                        onAnimationComplete: () => {
                            debugLog(`Animation par défaut ${defaultAnim} terminée pour ${placement.objectKey}`);
                        }
                    };
                }
            }

            return (
                <StaticObject
                    key={key}
                    path={objectConfig.path}
                    position={placement.position}
                    rotation={placement.rotation}
                    quaternion={placement.quaternion}
                    scale={placement.scale}
                    castShadow={placement.castShadow !== undefined ? placement.castShadow : true}
                    receiveShadow={placement.receiveShadow !== undefined ? placement.receiveShadow : true}
                    visible={placement.visible}
                    textureModelId={textureModelId}
                    useTextures={useTextures}
                    objectKey={placement.objectKey}
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
 * Version optimisée et synchronisée
 */
export const InteractiveObjects = React.memo(function InteractiveObjects({filter = {}}) {
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

    // S'abonner aux événements d'interaction
    useEffect(() => {
        const completeCleanup = EventBus.on('object:interaction:complete', (data) => {
            updatePlacements();
        });

        return () => {
            completeCleanup();
        };
    }, [updatePlacements]);

    // Récupérer les placements et configurer les écouteurs
    useEffect(() => {
        updatePlacements();

        try {
            if (eventListenerRef.current) {
                eventListenerRef.current();
                eventListenerRef.current = null;
            }

            eventListenerRef.current = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleInteractionComplete);
        } catch (error) {
            console.error("Error setting up event listener in InteractiveObjects:", error);
        }

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

    // Rendu optimisé des objets interactifs
    const interactiveObjects = useMemo(() => {
        return placements.map((placement, index) => {
            const objectConfig = sceneObjectManager.getObjectFromCatalog(placement.objectKey);
            if (!objectConfig) return null;

            const textureModelId = sceneObjectManager.getTextureModelId(placement.objectKey);
            const useTextures = placement.useTextures !== undefined ?
                placement.useTextures : sceneObjectManager.doesObjectUseTextures(placement.objectKey);

            // Trouver l'interaction correspondante
            let interaction;
            if (Array.isArray(objectConfig.interaction)) {
                interaction = objectConfig.interaction.find(
                    i => i.requiredStep === placement.requiredStep
                );
                if (!interaction && objectConfig.interaction.length > 0) {
                    interaction = objectConfig.interaction[0];
                }
            } else {
                interaction = objectConfig.interaction;
            }

            if (!interaction) {
                console.error(`Aucune interaction trouvée pour ${placement.objectKey} (requiredStep: ${placement.requiredStep})`);
                return null;
            }

            const markerProps = {
                modelPath: objectConfig.path,
                position: placement.position,
                rotation: placement.rotation,
                scale: placement.scale,
                markerId: placement.markerId,
                outlinePulse: placement.outlinePulse,
                requiredStep: placement.requiredStep,
                textureModelId: textureModelId,
                useTextures: useTextures,
                markerType: placement.markerType || interaction.type,
                markerText: placement.markerText || interaction.text,
                markerOffset: placement.markerOffset || interaction.offset,
                markerAxis: placement.markerAxis || interaction.axis,
                interfaceToShow: interaction.interfaceToShow,
                objectKey: placement.objectKey
            };

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
 * Version optimisée et synchronisée
 */
export const SingleInteractiveObject = React.memo(function SingleInteractiveObject({
                                                                                       objectKey,
                                                                                       position,
                                                                                       options = {}
                                                                                   }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    if (!objectConfig || !objectConfig.interactive) {
        console.error(`Objet interactif "${objectKey}" non trouvé ou non interactif.`);
        return null;
    }

    const markerId = options.markerId || `${objectKey}-single`;
    const textureModelId = sceneObjectManager.getTextureModelId(objectKey);
    const useTextures = options.useTextures !== undefined ?
        options.useTextures : sceneObjectManager.doesObjectUseTextures(objectKey);

    // Déterminer le requiredStep
    let requiredStep = options.requiredStep;
    if (!requiredStep) {
        if (Array.isArray(objectConfig.interaction) && objectConfig.interaction.length > 0) {
            requiredStep = objectConfig.interaction[0].requiredStep;
        } else if (objectConfig.interaction && objectConfig.interaction.requiredStep) {
            requiredStep = objectConfig.interaction.requiredStep;
        }
    }

    // Trouver l'interaction correspondante
    let matchingInteraction;
    if (Array.isArray(objectConfig.interaction)) {
        matchingInteraction = requiredStep
            ? objectConfig.interaction.find(i => i.requiredStep === requiredStep)
            : objectConfig.interaction[0];
    } else {
        matchingInteraction = objectConfig.interaction;
    }

    if (!matchingInteraction) {
        console.error(`Aucune interaction trouvée pour ${objectKey} (requiredStep: ${requiredStep})`);
        return null;
    }

    const markerProps = useMemo(() => ({
        modelPath: objectConfig.path,
        position: position || [0, 0, 0],
        rotation: options.rotation || [0, 0, 0],
        scale: options.scale || objectConfig.scale || [1, 1, 1],
        markerId: markerId,
        markerType: options.markerType || matchingInteraction.type,
        markerText: options.markerText || matchingInteraction.text,
        markerOffset: options.markerOffset || matchingInteraction.offset,
        markerAxis: options.markerAxis || matchingInteraction.axis,
        outlinePulse: options.outlinePulse !== undefined ? options.outlinePulse : true,
        requiredStep: requiredStep,
        textureModelId: textureModelId,
        useTextures: useTextures,
        interfaceToShow: matchingInteraction.interfaceToShow,
        objectKey: objectKey
    }), [
        objectConfig,
        position,
        options,
        markerId,
        textureModelId,
        useTextures,
        matchingInteraction,
        requiredStep,
        objectKey
    ]);

    const handleInteract = useCallback((event) => {
        debugLog(`Interaction avec ${markerId}:`, event);
        if (options.onInteract) {
            options.onInteract(event);
        }
    }, [markerId, options.onInteract]);

    return <EasyModelMarker {...markerProps} onInteract={handleInteract}/>;
});

/**
 * Composant pour afficher un seul objet statique
 * Version optimisée et synchronisée
 */
export const SingleStaticObject = React.memo(function SingleStaticObject({
                                                                             objectKey,
                                                                             position,
                                                                             options = {}
                                                                         }) {
    const objectConfig = sceneObjectManager.getObjectFromCatalog(objectKey);

    if (!objectConfig || objectConfig.interactive) {
        console.error(`Objet statique "${objectKey}" non trouvé ou est interactif.`);
        return null;
    }

    const textureModelId = sceneObjectManager.getTextureModelId(objectKey);
    const useTextures = options.useTextures !== undefined ?
        options.useTextures : sceneObjectManager.doesObjectUseTextures(objectKey);

    // Préparer les propriétés d'animation
    let animationProps = {};

    if (options.animation) {
        const availableAnimations = sceneObjectManager.getAvailableAnimations(objectKey);
        const animationExists = availableAnimations.includes(options.animation.name);

        if (options.animation.name && animationExists) {
            const animDefaults = objectConfig.animations?.[options.animation.name] || {};

            animationProps = {
                playAnimation: options.animation.play !== undefined ? options.animation.play : false,
                animationName: options.animation.name,
                animationLoop: options.animation.loop !== undefined ? options.animation.loop : (animDefaults.loop !== false),
                animationClamp: options.animation.clamp !== undefined ? options.animation.clamp : (animDefaults.clampWhenFinished || false),
                animationTimeScale: options.animation.timeScale !== undefined ? options.animation.timeScale : (animDefaults.timeScale || 1.0),
                onAnimationComplete: options.animation.onComplete
            };
        } else if (options.animation.name) {
            console.warn(`Animation "${options.animation.name}" non trouvée pour l'objet "${objectKey}". Animations disponibles: ${availableAnimations.join(', ') || 'aucune'}`);
        }
    } else if (objectConfig.defaultAnimations && objectConfig.animations) {
        const defaultAnim = objectConfig.defaultAnimations[0];
        if (defaultAnim && objectConfig.animations[defaultAnim]) {
            const animConfig = objectConfig.animations[defaultAnim];

            animationProps = {
                playAnimation: animConfig.autoplay === true,
                animationName: animConfig.animationName,
                animationLoop: animConfig.loop !== false,
                animationClamp: animConfig.clampWhenFinished || false,
                animationTimeScale: animConfig.timeScale || 1.0
            };
        }
    }

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
        objectKey: objectKey,
        ...animationProps
    }), [
        objectConfig,
        position,
        options,
        textureModelId,
        useTextures,
        objectKey,
        animationProps
    ]);

    return <StaticObject {...staticProps} />;
});

/**
 * Composant principal qui affiche tous les objets de scène
 * Version optimisée et synchronisée
 */
const SceneObjects = React.memo(function SceneObjects({
                                                          staticFilter = {},
                                                          interactiveFilter = {}
                                                      }) {
    // Initialiser le système d'animation au montage
    useEffect(() => {
        if (modelAnimationManager && !modelAnimationManager.initialized) {
            modelAnimationManager.init();
            debugLog('✅ Système d\'animation initialisé via SceneObjects');
        }
    }, []);

    return (
        <group name="scene-objects">
            <StaticObjects filter={staticFilter}/>
            <InteractiveObjects filter={interactiveFilter}/>
        </group>
    );
});

export default SceneObjects;