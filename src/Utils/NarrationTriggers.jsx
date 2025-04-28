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

    // Récupérer la fonction setNarrationTriggered du store pour persister l'état des narrations
    const setNarrationTriggered = useStore(state => state.setNarrationTriggered);
    const triggeredNarrations = useStore(state => state.triggeredNarrations || {});

    // Map pour associer les objets interactifs à leurs narrations
    const objectNarrationMap = {
        'TrunkLargeInteractive': 'Scene03_SautAuDessusDeLArbre',
        'LeafErable': 'Scene04_RechercheDesIndices_part1',
        'AnimalPaws': 'Scene04_RechercheDesIndices_part2',
        'JumpRock1': 'Scene05_SautAu-DessusDeLaRiviere',
        'ThinTrunkInteractive': 'Scene06_PassageEn-DessousDeLaBranche'
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
    };

    useEffect(() => {
        // Initialiser les mappings au chargement
        initializeMappings();

        // Fonction pour gérer les événements de survol des marqueurs
        const handleMarkerHover = (data) => {
            console.log('Event MARKER_HOVER reçu:', data);

            // Si pas de données ou d'ID, sortir
            if (!data || !data.id) return;

            try {
                // 1. Essayer de trouver directement l'objet correspondant par son ID de marqueur
                let objectKey = null;

                // 2. Essayer d'utiliser le mapping des étapes requises vers les objets
                if (stepToObjectMap[data.id]) {
                    objectKey = stepToObjectMap[data.id];
                    console.log(`Trouvé objectKey via stepToObjectMap: ${objectKey}`);
                }

                // 3. Essayer de trouver l'objet dans les sous-chaînes de l'ID du marqueur
                if (!objectKey) {
                    for (const key of Object.keys(objectNarrationMap)) {
                        if (data.id.includes(key)) {
                            objectKey = key;
                            console.log(`Trouvé objectKey via substring: ${objectKey} dans ${data.id}`);
                            break;
                        }
                    }
                }

                // 4. Extraire le requiredStep de l'ID du marqueur (format typique: 'requiredStep-marker')
                if (!objectKey && data.id.includes('-marker')) {
                    const requiredStep = data.id.split('-marker')[0];
                    objectKey = stepToObjectMap[requiredStep];
                    console.log(`Trouvé objectKey via requiredStep extraction: ${objectKey} pour ${requiredStep}`);
                }

                // Si on a trouvé un objectKey correspondant à une narration, la jouer
                if (objectKey && objectNarrationMap[objectKey]) {
                    const narrationId = objectNarrationMap[objectKey];
                    console.log(`Narration à jouer pour ${objectKey}: ${narrationId}`);
                    playNarrationIfNotTriggered(narrationId);
                } else {
                    console.log(`Pas de narration trouvée pour l'objet identifié: ${objectKey || 'inconnu'}`);
                }
            } catch (error) {
                console.error('Erreur lors du traitement de l\'événement de survol:', error);
            }
        };

        // Fonction pour gérer les événements MARKER_ENTER
        const handleMarkerEnter = (data) => {
            console.log('Event MARKER_ENTER reçu:', data);
            handleMarkerHover(data); // Réutiliser la même logique
        };

        // Fonction pour gérer les événements pointer enter
        const handlePointerEnter = (data) => {
            console.log('Event POINTER_ENTER reçu:', data);
            handleMarkerHover(data); // Réutiliser la même logique
        };

        // Fonction pour gérer les événements de fermeture d'interface
        const handleInterfaceClose = (data) => {
            // Vérifier si c'est l'interface de scanner qui se ferme
            if (data && data.type === 'scanner') {
                // Pour l'action "close" avec un résultat "complete"
                if (data.action === 'close' && data.result === 'complete') {
                    // Jouer la troisième partie de la scène 04
                    playNarrationIfNotTriggered('Scene04_RechercheDesIndices_part3');
                    console.log('Narration déclenchée: Scan complété');
                }
                // Si le scan est annulé, pas de narration
                else if (data.action === 'cancel') {
                    console.log('Scan annulé - pas de narration déclenchée');
                }
            }
        };

        // S'abonner aux événements avec gestion des erreurs
        try {
            // Écouter différents types d'événements qui pourraient indiquer un survol
            const hoverListener = EventBus.on(MARKER_EVENTS.MARKER_HOVER, handleMarkerHover);
            const markerEnterListener = EventBus.on(MARKER_EVENTS.MARKER_HOVER_END, handleMarkerEnter);
            const pointerEnterListener = EventBus.on('marker:pointer:enter', handlePointerEnter);

            // Écouter les événements d'interface (pour la fermeture du scanner)
            const interfaceListener = EventBus.on('interface-action', handleInterfaceClose);

            // Stocker les références pour le nettoyage
            eventListenersRef.current = [
                hoverListener,
                markerEnterListener,
                pointerEnterListener,
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