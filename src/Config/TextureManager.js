import {DoubleSide, RepeatWrapping, TextureLoader} from "three";
import {LinearEncoding, sRGBEncoding} from "@react-three/drei/helpers/deprecated.js";

class TextureManager {
    constructor() {
        // Textures disponibles avec leurs informations
        this.textures = {
            // 'TreeNaked': {
            //     baseColor: '/textures/forest/tree/TreeNaked_BaseColor.png',
            //     normal: '/textures/forest/tree/TreeNaked_Normal.png',
            //     roughness: '/textures/forest/tree/TreeNaked_Roughness.png',
            //     metalness: '/textures/forest/tree/TreeNaked_Metallic.png',
            //     ao: '/textures/forest/tree/TreeNaked_Height.png', // Utiliser height comme AO
            // },
            'TrunkLarge': {
                baseColor: '/textures/forest/tree/TrunkLarge_BaseColor.png',
                ao: '/textures/forest/tree/TrunkLarge_Height.png', // Utiliser height comme AO
                normal: '/textures/forest/tree/TrunkLarge_Normal.png',
                roughness: '/textures/forest/tree/TrunkLarge_Roughness.png',
                metalness: '/textures/forest/tree/TrunkLarge_Metallic.png',
            },
            // 'ThinTrunk': {
            //     baseColor: '/textures/forest/tree/ThinTrunk_BaseColor.png',
            //     normal: '/textures/forest/tree/ThinTrunk_Normal.png',
            //     roughness: '/textures/forest/tree/ThinTrunk_Roughness.png',
            //     metalness: '/textures/forest/tree/ThinTrunk_Metallic.png',
            //     ao: '/textures/forest/tree/ThinTrunk_Height.png', // Utiliser height comme AO
            // },
            // 'TreeStump': {
            //     baseColor: '/textures/forest/tree/TreeStump_BaseColor.png',
            //     normal: '/textures/forest/tree/TreeStump_Normal.png',
            //     roughness: '/textures/forest/tree/TreeStump_Roughness.png',
            //     metalness: '/textures/forest/tree/TreeStump_Metallic.png',
            //     ao: '/textures/forest/tree/TreeStump_Height.png', // Utiliser height comme AO
            // },
            'Bush': {
                baseColor: '/textures/forest/bush/Bush_BaseColor.png',
                // normal: '/textures/forest/bush/Bush_Normal.png',
                // roughness: '/textures/forest/bush/Bush_Roughness.png',
                // metalness: '/textures/forest/bush/Bush_Metallic.png',
                // ao: '/textures/forest/bush/Bush_Height.png', // Utiliser height comme AO
                alpha: '/textures/forest/bush/Bush_Alpha.png', // Conservation de l'alpha pour le Bush
            },
            'BranchEucalyptus': {
                baseColor: '/textures/forest/plant/BranchEucalyptus_BaseColor.png',
                // normal: '/textures/forest/bush/Bush_Normal.png',
                // roughness: '/textures/forest/bush/Bush_Roughness.png',
                // metalness: '/textures/forest/bush/Bush_Metallic.png',
                // ao: '/textures/forest/bush/Bush_Height.png', // Utiliser height comme AO
                // alpha: '/textures/forest/bush/Bush_Alpha.png', // Conservation de l'alpha pour le Bush
            },
            // Ajoutez d'autres textures au besoin
        };

        // Garde en mémoire les textures déjà chargées
        this.loadedTextures = {};
    }

    // Obtenir toutes les textures pour un modèle spécifique
    getTexturesForModel(modelId) {
        return this.textures[modelId] || null;
    }

    // Vérifier si un modèle a des textures associées
    hasTextures(modelId) {
        return !!this.textures[modelId];
    }

    // Ajouter une nouvelle texture pour un modèle
    addTextureForModel(modelId, textureType, texturePath) {
        if (!this.textures[modelId]) {
            this.textures[modelId] = {};
        }

        this.textures[modelId][textureType] = texturePath;
        return this;
    }

    // Précharger une texture et la mettre en cache
    async preloadTexture(texturePath) {
        if (this.loadedTextures[texturePath]) {
            return this.loadedTextures[texturePath];
        }

        return new Promise((resolve, reject) => {
            const textureLoader = new TextureLoader();
            textureLoader.load(
                texturePath,
                (texture) => {
                    // Configuration standard pour les textures
                    texture.encoding = sRGBEncoding; // Pour les textures de couleur (baseColor, diffuse)
                    texture.wrapS = RepeatWrapping;
                    texture.wrapT = RepeatWrapping;

                    this.loadedTextures[texturePath] = texture;
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error(`Erreur lors du chargement de la texture ${texturePath}:`, error);
                    reject(error);
                }
            );
        });
    }

    // Précharger toutes les textures pour un modèle
    async preloadTexturesForModel(modelId) {
        const modelTextures = this.getTexturesForModel(modelId);
        if (!modelTextures) return null;

        const loadedTextures = {};
        const promises = [];

        // Parcourir toutes les textures du modèle
        for (const [textureType, texturePath] of Object.entries(modelTextures)) {
            const promise = this.preloadTexture(texturePath)
                .then(texture => {
                    loadedTextures[textureType] = texture;
                })
                .catch(error => {
                    console.warn(`Échec du chargement de la texture ${textureType} pour ${modelId}:`, error);
                });

            promises.push(promise);
        }

        // Attendre que toutes les textures soient chargées
        await Promise.all(promises);
        return loadedTextures;
    }

    // Configurer une texture en fonction de son type
    configureTexture(texture, textureType) {
        if (!texture) return;

        // Configuration spécifique selon le type de texture
        switch (textureType) {
            case 'baseColor':
            case 'diffuse':
                // Pour les cartes de couleur
                texture.encoding = sRGBEncoding;
                break;
            case 'normal':
                // Pour les cartes normales
                texture.encoding = LinearEncoding;
                break;
            case 'roughness':
            case 'metalness':
            case 'ao':
            case 'height':
                // Pour les cartes de données (non-couleur)
                texture.encoding = LinearEncoding;
                break;
            case 'alpha':
                // Pour les cartes alpha
                texture.encoding = LinearEncoding;
                break;
        }

        // Configuration commune
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;
    }

    // Appliquer les textures préchargées à un matériau
    applyTexturesToMaterial(material, textures, options = {}) {
        if (!material || !textures) return;

        // Configuration par défaut
        const config = {
            aoIntensity: 0.7,     // Intensité AO par défaut
            useDisplacement: false, // Désactiver le displacement par défaut
            displacementScale: 0.05,
            ...options
        };

        // Carte de couleur de base (BaseColor/Diffuse)
        if (textures.baseColor) {
            material.map = textures.baseColor;
            this.configureTexture(material.map, 'baseColor');
        } else if (textures.diffuse) {
            material.map = textures.diffuse;
            this.configureTexture(material.map, 'diffuse');
        }

        // Carte normale
        if (textures.normal) {
            material.normalMap = textures.normal;
            this.configureTexture(material.normalMap, 'normal');
        }

        // Carte de rugosité (Roughness)
        if (textures.roughness) {
            material.roughnessMap = textures.roughness;
            this.configureTexture(material.roughnessMap, 'roughness');
            // Valeur de base pour la rugosité
            if (material.roughness === undefined) material.roughness = 0.5;
        }

        // Carte de métallicité (Metalness)
        if (textures.metalness) {
            material.metalnessMap = textures.metalness;
            this.configureTexture(material.metalnessMap, 'metalness');
            // Valeur de base pour la métallicité
            if (material.metalness === undefined) material.metalness = 0.0;
        }

        // Carte d'occlusion ambiante (AO)
        if (textures.ao) {
            material.aoMap = textures.ao;
            this.configureTexture(material.aoMap, 'ao');
            material.aoMapIntensity = config.aoIntensity;
        }

        // Gestion de la height map - uniquement comme displacement si explicitement demandé
        if (textures.height && config.useDisplacement) {
            material.displacementMap = textures.height;
            this.configureTexture(material.displacementMap, 'height');
            material.displacementScale = config.displacementScale;
        }

        // Carte de transparence (Alpha)
        if (textures.alpha) {
            material.alphaMap = textures.alpha;
            this.configureTexture(material.alphaMap, 'alpha');
            material.transparent = true;
            material.alphaTest = 0.5; // Seuil alpha pour éviter les artefacts
        }

        // Mettre à jour le matériau
        material.needsUpdate = true;
    }

    // Générer la liste des assets textures pour l'AssetManager
    generateTextureAssetList() {
        const assets = [];

        // Parcourir toutes les textures de tous les modèles
        for (const [modelId, modelTextures] of Object.entries(this.textures)) {
            for (const [textureType, texturePath] of Object.entries(modelTextures)) {
                assets.push({
                    name: `${modelId}_${textureType}`,
                    type: 'texture',
                    path: texturePath,
                    license: 'CC-BY',
                    author: 'Author',
                    url: ''
                });
            }
        }

        return assets;
    }

    // Appliquer automatiquement les textures à un modèle chargé
    async applyTexturesToModel(modelId, modelObject, options = {}) {
        if (!modelObject) return;

        // Précharger les textures pour ce modèle
        const textures = await this.preloadTexturesForModel(modelId);
        if (!textures) return;

        // Parcourir tous les matériaux du modèle
        modelObject.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];

                materials.forEach(material => {
                    // Appliquer les textures au matériau avec les options fournies
                    material.side = DoubleSide;
                    this.applyTexturesToMaterial(material, textures, options);

                    // Activer les UV2 pour l'aoMap si nécessaire
                    if (material.aoMap && node.geometry && !node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                        node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
                    }
                });
            }
        });

        console.log(`Textures appliquées au modèle ${modelId}:`,
            Object.keys(textures).join(', '));
    }
}

// Export d'une instance singleton
export const textureManager = new TextureManager();
export default textureManager;