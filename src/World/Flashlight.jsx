import React, { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';
import {useAnimationFrame} from "../Utils/AnimationManager.js";

/**
 * Flashlight Component - World/Flashlight.jsx
 * Version optimisée: crée la lumière avec intensité 0 au démarrage,
 * puis l'active à la bonne intensité au point de timeline requis
 */
export default function Flashlight() {
    const { camera, scene, gl } = useThree();
    const flashlightRef = useRef();
    const flashlightTargetRef = useRef(new THREE.Object3D());
    const configRef = useRef(guiConfig.flashlight);

    // Référence pour les états d'initialisation
    const initializedRef = useRef(false);
    const guiInitializedRef = useRef(false);

    // État pour stocker l'intensité normale (pour pouvoir y revenir)
    const [normalIntensity] = useState(configRef.current.intensity.default);

    // État pour stocker les paramètres de direction avec les nouvelles valeurs par défaut
    const [directionParams, setDirectionParams] = useState({
        offsetX: 0,           // Direction X: 0
        offsetY: 0,           // Direction Y: 0
        offsetZ: -0.3,        // Direction Z: -0.3
        distance: 1           // Distance cible: 1
    });

    // État pour stocker les paramètres avancés
    const [advancedParams, setAdvancedParams] = useState({
        angle: 0.51179,       // Angle: 0.51179
        penumbra: 1,          // Douceur des bords: 1
        distance: 5,          // Distance: 5
        decay: 1.1            // Atténuation: 1.1
    });

    // Accéder aux états depuis le store
    const flashlightState = useStore(state => state.flashlight);
    const updateFlashlightState = useStore(state => state.updateFlashlightState);
    const debug = useStore(state => state.debug);
    const gui = useStore(state => state.gui);

    // Accéder à la position de défilement et la longueur totale
    const timelinePosition = useStore(state => state.timelinePosition);
    const sequenceLength = useStore(state => state.sequenceLength);

    // INITIALISATION - création de la cible
    useEffect(() => {
        if (!initializedRef.current) {

            // Ajouter la cible à la scène
            scene.add(flashlightTargetRef.current);
            flashlightTargetRef.current.name = "flashlightTarget";

            // Positionner la cible initialement
            const direction = new THREE.Vector3(
                directionParams.offsetX,
                directionParams.offsetY,
                directionParams.offsetZ
            );
            direction.normalize();
            direction.applyQuaternion(camera.quaternion);
            const targetPosition = camera.position.clone().add(direction.multiplyScalar(directionParams.distance));
            flashlightTargetRef.current.position.copy(targetPosition);

            // Initialiser l'état dans le store
            updateFlashlightState({
                autoActivate: true,
                active: true, // La lumière est toujours active mais à intensité zéro
                intensity: 0,  // Intensité initiale: zéro
                normalIntensity: normalIntensity, // Sauvegarder l'intensité normale
                preloadState: 'initialized',
                direction: { ...directionParams },
                advanced: { ...advancedParams }
            });

            initializedRef.current = true;
        }

        // Nettoyage
        return () => {
            if (flashlightTargetRef.current) {
                scene.remove(flashlightTargetRef.current);
            }
        };
    }, [scene, camera, updateFlashlightState, normalIntensity, directionParams, advancedParams]);

    // Configuration de la flashlight une fois créée
    useEffect(() => {
        if (!flashlightRef.current) return;


        // Configuration des paramètres
        const flashlight = flashlightRef.current;

        // Paramètres principaux - AVEC INTENSITÉ ZÉRO
        flashlight.intensity = 0; // Commencer avec intensité zéro
        flashlight.angle = advancedParams.angle;
        flashlight.penumbra = advancedParams.penumbra;
        flashlight.distance = advancedParams.distance;
        flashlight.decay = advancedParams.decay;
        flashlight.color.set(configRef.current.color.default);

        // Configuration des ombres
        flashlight.castShadow = configRef.current.shadows.enabled.default;

        if (flashlight.shadow) {
            flashlight.shadow.mapSize.width = configRef.current.shadows.mapSize.default;
            flashlight.shadow.mapSize.height = configRef.current.shadows.mapSize.default;
            flashlight.shadow.bias = configRef.current.shadows.bias.default;
            flashlight.shadow.normalBias = configRef.current.shadows.normalBias.default;

            // Forcer la mise à jour des ombres pour précharger
            flashlight.shadow.needsUpdate = true;
        }

        // Définir la cible
        flashlight.target = flashlightTargetRef.current;

        // S'assurer que la lumière est visible (mais avec intensité 0)
        flashlight.visible = true;

        // Forcer un rendu pour précharger les ressources
        gl.render(scene, camera);

        // Confirmer que tout est prêt
        updateFlashlightState({
            preloadState: 'ready'
        });


    }, [flashlightRef.current, scene, camera, gl, updateFlashlightState, advancedParams]);

    useEffect(() => {
        if (debug?.active && gui && !guiInitializedRef.current) {
            let flashlightFolder = gui.folders?.find(folder => folder.name === 'Flashlight');

            if (!flashlightFolder) {
                flashlightFolder = gui.addFolder('Flashlight');

                // Créer un objet proxy pour tous les paramètres
                const flashlightProxy = {
                    // État principal
                    active: flashlightState.active,
                    autoActivate: flashlightState.autoActivate || true,
                    intensity: flashlightState.intensity || 0,
                    normalIntensity: flashlightState.normalIntensity || configRef.current.intensity.default,
                    color: configRef.current.color.default,

                    // Paramètres avancés
                    angle: advancedParams.angle,
                    penumbra: advancedParams.penumbra,
                    distance: advancedParams.distance,
                    decay: advancedParams.decay,

                    // Direction
                    directionX: directionParams.offsetX,
                    directionY: directionParams.offsetY,
                    directionZ: directionParams.offsetZ,
                    directionDistance: directionParams.distance,

                    // État système
                    preloadState: flashlightState.preloadState || 'pending',

                    // Ombres
                    shadowsEnabled: configRef.current.shadows.enabled.default,
                    shadowMapSize: configRef.current.shadows.mapSize.default,
                    shadowBias: configRef.current.shadows.bias.default,
                    shadowNormalBias: configRef.current.shadows.normalBias.default
                };

                // SECTION: CONTRÔLES DE BASE
                // -----------------------------------

                // Activer/désactiver manuellement
                flashlightFolder.add(flashlightProxy, 'active')
                    .name('Activer')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            // Si actif, utiliser l'intensité normale, sinon mettre à 0
                            flashlightRef.current.intensity = value
                                ? flashlightProxy.normalIntensity
                                : 0;

                            // Mettre à jour l'état
                            updateFlashlightState({
                                active: value,
                                intensity: value ? flashlightProxy.normalIntensity : 0,
                                manuallyToggled: true
                            });
                        }
                    });

                // Auto-activation (basée sur la timeline)
                flashlightFolder.add(flashlightProxy, 'autoActivate')
                    .name('Activation automatique')
                    .onChange(value => {
                        updateFlashlightState({
                            autoActivate: value,
                            manuallyToggled: !value
                        });
                    });

                // Intensité actuelle
                const intensityController = flashlightFolder.add(
                    flashlightProxy,
                    'intensity',
                    0,
                    configRef.current.intensity.max,
                    configRef.current.intensity.step
                )
                    .name('Intensité actuelle')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.intensity = value;
                            updateFlashlightState({ intensity: value });
                        }
                    });

                // Intensité normale (quand activée)
                flashlightFolder.add(
                    flashlightProxy,
                    'normalIntensity',
                    configRef.current.intensity.min,
                    configRef.current.intensity.max,
                    configRef.current.intensity.step
                )
                    .name('Intensité normale')
                    .onChange(value => {
                        updateFlashlightState({ normalIntensity: value });
                        // Si la lampe est active, mettre à jour aussi l'intensité actuelle
                        if (flashlightRef.current && flashlightProxy.active) {
                            flashlightRef.current.intensity = value;
                            flashlightProxy.intensity = value;
                            intensityController.setValue(value);
                            updateFlashlightState({ intensity: value });
                        }
                    });

                // Couleur
                flashlightFolder.addColor(flashlightProxy, 'color')
                    .name('Couleur')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.color.set(value);
                        }
                    });

                // SECTION: DIRECTION (NOUVEAU)
                // -----------------------------------
                const directionFolder = flashlightFolder.addFolder('Direction');

                // Direction X
                directionFolder.add(
                    flashlightProxy,
                    'directionX',
                    configRef.current.target.offsetX.min,
                    configRef.current.target.offsetX.max,
                    configRef.current.target.offsetX.step
                )
                    .name('Direction X')
                    .onChange(value => {
                        setDirectionParams(prev => ({
                            ...prev,
                            offsetX: value
                        }));
                        updateFlashlightState({
                            direction: {
                                ...directionParams,
                                offsetX: value
                            }
                        });
                    });

                // Direction Y
                directionFolder.add(
                    flashlightProxy,
                    'directionY',
                    configRef.current.target.offsetY.min,
                    configRef.current.target.offsetY.max,
                    configRef.current.target.offsetY.step
                )
                    .name('Direction Y')
                    .onChange(value => {
                        setDirectionParams(prev => ({
                            ...prev,
                            offsetY: value
                        }));
                        updateFlashlightState({
                            direction: {
                                ...directionParams,
                                offsetY: value
                            }
                        });
                    });

                // Direction Z
                directionFolder.add(
                    flashlightProxy,
                    'directionZ',
                    configRef.current.target.offsetZ.min,
                    configRef.current.target.offsetZ.max,
                    configRef.current.target.offsetZ.step
                )
                    .name('Direction Z')
                    .onChange(value => {
                        setDirectionParams(prev => ({
                            ...prev,
                            offsetZ: value
                        }));
                        updateFlashlightState({
                            direction: {
                                ...directionParams,
                                offsetZ: value
                            }
                        });
                    });

                // Distance de la cible
                directionFolder.add(
                    flashlightProxy,
                    'directionDistance',
                    configRef.current.target.distance.min,
                    configRef.current.target.distance.max,
                    configRef.current.target.distance.step
                )
                    .name('Distance cible')
                    .onChange(value => {
                        setDirectionParams(prev => ({
                            ...prev,
                            distance: value
                        }));
                        updateFlashlightState({
                            direction: {
                                ...directionParams,
                                distance: value
                            }
                        });
                    });

                // SECTION: PARAMÈTRES AVANCÉS
                // -----------------------------------
                const advancedFolder = flashlightFolder.addFolder('Paramètres avancés');

                // Angle
                advancedFolder.add(
                    flashlightProxy,
                    'angle',
                    configRef.current.angle.min,
                    configRef.current.angle.max,
                    configRef.current.angle.step
                )
                    .name('Angle')
                    .onChange(value => {
                        setAdvancedParams(prev => ({
                            ...prev,
                            angle: value
                        }));
                        if (flashlightRef.current) {
                            flashlightRef.current.angle = value;
                        }
                    });

                // Penumbra (douceur des bords)
                advancedFolder.add(
                    flashlightProxy,
                    'penumbra',
                    configRef.current.penumbra.min,
                    configRef.current.penumbra.max,
                    configRef.current.penumbra.step
                )
                    .name('Douceur des bords')
                    .onChange(value => {
                        setAdvancedParams(prev => ({
                            ...prev,
                            penumbra: value
                        }));
                        if (flashlightRef.current) {
                            flashlightRef.current.penumbra = value;
                        }
                    });

                // Distance
                advancedFolder.add(
                    flashlightProxy,
                    'distance',
                    configRef.current.distance.min,
                    configRef.current.distance.max,
                    configRef.current.distance.step
                )
                    .name('Distance')
                    .onChange(value => {
                        setAdvancedParams(prev => ({
                            ...prev,
                            distance: value
                        }));
                        if (flashlightRef.current) {
                            flashlightRef.current.distance = value;
                        }
                    });

                // Decay (atténuation)
                advancedFolder.add(
                    flashlightProxy,
                    'decay',
                    configRef.current.decay.min,
                    configRef.current.decay.max,
                    configRef.current.decay.step
                )
                    .name('Atténuation')
                    .onChange(value => {
                        setAdvancedParams(prev => ({
                            ...prev,
                            decay: value
                        }));
                        if (flashlightRef.current) {
                            flashlightRef.current.decay = value;
                        }
                    });

                // SECTION: OMBRES
                // -----------------------------------
                const shadowsFolder = flashlightFolder.addFolder('Ombres');

                // Activer/désactiver les ombres
                shadowsFolder.add(flashlightProxy, 'shadowsEnabled')
                    .name('Activer les ombres')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.castShadow = value;
                        }
                    });

                // Taille de la shadow map
                shadowsFolder.add(
                    flashlightProxy,
                    'shadowMapSize',
                    configRef.current.shadows.mapSize.options
                )
                    .name('Résolution')
                    .onChange(value => {
                        if (flashlightRef.current && flashlightRef.current.shadow) {
                            flashlightRef.current.shadow.mapSize.width = value;
                            flashlightRef.current.shadow.mapSize.height = value;
                            flashlightRef.current.shadow.needsUpdate = true;
                        }
                    });

                // Bias (décalage d'ombre)
                shadowsFolder.add(
                    flashlightProxy,
                    'shadowBias',
                    configRef.current.shadows.bias.min,
                    configRef.current.shadows.bias.max,
                    configRef.current.shadows.bias.step
                )
                    .name('Bias')
                    .onChange(value => {
                        if (flashlightRef.current && flashlightRef.current.shadow) {
                            flashlightRef.current.shadow.bias = value;
                            flashlightRef.current.shadow.needsUpdate = true;
                        }
                    });

                // Normal Bias
                shadowsFolder.add(
                    flashlightProxy,
                    'shadowNormalBias',
                    configRef.current.shadows.normalBias.min,
                    configRef.current.shadows.normalBias.max,
                    configRef.current.shadows.normalBias.step
                )
                    .name('Normal Bias')
                    .onChange(value => {
                        if (flashlightRef.current && flashlightRef.current.shadow) {
                            flashlightRef.current.shadow.normalBias = value;
                            flashlightRef.current.shadow.needsUpdate = true;
                        }
                    });

                // SECTION: DIAGNOSTIC
                // -----------------------------------
                const diagnosticFolder = flashlightFolder.addFolder('Diagnostic');

                // Afficher l'état de préchargement (lecture seule)
                const preloadController = diagnosticFolder.add(
                    flashlightProxy,
                    'preloadState'
                )
                    .name('État de préchargement')
                    .disable();

                // Mise à jour de l'état de préchargement
                const unsubscribe = useStore.subscribe(
                    state => state.flashlight.preloadState,
                    (preloadState) => {
                        if (preloadController) {
                            flashlightProxy.preloadState = preloadState;
                            preloadController.updateDisplay();
                        }
                    }
                );

                // Fermer les sous-dossiers par défaut si configuré
                if (guiConfig.gui.closeFolders) {
                    directionFolder.open(); // Garder le dossier Direction ouvert pour faciliter l'accès
                    advancedFolder.open(); // Garder le dossier Paramètres avancés ouvert
                    shadowsFolder.close();
                    diagnosticFolder.close();
                }

                guiInitializedRef.current = true;
            }
        }
    }, [debug, gui, flashlightState, updateFlashlightState, directionParams, advancedParams]);

    // ACTIVATION AUTOMATIQUE DE L'INTENSITÉ en fonction de la timeline
    useEffect(() => {
        // Vérifier si on doit activer/désactiver
        if (!flashlightState.autoActivate || sequenceLength <= 0 || flashlightState.manuallyToggled) return;

        // Calculer le seuil d'activation (70% de la séquence)
        const activationThreshold = sequenceLength * 0.7;

        // Activer l'intensité à 70% de la timeline
        if (timelinePosition >= activationThreshold &&
            flashlightRef.current &&
            flashlightRef.current.intensity === 0) {

            // Utiliser requestAnimationFrame pour synchroniser avec le cycle de rendu
            requestAnimationFrame(() => {
                const targetIntensity = flashlightState.normalIntensity || normalIntensity;

                // Mettre à jour l'intensité réelle
                if (flashlightRef.current) {
                    flashlightRef.current.intensity = targetIntensity;
                }

                // Mettre à jour l'état
                updateFlashlightState({
                    intensity: targetIntensity,
                    manuallyToggled: false
                });

            });
        }
        // Désactiver l'intensité en revenant sous le seuil
        else if (timelinePosition < activationThreshold &&
            flashlightRef.current &&
            flashlightRef.current.intensity > 0) {

            requestAnimationFrame(() => {
                // Remettre l'intensité à zéro
                if (flashlightRef.current) {
                    flashlightRef.current.intensity = 0;
                }

                // Mettre à jour l'état
                updateFlashlightState({
                    intensity: 0,
                    manuallyToggled: false
                });
            });
        }
    }, [timelinePosition, sequenceLength, flashlightState, updateFlashlightState, normalIntensity, flashlightRef]);

    // Mettre à jour la position et la rotation à chaque frame
    useAnimationFrame(() => {
        if (flashlightRef.current && flashlightTargetRef.current) {
            // Position de la lampe par rapport à la caméra
            const offsetPosition = new THREE.Vector3(0.0, 0.0, 0.0);
            offsetPosition.applyQuaternion(camera.quaternion);
            flashlightRef.current.position.copy(camera.position).add(offsetPosition);

            // Direction basée sur les paramètres configurables
            const direction = new THREE.Vector3(
                directionParams.offsetX,
                directionParams.offsetY,
                directionParams.offsetZ
            );
            direction.normalize();
            direction.applyQuaternion(camera.quaternion);

            // Position de la cible
            const targetPosition = camera.position.clone().add(direction.multiplyScalar(directionParams.distance));
            flashlightTargetRef.current.position.copy(targetPosition);
            flashlightTargetRef.current.updateMatrixWorld();
        }
    }, 'camera');

    // Utiliser une résolution plus faible pour les shadow maps pour améliorer les performances
    const optimizedShadowMapSize = Math.min(configRef.current.shadows.mapSize.default, 1024);

    return (
        <spotLight
            ref={flashlightRef}
            position={[0, 0, 0]}
            intensity={0.0} // Commencer avec une intensité de zéro
            angle={advancedParams.angle}
            penumbra={advancedParams.penumbra}
            distance={advancedParams.distance}
            decay={advancedParams.decay}
            color={configRef.current.color.default}
            castShadow={configRef.current.shadows.enabled.default}
            shadow-mapSize-width={optimizedShadowMapSize}
            shadow-mapSize-height={optimizedShadowMapSize}
            shadow-bias={configRef.current.shadows.bias.default}
            shadow-normalBias={configRef.current.shadows.normalBias.default}
            visible={true} // Toujours visible, mais avec intensité zéro
        />
    );
}