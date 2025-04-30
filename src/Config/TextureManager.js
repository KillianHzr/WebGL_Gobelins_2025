import {DoubleSide, RepeatWrapping, TextureLoader, MeshStandardMaterial} from "three";
import {LinearEncoding, sRGBEncoding} from "@react-three/drei/helpers/deprecated.js";

/**
 * TextureManager - Version corrigée qui résout le problème des chemins de texture vs textures chargées
 *
 * Correction principale: Différencier clairement les chemins de textures des objets de textures chargés
 */
class TextureManager {
    constructor() {
        // Structure des chemins de textures disponibles
        this.texturePaths = {};

        // Initialisation des catégories et textures
        this.initializeTextures();

        // Cache global des textures chargées
        this.loadedTextures = {};

        // Pool de matériaux pour la réutilisation
        this.materialPool = {};
    }

    // Initialisation des textures basée sur la structure de fichiers
    initializeTextures() {
        // Arbres
        this.addTextureMapping('TreeNaked', 'forest/tree');
        this.addTextureMapping('TrunkLarge', 'forest/tree');
        this.addTextureMapping('TrunkThin', 'forest/tree', 'TrunkThin');
        this.addTextureMapping('TreeStump', 'forest/tree');
        this.addTextureMapping('TreeRoots', 'forest/tree');

        // Branches et Buissons
        this.addPlantTexture('BranchTree', 'forest/branch');
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
        this.addTextureMapping('RockWater', 'rock');

        // Sol
        this.addTextureMapping('Ground', 'ground', 'ForestGrass');
    }

    // Ajouter automatiquement les mappings de textures pour un modèle avec PBR complet
    addTextureMapping(modelId, folder, filePrefix = null) {
        // Si aucun préfixe spécifié, utiliser le modelId
        const prefix = filePrefix || modelId;

        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${prefix}_BaseColor.png`,
            normal: `/textures/${folder}/${prefix}_Normal.png`,
            normalOpenGL: `/textures/${folder}/${prefix}_NormalOpenGL.png`,
            roughness: `/textures/${folder}/${prefix}_Roughness.png`,
            metalness: `/textures/${folder}/${prefix}_Metallic.png`,
            height: `/textures/${folder}/${prefix}_Height.png`
        };

        // Ajouter la texture alpha si disponible (pour les plantes, etc.)
        if (this.isAlphaTextureAvailable(folder, prefix)) {
            this.texturePaths[modelId].alpha = `/textures/${folder}/${prefix}_Alpha.png`;
        }

        // Ajouter la texture opacity si disponible (pour les herbes, etc.)
        if (this.isOpacityTextureAvailable(folder, prefix)) {
            this.texturePaths[modelId].opacity = `/textures/${folder}/${prefix}_Opacity.png`;
        }
    }

    // Ajouter des textures pour les plantes (généralement BaseColor + Alpha)
    addPlantTexture(modelId, folder) {
        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${modelId}_BaseColor.png`,
        };

        // Ajouter la texture alpha si disponible
        if (this.isAlphaTextureAvailable(folder, modelId)) {
            this.texturePaths[modelId].alpha = `/textures/${folder}/${modelId}_Alpha.png`;
        }
    }

    // Vérification anticipée de la disponibilité d'une texture alpha
    isAlphaTextureAvailable(folder, prefix) {
        const plantFolders = ['forest/bush', 'forest/branch', 'forest/plant',
            'forest/flower', 'forest/mushroom', 'primary'];

        // La plupart des plantes ont des textures alpha
        return plantFolders.some(f => folder.includes(f));
    }

    // Vérification anticipée de la disponibilité d'une texture d'opacité
    isOpacityTextureAvailable(folder, prefix) {
        return folder === 'ground' && (prefix === 'ForestGrass' || prefix === 'ForestRoad');
    }

    // Obtenir tous les chemins de textures pour un modèle spécifique
    getTexturePathsForModel(modelId) {
        return this.texturePaths[modelId] || null;
    }

    // Vérifier si un modèle a des textures associées
    hasTextures(modelId) {
        return !!this.texturePaths[modelId];
    }

    // Ajouter un nouveau chemin de texture pour un modèle
    addTextureForModel(modelId, textureType, texturePath) {
        if (!this.texturePaths[modelId]) {
            this.texturePaths[modelId] = {};
        }

        this.texturePaths[modelId][textureType] = texturePath;
        return this;
    }

    /**
     * Précharger une texture et la mettre en cache global
     * CORRECTION: Vérifier que texturePath est bien une chaîne et non un objet de texture
     */
    async preloadTexture(texturePath) {
        // Vérification de type pour éviter les erreurs
        if (typeof texturePath !== 'string') {
            console.error('preloadTexture: le chemin doit être une chaîne, reçu', typeof texturePath);
            return null;
        }

        // Si la texture est déjà chargée, retourner depuis le cache
        if (this.loadedTextures[texturePath]) {
            return this.loadedTextures[texturePath];
        }

        return new Promise((resolve, reject) => {
            try {
                const textureLoader = new TextureLoader();
                textureLoader.load(
                    texturePath,
                    (texture) => {
                        // Configuration standard pour les textures
                        texture.encoding = sRGBEncoding;
                        texture.wrapS = RepeatWrapping;
                        texture.wrapT = RepeatWrapping;

                        texture.flipY = false;

                        // Stocker dans le cache global
                        this.loadedTextures[texturePath] = texture;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.error(`Erreur lors du chargement de la texture ${texturePath}:`, error);
                        reject(error);
                    }
                );
            } catch (error) {
                console.error(`Exception lors du chargement de la texture ${texturePath}:`, error);
                reject(error);
            }
        });
    }

    // Précharger toutes les textures pour un modèle
    async preloadTexturesForModel(modelId) {
        const texturePaths = this.getTexturePathsForModel(modelId);
        if (!texturePaths) return null;

        const loadedTextures = {};
        const promises = [];

        // Parcourir tous les chemins de textures du modèle
        for (const [textureType, texturePath] of Object.entries(texturePaths)) {
            // Vérification de sécurité pour texturePath
            if (typeof texturePath === 'string') {
                const promise = this.preloadTexture(texturePath)
                    .then(texture => {
                        if (texture) {
                            loadedTextures[textureType] = texture;
                        }
                    })
                    .catch(error => {
                        console.warn(`Échec du chargement de la texture ${textureType} pour ${modelId}:`, error);
                    });

                promises.push(promise);
            } else {
                console.warn(`Chemin de texture invalide pour ${modelId}.${textureType}:`, texturePath);
            }
        }

        // Attendre que toutes les textures soient chargées
        await Promise.all(promises);
        return loadedTextures;
    }

    // Configurer une texture en fonction de son type
    configureTexture(texture, textureType) {
        // CORRECTION: Vérifier que texture est bien un objet Three.js
        if (!texture || typeof texture !== 'object' || !texture.isTexture) {
            console.warn(`configureTexture: texture invalide pour le type ${textureType}`, texture);
            return;
        }

        // Configuration spécifique selon le type de texture
        switch (textureType) {
            case 'baseColor':
            case 'diffuse':
                texture.encoding = sRGBEncoding;
                break;
            case 'normal':
            case 'normalOpenGL':
            case 'roughness':
            case 'metalness':
            case 'ao':
            case 'height':
            case 'alpha':
            case 'opacity':
                texture.encoding = LinearEncoding;
                break;
        }

        // Configuration commune
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;
    }

    /**
     * Créer ou récupérer un matériau du pool de matériaux
     */
    getMaterial(modelId, options = {}) {
        const key = this._getMaterialKey(modelId, options);

        // Si le matériau existe déjà dans le pool, le retourner
        if (this.materialPool[key]) {
            return this.materialPool[key];
        }

        // Sinon, créer un nouveau matériau
        const material = new MeshStandardMaterial({
            name: `${modelId}_material`,
            side: DoubleSide,
            transparent: true,
            alphaTest: 0.5,
        });

        console.log(`Création d'un nouveau matériau pour ${modelId} avec options:`, options);

        // Précharger et appliquer les textures de manière asynchrone
        this.preloadTexturesForModel(modelId)
            .then(textures => {
                if (textures) {
                    this._applyTexturesToMaterial(material, textures, options);
                    console.log(`Textures appliquées au matériau ${modelId}`);
                }
            })
            .catch(error => {
                console.error(`Erreur lors du chargement des textures pour ${modelId}:`, error);
            });

        // Stocker dans le pool et retourner immédiatement (les textures seront appliquées plus tard)
        this.materialPool[key] = material;
        return material;
    }

    // Générer une clé unique pour le matériau basée sur ses propriétés
    _getMaterialKey(modelId, options) {
        const optionsKey = JSON.stringify(options);
        return `${modelId}_${optionsKey}`;
    }

    // Version privée de applyTexturesToMaterial pour usage interne
    _applyTexturesToMaterial(material, textures, options = {}) {
        if (!material || !textures) return;

        // Configuration par défaut
        const config = {
            aoIntensity: 0.5,
            useDisplacement: false,
            displacementScale: 0.05,
            ...options
        };

        try {
            if (material.color) {
                material.userData.originalDefineColor = material.defines?.USE_COLOR;
                material.defines = material.defines || {};
                material.defines.USE_COLOR = false;
            }
            // Carte de couleur de base (BaseColor/Diffuse)
            if (textures.baseColor) {
                material.map = textures.baseColor;
                this.configureTexture(material.map, 'baseColor');
                // Forcer la couleur à blanc pour ne pas influencer la texture baseColor
                // material.color.set(0xFFFFFF);
            } else if (textures.diffuse) {
                material.map = textures.diffuse;
                this.configureTexture(material.map, 'diffuse');
                // Forcer la couleur à blanc pour ne pas influencer la texture diffuse
                // material.color.set(0xFFFFFF);
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
                material.roughness = 1.0;
            }

            // Carte de métallicité (Metalness)
            if (textures.metalness) {
                material.metalnessMap = textures.metalness;
                this.configureTexture(material.metalnessMap, 'metalness');
                material.metalness = 0.0;
            }

            // Carte d'occlusion ambiante (AO ou Height si AO non disponible)
            if (textures.ao) {
                material.aoMap = textures.ao;
                this.configureTexture(material.aoMap, 'ao');
                material.aoMapIntensity = config.aoIntensity;
            } else if (textures.height && !config.useDisplacement) {
                material.aoMap = textures.height;
                this.configureTexture(material.aoMap, 'height');
                material.aoMapIntensity = config.aoIntensity * 1.5;
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
                material.alphaTest = 0.5;
            } else if (textures.opacity) {
                material.alphaMap = textures.opacity;
                this.configureTexture(material.alphaMap, 'opacity');
                material.transparent = true;
                material.alphaTest = 0.5;
            }

            // Mettre à jour le matériau
            material.needsUpdate = true;
        } catch (error) {
            console.error("Erreur lors de l'application des textures au matériau:", error);
        }
    }

    // Appliquer les textures à un modèle
    async applyTexturesToModel(modelId, modelObject, options = {}) {
        if (!modelObject) return;

        // Essayer de trouver des textures basées sur le nom du modèle si non définies
        if (!this.hasTextures(modelId)) {
            const baseModelId = this.extractBaseModelId(modelId);
            if (baseModelId && baseModelId !== modelId && this.hasTextures(baseModelId)) {
                console.log(`Utilisation des textures de ${baseModelId} pour ${modelId}`);
                modelId = baseModelId;
            } else {
                console.warn(`Aucune texture trouvée pour le modèle ${modelId} ou un modèle similaire`);
                return;
            }
        }

        // Récupérer ou créer un matériau partagé
        const material = this.getMaterial(modelId, options);

        // Parcourir tous les matériaux du modèle
        modelObject.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];

                // Remplacer tous les matériaux par notre matériau partagé
                if (Array.isArray(node.material)) {
                    for (let i = 0; i < node.material.length; i++) {
                        node.material[i] = material;
                    }
                } else {
                    node.material = material;
                }

                // Activer les UV2 pour l'aoMap si nécessaire
                if (node.geometry &&
                    !node.geometry.attributes.uv2 &&
                    node.geometry.attributes.uv) {
                    node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
                }
            }
        });

        console.log(`Matériau appliqué au modèle ${modelId}`);
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

    // Générer la liste des assets textures pour l'AssetManager
    generateTextureAssetList() {
        const assetSet = new Set(); // Pour éviter les doublons
        const assets = [];

        // Parcourir toutes les textures de tous les modèles
        for (const [modelId, modelTextures] of Object.entries(this.texturePaths)) {
            for (const [textureType, texturePath] of Object.entries(modelTextures)) {
                // Éviter les doublons en vérifiant si le chemin est déjà dans l'ensemble
                if (!assetSet.has(texturePath)) {
                    assetSet.add(texturePath);

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
        }

        return assets;
    }

    // Nettoyer les ressources
    dispose() {
        // Nettoyer toutes les textures chargées
        for (const texturePath in this.loadedTextures) {
            if (this.loadedTextures[texturePath]) {
                this.loadedTextures[texturePath].dispose();
            }
        }
        this.loadedTextures = {};

        // Nettoyer tous les matériaux du pool
        for (const key in this.materialPool) {
            if (this.materialPool[key]) {
                this.materialPool[key].dispose();
            }
        }
        this.materialPool = {};
    }

    // Méthode de diagnostic pour aider au débogage
    logTextureStats() {
        console.log("===== STATISTIQUES TEXTURE MANAGER =====");
        console.log(`Nombre de types d'objets avec textures: ${Object.keys(this.texturePaths).length}`);
        console.log(`Nombre de textures chargées en mémoire: ${Object.keys(this.loadedTextures).length}`);
        console.log(`Nombre de matériaux dans le pool: ${Object.keys(this.materialPool).length}`);

        // Liste des textures les plus utilisées
        const textureUsage = {};
        for (const material of Object.values(this.materialPool)) {
            if (material.map) {
                const path = material.map.source?.data?.src;
                if (path) {
                    textureUsage[path] = (textureUsage[path] || 0) + 1;
                }
            }
        }

        console.log("Top 5 des textures les plus utilisées:");
        Object.entries(textureUsage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([path, count]) => {
                console.log(`- ${path}: ${count} utilisations`);
            });

        console.log("======================================");
    }
}

// Export d'une instance singleton
export const textureManager = new TextureManager();
export default textureManager;