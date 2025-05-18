import {useEffect, useRef, useState} from 'react';
import useStore from '../Store/useStore';
import {LightConfig} from '../Core/Lights';
import LightDebugConfig from './LightDebugConfig';
import {EventBus} from "../Utils/EventEmitter.jsx";

/**
 * Composant qui ajoute des contrôles de debug pour les lumières
 * Ce composant étend Lights.jsx avec des contrôles avancés pour l'interface de debug
 */
const LightDebugger = () => {
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
    const debugFolderRef = useRef(null);
    const guiInitializedRef = useRef(false);

    // État local pour la configuration des lumières
    const [lightSettings, setLightSettings] = useState({
        day: {...LightConfig.modes.day},
        night: {...LightConfig.modes.night},
        transition1: {...LightConfig.modes.transition1},
        transition2: {...LightConfig.modes.transition2},
        transitionThresholds: {...LightConfig.transitionThresholds},
        forcedNightMode: false,
        transitionPreview: 0
    });

    // État pour suivre si nous sommes en train de mettre à jour la configuration
    const isUpdatingRef = useRef(false);

    // Fonction pour mettre à jour la configuration des lumières et émettre l'événement
    const updateLightConfig = (newSettings) => {
        // Éviter les mises à jour en cascade
        if (isUpdatingRef.current) return;

        isUpdatingRef.current = true;

        setLightSettings(prev => {
            const updated = {...prev, ...newSettings};
            // L'événement sera émis dans un useEffect séparé
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 50); // Petite attente pour éviter les mises à jour simultanées
            return updated;
        });
    };

    // Gérer spécifiquement les lumières du jour
    const updateDayParam = (update) => {
        // Création d'un objet de mise à jour complet pour éviter les mises à jour partielles
        const newSettings = {
            day: {...lightSettings.day, ...update},
            forcedNightMode: false // Forcer explicitement le mode jour
        };

        // Mettre à jour la configuration globale
        updateLightConfig(newSettings);

        // Émettre un événement spécifique pour l'ambiance du jour
        if (update.ambientIntensity !== undefined || update.ambientColor !== undefined) {
            EventBus.trigger('day-ambient-update', {
                ambientIntensity: update.ambientIntensity !== undefined ? update.ambientIntensity : lightSettings.day.ambientIntensity,
                ambientColor: update.ambientColor !== undefined ? update.ambientColor : lightSettings.day.ambientColor,
                forceDay: true // Indique explicitement qu'il s'agit d'une mise à jour du jour
            });
        }
    };

    // Gérer spécifiquement les lumières de nuit
    const updateNightParam = (update) => {
        // Création d'un objet de mise à jour complet
        const newSettings = {
            night: {...lightSettings.night, ...update},
            forcedNightMode: true // Forcer explicitement le mode nuit
        };

        // Mettre à jour la configuration globale
        updateLightConfig(newSettings);

        // Émettre un événement spécifique pour l'ambiance de nuit
        if (update.ambientIntensity !== undefined || update.ambientColor !== undefined) {
            EventBus.trigger('night-ambient-update', {
                ambientIntensity: update.ambientIntensity !== undefined ? update.ambientIntensity : lightSettings.night.ambientIntensity,
                ambientColor: update.ambientColor !== undefined ? update.ambientColor : lightSettings.night.ambientColor,
                forceNight: true // Indique explicitement qu'il s'agit d'une mise à jour de nuit
            });
        }
    };

    // Aide pour mettre à jour les positions (qui sont des tableaux)
    const updateDayPosition = (index, value) => {
        const newPosition = [...lightSettings.day.mainLight.position];
        newPosition[index] = value;
        const newMainLight = {...lightSettings.day.mainLight, position: newPosition};
        updateLightConfig({day: {...lightSettings.day, mainLight: newMainLight}, forcedNightMode: false});
    };

    const updateNightPosition = (index, value) => {
        const newPosition = [...lightSettings.night.mainLight.position];
        newPosition[index] = value;
        const newMainLight = {...lightSettings.night.mainLight, position: newPosition};
        updateLightConfig({night: {...lightSettings.night, mainLight: newMainLight}, forcedNightMode: true});
    };

    // Fonction pour mettre à jour la lumière secondaire
    const updateSecondaryLight = (lightType, property, value) => {
        const updatedLight = {...secondaryLightsRef.current[lightType]};
        const keys = property.split('.');

        // Parcourir les clés pour mettre à jour la valeur
        let current = updatedLight;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;

        // Mettre à jour l'état local
        secondaryLightsRef.current[lightType] = updatedLight;

        // Émettre l'événement de mise à jour
        EventBus.trigger('secondary-light-update', {type: lightType, settings: updatedLight});
    }

    // Fonction pour initialiser le GUI de debug
    const initializeDebugGUI = () => {
        if (!gui || !debug || guiInitializedRef.current) return;

        // Créer le dossier principal pour les lumières
        const lightsFolder = gui.addFolder(LightDebugConfig.folder);
        debugFolderRef.current = lightsFolder;

        // Ajouter le toggle jour/nuit
        lightsFolder.add(lightSettings, 'forcedNightMode')
            .name(LightDebugConfig.general.nightMode.name)
            .onChange(value => {
                updateLightConfig({forcedNightMode: value});
                // Les événements seront émis via useEffect sur le changement de lightSettings
            });

        // --- Configuration du Mode Jour ---
        const dayFolder = lightsFolder.addFolder(LightDebugConfig.dayMode.folder);
        dayFolder.close();
        // Lumière ambiante (jour)
        const dayAmbientFolder = dayFolder.addFolder("Lumière Ambiante");
        dayAmbientFolder.add(lightSettings.day, 'ambientIntensity', LightDebugConfig.dayMode.ambientLight.intensity.min, LightDebugConfig.dayMode.ambientLight.intensity.max, LightDebugConfig.dayMode.ambientLight.intensity.step)
            .name(LightDebugConfig.dayMode.ambientLight.intensity.name)
            .onChange(value => {
                updateDayParam({ambientIntensity: value});
            });

        dayAmbientFolder.addColor({color: lightSettings.day.ambientColor}, 'color')
            .name(LightDebugConfig.dayMode.ambientLight.color.name)
            .onChange(value => {
                updateDayParam({ambientColor: value});
            });

        // Lumière principale (jour)
        const dayMainLightFolder = dayFolder.addFolder("Lumière Principale");
        dayMainLightFolder.add(lightSettings.day.mainLight, 'intensity', LightDebugConfig.dayMode.mainLight.intensity.min, LightDebugConfig.dayMode.mainLight.intensity.max, LightDebugConfig.dayMode.mainLight.intensity.step)
            .name(LightDebugConfig.dayMode.mainLight.intensity.name)
            .onChange(value => {
                const newMainLight = {...lightSettings.day.mainLight, intensity: value};
                updateDayParam({mainLight: newMainLight});
            });

        dayMainLightFolder.addColor({color: lightSettings.day.mainLight.color}, 'color')
            .name(LightDebugConfig.dayMode.mainLight.color.name)
            .onChange(value => {
                const newMainLight = {...lightSettings.day.mainLight, color: value};
                updateDayParam({mainLight: newMainLight});
            });

        // Position de la lumière principale (jour)
        const dayLightPositionFolder = dayMainLightFolder.addFolder("Position");

        dayLightPositionFolder.add({x: lightSettings.day.mainLight.position[0]}, 'x', LightDebugConfig.dayMode.mainLight.position.x.min, LightDebugConfig.dayMode.mainLight.position.x.max, LightDebugConfig.dayMode.mainLight.position.x.step)
            .name(LightDebugConfig.dayMode.mainLight.position.x.name)
            .onChange(value => {
                updateDayPosition(0, value);
            });

        dayLightPositionFolder.add({y: lightSettings.day.mainLight.position[1]}, 'y', LightDebugConfig.dayMode.mainLight.position.y.min, LightDebugConfig.dayMode.mainLight.position.y.max, LightDebugConfig.dayMode.mainLight.position.y.step)
            .name(LightDebugConfig.dayMode.mainLight.position.y.name)
            .onChange(value => {
                updateDayPosition(1, value);
            });

        dayLightPositionFolder.add({z: lightSettings.day.mainLight.position[2]}, 'z', LightDebugConfig.dayMode.mainLight.position.z.min, LightDebugConfig.dayMode.mainLight.position.z.max, LightDebugConfig.dayMode.mainLight.position.z.step)
            .name(LightDebugConfig.dayMode.mainLight.position.z.name)
            .onChange(value => {
                updateDayPosition(2, value);
            });

        // Ombres (jour)
        const dayShadowsFolder = dayMainLightFolder.addFolder("Ombres");
        dayShadowsFolder.add({mapSize: lightSettings.day.mainLight.shadowMapSize}, 'mapSize', LightDebugConfig.dayMode.mainLight.shadows.mapSize.options)
            .name(LightDebugConfig.dayMode.mainLight.shadows.mapSize.name)
            .onChange(value => {
                const newMainLight = {...lightSettings.day.mainLight, shadowMapSize: value};
                updateDayParam({mainLight: newMainLight});
            });

        dayShadowsFolder.add(lightSettings.day.mainLight, 'shadowBias', LightDebugConfig.dayMode.mainLight.shadows.bias.min, LightDebugConfig.dayMode.mainLight.shadows.bias.max, LightDebugConfig.dayMode.mainLight.shadows.bias.step)
            .name(LightDebugConfig.dayMode.mainLight.shadows.bias.name)
            .onChange(value => {
                const newMainLight = {...lightSettings.day.mainLight, shadowBias: value};
                updateDayParam({mainLight: newMainLight});
            });

        // --- Configuration du Mode Nuit ---
        const nightFolder = lightsFolder.addFolder(LightDebugConfig.nightMode.folder);
        nightFolder.close();
        // Lumière ambiante (nuit)
        const nightAmbientFolder = nightFolder.addFolder("Lumière Ambiante");
        nightAmbientFolder.add(lightSettings.night, 'ambientIntensity', LightDebugConfig.nightMode.ambientLight.intensity.min, LightDebugConfig.nightMode.ambientLight.intensity.max, LightDebugConfig.nightMode.ambientLight.intensity.step)
            .name(LightDebugConfig.nightMode.ambientLight.intensity.name)
            .onChange(value => {
                updateNightParam({ambientIntensity: value});
            });

        nightAmbientFolder.addColor({color: lightSettings.night.ambientColor}, 'color')
            .name(LightDebugConfig.nightMode.ambientLight.color.name)
            .onChange(value => {
                updateNightParam({ambientColor: value});
            });

        // Lumière principale (nuit)
        const nightMainLightFolder = nightFolder.addFolder("Lumière Principale");
        nightMainLightFolder.add(lightSettings.night.mainLight, 'intensity', LightDebugConfig.nightMode.mainLight.intensity.min, LightDebugConfig.nightMode.mainLight.intensity.max, LightDebugConfig.nightMode.mainLight.intensity.step)
            .name(LightDebugConfig.nightMode.mainLight.intensity.name)
            .onChange(value => {
                const newMainLight = {...lightSettings.night.mainLight, intensity: value};
                updateNightParam({mainLight: newMainLight});
            });

        nightMainLightFolder.addColor({color: lightSettings.night.mainLight.color}, 'color')
            .name(LightDebugConfig.nightMode.mainLight.color.name)
            .onChange(value => {
                const newMainLight = {...lightSettings.night.mainLight, color: value};
                updateNightParam({mainLight: newMainLight});
            });

        // Position de la lumière principale (nuit)
        const nightLightPositionFolder = nightMainLightFolder.addFolder("Position");

        nightLightPositionFolder.add({x: lightSettings.night.mainLight.position[0]}, 'x', LightDebugConfig.nightMode.mainLight.position.x.min, LightDebugConfig.nightMode.mainLight.position.x.max, LightDebugConfig.nightMode.mainLight.position.x.step)
            .name(LightDebugConfig.nightMode.mainLight.position.x.name)
            .onChange(value => {
                updateNightPosition(0, value);
            });

        nightLightPositionFolder.add({y: lightSettings.night.mainLight.position[1]}, 'y', LightDebugConfig.nightMode.mainLight.position.y.min, LightDebugConfig.nightMode.mainLight.position.y.max, LightDebugConfig.nightMode.mainLight.position.y.step)
            .name(LightDebugConfig.nightMode.mainLight.position.y.name)
            .onChange(value => {
                updateNightPosition(1, value);
            });

        nightLightPositionFolder.add({z: lightSettings.night.mainLight.position[2]}, 'z', LightDebugConfig.nightMode.mainLight.position.z.min, LightDebugConfig.nightMode.mainLight.position.z.max, LightDebugConfig.nightMode.mainLight.position.z.step)
            .name(LightDebugConfig.nightMode.mainLight.position.z.name)
            .onChange(value => {
                updateNightPosition(2, value);
            });

        // Lumière lunaire (nuit uniquement)
        const moonLightFolder = nightFolder.addFolder(LightDebugConfig.nightMode.moonLight.folder);

        moonLightFolder.add({enabled: LightDebugConfig.nightMode.moonLight.enabled.default}, 'enabled')
            .name(LightDebugConfig.nightMode.moonLight.enabled.name)
            .onChange(value => {
                updateSecondaryLight('moon', 'enabled', value);
                // Force également le mode nuit quand on modifie la lumière lunaire
                updateLightConfig({forcedNightMode: true});
            });

        moonLightFolder.add({intensity: LightDebugConfig.nightMode.moonLight.intensity.default}, 'intensity', LightDebugConfig.nightMode.moonLight.intensity.min, LightDebugConfig.nightMode.moonLight.intensity.max, LightDebugConfig.nightMode.moonLight.intensity.step)
            .name(LightDebugConfig.nightMode.moonLight.intensity.name)
            .onChange(value => {
                updateSecondaryLight('moon', 'intensity', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        moonLightFolder.addColor({color: LightDebugConfig.nightMode.moonLight.color.default}, 'color')
            .name(LightDebugConfig.nightMode.moonLight.color.name)
            .onChange(value => {
                updateSecondaryLight('moon', 'color', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        // Position de la lumière lunaire
        const moonLightPositionFolder = moonLightFolder.addFolder("Position");

        moonLightPositionFolder.add({x: LightDebugConfig.nightMode.moonLight.position.x.default}, 'x', LightDebugConfig.nightMode.moonLight.position.x.min, LightDebugConfig.nightMode.moonLight.position.x.max, LightDebugConfig.nightMode.moonLight.position.x.step)
            .name(LightDebugConfig.nightMode.moonLight.position.x.name)
            .onChange(value => {
                updateSecondaryLight('moon', 'position.x', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        moonLightPositionFolder.add({y: LightDebugConfig.nightMode.moonLight.position.y.default}, 'y', LightDebugConfig.nightMode.moonLight.position.y.min, LightDebugConfig.nightMode.moonLight.position.y.max, LightDebugConfig.nightMode.moonLight.position.y.step)
            .name(LightDebugConfig.nightMode.moonLight.position.y.name)
            .onChange(value => {
                updateSecondaryLight('moon', 'position.y', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        moonLightPositionFolder.add({z: LightDebugConfig.nightMode.moonLight.position.z.default}, 'z', LightDebugConfig.nightMode.moonLight.position.z.min, LightDebugConfig.nightMode.moonLight.position.z.max, LightDebugConfig.nightMode.moonLight.position.z.step)
            .name(LightDebugConfig.nightMode.moonLight.position.z.name)
            .onChange(value => {
                updateSecondaryLight('moon', 'position.z', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        // Lumière secondaire (nuit uniquement)
        const secondaryLightFolder = nightFolder.addFolder(LightDebugConfig.nightMode.secondaryLight.folder);

        secondaryLightFolder.add({enabled: LightDebugConfig.nightMode.secondaryLight.enabled.default}, 'enabled')
            .name(LightDebugConfig.nightMode.secondaryLight.enabled.name)
            .onChange(value => {
                updateSecondaryLight('secondary', 'enabled', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        secondaryLightFolder.add({intensity: LightDebugConfig.nightMode.secondaryLight.intensity.default}, 'intensity', LightDebugConfig.nightMode.secondaryLight.intensity.min, LightDebugConfig.nightMode.secondaryLight.intensity.max, LightDebugConfig.nightMode.secondaryLight.intensity.step)
            .name(LightDebugConfig.nightMode.secondaryLight.intensity.name)
            .onChange(value => {
                updateSecondaryLight('secondary', 'intensity', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        secondaryLightFolder.addColor({color: LightDebugConfig.nightMode.secondaryLight.color.default}, 'color')
            .name(LightDebugConfig.nightMode.secondaryLight.color.name)
            .onChange(value => {
                updateSecondaryLight('secondary', 'color', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        // Position de la lumière secondaire
        const secondaryLightPositionFolder = secondaryLightFolder.addFolder("Position");

        secondaryLightPositionFolder.add({x: LightDebugConfig.nightMode.secondaryLight.position.x.default}, 'x', LightDebugConfig.nightMode.secondaryLight.position.x.min, LightDebugConfig.nightMode.secondaryLight.position.x.max, LightDebugConfig.nightMode.secondaryLight.position.x.step)
            .name(LightDebugConfig.nightMode.secondaryLight.position.x.name)
            .onChange(value => {
                updateSecondaryLight('secondary', 'position.x', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        secondaryLightPositionFolder.add({y: LightDebugConfig.nightMode.secondaryLight.position.y.default}, 'y', LightDebugConfig.nightMode.secondaryLight.position.y.min, LightDebugConfig.nightMode.secondaryLight.position.y.max, LightDebugConfig.nightMode.secondaryLight.position.y.step)
            .name(LightDebugConfig.nightMode.secondaryLight.position.y.name)
            .onChange(value => {
                updateSecondaryLight('secondary', 'position.y', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        secondaryLightPositionFolder.add({z: LightDebugConfig.nightMode.secondaryLight.position.z.default}, 'z', LightDebugConfig.nightMode.secondaryLight.position.z.min, LightDebugConfig.nightMode.secondaryLight.position.z.max, LightDebugConfig.nightMode.secondaryLight.position.z.step)
            .name(LightDebugConfig.nightMode.secondaryLight.position.z.name)
            .onChange(value => {
                updateSecondaryLight('secondary', 'position.z', value);
                // Force également le mode nuit
                updateLightConfig({forcedNightMode: true});
            });

        // --- Configuration des transitions ---
        const transitionsFolder = lightsFolder.addFolder(LightDebugConfig.transitions.folder);
        transitionsFolder.hide();
        // Seuils de transition
        transitionsFolder.add(lightSettings.transitionThresholds, 'startDayToTransition1', LightDebugConfig.transitions.thresholds.startDayToTransition1.min, LightDebugConfig.transitions.thresholds.startDayToTransition1.max, LightDebugConfig.transitions.thresholds.startDayToTransition1.step)
            .name(LightDebugConfig.transitions.thresholds.startDayToTransition1.name)
            .onChange(value => {
                const newThresholds = {...lightSettings.transitionThresholds, startDayToTransition1: value};
                updateLightConfig({transitionThresholds: newThresholds});
            });

        transitionsFolder.add(lightSettings.transitionThresholds, 'startTransition1ToTransition2', LightDebugConfig.transitions.thresholds.startTransition1ToTransition2.min, LightDebugConfig.transitions.thresholds.startTransition1ToTransition2.max, LightDebugConfig.transitions.thresholds.startTransition1ToTransition2.step)
            .name(LightDebugConfig.transitions.thresholds.startTransition1ToTransition2.name)
            .onChange(value => {
                const newThresholds = {...lightSettings.transitionThresholds, startTransition1ToTransition2: value};
                updateLightConfig({transitionThresholds: newThresholds});
            });

        transitionsFolder.add(lightSettings.transitionThresholds, 'startTransition2ToNight', LightDebugConfig.transitions.thresholds.startTransition2ToNight.min, LightDebugConfig.transitions.thresholds.startTransition2ToNight.max, LightDebugConfig.transitions.thresholds.startTransition2ToNight.step)
            .name(LightDebugConfig.transitions.thresholds.startTransition2ToNight.name)
            .onChange(value => {
                const newThresholds = {...lightSettings.transitionThresholds, startTransition2ToNight: value};
                updateLightConfig({transitionThresholds: newThresholds});
            });

        transitionsFolder.add(lightSettings.transitionThresholds, 'completeNight', LightDebugConfig.transitions.thresholds.completeNight.min, LightDebugConfig.transitions.thresholds.completeNight.max, LightDebugConfig.transitions.thresholds.completeNight.step)
            .name(LightDebugConfig.transitions.thresholds.completeNight.name)
            .onChange(value => {
                const newThresholds = {...lightSettings.transitionThresholds, completeNight: value};
                updateLightConfig({transitionThresholds: newThresholds});
            });

        // Préréglages de transition
        transitionsFolder.add({preset: LightDebugConfig.transitions.presets.default}, 'preset', LightDebugConfig.transitions.presets.options)
            .name(LightDebugConfig.transitions.presets.name)
            .onChange(value => {
                // Appliquer les préréglages de transition
                let newThresholds;

                switch (value) {
                    case 'fast':
                        newThresholds = {
                            startDayToTransition1: 0.2,
                            startTransition1ToTransition2: 0.3,
                            startTransition2ToNight: 0.4,
                            completeNight: 0.5
                        };
                        break;
                    case 'slow':
                        newThresholds = {
                            startDayToTransition1: 0.1,
                            startTransition1ToTransition2: 0.4,
                            startTransition2ToNight: 0.7,
                            completeNight: 0.9
                        };
                        break;
                    case 'longSunset':
                        newThresholds = {
                            startDayToTransition1: 0.1,
                            startTransition1ToTransition2: 0.5,
                            startTransition2ToNight: 0.7,
                            completeNight: 0.8
                        };
                        break;
                    case 'earlyNight':
                        newThresholds = {
                            startDayToTransition1: 0.1,
                            startTransition1ToTransition2: 0.2,
                            startTransition2ToNight: 0.3,
                            completeNight: 0.4
                        };
                        break;
                    default: // 'default'
                        newThresholds = {...LightConfig.transitionThresholds};
                        break;
                }

                updateLightConfig({transitionThresholds: newThresholds});

                // Mettre à jour les valeurs dans l'interface du GUI
                for (const key in newThresholds) {
                    if (Object.prototype.hasOwnProperty.call(newThresholds, key)) {
                        for (const controller of transitionsFolder.controllers) {
                            if (controller.property === key) {
                                controller.setValue(newThresholds[key]);
                                break;
                            }
                        }
                    }
                }
            });

        guiInitializedRef.current = true;
    };

    // Effet pour émettre les événements de mise à jour de configuration
    // en séparant du setState pour éviter les mises à jour pendant le rendu
    useEffect(() => {
        // Émettre l'événement pour que le composant Lights puisse réagir
        EventBus.trigger('light-config-update', lightSettings);
    }, [lightSettings]);

    // Effet pour initialiser le GUI lorsque le debug est activé
    useEffect(() => {
        if (debug && gui) {
            initializeDebugGUI();
        }

        return () => {
            // Nettoyage
            if (debugFolderRef.current) {
                debugFolderRef.current.close();
                debugFolderRef.current = null;
            }
        };
    }, [debug, gui]);

    // Effets supplémentaires pour gérer les événements spécifiques
    useEffect(() => {
        // Émettre l'événement de mode nuit forcé quand il change
        if (lightSettings.forcedNightMode !== undefined) {
            EventBus.trigger('forced-night-mode', {enabled: lightSettings.forcedNightMode});
        }
    }, [lightSettings.forcedNightMode]);


    // Références pour suivre l'état des lumières secondaires
    const secondaryLightsRef = useRef({
        moonLight: {
            enabled: LightDebugConfig.nightMode.moonLight.enabled.default,
            intensity: LightDebugConfig.nightMode.moonLight.intensity.default,
            color: LightDebugConfig.nightMode.moonLight.color.default,
            position: {
                x: LightDebugConfig.nightMode.moonLight.position.x.default,
                y: LightDebugConfig.nightMode.moonLight.position.y.default,
                z: LightDebugConfig.nightMode.moonLight.position.z.default
            }
        }, secondaryLight: {
            enabled: LightDebugConfig.nightMode.secondaryLight.enabled.default,
            intensity: LightDebugConfig.nightMode.secondaryLight.intensity.default,
            color: LightDebugConfig.nightMode.secondaryLight.color.default,
            position: {
                x: LightDebugConfig.nightMode.secondaryLight.position.x.default,
                y: LightDebugConfig.nightMode.secondaryLight.position.y.default,
                z: LightDebugConfig.nightMode.secondaryLight.position.z.default
            }
        }
    });

    // Ne rend rien visuellement, ce composant manipule uniquement le GUI
    return null;
};

export default LightDebugger;