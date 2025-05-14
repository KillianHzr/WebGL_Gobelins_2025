import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import useStore from '../Store/useStore';
import { EventBus } from '../Utils/EventEmitter';
import * as THREE from 'three';

/**
 * Composant de caméra libre contrôlable avec ZQSD/WASD
 * S'active uniquement quand le mode caméra "free" est sélectionné
 */
export default function FreeCamera() {
    const { camera } = useThree();
    const keysPressed = useRef({});
    const cameraMode = useStore((state) => state.cameraMode || 'default');
    const setAllowScroll = useStore((state) => state.interaction?.setAllowScroll);

    // Référence pour suivre le dernier mode de caméra connu
    const lastKnownMode = useRef(cameraMode);

    // Vitesse de déplacement de la caméra
    const speed = 0.15;

    // Définition des vecteurs de direction pour optimiser les performances
    const moveForward = useRef(new THREE.Vector3(0, 0, -1));
    const moveRight = useRef(new THREE.Vector3(1, 0, 0));
    const tempVector = useRef(new THREE.Vector3());

    // Référence pour stocker la position et rotation initiales de la caméra
    // pour pouvoir y revenir lors de la désactivation du mode libre
    const initialCameraState = useRef({
        position: null,
        rotation: null
    });

    // Gestionnaire de touche enfoncée
    const handleKeyDown = (event) => {
        if (!isFreeCameraActive()) return;

        // Eviter que les touches ne défilent la page
        if (['z', 'q', 's', 'd', 'w', 'a', ' ', 'shift'].includes(event.key.toLowerCase())) {
            event.preventDefault();
        }

        keysPressed.current[event.key.toLowerCase()] = true;
    };

    // Gestionnaire de touche relâchée
    const handleKeyUp = (event) => {
        if (!isFreeCameraActive()) return;

        keysPressed.current[event.key.toLowerCase()] = false;
    };

    // Fonction pour vérifier si la caméra libre est active
    const isFreeCameraActive = () => {
        return cameraMode === 'free';
    };

    // Gestion des entrées du clavier et mise à jour de la position de la caméra
    const updateCamera = () => {
        if (!isFreeCameraActive()) return;

        // Mettre à jour les vecteurs de direction basés sur la rotation actuelle de la caméra
        moveForward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
        moveForward.current.y = 0; // Restreindre le mouvement au plan XZ
        moveForward.current.normalize();

        moveRight.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
        moveRight.current.y = 0; // Restreindre le mouvement au plan XZ
        moveRight.current.normalize();

        // Réinitialiser le vecteur temporaire
        tempVector.current.set(0, 0, 0);

        // Déplacement avant/arrière (Z/S)
        if (keysPressed.current['z'] || keysPressed.current['w']) {
            tempVector.current.add(moveForward.current);
        }
        if (keysPressed.current['s']) {
            tempVector.current.sub(moveForward.current);
        }

        // Déplacement gauche/droite (Q/D)
        if (keysPressed.current['q'] || keysPressed.current['a']) {
            tempVector.current.sub(moveRight.current);
        }
        if (keysPressed.current['d']) {
            tempVector.current.add(moveRight.current);
        }

        // Déplacement vertical (Espace/Shift)
        if (keysPressed.current[' ']) {
            tempVector.current.y += 1;
        }
        if (keysPressed.current['shift']) {
            tempVector.current.y -= 1;
        }

        // Normaliser et appliquer la vitesse si un mouvement est détecté
        if (tempVector.current.lengthSq() > 0) {
            tempVector.current.normalize().multiplyScalar(speed);
            camera.position.add(tempVector.current);
        }
    };

    // Animation frame pour la mise à jour continue
    useEffect(() => {
        let animationFrameId;

        const animate = () => {
            updateCamera();
            animationFrameId = requestAnimationFrame(animate);
        };

        if (isFreeCameraActive()) {
            animate();
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [cameraMode]);

    // Configurer les écouteurs d'événements du clavier
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [cameraMode]);

    // Détecter les changements de mode caméra et gérer les transitions
    useEffect(() => {
        // Si le mode a changé depuis le dernier rendu
        if (cameraMode !== lastKnownMode.current) {
            // Activation du mode caméra libre
            if (cameraMode === 'free') {
                console.log('Activation de la caméra libre (ZQSD)');
                // Sauvegarder l'état actuel de la caméra
                initialCameraState.current = {
                    position: camera.position.clone(),
                    rotation: camera.rotation.clone()
                };
                // Désactiver le défilement automatique
                if (setAllowScroll) setAllowScroll(false);
            }
            // Désactivation du mode caméra libre
            else if (lastKnownMode.current === 'free') {
                console.log('Désactivation de la caméra libre, retour au mode par défaut');
                // Restaurer l'état précédent de la caméra
                if (initialCameraState.current.position && initialCameraState.current.rotation) {
                    camera.position.copy(initialCameraState.current.position);
                    camera.rotation.copy(initialCameraState.current.rotation);
                    camera.updateProjectionMatrix();
                }
                // Réactiver le défilement
                if (setAllowScroll) setAllowScroll(true);
            }

            // Mettre à jour la référence du dernier mode connu
            lastKnownMode.current = cameraMode;
        }
    }, [camera, cameraMode, setAllowScroll]);

    // Écouteur d'événement pour les changements de mode caméra externes
    useEffect(() => {
        const handleCameraModeChanged = (data) => {
            // Pas besoin de traiter ici car useEffect ci-dessus s'en occupe
        };

        // S'abonner à l'événement de changement de mode caméra
        const cameraModeSubscription = EventBus.on('camera-mode-changed', handleCameraModeChanged);

        return () => {
            cameraModeSubscription();
        };
    }, []);

    // Ajouter un message d'aide dans la console au démarrage du mode caméra libre
    useEffect(() => {
        if (cameraMode === 'free') {
            console.log('------ Caméra libre activée ------');
            console.log('Contrôles: Z/Q/S/D pour se déplacer');
            console.log('Espace/Shift pour monter/descendre');
            console.log('Cliquer et déplacer la souris pour orienter la caméra');
            console.log('----------------------------------');
        }
    }, [cameraMode]);

    return null; // Ce composant ne rend rien visuellement
}