/**
 * Configuration avancée pour les contrôles de lumière dans l'interface de debug
 * Ce fichier étend la configuration des lumières pour permettre un contrôle plus précis
 * des paramètres jour/nuit et des transitions
 */

// Importer la configuration de base des lumières depuis Lights.jsx
import { LightConfig } from '../Core/Lights.jsx';

const LightDebugConfig = {
    folder: "Lights",

    // Contrôles généraux pour les modes jour/nuit
    general: {
        nightMode: {
            name: "Mode Nuit",
            default: false
        },
        transitionPreview: {
            name: "Position de transition",
            min: 0,
            max: 1,
            step: 0.01,
            default: 0
        },
        transitionSpeed: {
            name: "Vitesse de transition",
            min: 0.01,
            max: 0.2,
            step: 0.01,
            default: 0.05
        }
    },

    // Configuration du mode jour
    dayMode: {
        folder: "Mode Jour",
        ambientLight: {
            intensity: {
                name: "Intensité ambiante",
                min: 0,
                max: 2,
                step: 0.05,
                default: LightConfig.modes.day.ambientIntensity
            },
            color: {
                name: "Couleur ambiante",
                default: LightConfig.modes.day.ambientColor
            }
        },
        mainLight: {
            intensity: {
                name: "Intensité principale",
                min: 0,
                max: 20000,
                step: 100,
                default: LightConfig.modes.day.mainLight.intensity
            },
            color: {
                name: "Couleur principale",
                default: LightConfig.modes.day.mainLight.color
            },
            position: {
                x: {
                    name: "Position X",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: LightConfig.modes.day.mainLight.position[0]
                },
                y: {
                    name: "Position Y",
                    min: 0,
                    max: 100,
                    step: 0.1,
                    default: LightConfig.modes.day.mainLight.position[1]
                },
                z: {
                    name: "Position Z",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: LightConfig.modes.day.mainLight.position[2]
                }
            },
            shadows: {
                folder: "Ombres",
                mapSize: {
                    name: "Résolution",
                    options: {
                        '512x512': 512,
                        '1024x1024': 1024,
                        '2048x2048': 2048,
                        '4096x4096': 4096
                    },
                    default: LightConfig.modes.day.mainLight.shadowMapSize
                },
                bias: {
                    name: "Bias",
                    min: -0.01,
                    max: 0.01,
                    step: 0.0001,
                    default: LightConfig.modes.day.mainLight.shadowBias
                }
            }
        }
    },

    // Configuration du mode nuit
    nightMode: {
        folder: "Mode Nuit",
        ambientLight: {
            intensity: {
                name: "Intensité ambiante",
                min: 0,
                max: 1,
                step: 0.01,
                default: LightConfig.modes.night.ambientIntensity
            },
            color: {
                name: "Couleur ambiante",
                default: LightConfig.modes.night.ambientColor
            }
        },
        mainLight: {
            intensity: {
                name: "Intensité principale",
                min: 0,
                max: 20000,
                step: 100,
                default: LightConfig.modes.night.mainLight.intensity
            },
            color: {
                name: "Couleur principale",
                default: LightConfig.modes.night.mainLight.color
            },
            position: {
                x: {
                    name: "Position X",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: LightConfig.modes.night.mainLight.position[0]
                },
                y: {
                    name: "Position Y",
                    min: 0,
                    max: 100,
                    step: 0.1,
                    default: LightConfig.modes.night.mainLight.position[1]
                },
                z: {
                    name: "Position Z",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: LightConfig.modes.night.mainLight.position[2]
                }
            },
            shadows: {
                folder: "Ombres",
                mapSize: {
                    name: "Résolution",
                    options: {
                        '512x512': 512,
                        '1024x1024': 1024,
                        '2048x2048': 2048,
                        '4096x4096': 4096
                    },
                    default: LightConfig.modes.night.mainLight.shadowMapSize
                },
                bias: {
                    name: "Bias",
                    min: -0.01,
                    max: 0.01,
                    step: 0.0001,
                    default: LightConfig.modes.night.mainLight.shadowBias
                }
            }
        },
        moonLight: {
            folder: "Lumière lunaire",
            enabled: {
                name: "Activée",
                default: true
            },
            intensity: {
                name: "Intensité",
                min: 0,
                max: 5000,
                step: 50,
                default: 2000
            },
            color: {
                name: "Couleur",
                default: "#8eabff"
            },
            position: {
                x: {
                    name: "Position X",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: 20
                },
                y: {
                    name: "Position Y",
                    min: 0,
                    max: 100,
                    step: 0.1,
                    default: 40
                },
                z: {
                    name: "Position Z",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: 10
                }
            }
        },
        secondaryLight: {
            folder: "Lumière secondaire",
            enabled: {
                name: "Activée",
                default: true
            },
            intensity: {
                name: "Intensité",
                min: 0,
                max: 1000,
                step: 10,
                default: 500
            },
            color: {
                name: "Couleur",
                default: "#4287f5"
            },
            position: {
                x: {
                    name: "Position X",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: -30
                },
                y: {
                    name: "Position Y",
                    min: 0,
                    max: 50,
                    step: 0.1,
                    default: 5
                },
                z: {
                    name: "Position Z",
                    min: -100,
                    max: 100,
                    step: 0.1,
                    default: -20
                }
            }
        }
    },

    // Configuration des transitions
    transitions: {
        folder: "Transitions",
        thresholds: {
            startDayToTransition1: {
                name: "Début jour → crépuscule",
                min: 0,
                max: 0.3,
                step: 0.01,
                default: LightConfig.transitionThresholds.startDayToTransition1
            },
            startTransition1ToTransition2: {
                name: "Début crépuscule → dusk",
                min: 0.2,
                max: 0.5,
                step: 0.01,
                default: LightConfig.transitionThresholds.startTransition1ToTransition2
            },
            startTransition2ToNight: {
                name: "Début dusk → nuit",
                min: 0.4,
                max: 0.7,
                step: 0.01,
                default: LightConfig.transitionThresholds.startTransition2ToNight
            },
            completeNight: {
                name: "Nuit complète",
                min: 0.6,
                max: 1,
                step: 0.01,
                default: LightConfig.transitionThresholds.completeNight
            }
        },
        presets: {
            name: "Préréglages",
            options: {
                "Défaut": "default",
                "Transition rapide": "fast",
                "Transition lente": "slow",
                "Coucher de soleil prolongé": "longSunset",
                "Nuit précoce": "earlyNight"
            },
            default: "default"
        }
    }
};

export default LightDebugConfig;