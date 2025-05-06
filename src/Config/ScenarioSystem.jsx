import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { EventBus } from '../Utils/EventEmitter';
import { narrationManager } from '../Utils/NarrationManager';
import { animationManager } from './AnimationManager';
import ScenarioTriggerSystem from '../Utils/ScenarioTriggerSystem';
import useStore from '../Store/useStore';

/**
 * Composant principal du système de scénario
 * Intègre les différents sous-systèmes (narration, animation, marqueurs) dans une expérience cohérente
 */
const ScenarioSystem = () => {
    const { scene, camera, gl: renderer } = useThree();
    const animationInitialized = useRef(false);
    const store = useStore();

    // Initialiser les gestionnaires au chargement
    useEffect(() => {
        if (!scene || !camera) return;

        // console.log('Initializing ScenarioSystem');

        // Initialiser le gestionnaire d'animations
        if (!animationInitialized.current) {
            // console.log('Initializing AnimationManager');

            try {
                // Stocker le renderer dans userData de la scène pour les animations
                if (renderer && scene.userData) {
                    scene.userData.renderer = renderer;

                    // Stocker la fonction de rendu originale si elle existe
                    if (scene.userData.renderFunction) {
                        scene.userData.originalRenderFunction = scene.userData.renderFunction;
                    } else {
                        // Créer une fonction de rendu par défaut
                        scene.userData.originalRenderFunction = () => {
                            if (renderer && scene && camera) {
                                renderer.render(scene, camera);
                            }
                        };
                    }
                }

                // Passer l'instance de store directement au gestionnaire d'animations
                scene.userData.storeInstance = store;

                // Initialiser le gestionnaire d'animations avec la scène et la caméra
                animationManager.init(scene, camera);

                // Marquer comme initialisé
                animationInitialized.current = true;

                // Informer les autres systèmes que l'initialisation est terminée
                EventBus.trigger('scenario:initialized', { scene, camera, renderer });

                console.log('AnimationManager successfully initialized');
            } catch (error) {
                console.error('Error initializing AnimationManager:', error);
            }
        }

        // Initialiser le système de narration si nécessaire
        try {
            narrationManager.init();
            // console.log('NarrationManager initialized');
        } catch (error) {
            console.error('Error initializing NarrationManager:', error);
        }

        // S'abonner aux événements liés au scénario
        const cleanupScenarioEvents = _setupScenarioEvents();

        return () => {
            // Nettoyer les écouteurs d'événements
            if (cleanupScenarioEvents) {
                cleanupScenarioEvents();
            }
        };
    }, [scene, camera, renderer, store]);

    /**
     * Configure les écouteurs d'événements liés au scénario
     * @returns {Function} Fonction de nettoyage des écouteurs
     */
    const _setupScenarioEvents = () => {
        const eventListeners = [];

        // Écouter les événements de fin d'animation
        const animationCompleteListener = EventBus.on('animation:complete', (data) => {
            console.log('Animation completed:', data);

            // Actions spécifiques en fonction de l'animation terminée
            switch (data.name) {
                case 'jump-animation':
                    // Après un saut, mettre à jour l'étape d'interaction si nécessaire
                    _handlePostJumpAnimation(data);
                    break;

                case 'leaf-scatter':
                    // Après la dispersion des feuilles, révéler un nouvel élément interactif
                    _handlePostLeafScatterAnimation(data);
                    break;

                case 'river-jump':
                    // Après un saut de rivière, passer à la pierre suivante
                    _handlePostRiverJumpAnimation(data);
                    break;

                case 'duck-animation':
                    // Après un passage sous une branche, continuer le parcours
                    _handlePostDuckAnimation(data);
                    break;

                case 'camera-flash':
                    // Après un flash d'appareil photo, transition vers la scène suivante
                    _handlePostCameraFlashAnimation(data);
                    break;

                case 'camera-zoom':
                    // Après un zoom de caméra, afficher des informations supplémentaires
                    _handlePostCameraZoomAnimation(data);
                    break;
            }
        });

        eventListeners.push(animationCompleteListener);

        // Écouter les événements de fin de narration
        const narrationEndedListener = EventBus.on('narration-ended', (data) => {
            console.log('Narration ended:', data);

            // Récupérer l'identifiant de la narration terminée
            const narrationId = data.narrationId;

            // Actions spécifiques en fonction de la narration terminée
            _handlePostNarrationActions(narrationId);
        });

        eventListeners.push(narrationEndedListener);

        // Écouter les événements d'interface
        const interfaceActionListener = EventBus.on('interface-action', (data) => {
            console.log('Interface action:', data);

            // Actions spécifiques en fonction de l'action d'interface
            if (data.type === 'scanner' && data.action === 'close' && data.result === 'complete') {
                // Scan terminé avec succès
                _handlePostScannerComplete(data);
            }
        });

        eventListeners.push(interfaceActionListener);

        // Fonction de nettoyage qui annule tous les écouteurs
        return () => {
            eventListeners.forEach(cleanup => {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            });
        };
    };

    /**
     * Gère les actions après une animation de saut
     * @param {Object} data - Données de l'animation
     */
    const _handlePostJumpAnimation = (data) => {
        // Vérifier si c'est un saut d'obstacle (tronc d'arbre)
        if (data.target && data.target.includes('TrunkLarge')) {
            console.log('Jump over obstacle completed');

            // Mettre à jour l'étape actuelle du parcours
            // (à customiser selon la logique de progression)
            store.interaction.setCurrentStep('secondStop');

            // Réactiver le scroll pour continuer l'exploration
            store.interaction.setAllowScroll(true);
        }
    };

    /**
     * Gère les actions après une animation de dispersion des feuilles
     * @param {Object} data - Données de l'animation
     */
    const _handlePostLeafScatterAnimation = (data) => {
        // Après avoir dégagé les feuilles, révéler les empreintes animales
        if (data.target && data.target.includes('LeafErable')) {
            console.log('Leaf scatter completed, revealing animal paws');

            // Mettre à jour l'étape actuelle pour permettre l'interaction avec les empreintes
            store.interaction.setCurrentStep('fifthStop');

            // Informer le joueur de la découverte
            // On pourrait ajouter un indice visuel ou sonore ici
        }
    };

    /**
     * Gère les actions après une animation de saut de rivière
     * @param {Object} data - Données de l'animation
     */
    const _handlePostRiverJumpAnimation = (data) => {
        // Identifier quelle pierre a été utilisée pour le saut
        const rockIndex = data.target ?
            parseInt(data.target.replace(/\D/g, ''), 10) : 0;

        console.log(`River jump completed on rock ${rockIndex}`);

        // Déterminer la prochaine étape en fonction de la pierre actuelle
        const nextSteps = {
            1: 'twelfthStop',
            2: 'thirteenthStop',
            3: 'fourteenthStop',
            4: 'fourthStop' // Après la dernière pierre, passer à la scène suivante
        };

        const nextStep = nextSteps[rockIndex];
        if (nextStep) {
            store.interaction.setCurrentStep(nextStep);
            store.interaction.setWaitingForInteraction(true);
        }
    };

    /**
     * Gère les actions après une animation de passage sous une branche
     * @param {Object} data - Données de l'animation
     */
    const _handlePostDuckAnimation = (data) => {
        if (data.target && data.target.includes('ThinTrunk')) {
            console.log('Duck under branch completed');

            // Passer à l'étape suivante
            store.interaction.setCurrentStep('tenthStop');

            // Réactiver le scroll
            store.interaction.setAllowScroll(true);
        }
    };

    /**
     * Gère les actions après une animation de flash d'appareil photo
     * @param {Object} data - Données de l'animation
     */
    const _handlePostCameraFlashAnimation = (data) => {
        console.log('Camera flash animation completed');

        // Transition vers la clairière digitalisée
        // Cette logique dépendrait de l'implémentation spécifique de la transition
        // entre environnements dans votre application
    };

    /**
     * Gère les actions après une animation de zoom de caméra
     * @param {Object} data - Données de l'animation
     */
    const _handlePostCameraZoomAnimation = (data) => {
        console.log('Camera zoom animation completed');

        // Vérifier s'il s'agit d'un zoom sur un panneau d'information
        if (data.target && data.target.includes('DirectionPanel')) {
            // Afficher les informations détaillées du panneau
            // Cela pourrait être implémenté comme une interface utilisateur spécifique
        }
    };

    /**
     * Gère les actions après la fin d'une narration
     * @param {string} narrationId - Identifiant de la narration terminée
     */
    const _handlePostNarrationActions = (narrationId) => {
        switch (narrationId) {
            case 'Scene02_PanneauInformation':
                // Après l'explication du panneau, permettre de continuer
                // Peut-être afficher un bouton pour quitter le panneau
                break;

            case 'Scene03_SautAuDessusDeLArbre':
                // Après l'explication du saut, passer à l'étape suivante
                store.interaction.setCurrentStep('thirdStop');
                break;

            case 'Scene04_RechercheDesIndices_part1':
                // Après l'explication des feuilles, activer l'interaction avec les empreintes
                store.interaction.setCurrentStep('fifthStop');
                break;

            case 'Scene04_RechercheDesIndices_part2':
                // Après l'explication des empreintes, préparer le scanner
                break;

            case 'Scene04_RechercheDesIndices_part3':
                // Après les résultats du scan, passer à l'étape suivante
                store.interaction.setCurrentStep('eleventhStop');
                break;

            case 'Scene05_SautAu-DessusDeLaRiviere':
                // Après l'explication de la rivière, activer la première pierre
                store.interaction.setCurrentStep('twelfthStop');
                break;

            case 'Scene06_PassageEn-DessousDeLaBranche':
                // Après l'explication du passage sous la branche, continuer vers la fin
                store.interaction.setCurrentStep('tenthStop');
                break;
        }
    };

    /**
     * Gère les actions après un scan complété avec succès
     * @param {Object} data - Données de l'action d'interface
     */
    const _handlePostScannerComplete = (data) => {
        console.log('Scanner completed successfully');

        // Vérifier si la partie 2 a déjà été déclenchée
        const part2Triggered = store.isNarrationTriggered('Scene04_RechercheDesIndices_part2');

        if (part2Triggered) {
            // Déclencher la partie 3 de la narration
            narrationManager.playNarration('Scene04_RechercheDesIndices_part3');

            // Marquer comme déclenchée
            store.setNarrationTriggered('Scene04_RechercheDesIndices_part3');

            // Préparer la prochaine étape
            store.interaction.setCurrentStep('eleventhStop');
        }
    };

    // Rendre l'ensemble du système de scénario
    return (
        <>
            {/* Intégrer le système de déclencheurs de scénario */}
            <ScenarioTriggerSystem />

            {/* Autres composants du système pourraient être ajoutés ici */}
        </>
    );
};

export default ScenarioSystem;