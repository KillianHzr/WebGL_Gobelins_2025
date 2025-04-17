import React, { useEffect, useRef, useState } from 'react';
import useStore from '../Store/useStore';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import guiConfig from '../Config/guiConfig';

/**
 * Composant pour ajouter les contrôles de debug de l'effet de glow (OutlineEffect)
 * au GUI de debugging
 */
const GlowEffectDebug = ({ objectRef }) => {
    const { debug, gui, updateDebugConfig, getDebugConfigValue } = useStore();
    const folderRef = useRef(null);

    // État local pour suivre les paramètres d'effet
    const [effectSettings, setEffectSettings] = useState({
        active: false,
        color: '#ffffff',
        thickness: 0.03,
        intensity: 5,
        pulseSpeed: 1.2
    });

    // Référence à l'effet pour pouvoir le modifier directement
    const effectRef = useRef(null);

    useEffect(() => {
        if (!debug?.active || !debug?.showGui || !gui || !objectRef?.current) return;

        // Récupérer les valeurs sauvegardées ou utiliser les valeurs par défaut
        const savedActive = getDebugConfigValue('effects.glow.active.value', effectSettings.active);
        const savedColor = getDebugConfigValue('effects.glow.color.value', effectSettings.color);
        const savedThickness = getDebugConfigValue('effects.glow.thickness.value', effectSettings.thickness);
        const savedIntensity = getDebugConfigValue('effects.glow.intensity.value', effectSettings.intensity);
        const savedPulseSpeed = getDebugConfigValue('effects.glow.pulseSpeed.value', effectSettings.pulseSpeed);

        // Mettre à jour l'état local avec les valeurs sauvegardées
        setEffectSettings({
            active: savedActive,
            color: savedColor,
            thickness: savedThickness,
            intensity: savedIntensity,
            pulseSpeed: savedPulseSpeed
        });

        // Vérifier si le dossier "Effects" existe déjà
        let effectsFolder = gui.folders.find(folder => folder.name === "Effects");
        if (!effectsFolder) {
            effectsFolder = gui.addFolder("Effects");
            if (guiConfig.gui.closeFolders) {
                effectsFolder.close();
            }
        }

        // Créer un dossier pour les contrôles de l'effet de glow
        const glowFolder = effectsFolder.addFolder("Glow Effect");
        folderRef.current = glowFolder;

        // Ajouter les contrôles
        const settings = {
            active: savedActive,
            color: savedColor,
            thickness: savedThickness,
            intensity: savedIntensity,
            pulseSpeed: savedPulseSpeed
        };

        // Contrôle d'activation
        glowFolder.add(settings, 'active')
            .name('Active')
            .onChange(value => {
                updateDebugConfig('effects.glow.active.value', value);
                setEffectSettings(prev => ({ ...prev, active: value }));
            });

        // Contrôle de couleur
        glowFolder.addColor(settings, 'color')
            .name('Color')
            .onChange(value => {
                updateDebugConfig('effects.glow.color.value', value);
                setEffectSettings(prev => ({ ...prev, color: value }));
            });

        // Contrôle d'épaisseur
        glowFolder.add(settings, 'thickness', 0.01, 0.1, 0.01)
            .name('Thickness')
            .onChange(value => {
                updateDebugConfig('effects.glow.thickness.value', value);
                setEffectSettings(prev => ({ ...prev, thickness: value }));
            });

        // Contrôle d'intensité
        glowFolder.add(settings, 'intensity', 1, 10, 0.1)
            .name('Intensity')
            .onChange(value => {
                updateDebugConfig('effects.glow.intensity.value', value);
                setEffectSettings(prev => ({ ...prev, intensity: value }));
            });

        // Contrôle de vitesse de pulsation
        glowFolder.add(settings, 'pulseSpeed', 0, 5, 0.1)
            .name('Pulse Speed')
            .onChange(value => {
                updateDebugConfig('effects.glow.pulseSpeed.value', value);
                setEffectSettings(prev => ({ ...prev, pulseSpeed: value }));
            });

        // Ajouter un bouton pour tester l'effet rapidement
        const testActions = {
            testEffect: () => {
                // Activer l'effet pendant 2 secondes
                setEffectSettings(prev => ({ ...prev, active: true }));
                updateDebugConfig('effects.glow.active.value', true);

                // Mettre à jour le contrôle dans le GUI
                if (folderRef.current) {
                    // Trouver le contrôle d'activation et mettre à jour sa valeur
                    const controller = folderRef.current.controllers.find(c => c.property === 'active');
                    if (controller) controller.setValue(true);
                }

                // Désactiver après 2 secondes
                setTimeout(() => {
                    setEffectSettings(prev => ({ ...prev, active: false }));
                    updateDebugConfig('effects.glow.active.value', false);

                    // Mettre à jour le contrôle dans le GUI
                    if (folderRef.current) {
                        const controller = folderRef.current.controllers.find(c => c.property === 'active');
                        if (controller) controller.setValue(false);
                    }
                }, 2000);
            }
        };

        glowFolder.add(testActions, 'testEffect').name('Test Effect (2s)');

        // Fermer le dossier si configuré ainsi
        if (guiConfig.gui.closeFolders) {
            glowFolder.close();
        }

        // Nettoyage lors du démontage
        return () => {
            if (folderRef.current && effectsFolder) {
                effectsFolder.removeFolder(folderRef.current);
                folderRef.current = null;

                // Si le dossier Effects est vide, le supprimer aussi
                if (effectsFolder.folders.length === 0 && effectsFolder.controllers.length === 0) {
                    gui.removeFolder(effectsFolder);
                }
            }
        };
    }, [debug, gui, objectRef, updateDebugConfig, getDebugConfigValue]);

    // Mettre à jour la référence à l'effet quand l'état change
    const updateEffectRef = (ref) => {
        effectRef.current = ref;
    };

    // Retourner les paramètres actuels de l'effet et la fonction pour mettre à jour la référence
    return {
        effectSettings,
        updateEffectRef
    };
};

export default GlowEffectDebug;