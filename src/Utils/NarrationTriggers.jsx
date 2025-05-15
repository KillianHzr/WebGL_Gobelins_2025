import React, { useEffect, useRef } from 'react';
import { EventBus, MARKER_EVENTS } from './EventEmitter';
import { narrationManager } from './NarrationManager';
import useStore from '../Store/useStore';
import sceneObjectManager from '../Config/SceneObjectManager';

/**
 * Composant qui gère le déclenchement des narrations en fonction des interactions de l'utilisateur
 * Ce composant n'affiche rien, mais écoute les événements et déclenche les narrations
 */
const NarrationTriggers = () => {
    // Référence pour garder trace des écouteurs d'événements
    const eventListenersRef = useRef([]);

    // Référence pour assurer que les narrations ne sont jouées qu'une seule fois
    const triggeredNarrationsRef = useRef(new Set());

    // Référence pour suivre si la partie 2 a été déclenchée avant la partie 3
    const part2TriggeredRef = useRef(false);

    // Récupérer la fonction setNarrationTriggered du store pour persister l'état des narrations
    const setNarrationTriggered = useStore(state => state.setNarrationTriggered);
    const triggeredNarrations = useStore(state => state.triggeredNarrations || {});

    // Map pour associer les objets interactifs à leurs narrations
    const objectNarrationMap = {
        'DirectionPanelStartInteractive': 'Scene02_PanneauInformation',
        'TrunkLargeInteractive': 'Scene03_SautAuDessusDeLArbre',
        'LeafErable': 'Scene04_RechercheDesIndices_part1',
        'AnimalPaws': 'Scene04_RechercheDesIndices_part2',
        'JumpRock1': 'Scene05_SautAu-DessusDeLaRiviere',
        'ThinTrunkInteractive': 'Scene06_PassageEn-DessousDeLaBranche',
        'Vison': 'Scene08_DecouverteDuVisonMort',
        'DirectionPanelEndInteractive': 'Scene09_ClairiereDigitalisee'
    };

    // Map entre les "requiredStep" et les objets correspondants
    // Cela permettra de faire le lien entre les IDs des marqueurs et les objets
    const stepToObjectMap = {};

    // Fonction pour initialiser les maps
    const initializeMappings = () => {
        // Récupérer tous les placements interactifs
        const interactivePlacements = sceneObjectManager.getInteractivePlacements();

        // Créer la correspondance entre les étapes et les objets
        interactivePlacements.forEach(placement => {
            // Si le requiredStep existe, l'associer à l'objectKey
            if (placement.requiredStep) {
                stepToObjectMap[placement.requiredStep] = placement.objectKey;

                // Également associer le markerId à l'objectKey pour être sûr
                if (placement.markerId) {
                    stepToObjectMap[placement.markerId] = placement.objectKey;
                }
            }
        });

        console.log('NarrationTriggers: Mapping steps to objects', stepToObjectMap);
    };

    // Fonction pour jouer une narration si elle n'a pas encore été déclenchée
    const playNarrationIfNotTriggered = (narrationId) => {
        if (!narrationId) return;

        // Vérifier si la narration a déjà été déclenchée (mémoire locale)
        if (triggeredNarrationsRef.current.has(narrationId)) {
            console.log(`Narration ${narrationId} déjà déclenchée, ignorée.`);
            return;
        }

        // Vérifier dans le store si la narration a déjà été déclenchée (persistance)
        if (triggeredNarrations[narrationId]) {
            console.log(`Narration ${narrationId} déjà déclenchée (depuis le store), ignorée.`);
            return;
        }

        console.log(`Déclenchement de la narration: ${narrationId}`);

        // Ajouter à la liste des narrations déjà déclenchées
        triggeredNarrationsRef.current.add(narrationId);

        // Persister l'état dans le store
        setNarrationTriggered(narrationId);

        // Jouer la narration
        narrationManager.playNarration(narrationId);

        // Si c'est la partie 2 qui est déclenchée, marquer qu'elle a été déclenchée
        if (narrationId === 'Scene04_RechercheDesIndices_part2') {
            part2TriggeredRef.current = true;
            console.log('Partie 2 déclenchée, prêt pour partie 3 au prochain scan complet');
        }
    };

    useEffect(() => {
        // Initialiser les mappings au chargement
        initializeMappings();

        // NOUVELLE FONCTION: Gestion des interactions détectées automatiquement
        // lors de l'arrêt du scroll près d'un élément interactif
        const handleInteractionDetected = (data) => {
            console.log('Événement INTERACTION_DETECTED reçu:', data);

            // Si pas de données ou d'ID, sortir
            if (!data || !data.requiredStep) return;

            try {
                // Identifier l'objet interactif
                let objectKey = null;

                // Utiliser le requiredStep pour trouver l'objectKey
                if (stepToObjectMap[data.requiredStep]) {
                    objectKey = stepToObjectMap[data.requiredStep];
                    console.log(`Trouvé objectKey via stepToObjectMap: ${objectKey}`);
                }

                // Utiliser l'objectKey directement s'il est fourni
                else if (data.objectKey) {
                    objectKey = data.objectKey;
                    console.log(`Utilisation directe de objectKey: ${objectKey}`);
                }

                // Vérifications spécifiques pour certains objets
                if (objectKey === 'AnimalPaws') {
                    // Vérifier les préalables pour AnimalPaws
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    const leafErableCompleted = Object.keys(completedInteractions).some(key =>
                        key.includes('thirdStop') || key.includes('LeafErable')
                    );

                    if (!leafErableCompleted) {
                        console.log('AnimalPaws interaction ignorée car LeafErable n\'a pas encore été complété');
                        return;
                    }
                }

                // Vérifications similaires pour les rochers de saut
                if (objectKey === 'JumpRock2') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    const rock1Completed = Object.keys(completedInteractions).some(key =>
                        key.includes('eleventhStop') || key.includes('JumpRock1')
                    );

                    if (!rock1Completed) {
                        console.log('JumpRock2 interaction ignorée car JumpRock1 n\'a pas encore été complété');
                        return;
                    }
                }

                if (objectKey === 'JumpRock3') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    const rock2Completed = Object.keys(completedInteractions).some(key =>
                        key.includes('twelfthStop') || key.includes('JumpRock2')
                    );

                    if (!rock2Completed) {
                        console.log('JumpRock3 interaction ignorée car JumpRock2 n\'a pas encore été complété');
                        return;
                    }
                }

                if (objectKey === 'JumpRock4') {
                    const completedInteractions = useStore.getState().interaction.completedInteractions || {};
                    const rock3Completed = Object.keys(completedInteractions).some(key =>
                        key.includes('thirteenthStop') || key.includes('JumpRock3')
                    );

                    if (!rock3Completed) {
                        console.log('JumpRock4 interaction ignorée car JumpRock3 n\'a pas encore été complété');
                        return;
                    }
                }

                // Si un objet a été identifié et qu'il a une narration associée, la jouer
                if (objectKey && objectNarrationMap[objectKey]) {
                    const narrationId = objectNarrationMap[objectKey];
                    console.log(`Narration à jouer pour ${objectKey}: ${narrationId}`);
                    playNarrationIfNotTriggered(narrationId);
                } else {
                    console.log(`Pas de narration trouvée pour l'objet identifié: ${objectKey || 'inconnu'}`);
                }
            } catch (error) {
                console.error('Erreur lors du traitement de l\'événement d\'interaction:', error);
            }
        };

        // Fonction pour gérer les événements de succès d'action sur le CTA
        const handleSuccessfulInteraction = (data) => {
            console.log('Événement INTERACTION_COMPLETE reçu:', data);

            // Cas spécial pour DirectionPanelEndInteractive (doit être déclenché après l'action, pas au hover)
            const objectKey = data.objectKey ||
                (data.id && stepToObjectMap[data.id]) ||
                (data.requiredStep && stepToObjectMap[data.requiredStep]);

            if (objectKey === 'DirectionPanelEndInteractive') {
                const narrationId = objectNarrationMap[objectKey];
                console.log(`Narration post-action à jouer pour ${objectKey}: ${narrationId}`);
                playNarrationIfNotTriggered(narrationId);
            }
        };

        // Fonction pour gérer les événements de fermeture d'interface
        const handleInterfaceClose = (data) => {
            // Vérifier si c'est l'interface de scanner qui se ferme
            if (data && data.type === 'scanner') {
                // Pour l'action "close" avec un résultat "complete"
                if (data.action === 'close' && data.result === 'complete') {
                    // Ne jouer la partie 3 que si la partie 2 a déjà été déclenchée
                    if (part2TriggeredRef.current) {
                        // Jouer la troisième partie de la scène 04
                        playNarrationIfNotTriggered('Scene04_RechercheDesIndices_part3');
                        console.log('Narration partie 3 déclenchée après scan complété qui suit la partie 2');
                    } else {
                        console.log('Scan complété mais partie 2 pas encore déclenchée, pas de narration partie 3');
                    }
                }
                // Si le scan est annulé, pas de narration
                else if (data.action === 'cancel') {
                    console.log('Scan annulé - pas de narration déclenchée');
                }
            }
        };

        // S'abonner aux événements avec gestion des erreurs
        try {
            // NOUVEL ÉVÉNEMENT: S'abonner à l'événement d'interaction détectée
            const interactionDetectedListener = EventBus.on('interaction:detected', handleInteractionDetected);

            // S'abonner à l'événement de complétion d'interaction pour la narration post-action
            const interactionCompleteListener = EventBus.on(MARKER_EVENTS.INTERACTION_COMPLETE, handleSuccessfulInteraction);

            // Conserver les événements pour la fermeture d'interface
            const interfaceListener = EventBus.on('interface-action', handleInterfaceClose);

            // Stocker les références pour le nettoyage
            eventListenersRef.current = [
                interactionDetectedListener,
                interactionCompleteListener,
                interfaceListener
            ];

            console.log('NarrationTriggers: Écouteurs d\'événements configurés');
        } catch (error) {
            console.error('Erreur lors de la configuration des écouteurs pour les narrations:', error);
        }

        // Nettoyage lors du démontage
        return () => {
            // Nettoyer tous les écouteurs d'événements
            eventListenersRef.current.forEach(cleanup => {
                try {
                    if (typeof cleanup === 'function') {
                        cleanup();
                    }
                } catch (error) {
                    console.warn('Erreur lors du nettoyage des écouteurs:', error);
                }
            });
        };
    }, [setNarrationTriggered, triggeredNarrations]);

    // Ce composant ne rend rien
    return null;
};

export default NarrationTriggers;