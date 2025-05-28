import * as THREE from 'three';
import { CameraAnimatorGLB } from './CameraAnimatorGLB';

/**
 * Extrait la caméra et prépare l'animation depuis un modèle GLB
 * @param {Object} cameraModel - Le modèle GLB chargé
 * @param {THREE.Camera} camera - La caméra Three.js à animer
 * @returns {Object} Objet contenant la caméra extraite et l'animateur
 */
export function loadCameraFromGLB(cameraModel, camera) {
    // S'assurer que le modèle a une structure valide
    if (!cameraModel) {
        console.error("loadCameraFromGLB: Modèle de caméra invalide");
        throw new Error("Modèle de caméra invalide");
    }

    // Normaliser la structure du modèle
    const normalizedModel = normalizeModelStructure(cameraModel);
    console.log("Modèle normalisé:",
        normalizedModel.scene ? "Contient une scène" : "Pas de scène",
        "Animations:", normalizedModel.animations.length);

    // Extraire la caméra du modèle
    const extractedCamera = findCameraInModel(normalizedModel.scene);
    console.log("Caméra extraite:", extractedCamera ?
        `Trouvée (${extractedCamera.isCamera ? 'Camera' : 'Object3D'}, fov=${extractedCamera.fov || 'N/A'})` :
        "Non trouvée");

    // Trouver l'animation cible
    const targetAnimation = findTargetAnimation(normalizedModel.animations);
    console.log("Animation cible:", targetAnimation ?
        `'${targetAnimation.name}' (${targetAnimation.duration}s)` :
        "Aucune animation trouvée");

    // Si aucune caméra n'est trouvée, créer une caméra par défaut dans le modèle
    if (!extractedCamera) {
        console.warn("Aucune caméra trouvée dans le modèle, création d'une caméra par défaut");
        const defaultCamera = createDefaultCameraInModel(normalizedModel.scene, camera);
        console.log("Caméra par défaut créée avec fov=", defaultCamera.fov);
    }

    // Sauvegarder les valeurs initiales pour vérifier qu'elles sont bien appliquées
    const initialCameraValues = {
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
        aspect: camera.aspect
    };
    console.log("VALEURS INITIALES de la caméra avant extraction:", initialCameraValues);

    // Configuration des paramètres de caméra
    let cameraConfig = extractCameraParameters(extractedCamera, camera);

    // Appliquer explicitement les paramètres à la caméra
    applyParametersToCamera(camera, cameraConfig);

    // Créer l'animateur
    const animator = new CameraAnimatorGLB(normalizedModel, camera, targetAnimation);
    if (animator && animator.timelineLength > 0) {
        console.log(`Animateur créé avec succès, durée: ${animator.timelineLength}s`);
    } else {
        console.warn("Problème avec l'animateur - durée peut être incorrecte");
    }

    // Vérifier que les paramètres ont bien été appliqués
    console.log("VÉRIFICATION FINALE des paramètres de la caméra:", {
        initial: initialCameraValues,
        config: cameraConfig,
        actual: {
            fov: camera.fov,
            near: camera.near,
            far: camera.far,
            aspect: camera.aspect
        }
    });

    return {
        extractedCamera,
        animator,
        targetAnimation,
        model: normalizedModel,
        cameraConfig
    };
}

/**
 * Crée une caméra par défaut dans le modèle si aucune n'est trouvée
 * @param {THREE.Object3D} scene - La scène du modèle
 * @param {THREE.Camera} referenceCamera - La caméra de référence
 * @returns {THREE.PerspectiveCamera} La caméra créée
 */
function createDefaultCameraInModel(scene, referenceCamera) {
    // Créer une nouvelle caméra
    const defaultCamera = new THREE.PerspectiveCamera(
        24,                                     // FOV
        referenceCamera.aspect,                 // Aspect ratio
        0.1,                                    // Near
        200                                     // Far
    );

    // Position initiale raisonnable
    defaultCamera.position.set(0, 1.6, 0);
    defaultCamera.name = "DefaultCamera";

    // Ajouter à la scène du modèle
    scene.add(defaultCamera);

    return defaultCamera;
}

/**
 * Normalise la structure du modèle GLB pour assurer un format cohérent
 * @param {Object} model - Le modèle GLB potentiellement dans différents formats
 * @returns {Object} Modèle normalisé avec scene et animations
 */
function normalizeModelStructure(model) {
    console.log("Normalisation du modèle:", model);

    // Structure normalisée
    const normalized = {
        scene: null,
        animations: []
    };

    // Détecter et normaliser le format du modèle
    if (model.scene) {
        normalized.scene = model.scene;
    } else if (model.isObject3D) {
        normalized.scene = model;
    } else if (typeof model === 'object') {
        // Chercher le premier objet 3D qui pourrait être une scène
        for (const key in model) {
            if (model[key] && model[key].isObject3D) {
                normalized.scene = model[key];
                console.log(`Objet 3D trouvé sous la clé '${key}'`);
                break;
            }
        }

        // Si toujours pas trouvé, créer une scène vide
        if (!normalized.scene) {
            console.warn("Aucun objet 3D trouvé dans le modèle, création d'une scène vide");
            normalized.scene = new THREE.Group();
            normalized.scene.name = "GeneratedScene";
        }
    } else {
        // Créer une scène vide en dernier recours
        console.error("Format de modèle inattendu:", typeof model);
        normalized.scene = new THREE.Group();
        normalized.scene.name = "FallbackScene";
    }

    // Normaliser les animations
    if (model.animations && Array.isArray(model.animations)) {
        normalized.animations = model.animations;
        console.log(`${model.animations.length} animations trouvées directement dans le modèle`);
    } else if (model.animation && model.animation.animations) {
        normalized.animations = model.animation.animations;
        console.log(`${model.animation.animations.length} animations trouvées dans model.animation`);
    } else if (model.animationClips && Array.isArray(model.animationClips)) {
        normalized.animations = model.animationClips;
        console.log(`${model.animationClips.length} animations trouvées dans animationClips`);
    } else {
        // Essayer de trouver des animations ailleurs dans l'objet
        console.warn("Recherche approfondie d'animations");
        for (const key in model) {
            if (model[key] && Array.isArray(model[key]) &&
                model[key].length > 0 &&
                (model[key][0] instanceof THREE.AnimationClip ||
                    (model[key][0] && model[key][0].isAnimationClip))) {
                normalized.animations = model[key];
                console.log(`${model[key].length} animations trouvées sous la clé '${key}'`);
                break;
            }
        }
    }

    // Valider la structure normalisée
    if (!normalized.scene) {
        console.error("Impossible de normaliser la scène");
    }

    if (normalized.animations.length === 0) {
        console.warn("Aucune animation trouvée après normalisation");
    } else {
        console.log("Animations normalisées:", normalized.animations.map(a => a.name).join(', '));
    }

    return normalized;
}

/**
 * Trouve un objet caméra dans le modèle GLB
 * @param {THREE.Object3D} scene - La scène à parcourir
 * @returns {THREE.Object3D|null} L'objet caméra ou null si non trouvé
 */
function findCameraInModel(scene) {
    if (!scene) {
        console.error("findCameraInModel: scène invalide");
        return null;
    }

    let foundCamera = null;
    let possibleCameras = [];

    // Parcourir la scène pour trouver une caméra
    scene.traverse((object) => {
        // Si déjà trouvé une caméra véritable, ne pas continuer
        if (foundCamera && foundCamera.isCamera) return;

        // Vérifier si c'est une caméra
        if (object.isCamera) {
            foundCamera = object;
            console.log(`FOV DEBUG: Caméra trouvée dans le modèle:`, {
                name: object.name,
                fov: object.fov,
                near: object.near,
                far: object.far,
                isInstance: object instanceof THREE.PerspectiveCamera,
                hasProjectionMatrix: !!object.projectionMatrix
            });
        }
        // Collecter les objets qui pourraient être des caméras
        else if (object.name &&
            (object.name.toLowerCase().includes('camera') ||
                object.name.toLowerCase().includes('cam'))) {
            possibleCameras.push(object);
            console.log(`FOV DEBUG: Objet caméra potentiel:`, {
                name: object.name,
                type: object.type,
                hasProperties: {
                    fov: object.fov !== undefined,
                    near: object.near !== undefined,
                    far: object.far !== undefined
                }
            });
        }
    });

    // Si une vraie caméra a été trouvée, l'utiliser
    if (foundCamera && foundCamera.isCamera) {
        return foundCamera;
    }

    // Sinon, utiliser le premier objet caméra potentiel
    if (possibleCameras.length > 0) {
        console.log(`FOV DEBUG: Utilisation de l'objet "${possibleCameras[0].name}" comme caméra (non standard)`, possibleCameras[0]);
        return possibleCameras[0];
    }

    // Aucune caméra trouvée
    console.warn("FOV DEBUG: Aucune caméra ou objet caméra trouvé dans le modèle");
    return null;
}

/**
 * Trouve l'animation cible appropriée dans les animations disponibles
 * @param {Array} animations - Tableau d'animations disponibles
 * @returns {THREE.AnimationClip|null} L'animation cible ou null
 */
function findTargetAnimation(animations) {
    if (!animations || animations.length === 0) {
        console.warn("findTargetAnimation: aucune animation disponible");
        return null;
    }

    console.log(`Recherche d'une animation cible parmi ${animations.length} animations`);

    // Noms d'animations à chercher par ordre de priorité
    const targetNames = [
        'Action.008',       // Nom cible principal
        'Camera',           // Noms alternatifs
        'CameraAction',
        'Main',
        'MainAction',
        'Action'
    ];

    // Chercher par nom exact d'abord
    for (const name of targetNames) {
        const exactMatch = animations.find(anim => anim.name === name);
        if (exactMatch) {
            console.log(`Animation exacte trouvée: ${name}`);
            return exactMatch;
        }
    }

    // Ensuite par inclusion de nom
    for (const name of targetNames) {
        const partialMatch = animations.find(anim =>
            anim.name.toLowerCase().includes(name.toLowerCase())
        );
        if (partialMatch) {
            console.log(`Animation partielle trouvée: ${partialMatch.name} (contient "${name}")`);
            return partialMatch;
        }
    }

    // Chercher la plus longue animation comme fallback
    let longestAnimation = animations[0];
    for (let i = 1; i < animations.length; i++) {
        if (animations[i].duration > longestAnimation.duration) {
            longestAnimation = animations[i];
        }
    }

    console.log(`Aucune animation nommée spécifiquement trouvée, utilisation de la plus longue: ${longestAnimation.name} (${longestAnimation.duration}s)`);
    return longestAnimation;
}

/**
 * Crée une animation de caméra par défaut si aucun modèle n'est disponible
 * @param {THREE.Camera} camera - La caméra Three.js à animer
 * @returns {Object} Modèle de caméra avec animation par défaut
 */
export function createDefaultCameraAnimation(camera) {
    console.log("Création d'une animation de caméra par défaut");

    // Durée et nombre de keyframes
    const duration = 30; // 30 secondes d'animation
    const keyframes = 100; // Nombre de keyframes

    // Paramètres du chemin
    const path = {
        start: new THREE.Vector3(0, 1.6, 0),
        end: new THREE.Vector3(0, 1.6, -150),
        midPoints: [
            { position: new THREE.Vector3(-5, 2, -30), lookAt: new THREE.Vector3(0, 1.5, -35) },
            { position: new THREE.Vector3(5, 2, -60), lookAt: new THREE.Vector3(0, 1.5, -65) },
            { position: new THREE.Vector3(-8, 2, -90), lookAt: new THREE.Vector3(0, 1.5, -95) },
            { position: new THREE.Vector3(8, 2, -120), lookAt: new THREE.Vector3(0, 1.5, -125) }
        ]
    };

    // Créer des times pour l'animation (0 à duration)
    const times = new Float32Array(keyframes);
    for (let i = 0; i < keyframes; i++) {
        times[i] = duration * (i / (keyframes - 1));
    }

    // Calculer les positions et rotations pour chaque keyframe
    const positions = new Float32Array(keyframes * 3);
    const rotations = new Float32Array(keyframes * 3);

    // Caméra temporaire pour les calculs
    const dummyCamera = new THREE.PerspectiveCamera();
    const lookAtVector = new THREE.Vector3();

    for (let i = 0; i < keyframes; i++) {
        const t = i / (keyframes - 1); // 0 à 1

        // Calculer la position interpolée avec mouvement sinusoïdal
        let x = Math.sin(t * Math.PI * 2) * 5;
        let y = 1.6 + Math.sin(t * Math.PI) * 0.4;
        let z = path.start.z + (path.end.z - path.start.z) * t;

        // Appliquer des variations basées sur les points intermédiaires
        path.midPoints.forEach((point, idx) => {
            const influence = Math.max(0, 1 - Math.abs(
                (t - (idx + 1) / (path.midPoints.length + 1)) *
                (path.midPoints.length + 1) * 2
            ));
            x += (point.position.x - x) * influence * 0.5;
            y += (point.position.y - y) * influence * 0.5;
        });

        // Stocker la position
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Calculer la rotation (regarder vers l'avant avec des variations)
        let lookAtX = 0;
        let lookAtY = 1.5;
        let lookAtZ = z - 5; // Regarder 5 unités devant

        // Appliquer des variations de lookAt
        path.midPoints.forEach((point, idx) => {
            const influence = Math.max(0, 1 - Math.abs(
                (t - (idx + 1) / (path.midPoints.length + 1)) *
                (path.midPoints.length + 1) * 2
            ));
            lookAtX += (point.lookAt.x - lookAtX) * influence;
            lookAtY += (point.lookAt.y - lookAtY) * influence;
            lookAtZ += (point.lookAt.z - lookAtZ) * influence;
        });

        // Calculer la rotation pour regarder le point cible
        lookAtVector.set(lookAtX, lookAtY, lookAtZ);
        dummyCamera.position.set(x, y, z);
        dummyCamera.lookAt(lookAtVector);

        // Stocker la rotation
        rotations[i * 3] = dummyCamera.rotation.x;
        rotations[i * 3 + 1] = dummyCamera.rotation.y;
        rotations[i * 3 + 2] = dummyCamera.rotation.z;
    }

    // Créer les tracks d'animation
    const posXTrack = new THREE.KeyframeTrack('camera.position[x]', times,
        Array.from(positions).filter((_, i) => i % 3 === 0));
    const posYTrack = new THREE.KeyframeTrack('camera.position[y]', times,
        Array.from(positions).filter((_, i) => i % 3 === 1));
    const posZTrack = new THREE.KeyframeTrack('camera.position[z]', times,
        Array.from(positions).filter((_, i) => i % 3 === 2));

    const rotXTrack = new THREE.KeyframeTrack('camera.rotation[x]', times,
        Array.from(rotations).filter((_, i) => i % 3 === 0));
    const rotYTrack = new THREE.KeyframeTrack('camera.rotation[y]', times,
        Array.from(rotations).filter((_, i) => i % 3 === 1));
    const rotZTrack = new THREE.KeyframeTrack('camera.rotation[z]', times,
        Array.from(rotations).filter((_, i) => i % 3 === 2));

    // Créer le clip d'animation
    const clip = new THREE.AnimationClip('Action.008', duration, [
        posXTrack, posYTrack, posZTrack,
        rotXTrack, rotYTrack, rotZTrack
    ]);

    // Créer un groupe pour contenir la caméra
    const cameraGroup = new THREE.Group();
    cameraGroup.name = "DefaultCamera";

    // Ajouter une copie de la caméra principale
    const cameraClone = new THREE.PerspectiveCamera();
    cameraClone.name = "Camera";
    cameraClone.fov = 24; // Utiliser un FOV recommandé
    cameraClone.near = camera.near;
    cameraClone.far = camera.far;
    cameraClone.aspect = camera.aspect;
    cameraGroup.add(cameraClone);

    console.log("Animation par défaut créée avec succès:", {
        duration,
        keyframes,
        clipName: clip.name
    });

    // Structure similaire à un modèle GLB chargé
    return {
        scene: cameraGroup,
        animations: [clip],
        name: "DefaultCameraModel"
    };
}