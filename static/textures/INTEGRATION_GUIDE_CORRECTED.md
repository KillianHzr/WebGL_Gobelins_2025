# Guide d'intégration corrigé - Textures ORM par modèle individuel

## 🔧 Correction majeure appliquée

### Problème identifié
- **Avant**: Tous les fichiers sans suffixes reconnus étaient regroupés dans un modèle générique "0"
- **Résultat**: Une seule texture ORM massive pour tout le dossier
- **Problème**: Impossible d'appliquer des textures spécifiques par modèle

### Solution implémentée
- **Maintenant**: Chaque basename unique génère sa propre texture ORM
- **Résultat**: `BigRock_ORM.png`, `RockWater_ORM.png`, `TreeNaked_ORM.png`, etc.
- **Avantage**: Correspondance 1:1 entre modèle et texture ORM
- **Compatibilité**: 100% compatible Bash 3.x (macOS par défaut)

## Structure des fichiers avec arborescence préservée

```
textures/                           # Dossier source
├── forest/
│   ├── trees/
│   │   ├── BigRock_BaseColor.png
│   │   ├── BigRock_Roughness.png
│   │   └── BigRock_Metallic.png
│   └── water/
│       ├── RockWater_BaseColor.png
│       └── RockWater_Normal.png
├── digital/
│   ├── neon/
│   └── metal/
└── primary/
    └── basic/

textures_optimized/                 # 🎯 ARBORESCENCE IDENTIQUE
├── desktop/
│   ├── forest/
│   │   ├── trees/
│   │   │   ├── BigRock_BaseColor.webp
│   │   │   ├── BigRock_Normal.png
│   │   │   └── BigRock_ORM.png      # 🆕 ORM spécifique
│   │   └── water/
│   │       ├── RockWater_BaseColor.webp
│   │       ├── RockWater_Normal.png
│   │       └── RockWater_ORM.png    # 🆕 ORM spécifique
│   ├── digital/
│   │   ├── neon/
│   │   └── metal/
│   └── primary/
│       └── basic/
└── mobile/ (structure identique, tailles réduites)
```

## Modifications pour votre TextureManager

### 1. Méthode addTextureMapping corrigée

```javascript
// Version corrigée avec mapping 1:1 modèle/ORM
async addTextureMapping(modelId, folder, filePrefix = null, materialProperties = null) {
    const prefix = filePrefix || modelId;
    const platform = this.detectPlatform();
    const basePath = `/textures_optimized/${platform}/${folder}`;

    // Initialiser les chemins de base
    this.texturePaths[modelId] = {
        baseColor: `${basePath}/${prefix}_BaseColor.webp`,
        normal: `${basePath}/${prefix}_Normal.png`,
        normalOpenGL: `${basePath}/${prefix}_NormalOpenGL.png`,
        height: `${basePath}/${prefix}_Height.png`
    };

    // 🔧 CORRECTION: Chercher l'ORM spécifique au modèle
    const ormPath = `${basePath}/${prefix}_ORM.png`;
    const hasORM = await this.checkIfFileExists(ormPath);

    if (hasORM) {
        // Utiliser l'ORM spécifique au modèle
        this.texturePaths[modelId].orm = ormPath;
        this.texturePaths[modelId].useORM = true;
        console.log(`✅ ORM spécifique trouvée pour ${modelId}: ${ormPath}`);
    } else {
        // Fallback sur les textures individuelles
        this.texturePaths[modelId].roughness = `${basePath}/${prefix}_Roughness.png`;
        this.texturePaths[modelId].metalness = `${basePath}/${prefix}_Metallic.png`;
        this.texturePaths[modelId].ao = `${basePath}/${prefix}_AO.png`;
        this.texturePaths[modelId].useORM = false;
        console.log(`⚠️ Pas d'ORM pour ${modelId}, utilisation des textures individuelles`);
    }

    // Stocker les propriétés du matériau
    if (materialProperties) {
        this.materialProperties[modelId] = materialProperties;
    }
}
```

Cette correction garantit que chaque modèle 3D aura ses propres propriétés matériaux via une texture ORM dédiée, permettant un contrôle précis et une optimisation maximale du rendu.
