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

    // Ajouter les narrations spécifiques pour les scènes demandées
    const customNarrations = [
        { id: 'Scene04_RechercheDesIndices_part1', label: 'Scène 04 - Partie 1' },
        { id: 'Scene04_RechercheDesIndices_part2', label: 'Scène 04 - Partie 2' },
        { id: 'Scene04_RechercheDesIndices_part3', label: 'Scène 04 - Partie 3' }
    ];

    // Fusionner les narrations standards avec les narrations personnalisées
    const allNarrations = [...narrations];

    // Ajouter les narrations personnalisées uniquement si elles n'existent pas déjà
    customNarrations.forEach(custom => {
        if (!allNarrations.find(n => n.id === custom.id)) {
            allNarrations.push(custom);
        }
    });

    // Contrôles pour la narration
    const narrationControls = {
        selectedNarration: allNarrations.length > 0 ? allNarrations[0].id : '',
        playNarration: () => {
            if (narrationControls.selectedNarration) {
                audioManager.playNarration(narrationControls.selectedNarration);
            }
        },
        resetTriggeredNarrations: () => {
            // Récupérer le store et réinitialiser les narrations déclenchées
            const store = window.require ? window.require('./Store/useStore').default : null;
            if (store && store.getState().resetTriggeredNarrations) {
                store.getState().resetTriggeredNarrations();
                console.log('Narrations réinitialisées - elles peuvent être déclenchées à nouveau');
            } else {
                console.log('Impossible de réinitialiser les narrations - store non disponible');
            }
        }
    };

    // Créer un menu déroulant pour sélectionner la narration
    const narrationOptions = {};
    allNarrations.forEach(narration => {
        narrationOptions[narration.label] = narration.id;
    });

    if (Object.keys(narrationOptions).length > 0) {
        narrationFolder.add(narrationControls, 'selectedNarration', narrationOptions)
            .name('Sélectionner narration');
    }

    // Ajouter les boutons de contrôle
    narrationFolder.add(narrationControls, 'playNarration').name('Jouer narration');

    // Ajouter un bouton pour réinitialiser les narrations déclenchées
    narrationFolder.add(narrationControls, 'resetTriggeredNarrations').name('Réinitialiser narrations');

    return narrationFolder;
};