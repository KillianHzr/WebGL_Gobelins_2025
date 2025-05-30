import {
    BackSide,
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    FrontSide,
    Group,
    LinearFilter,
    LinearSRGBColorSpace,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    RepeatWrapping,
    SRGBColorSpace,
    StaticDrawUsage,
    TextureLoader,
    Vector2,
    Vector3
} from "three";

/**
 * TextureManager - Version optimisée avec support complet des propriétés de matériaux
 *
 * Nouvelles fonctionnalités:
 * - Support complet des propriétés Basic et PBR
 * - Configuration directe dans addTextureMapping
 * - Respect des valeurs jusqu'au rendu final
 * - Gestion des couleurs et vecteurs
 */
class TextureManager {
    constructor() {
        // Structure des chemins de textures disponibles
        this.texturePaths = {};

        // Propriétés personnalisées pour chaque modèle
        this.materialProperties = {};

        // Cache global des textures chargées
        this.loadedTextures = {};

        // Pool de matériaux pour la réutilisation
        this.materialPool = {};

        // Liste des noms d'objets qui recevront une texture d'émission
        this.emissiveObjectNames = ['ScreenEmission', 'ScreenOldEmission'];

        // Configuration par défaut pour les émissions
        this.emissiveConfig = {
            color: 0xffffff, intensity: 2.5, useTexture: false, emissiveMap: null, forceOverride: false
        };

        // Gestion des instances et statistiques
        this.instanceTracker = {};

        // Gestion de LOD pour les textures
        this.textureResolutions = {
            high: 1.0, medium: 0.5, low: 0.25
        };

        // Niveau de LOD par défaut
        this.currentLOD = 'medium';

        // Paramètres d'optimisation
        this.optimizationConfig = {
            mergeThreshold: 1,
            maxTextureSize: 1024,
            distanceThresholds: {
                high: 15, medium: 25, low: Infinity
            },
            instanceMergeDistance: 100,
            autoMergeEnabled: true,
            memoryBudget: 500,
            materialMergeEnabled: true,
            materialSimilarityThreshold: 0.85
        };

        // Statistiques d'utilisation
        this.stats = {
            texturesLoaded: 0,
            materialsCreated: 0,
            materialsMerged: 0,
            instancesMerged: 0,
            memoryUsage: 0,
            lastOptimization: null
        };

        // Valeurs par défaut COMPLÈTES pour les propriétés de matériaux
        // Incluant TOUTES les propriétés Basic et PBR configurables
        this.defaultMaterialProperties = {
            // ===== BASIC PROPERTIES =====
            // Couleur de base
            color: '#ffffff',

            // Rendu
            wireframe: false, transparent: false, opacity: 1.0, side: DoubleSide, flatShading: false,

            // Depth et test
            depthWrite: true, depthTest: true, alphaTest: 0.0,

            // Autres propriétés de base
            vertexColors: false, toneMapped: true, dithering: false, fog: true,

            // ===== PBR PROPERTIES =====
            // Propriétés PBR principales
            roughness: 0.8, metalness: 0.1, envMapIntensity: 0.0,

            // Ambient Occlusion
            aoIntensity: 0.0,

            // Normal mapping
            normalScale: 1.0,

            // Displacement
            displacementScale: 0.0, displacementBias: 0.0,

            // Bump mapping
            bumpScale: 1.0,

            // Emissive
            emissive: '#000000', emissiveIntensity: 1.0,

            // Specular (pour MeshPhongMaterial)
            shininess: 30, specular: '#111111',

            // Clearcoat (MeshPhysicalMaterial)
            clearcoat: 0.0, clearcoatRoughness: 0.0, reflectivity: 0.5,

            // Transmission (pour matériaux transparents)
            transmission: 0.0, ior: 1.5, thickness: 0.0, attenuationColor: '#ffffff', attenuationDistance: 0.0,

            // Sheen (pour matériaux fabric-like)
            sheen: 0.0, sheenColor: '#ffffff', sheenRoughness: 0.0,

            // Anisotropy (pour métaux brossés)
            anisotropy: 0.0, anisotropyRotation: 0.0,

            // Iridescence (pour surfaces comme bulles de savon)
            iridescence: 0.0, iridescenceIOR: 1.3,

            // Propriétés de rendu avancées
            blending: 'NormalBlending',

            // Propriétés de shadow (appliquées aux meshes)
            castShadow: true, receiveShadow: true,

            // ===== TEXTURE ENABLE/DISABLE SETTINGS =====
            // Contrôle individuel de l'activation des textures
            useTextures: {
                baseColor: true,        // Texture de couleur de base
                diffuse: true,          // Texture diffuse (alias pour baseColor)
                normal: true,           // Carte normale
                normalOpenGL: true,     // Carte normale OpenGL
                roughness: true,        // Carte de rugosité
                metalness: true,        // Carte de métallicité
                ao: true,              // Carte d'occlusion ambiante
                height: true,          // Carte de hauteur
                alpha: true,           // Carte alpha
                opacity: true,         // Carte d'opacité
                emissiveMap: true,     // Carte d'émission
                displacementMap: false, // Carte de déplacement
                bumpMap: false,         // Carte de relief
                lightMap: true,        // Carte d'éclairage
                envMap: true,          // Carte d'environnement
                clearcoatMap: true,    // Carte de vernis
                clearcoatNormalMap: true, // Carte normale de vernis
                clearcoatRoughnessMap: true, // Carte de rugosité de vernis
                transmissionMap: true, // Carte de transmission
                thicknessMap: true,    // Carte d'épaisseur
                sheenColorMap: true,   // Carte de couleur de brillance
                sheenRoughnessMap: true, // Carte de rugosité de brillance
                specularMap: true,     // Carte spéculaire
                specularIntensityMap: true, // Carte d'intensité spéculaire
                iridescenceMap: true,  // Carte d'iridescence
                iridescenceThicknessMap: true, // Carte d'épaisseur d'iridescence
                anisotropyMap: true,   // Carte d'anisotropie
                matcap: true          // Carte MatCap
            }
        };

        this.initializeTextures();
    }

    /**
     * Force l'émission SEULEMENT sur les objets avec "Emission" dans le nom
     */
    forceEmissiveOnEmissionObjectsOnly(scene) {
        if (!scene) return 0;

        console.log("🔥 Application sélective d'émission sur les objets 'Emission' uniquement...");
        let modifiedCount = 0;

        scene.traverse((node) => {
            // Vérifier si c'est un objet avec "Emission" dans le nom ou l'ID
            const shouldBeEmissive = this._shouldObjectBeEmissive(
                node.userData?.objectId,
                node.name
            );

            if (shouldBeEmissive && node.material) {
                console.log(`📺 Objet émissif trouvé: ${node.name} (ID: ${node.userData?.objectId || 'unknown'})`);

                // Gérer les matériaux multiples
                const materials = Array.isArray(node.material) ? node.material : [node.material];

                materials.forEach((material, index) => {
                    const applied = this._safelySetEmissive(material, {
                        color: this.emissiveConfig.color,
                        intensity: this.emissiveConfig.intensity,
                        useTexture: this.emissiveConfig.useTexture,
                        emissiveMap: this.emissiveConfig.useTexture ? material.map : null
                    });

                    if (applied) {
                        modifiedCount++;
                        console.log(`✅ Émission appliquée à "${node.name}" matériau ${index} (${material.type})`);
                    }
                });

                // Marquer l'objet comme émissif
                node.userData.isEmissive = true;
                node.userData.emissiveApplied = true;
            } else if (node.name && (node.name.includes('Screen') || node.userData?.objectId?.includes('Screen'))) {
                // Log des écrans non émissifs pour debug
                console.log(`📱 Écran normal (non émissif): ${node.name} (ID: ${node.userData?.objectId || 'unknown'})`);
            }
        });

        console.log(`🎯 Total: ${modifiedCount} objets 'Emission' modifiés`);
        return modifiedCount;
    }

    async createEmissiveMaterialForEmissionObjects(baseObjectId) {
        // Vérifier que l'objet doit vraiment être émissif
        if (!this._shouldObjectBeEmissive(baseObjectId)) {
            console.warn(`⚠️ ${baseObjectId} n'est pas marqué comme devant être émissif`);
            return null;
        }

        console.log(`🔧 Création d'un matériau émissif pour ${baseObjectId}...`);

        try {
            // Déterminer l'ID de base pour les textures (sans "Emission")
            let textureBaseId = baseObjectId;
            if (baseObjectId.includes('Emission')) {
                textureBaseId = baseObjectId.replace('Emission', '');
            }

            // Obtenir le matériau de base (peut utiliser les textures de la version non-émissive)
            const baseMaterial = await this.getMaterialAsync(textureBaseId, {
                lod: 'high',
                useCustomProperties: true
            });

            if (!baseMaterial) {
                throw new Error(`Impossible de créer le matériau de base pour ${textureBaseId}`);
            }

            // Cloner le matériau pour éviter les conflits
            const emissiveMaterial = baseMaterial.clone();
            emissiveMaterial.name = `${baseObjectId}_Emissive`;

            // Appliquer les propriétés émissives
            const applied = this._safelySetEmissive(emissiveMaterial, {
                color: this.emissiveConfig.color,
                intensity: this.emissiveConfig.intensity,
                useTexture: this.emissiveConfig.useTexture,
                emissiveMap: this.emissiveConfig.useTexture ? emissiveMaterial.map : null
            });

            if (applied) {
                // Optimisations supplémentaires pour l'émission
                emissiveMaterial.userData.isEmissive = true;
                emissiveMaterial.userData.emissiveConfig = {...this.emissiveConfig};
                emissiveMaterial.userData.baseObjectId = textureBaseId;
                emissiveMaterial.needsUpdate = true;

                console.log(`✅ Matériau émissif créé avec succès pour ${baseObjectId} (base: ${textureBaseId})`);
                return emissiveMaterial;
            } else {
                throw new Error(`Impossible d'appliquer l'émission au matériau ${baseObjectId}`);
            }
        } catch (error) {
            console.error(`❌ Erreur lors de la création du matériau émissif pour ${baseObjectId}:`, error);
            throw error;
        }
    }

    /**
     * Méthode pour définir l'activation/désactivation des textures
     * @param {string} modelId - ID du modèle
     * @param {Object} textureSettings - Objet avec les paramètres de texture
     * @example
     * textureManager.setTextureUsage('PlantMiscanthus', {
     *     baseColor: false,  // Désactiver la texture de couleur de base
     *     normal: true,      // Garder la texture normale
     *     roughness: false   // Désactiver la texture de rugosité
     * });
     */
    setTextureUsage(modelId, textureSettings) {
        if (!modelId || !textureSettings) {
            console.error("setTextureUsage: modelId et textureSettings sont requis");
            return this;
        }

        // S'assurer que les propriétés du matériau existent
        if (!this.materialProperties[modelId]) {
            this.materialProperties[modelId] = {};
        }

        // S'assurer que useTextures existe
        if (!this.materialProperties[modelId].useTextures) {
            this.materialProperties[modelId].useTextures = {
                ...this.defaultMaterialProperties.useTextures
            };
        }

        // Mettre à jour les paramètres de texture
        Object.entries(textureSettings).forEach(([textureType, enabled]) => {
            if (this.materialProperties[modelId].useTextures.hasOwnProperty(textureType)) {
                this.materialProperties[modelId].useTextures[textureType] = enabled;
            } else {
                console.warn(`Type de texture inconnu: ${textureType}`);
            }
        });

        console.log(`Paramètres de texture mis à jour pour ${modelId}:`, textureSettings);

        // Mettre à jour les matériaux existants
        this._updateExistingMaterialsForModel(modelId);

        return this;
    }

    /**
     * Méthode pour obtenir les paramètres de texture d'un modèle
     */
    getTextureUsage(modelId) {
        const materialProps = this.getMaterialProperties(modelId);
        return materialProps.useTextures || this.defaultMaterialProperties.useTextures;
    }

    /**
     * Méthode pour activer/désactiver une texture spécifique
     */
    setTextureEnabled(modelId, textureType, enabled) {
        return this.setTextureUsage(modelId, {[textureType]: enabled});
    }

    /**
     * Méthode pour vérifier si une texture est activée
     */
    isTextureEnabled(modelId, textureType) {
        const textureSettings = this.getTextureUsage(modelId);
        return textureSettings[textureType] !== false;
    }

    /**
     * Méthode privée pour mettre à jour les matériaux existants
     */
    _updateExistingMaterialsForModel(modelId) {
        const materialKeys = Object.keys(this.materialPool).filter(key => key.startsWith(modelId + '_'));

        materialKeys.forEach(key => {
            const material = this.materialPool[key];
            if (material) {
                // Recharger et appliquer les textures avec les nouveaux paramètres
                this.preloadTexturesForModel(modelId)
                    .then(textures => {
                        if (textures) {
                            const materialProps = this.getMaterialProperties(modelId);
                            this._applyTexturesToMaterial(material, textures, {
                                ...materialProps, modelId: modelId, lod: this.currentLOD
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`Erreur lors de la mise à jour des textures pour ${modelId}:`, error);
                    });
            }
        });
    }

    _safelySetEmissive(material, options = {}) {
        if (!material) return false;

        if (material.emissive && typeof material.emissive.set === 'function') {
            if (options.color) {
                material.emissive.set(options.color);
            }

            if (options.intensity !== undefined && material.emissiveIntensity !== undefined) {
                material.emissiveIntensity = options.intensity;
            }

            if (options.emissiveMap && material.emissiveMap !== undefined) {
                material.emissiveMap = options.emissiveMap;
            } else if (options.useTexture && material.map && material.emissiveMap !== undefined) {
                material.emissiveMap = material.map;
            }

            material.needsUpdate = true;
            return true;
        } else if (material.type === 'MeshBasicMaterial') {
            console.log(`Material ${material.name || 'unnamed'} doesn't support emissive. Using color adjustment as fallback.`);

            if (options.color && material.color) {
                const originalColor = material.color.clone();
                const emissiveColor = new Color(options.color);

                if (!material.userData.originalColor) {
                    material.userData.originalColor = originalColor;
                }

                material.color.lerp(emissiveColor, 0.7);
            }

            material.needsUpdate = true;
            return true;
        }

        console.log(`Material type ${material.type} doesn't support emission properties.`);
        return false;
    }

    forceEmissiveOnObjects(scene) {
        if (!scene) return;

        console.log("Application forcée d'émission sur les objets de type écran...");
        let modifiedCount = 0;

        scene.traverse((node) => {
            const shouldBeEmissive = this.emissiveObjectNames.some(name => node.name.includes(name) || (node.parent && node.parent.name.includes(name)));

            if (node.isMesh && shouldBeEmissive && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];

                for (let i = 0; i < materials.length; i++) {
                    const mat = materials[i];
                    const applied = this._safelySetEmissive(mat, {
                        color: this.emissiveConfig.color,
                        intensity: this.emissiveConfig.intensity,
                        useTexture: this.emissiveConfig.useTexture,
                        emissiveMap: this.emissiveConfig.emissiveMap
                    });

                    if (applied) {
                        modifiedCount++;
                        console.log(`Émission appliquée à "${node.name}" (matériau: ${mat.type})`);
                    }
                }
            }
        });

        console.log(`Force émissive: ${modifiedCount} matériaux modifiés`);
        return modifiedCount;
    }

    setEmissiveObjectNames(namesArray) {
        if (!Array.isArray(namesArray)) {
            console.error("setEmissiveObjectNames: l'argument doit être un tableau");
            return this;
        }

        this.emissiveObjectNames = [...namesArray];
        console.log(`TextureManager: ${this.emissiveObjectNames.length} noms d'objets configurés pour émission`);
        return this;
    }

    addEmissiveObjectName(name) {
        if (typeof name !== 'string') {
            console.error("addEmissiveObjectName: l'argument doit être une chaîne");
            return this;
        }

        if (!this.emissiveObjectNames.includes(name)) {
            this.emissiveObjectNames.push(name);
            console.log(`TextureManager: Ajout de "${name}" à la liste des objets émissifs`);
        }
        return this;
    }

    setEmissiveConfig(config = {}) {
        this.emissiveConfig = {
            ...this.emissiveConfig, ...config
        };
        console.log("Configuration d'émission mise à jour:", this.emissiveConfig);
        return this;
    }

    // Initialisation des textures avec propriétés complètes
// Initialisation des textures avec propriétés complètes
    initializeTextures() {
        // Arbres
        this.addTextureMapping('TreeNaked', 'forest/tree', null, {
            roughness: 1.0, metalness: 0.59, envMapIntensity: 0.08, color: '#765419', useTextures: {
                baseColor: false,
            }
        });

        this.addTextureMapping('TrunkLarge', 'forest/tree', null, {
            normalScale: new Vector2(1.0, 1.0),
            roughness: 0.78,
            metalness: 0.71,
            envMapIntensity: 0.08,
            color: '#47370b',
            useTextures: {
                baseColor: false,
            }
        });
        this.addTextureMapping('TrunkLargeInteractive', 'forest/tree', 'TrunkLarge', {
            roughness: 0.78,
            metalness: 0.71,
            envMapIntensity: 0.2,
            color: '#47370b',
            normalScale: new Vector2(1.0, 1.0),
            useTextures: {
                baseColor: false,
            }
        });

        this.addTextureMapping('TrunkThin', 'forest/tree', 'TrunkThin', {
            roughness: 0.81,
            metalness: 0.7,
            envMapIntensity: 0.08,
            color: '#5F4611',
            normalScale: new Vector2(1.0, 1.0),
            useTextures: {
                baseColor: false,
            }
        });

        // ===== TEXTURES POUR LES ÉLÉMENTS "END" =====
        // Troncs et arbres - Groupe END
        this.addTextureMapping('TreeNakedEnd', 'forest/tree', 'TreeNaked', {
            roughness: 1.0, metalness: 0.59, envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkLargeEnd', 'forest/tree', 'TrunkLarge', {
            roughness: 0.78, metalness: 0.71, envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkThinEnd', 'forest/tree', 'TrunkThin', {
            roughness: 0.81, metalness: 0.7, envMapIntensity: 0.08
        });

        // ===== TEXTURES POUR LES ÉLÉMENTS "SCREEN" (DIGITAUX) =====
        // Troncs et arbres - Groupe SCREEN
        this.addTextureMapping('TreeNakedScreen', 'forest/tree', 'TreeNaked', {
            roughness: 1.0, metalness: 0.59, envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkLargeScreen', 'forest/tree', 'TrunkLarge', {
            roughness: 0.78, metalness: 0.71, envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkThinScreen', 'forest/tree', 'TrunkThin', {
            roughness: 0.81, metalness: 0.7, envMapIntensity: 0.08
        });

        // Variantes digitales
        this.addTextureMapping('TrunkLargeDigital', 'forest/tree', 'TrunkLarge', {
            roughness: 0.78, metalness: 0.71, envMapIntensity: 0.08
        });

        this.addTextureMapping('TrunkThinDigital', 'forest/tree', 'TrunkThin', {
            roughness: 0.81, metalness: 0.7, envMapIntensity: 0.08
        });

        this.addTextureMapping('TreeStumpDigital', 'forest/tree', 'TreeNaked', {
            roughness: 0.81, metalness: 0.7, envMapIntensity: 0.08
        });

        this.addTextureMapping('TreeRoots', 'forest/tree', null, {
            roughness: 0.81, metalness: 0.7, // envMapIntensity: 0.08
        });

        this.addPlantTexture('TreeRoof', 'forest/tree', {
            roughness: 1.0, metalness: 0.0, envMapIntensity: 0.4, // castShadow: false,
            color: '#1d6d35', useTextures: {
                // baseColor: false,
            }
        });
        this.addPlantTexture('TrunkThinPlane', 'forest/tree', {
            roughness: 0.81, metalness: 0.7,

        });

        // Branches
        this.addPlantTexture('BranchTree', 'forest/branch', {
            roughness: 0.7,
            metalness: 0.0,
            castShadow: true,
            receivedShadow: true,
            color: '#37c876',
            alphaTest: 0.1,
            transparent: false
        });

        this.addPlantTexture('BranchEucalyptus', 'forest/branch', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            color: '#0cdb14', useTextures: {
                // baseColor: false,
            }, castShadow: true, receivedShadow: true,
        });

        this.addPlantTexture('BranchFig', 'forest/branch', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#65c153', useTextures: {
                // baseColor: false,
            }
        });

        // Branches - Groupe END
        this.addPlantTexture('BranchTreeEnd', 'forest/branch', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'BranchTree');

        this.addPlantTexture('BranchEucalyptusEnd', 'forest/branch', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'BranchEucalyptus');

        this.addPlantTexture('BranchFigEnd', 'forest/branch', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'BranchFig');

        // Branches - Groupe SCREEN
        this.addPlantTexture('BranchEucalyptusScreen', 'forest/branch', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'BranchEucalyptus');

        this.addPlantTexture('BranchFigScreen', 'forest/branch', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'BranchFig');

        // Buissons
        this.addPlantTexture('Bush', 'forest/bush', {
            roughness: 1.0, // metalness: 1.0,
            // envMapIntensity: 0.46
            color: '#366d31', useTextures: {
                // baseColor: false,
            }
        });

        this.addPlantTexture('BushBlueberry', 'forest/bush', {
            roughness: 1.0, // metalness: 1.0,
            // envMapIntensity: 0.46
            color: '#809390',
        });

        this.addPlantTexture('BushRaspberry', 'forest/bush', {
            roughness: 1.0, // metalness: 1.0,
            // envMapIntensity: 0.46
            color: '#808080',
        });

        this.addPlantTexture('BushStrawberry', 'forest/bush', {
            roughness: 1.0, // metalness: 1.0,
            // envMapIntensity: 0.46
            color: '#9baba2',
        });

        this.addPlantTexture('BushTrunk', 'forest/bush', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.10,
            // castShadow: true,
            // receivedShadow: false,
            color: '#7a7a7a',
        });

        // Buissons - Groupe END
        this.addPlantTexture('BushEnd', 'forest/bush', {
            roughness: 1.0,
        }, 'Bush');

        this.addPlantTexture('BushBlueberryEnd', 'forest/bush', {
            roughness: 1.0,
        }, 'BushBlueberry');

        this.addPlantTexture('BushRaspberryEnd', 'forest/bush', {
            roughness: 1.0,
        }, 'BushRaspberry');

        this.addPlantTexture('BushStrawberryEnd', 'forest/bush', {
            roughness: 1.0,
        }, 'BushStrawberry');

        this.addPlantTexture('BushTrunkEnd', 'forest/bush', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.10,
            // castShadow: true,
            // receivedShadow: false,
            color: '#7a7a7a',
        }, 'BushTrunk');

        // Buissons - Groupe SCREEN
        this.addPlantTexture('BushScreen', 'forest/bush', {
            roughness: 1.0,
        }, 'Bush');

        this.addPlantTexture('BushTrunkScreen', 'forest/bush', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.10,
            // castShadow: true,
            // receivedShadow: false,
            color: '#7a7a7a',
        }, 'BushTrunk');

        // Plantes
        this.addPlantTexture('PlantPuccinellia', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#2fc147',
        });

        this.addPlantTexture('PlantReed', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#dfe09f',
        });

        this.addPlantTexture('PlantMiscanthus', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#8b9c92',
        });

        this.addPlantTexture('PlantClematis', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#6edd8a',
        });

        this.addPlantTexture('Grass', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#1f7a53',
        });

        // Plantes - Groupe END
        this.addPlantTexture('PlantPuccinelliaEnd', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'PlantPuccinellia');

        this.addPlantTexture('PlantReedEnd', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'PlantReed');

        this.addPlantTexture('PlantMiscanthusEnd', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'PlantMiscanthus');

        this.addPlantTexture('PlantClematisEnd', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'PlantClematis');

        // Fleurs
        this.addPlantTexture('FlowerBell', 'forest/flower', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#b5a5bb',
        });

        this.addPlantTexture('FlowerClover', 'forest/flower', {
            roughness: 0.8, // metalness: 1.0,
            // envMapIntensity: 0.46
            color: '#ae9ea6',
        });

        this.addPlantTexture('FlowerChicory', 'forest/flower', {
            roughness: 0.75, // metalness: 1.0,
            // envMapIntensity: 0.46
        });

        // Fleurs - Groupe END
        this.addPlantTexture('FlowerBellEnd', 'forest/flower', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'FlowerBell');

        this.addPlantTexture('FlowerCloverEnd', 'forest/flower', {
            roughness: 0.8,
        }, 'FlowerClover');

        this.addPlantTexture('FlowerChicoryEnd', 'forest/flower', {
            roughness: 0.75,
        }, 'FlowerChicory');

        // Champignons
        this.addPlantTexture('MushroomSolo', 'forest/mushroom', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#9c8e70',
        });

        this.addPlantTexture('MushroomDuo', 'forest/mushroom', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#bc9494',
        });

        // Champignons - Groupe END
        this.addPlantTexture('MushroomSoloEnd', 'forest/mushroom', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'MushroomSolo');

        this.addPlantTexture('MushroomDuoEnd', 'forest/mushroom', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'MushroomDuo');

        // Champignons - Groupe SCREEN
        this.addPlantTexture('MushroomSoloScreen', 'forest/mushroom', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'MushroomSolo');

        this.addPlantTexture('MushroomDuoScreen', 'forest/mushroom', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'MushroomDuo');

        // Pine Cones
        this.addPlantTexture('PineCone', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, // envMapIntensity: 0.46,
            castShadow: true, receivedShadow: true, color: '#919191',
        });

        // Pine Cones - Groupe END
        this.addPlantTexture('PineConeEnd', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'PineCone');

        // Pine Cones - Groupe SCREEN
        this.addPlantTexture('PineConeScreen', 'forest/plant', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        }, 'PineCone');

        // Empreintes d'animaux
        this.addPlantTexture('animalPaws', 'primary', {
            roughness: 0.7, metalness: 0.0, castShadow: true, receivedShadow: true,
        });

        this.addPlantTexture('AnimalPaws', 'primary', {
            roughness: 0.96, // metalness: 0.4,
            // envMapIntensity: 0.25
        });

        // Rochers
        this.addTextureMapping('BigRock', 'rock', null, {
            roughness: 1.0, metalness: 0.05, envMapIntensity: 0.3, aoIntensity: 0.7,
            normalScale: new Vector2(1.0, 1.0),
        });

        this.addTextureMapping('RockWater', 'rock', 'BigRock', {
            roughness: 1.0,
            metalness: 0.1,
            envMapIntensity: 0.25,
            normalScale: new Vector2(0.05, 0.05),
            castShadow: true,
            receivedShadow: true,
        });


        this.addTextureMapping('Ground', 'ground', null, {
            // Propriétés PBR optimisées pour un sol
            roughness: 1.0,        // Sol assez rugueux
            metalness: 0.0,        // Sol non métallique
            envMapIntensity: 0.2,  // Léger reflet environnemental

            // Couleur de base légèrement grisée
            color: '#867474',

            // Propriétés d'ombre - le sol reçoit mais ne projette pas
            castShadow: false,
            receiveShadow: true,

            // Scale de la normale pour plus de détails
            normalScale: new Vector2(1.0, 1.0),

            // Intensité de l'occlusion ambiante
            aoIntensity: 0.0,

            // Configuration des textures activées
            useTextures: {
                baseColor: true,        // Texture de couleur de base
                normal: true,           // Carte normale pour les détails
                normalOpenGL: true,     // Alternative normale OpenGL
                roughness: true,        // Carte de rugosité
                metalness: true,        // Carte de métallicité
                ao: true,              // Occlusion ambiante
                height: true,          // Carte de hauteur
                alpha: false,          // Pas d'alpha pour le sol
                opacity: false,        // Pas d'opacité pour le sol
                emissiveMap: false,    // Pas d'émission pour le sol
                displacementMap: false, // Pas de déplacement (peut être coûteux)
                bumpMap: false,        // Utiliser normal au lieu de bump
                lightMap: false,       // Pas de lightmap
                envMap: true,          // Carte d'environnement
                clearcoatMap: false,   // Pas de vernis
                transmissionMap: false, // Pas de transmission
                sheenColorMap: false,  // Pas de brillance
                specularMap: true,     // Carte spéculaire si disponible
                matcap: false          // Pas de MatCap
            }
        });


        this.addTextureMapping('Server', 'digital', null, {
            roughness: 1.0,
            metalness: 1.0,
            envMapIntensity: 0.3,
            color: '#c9c9c9',
            normalScale: new Vector2(1.2, 1.2),
            castShadow: true,
            receivedShadow: true,
        });
        this.addTextureMapping('Screen', 'digital/screen', 'Screen', {
            // roughness: 0.2,
            // metalness: 0.8,
            // envMapIntensity: 0.3,
            color: '#000000',
            // normalScale: new Vector2(1.0, 1.0),
            // castShadow: true,
            // receiveShadow: true,
            useTextures: {
                baseColor: false,
                normal: true,
                roughness: true,
                metalness: true,
                ao: false,             // Pas d'occlusion ambiante
                envMap: false,         // Utiliser la carte d'environnement
                emissiveMap: false,   // Pas d'émission par défaut
                height: false,        // Pas de carte de hauteur
                alpha: false,         // Pas d'alpha
                opacity: false,       // Pas d'opacité
                displacementMap: false,// Pas de déplacement
                bumpMap: false,       // Utiliser normal au lieu de bump
                lightMap: false,      // Pas de lightmap
                clearcoatMap: false,  // Pas de vernis
                transmissionMap: false,// Pas de transmission
                sheenColorMap: false, // Pas de brillance
                specularMap: false,    // Carte spéculaire si disponible
                matcap: false         // Pas de MatCap
            }
        });

        // // Validation et préchargement immédiat des textures Screen
        // this.validateScreenTexturePaths().then(isValid => {
        //     if (isValid) {
        //         console.log("Chemins de texture Screen validés, préchargement...");
        //         return this.preloadTexturesForModel('Screen');
        //     } else {
        //         throw new Error("Chemins de texture Screen invalides");
        //     }
        // }).then(textures => {
        //     if (textures) {
        //         console.log('Textures Screen préchargées avec succès:', Object.keys(textures));
        //
        //         // Vérifier que les textures critiques sont présentes
        //         const criticalTextures = ['baseColor', 'normal', 'normalOpenGL', 'roughness', 'metalness'];
        //         const availableTextures = Object.keys(textures);
        //         const missingTextures = criticalTextures.filter(key => !availableTextures.includes(key));
        //
        //         if (missingTextures.length > 0) {
        //             console.warn('Textures manquantes pour Screen:', missingTextures);
        //         } else {
        //             console.log('✅ Toutes les textures critiques Screen sont disponibles');
        //         }
        //     }
        // }).catch(error => {
        //     console.error('❌ Erreur lors de la validation/préchargement des textures Screen:', error);
        // });

        this.addTextureMapping('ScreenEmission', 'digital/screen', 'Screen', {
            // Propriétés optimisées pour l'émission
            roughness: 0.8,           // Plus rugueux pour réduire les reflets
            metalness: 0.2,           // Moins métallique
            envMapIntensity: 0.0,     // Pas de reflets environnementaux
            color: '#1a1a1a',
            normalScale: new Vector2(1.0, 1.0),
            castShadow: true,
            receiveShadow: true,

            // Optimisations pour l'émission
            emissiveIntensity: 3.0,   // Intensité émissive plus élevée

            useTextures: {
                baseColor: true,
                normal: false,          // Désactiver la normale pour plus d'émission
                roughness: false,       // Utiliser la valeur fixe
                metalness: false,       // Utiliser la valeur fixe
                ao: false,             // Pas d'occlusion ambiante
                envMap: false          // Pas de carte d'environnement
            }
        });

        this.addTextureMapping('ScreenOld', 'digital/screen', null, {
            roughness: 1.0,
            metalness: 1.0,
            envMapIntensity: 0.00,
            color: '#343434',
            normalScale: new Vector2(1.5, 1.5),
            castShadow: true,
            receivedShadow: true,
        });
        this.addTextureMapping('DataCenter', 'digital', null, {
            roughness: 1.0,
            metalness: 1.0,
            envMapIntensity: 0.08,
            normalScale: new Vector2(1.5, 1.5),
            castShadow: true,
            receivedShadow: true,
        });


        this.addTextureMapping('DirectionPanel', 'primary', null, {
            roughness: 0.8,
            metalness: 0.1,
            envMapIntensity: 0.05,
            color: "#898080",
            normalScale: new Vector2(1.0, 1.0),
            castShadow: true,
            receivedShadow: true,
        });
        this.addTextureMapping('DirectionPanelBoard', 'primary', null, {
            roughness: 0.8,
            metalness: 0.1,
            envMapIntensity: 0.00,
            color: "#251201",
            castShadow: true,
            receivedShadow: true,
        });
        this.addTextureMapping('AnimalPaws', 'primary', null, {
            roughness: 0.8,
            metalness: 0.1,
            envMapIntensity: 0.05,
            color: "#e1d0d0",
            castShadow: true,
            receivedShadow: true,
        });
        this.addTextureMapping('MultipleLeaf', 'primary', null, {
            roughness: 0.8,
            metalness: 0.1,
            envMapIntensity: 0.05,
            color: "#cec0c0",
            castShadow: true,
            receivedShadow: true,
        });
        this.addTextureMapping('VisonDead', 'primary', null, {
            roughness: 1.0, metalness: 0.0, envMapIntensity: 0.0, color: "#ababab",
        });
        this.addTextureMapping('Vison', 'primary', null, {
            roughness: 1.0, metalness: 0.0, envMapIntensity: 0.0, color: "#ababab",
        });
        this.addTextureMapping('VisonRun', 'primary', 'Vison', {
            roughness: 1.0, metalness: 0.0, envMapIntensity: 0.0, color: "#ababab",
        });
        // Définition des groupes de matériaux pour la fusion
        this.defineMaterialGroups();
    }


    /**
     * Méthode pour forcer la recréation du matériau Screen
     */
    async forceRecreateScreenMaterial() {
        console.log("Forçage de la recréation du matériau Screen...");

        // Supprimer tous les matériaux Screen du cache
        const keysToDelete = Object.keys(this.materialPool).filter(key => key.includes('Screen'));
        keysToDelete.forEach(key => {
            if (this.materialPool[key] && this.materialPool[key].dispose) {
                this.materialPool[key].dispose();
            }
            delete this.materialPool[key];
        });

        // Supprimer les textures Screen du cache pour forcer le rechargement
        const textureKeysToDelete = Object.keys(this.loadedTextures).filter(key =>
            key.includes('Screen') || key.includes('digital/screen')
        );
        textureKeysToDelete.forEach(key => {
            if (this.loadedTextures[key] && this.loadedTextures[key].dispose) {
                this.loadedTextures[key].dispose();
            }
            delete this.loadedTextures[key];
        });

        // Reconfigurer Screen avec des propriétés optimisées
        this.addTextureMapping('Screen', 'digital/screen', 'Screen', {
            roughness: 0.2,           // Moins rugueux pour un écran
            metalness: 0.8,           // Plus métallique
            envMapIntensity: 0.3,     // Plus de reflet
            color: '#1a1a1a',         // Couleur sombre d'écran
            normalScale: new Vector2(1.0, 1.0), // Normale plus visible
            castShadow: true,
            receiveShadow: true,

            // S'assurer que toutes les textures importantes sont activées
            useTextures: {
                baseColor: true,
                normal: true,
                normalOpenGL: true,
                roughness: true,
                metalness: true,
                ao: true,
                height: true,
                alpha: false,
                opacity: false,
                emissiveMap: false,
                displacementMap: false,
                bumpMap: false,
                lightMap: false,
                envMap: true,
                clearcoatMap: false,
                transmissionMap: false,
                sheenColorMap: false,
                specularMap: true,
                matcap: false
            }
        });

        // Créer un nouveau matériau avec attente des textures
        const newMaterial = await this.getMaterialAsync('Screen', {
            lod: 'high', // Forcer le niveau de détail maximum
            useCustomProperties: true
        });

        console.log("Nouveau matériau Screen créé:", {
            hasBaseTexture: !!newMaterial.map,
            hasNormalMap: !!newMaterial.normalMap,
            hasRoughnessMap: !!newMaterial.roughnessMap,
            hasMetalnessMap: !!newMaterial.metalnessMap,
            roughness: newMaterial.roughness,
            metalness: newMaterial.metalness,
            envMapIntensity: newMaterial.envMapIntensity,
            color: newMaterial.color?.getHexString()
        });

        return newMaterial;
    }

    /**
     * Méthode pour vérifier et corriger les chemins de texture Screen
     */
    async validateScreenTexturePaths() {
        const screenPaths = this.getTexturePathsForModel('Screen');
        if (!screenPaths) {
            console.error("Aucun chemin de texture défini pour Screen");
            return false;
        }

        console.log("Validation des chemins de texture Screen...");

        const validationResults = {};
        const testPromises = [];

        // Tester chaque chemin de texture
        Object.entries(screenPaths).forEach(([type, path]) => {
            const testPromise = fetch(path)
                .then(response => {
                    validationResults[type] = {
                        path: path,
                        exists: response.ok,
                        status: response.status,
                        size: response.headers.get('content-length')
                    };
                })
                .catch(error => {
                    validationResults[type] = {
                        path: path,
                        exists: false,
                        error: error.message
                    };
                });

            testPromises.push(testPromise);
        });

        await Promise.all(testPromises);

        console.log("Résultats de validation des textures Screen:", validationResults);

        // Vérifier si les textures critiques existent
        const criticalTextures = ['baseColor', 'normal', 'normalOpenGL'];
        const missingCritical = criticalTextures.filter(type =>
            validationResults[type] && !validationResults[type].exists
        );

        if (missingCritical.length > 0) {
            console.error("Textures critiques manquantes pour Screen:", missingCritical);
            return false;
        }

        return true;
    }

    // Définir des groupes de matériaux qui peuvent être fusionnés
    defineMaterialGroups() {
        this.materialGroups = {
            'forest': ['TreeNaked', 'TrunkLarge', 'TrunkThin', 'TreeStump', 'TreeRoots'],
            'bushes': ['Bush', 'BushBlueberry', 'BushRaspberry', 'BushStrawberry', 'BushTrunk'],
            'plants': ['PlantPuccinellia', 'PlantReed', 'PlantMiscanthus', 'PlantClematis'],
            'flowers': ['FlowerBell', 'FlowerClover', 'FlowerChicory'],
            'mushrooms': ['MushroomSolo', 'MushroomDuo'],
            'rocks': ['BigRock', 'RockWater'],
            'ground': ['Ground']
        };

        this.modelGroupMap = {};
        Object.entries(this.materialGroups).forEach(([group, models]) => {
            models.forEach(model => {
                this.modelGroupMap[model] = group;
            });
        });
    }
    configureGroundTexture(repeatX = 100, repeatY = 100, options = {}) {
        const groundConfig = {
            // Répétition de texture pour couvrir une grande surface
            textureRepeat: {
                baseColor: [repeatX, repeatY],
                normal: [repeatX, repeatY],
                roughness: [repeatX, repeatY],
                metalness: [repeatX, repeatY],
                ao: [repeatX, repeatY]
            },

            // Filtrage amélioré pour éviter l'aliasing à distance
            textureFilter: 'anisotropic',
            anisotropy: 16,

            // Propriétés spécifiques au sol
            ...options
        };

        // Appliquer la configuration spéciale au sol
        this.setMaterialProperties('Ground', {
            // Améliorer le rendu à distance
            roughness: 1.8,
            metalness: 0.0,
            envMapIntensity: 0.05,

            // Optimisations pour les grandes surfaces
            flatShading: true,  // Ombrage lisse
            side: FrontSide,   // Double face si nécessaire

            // Configuration pour les ombres
            shadowSide: FrontSide,

            // Améliorer la qualité visuelle
            aoIntensity: 0.05,
            normalScale: new Vector2(0.1, 0.1)
        });

        return groundConfig;
    }

    _applyGroundTextureRepeat(material, repeatX = 10, repeatY = 10) {
        if (!material) return;

        // Liste des textures à répéter
        const texturesToRepeat = [
            'map',           // baseColor
            'normalMap',     // normal
            'roughnessMap',  // roughness
            'metalnessMap',  // metalness
            'aoMap',         // ambient occlusion
            'displacementMap' // height/displacement
        ];

        texturesToRepeat.forEach(textureProperty => {
            if (material[textureProperty]) {
                material[textureProperty].wrapS = RepeatWrapping;
                material[textureProperty].wrapT = RepeatWrapping;
                material[textureProperty].repeat.set(repeatX, repeatY);
                material[textureProperty].needsUpdate = true;

                console.log(`Répétition appliquée à ${textureProperty}: ${repeatX}x${repeatY}`);
            }
        });

        // Améliorer le filtrage pour éviter l'aliasing
        texturesToRepeat.forEach(textureProperty => {
            if (material[textureProperty]) {
                material[textureProperty].anisotropy = 16;
                material[textureProperty].minFilter = LinearMipmapLinearFilter;
                material[textureProperty].magFilter = LinearFilter;
            }
        });

        material.needsUpdate = true;
    }

    _applyTexturesToGroundMaterial(material, textures, options = {}) {
        // Appliquer d'abord les textures normalement
        this._applyTexturesToMaterial(material, textures, options);

        // Puis appliquer les optimisations spéfiques au sol
        if (options.modelId === 'Ground') {
            // Répétition de texture (par défaut 10x10)
            const repeatX = options.repeatX || 10;
            const repeatY = options.repeatY || 10;
            this._applyGroundTextureRepeat(material, repeatX, repeatY);

            // Optimisations spéciales pour le sol
            if (material.roughnessMap && material.metalnessMap) {
                // Utiliser des valeurs de base plus basses quand les cartes sont présentes
                material.roughness = 0.5;
                material.metalness = 0.0;
            }

            // Améliorer les ombres reçues
            material.shadowSide = FrontSide;

            console.log(`Sol configuré avec textures détaillées et répétition ${repeatX}x${repeatY}`);
        }
    }

    /**
     * Convertit une valeur de propriété en objet Three.js approprié
     */
    _convertPropertyValue(property, value) {
        if (value === null || value === undefined) {
            return value;
        }

        // Gestion des couleurs (format hex string vers Color)
        if (property === 'color' || property === 'emissive' || property === 'specular' || property === 'sheenColor' || property === 'attenuationColor') {
            if (typeof value === 'string') {
                return new Color(value);
            }
            return value;
        }

        // Gestion des propriétés de side
        if (property === 'side') {
            if (typeof value === 'string') {
                switch (value.toLowerCase()) {
                    case 'front':
                    case 'frontside':
                        return FrontSide;
                    case 'back':
                    case 'backside':
                        return BackSide;
                    case 'double':
                    case 'doubleside':
                        return DoubleSide;
                    default:
                        return DoubleSide;
                }
            }
            return value;
        }

        // Gestion des propriétés de blending
        if (property === 'blending') {
            // Laisser Three.js gérer les constantes de blending
            return value;
        }

        // Gestion des Vector2 (normalScale)
        if (property === 'normalScale') {
            if (typeof value === 'number') {
                return new Vector2(value, value);
            }
            return value;
        }

        return value;
    }

    /**
     * Applique les propriétés configurées au matériau - VERSION COMPLÈTE
     */
    _applyMaterialProperties(material, properties) {
        if (!material || !properties) return;

        try {
            // ===== BASIC PROPERTIES =====

            // Couleur
            if (properties.color !== undefined && material.color) {
                const colorValue = this._convertPropertyValue('color', properties.color);
                if (colorValue instanceof Color) {
                    material.color.copy(colorValue);
                } else if (typeof colorValue === 'string') {
                    material.color.set(colorValue);
                }
            }

            // Propriétés de rendu de base
            if (properties.wireframe !== undefined) material.wireframe = properties.wireframe;
            if (properties.transparent !== undefined) material.transparent = properties.transparent;
            if (properties.opacity !== undefined) material.opacity = properties.opacity;
            if (properties.flatShading !== undefined) material.flatShading = properties.flatShading;

            // Side
            if (properties.side !== undefined) {
                material.side = this._convertPropertyValue('side', properties.side);
            }

            // Depth et test
            if (properties.depthWrite !== undefined) material.depthWrite = properties.depthWrite;
            if (properties.depthTest !== undefined) material.depthTest = properties.depthTest;
            if (properties.alphaTest !== undefined) material.alphaTest = properties.alphaTest;

            // Autres propriétés de base
            if (properties.vertexColors !== undefined) material.vertexColors = properties.vertexColors;
            if (properties.toneMapped !== undefined) material.toneMapped = properties.toneMapped;
            if (properties.dithering !== undefined) material.dithering = properties.dithering;
            if (properties.fog !== undefined) material.fog = properties.fog;

            // ===== PBR PROPERTIES =====

            // Propriétés PBR principales
            if (properties.roughness !== undefined) material.roughness = properties.roughness;
            if (properties.metalness !== undefined) material.metalness = properties.metalness;
            if (properties.envMapIntensity !== undefined && material.envMap) {
                material.envMapIntensity = properties.envMapIntensity;
            }

            // Ambient Occlusion
            if (properties.aoIntensity !== undefined && material.aoMap) {
                material.aoMapIntensity = properties.aoIntensity;
            }

            // Normal mapping
            if (properties.normalScale !== undefined && material.normalMap) {
                const normalScaleValue = this._convertPropertyValue('normalScale', properties.normalScale);
                if (normalScaleValue instanceof Vector2) {
                    if (!material.normalScale) material.normalScale = new Vector2();
                    material.normalScale.copy(normalScaleValue);
                } else if (typeof normalScaleValue === 'number') {
                    if (!material.normalScale) material.normalScale = new Vector2();
                    material.normalScale.x = material.normalScale.y = normalScaleValue;
                }
            }

            // Displacement
            if (properties.displacementScale !== undefined && material.displacementMap) {
                material.displacementScale = properties.displacementScale;
            }
            if (properties.displacementBias !== undefined && material.displacementMap) {
                material.displacementBias = properties.displacementBias;
            }

            // Bump mapping
            if (properties.bumpScale !== undefined && material.bumpMap) {
                material.bumpScale = properties.bumpScale;
            }

            // Emissive
            if (properties.emissive !== undefined && material.emissive) {
                const emissiveValue = this._convertPropertyValue('emissive', properties.emissive);
                if (emissiveValue instanceof Color) {
                    material.emissive.copy(emissiveValue);
                } else if (typeof emissiveValue === 'string') {
                    material.emissive.set(emissiveValue);
                }
            }
            if (properties.emissiveIntensity !== undefined && material.emissiveIntensity !== undefined) {
                material.emissiveIntensity = properties.emissiveIntensity;
            }

            // Specular (MeshPhongMaterial)
            if (properties.shininess !== undefined && material.shininess !== undefined) {
                material.shininess = properties.shininess;
            }
            if (properties.specular !== undefined && material.specular) {
                const specularValue = this._convertPropertyValue('specular', properties.specular);
                if (specularValue instanceof Color) {
                    material.specular.copy(specularValue);
                } else if (typeof specularValue === 'string') {
                    material.specular.set(specularValue);
                }
            }

            // Clearcoat (MeshPhysicalMaterial)
            if (properties.clearcoat !== undefined && material.clearcoat !== undefined) {
                material.clearcoat = properties.clearcoat;
            }
            if (properties.clearcoatRoughness !== undefined && material.clearcoatRoughness !== undefined) {
                material.clearcoatRoughness = properties.clearcoatRoughness;
            }
            if (properties.reflectivity !== undefined && material.reflectivity !== undefined) {
                material.reflectivity = properties.reflectivity;
            }

            // Transmission
            if (properties.transmission !== undefined && material.transmission !== undefined) {
                material.transmission = properties.transmission;
            }
            if (properties.ior !== undefined && material.ior !== undefined) {
                material.ior = properties.ior;
            }
            if (properties.thickness !== undefined && material.thickness !== undefined) {
                material.thickness = properties.thickness;
            }
            if (properties.attenuationColor !== undefined && material.attenuationColor) {
                const attenuationValue = this._convertPropertyValue('attenuationColor', properties.attenuationColor);
                if (attenuationValue instanceof Color) {
                    material.attenuationColor.copy(attenuationValue);
                } else if (typeof attenuationValue === 'string') {
                    material.attenuationColor.set(attenuationValue);
                }
            }
            if (properties.attenuationDistance !== undefined && material.attenuationDistance !== undefined) {
                material.attenuationDistance = properties.attenuationDistance;
            }

            // Sheen
            if (properties.sheen !== undefined && material.sheen !== undefined) {
                material.sheen = properties.sheen;
            }
            if (properties.sheenColor !== undefined && material.sheenColor) {
                const sheenValue = this._convertPropertyValue('sheenColor', properties.sheenColor);
                if (sheenValue instanceof Color) {
                    material.sheenColor.copy(sheenValue);
                } else if (typeof sheenValue === 'string') {
                    material.sheenColor.set(sheenValue);
                }
            }
            if (properties.sheenRoughness !== undefined && material.sheenRoughness !== undefined) {
                material.sheenRoughness = properties.sheenRoughness;
            }

            // Anisotropy
            if (properties.anisotropy !== undefined && material.anisotropy !== undefined) {
                material.anisotropy = properties.anisotropy;
            }
            if (properties.anisotropyRotation !== undefined && material.anisotropyRotation !== undefined) {
                material.anisotropyRotation = properties.anisotropyRotation;
            }

            // Iridescence
            if (properties.iridescence !== undefined && material.iridescence !== undefined) {
                material.iridescence = properties.iridescence;
            }
            if (properties.iridescenceIOR !== undefined && material.iridescenceIOR !== undefined) {
                material.iridescenceIOR = properties.iridescenceIOR;
            }

            // Marquer le matériau pour mise à jour
            material.needsUpdate = true;

        } catch (error) {
            console.error("Erreur lors de l'application des propriétés au matériau:", error);
        }
    }

    /**
     * Applique les propriétés de shadow aux meshes
     */
    _applyShadowProperties(mesh, properties) {
        if (!mesh || !properties) return;

        try {
            if (properties.castShadow !== undefined) {
                mesh.castShadow = properties.castShadow;
            }
            if (properties.receiveShadow !== undefined) {
                mesh.receiveShadow = properties.receiveShadow;
            }
        } catch (error) {
            console.error("Erreur lors de l'application des propriétés d'ombre:", error);
        }
    }

    // Méthodes existantes préservées mais améliorées
    setMaterialProperties(modelId, properties) {
        if (!modelId) {
            console.error("setMaterialProperties: modelId est requis");
            return this;
        }

        if (!this.materialProperties[modelId]) {
            this.materialProperties[modelId] = {};
        }

        // Fusionner les propriétés avec conversion des valeurs
        const convertedProperties = {};
        Object.entries(properties).forEach(([key, value]) => {
            convertedProperties[key] = this._convertPropertyValue(key, value);
        });

        this.materialProperties[modelId] = {
            ...this.defaultMaterialProperties, ...this.materialProperties[modelId], ...convertedProperties
        };

        // Mettre à jour les matériaux existants
        const materialKeys = [];
        for (const key in this.materialPool) {
            if (key.startsWith(modelId + '_')) {
                materialKeys.push(key);
            }
        }

        materialKeys.forEach(key => {
            const material = this.materialPool[key];
            if (material) {
                this._applyMaterialProperties(material, this.materialProperties[modelId]);
                material.needsUpdate = true;
                console.log(`Propriétés mises à jour pour le matériau existant ${key}`);
            }
        });

        return this;
    }

    getMaterialProperties(modelId) {
        return this.materialProperties[modelId] || this.defaultMaterialProperties;
    }

    // Méthodes pour les mappings de textures avec support complet des propriétés
    addTextureMapping(modelId, folder, filePrefix = null, materialProperties = null) {
        const prefix = filePrefix || modelId;

        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${prefix}_BaseColor.png`,
            normal: `/textures/${folder}/${prefix}_Normal.png`,
            normalOpenGL: `/textures/${folder}/${prefix}_NormalOpenGL.png`,
            roughness: `/textures/${folder}/${prefix}_Roughness.png`,
            metalness: `/textures/${folder}/${prefix}_Metallic.png`,
            height: `/textures/${folder}/${prefix}_Height.png`
        };

        if (this.isAlphaTextureAvailable(folder, prefix)) {
            this.texturePaths[modelId].alpha = `/textures/${folder}/${prefix}_Alpha.png`;
        }

        if (this.isOpacityTextureAvailable(folder, prefix)) {
            this.texturePaths[modelId].opacity = `/textures/${folder}/${prefix}_Opacity.png`;
        }

        if (materialProperties) {
            this.setMaterialProperties(modelId, materialProperties);
        }
    }

    addPlantTexture(modelId, folder, materialProperties = null) {
        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${modelId}_BaseColor.png`,
        };

        if (this.isAlphaTextureAvailable(folder, modelId)) {
            this.texturePaths[modelId].alpha = `/textures/${folder}/${modelId}_Alpha.png`;
        }

        const defaultProperties = {
            roughness: 0,
            metalness: 0,
            normalMap: null,
            roughnessMap: null,
            metalnessMap: null,
            transparent: false,
            aoMap: null,
            envMap: null,
            side: DoubleSide,
            flatShading: true,
            needsUpdate: true,
            envMapIntensity: 0,
            aoMapIntensity: 0,
            normalScale: 1.0,
            alphaTest: 1.0
        };

        if (materialProperties) {
            this.setMaterialProperties(modelId, {...defaultProperties, ...materialProperties});
        } else {
            this.setMaterialProperties(modelId, defaultProperties);
        }
    }

    // Méthodes utilitaires existantes préservées
    isAlphaTextureAvailable(folder, prefix) {
        const alphaSupportedPrefixes = ['forest/', 'primary'];
        return alphaSupportedPrefixes.some(p => folder.startsWith(p));
    }

    isOpacityTextureAvailable(folder, prefix) {
        return (prefix === 'ForestGrass' || prefix === 'ForestRoad');
    }

    getTexturePathsForModel(modelId) {
        return this.texturePaths[modelId] || null;
    }

    hasTextures(modelId) {
        return !!this.texturePaths[modelId];
    }

    addTextureForModel(modelId, textureType, texturePath) {
        if (!this.texturePaths[modelId]) {
            this.texturePaths[modelId] = {};
        }

        this.texturePaths[modelId][textureType] = texturePath;
        return this;
    }

    /**
     * Précharger une texture avec gestion de LOD et optimisation mémoire
     */
    async preloadTexture(texturePath) {
        if (typeof texturePath !== 'string') {
            console.error('preloadTexture: le chemin doit être une chaîne, reçu', typeof texturePath);
            return null;
        }

        const cacheKey = `${texturePath}_${this.currentLOD}`;
        if (this.loadedTextures[cacheKey]) {
            return this.loadedTextures[cacheKey];
        }

        return new Promise((resolve, reject) => {
            try {
                const textureLoader = new TextureLoader();
                const lodScale = this.textureResolutions[this.currentLOD];

                textureLoader.load(texturePath, (texture) => {
                    texture.encoding = SRGBColorSpace;
                    texture.wrapS = RepeatWrapping;
                    texture.wrapT = RepeatWrapping;
                    texture.flipY = false;

                    if (lodScale < 1.0) {
                        texture.minFilter = LinearFilter;
                        texture.magFilter = LinearFilter;
                        texture.anisotropy = Math.max(2, Math.floor(8 * lodScale));
                    } else {
                        texture.anisotropy = 16;
                    }

                    const originalSize = (texture.image?.width || 0) * (texture.image?.height || 0) * 4;
                    texture.userData.memorySize = originalSize * lodScale * lodScale;

                    this.stats.texturesLoaded++;
                    this.stats.memoryUsage += texture.userData.memorySize / (1024 * 1024);

                    this.loadedTextures[cacheKey] = texture;
                    resolve(texture);
                }, undefined, (error) => {
                    reject(error);
                });
            } catch (error) {
                console.error(`Exception lors du chargement de la texture ${texturePath}:`, error);
                reject(error);
            }
        });
    }

    async preloadTexturesForModel(modelId) {
        const texturePaths = this.getTexturePathsForModel(modelId);
        if (!texturePaths) return null;

        const loadedTextures = {};
        const promises = [];

        for (const [textureType, texturePath] of Object.entries(texturePaths)) {
            if (typeof texturePath === 'string') {
                const promise = this.preloadTexture(texturePath)
                    .then(texture => {
                        if (texture) {
                            loadedTextures[textureType] = texture;
                        }
                    })
                    .catch(error => {
                        // Silently handle texture loading errors
                    });

                promises.push(promise);
            }
        }

        await Promise.all(promises);
        return loadedTextures;
    }

    configureTexture(texture, textureType) {
        if (!texture || typeof texture !== 'object' || !texture.isTexture) {
            console.warn(`configureTexture: texture invalide pour le type ${textureType}`, texture);
            return;
        }

        switch (textureType) {
            case 'baseColor':
            case 'diffuse':
                texture.encoding = SRGBColorSpace;
                break;
            case 'normal':
            case 'normalOpenGL':
            case 'roughness':
            case 'metalness':
            case 'ao':
            case 'height':
            case 'alpha':
            case 'opacity':
                texture.encoding = LinearSRGBColorSpace;
                break;
        }

        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;

        if (textureType === 'alpha' || textureType === 'opacity') {
            texture.minFilter = LinearFilter;
            texture.magFilter = LinearFilter;
            texture.generateMipmaps = false;

            texture.anisotropy = 16;

            texture.needsUpdate = true;

            console.log(`Texture alpha optimisée: ${textureType}`);
        } else {
            texture.anisotropy = 16;
        }

        texture.needsUpdate = true;
    }
    async getMaterialAsync(modelId, options = {}) {
        const group = this.modelGroupMap[modelId] || 'default';
        const optionsWithLOD = {...options, lod: options.lod || this.currentLOD};
        const key = this._getMaterialKey(modelId, optionsWithLOD);
        const groupKey = `group_${group}_${JSON.stringify(optionsWithLOD)}`;

        if (options.useGroupMaterial && this.materialPool[groupKey]) {
            return this.materialPool[groupKey];
        }

        if (this.materialPool[key]) {
            return this.materialPool[key];
        }

        const materialProperties = this.getMaterialProperties(modelId);

        const material = new MeshStandardMaterial({
            name: `${modelId}_material`,
            side: materialProperties.side || DoubleSide,
            transparent: materialProperties.transparent || false,
            alphaTest: materialProperties.alphaTest || 0.0,
            roughness: materialProperties.roughness,
            metalness: materialProperties.metalness
        });

        this.stats.materialsCreated++;

        // Appliquer immédiatement les propriétés configurées
        this._applyMaterialProperties(material, materialProperties);

        const shouldBeEmissive = this._shouldObjectBeEmissive(modelId);

        if (shouldBeEmissive) {
            options.isEmissive = true;
            options.emissiveColor = options.emissiveColor || this.emissiveConfig.color;
            options.emissiveIntensity = options.emissiveIntensity || this.emissiveConfig.intensity;
        }

        // CORRECTION : Attendre le chargement des textures avant de retourner le matériau
        try {
            const textures = await this.preloadTexturesForModel(modelId);
            if (textures) {
                this._applyTexturesToMaterial(material, textures, {
                    ...optionsWithLOD, ...materialProperties, modelId: modelId, isEmissive: shouldBeEmissive
                });

                if (options.useGroupMaterial && group && !this.materialPool[groupKey]) {
                    this.materialPool[groupKey] = material;
                }
            }
        } catch (error) {
            console.error(`Erreur lors du chargement des textures pour ${modelId}:`, error);
        }

        this.materialPool[key] = material;
        return material;
    }


    /**
     * Créer ou récupérer un matériau du pool de matériaux
     */
    getMaterial(modelId, options = {}) {
        const group = this.modelGroupMap[modelId] || 'default';
        const optionsWithLOD = {...options, lod: options.lod || this.currentLOD};
        const key = this._getMaterialKey(modelId, optionsWithLOD);
        const groupKey = `group_${group}_${JSON.stringify(optionsWithLOD)}`;

        if (options.useGroupMaterial && this.materialPool[groupKey]) {
            return this.materialPool[groupKey];
        }

        if (this.materialPool[key]) {
            return this.materialPool[key];
        }

        const materialProperties = this.getMaterialProperties(modelId);

        const material = new MeshStandardMaterial({
            name: `${modelId}_material`,
            side: materialProperties.side || DoubleSide,
            transparent: materialProperties.transparent || false,
            alphaTest: materialProperties.alphaTest || 0.0,
            roughness: materialProperties.roughness,
            metalness: materialProperties.metalness
        });

        this.stats.materialsCreated++;

        // Appliquer immédiatement les propriétés configurées
        this._applyMaterialProperties(material, materialProperties);

        const shouldBeEmissive = this._shouldObjectBeEmissive(modelId);

        if (shouldBeEmissive) {
            options.isEmissive = true;
            options.emissiveColor = options.emissiveColor || this.emissiveConfig.color;
            options.emissiveIntensity = options.emissiveIntensity || this.emissiveConfig.intensity;
        }

        // CORRECTION : Marquer le matériau comme "en cours de chargement"
        material.userData.isLoadingTextures = true;
        material.userData.modelId = modelId;

        this.preloadTexturesForModel(modelId)
            .then(textures => {
                if (textures) {
                    this._applyTexturesToMaterial(material, textures, {
                        ...optionsWithLOD, ...materialProperties, modelId: modelId, isEmissive: shouldBeEmissive
                    });

                    // Marquer comme terminé
                    material.userData.isLoadingTextures = false;
                    material.needsUpdate = true;

                    if (options.useGroupMaterial && group && !this.materialPool[groupKey]) {
                        this.materialPool[groupKey] = material;
                    }
                }
            })
            .catch(error => {
                console.error(`Erreur lors du chargement des textures pour ${modelId}:`, error);
                material.userData.isLoadingTextures = false;
            });

        this.materialPool[key] = material;
        return material;
    }

    _getMaterialKey(modelId, options) {
        const optionsKey = JSON.stringify(options);
        return `${modelId}_${optionsKey}`;
    }

    _applyTexturesToMaterial(material, textures, options = {}) {
        if (!material || !textures) return;

        const materialProps = this.getMaterialProperties(options.modelId || '');

        const config = {
            aoIntensity: materialProps.aoIntensity || 0.5,
            useDisplacement: false,
            displacementScale: materialProps.displacementScale || 0.05,
            useEnvMap: true,
            envMapIntensity: materialProps.envMapIntensity || 0.5,
            normalScale: materialProps.normalScale || 1.0,
            roughness: materialProps.roughness,
            metalness: materialProps.metalness,
            lod: this.currentLOD, ...options
        };

        // Récupérer les paramètres d'activation des textures
        const textureSettings = materialProps.useTextures || this.defaultMaterialProperties.useTextures;

        try {
            if (material.color) {
                material.userData.originalDefineColor = material.defines?.USE_COLOR;
                material.defines = material.defines || {};
                material.defines.USE_COLOR = false;
            }

            const applyDetailedTextures = config.lod !== 'low';

            // Carte de couleur de base - Vérifier si elle est activée
            if (textureSettings.baseColor !== false || textureSettings.diffuse !== false) {
                if (textures.baseColor && textureSettings.baseColor !== false) {
                    material.map = textures.baseColor;
                    this.configureTexture(material.map, 'baseColor');
                } else if (textures.diffuse && textureSettings.diffuse !== false) {
                    material.map = textures.diffuse;
                    this.configureTexture(material.map, 'diffuse');
                }
            } else {
                // Si la texture est désactivée, supprimer la référence
                material.map = null;
                console.log(`Texture baseColor désactivée pour ${options.modelId}`);
            }

            if (applyDetailedTextures) {
                // Carte normale - Vérifier si elle est activée
                if ((textureSettings.normal !== false || textureSettings.normalOpenGL !== false) && (textures.normalOpenGL || textures.normal)) {

                    if (textures.normalOpenGL && textureSettings.normalOpenGL !== false) {
                        material.normalMap = textures.normalOpenGL;
                        this.configureTexture(material.normalMap, 'normalOpenGL');
                    } else if (textures.normal && textureSettings.normal !== false) {
                        material.normalMap = textures.normal;
                        this.configureTexture(material.normalMap, 'normal');
                    }

                    if (material.normalMap) {
                        if (!material.normalScale) {
                            material.normalScale = new Vector2(config.normalScale, config.normalScale);
                        } else {
                            material.normalScale.x = material.normalScale.y = config.normalScale;
                        }
                    }
                } else if (textureSettings.normal === false && textureSettings.normalOpenGL === false) {
                    material.normalMap = null;
                    console.log(`Texture normal désactivée pour ${options.modelId}`);
                }

                // Carte de rugosité - Vérifier si elle est activée
                if (textures.roughness && textureSettings.roughness !== false) {
                    material.roughnessMap = textures.roughness;
                    this.configureTexture(material.roughnessMap, 'roughness');
                    material.roughness = config.roughness !== undefined ? config.roughness : 1.0;
                } else {
                    if (textureSettings.roughness === false) {
                        material.roughnessMap = null;
                        console.log(`Texture roughness désactivée pour ${options.modelId}`);
                    }
                    if (config.roughness !== undefined) {
                        material.roughness = config.roughness;
                    }
                }

                // Carte de métallicité - Vérifier si elle est activée
                if (textures.metalness && textureSettings.metalness !== false) {
                    material.metalnessMap = textures.metalness;
                    this.configureTexture(material.metalnessMap, 'metalness');
                    material.metalness = config.metalness !== undefined ? config.metalness : 0.0;
                } else {
                    if (textureSettings.metalness === false) {
                        material.metalnessMap = null;
                        console.log(`Texture metalness désactivée pour ${options.modelId}`);
                    }
                    if (config.metalness !== undefined) {
                        material.metalness = config.metalness;
                    }
                }

                // Carte d'occlusion ambiante - Vérifier si elle est activée
                if (textureSettings.ao !== false) {
                    if (textures.ao) {
                        material.aoMap = textures.ao;
                        this.configureTexture(material.aoMap, 'ao');
                        material.aoMapIntensity = config.aoIntensity;
                    } else if (textures.height && !config.useDisplacement && textureSettings.height !== false) {
                        material.aoMap = textures.height;
                        this.configureTexture(material.aoMap, 'height');
                        material.aoMapIntensity = config.aoIntensity;
                    }
                } else {
                    material.aoMap = null;
                    console.log(`Texture AO désactivée pour ${options.modelId}`);
                }

                // Carte de déplacement - Vérifier si elle est activée
                if (config.lod === 'high' && textures.height && config.useDisplacement && textureSettings.height !== false && textureSettings.displacementMap !== false) {
                    material.displacementMap = textures.height;
                    this.configureTexture(material.displacementMap, 'height');
                    material.displacementScale = config.displacementScale;
                } else if (textureSettings.displacementMap === false || textureSettings.height === false) {
                    material.displacementMap = null;
                    if (textureSettings.displacementMap === false) {
                        console.log(`Texture displacement désactivée pour ${options.modelId}`);
                    }
                }

                // Carte de relief (bump) - Vérifier si elle est activée
                if (textures.bump && textureSettings.bumpMap !== false) {
                    material.bumpMap = textures.bump;
                    this.configureTexture(material.bumpMap, 'bump');
                    material.bumpScale = materialProps.bumpScale || 1.0;
                } else if (textureSettings.bumpMap === false) {
                    material.bumpMap = null;
                    console.log(`Texture bump désactivée pour ${options.modelId}`);
                }

                // Carte d'émission - Vérifier si elle est activée
                if (textures.emissiveMap && textureSettings.emissiveMap !== false) {
                    material.emissiveMap = textures.emissiveMap;
                    this.configureTexture(material.emissiveMap, 'emissiveMap');
                } else if (textureSettings.emissiveMap === false) {
                    material.emissiveMap = null;
                    console.log(`Texture emissive désactivée pour ${options.modelId}`);
                }

            } else {
                // Pour le LOD bas, utiliser des valeurs fixes plutôt que des textures
                material.roughness = config.roughness !== undefined ? config.roughness : 0.8;
                material.metalness = config.metalness !== undefined ? config.metalness : 0.1;
            }

            // Carte de transparence (Alpha ou Opacity) - Vérifier si elle est activée
            if (textures.alpha && textureSettings.alpha !== false) {
                material.alphaMap = textures.alpha;
                this.configureTexture(material.alphaMap, 'alpha');
                material.transparent = false;
                material.alphaTest = 1.0;
                material.side = DoubleSide;
            } else if (textures.opacity && textureSettings.opacity !== false) {
                material.alphaMap = textures.opacity;
                this.configureTexture(material.alphaMap, 'opacity');
                material.transparent = true;
                material.alphaTest = 0.5;
            } else {
                if (textureSettings.alpha === false || textureSettings.opacity === false) {
                    material.alphaMap = null;
                    console.log(`Texture alpha/opacity désactivée pour ${options.modelId}`);
                }
            }

            // Environment mapping - Vérifier si elle est activée
            if (config.useEnvMap && config.lod !== 'low' && textureSettings.envMap !== false) {
                const envMapTexture = window.assetManager?.getItem('EnvironmentMap');
                if (envMapTexture) {
                    material.envMap = envMapTexture;
                    material.envMapIntensity = config.envMapIntensity * (config.lod === 'high' ? 1.0 : 0.5);
                    material.needsUpdate = true;
                }
            } else if (textureSettings.envMap === false) {
                material.envMap = null;
                console.log(`Environment map désactivée pour ${options.modelId}`);
            }

            if (options.isEmissive || options.emissive || this._shouldObjectBeEmissive(options.modelId)) {
                const emissiveIntensity = options.emissiveIntensity || this.emissiveConfig.intensity;
                const emissiveColor = options.emissiveColor || this.emissiveConfig.color;

                // Pour les écrans, utiliser la texture de base comme émission si disponible
                let emissiveMap = null;
                if (this.emissiveConfig.useTexture && material.map) {
                    emissiveMap = material.map;
                } else if (options.emissiveMap) {
                    emissiveMap = options.emissiveMap;
                } else if (this.emissiveConfig.emissiveMap) {
                    emissiveMap = this.emissiveConfig.emissiveMap;
                }

                const applied = this._safelySetEmissive(material, {
                    color: emissiveColor,
                    intensity: emissiveIntensity,
                    useTexture: this.emissiveConfig.useTexture,
                    emissiveMap: emissiveMap
                });

                if (applied) {
                    console.log(`Émission appliquée au matériau ${options.modelId} avec intensité ${emissiveIntensity}`);
                }
            }

            // Appliquer TOUTES les propriétés configurées après avoir appliqué les textures
            this._applyMaterialProperties(material, materialProps);

            material.needsUpdate = true;
        } catch (error) {
            console.error("Erreur lors de l'application des textures au matériau:", error);
        }
    }


    _shouldObjectBeEmissive(objectId, objectName = '') {
        if (!objectId && !objectName) return false;

        // SOLUTION STRICTE: Un objet est émissif SEULEMENT s'il contient "Emission" dans SON nom/ID
        const hasEmissionInId = objectId && objectId.includes('Emission');
        const hasEmissionInName = objectName && objectName.includes('Emission');

        const shouldBeEmissive = hasEmissionInId || hasEmissionInName;

        // Debug pour traçabilité
        if (shouldBeEmissive) {
            console.log(`🔥 Objet émissif détecté: ${objectId || objectName} (contient 'Emission')`);
        } else if ((objectId && objectId.includes('Screen')) || (objectName && objectName.includes('Screen'))) {
            console.log(`📱 Écran normal (non émissif): ${objectId || objectName} - PAS d'Emission dans le nom`);
        }

        return shouldBeEmissive;
    }


    /**
     * Applique un matériau à tous les Mesh d'un objet avec propriétés complètes
     */
    applyMaterialToAllMeshes(object, material, config = {}) {
        let materialsMerged = 0;
        const similarMaterials = {};

        object.traverse((node) => {
            if (node.isMesh) {
                const originalMaterial = node.material;

                // Vérifier si ce mesh doit avoir une émission basée sur son nom
                const shouldBeEmissive = this.emissiveObjectNames.some(name => node.name.includes(name) || (node.parent && node.parent.name.includes(name)));

                if (shouldBeEmissive) {
                    if (this.emissiveConfig.forceOverride && originalMaterial) {
                        const materials = Array.isArray(originalMaterial) ? originalMaterial : [originalMaterial];

                        for (let i = 0; i < materials.length; i++) {
                            const mat = materials[i];
                            this._safelySetEmissive(mat, {
                                color: this.emissiveConfig.color,
                                intensity: this.emissiveConfig.intensity,
                                useTexture: this.emissiveConfig.useTexture,
                                emissiveMap: this.emissiveConfig.emissiveMap
                            });
                        }
                    } else {
                        const emissiveMaterial = material.clone();
                        const canSetEmissive = this._safelySetEmissive(emissiveMaterial, {
                            color: this.emissiveConfig.color, intensity: this.emissiveConfig.intensity
                        });

                        const originalMap = Array.isArray(originalMaterial) ? originalMaterial[0]?.map : originalMaterial?.map;

                        if (canSetEmissive) {
                            if (this.emissiveConfig.useTexture && originalMap) {
                                emissiveMaterial.map = originalMap;
                                if (emissiveMaterial.emissiveMap !== undefined) {
                                    emissiveMaterial.emissiveMap = emissiveMaterial.map;
                                }
                            } else if (this.emissiveConfig.emissiveMap && emissiveMaterial.emissiveMap !== undefined) {
                                emissiveMaterial.emissiveMap = this.emissiveConfig.emissiveMap;
                            }
                        }

                        node.material = emissiveMaterial;
                    }
                } else {
                    // Appliquer le matériau standard
                    if (Array.isArray(node.material)) {
                        for (let i = 0; i < node.material.length; i++) {
                            node.material[i] = material;
                        }
                    } else {
                        node.material = material;
                    }
                }

                // Appliquer les propriétés de shadow depuis la configuration
                if (config.modelId) {
                    const materialProps = this.getMaterialProperties(config.modelId);
                    this._applyShadowProperties(node, materialProps);
                }

                // Préserver les couleurs de vertex si demandé et présentes
                if (config.preserveVertexColors && node.geometry?.attributes?.color && material.vertexColors !== true) {
                    const clonedMaterial = material.clone();
                    clonedMaterial.vertexColors = true;

                    if (config.useCustomProperties && config.modelId) {
                        const props = this.getMaterialProperties(config.modelId);
                        this._applyMaterialProperties(clonedMaterial, props);
                    }

                    node.material = clonedMaterial;
                } else if (config.mergeSimilarMaterials && originalMaterial) {
                    const materialSignature = this._getMaterialSignature(originalMaterial);

                    if (similarMaterials[materialSignature]) {
                        node.material = similarMaterials[materialSignature];
                        materialsMerged++;
                    } else {
                        const optimizedMaterial = this._optimizeMaterial(originalMaterial, material);

                        if (config.useCustomProperties && config.modelId) {
                            const props = this.getMaterialProperties(config.modelId);
                            this._applyMaterialProperties(optimizedMaterial, props);
                        }

                        node.material = optimizedMaterial;
                        similarMaterials[materialSignature] = optimizedMaterial;
                    }
                } else {
                    node.material = material;
                    materialsMerged++;
                }

                // Optimiser la géométrie si demandé
                if (config.optimizeGeometry && node.geometry) {
                    if (!node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                        node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
                    }

                    if (!node.geometry.boundingSphere) {
                        node.geometry.computeBoundingSphere();
                    }

                    if (!node.geometry.boundingBox) {
                        node.geometry.computeBoundingBox();
                    }

                    if (node.geometry.attributes.position && node.geometry.attributes.position.usage === StaticDrawUsage) {
                        node.geometry.attributes.position.needsUpdate = true;
                    }
                }
            }
        });

        this.stats.materialsMerged += materialsMerged;

        if (materialsMerged > 0) {
            console.log(`Fusion de matériaux: ${materialsMerged} matériaux remplacés dans le modèle ${object.name || 'sans nom'}`);
        }
    }

    /**
     * Version améliorée: Appliquer les textures à un modèle avec propriétés complètes
     */
    async applyTexturesToModel(modelId, modelObject, options = {}) {
        if (!modelObject) return;

        if (options.optimizeInstances) {
            return this.applyMergedMaterialToModel(modelObject, options);
        }

        if (!this.hasTextures(modelId)) {
            const baseModelId = this.extractBaseModelId(modelId);
            if (baseModelId && baseModelId !== modelId && this.hasTextures(baseModelId)) {
                modelId = baseModelId;
            } else {
                console.warn(`Aucune texture trouvée pour le modèle ${modelId} ou un modèle similaire`);
                return;
            }
        }

        const optionsWithLOD = {
            ...options, lod: options.lod || this.determineLODForObject(modelObject), modelId: modelId
        };

        const material = this.getMaterial(modelId, optionsWithLOD);

        // Appliquer les propriétés du matériau spécifiques à ce modèle
        const materialProps = this.getMaterialProperties(modelId);
        if (materialProps && !options.skipCustomProperties) {
            this._applyMaterialProperties(material, materialProps);
        }

        // Parcourir tous les matériaux du modèle
        modelObject.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];

                // Vérifier si ce mesh doit avoir une émission basée sur son nom
                const shouldBeEmissive = this.emissiveObjectNames.some(name => node.name.includes(name) || (node.parent && node.parent.name.includes(name)));

                if (shouldBeEmissive) {
                    const emissiveMaterial = material.clone();
                    this._safelySetEmissive(emissiveMaterial, {
                        color: this.emissiveConfig.color,
                        intensity: this.emissiveConfig.intensity,
                        useTexture: this.emissiveConfig.useTexture,
                        emissiveMap: this.emissiveConfig.emissiveMap
                    });

                    if (Array.isArray(node.material)) {
                        for (let i = 0; i < node.material.length; i++) {
                            node.material[i] = emissiveMaterial;
                        }
                    } else {
                        node.material = emissiveMaterial;
                    }
                } else {
                    // Appliquer le matériau standard
                    if (Array.isArray(node.material)) {
                        for (let i = 0; i < node.material.length; i++) {
                            if (options.preserveSpecialMaterials && (node.material[i].userData.isSpecial || node.material[i].name?.includes('Special'))) {
                                continue;
                            }
                            node.material[i] = material;
                        }
                    } else {
                        if (!(options.preserveSpecialMaterials && (node.material.userData.isSpecial || node.material.name?.includes('Special')))) {
                            node.material = material;
                        }
                    }
                }

                // Appliquer les propriétés de shadow depuis la configuration
                this._applyShadowProperties(node, materialProps);

                // Activer les UV2 pour l'aoMap si nécessaire
                if (node.geometry && !node.geometry.attributes.uv2 && node.geometry.attributes.uv) {
                    node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
                }
            }
        });

        this.trackInstance(modelId, modelObject);
    }

    // Analyser un modèle pour identifier ses caractéristiques
    analyzeModel(modelObject) {
        const result = {
            modelId: null,
            meshCount: 0,
            vertexCount: 0,
            hasVertexColors: false,
            materialTypes: new Set(),
            geometryTypes: new Set()
        };

        if (modelObject.name) {
            const knownIds = Object.keys(this.texturePaths);
            for (const id of knownIds) {
                if (modelObject.name.includes(id)) {
                    result.modelId = id;
                    break;
                }
            }

            if (!result.modelId) {
                result.modelId = this.extractBaseModelId(modelObject.name);
            }
        }

        if (!result.modelId) {
            result.modelId = 'Generic' + (modelObject.type || 'Model');
        }

        modelObject.traverse((node) => {
            if (node.isMesh) {
                result.meshCount++;

                if (node.geometry) {
                    result.vertexCount += node.geometry.attributes.position?.count || 0;
                    result.hasVertexColors = !!node.geometry.attributes.color;
                    result.geometryTypes.add(node.geometry.type);
                }

                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                        result.materialTypes.add(mat.type);
                    });
                }
            }
        });

        return result;
    }

    /**
     * Appliquer un matériau fusionné à un modèle déjà chargé/instancié
     */
    applyMergedMaterialToModel(modelObject, options = {}) {
        if (!modelObject) return null;

        const config = {
            forceMerge: false,
            useGroupMaterial: true,
            preserveVertexColors: true,
            optimizeGeometry: true,
            mergeSimilarMaterials: this.optimizationConfig.materialMergeEnabled,
            useCustomProperties: true, ...options
        };

        const modelInfo = this.analyzeModel(modelObject);

        if (!modelInfo.modelId) {
            console.warn("Impossible d'identifier le modèle pour la fusion de matériaux");
            return null;
        }

        const group = this.modelGroupMap[modelInfo.modelId] || 'default';
        this.trackInstance(modelInfo.modelId, modelObject);

        const shouldMerge = config.forceMerge || this.instanceTracker[modelInfo.modelId]?.count > this.optimizationConfig.mergeThreshold;

        if (shouldMerge || config.useGroupMaterial) {
            const materialOptions = {
                useGroupMaterial: config.useGroupMaterial,
                lod: this.determineLODForObject(modelObject),
                modelId: modelInfo.modelId
            };

            const material = this.getMaterial(modelInfo.modelId, materialOptions);

            // Passer l'ID du modèle dans la configuration pour l'application des propriétés
            config.modelId = modelInfo.modelId;
            this.applyMaterialToAllMeshes(modelObject, material, config);

            this.stats.instancesMerged++;
            return material;
        } else {
            return this.applyTexturesToModel(modelInfo.modelId, modelObject, options);
        }
    }

    // Suivre les instances de modèles
    trackInstance(modelId, modelObject) {
        if (!this.instanceTracker[modelId]) {
            this.instanceTracker[modelId] = {
                count: 0, instances: new Set(), lastMergeCheck: Date.now()
            };
        }

        this.instanceTracker[modelId].count++;
        this.instanceTracker[modelId].instances.add(modelObject.uuid);

        if (this.optimizationConfig.autoMergeEnabled && this.instanceTracker[modelId].count % this.optimizationConfig.mergeThreshold === 0) {
            this.checkAndOptimizeInstances(modelId);
        }
    }

    // Déterminer le LOD approprié en fonction de la distance
    determineLODForObject(object) {
        if (!object || !object.position) return this.currentLOD;

        const camera = window.camera || null;
        if (!camera || !camera.position) return this.currentLOD;

        const distance = object.position.distanceTo(camera.position);

        if (distance <= this.optimizationConfig.distanceThresholds.high) {
            return 'high';
        } else if (distance <= this.optimizationConfig.distanceThresholds.medium) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    // Méthodes utilitaires pour les matériaux
    _getMaterialSignature(material) {
        if (!material) return 'null';

        const signature = {
            type: material.type,
            transparent: material.transparent,
            side: material.side,
            alphaTest: material.alphaTest,
            hasMap: !!material.map,
            hasNormalMap: !!material.normalMap,
            hasAlphaMap: !!material.alphaMap,
            hasAoMap: !!material.aoMap,
            roughnessGroup: Math.floor(material.roughness * 10) / 10,
            metalnessGroup: Math.floor(material.metalness * 10) / 10,
            envMapIntensityGroup: material.envMap ? Math.floor(material.envMapIntensity * 5) / 5 : 'none',
            color: material.color ? `${material.color.r.toFixed(2)}_${material.color.g.toFixed(2)}_${material.color.b.toFixed(2)}` : 'none'
        };

        return JSON.stringify(signature);
    }

    _optimizeMaterial(originalMaterial, referenceMaterial) {
        if (originalMaterial.userData && originalMaterial.userData.isOptimized) {
            return originalMaterial;
        }

        const similarity = this._calculateMaterialSimilarity(originalMaterial, referenceMaterial);
        if (similarity > this.optimizationConfig.materialSimilarityThreshold) {
            return referenceMaterial;
        }

        const optimizedMaterial = originalMaterial.clone();

        if (originalMaterial.map) {
            optimizedMaterial.map = originalMaterial.map;
        }

        if (originalMaterial.color) {
            optimizedMaterial.color = originalMaterial.color.clone();
        }

        if (originalMaterial.alphaMap) {
            optimizedMaterial.alphaMap = originalMaterial.alphaMap;
            optimizedMaterial.transparent = false;
        }

        optimizedMaterial.roughness = originalMaterial.roughness;
        optimizedMaterial.metalness = originalMaterial.metalness;
        if (originalMaterial.envMap) {
            optimizedMaterial.envMap = originalMaterial.envMap;
            optimizedMaterial.envMapIntensity = originalMaterial.envMapIntensity;
        }

        if (this.currentLOD === 'low') {
            optimizedMaterial.normalMap = null;
            optimizedMaterial.roughnessMap = null;
            optimizedMaterial.metalnessMap = null;
            optimizedMaterial.aoMap = null;
        } else {
            if (originalMaterial.normalMap) {
                optimizedMaterial.normalMap = originalMaterial.normalMap;
            }

            if (originalMaterial.aoMap) {
                optimizedMaterial.aoMap = originalMaterial.aoMap;
            }
        }

        optimizedMaterial.userData = optimizedMaterial.userData || {};
        optimizedMaterial.userData.isOptimized = true;
        optimizedMaterial.userData.originalUuid = originalMaterial.uuid;
        optimizedMaterial.needsUpdate = true;

        return optimizedMaterial;
    }

    _calculateMaterialSimilarity(materialA, materialB) {
        if (!materialA || !materialB) return 0;

        let score = 0;
        let totalFactors = 0;

        if (materialA.type === materialB.type) {
            score += 0.3;
        }
        totalFactors += 0.3;

        if (materialA.transparent === materialB.transparent) score += 0.1;
        totalFactors += 0.1;

        if (materialA.side === materialB.side) score += 0.05;
        totalFactors += 0.05;

        if (Math.abs(materialA.alphaTest - materialB.alphaTest) < 0.1) score += 0.05;
        totalFactors += 0.05;

        if ((!!materialA.map === !!materialB.map)) score += 0.1;
        totalFactors += 0.1;

        if ((!!materialA.normalMap === !!materialB.normalMap)) score += 0.05;
        totalFactors += 0.05;

        if ((!!materialA.alphaMap === !!materialB.alphaMap)) score += 0.1;
        totalFactors += 0.1;

        if (Math.abs(materialA.roughness - materialB.roughness) < 0.2) score += 0.1;
        totalFactors += 0.1;

        if (Math.abs(materialA.metalness - materialB.metalness) < 0.2) score += 0.1;
        totalFactors += 0.1;

        if (materialA.envMap && materialB.envMap && Math.abs(materialA.envMapIntensity - materialB.envMapIntensity) < 0.3) {
            score += 0.1;
        }
        totalFactors += 0.1;

        if (materialA.color && materialB.color) {
            const colorDistance = Math.sqrt(Math.pow(materialA.color.r - materialB.color.r, 2) + Math.pow(materialA.color.g - materialB.color.g, 2) + Math.pow(materialA.color.b - materialB.color.b, 2));

            const colorScore = Math.max(0, 0.25 - colorDistance);
            score += colorScore;
            totalFactors += 0.25;
        }

        return totalFactors > 0 ? score / totalFactors : 0;
    }

    // Méthodes utilitaires existantes
    checkAndOptimizeInstances(modelId) {
        const instances = this.instanceTracker[modelId];
        if (!instances || instances.count < this.optimizationConfig.mergeThreshold) return;

        instances.lastMergeCheck = Date.now();
        this.stats.lastOptimization = Date.now();

        if (instances.count > this.optimizationConfig.mergeThreshold * 3) {
            console.log(`Nombre élevé d'instances de ${modelId}: ${instances.count}. Envisager l'utilisation de mergeModelInstances() pour une fusion géométrique.`);
        }
    }

    updateGlobalLOD(performanceStats = null) {
        if (performanceStats) {
            const {fps, memoryUsage} = performanceStats;

            if (fps < 30 && this.currentLOD !== 'low') {
                this.setGlobalLOD('low');
                return;
            } else if (fps < 45 && this.currentLOD === 'high') {
                this.setGlobalLOD('medium');
                return;
            } else if (fps > 55 && this.currentLOD === 'low') {
                this.setGlobalLOD('medium');
                return;
            } else if (fps > 58 && this.currentLOD === 'medium' && memoryUsage < this.optimizationConfig.memoryBudget * 0.8) {
                this.setGlobalLOD('high');
                return;
            }
        }

        const memoryUsageMB = this.stats.memoryUsage;
        const memoryBudget = this.optimizationConfig.memoryBudget;

        if (memoryUsageMB > memoryBudget * 0.9) {
            this.setGlobalLOD('low');
        } else if (memoryUsageMB < memoryBudget * 0.5 && this.currentLOD === 'low') {
            this.setGlobalLOD('medium');
        }
    }

    setGlobalLOD(lodLevel) {
        if (!this.textureResolutions[lodLevel]) {
            console.error(`Niveau de LOD inconnu: ${lodLevel}`);
            return;
        }

        if (this.currentLOD === lodLevel) return;

        const oldLOD = this.currentLOD;
        this.currentLOD = lodLevel;

        this.refreshMaterialsWithCurrentLOD();
    }

    refreshMaterialsWithCurrentLOD() {
        Object.entries(this.materialPool).forEach(([key, material]) => {
            if (!material || !material.userData) return;

            const [modelId, optionsStr] = key.split('_');
            if (!modelId) return;

            let options = {};
            try {
                if (optionsStr) options = JSON.parse(optionsStr);
            } catch (e) {
                console.warn(`Impossible de parser les options pour ${key}`);
                return;
            }

            if (options.lod !== this.currentLOD) {
                const newOptions = {...options, lod: this.currentLOD};

                this.preloadTexturesForModel(modelId)
                    .then(textures => {
                        if (textures) {
                            const materialProps = this.getMaterialProperties(modelId);

                            this._applyTexturesToMaterial(material, textures, {
                                ...newOptions, ...materialProps, modelId: modelId
                            });
                        }
                    })
                    .catch(error => {
                        console.error(`Erreur lors de la mise à jour du matériau ${modelId}:`, error);
                    });
            }
        });
    }

    // Méthodes d'analyse et d'optimisation
    analyzePerfAndSuggestOptimizations() {
        const materialCount = Object.keys(this.materialPool).length;
        const textureCount = Object.keys(this.loadedTextures).length;
        const avgTexturesPerMaterial = textureCount / Math.max(1, materialCount);

        const suggestions = [];

        if (avgTexturesPerMaterial > 3) {
            suggestions.push("Réduire le nombre de textures par matériau pour les objets distants");
        }

        if (this.stats.memoryUsage > this.optimizationConfig.memoryBudget * 0.8) {
            suggestions.push("Réduire la résolution des textures ou passer à un LOD plus bas");
        }

        const mergeCandidates = Object.entries(this.instanceTracker)
            .filter(([_, data]) => data.count > this.optimizationConfig.mergeThreshold)
            .map(([modelId, data]) => ({modelId, count: data.count}))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        if (mergeCandidates.length > 0 && mergeCandidates[0].count > this.optimizationConfig.mergeThreshold * 2) {
            suggestions.push(`Fusionner les instances de ${mergeCandidates[0].modelId} pour réduire les draw calls`);
        }

        const totalMaterialsCount = Object.values(this.instanceTracker)
            .reduce((sum, tracker) => sum + tracker.count, 0);

        const mergeRatio = this.stats.materialsMerged / Math.max(1, totalMaterialsCount);

        if (mergeRatio < 0.3 && totalMaterialsCount > 20) {
            suggestions.push("Utiliser mergeSimilarMaterials() pour réduire les doublons de matériaux");
        }

        return {
            stats: {
                materialCount,
                textureCount,
                avgTexturesPerMaterial,
                memoryUsage: this.stats.memoryUsage,
                materialsMerged: this.stats.materialsMerged,
                instancesMerged: this.stats.instancesMerged
            }, mergeCandidates, suggestions
        };
    }

    // Méthodes de mise à jour des propriétés
    updateMaterialProperties(modelId, properties = {}) {
        this.setMaterialProperties(modelId, properties);

        const materialKeys = Object.keys(this.materialPool).filter(key => key.startsWith(modelId + '_'));

        if (materialKeys.length === 0) {
            return false;
        }

        let updatedCount = 0;
        materialKeys.forEach(key => {
            const material = this.materialPool[key];
            if (material) {
                this._applyMaterialProperties(material, properties);
                material.needsUpdate = true;
                updatedCount++;
            }
        });

        return updatedCount > 0;
    }

    updateMaterialProperty(modelId, property, value) {
        return this.updateMaterialProperties(modelId, {[property]: value});
    }

    setRoughness(modelId, value) {
        return this.updateMaterialProperty(modelId, 'roughness', value);
    }

    setMetalness(modelId, value) {
        return this.updateMaterialProperty(modelId, 'metalness', value);
    }

    setEnvMapIntensity(modelId, value) {
        return this.updateMaterialProperty(modelId, 'envMapIntensity', value);
    }

    setColor(modelId, value) {
        return this.updateMaterialProperty(modelId, 'color', value);
    }

    setOpacity(modelId, value) {
        return this.updateMaterialProperty(modelId, 'opacity', value);
    }

    setTransparent(modelId, value) {
        return this.updateMaterialProperty(modelId, 'transparent', value);
    }

    // Méthodes d'affichage et de diagnostic
    logMaterialProperties() {
        console.log("===== PROPRIÉTÉS DES MATÉRIAUX =====");
        console.log("Propriétés par défaut:");
        console.log(JSON.stringify(this.defaultMaterialProperties, null, 2));

        console.log("\nPropriétés personnalisées par modèle:");
        Object.entries(this.materialProperties).forEach(([modelId, props]) => {
            console.log(`- ${modelId}:`, props);
        });

        console.log("\nValeurs effectives des matériaux dans le pool:");
        const modelMaterials = {};

        Object.entries(this.materialPool).forEach(([key, material]) => {
            if (!key.includes('_')) return;

            const modelId = key.split('_')[0];
            if (!modelMaterials[modelId]) {
                modelMaterials[modelId] = [];
            }

            modelMaterials[modelId].push({
                key: key,
                roughness: material.roughness,
                metalness: material.metalness,
                envMapIntensity: material.envMapIntensity,
                color: material.color ? material.color.getHexString() : 'none',
                opacity: material.opacity,
                transparent: material.transparent
            });
        });

        Object.entries(modelMaterials).forEach(([modelId, materials]) => {
            if (materials.length > 0) {
                const sample = materials[0];
                console.log(`- ${modelId}: ${materials.length} matériaux, exemple:`, sample);
            }
        });

        console.log("======================================");
    }

    logTextureStats() {
        console.log("===== STATISTIQUES TEXTURE MANAGER =====");
        console.log(`Nombre de types d'objets avec textures: ${Object.keys(this.texturePaths).length}`);
        console.log(`Nombre de textures chargées en mémoire: ${Object.keys(this.loadedTextures).length}`);
        console.log(`Nombre de matériaux dans le pool: ${Object.keys(this.materialPool).length}`);
        console.log(`LOD actuel: ${this.currentLOD}`);
        console.log(`Instances suivies: ${Object.keys(this.instanceTracker).length} types de modèles`);
        console.log(`Total des instances: ${Object.values(this.instanceTracker).reduce((sum, tracker) => sum + tracker.count, 0)}`);
        console.log(`Matériaux fusionnés: ${this.stats.materialsMerged}`);
        console.log(`Instances fusionnées: ${this.stats.instancesMerged}`);
        console.log(`Utilisation mémoire estimée: ${this.stats.memoryUsage.toFixed(2)} MB`);

        if (this.stats.lastOptimization) {
            const timeSinceOpt = Math.floor((Date.now() - this.stats.lastOptimization) / 1000);
            console.log(`Dernière optimisation: il y a ${timeSinceOpt} secondes`);
        }

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

    // Méthodes de gestion des presets
    createMaterialPreset(presetName, properties) {
        if (!this.materialPresets) {
            this.materialPresets = {};
        }

        this.materialPresets[presetName] = {
            ...this.defaultMaterialProperties, ...properties
        };

        console.log(`Preset de matériau '${presetName}' créé avec propriétés:`, properties);
        return this.materialPresets[presetName];
    }

    applyMaterialPreset(modelId, presetName) {
        if (!this.materialPresets || !this.materialPresets[presetName]) {
            console.error(`Le preset '${presetName}' n'existe pas`);
            return false;
        }

        return this.updateMaterialProperties(modelId, this.materialPresets[presetName]);
    }

    getMaterialPresets() {
        if (!this.materialPresets) {
            this.materialPresets = {};
        }

        return this.materialPresets;
    }

    batchUpdateMaterialProperties(materialUpdates) {
        if (!materialUpdates || typeof materialUpdates !== 'object') {
            console.error("batchUpdateMaterialProperties: l'argument doit être un objet");
            return {};
        }

        const results = {};

        Object.entries(materialUpdates).forEach(([modelId, properties]) => {
            results[modelId] = this.updateMaterialProperties(modelId, properties);
        });

        console.log(`Mise à jour par lot terminée pour ${Object.keys(materialUpdates).length} modèles`);
        return results;
    }

    resetMaterialProperties(modelId) {
        if (this.materialProperties[modelId]) {
            delete this.materialProperties[modelId];
        }

        return this.updateMaterialProperties(modelId, this.defaultMaterialProperties);
    }

    // Méthodes de nettoyage et de randomisation
    addRandomizedTexture(modelId, folder, options = {}) {
        const variantConfig = {
            baseColor: ['TreeRoof_BaseColor.png', 'TreeRoofDark_BaseColor.png', 'TreeRoofMedium_BaseColor.png'],
            alpha: ['TreeRoof_Alpha.png', 'TreeRoof1_Alpha.png', 'TreeRoof2_Alpha.png', 'TreeRoof3_Alpha.png', 'TreeRoof4_Alpha.png', 'TreeRoof5_Alpha.png'], ...options
        };

        const getRandomVariant = (variants) => {
            const index = Math.floor(Math.random() * variants.length);
            return variants[index];
        };

        const selectedBaseColor = getRandomVariant(variantConfig.baseColor);
        const selectedAlpha = getRandomVariant(variantConfig.alpha);

        this.texturePaths[modelId] = {
            baseColor: `/textures/${folder}/${selectedBaseColor}`, alpha: `/textures/${folder}/${selectedAlpha}`
        };

        const materialProperties = {
            roughness: 1.0, metalness: 0.0, envMapIntensity: 0.05, ...options.materialProperties
        };

        this.setMaterialProperties(modelId, materialProperties);

        this.texturePaths[modelId].isRandomized = true;
        this.texturePaths[modelId].selectedVariants = {
            baseColor: selectedBaseColor, alpha: selectedAlpha
        };

        return this.texturePaths[modelId];
    }

    createRandomizedMaterial(modelId, instanceId = null, options = {}) {
        const uniqueId = instanceId || `${modelId}_${Math.floor(Math.random() * 10000)}`;
        this.addRandomizedTexture(uniqueId, options.folder || 'forest/tree', options);
        const material = this.getMaterial(uniqueId, options);
        this.materialPool[`random_${uniqueId}`] = material;
        return material;
    }

    applyRandomizedTreeRoofTextures(modelObject, options = {}) {
        if (!modelObject) return 0;

        let modifiedCount = 0;
        const textureInstances = new Map();

        modelObject.traverse((node) => {
            if (node.isMesh && (node.name.includes('TreeRoof') || (node.parent && node.parent.name.includes('TreeRoof')))) {
                const groupX = Math.floor(node.position.x / 5);
                const groupY = Math.floor(node.position.y / 5);
                const groupZ = Math.floor(node.position.z / 5);
                const groupId = `group_${groupX}_${groupY}_${groupZ}`;

                let material;

                if (textureInstances.has(groupId)) {
                    material = textureInstances.get(groupId);
                } else {
                    const instanceId = `TreeRoof_${groupId}`;
                    material = this.createRandomizedMaterial('TreeRoof', instanceId, {
                        folder: 'forest/tree', materialProperties: {
                            roughness: 1.0, metalness: 0.0, envMapIntensity: 0.05, ...options.materialProperties
                        }
                    });

                    textureInstances.set(groupId, material);
                }

                node.material = material;
                modifiedCount++;
            }
        });

        console.log(`Textures TreeRoof randomisées appliquées à ${modifiedCount} meshes dans ${textureInstances.size} groupes`);
        return modifiedCount;
    }

    mergeSimilarMaterials(modelObject) {
        if (!modelObject) return 0;

        const uniqueMaterials = new Map();
        let replacedCount = 0;

        modelObject.traverse((node) => {
            if (!node.isMesh || !node.material) return;

            const materials = Array.isArray(node.material) ? node.material : [node.material];

            for (let i = 0; i < materials.length; i++) {
                const material = materials[i];

                if (!material || material.userData?.isSpecial) continue;

                const signature = this._getMaterialSignature(material);

                if (uniqueMaterials.has(signature)) {
                    if (Array.isArray(node.material)) {
                        node.material[i] = uniqueMaterials.get(signature);
                        replacedCount++;
                    } else {
                        node.material = uniqueMaterials.get(signature);
                        replacedCount++;
                    }
                } else {
                    uniqueMaterials.set(signature, material);
                }
            }
        });

        this.stats.materialsMerged += replacedCount;
        console.log(`Fusion de matériaux: ${replacedCount} matériaux remplacés, ${uniqueMaterials.size} matériaux uniques conservés`);
        return replacedCount;
    }

    // Méthodes d'extraction et de génération d'assets
    extractBaseModelId(modelId) {
        const prefixes = ['Obstacle', 'Interactive'];
        const suffixes = ['Interactive', 'Instance'];

        let baseId = modelId;

        for (const prefix of prefixes) {
            if (baseId.startsWith(prefix)) {
                baseId = baseId.substring(prefix.length);
            } else if (baseId.includes(prefix)) {
                const regex = new RegExp(`${prefix}(\\w+)`, 'i');
                const match = baseId.match(regex);
                if (match && match[1]) {
                    baseId = match[1];
                }
            }
        }

        for (const suffix of suffixes) {
            if (baseId.endsWith(suffix)) {
                baseId = baseId.substring(0, baseId.length - suffix.length);
            }
        }

        const specialMappings = {
            'ObstacleTree': 'TrunkLarge', 'Obstacle2Tree': 'TrunkThin'
        };

        if (specialMappings[modelId]) {
            return specialMappings[modelId];
        }

        if (baseId !== modelId && this.hasTextures(baseId)) {
            return baseId;
        }

        return null;
    }

    // Générer la liste des assets nécessaires au format attendu par l'AssetManager
    generateTextureAssetList() {
        const assetSet = new Set();
        const assets = [];

        for (const [modelId, modelTextures] of Object.entries(this.texturePaths)) {
            for (const [textureType, texturePath] of Object.entries(modelTextures)) {
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

    /**
     * Préchargement intelligent des textures
     */
    async intelligentPreload(priorityModels = [], options = {}) {
        const config = {
            maxConcurrent: 5, timeoutPerTexture: 5000, preloadAllLODs: false, ...options
        };

        const modelsToPreload = [...priorityModels, ...Object.keys(this.texturePaths)
            .filter(id => !priorityModels.includes(id))
            .sort((a, b) => {
                const countA = this.instanceTracker[a]?.count || 0;
                const countB = this.instanceTracker[b]?.count || 0;
                return countB - countA;
            })];

        const totalTextures = modelsToPreload.length;
        let loadedCount = 0;

        const lodsToLoad = config.preloadAllLODs ? ['high', 'medium', 'low'] : [this.currentLOD];

        for (let i = 0; i < modelsToPreload.length; i += config.maxConcurrent) {
            const batch = modelsToPreload.slice(i, i + config.maxConcurrent);

            const batchPromises = batch.flatMap(modelId => {
                return lodsToLoad.map(lod => {
                    return Promise.race([this.preloadTexturesForModel(modelId).then(() => {
                        loadedCount++;
                        if (loadedCount % 10 === 0 || loadedCount === totalTextures) {
                            console.log(`Progrès: ${loadedCount}/${totalTextures} textures préchargées`);
                        }
                    }), new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout lors du chargement de ${modelId}`)), config.timeoutPerTexture))]).catch(err => {
                        console.warn(`Échec lors du préchargement de ${modelId}:`, err);
                    });
                });
            });

            await Promise.allSettled(batchPromises);
        }

        console.log(`Préchargement terminé: ${loadedCount}/${totalTextures} textures chargées avec succès`);
        return loadedCount;
    }

    /**
     * Fusionner des géométries - Implémentation personnalisée
     */
    mergeBufferGeometries(geometries, useGroups = true) {
        if (!geometries || geometries.length < 1) return null;

        const isIndexed = geometries[0].index !== null;
        const attributesUsed = new Set(Object.keys(geometries[0].attributes));
        const attributes = {};
        const mergedGeometry = new BufferGeometry();

        let offset = 0;

        for (let i = 0; i < geometries.length; ++i) {
            const geometry = geometries[i];

            if (isIndexed !== (geometry.index !== null)) {
                console.error('Toutes les géométries doivent avoir le même type d\'indexation');
                return null;
            }

            for (const name of attributesUsed) {
                if (!geometry.attributes[name]) {
                    console.error('Toutes les géométries doivent avoir les mêmes attributs');
                    return null;
                }
            }

            if (useGroups) {
                let count;

                if (isIndexed) {
                    count = geometry.index.count;
                } else {
                    count = geometry.attributes.position.count;
                }

                mergedGeometry.addGroup(offset, count, i);
                offset += count;
            }

            for (const name of attributesUsed) {
                if (attributes[name] === undefined) {
                    attributes[name] = [];
                }

                attributes[name].push(geometry.attributes[name]);
            }

            if (isIndexed) {
                if (attributes.index === undefined) {
                    attributes.index = [];
                }

                attributes.index.push(geometry.index);
            }
        }

        for (const name of attributesUsed) {
            const mergedAttribute = this.mergeBufferAttributes(attributes[name]);

            if (!mergedAttribute) {
                console.error('Impossible de fusionner les attributs');
                return null;
            }

            mergedGeometry.setAttribute(name, mergedAttribute);
        }

        if (isIndexed) {
            let indexOffset = 0;
            const mergedIndex = [];

            for (let i = 0; i < geometries.length; ++i) {
                const index = attributes.index[i];

                for (let j = 0; j < index.count; ++j) {
                    mergedIndex.push(index.getX(j) + indexOffset);
                }

                indexOffset += attributes[Object.keys(attributes)[0]][i].count;
            }

            mergedGeometry.setIndex(mergedIndex);
        }

        return mergedGeometry;
    }

    /**
     * Fusionner des attributs de géométrie
     */
    mergeBufferAttributes(attributes) {
        let arrayLength = 0;
        let itemSize = attributes[0].itemSize;

        for (let i = 0; i < attributes.length; i++) {
            arrayLength += attributes[i].array.length;

            if (attributes[i].itemSize !== itemSize) {
                console.error('Les attributs ont des tailles d\'éléments différentes');
                return null;
            }
        }

        const array = new attributes[0].array.constructor(arrayLength);
        let offset = 0;

        for (let i = 0; i < attributes.length; i++) {
            array.set(attributes[i].array, offset);
            offset += attributes[i].array.length;
        }

        return new BufferAttribute(array, itemSize);
    }

    /**
     * Fusion de modèles similaires pour optimiser le rendu
     */
    mergeModelInstances(modelId, options = {}) {
        const instances = this.instanceTracker[modelId];
        if (!instances || instances.count < 2) return null;

        const config = {
            maxDistance: this.optimizationConfig.instanceMergeDistance,
            maxMergedInstances: 10,
            preserveOriginals: false, ...options
        };

        const scene = window.scene || null;
        if (!scene) {
            console.warn("Impossible de fusionner sans accès à la scène");
            return null;
        }

        const instanceObjects = [];
        scene.traverse((node) => {
            if (node.name?.includes(modelId) && node.visible) {
                instanceObjects.push(node);
            }
        });

        if (instanceObjects.length < 2) {
            return null;
        }

        const groups = this.groupInstancesByDistance(instanceObjects, config.maxDistance);

        const mergedGroups = [];
        for (const group of groups) {
            if (group.length >= 2 && group.length <= config.maxMergedInstances) {
                const mergedModel = this.createMergedModel(group, modelId);
                if (mergedModel) {
                    scene.add(mergedModel);
                    mergedGroups.push(mergedModel);

                    if (!config.preserveOriginals) {
                        group.forEach(obj => {
                            scene.remove(obj);
                            obj.traverse(node => {
                                if (node.geometry) node.geometry.dispose();
                                if (node.material) {
                                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                                    materials.forEach(mat => {
                                        if (!this.materialPool[mat.uuid]) {
                                            mat.dispose();
                                        }
                                    });
                                }
                            });
                        });
                    }
                }
            }
        }

        console.log(`${mergedGroups.length} groupes de ${modelId} fusionnés avec succès`);
        return mergedGroups;
    }

    /**
     * Regrouper les instances par distance
     */
    groupInstancesByDistance(objects, maxDistance) {
        const groups = [];
        const processed = new Set();

        for (const obj of objects) {
            if (processed.has(obj.uuid)) continue;

            const group = [obj];
            processed.add(obj.uuid);

            for (const other of objects) {
                if (other !== obj && !processed.has(other.uuid) && obj.position.distanceTo(other.position) <= maxDistance) {
                    group.push(other);
                    processed.add(other.uuid);
                }
            }

            if (group.length > 1) {
                groups.push(group);
            }
        }

        return groups;
    }

    /**
     * Créer un modèle fusionné à partir d'un groupe d'instances
     */
    createMergedModel(instances, modelId) {
        if (!instances || instances.length === 0) return null;

        const mergedGroup = new Group();
        mergedGroup.name = `Merged_${modelId}_${instances.length}`;

        const center = new Vector3();
        instances.forEach(obj => center.add(obj.position));
        center.divideScalar(instances.length);

        mergedGroup.position.copy(center);

        const meshes = {};

        instances.forEach(instance => {
            const relativePosition = instance.position.clone().sub(center);

            instance.traverse(node => {
                if (node.isMesh) {
                    const materialId = node.material.uuid;

                    if (!meshes[materialId]) {
                        meshes[materialId] = {
                            material: node.material, geometries: []
                        };
                    }

                    const clonedGeometry = node.geometry.clone();
                    const matrix = new Matrix4();

                    matrix.makeTranslation(relativePosition.x, relativePosition.y, relativePosition.z);

                    if (instance.rotation) {
                        const rotMatrix = new Matrix4();
                        rotMatrix.makeRotationFromEuler(instance.rotation);
                        matrix.multiply(rotMatrix);
                    }

                    if (instance.scale) {
                        const scaleMatrix = new Matrix4();
                        scaleMatrix.makeScale(instance.scale.x, instance.scale.y, instance.scale.z);
                        matrix.multiply(scaleMatrix);
                    }

                    clonedGeometry.applyMatrix4(matrix);
                    meshes[materialId].geometries.push(clonedGeometry);
                }
            });
        });

        Object.values(meshes).forEach(({material, geometries}) => {
            if (geometries.length === 0) return;

            const mergedGeometry = this.mergeBufferGeometries(geometries, false);

            const mergedMaterial = this.getMaterial(modelId, {
                useGroupMaterial: true, lod: this.determineLODForObject(instances[0])
            });

            const mergedMesh = new Mesh(mergedGeometry, mergedMaterial);
            mergedMesh.name = `MergedMesh_${modelId}`;
            mergedMesh.castShadow = true;
            mergedMesh.receiveShadow = true;

            mergedGroup.add(mergedMesh);

            geometries.forEach(geo => geo.dispose());
        });

        this.stats.instancesMerged += instances.length;

        return mergedGroup;
    }

    // Nettoyer les ressources
    dispose() {
        console.log("Nettoyage des ressources du TextureManager...");

        for (const texturePath in this.loadedTextures) {
            if (this.loadedTextures[texturePath]) {
                this.loadedTextures[texturePath].dispose();
            }
        }
        this.loadedTextures = {};

        for (const key in this.materialPool) {
            if (this.materialPool[key]) {
                this.materialPool[key].dispose();
            }
        }
        this.materialPool = {};

        this.instanceTracker = {};
        this.stats = {
            texturesLoaded: 0,
            materialsCreated: 0,
            materialsMerged: 0,
            instancesMerged: 0,
            memoryUsage: 0,
            lastOptimization: null
        };

        console.log("Ressources du TextureManager nettoyées");
    }
}

// Export d'une instance singleton
export const textureManager = new TextureManager();
export default textureManager;