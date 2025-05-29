import * as THREE from 'three';

export class CameraAnimatorGLB {
    constructor(cameraModel, camera, targetAnimationName = 'Action.008') {
        this.camera = camera;

        // CORRECTION: Prendre en compte le nouveau format de modèle
        if (cameraModel && typeof cameraModel === 'object' && cameraModel.scene) {
            // Nouveau format : {scene, animations}
            this.cameraModel = cameraModel.scene;
            this.animations = cameraModel.animations || [];
        } else {
            // Ancien format : modèle direct
            this.cameraModel = cameraModel;
            this.animations = cameraModel?.animations || [];
        }

        this.position = 0;
        this.timelineLength = 0;
        this.onUpdateCallbacks = [];
        this.frames = [];
        this.mixer = null;
        this.animationAction = null;
        this.targetAnimationName = targetAnimationName;

        // Cache pour l'interpolation
        this.lastInterpolation = {
            position: null,
            result: null
        };

        // Variables pour le mouse look
        this.mouseLook = {
            enabled: true,
            mouseX: 0.5, // Position normalisée (0-1)
            mouseY: 0.5, // Position normalisée (0-1)
            maxRotationX: Math.PI / 16  , // 22.5° vertical
            maxRotationY: Math.PI / 9, // 22.5° horizontal
            smoothing: 0.02, // Facteur de lissage
            currentOffsetX: 0, // Rotation actuelle X
            currentOffsetY: 0  // Rotation actuelle Y
        };

        // Initialiser le mouse tracking
        this.initializeMouseTracking();

        // Initialiser les animations si disponibles
        this.initializeAnimation();
    }

    /**
     * Initialise le système de suivi de la souris
     */
    initializeMouseTracking() {
        // Écouter les mouvements de souris
        const handleMouseMove = (event) => {
            if (!this.mouseLook.enabled) return;

            // Vérifier si une interface est active et désactiver le mouse look
            if (this.isAnyInterfaceActive()) {
                return;
            }

            // Normaliser les coordonnées de la souris (0-1)
            this.mouseLook.mouseX = event.clientX / window.innerWidth;
            this.mouseLook.mouseY = event.clientY / window.innerHeight;

            // Limiter les valeurs pour éviter les cas extrêmes
            this.mouseLook.mouseX = Math.max(0, Math.min(1, this.mouseLook.mouseX));
            this.mouseLook.mouseY = Math.max(0, Math.min(1, this.mouseLook.mouseY));
        };

        // Ajouter l'écouteur global
        if (typeof window !== 'undefined') {
            window.addEventListener('mousemove', handleMouseMove);

            // Stocker la référence pour le nettoyage
            this.mouseMoveHandler = handleMouseMove;
        }
    }

    /**
     * Vérifie si l'une des interfaces est actuellement active
     */
    isAnyInterfaceActive() {
        // Vérifier si useStore est disponible globalement
        if (typeof window !== 'undefined' && window.useStore) {
            try {
                const state = window.useStore.getState();
                const interaction = state.interaction;

                return (
                    interaction?.showCaptureInterface ||
                    interaction?.showScannerInterface ||
                    interaction?.showImageInterface
                );
            } catch (error) {
                // En cas d'erreur, ne pas bloquer le mouse look
                return false;
            }
        }

        // Fallback : essayer d'importer useStore dynamiquement
        try {
            // Si on ne peut pas accéder au store, ne pas bloquer le mouse look
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Calcule les offsets de rotation basés sur la position de la souris
     */
    calculateMouseLookOffsets() {
        if (!this.mouseLook.enabled) {
            return { offsetX: 0, offsetY: 0 };
        }

        // Vérifier si une interface est active
        if (this.isAnyInterfaceActive()) {
            // Réduire progressivement les offsets pour une transition fluide
            this.mouseLook.currentOffsetX *= 0.9;
            this.mouseLook.currentOffsetY *= 0.9;

            // Si les offsets sont très petits, les mettre à zéro
            if (Math.abs(this.mouseLook.currentOffsetX) < 0.001) {
                this.mouseLook.currentOffsetX = 0;
            }
            if (Math.abs(this.mouseLook.currentOffsetY) < 0.001) {
                this.mouseLook.currentOffsetY = 0;
            }

            return {
                offsetX: this.mouseLook.currentOffsetX,
                offsetY: this.mouseLook.currentOffsetY
            };
        }

        const targetOffsetY = -((this.mouseLook.mouseX - 0.5) * 2 * this.mouseLook.maxRotationY);
        const targetOffsetX = -((this.mouseLook.mouseY - 0.5) * 2 * this.mouseLook.maxRotationX);

        // Appliquer le lissage pour éviter les mouvements brusques
        this.mouseLook.currentOffsetX += (targetOffsetX - this.mouseLook.currentOffsetX) * this.mouseLook.smoothing;
        this.mouseLook.currentOffsetY += (targetOffsetY - this.mouseLook.currentOffsetY) * this.mouseLook.smoothing;

        return {
            offsetX: this.mouseLook.currentOffsetX,
            offsetY: this.mouseLook.currentOffsetY
        };
    }

    /**
     * Active/désactive le mouse look
     */
    setMouseLookEnabled(enabled) {
        this.mouseLook.enabled = enabled;

        // Si désactivé, réinitialiser progressivement les offsets
        if (!enabled) {
            const resetOffsets = () => {
                this.mouseLook.currentOffsetX *= 0.9;
                this.mouseLook.currentOffsetY *= 0.9;

                if (Math.abs(this.mouseLook.currentOffsetX) > 0.001 ||
                    Math.abs(this.mouseLook.currentOffsetY) > 0.001) {
                    requestAnimationFrame(resetOffsets);
                } else {
                    this.mouseLook.currentOffsetX = 0;
                    this.mouseLook.currentOffsetY = 0;
                }
            };
            resetOffsets();
        }
    }

    /**
     * Configure les paramètres du mouse look
     */
    setMouseLookSettings(settings) {
        if (settings.maxRotationX !== undefined) {
            this.mouseLook.maxRotationX = settings.maxRotationX;
        }
        if (settings.maxRotationY !== undefined) {
            this.mouseLook.maxRotationY = settings.maxRotationY;
        }
        if (settings.smoothing !== undefined) {
            this.mouseLook.smoothing = Math.max(0.01, Math.min(1, settings.smoothing));
        }
    }

    /**
     * Obtient les paramètres actuels du mouse look
     */
    getMouseLookSettings() {
        return {
            enabled: this.mouseLook.enabled,
            maxRotationX: this.mouseLook.maxRotationX,
            maxRotationY: this.mouseLook.maxRotationY,
            smoothing: this.mouseLook.smoothing,
            currentOffsets: {
                x: this.mouseLook.currentOffsetX,
                y: this.mouseLook.currentOffsetY
            }
        };
    }

    /**
     * Nettoie les écouteurs d'événements
     */
    dispose() {
        if (this.mouseMoveHandler && typeof window !== 'undefined') {
            window.removeEventListener('mousemove', this.mouseMoveHandler);
        }
    }

    /**
     * Initialise l'animation basée sur le modèle de caméra GLB
     */
    initializeAnimation() {
        if (!this.cameraModel) {
            console.error("Modèle de caméra non disponible pour l'initialisation de l'animation");
            return false;
        }

        // Chercher l'animation ciblée
        let targetAnimation = null;

        // CORRECTION: Vérifier si les animations sont disponibles dans le nouveau format
        const availableAnimations = this.animations;

        // Si des animations sont disponibles
        if (availableAnimations && availableAnimations.length > 0) {
            console.log("Animations disponibles:", availableAnimations.map(anim => anim.name));

            // Chercher l'animation par son nom exact ou qui contient le nom target
            targetAnimation = availableAnimations.find(anim =>
                anim.name === this.targetAnimationName ||
                anim.name.toLowerCase().includes(this.targetAnimationName.toLowerCase())
            );

            // Si non trouvée, utiliser la première animation disponible
            if (!targetAnimation && availableAnimations.length > 0) {
                console.warn(`Animation '${this.targetAnimationName}' non trouvée, utilisation de la première animation disponible`);
                targetAnimation = availableAnimations[0];
            }
        }

        if (!targetAnimation) {
            console.error("Aucune animation trouvée dans le modèle de caméra");
            return false;
        }

        console.log("Animation cible sélectionnée:", targetAnimation.name);

        // Créer un mixer pour lire l'animation
        this.mixer = new THREE.AnimationMixer(this.cameraModel);
        this.animationAction = this.mixer.clipAction(targetAnimation);

        // Ne pas jouer l'animation automatiquement, on va la contrôler manuellement
        this.animationAction.paused = true;
        this.animationAction.play();

        // Définir la longueur de la timeline basée sur la durée de l'animation
        this.timelineLength = targetAnimation.duration;
        console.log(`Animation initialisée, durée: ${this.timelineLength}s`);

        // Extraire les données de tous les frames pour l'interpolation frame par frame
        this.extractFrames(targetAnimation);

        return true;
    }

    /**
     * Extrait les données de position et rotation de chaque frame de l'animation
     */
    extractFrames(animation) {
        this.frames = [];

        // Récupérer les tracks pour position et rotation
        const positionTracks = animation.tracks.filter(track => track.name.includes('position'));
        const rotationTracks = animation.tracks.filter(track => track.name.includes('rotation') || track.name.includes('quaternion'));

        if (positionTracks.length === 0 || rotationTracks.length === 0) {
            console.error("Tracks de position ou rotation manquantes dans l'animation");
            return;
        }

        // Nombre de samples dans l'animation (utiliser le track avec le plus de keyframes)
        const maxSamples = Math.max(
            ...positionTracks.map(track => track.times.length),
            ...rotationTracks.map(track => track.times.length)
        );

        console.log(`Extraction de ${maxSamples} frames d'animation`);

        // Récupérer les tracks spécifiques pour chaque axe
        const posXTrack = positionTracks.find(track => track.name.includes('position.x')) || positionTracks[0];
        const posYTrack = positionTracks.find(track => track.name.includes('position.y')) || positionTracks[0];
        const posZTrack = positionTracks.find(track => track.name.includes('position.z')) || positionTracks[0];

        const rotXTrack = rotationTracks.find(track => track.name.includes('rotation.x') || track.name.includes('quaternion.x')) || rotationTracks[0];
        const rotYTrack = rotationTracks.find(track => track.name.includes('rotation.y') || track.name.includes('quaternion.y')) || rotationTracks[0];
        const rotZTrack = rotationTracks.find(track => track.name.includes('rotation.z') || track.name.includes('quaternion.z')) || rotationTracks[0];
        const rotWTrack = rotationTracks.find(track => track.name.includes('quaternion.w'));

        // Déterminer si nous avons des quaternions ou des euler angles
        const isQuaternion = rotXTrack.name.includes('quaternion');

        // Pour chaque frame
        for (let i = 0; i < maxSamples; i++) {
            const frameData = {};

            // Interpoler ou récupérer les valeurs pour cette frame
            if (i < posXTrack.times.length) {
                frameData.time = posXTrack.times[i];

                frameData.position = {
                    x: this.getValue(posXTrack, i),
                    y: this.getValue(posYTrack, i),
                    z: this.getValue(posZTrack, i)
                };

                if (isQuaternion && rotWTrack) {
                    // Si c'est un quaternion
                    const quaternion = new THREE.Quaternion(
                        this.getValue(rotXTrack, i),
                        this.getValue(rotYTrack, i),
                        this.getValue(rotZTrack, i),
                        this.getValue(rotWTrack, i)
                    );

                    // Convertir en Euler
                    const euler = new THREE.Euler().setFromQuaternion(quaternion);

                    frameData.rotation = {
                        x: euler.x,
                        y: euler.y,
                        z: euler.z
                    };
                } else {
                    // Angles d'Euler
                    frameData.rotation = {
                        x: this.getValue(rotXTrack, i),
                        y: this.getValue(rotYTrack, i),
                        z: this.getValue(rotZTrack, i)
                    };
                }

                this.frames.push(frameData);
            }
        }

        console.log(`${this.frames.length} frames extraits de l'animation`);
    }

    /**
     * Récupère la valeur à un index donné d'une track, avec gestion des différents formats
     */
    getValue(track, index) {
        if (!track || index >= track.times.length) return 0;

        // Les valeurs peuvent être stockées différemment selon le type de track
        if (track.values.length === track.times.length) {
            // Un seul canal
            return track.values[index];
        } else {
            // Multiple canaux (vecteurs, quaternions)
            const valuesPerTime = track.values.length / track.times.length;
            return track.values[index * valuesPerTime];
        }
    }

    /**
     * Définit la position actuelle dans la timeline et met à jour la caméra
     */
    setPosition(pos) {
        // Contraindre la position dans les limites
        this.position = Math.max(0, Math.min(this.timelineLength, pos));

        // Mettre à jour l'animation si disponible
        if (this.mixer && this.animationAction) {
            this.animationAction.time = this.position;
            this.mixer.update(0); // Appliquer les changements sans avancer le temps
        }

        // Mettre à jour la caméra avec la nouvelle position
        const cameraState = this.updateCamera();

        // Notifier les callbacks enregistrés
        if (this.onUpdateCallbacks.length > 0) {
            this.onUpdateCallbacks.forEach(callback => callback(this.position));
        }

        return this.position;
    }

    /**
     * Enregistre un callback à appeler lorsque la position est mise à jour
     */
    onUpdate(callback) {
        if (typeof callback === 'function') {
            this.onUpdateCallbacks.push(callback);

            // Retourner une fonction pour annuler l'abonnement
            return () => {
                this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
            };
        }
        return null;
    }

    /**
     * Trouve la paire de frames encadrant une position donnée
     */
    findFramesBracket(position) {
        // Si aucun frame, retourner null
        if (!this.frames || this.frames.length === 0) return null;

        // Si un seul frame, retourner ce frame comme début et fin
        if (this.frames.length === 1) return [this.frames[0], this.frames[0]];

        // Si position est avant le premier frame
        if (position <= this.frames[0].time) return [this.frames[0], this.frames[0]];

        // Si position est après le dernier frame
        if (position >= this.frames[this.frames.length - 1].time) {
            return [this.frames[this.frames.length - 1], this.frames[this.frames.length - 1]];
        }

        // Recherche binaire pour trouver les frames encadrants
        let start = 0;
        let end = this.frames.length - 1;

        while (start <= end) {
            const mid = Math.floor((start + end) / 2);

            if (this.frames[mid].time <= position && (mid === this.frames.length - 1 || this.frames[mid + 1].time >= position)) {
                return [this.frames[mid], this.frames[mid + 1] || this.frames[mid]];
            }

            if (this.frames[mid].time > position) {
                end = mid - 1;
            } else {
                start = mid + 1;
            }
        }

        // Fallback: recherche linéaire
        for (let i = 0; i < this.frames.length - 1; i++) {
            if (position >= this.frames[i].time && position <= this.frames[i + 1].time) {
                return [this.frames[i], this.frames[i + 1]];
            }
        }

        // En cas d'échec, retourner les premiers frames
        return [this.frames[0], this.frames[0]];
    }

    /**
     * Interpole les données entre deux frames
     */
    interpolateFrames(position) {
        // Utiliser le cache si disponible pour la même position
        if (this.lastInterpolation.position === position) {
            return this.lastInterpolation.result;
        }

        // Trouver les frames encadrant la position actuelle
        const bracket = this.findFramesBracket(position);

        if (!bracket) return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };

        const [startFrame, endFrame] = bracket;

        // Si les frames sont identiques, retourner les valeurs directement
        if (startFrame === endFrame) {
            return {
                position: { ...startFrame.position },
                rotation: { ...startFrame.rotation }
            };
        }

        // Calculer le facteur d'interpolation
        const t = (position - startFrame.time) / (endFrame.time - startFrame.time);

        // Interpolation linéaire
        const result = {
            position: {
                x: startFrame.position.x + t * (endFrame.position.x - startFrame.position.x),
                y: startFrame.position.y + t * (endFrame.position.y - startFrame.position.y),
                z: startFrame.position.z + t * (endFrame.position.z - startFrame.position.z)
            },
            rotation: {
                x: startFrame.rotation.x + t * (endFrame.rotation.x - startFrame.rotation.x),
                y: startFrame.rotation.y + t * (endFrame.rotation.y - startFrame.rotation.y),
                z: startFrame.rotation.z + t * (endFrame.rotation.z - startFrame.rotation.z)
            }
        };

        // Mettre à jour le cache
        this.lastInterpolation = {
            position,
            result
        };

        return result;
    }

    /**
     * Met à jour la caméra en fonction de l'animation ET du mouse look
     */
    updateCamera() {
        let baseRotation = { x: 0, y: 0, z: 0 };
        let basePosition = { x: 0, y: 0, z: 0 };

        // Si l'animation est disponible, utiliser la méthode directe
        if (this.mixer && this.animationAction) {
            // On a déjà mis à jour le mixer avec la nouvelle position dans setPosition()
            // Trouver l'objet caméra dans le modèle
            let cameraObject = null;
            this.cameraModel.traverse((object) => {
                if (object.isCamera) {
                    cameraObject = object;
                }
            });

            // Si pas de caméra trouvée, chercher un objet qui pourrait être une caméra
            if (!cameraObject) {
                this.cameraModel.traverse((object) => {
                    if (object.name.toLowerCase().includes('camera')) {
                        cameraObject = object;
                    }
                });
            }

            if (cameraObject) {
                // Récupérer la transformation de base de la caméra du modèle
                basePosition = {
                    x: cameraObject.position.x,
                    y: cameraObject.position.y,
                    z: cameraObject.position.z
                };
                baseRotation = {
                    x: cameraObject.rotation.x,
                    y: cameraObject.rotation.y,
                    z: cameraObject.rotation.z
                };
            }
        } else {
            // Fallback: Interpoler les données de frames
            const frameData = this.interpolateFrames(this.position);
            basePosition = frameData.position;
            baseRotation = frameData.rotation;
        }

        // Appliquer la position de base
        this.camera.position.set(
            basePosition.x,
            basePosition.y,
            basePosition.z
        );

        // Calculer les offsets de mouse look
        const mouseOffsets = this.calculateMouseLookOffsets();

        // CORRIGÉ: Utiliser une approche par quaternions propre pour éviter les effets de gimbal
        // 1. Créer le quaternion de base à partir de la rotation d'animation
        const baseQuaternion = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(baseRotation.x, baseRotation.y, baseRotation.z, 'XYZ')
        );

        // 2. Créer les quaternions pour les rotations additionnelles
        // Rotation horizontale (yaw) autour de l'axe Y global
        const yawQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            mouseOffsets.offsetY
        );

        // Rotation verticale (pitch) autour de l'axe X global
        const pitchQuaternion = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            mouseOffsets.offsetX
        );

        // 3. Combiner les quaternions : Base * Yaw * Pitch
        const finalQuaternion = new THREE.Quaternion()
            .multiplyQuaternions(baseQuaternion, yawQuaternion)
            .multiply(pitchQuaternion);

        // 4. Appliquer le quaternion final à la caméra
        this.camera.setRotationFromQuaternion(finalQuaternion);

        // Mettre à jour la matrice de la caméra
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld(true);

        return {
            position: { ...basePosition },
            rotation: {
                x: this.camera.rotation.x,
                y: this.camera.rotation.y,
                z: this.camera.rotation.z
            },
            mouseOffsets
        };
    }

    /**
     * Récupère la position actuelle
     */
    getPosition() {
        return this.position;
    }

    /**
     * Récupère la longueur totale de l'animation
     */
    getLength() {
        return this.timelineLength;
    }
}