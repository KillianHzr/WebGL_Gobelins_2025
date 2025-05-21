import * as THREE from 'three';

export class CameraAnimatorGLB {
    constructor(cameraModel, camera, targetAnimationName = 'Action.006') {
        this.camera = camera;

        // CORRECTION: Prendre en compte le nouveau format de modèle
        if (cameraModel && typeof cameraModel === 'object' && cameraModel.scene) {
            this.cameraModel = cameraModel.scene;
            this.animations = cameraModel.animations || [];
        } else {
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

        // Initialiser les animations si disponibles
        this.initializeAnimation();
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

    // Le reste du code CameraAnimatorGLB reste inchangé...

    /**
     * Extrait les données de position et rotation de chaque frame de l'animation
     */
    extractFrames(animation) {
        this.frames = [];

        // Afficher toutes les tracks disponibles pour débogage
        console.log("Tracks d'animation disponibles:", animation.tracks.map(track => track.name));

        // Récupérer les tracks pour position et rotation
        const positionTracks = animation.tracks.filter(track => track.name.includes('position'));
        const rotationTracks = animation.tracks.filter(track =>
            track.name.includes('rotation') || track.name.includes('quaternion')
        );

        if (positionTracks.length === 0 || rotationTracks.length === 0) {
            console.error("Tracks de position ou rotation manquantes dans l'animation");
            console.log("Tracks disponibles:", animation.tracks.map(track => track.name));
            return;
        }

        console.log("Tracks de position:", positionTracks.map(track => track.name));
        console.log("Tracks de rotation:", rotationTracks.map(track => track.name));

        // Vérifier le format des tracks de position
        const isPosVector = positionTracks.length === 1 && positionTracks[0].name.includes('.position');
        const hasIndividualPosComponents = positionTracks.length >= 3;

        // Vérifier le format des tracks de rotation
        const isQuaternion = rotationTracks.some(track => track.name.includes('quaternion'));
        const isEuler = rotationTracks.some(track => track.name.includes('rotation'));

        // Déterminer le nombre de samples dans l'animation
        const maxSamples = Math.max(
            ...positionTracks.map(track => track.times.length),
            ...rotationTracks.map(track => track.times.length)
        );

        console.log(`Extraction de ${maxSamples} frames d'animation`);

        // Récupérer les tracks spécifiques pour chaque composante
        let posXTrack, posYTrack, posZTrack;
        let rotXTrack, rotYTrack, rotZTrack, rotWTrack;

        if (isPosVector) {
            // Si la position est stockée comme un vecteur dans une seule track
            posXTrack = posYTrack = posZTrack = positionTracks[0];
        } else {
            // Si chaque composante a sa propre track
            posXTrack = positionTracks.find(track => track.name.includes('position.x'));
            posYTrack = positionTracks.find(track => track.name.includes('position.y'));
            posZTrack = positionTracks.find(track => track.name.includes('position.z'));

            // Fallback si les noms ne suivent pas le schéma exact
            if (!posXTrack && positionTracks.length >= 3) {
                posXTrack = positionTracks[0];
                posYTrack = positionTracks[1];
                posZTrack = positionTracks[2];
            } else if (!posXTrack && positionTracks.length === 1) {
                // Si une seule track contient toutes les données
                posXTrack = posYTrack = posZTrack = positionTracks[0];
            }
        }

        if (isQuaternion) {
            rotXTrack = rotationTracks.find(track => track.name.includes('quaternion.x'));
            rotYTrack = rotationTracks.find(track => track.name.includes('quaternion.y'));
            rotZTrack = rotationTracks.find(track => track.name.includes('quaternion.z'));
            rotWTrack = rotationTracks.find(track => track.name.includes('quaternion.w'));

            // Fallback pour quaternion
            if (!rotXTrack && rotationTracks.length >= 4) {
                rotXTrack = rotationTracks[0];
                rotYTrack = rotationTracks[1];
                rotZTrack = rotationTracks[2];
                rotWTrack = rotationTracks[3];
            }
        } else {
            rotXTrack = rotationTracks.find(track => track.name.includes('rotation.x'));
            rotYTrack = rotationTracks.find(track => track.name.includes('rotation.y'));
            rotZTrack = rotationTracks.find(track => track.name.includes('rotation.z'));

            // Fallback pour euler
            if (!rotXTrack && rotationTracks.length >= 3) {
                rotXTrack = rotationTracks[0];
                rotYTrack = rotationTracks[1];
                rotZTrack = rotationTracks[2];
            }
        }

        // Pour chaque frame, extraire position et rotation
        for (let i = 0; i < maxSamples; i++) {
            const frameData = {};

            // Récupérer le temps de ce keyframe
            frameData.time = posXTrack && i < posXTrack.times.length ? posXTrack.times[i] : i / (maxSamples - 1) * animation.duration;

            // Extraire les positions
            if (posXTrack && posYTrack && posZTrack) {
                frameData.position = {
                    x: this.getValue(posXTrack, i, 0),
                    y: this.getValue(posYTrack, i, 1),
                    z: this.getValue(posZTrack, i, 2)
                };
            } else {
                frameData.position = { x: 0, y: 0, z: 0 };
            }

            // Extraire les rotations, avec conversion quaternion->euler si nécessaire
            if (isQuaternion && rotXTrack && rotYTrack && rotZTrack && rotWTrack) {
                const quaternion = new THREE.Quaternion(
                    this.getValue(rotXTrack, i, 0),
                    this.getValue(rotYTrack, i, 1),
                    this.getValue(rotZTrack, i, 2),
                    this.getValue(rotWTrack, i, 3)
                );

                const euler = new THREE.Euler().setFromQuaternion(quaternion);
                frameData.rotation = {
                    x: euler.x,
                    y: euler.y,
                    z: euler.z
                };
            } else if (rotXTrack && rotYTrack && rotZTrack) {
                frameData.rotation = {
                    x: this.getValue(rotXTrack, i, 0),
                    y: this.getValue(rotYTrack, i, 1),
                    z: this.getValue(rotZTrack, i, 2)
                };
            } else {
                frameData.rotation = { x: 0, y: 0, z: 0 };
            }

            this.frames.push(frameData);
        }

        console.log(`${this.frames.length} frames extraits de l'animation`);

        // Afficher quelques exemples de frames
        if (this.frames.length > 0) {
            console.log("Premier frame:", this.frames[0]);
            console.log("Dernier frame:", this.frames[this.frames.length - 1]);
        }
    }

    /**
     * Récupère la valeur à un index donné d'une track, avec gestion des différents formats
     */
    getValue(track, index, component = 0) {
        if (!track) return 0;

        // Si l'index est hors limites, utiliser le dernier keyframe disponible
        const safeIndex = Math.min(index, track.times.length - 1);

        if (safeIndex < 0) return 0;

        // Détecter le format de stockage des valeurs
        const valuesPerTime = track.values.length / track.times.length;

        // Log pour le débogage
        if (index === 0 || index === track.times.length - 1) {
            console.log(`Track ${track.name}, index ${index}, composante ${component}, valuesPerTime: ${valuesPerTime}`);
        }

        // Différents cas selon le format des données
        if (valuesPerTime === 1) {
            // Un seul canal (par exemple position.x)
            return track.values[safeIndex];
        } else if (valuesPerTime === 3) {
            // Vecteur 3D (position)
            return track.values[safeIndex * 3 + component];
        } else if (valuesPerTime === 4) {
            // Quaternion (rotation)
            return track.values[safeIndex * 4 + component];
        } else if (track.values.length === track.times.length) {
            // Un seul canal (format alternatif)
            return track.values[safeIndex];
        } else {
            // Tentative de récupération générique
            const valueIndex = safeIndex * Math.floor(valuesPerTime);
            const offset = component % Math.floor(valuesPerTime);
            return track.values[valueIndex + offset] || 0;
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
     * Met à jour la caméra en fonction de l'animation
     */
    updateCamera() {
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
                // Copier la transformation de la caméra du modèle à la caméra Three.js
                this.camera.position.copy(cameraObject.position);
                this.camera.rotation.copy(cameraObject.rotation);
                this.camera.updateProjectionMatrix();

                return {
                    position: {
                        x: cameraObject.position.x,
                        y: cameraObject.position.y,
                        z: cameraObject.position.z
                    },
                    rotation: {
                        x: cameraObject.rotation.x,
                        y: cameraObject.rotation.y,
                        z: cameraObject.rotation.z
                    }
                };
            }
        }

        // Fallback: Interpoler les données de frames
        const frameData = this.interpolateFrames(this.position);

        // S'assurer que les données de position et rotation sont correctement formées
        const validPosition = {
            x: frameData.position?.x ?? 0,
            y: frameData.position?.y ?? 0,
            z: frameData.position?.z ?? 0
        };

        const validRotation = {
            x: frameData.rotation?.x ?? 0,
            y: frameData.rotation?.y ?? 0,
            z: frameData.rotation?.z ?? 0
        };

        // Appliquer à la caméra avec vérifications supplémentaires
        this.camera.position.set(
            validPosition.x,
            validPosition.y,
            validPosition.z
        );

        this.camera.rotation.set(
            validRotation.x,
            validRotation.y,
            validRotation.z
        );

        // S'assurer que la matrice est mise à jour
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld(true);

        // Log pour débogage
        console.log(
            `Camera update: Position (${validPosition.x.toFixed(2)}, ${validPosition.y.toFixed(2)}, ${validPosition.z.toFixed(2)}) | ` +
            `Rotation (${validRotation.x.toFixed(2)}, ${validRotation.y.toFixed(2)}, ${validRotation.z.toFixed(2)})`
        );

        return {
            position: { ...validPosition },
            rotation: { ...validRotation }
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