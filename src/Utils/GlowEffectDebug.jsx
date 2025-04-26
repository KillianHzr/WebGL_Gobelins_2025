import {useEffect, useRef, useState} from 'react';
import useStore from '../Store/useStore';
import guiConfig from '../Config/guiConfig';

// Variable globale pour suivre le dossier "Effects" partagé entre toutes les instances
let sharedEffectsFolder = null;
let activeInstances = 0;

/**
 * Composant pour ajouter les contrôles de debug de l'effet de glow (OutlineEffect)
 * au GUI de debugging, avec une gestion améliorée pour éviter les duplications
 */
const GlowEffectDebug = ({objectRef}) => {
    const {debug, gui, updateDebugConfig, getDebugConfigValue} = useStore();
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

        // Incrémenter le compteur d'instances actives
        activeInstances++;

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

        // Vérifier si le dossier "Effects" existe déjà globalement
        if (!sharedEffectsFolder) {
            // Vérification plus robuste: chercher dans tous les dossiers existants
            const existingEffectsFolder = gui.folders.find(folder => folder.name === "Effects");

            if (existingEffectsFolder) {
                // Utiliser le dossier existant
                sharedEffectsFolder = existingEffectsFolder;
            } else {
                // Créer un nouveau dossier
                sharedEffectsFolder = gui.addFolder("Effects");
                if (guiConfig.gui.closeFolders) {
                    sharedEffectsFolder.close();
                }
            }
        }

        // Utilisez l'ID de l'objet pour créer un nom unique pour le sous-dossier
        const objectId = objectRef.current.uuid || Math.random().toString(36).substr(2, 9);
        const glowFolderName = `Glow Effect (${objectId.slice(0, 4)})`;

        // Vérifier si ce sous-dossier existe déjà
        const existingGlowFolder = sharedEffectsFolder.folders.find(folder =>
            folder.name === glowFolderName || folder._title === glowFolderName
        );

        // Créer un dossier pour les contrôles de l'effet de glow
        const glowFolder = existingGlowFolder || sharedEffectsFolder.addFolder(glowFolderName);
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
        const activeController = glowFolder.controllers.find(c => c.property === 'active') ||
            glowFolder.add(settings, 'active')
                .name('Active')
                .onChange(value => {
                    updateDebugConfig('effects.glow.active.value', value);
                    setEffectSettings(prev => ({...prev, active: value}));
                });

        // Contrôle de couleur
        const colorController = glowFolder.controllers.find(c => c.property === 'color') ||
            glowFolder.addColor(settings, 'color')
                .name('Color')
                .onChange(value => {
                    updateDebugConfig('effects.glow.color.value', value);
                    setEffectSettings(prev => ({...prev, color: value}));
                });

        // Contrôle d'épaisseur
        const thicknessController = glowFolder.controllers.find(c => c.property === 'thickness') ||
            glowFolder.add(settings, 'thickness', 0.01, 0.1, 0.01)
                .name('Thickness')
                .onChange(value => {
                    updateDebugConfig('effects.glow.thickness.value', value);
                    setEffectSettings(prev => ({...prev, thickness: value}));
                });

        // Contrôle d'intensité
        const intensityController = glowFolder.controllers.find(c => c.property === 'intensity') ||
            glowFolder.add(settings, 'intensity', 1, 10, 0.1)
                .name('Intensity')
                .onChange(value => {
                    updateDebugConfig('effects.glow.intensity.value', value);
                    setEffectSettings(prev => ({...prev, intensity: value}));
                });

        // Contrôle de vitesse de pulsation
        const pulseSpeedController = glowFolder.controllers.find(c => c.property === 'pulseSpeed') ||
            glowFolder.add(settings, 'pulseSpeed', 0, 5, 0.1)
                .name('Pulse Speed')
                .onChange(value => {
                    updateDebugConfig('effects.glow.pulseSpeed.value', value);
                    setEffectSettings(prev => ({...prev, pulseSpeed: value}));
                });

        // Fermer le dossier si configuré ainsi
        if (guiConfig.gui.closeFolders) {
            glowFolder.close();
        }

        // Nettoyage lors du démontage
        return () => {
            // Décrémenter le compteur d'instances actives
            activeInstances--;

            if (folderRef.current && sharedEffectsFolder) {
                try {
                    // Supprimer ce dossier spécifique
                    sharedEffectsFolder.removeFolder(folderRef.current);
                    folderRef.current = null;

                    // Si c'est la dernière instance et que le dossier Effects est vide, le supprimer aussi
                    if (activeInstances === 0 &&
                        sharedEffectsFolder.folders.length === 0 &&
                        sharedEffectsFolder.controllers.length === 0) {
                        gui.removeFolder(sharedEffectsFolder);
                        sharedEffectsFolder = null;
                    }
                } catch (error) {
                    console.warn("Erreur lors du nettoyage du dossier Glow Effect:", error);
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