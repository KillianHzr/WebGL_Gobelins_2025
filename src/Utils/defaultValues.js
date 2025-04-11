/**
 * Utilitaires pour extraire les valeurs par défaut de guiConfig et les appliquer aux objets
 */
import guiConfig from '../Config/guiConfig';

/**
 * Extrait une valeur par défaut du fichier guiConfig
 * @param {string} path - Chemin vers la propriété, ex: 'objects.cube.position.y'
 * @param {any} fallback - Valeur par défaut si non trouvée
 * @returns {any} - La valeur par défaut ou fallback
 */
export const getDefaultValue = (path, fallback) => {
    try {
        // Diviser le chemin en parties
        const parts = path.split('.');

        // Parcourir l'objet guiConfig
        let value = guiConfig;
        for (let i = 0; i < parts.length; i++) {
            value = value[parts[i]];
            if (value === undefined) return fallback;
        }

        // Si une propriété 'default' existe, utiliser cette valeur
        return value.default !== undefined ? value.default : fallback;
    } catch (error) {
        return fallback;
    }
};

/**
 * Initialise un objet 3D (position, rotation, échelle) avec les valeurs par défaut
 * @param {Object3D} object - Objet Three.js à initialiser
 * @param {string} basePath - Chemin de base dans guiConfig, ex: 'objects.cube'
 */
export const initializeTransform = (object, basePath) => {
    if (!object) return;

    // Position
    const posX = getDefaultValue(`${basePath}.position.x`, 0);
    const posY = getDefaultValue(`${basePath}.position.y`, 0);
    const posZ = getDefaultValue(`${basePath}.position.z`, 0);
    object.position.set(posX, posY, posZ);

    // Rotation
    const rotX = getDefaultValue(`${basePath}.rotation.x`, 0);
    const rotY = getDefaultValue(`${basePath}.rotation.y`, 0);
    const rotZ = getDefaultValue(`${basePath}.rotation.z`, 0);
    object.rotation.set(rotX, rotY, rotZ);

    // Scale
    const scaleX = getDefaultValue(`${basePath}.scale.x`, 1);
    const scaleY = getDefaultValue(`${basePath}.scale.y`, 1);
    const scaleZ = getDefaultValue(`${basePath}.scale.z`, 1);
    object.scale.set(scaleX, scaleY, scaleZ);
};

/**
 * Initialise un matériau avec les valeurs par défaut
 * @param {Material} material - Matériau Three.js à initialiser
 * @param {string} basePath - Chemin de base dans guiConfig, ex: 'objects.cube.material'
 */
export const initializeMaterial = (material, basePath) => {
    if (!material) return;

    // Couleur
    const defaultColor = getDefaultValue(`${basePath}.color`, '#ffffff');
    if (defaultColor) {
        material.color.set(defaultColor.color || defaultColor);
    }

    // Wireframe
    const defaultWireframe = getDefaultValue(`${basePath}.wireframe`, false);
    material.wireframe = defaultWireframe;

    // Propriétés spécifiques pour MeshStandardMaterial
    if (material.type === 'MeshStandardMaterial') {
        const defaultRoughness = getDefaultValue(`${basePath}.roughness`, 0.5);
        const defaultMetalness = getDefaultValue(`${basePath}.metalness`, 0.5);
        material.roughness = defaultRoughness;
        material.metalness = defaultMetalness;
    }
};

/**
 * Initialise une lumière avec les valeurs par défaut
 * @param {Light} light - Lumière Three.js à initialiser
 * @param {string} type - Type de lumière (Ambient, Directional, etc.)
 * @param {number} index - Index de la lumière
 */
export const initializeLight = (light, type, index) => {
    if (!light) return;

    // Vérifier s'il existe des valeurs par défaut pour ce type de lumière
    const defaultPath = `lights.defaults.${type}.${index}`;

    // Intensité
    const defaultIntensity = getDefaultValue(`${defaultPath}.intensity`, 1);
    light.intensity = defaultIntensity;

    // Couleur
    const defaultColor = getDefaultValue(`${defaultPath}.color`, '#ffffff');
    if (defaultColor) {
        light.color.set(defaultColor);
    }

    // Visibilité
    const defaultVisible = getDefaultValue(`${defaultPath}.visible`, true);
    light.visible = defaultVisible;

    // Position (si applicable)
    if (light.position && type !== 'Ambient' && type !== 'Hemisphere') {
        const defaultPosX = getDefaultValue(`${defaultPath}.position.x`, light.position.x);
        const defaultPosY = getDefaultValue(`${defaultPath}.position.y`, light.position.y);
        const defaultPosZ = getDefaultValue(`${defaultPath}.position.z`, light.position.z);
        light.position.set(defaultPosX, defaultPosY, defaultPosZ);
    }

    // Propriétés spécifiques par type de lumière
    if (light.type.includes('DirectionalLight') || light.type.includes('SpotLight')) {
        const defaultCastShadow = getDefaultValue(`${defaultPath}.castShadow`, false);
        light.castShadow = defaultCastShadow;
    }

    if (light.type.includes('SpotLight')) {
        const defaultAngle = getDefaultValue(`${defaultPath}.angle`, light.angle);
        const defaultPenumbra = getDefaultValue(`${defaultPath}.penumbra`, light.penumbra);
        const defaultDecay = getDefaultValue(`${defaultPath}.decay`, light.decay);

        light.angle = defaultAngle;
        light.penumbra = defaultPenumbra;
        light.decay = defaultDecay;
    }

    if (light.type.includes('PointLight')) {
        const defaultDecay = getDefaultValue(`${defaultPath}.decay`, light.decay);
        const defaultDistance = getDefaultValue(`${defaultPath}.distance`, light.distance);

        light.decay = defaultDecay;
        light.distance = defaultDistance;
    }
};