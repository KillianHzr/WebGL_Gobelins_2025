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
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(camera.quaternion);
            const targetPosition = camera.position.clone().add(direction.multiplyScalar(10));
            flashlightTargetRef.current.position.copy(targetPosition);

            // Initialiser l'état dans le store
            updateFlashlightState({
                autoActivate: true,
                active: true, // La lumière est toujours active mais à intensité zéro
                intensity: 0,  // Intensité initiale: zéro
                normalIntensity: normalIntensity, // Sauvegarder l'intensité normale
                preloadState: 'initialized'
            });

            initializedRef.current = true;
        }

        // Nettoyage
        return () => {
            if (flashlightTargetRef.current) {
                scene.remove(flashlightTargetRef.current);
            }
        };
    }, [scene, camera, updateFlashlightState, normalIntensity]);

    // Configuration de la flashlight une fois créée
    useEffect(() => {
        if (!flashlightRef.current) return;


        // Configuration des paramètres
        const config = configRef.current;
        const flashlight = flashlightRef.current;

        // Paramètres principaux - AVEC INTENSITÉ ZÉRO
        flashlight.intensity = 0; // Commencer avec intensité zéro
        flashlight.angle = config.angle.default;
        flashlight.penumbra = config.penumbra.default;
        flashlight.distance = config.distance.default;
        flashlight.decay = config.decay.default;
        flashlight.color.set(config.color.default);

        // Configuration des ombres
        flashlight.castShadow = config.shadows.enabled.default;

        if (flashlight.shadow) {
            flashlight.shadow.mapSize.width = config.shadows.mapSize.default;
            flashlight.shadow.mapSize.height = config.shadows.mapSize.default;
            flashlight.shadow.bias = config.shadows.bias.default;
            flashlight.shadow.normalBias = config.shadows.normalBias.default;

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


    }, [flashlightRef.current, scene, camera, gl, updateFlashlightState]);

    // Initialiser les contrôles GUI une seule fois
    useEffect(() => {
        if (debug?.active && gui && !guiInitializedRef.current) {
            let flashlightFolder = gui.folders?.find(folder => folder.name === 'Flashlight');

            if (!flashlightFolder) {
                flashlightFolder = gui.addFolder('Flashlight');

                // Créer un objet proxy pour l'état actif
                const activeProxy = {
                    active: flashlightState.active,
                    autoActivate: flashlightState.autoActivate || true,
                    intensity: flashlightState.intensity || 0,
                    preloadState: flashlightState.preloadState || 'pending'
                };
                // Ajouter un contrôle d'intensité
                const intensityController = flashlightFolder.add(
                    activeProxy,
                    'intensity',
                    0,
                    configRef.current.intensity.max
                )
                    .name('Intensité actuelle')
                    .onChange(value => {
                        if (flashlightRef.current) {
                            flashlightRef.current.intensity = value;
                            updateFlashlightState({ intensity: value });
                        }
                    });



                guiInitializedRef.current = true;
            }
        }


    }, [debug, gui, flashlightState, updateFlashlightState]);

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

            // Direction légèrement vers le bas
            const direction = new THREE.Vector3(0, -0.75, -1);
            direction.normalize();
            direction.applyQuaternion(camera.quaternion);

            // Position de la cible
            const targetPosition = camera.position.clone().add(direction.multiplyScalar(10));
            flashlightTargetRef.current.position.copy(targetPosition);
            flashlightTargetRef.current.updateMatrixWorld();
        }
    }, 'camera');

    // Définir les constantes de configuration
    const {
        angle,
        penumbra,
        distance,
        decay,
        color,
        shadows
    } = configRef.current;

    // Utiliser une résolution plus faible pour les shadow maps pour améliorer les performances
    const optimizedShadowMapSize = Math.min(shadows.mapSize.default, 1024);

    return (
        <spotLight
            ref={flashlightRef}
            position={[0, 0, 0]}
            intensity={0} // Commencer avec une intensité de zéro
            angle={angle.default}
            penumbra={penumbra.default}
            distance={distance.default}
            decay={decay.default}
            color={color.default}
            castShadow={shadows.enabled.default}
            shadow-mapSize-width={optimizedShadowMapSize}
            shadow-mapSize-height={optimizedShadowMapSize}
            shadow-bias={shadows.bias.default}
            shadow-normalBias={shadows.normalBias.default}
            visible={true} // Toujours visible, mais avec intensité zéro
        />
    );
}