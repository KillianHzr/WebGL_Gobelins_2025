/**
 * Configuration pour contrôler la visibilité des dossiers dans l'interface GUI de debugging
 * Ce fichier permet de définir quels dossiers sont affichés ou cachés dans l'interface
 */

const guiFolderConfig = {
    // Configuration principale pour l'affichage des dossiers
    foldersVisibility: {
        "Terrain Path": true,
        "Visualisation": true,    // Contrôles de visualisation générale
        "Camera": true,           // Contrôles de caméra
        "Render": true,           // Nouveaux contrôles de rendu
        "Controls": true,         // Contrôles de navigation
        "Scene": true,            // Contrôles de scène
        "Renderer": true,         // Contrôles du renderer
        "Materials": true,        // Contrôles des matériaux
        "Lights": true,           // Contrôles des lumières
        "Effects": true,          // Contrôles des effets
        "Objects": true,          // Contrôles des objets
        "Audio": true,            // Contrôles audio
        "Interfaces": true,       // Contrôles des interfaces
        "Utils": true,            // Utilitaires (import/export)
        "Flashlight": true,      // Contrôles de la lampe torche

        // Sous-dossiers (format "parent/enfant")
        "Controls/Auto Rotation": true,
        "Controls/Limits": true,
        "Camera/Position": true,
        "Camera/Rotation": true,
        "Camera/Settings": true,
        "Camera/Render": true,     // Sous-dossier pour les paramètres de rendu de la caméra
        "Render/Tone Mapping": true, // Nouveau sous-dossier pour le tone mapping
        "Render/Shadows": true,    // Nouveau sous-dossier pour les ombres
        "Renderer/Shadow Map": true, // Nouveau sous-dossier pour les paramètres de shadow map
        "Lights/Position": true,
        "Lights/Shadows": true,
        "Materials/Defaults": false,  // Cacher les paramètres par défaut des matériaux
        "Objects/Cube": true,
        "Objects/Cube/Material": true,
        "Objects/Cube/Animation": true,
        "Audio/Ambiance": true,
        "Audio/Narration": true,
        "Effects/Glow Effect": true
    },

    // Configuration des contraintes d'affichage (dépendances entre dossiers)
    folderDependencies: {
        // Si un dossier parent est caché, ses enfants le seront automatiquement
        enforceParentDependency: true,

        // Dépendances spécifiques (si dossierA est caché, alors dossierB sera aussi caché)
        specific: {
            "Scene": ["Scene/Fog"],              // Si Scene est caché, Scene/Fog le sera aussi
            "Camera": ["Camera/Position", "Camera/Rotation", "Camera/Settings", "Camera/Render"], // Si Camera est caché, ses sous-dossiers le seront aussi
            "Render": ["Render/Tone Mapping", "Render/Shadows"], // Si Render est caché, ses sous-dossiers le seront aussi
            "Renderer": ["Renderer/Shadow Map"], // Si Renderer est caché, Renderer/Shadow Map le sera aussi
            "Lights": ["Lights/Position", "Lights/Shadows"], // Si Lights est caché, ses sous-dossiers le seront aussi
            "Effects": ["Effects/Glow Effect"]   // Si Effects est caché, Effects/Glow Effect le sera aussi
        }
    },

    // Configuration des profils prédéfinis pour différents contextes d'utilisation
    profiles: {
        "minimal": {
            // Profil minimal pour une interface épurée
            "Theatre.js": true,
            "Visualisation": true,
            "Interface": true,
            "Camera": false,
            "Render": false,
            "Controls": false,
            "Scene": false,
            "Renderer": false,
            "Materials": false,
            "Lights": false,
            "Effects": false,
            "Objects": false,
            "Audio": true,
            "Interfaces": true,
            "Utils": true
        },
        "artist": {
            "Visualisation": false,
            "Interface": true,
            "Camera": true,
            "Render": true,
            "Controls": false,
            "Scene": false,
            "Renderer": true,     // Les artistes ont souvent besoin des contrôles de rendu pour le visuel
            "Materials": true,
            "Lights": true,
            "Effects": false,
            "Objects": false,
            "Audio": false,
            "Interfaces": false,
            "Utils": false,
            "Flashlight": true,      // Contrôles de la lampe torche

        },
        "empty": {
            "Theatre.js": false,
            "Visualisation": false,
            "Interface": false,
            "Camera": false,
            "Render": false,
            "Controls": false,
            "Scene": false,
            "Renderer": false,     // Les artistes ont souvent besoin des contrôles de rendu pour le visuel
            "Materials": false,
            "Lights": false,
            "Effects": false,
            "Objects": false,
            "Audio": false,
            "Interfaces": false,
            "Utils": false,
            "Flashlight": false,
        },
        "developer": {
            "Visualisation": true,
            "Interface": true,
            "Camera": true,
            "Render": true,
            "Controls": true,
            "Scene": true,
            "Renderer": true,
            "Materials": true,
            "Lights": true,
            "Effects": true,
            "Objects": true,
            "Audio": true,
            "Interfaces": true,
            "Utils": true,
            "Flashlight": true,      // Contrôles de la lampe torche

        },
        "performance": {
            // Profil pour tester les performances
            "Theatre.js": false,
            "Visualisation": true,
            "Interface": true,
            "Camera": false,
            "Render": true,
            "Controls": false,
            "Scene": true,
            "Renderer": true,
            "Materials": false,
            "Lights": true,
            "Effects": true,
            "Objects": false,
            "Audio": false,
            "Interfaces": false,
            "Utils": true
        }
    },

    // Configuration de l'accès rapide (raccourcis pour afficher/cacher des groupes de dossiers)
    quickAccess: {
        "rendering": ["Scene", "Renderer", "Lights", "Effects", "Render", "Camera/Render", "Renderer/Shadow Map", "Render/Tone Mapping", "Render/Shadows"],
        "interaction": ["Controls", "Interfaces"],
        "content": ["Objects", "Materials"],
        "audio": ["Audio"]
    }
};

export default guiFolderConfig;