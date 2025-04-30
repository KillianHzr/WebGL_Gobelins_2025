/**
 * Configuration centralisée pour l'interface GUI de debugging
 * Ce fichier contient toutes les configurations pour les contrôles du GUI
 */

const guiConfig = {
    gui: {
        title: "Debug Controls",
        width: 300,
        closeFolders: true
    },
    theatre: {
        folder: "Theatre.js",
        showUI: {
            name: "Afficher UI Theatre",
            default: true
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
            default: false
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
                default: 61.9
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
                default: 100
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
        background: {
            color: "#000000",
            name: "Background",
            default: "#000000"
        },
        fog: {
            enabled: {
                name: "Fog",
                default: true
            },
            color: {
                color: "#1e356b",
                name: "Fog Color",
                default: "#1e356b"
            },
            near: {
                min: 0,
                max: 10,
                step: 0.1,
                name: "Fog Near",
                default: 0
            },
            far: {
                min: 0,
                max: 50,
                step: 0.1,
                name: "Fog Far",
                default: 20
            }
        }
    },
    renderer: {
        folder: "Renderer",
        shadowMap: {
            name: "Shadow Map",
            default: true
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
            intensity: 54351.413065,
            color: "#FFEAC6"
        },
        nightLight: {
            position: [171.443, 32.282, -81.040],
            intensity: 20870.28,
            color: "#B4B5FF"
        },
        common: {
            visible: {
                name: "Enabled",
                default: true
            },
            intensity: {
                min: 0,
                max: 100000,
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