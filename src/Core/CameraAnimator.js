// CameraAnimator.js
export default class CameraAnimator {
    constructor(theatreStateJSON, camera) {
        this.camera = camera;
        this.timelineLength = theatreStateJSON.sheetsById.Scene.sequence.length;
        this.position = 0;

        // Extraire les keyframes du JSON
        this.keyframes = this.parseKeyframes(theatreStateJSON);

        // État interne
        this.onUpdateCallbacks = [];
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
        return keyframes.map(kf => ({
            position: kf.position,
            value: kf.value
        })).sort((a, b) => a.position - b.position);
    }

    setPosition(pos) {
        this.position = Math.max(0, Math.min(this.timelineLength, pos));
        this.updateCamera();

        // Notifier les callbacks
        this.onUpdateCallbacks.forEach(callback => callback(this.position));
        return this.position;
    }

    onUpdate(callback) {
        this.onUpdateCallbacks.push(callback);
        // Retourner une fonction pour annuler l'abonnement
        return () => {
            this.onUpdateCallbacks = this.onUpdateCallbacks.filter(cb => cb !== callback);
        };
    }

    interpolateLinear(keyframes, position) {
        // Si aucun keyframe, retourner 0
        if (!keyframes || keyframes.length === 0) return 0;

        // Si un seul keyframe, retourner sa valeur
        if (keyframes.length === 1) return keyframes[0].value;

        // Trouver les deux keyframes encadrant la position actuelle
        let startFrame = keyframes[0];
        let endFrame = keyframes[keyframes.length - 1];

        for (let i = 0; i < keyframes.length - 1; i++) {
            if (position >= keyframes[i].position && position <= keyframes[i + 1].position) {
                startFrame = keyframes[i];
                endFrame = keyframes[i + 1];
                break;
            }
        }

        // Si position est avant le premier keyframe ou après le dernier
        if (position <= startFrame.position) return startFrame.value;
        if (position >= endFrame.position) return endFrame.value;

        // Interpolation linéaire
        const t = (position - startFrame.position) / (endFrame.position - startFrame.position);
        return startFrame.value + t * (endFrame.value - startFrame.value);
    }

    updateCamera() {
        // Interpoler toutes les propriétés
        const posX = this.interpolateLinear(this.keyframes.position.x, this.position);
        const posY = this.interpolateLinear(this.keyframes.position.y, this.position);
        const posZ = this.interpolateLinear(this.keyframes.position.z, this.position);

        const rotX = this.interpolateLinear(this.keyframes.rotation.x, this.position);
        const rotY = this.interpolateLinear(this.keyframes.rotation.y, this.position);
        const rotZ = this.interpolateLinear(this.keyframes.rotation.z, this.position);

        // Appliquer à la caméra
        this.camera.position.set(posX, posY, posZ);
        this.camera.rotation.set(rotX, rotY, rotZ);
        this.camera.updateProjectionMatrix();

        return {
            position: { x: posX, y: posY, z: posZ },
            rotation: { x: rotX, y: rotY, z: rotZ }
        };
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