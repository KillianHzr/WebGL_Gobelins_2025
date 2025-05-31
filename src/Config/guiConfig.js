/**
 * Configuration centralisée pour l'interface GUI de debugging
 * Ce fichier contient toutes les configurations pour les contrôles du GUI
 */
import {BasicShadowMap, PCFShadowMap, PCFSoftShadowMap, VSMShadowMap} from "three";

const guiConfig = {
    gui: {
        title: "Debug Controls",
        width: 300,
        closeFolders: true
    },
    interface: {
        folder: "Interface",
        skipIntro: {
            name: "Sauter Intro/Loading",
            default: true
        }
    },
    theatre: {
        folder: "Theatre.js",
        showUI: {
            name: "Afficher UI Theatre",
            default: true
        }
    },
    flashlight: {
        folder: 'Flashlight',
        // Contrôles principaux
        active: {
            name: "Activer",
            default: true
        },
        autoActivate: {
            name: "Activation automatique",
            default: true
        },
        activationThreshold: {
            name: "Seuil d'activation",
            default: 0.7,
            min: 0,
            max: 1,
            step: 0.05
        },
        // Paramètres lumière
        intensity: {
            default: 15,
            min: 0.1,
            max: 20.0,
            step: 0.1
        },
        color: {
            default: '#ffc547'
        },
        angle: {
            default: Math.PI / 6,
            min: Math.PI / 12,
            max: Math.PI / 2,
            step: 0.01
        },
        penumbra: {
            default: 0.66,
            min: 0,
            max: 1,
            step: 0.01
        },
        distance: {
            default: 4,
            min: 1,
            max: 50,
            step: 0.5
        },
        decay: {
            default: 1.0,
            min: 0,
            max: 2,
            step: 0.1
        },
        // Position relative à la caméra
        position: {
            folder: "Position",
            offsetX: {
                default: 0.0,
                min: -1.0,
                max: 1.0,
                step: 0.01,
                name: "Décalage X"
            },
            offsetY: {
                default: 0.0,
                min: -1.0,
                max: 1.0,
                step: 0.01,
                name: "Décalage Y"
            },
            offsetZ: {
                default: 0.0,
                min: -1.0,
                max: 1.0,
                step: 0.01,
                name: "Décalage Z"
            }
        },
        // Direction
        target: {
            folder: "Direction",
            offsetX: {
                default: 0.0,
                min: -3.0,
                max: 3.0,
                step: 0.1,
                name: "Direction X"
            },
            offsetY: {
                default: -0.75,
                min: -3.0,
                max: 3.0,
                step: 0.1,
                name: "Direction Y"
            },
            offsetZ: {
                default: -1.0,
                min: -3.0,
                max: 3.0,
                step: 0.1,
                name: "Direction Z"
            },
            distance: {
                default: 15.0,
                min: 1.0,
                max: 20.0,
                step: 0.5,
                name: "Distance cible"
            }
        },
        // Configuration des ombres
        shadows: {
            folder: "Shadows",
            enabled: {
                default: true
            },
            mapSize: {
                default: 512,
                options: [256, 512, 1024, 2048, 4096]
            },
            bias: {
                default: -0.01,
                min: -0.01,
                max: 0.01,
                step: 0.0001
            },
            normalBias: {
                default: 0,
                min: -0.05,
                max: 0.05,
                step: 0.001
            },
            optimizePerformance: {
                default: true,
                name: "Optimiser performances"
            }
        },
        // Animations et effets
        effects: {
            folder: "Effets",
            flicker: {
                enabled: {
                    default: false,
                    name: "Scintillement"
                },
                intensity: {
                    default: 0.1,
                    min: 0.01,
                    max: 0.5,
                    step: 0.01,
                    name: "Intensité scintillement"
                },
                speed: {
                    default: 2.0,
                    min: 0.1,
                    max: 10.0,
                    step: 0.1,
                    name: "Vitesse scintillement"
                }
            },
            battery: {
                enabled: {
                    default: false,
                    name: "Simulation batterie"
                },
                drainRate: {
                    default: 0.05,
                    min: 0.01,
                    max: 0.5,
                    step: 0.01,
                    name: "Taux d'épuisement"
                },
                minLevel: {
                    default: 0.2,
                    min: 0.0,
                    max: 0.5,
                    step: 0.01,
                    name: "Niveau minimum"
                }
            }
        }
    },
    // Ajouter cette section dans guiConfig.js
    chapters: {
        folder: "Chapitres",
        controls: {
            currentChapter: {
                name: "Chapitre actuel",
                default: 0,
                options: {
                    "Introduction": 0,
                    "Forêt mystérieuse": 1,
                    "Découverte": 2,
                    "Créatures": 3,
                    "Conclusion": 4
                }
            },
            autoProgress: {
                name: "Progression auto",
                default: true
            },
        }
    },
    // Nouvelle section pour les contrôles de visualisation générale
    visualization: {
        folder: "Visualisation",
        wireframe: {
            name: "Mode Wireframe",
            default: false
        },
        showInstances: {
            name: "Afficher Instances",
            default: true
        },
        showInteractive: {
            name: "Afficher Interactifs",
            default: true
        },
        showStatic: {
            name: "Afficher Statiques",
            default: true
        },
    },
    camera: {
        // Configuration caméra existante...
        folder: "Camera",
        position: {
            x: {
                min: -20,
                max: 20,
                step: 0.1,
                name: "Position X",
                default: 0
            },
            y: {
                min: -20,
                max: 20,
                step: 0.1,
                name: "Position Y",
                default: 0
            },
            z: {
                min: -20,
                max: 20,
                step: 0.1,
                name: "Position Z",
                default: 5
            }
        },
        rotation: {
            x: {
                min: -Math.PI,
                max: Math.PI,
                step: 0.01,
                name: "Rotation X",
                default: 0
            },
            y: {
                min: -Math.PI,
                max: Math.PI,
                step: 0.01,
                name: "Rotation Y",
                default: 0
            },
            z: {
                min: -Math.PI,
                max: Math.PI,
                step: 0.01,
                name: "Rotation Z",
                default: 0
            }
        },
        settings: {
            fov: {
                min: 10,
                max: 150,
                step: 1,
                name: "FOV",
                default: 30
            },
            near: {
                min: 0.01,
                max: 10,
                step: 0.01,
                name: "Near",
                default: 0.1
            },
            far: {
                min: 10,
                max: 1000,
                step: 1,
                name: "Far",
                default: 50
            }
        },
        // Nouvelle section pour les paramètres de rendu de la caméra
        render: {
            toneMapping: {
                options: {
                    None: 0,
                    Linear: 1,
                    Reinhard: 2,
                    Cineon: 3,
                    ACESFilmic: 4
                },
                default: 4,
                name: "Tone Mapping"
            },
            toneMappingExposure: {
                min: 0,
                max: 5,
                step: 0.01,
                name: "Exposure",
                default: 0.36
            }
        }
    },
    controls: {
        folder: "Controls",
        basic: {
            enableDamping: {
                name: "Damping",
                default: true
            },
            dampingFactor: {
                min: 0,
                max: 1,
                step: 0.01,
                name: "Damping Factor",
                default: 0.05
            },
            enableZoom: {
                name: "Allow Zoom",
                default: true
            },
            zoomSpeed: {
                min: 0.1,
                max: 5,
                step: 0.1,
                name: "Zoom Speed",
                default: 1.0
            },
            enableRotate: {
                name: "Allow Rotate",
                default: true
            },
            rotateSpeed: {
                min: 0.1,
                max: 5,
                step: 0.1,
                name: "Rotate Speed",
                default: 1.0
            },
            enablePan: {
                name: "Allow Pan",
                default: true
            },
            panSpeed: {
                min: 0.1,
                max: 5,
                step: 0.1,
                name: "Pan Speed",
                default: 1.0
            }
        },
        autoRotation: {
            folder: "Auto Rotation",
            autoRotate: {
                name: "Enable",
                default: false
            },
            autoRotateSpeed: {
                min: -10,
                max: 10,
                step: 0.1,
                name: "Speed",
                default: 2.0
            }
        },
        limits: {
            folder: "Limits",
            minPolarAngle: {
                min: 0,
                max: Math.PI,
                step: 0.01,
                name: "Min Vertical",
                default: 0
            },
            maxPolarAngle: {
                min: 0,
                max: Math.PI,
                step: 0.01,
                name: "Max Vertical",
                default: Math.PI
            },
            minAzimuthAngle: {
                min: -Math.PI,
                max: Math.PI,
                step: 0.01,
                name: "Min Horizontal",
                default: -Infinity
            },
            maxAzimuthAngle: {
                min: -Math.PI,
                max: Math.PI,
                step: 0.01,
                name: "Max Horizontal",
                default: Infinity
            },
            minDistance: {
                min: 0,
                max: 20,
                step: 0.1,
                name: "Min Distance",
                default: 1
            },
            maxDistance: {
                min: 0,
                max: 1000,
                step: 1,
                name: "Max Distance",
                default: 20
            }
        }
    },
    scene: {
        folder: "Scene",

        fog: {
            enabled: {
                name: "Fog",
                default: true
            },
            color: {
                color: "#ffffff",
                name: "Fog Color",
                default: "#1E6B31"
            },
            near: {
                min: 0,
                max: 100,
                step: 0.1,
                name: "Fog Near",
                default: 200
            },
            far: {
                min: 0,
                max: 100,
                step: 0.1,
                name: "Fog Far",
                default: 100
            },
            transition: {
                folder: "Fog Transition",
                startPoint: {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    name: "Start Point",
                    default: 0.0
                },
                endPoint: {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    name: "End Point",
                    default: 0.5
                },
                initialNear: {
                    min: 20,
                    max: 200,
                    step: 1,
                    name: "Initial Near",
                    default: 33
                },
                initialFar: {
                    min: 30,
                    max: 250,
                    step: 1,
                    name: "Initial Far",
                    default: 50
                }
            }
        }
    },
    renderer: {
        folder: "Renderer",
        shadowMap: {
            enabled: {
                name: "Enable Shadows",
                default: true
            },
            type: {
                options: {
                    Basic: BasicShadowMap,
                    PCF: PCFShadowMap,
                    PCFSoft: PCFSoftShadowMap,
                    VSM: VSMShadowMap
                },
                default: PCFShadowMap,
                name: "Shadow Type"
            },
            mapSize: {
                name: "Shadow Quality",
                options: {
                    '256x256': 256,
                    '512x512': 512,
                    '1024x1024': 1024,
                    '2048x2048': 2048,
                    '4096x4096': 4096,
                    '8192x8192': 8192,
                    '16384x16384': 16384
                },
                default: 1024
            },
            bias: {
                name: "Shadow Bias",
                min: -0.1,
                max: 0.1,
                step: 0.0001,
                default: 0.0025
            },
            normalBias: {
                name: "Normal Bias",
                min: -1.0,
                max: 1.0,
                step: 0.001,
                default: 0.0812
            }
        },
        toneMapping: {
            options: {
                None: 0,
                Linear: 1,
                Reinhard: 2,
                Cineon: 3,
                ACESFilmic: 4
            },
            default: 2,
            name: "Tone Mapping"
        },
        toneMappingExposure: {
            min: 0,
            max: 5,
            step: 0.01,
            name: "Exposure",
            default: 2.36
        }
    },
    materials: {
        folder: "Materials",
        common: {
            color: {
                name: "Color",
                default: "#ffffff"
            },
            roughness: {
                min: 0,
                max: 1,
                step: 0.01,
                name: "Roughness",
                default: 0.5
            },
            metalness: {
                min: 0,
                max: 1,
                step: 0.01,
                name: "Metalness",
                default: 0.1
            },
            emissive: {
                name: "Emissive",
                default: "#000000"
            },
            emissiveIntensity: {
                min: 0,
                max: 2,
                step: 0.01,
                name: "Emissive Intensity",
                default: 0
            },
            transparent: {
                name: "Transparent",
                default: false
            },
            opacity: {
                min: 0,
                max: 1,
                step: 0.01,
                name: "Opacity",
                default: 1.0
            },
            wireframe: {
                name: "Wireframe",
                default: false
            }
        },
        // Les couleurs par défaut pour les différents groupes
        defaults: {
            Tree: {
                color: "#4d8a53",
                roughness: 0.8,
                metalness: 0.1
            },
            Bush: {
                color: "#3a7d3a",
                roughness: 0.7,
                metalness: 0.05
            },
            Flower: {
                color: "#cc99ff",
                roughness: 0.6,
                metalness: 0.0,
                emissiveIntensity: 0.1
            },
            Mushroom: {
                color: "#d9c7b8",
                roughness: 0.5,
                metalness: 0.0
            },
            Rock: {
                color: "#8a8a8a",
                roughness: 0.9,
                metalness: 0.2
            },
            Ground: {
                color: "#6d5e45",
                roughness: 0.9,
                metalness: 0.05
            },
            Water: {
                color: "#4d80b3",
                roughness: 0.2,
                metalness: 0.1,
                transparent: true,
                opacity: 0.8
            }
        }
    },
    lights: {
        folder: "Lights",
        nightMode: {
            name: "Night Mode",
            default: false
        },
        dayLight: {
            position: [53.764, 31.716, -56.134],
            intensity: 13000,
            color: "#9A8579"
        },
        nightLight: {
            position: [171.443, 32.282, -81.040],
            intensity: 41740,
            color: "#B4B5FF"
        },
        common: {
            visible: {
                name: "Enabled",
                default: true
            },
            intensity: {
                min: 0,
                max: 10,
                step: 0.01,
                name: "Intensity",
                default: 2.0
            },
            color: {
                name: "Color",
                default: "#ffffff"
            }
        },
        position: {
            folder: "Position",
            x: {
                min: -200,
                max: 200,
                step: 0.1,
                name: "X",
                default: 0
            },
            y: {
                min: -200,
                max: 200,
                step: 0.1,
                name: "Y",
                default: 5
            },
            z: {
                min: -200,
                max: 200,
                step: 0.1,
                name: "Z",
                default: 0
            }
        },
        shadows: {
            folder: "Shadows",
            castShadow: {
                name: "Cast Shadows",
                default: true
            },
            bias: {
                min: -0.01,
                max: 0.01,
                step: 0.0001,
                name: "Bias",
                default: 0
            },
            normalBias: {
                min: -0.1,
                max: 0.1,
                step: 0.001,
                name: "Normal Bias",
                default: 0
            },
            radius: {
                min: 0,
                max: 15,
                step: 0.1,
                name: "Blur",
                default: 1
            },
            mapSizes: {
                options: {
                    256: 256,
                    512: 512,
                    1024: 1024,
                    2048: 2048,
                    4096: 4096
                },
                default: 1024,
                name: "Resolution"
            }
        },
        spotLight: {
            angle: {
                min: 0,
                max: Math.PI / 2,
                step: 0.01,
                name: "Angle",
                default: Math.PI / 3
            },
            penumbra: {
                min: 0,
                max: 1,
                step: 0.01,
                name: "Softness",
                default: 0.5
            },
            decay: {
                min: 0,
                max: 2,
                step: 0.01,
                name: "Decay",
                default: 1
            }
        },
        pointLight: {
            decay: {
                min: 0,
                max: 2,
                step: 0.01,
                name: "Decay",
                default: 1
            },
            distance: {
                min: 0,
                max: 1000,
                step: 1,
                name: "Distance",
                default: 150
            }
        },
        rectAreaLight: {
            width: {
                min: 1,
                max: 20,
                step: 0.1,
                name: "Width",
                default: 5
            },
            height: {
                min: 1,
                max: 20,
                step: 0.1,
                name: "Height",
                default: 5
            }
        },
        defaults: {
            Ambient: {
                0: {
                    intensity: 1.0,
                    color: "#ffffff",
                    visible: true
                }
            },
            Directional: {
                0: {
                    intensity: 7.5,
                    color: "#FFE9C1",
                    visible: true,
                    castShadow: true,
                    position: {
                        x: -20,
                        y: 30,
                        z: 20
                    }
                }
            },
            Point: {
                0: { // Jour
                    intensity: 54351.413065,
                    color: "#FFEAC6",
                    visible: true,
                    castShadow: true,
                    position: {
                        x: 53.764,
                        y: 31.716,
                        z: -56.134
                    }
                },
                1: { // Nuit
                    intensity: 20870.28,
                    color: "#B4B5FF",
                    visible: false,
                    castShadow: true,
                    position: {
                        x: 171.443,
                        y: 32.282,
                        z: -81.040
                    }
                }
            }
        }
    },
    // Effets
    effects: {
        folder: "Effects",
        glow: {
            folder: "Glow Effect",
            active: {
                name: "Active",
                default: false
            },
            color: {
                color: "#ffffff",
                name: "Color",
                default: "#ffffff"
            },
            thickness: {
                min: 0.01,
                max: 0.1,
                step: 0.01,
                name: "Thickness",
                default: 0.03
            },
            intensity: {
                min: 1,
                max: 10,
                step: 0.1,
                name: "Intensity",
                default: 5
            },
            pulseSpeed: {
                min: 0,
                max: 5,
                step: 0.1,
                name: "Pulse Speed",
                default: 1.2
            }
        }
    },
    objects: {
        folder: "Objects",
        cube: {
            folder: "Cube",
            position: {
                x: {
                    min: -10,
                    max: 10,
                    step: 0.1,
                    name: "Position X",
                    default: 0
                },
                y: {
                    min: -10,
                    max: 10,
                    step: 0.1,
                    name: "Position Y",
                    default: 0
                },
                z: {
                    min: -10,
                    max: 10,
                    step: 0.1,
                    name: "Position Z",
                    default: 0
                }
            },
            rotation: {
                x: {
                    min: -Math.PI,
                    max: Math.PI,
                    step: 0.01,
                    name: "Rotation X",
                    default: 0
                },
                y: {
                    min: -Math.PI,
                    max: Math.PI,
                    step: 0.01,
                    name: "Rotation Y",
                    default: 0
                },
                z: {
                    min: -Math.PI,
                    max: Math.PI,
                    step: 0.01,
                    name: "Rotation Z",
                    default: 0
                }
            },
            scale: {
                x: {
                    min: 0.1,
                    max: 5,
                    step: 0.1,
                    name: "Scale X",
                    default: 1
                },
                y: {
                    min: 0.1,
                    max: 5,
                    step: 0.1,
                    name: "Scale Y",
                    default: 1
                },
                z: {
                    min: 0.1,
                    max: 5,
                    step: 0.1,
                    name: "Scale Z",
                    default: 1
                }
            },
            material: {
                folder: "Material",
                color: {
                    color: "#ff5533",
                    name: "Color",
                    default: "#ff5533"
                },
                wireframe: {
                    name: "Wireframe",
                    default: false
                },
                roughness: {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    name: "Roughness",
                    default: 0.5
                },
                metalness: {
                    min: 0,
                    max: 1,
                    step: 0.01,
                    name: "Metalness",
                    default: 0.1
                }
            },
            animation: {
                folder: "Animation",
                enabled: {
                    name: "Enabled",
                    default: true
                },
                speed: {
                    min: 0,
                    max: 5,
                    step: 0.1,
                    name: "Speed",
                    default: 0.5
                }
            }
        }
    }
};

export default guiConfig;