// CameraAnimator.js - Version optimisée
export default class CameraAnimator {
    constructor(theatreStateJSON, camera) {
        this.camera = camera;
        this.timelineLength = theatreStateJSON.sheetsById.Scene.sequence.length;
        this.position = 0;

        // Extraire les keyframes du JSON
        this.keyframes = this.parseKeyframes(theatreStateJSON);

        // État interne
        this.onUpdateCallbacks = [];

        // Cache pour l'interpolation
        this.lastInterpolation = {
            position: null,
            result: null
        };
    }

    parseKeyframes(jsonData) {
        const cameraData = jsonData.sheetsById.Scene.sequence.tracksByObject.Camera;
        const trackData = cameraData.trackData;

        return {
            position: {
                x: this.extractKeyframeValues(trackData.T4u_ziqFPX.keyframes),
                y: this.extractKeyframeValues(trackData["3ACLM2u0GC"].keyframes),
                z: this.extractKeyframeValues(trackData.quxbOSJmwB.keyframes)
            },
            rotation: {
                x: this.extractKeyframeValues(trackData["3kFWG-HZ1b"].keyframes),
                y: this.extractKeyframeValues(trackData.JfCgozHAHJ.keyframes),
                z: this.extractKeyframeValues(trackData["2D5R_HPdTy"].keyframes)
            },
            // Ajoutez d'autres propriétés au besoin (scale, etc.)
        };
    }

    extractKeyframeValues(keyframes) {
        // Optimisation: trier une seule fois pendant l'extraction
        return keyframes
            .map(kf => ({
                position: kf.position,
                value: kf.value
            }))
            .sort((a, b) => a.position - b.position);
    }

    setPosition(pos) {
        // Contraindre la position dans les limites
        this.position = Math.max(0, Math.min(this.timelineLength, pos));

        // Mettre à jour la caméra avec la nouvelle position
        const cameraState = this.updateCamera();

        // Notifier les callbacks enregistrés
        if (this.onUpdateCallbacks.length > 0) {
            this.onUpdateCallbacks.forEach(callback => callback(this.position));
        }

        return this.position;
    }

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

    findKeyframesBracket(keyframes, position) {
        // Si aucun keyframe, retourner null
        if (!keyframes || keyframes.length === 0) return null;

        // Si un seul keyframe, retourner ce keyframe comme début et fin
        if (keyframes.length === 1) return [keyframes[0], keyframes[0]];

        // Si position est avant le premier keyframe
        if (position <= keyframes[0].position) return [keyframes[0], keyframes[0]];

        // Si position est après le dernier keyframe
        if (position >= keyframes[keyframes.length - 1].position) {
            return [keyframes[keyframes.length - 1], keyframes[keyframes.length - 1]];
        }

        // Recherche binaire pour trouver les keyframes encadrants (plus efficace pour des grands tableaux)
        let start = 0;
        let end = keyframes.length - 1;

        while (start <= end) {
            const mid = Math.floor((start + end) / 2);

            if (keyframes[mid].position <= position && keyframes[mid + 1].position >= position) {
                return [keyframes[mid], keyframes[mid + 1]];
            }

            if (keyframes[mid].position > position) {
                end = mid - 1;
            } else {
                start = mid + 1;
            }
        }

        // Fallback: recherche linéaire si la recherche binaire échoue
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (position >= keyframes[i].position && position <= keyframes[i + 1].position) {
                return [keyframes[i], keyframes[i + 1]];
            }
        }

        // En cas d'échec, retourner les premiers keyframes
        return [keyframes[0], keyframes[0]];
    }

    interpolateLinear(keyframes, position) {
        // Utiliser le cache si disponible pour la même position
        if (this.lastInterpolation.position === position &&
            this.lastInterpolation.keyframes === keyframes) {
            return this.lastInterpolation.result;
        }

        // Si aucun keyframe, retourner 0
        if (!keyframes || keyframes.length === 0) return 0;

        // Si un seul keyframe, retourner sa valeur
        if (keyframes.length === 1) return keyframes[0].value;

        // Trouver les deux keyframes encadrant la position actuelle
        const bracket = this.findKeyframesBracket(keyframes, position);

        if (!bracket) return 0;

        const [startFrame, endFrame] = bracket;

        // Si les keyframes sont identiques, retourner la valeur directement
        if (startFrame === endFrame) return startFrame.value;

        // Interpolation linéaire
        const t = (position - startFrame.position) / (endFrame.position - startFrame.position);
        const result = startFrame.value + t * (endFrame.value - startFrame.value);

        // Mettre à jour le cache
        this.lastInterpolation = {
            position,
            keyframes,
            result
        };

        return result;
    }

    updateCamera() {
        // Interpoler toutes les propriétés
        const posX = this.interpolateLinear(this.keyframes.position.x, this.position);
        const posY = this.interpolateLinear(this.keyframes.position.y, this.position);
        const posZ = this.interpolateLinear(this.keyframes.position.z, this.position);

        const rotX = this.interpolateLinear(this.keyframes.rotation.x, this.position);
        const rotY = this.interpolateLinear(this.keyframes.rotation.y, this.position);
        const rotZ = this.interpolateLinear(this.keyframes.rotation.z, this.position);

        // Appliquer à la caméra seulement si des changements significatifs
        const position = { x: posX, y: posY, z: posZ };
        const rotation = { x: rotX, y: rotY, z: rotZ };

        // Appliquer les valeurs à la caméra
        this.camera.position.set(posX, posY, posZ);
        this.camera.rotation.set(rotX, rotY, rotZ);
        this.camera.updateProjectionMatrix();

        return { position, rotation };
    }

    // Obtenir la position actuelle
    getPosition() {
        return this.position;
    }

    // Obtenir la longueur totale
    getLength() {
        return this.timelineLength;
    }
}