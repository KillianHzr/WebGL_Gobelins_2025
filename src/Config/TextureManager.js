import {DoubleSide, RepeatWrapping, TextureLoader} from "three";
import {LinearEncoding, sRGBEncoding} from "@react-three/drei/helpers/deprecated.js";

class TextureManager {
    constructor() {
        // Textures disponibles avec leurs informations
        this.textures = {};

        // Initialisation des catégories de modèles et leurs textures
        this.initializeTextures();

        // Garde en mémoire les textures déjà chargées
        this.loadedTextures = {};
    }

    // Initialisation des textures basée sur la structure de fichiers
    initializeTextures() {
        // Arbres
        this.addTextureMapping('TreeNaked', 'forest/tree');
        this.addTextureMapping('TrunkLarge', 'forest/tree');
        this.addTextureMapping('TrunkThin', 'forest/tree', 'TrunkThin'); // Correction de la différence de nommage
        this.addTextureMapping('TreeStump', 'forest/tree');
        this.addTextureMapping('TreeRoots', 'forest/tree');

        // Branches et Buissons
        this.addPlantTexture('BranchTree', 'forest/branch');
        // this.addPlantTexture('BranchTreeLeaf1', 'forest/branch');
        // this.addPlantTexture('BranchTreeLeaf2', 'forest/branch');
        // this.addPlantTexture('BranchTreeLeaf3', 'forest/branch');
        this.addPlantTexture('BranchEucalyptus', 'forest/branch');
        this.addPlantTexture('BranchFig', 'forest/branch');

        // Buissons
        this.addPlantTexture('Bush', 'forest/bush');
        this.addPlantTexture('BushBlueberry', 'forest/bush');
        this.addPlantTexture('BushRaspberry', 'forest/bush');
        this.addPlantTexture('BushStrawberry', 'forest/bush');
        this.addPlantTexture('BushTrunk', 'forest/bush');

        // Plantes
        this.addPlantTexture('PlantPuccinellia', 'forest/plant');
        this.addPlantTexture('PlantIvy', 'forest/plant');
        this.addPlantTexture('PlantReed', 'forest/plant');
        this.addPlantTexture('PlantMiscanthus', 'forest/plant');
        this.addPlantTexture('PlantClematis', 'forest/plant');

        // Fleurs
        this.addPlantTexture('FlowerBell', 'forest/flower');
        this.addPlantTexture('FlowerClover', 'forest/flower');
        this.addPlantTexture('FlowerChicory', 'forest/flower');

        // Champignons
        this.addPlantTexture('MushroomSolo', 'forest/mushroom');
        this.addPlantTexture('MushroomDuo', 'forest/mushroom');

        // Rochers
        this.addTextureMapping('BigRock', 'rock');

        // Sol
        this.addTextureMapping('ForestRoad', 'floor');
        this.addTextureMapping('ForestGrass', 'floor');

        // Éléments primaires
        this.addTextureMapping('DirectionPanel', 'primary');
        this.addPlantTexture('LeafErable', 'primary');
        this.addPlantTexture('LeafOak', 'primary');
        this.addPlantTexture('AnimalPaws', 'primary');
        // this.addPlantTexture('MudPuddle', 'primary/AnimalPaws');
    }

    // Ajouter automatiquement les mappings de textures pour un modèle avec PBR complet
    addTextureMapping(modelId, folder, filePrefix = null) {
        // Si aucun préfixe spécifié, utiliser le modelId
        const prefix = filePrefix || modelId;

        this.textures[modelId] = {
            baseColor: `/textures/${folder}/${prefix}_BaseColor.png`,
            normal: `/textures/${folder}/${prefix}_Normal.png`,
            normalOpenGL: `/textures/${folder}/${prefix}_NormalOpenGL.png`, // Optionnel
            roughness: `/textures/${folder}/${prefix}_Roughness.png`,
            metalness: `/textures/${folder}/${prefix}_Metallic.png`,
            height: `/textures/${folder}/${prefix}_Height.png`
        };

        // Ajouter la texture alpha si disponible (pour les plantes, etc.)
        if (this.isAlphaTextureAvailable(folder, prefix)) {
            this.textures[modelId].alpha = `/textures/${folder}/${prefix}_Alpha.png`;
        }

        // Ajouter la texture opacity si disponible (pour les herbes, etc.)
        if (this.isOpacityTextureAvailable(folder, prefix)) {
            this.textures[modelId].opacity = `/textures/${folder}/${prefix}_Opacity.png`;
        }
    }

    // Ajouter des textures pour les plantes (généralement BaseColor + Alpha)
    addPlantTexture(modelId, folder) {
        this.textures[modelId] = {
            baseColor: `/textures/${folder}/${modelId}_BaseColor.png`
        };

        // Ajouter la texture alpha si disponible
        if (this.isAlphaTextureAvailable(folder, modelId)) {
            this.textures[modelId].alpha = `/textures/${folder}/${modelId}_Alpha.png`;
        }
    }

    // Vérification anticipée de la disponibilité d'une texture alpha
    isAlphaTextureAvailable(folder, prefix) {
        // Vérification basée sur les données disponibles dans la liste des fichiers
        // Nous supposons que si une texture est présente dans les dossiers, elle est disponible
        // Cette méthode pourrait être améliorée avec une vérification de fichier réelle

        const plantFolders = ['forest/bush', 'forest/branch', 'forest/plant',
            'forest/flower', 'forest/mushroom', 'primary'];

        // La plupart des plantes ont des textures alpha
        return plantFolders.some(f => folder.includes(f));
    }

    // Vérification anticipée de la disponibilité d'une texture d'opacité
    isOpacityTextureAvailable(folder, prefix) {
        // Basée sur les fichiers observés
        return folder === 'floor' && (prefix === 'ForestGrass' || prefix === 'ForestRoad');
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
            case 'normalOpenGL':
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
            case 'opacity':
                // Pour les cartes alpha/opacité
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
            aoIntensity: 0.5,     // Intensité AO par défaut
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

        // Carte normale (préférer NormalOpenGL si disponible pour Three.js)
        if (textures.normalOpenGL) {
            material.normalMap = textures.normalOpenGL;
            this.configureTexture(material.normalMap, 'normalOpenGL');
        } else if (textures.normal) {
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

        // Carte d'occlusion ambiante (AO ou Height si AO non disponible)
        if (textures.ao) {
            material.aoMap = textures.ao;
            this.configureTexture(material.aoMap, 'ao');
            material.aoMapIntensity = config.aoIntensity;
        } else if (textures.height && !config.useDisplacement) {
            // Utiliser height comme AO si pas de déplacement
            material.aoMap = textures.height;
            this.configureTexture(material.aoMap, 'height');
            material.aoMapIntensity = config.aoIntensity * 0.5; // Intensité réduite pour height
        }

        // Gestion de la height map comme displacement si explicitement demandé
        if (textures.height && config.useDisplacement) {
            material.displacementMap = textures.height;
            this.configureTexture(material.displacementMap, 'height');
            material.displacementScale = config.displacementScale;
        }

        // Carte de transparence (Alpha ou Opacity)
        if (textures.alpha) {
            material.alphaMap = textures.alpha;
            this.configureTexture(material.alphaMap, 'alpha');
            material.transparent = true;
            material.alphaTest = 0.5; // Seuil alpha pour éviter les artefacts
        } else if (textures.opacity) {
            material.alphaMap = textures.opacity;
            this.configureTexture(material.alphaMap, 'opacity');
            material.transparent = true;
            material.alphaTest = 0.5;
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

        // Essayer de trouver des textures basées sur le nom du modèle si non définies
        if (!this.hasTextures(modelId)) {
            // Tenter d'extraire l'ID de base du modèle (sans préfixes/suffixes)
            const baseModelId = this.extractBaseModelId(modelId);

            // Si un ID de base est trouvé et qu'il a des textures, utiliser celles-ci
            if (baseModelId && baseModelId !== modelId && this.hasTextures(baseModelId)) {
                console.log(`Utilisation des textures de ${baseModelId} pour ${modelId}`);
                modelId = baseModelId;
            } else {
                console.warn(`Aucune texture trouvée pour le modèle ${modelId} ou un modèle similaire`);
                return;
            }
        }

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
                    if ((material.aoMap || material.lightMap) &&
                        node.geometry &&
                        !node.geometry.attributes.uv2 &&
                        node.geometry.attributes.uv) {
                        node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
                    }
                });
            }
        });

        console.log(`Textures appliquées au modèle ${modelId}:`,
            Object.keys(textures).join(', '));
    }

    // Extraire l'ID de base d'un modèle pour trouver des textures alternatives
    extractBaseModelId(modelId) {
        // Liste des préfixes et suffixes courants dans le projet
        const prefixes = ['Obstacle', 'Interactive'];
        const suffixes = ['Interactive', 'Instance'];

        let baseId = modelId;

        // Supprimer les préfixes communs
        for (const prefix of prefixes) {
            if (baseId.startsWith(prefix)) {
                baseId = baseId.substring(prefix.length);
            } else if (baseId.includes(prefix)) {
                // Gérer les préfixes en milieu de nom (comme "ObstacleTree")
                const regex = new RegExp(`${prefix}(\\w+)`, 'i');
                const match = baseId.match(regex);
                if (match && match[1]) {
                    baseId = match[1];
                }
            }
        }

        // Supprimer les suffixes communs
        for (const suffix of suffixes) {
            if (baseId.endsWith(suffix)) {
                baseId = baseId.substring(0, baseId.length - suffix.length);
            }
        }

        // Mappings spécifiques pour certains modèles
        const specialMappings = {
            'ObstacleTree': 'TrunkLarge',
            'Obstacle2Tree': 'TrunkThin',
            'MultipleLeaf': 'LeafErable'
        };

        if (specialMappings[modelId]) {
            return specialMappings[modelId];
        }

        // Si le résultat est différent de l'original et existe dans notre gestionnaire de textures
        if (baseId !== modelId && this.hasTextures(baseId)) {
            return baseId;
        }

        return null;
    }

    // Trouver l'ID de modèle à partir du chemin du fichier de modèle
    getModelIdFromPath(modelPath) {
        // Extraire le nom du fichier sans extension
        const filename = modelPath.split('/').pop().split('.')[0];

        // Vérifier si ce modèle a des textures directes
        if (this.hasTextures(filename)) {
            return filename;
        }

        // Sinon, essayer de trouver un ID de base
        const baseId = this.extractBaseModelId(filename);
        if (baseId) {
            return baseId;
        }

        return null;
    }
}

// Export d'une instance singleton
export const textureManager = new TextureManager();
export default textureManager;