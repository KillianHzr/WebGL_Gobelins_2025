/**
 * Utilitaire pour ajouter des contrôles de narration au menu de debug
 */
import { audioManager } from './AudioManager';
import { narrationManager } from './NarrationManager';

/**
 * Ajoute des contrôles de narration au dossier audio de l'interface de debug
 * @param {GUI} audioFolder - Dossier lil-gui pour les contrôles audio
 */
export const addNarrationControlsToDebug = async (audioFolder) => {
    if (!audioFolder) return;

    // Créer un sous-dossier pour la narration
    const narrationFolder = audioFolder.addFolder('Narration');

    // Récupérer la liste des narrations disponibles
    const narrations = await narrationManager.getNarrationList();

    // Contrôles pour la narration
    const narrationControls = {
        selectedNarration: narrations.length > 0 ? narrations[0].id : '',
        playNarration: () => {
            if (narrationControls.selectedNarration) {
                audioManager.playNarration(narrationControls.selectedNarration);
            }
        },
    };

    // Créer un menu déroulant pour sélectionner la narration
    const narrationOptions = {};
    narrations.forEach(narration => {
        narrationOptions[narration.label] = narration.id;
    });

    if (Object.keys(narrationOptions).length > 0) {
        narrationFolder.add(narrationControls, 'selectedNarration', narrationOptions)
            .name('Sélectionner narration');
    }

    // Ajouter les boutons de contrôle
    narrationFolder.add(narrationControls, 'playNarration').name('Jouer narration');

    return narrationFolder;
};