import { Howl } from 'howler';
import { EventBus } from './EventEmitter';

/**
 * Gestionnaire des sons bonus déclenchés selon l'activité de l'utilisateur
 */
class BonusSoundsManager {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.active = false;

        // État du système
        this.lastScrollTime = Date.now();
        this.lastInteractionTime = null;
        this.hasCompletedInteraction = false;
        this.currentScrollProgress = 0; // 0-1

        // Configuration des timers
        this.SCROLL_TIMEOUT = 5000; // 5 secondes
        this.MIN_SOUND_INTERVAL = 15000; // 15 secondes minimum entre sons
        this.MIN_TIME_AFTER_INTERACTION = 7000; // 7 secondes après interaction
        this.NATURE_DIGITAL_THRESHOLD = 0.6; // 60% pour passer en digital

        // État des sons
        this.sounds = {
            nature: {},
            digital: {}
        };

        // Files d'attente pour éviter les répétitions
        this.soundQueues = {
            nature: [],
            digital: []
        };

        // Configuration des sons disponibles
        this.availableSounds = {
            nature: ['nature01', 'nature02', 'nature03', 'nature04'],
            digital: [
                'digital01', 'digital02', 'digital03', 'digital04',
                'digital05', 'digital06', 'digital07', 'digital08',
                'digital09', 'digital10', 'digital11', 'digital12'
            ]
        };

        // Timer pour vérifier les conditions
        this.checkTimer = null;
        this.lastSoundPlayedTime = 0;

        // Flags pour éviter les vérifications trop fréquentes
        this.isInInteraction = false;
        this.isInterfaceOpen = false;

        console.log('BonusSoundsManager: Initialized');
    }

    /**
     * Initialise le système
     */
    init() {
        console.log('BonusSoundsManager: Starting initialization');

        // Charger tous les sons
        this.loadAllSounds();

        // Initialiser les files d'attente
        this.initializeSoundQueues();

        // Configurer les écouteurs d'événements
        this.setupEventListeners();

        // Démarrer le système de vérification
        this.startCheckTimer();

        this.active = true;
        console.log('BonusSoundsManager: Initialization complete');

        return this;
    }

    /**
     * Charge tous les sons bonus
     */
    loadAllSounds() {
        console.log('BonusSoundsManager: Loading all bonus sounds');

        // Charger les sons nature
        this.availableSounds.nature.forEach(soundId => {
            this.sounds.nature[soundId] = new Howl({
                src: [`/audios/narration/bonus/${soundId}.mp3`],
                loop: false,
                volume: 0.7,
                preload: true,
                onload: () => console.log(`BonusSoundsManager: Loaded ${soundId}`),
                onloaderror: (id, error) => console.error(`BonusSoundsManager: Error loading ${soundId}:`, error)
            });
        });

        // Charger les sons digital
        this.availableSounds.digital.forEach(soundId => {
            this.sounds.digital[soundId] = new Howl({
                src: [`/audios/narration/bonus/${soundId}.mp3`],
                loop: false,
                volume: 0.7,
                preload: true,
                onload: () => console.log(`BonusSoundsManager: Loaded ${soundId}`),
                onloaderror: (id, error) => console.error(`BonusSoundsManager: Error loading ${soundId}:`, error)
            });
        });
    }

    /**
     * Initialise les files d'attente avec tous les sons mélangés
     */
    initializeSoundQueues() {
        this.soundQueues.nature = this.shuffleArray([...this.availableSounds.nature]);
        this.soundQueues.digital = this.shuffleArray([...this.availableSounds.digital]);

        console.log('BonusSoundsManager: Sound queues initialized', {
            nature: this.soundQueues.nature.length,
            digital: this.soundQueues.digital.length
        });
    }

    /**
     * Mélange un tableau (Fisher-Yates)
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        console.log('BonusSoundsManager: Setting up event listeners');

        // Écouter les mouvements de timeline (scroll)
        this.timelineSubscription = EventBus.on('timeline-position-normalized', (data) => {
            this.handleScrollActivity(data.position);
        });

        // Écouter les interactions complétées
        this.interactionCompleteSubscription = EventBus.on('INTERACTION_COMPLETE', (data) => {
            this.handleInteractionComplete(data);
        });

        // Écouter les interactions en cours
        this.interactionStartSubscription = EventBus.on('interaction:detected', (data) => {
            this.handleInteractionStart(data);
        });

        // Écouter l'ouverture/fermeture des interfaces
        this.interfaceSubscription = EventBus.on('interface-action', (data) => {
            this.handleInterfaceAction(data);
        });

        // Écouter les changements d'état des interactions via le store
        if (typeof window !== 'undefined' && window.useStore) {
            // Vérifier périodiquement l'état des interfaces
            this.interfaceCheckInterval = setInterval(() => {
                this.checkInterfaceState();
            }, 1000);
        }
    }

    /**
     * Vérifie l'état actuel des interfaces
     */
    checkInterfaceState() {
        if (typeof window !== 'undefined' && window.useStore) {
            try {
                const state = window.useStore.getState();
                const interaction = state.interaction;

                const wasInInteraction = this.isInInteraction;
                const wasInterfaceOpen = this.isInterfaceOpen;

                // Vérifier si une interaction est en cours
                this.isInInteraction = (
                    interaction?.waitingForInteraction ||
                    !interaction?.allowScroll ||
                    interaction?.currentStep !== null
                );

                // Vérifier si une interface est ouverte
                this.isInterfaceOpen = (
                    interaction?.showCaptureInterface ||
                    interaction?.showScannerInterface ||
                    interaction?.showImageInterface ||
                    interaction?.showBlackscreenInterface
                );

                // Si on sort d'une interaction ou interface, enregistrer le temps
                if ((wasInInteraction && !this.isInInteraction) || (wasInterfaceOpen && !this.isInterfaceOpen)) {
                    this.lastInteractionTime = Date.now();
                    console.log('BonusSoundsManager: Interaction/Interface ended, timer reset');
                }

            } catch (error) {
                console.warn('BonusSoundsManager: Error checking interface state:', error);
            }
        }
    }

    /**
     * Gère l'activité de scroll
     */
    handleScrollActivity(normalizedPosition) {
        this.lastScrollTime = Date.now();
        this.currentScrollProgress = normalizedPosition;

        // Pas besoin de log à chaque scroll, trop verbeux
        // console.log(`BonusSoundsManager: Scroll activity at ${(normalizedPosition * 100).toFixed(1)}%`);
    }

    /**
     * Gère le début d'une interaction
     */
    handleInteractionStart(data) {
        console.log('BonusSoundsManager: Interaction started');
        this.isInInteraction = true;
    }

    /**
     * Gère la fin d'une interaction
     */
    handleInteractionComplete(data) {
        console.log('BonusSoundsManager: Interaction completed');
        this.hasCompletedInteraction = true;
        this.lastInteractionTime = Date.now();
        this.isInInteraction = false;
    }

    /**
     * Gère les actions d'interface
     */
    handleInterfaceAction(data) {
        if (data.action === 'open') {
            console.log('BonusSoundsManager: Interface opened');
            this.isInterfaceOpen = true;
        } else if (data.action === 'close' || data.action === 'cancel') {
            console.log('BonusSoundsManager: Interface closed');
            this.isInterfaceOpen = false;
            this.lastInteractionTime = Date.now();
        }
    }

    /**
     * Démarre le timer de vérification
     */
    startCheckTimer() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }

        // Vérifier les conditions toutes les secondes
        this.checkTimer = setInterval(() => {
            this.checkConditionsAndPlaySound();
        }, 1000);

        console.log('BonusSoundsManager: Check timer started');
    }

    /**
     * Vérifie toutes les conditions et joue un son si approprié
     */
    checkConditionsAndPlaySound() {
        if (!this.active) return;

        const now = Date.now();

        // Condition 1: L'utilisateur a déjà validé au moins une interaction
        if (!this.hasCompletedInteraction) {
            return;
        }

        // Condition 2: L'utilisateur n'a pas scroll depuis 3s
        const timeSinceLastScroll = now - this.lastScrollTime;
        if (timeSinceLastScroll < this.SCROLL_TIMEOUT) {
            return;
        }

        // Condition 3: Pas dans une interaction ou interface
        if (this.isInInteraction || this.isInterfaceOpen) {
            return;
        }

        // Condition 4: Au moins 5s depuis la dernière interaction (sauf si aucune)
        if (this.lastInteractionTime !== null) {
            const timeSinceLastInteraction = now - this.lastInteractionTime;
            if (timeSinceLastInteraction < this.MIN_TIME_AFTER_INTERACTION) {
                return;
            }
        }

        // Condition 5: Minimum 10s entre les sons bonus
        const timeSinceLastSound = now - this.lastSoundPlayedTime;
        if (timeSinceLastSound < this.MIN_SOUND_INTERVAL) {
            return;
        }

        // Toutes les conditions sont remplies, jouer un son
        this.playNextBonusSound();
    }

    /**
     * Joue le prochain son bonus approprié
     */
    playNextBonusSound() {
        // Déterminer le type de son à jouer selon la progression
        const soundType = this.currentScrollProgress < this.NATURE_DIGITAL_THRESHOLD ? 'nature' : 'digital';

        // Obtenir le prochain son de la file
        let soundId = this.getNextSoundFromQueue(soundType);

        if (!soundId) {
            console.warn(`BonusSoundsManager: No sound available for type ${soundType}`);
            return;
        }

        // Jouer le son
        const sound = this.sounds[soundType][soundId];
        if (sound) {
            console.log(`BonusSoundsManager: Playing bonus sound ${soundId} (type: ${soundType}, progress: ${(this.currentScrollProgress * 100).toFixed(1)}%)`);

            sound.play();
            this.lastSoundPlayedTime = Date.now();

            // Émettre un événement pour notifier qu'un son bonus est joué
            EventBus.trigger('bonus-sound-played', {
                soundId,
                soundType,
                scrollProgress: this.currentScrollProgress
            });
        } else {
            console.error(`BonusSoundsManager: Sound ${soundId} not found in ${soundType} category`);
        }
    }

    /**
     * Obtient le prochain son de la file pour un type donné
     */
    getNextSoundFromQueue(soundType) {
        const queue = this.soundQueues[soundType];

        if (queue.length === 0) {
            // File vide, la réinitialiser avec tous les sons mélangés
            console.log(`BonusSoundsManager: Reinitializing ${soundType} queue`);
            this.soundQueues[soundType] = this.shuffleArray([...this.availableSounds[soundType]]);
        }

        // Retirer et retourner le premier son de la file
        return this.soundQueues[soundType].shift();
    }

    /**
     * Force le déclenchement d'un son bonus (pour debug)
     */
    forceTriggerSound(soundType = null) {
        const type = soundType || (this.currentScrollProgress < this.NATURE_DIGITAL_THRESHOLD ? 'nature' : 'digital');

        console.log(`BonusSoundsManager: Force triggering ${type} sound`);

        const soundId = this.getNextSoundFromQueue(type);
        if (soundId && this.sounds[type][soundId]) {
            this.sounds[type][soundId].play();
            this.lastSoundPlayedTime = Date.now();

            return `Played ${soundId} (${type})`;
        }

        return `No ${type} sound available`;
    }

    /**
     * Obtient l'état de debug du système
     */
    getDebugState() {
        const now = Date.now();

        return {
            active: this.active,
            hasCompletedInteraction: this.hasCompletedInteraction,
            currentScrollProgress: this.currentScrollProgress,
            currentSoundType: this.currentScrollProgress < this.NATURE_DIGITAL_THRESHOLD ? 'nature' : 'digital',
            isInInteraction: this.isInInteraction,
            isInterfaceOpen: this.isInterfaceOpen,
            timeSinceLastScroll: this.lastScrollTime ? now - this.lastScrollTime : null,
            timeSinceLastInteraction: this.lastInteractionTime ? now - this.lastInteractionTime : null,
            timeSinceLastSound: this.lastSoundPlayedTime ? now - this.lastSoundPlayedTime : null,
            soundQueues: {
                nature: this.soundQueues.nature.length,
                digital: this.soundQueues.digital.length
            },
            conditions: {
                hasCompletedInteraction: this.hasCompletedInteraction,
                scrollTimeout: this.lastScrollTime ? (now - this.lastScrollTime) >= this.SCROLL_TIMEOUT : false,
                notInInteraction: !this.isInInteraction && !this.isInterfaceOpen,
                timeSinceInteraction: this.lastInteractionTime ? (now - this.lastInteractionTime) >= this.MIN_TIME_AFTER_INTERACTION : true,
                soundInterval: this.lastSoundPlayedTime ? (now - this.lastSoundPlayedTime) >= this.MIN_SOUND_INTERVAL : true
            }
        };
    }

    /**
     * Active/désactive le système
     */
    setActive(active) {
        this.active = active;
        console.log(`BonusSoundsManager: ${active ? 'Activated' : 'Deactivated'}`);
    }

    /**
     * Arrête le système et nettoie les ressources
     */
    stop() {
        console.log('BonusSoundsManager: Stopping');

        this.active = false;

        // Nettoyer les timers
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
        }

        if (this.interfaceCheckInterval) {
            clearInterval(this.interfaceCheckInterval);
            this.interfaceCheckInterval = null;
        }

        // Nettoyer les abonnements
        if (this.timelineSubscription && typeof this.timelineSubscription === 'function') {
            this.timelineSubscription();
        }
        if (this.interactionCompleteSubscription && typeof this.interactionCompleteSubscription === 'function') {
            this.interactionCompleteSubscription();
        }
        if (this.interactionStartSubscription && typeof this.interactionStartSubscription === 'function') {
            this.interactionStartSubscription();
        }
        if (this.interfaceSubscription && typeof this.interfaceSubscription === 'function') {
            this.interfaceSubscription();
        }

        // Arrêter tous les sons en cours
        Object.values(this.sounds.nature).forEach(sound => {
            if (sound && sound.playing()) {
                sound.stop();
            }
        });
        Object.values(this.sounds.digital).forEach(sound => {
            if (sound && sound.playing()) {
                sound.stop();
            }
        });

        console.log('BonusSoundsManager: Stopped');
    }

    /**
     * Nettoie complètement le système
     */
    dispose() {
        this.stop();

        // Nettoyer tous les sons
        Object.values(this.sounds.nature).forEach(sound => {
            if (sound) {
                sound.unload();
            }
        });
        Object.values(this.sounds.digital).forEach(sound => {
            if (sound) {
                sound.unload();
            }
        });

        this.sounds = { nature: {}, digital: {} };
        this.soundQueues = { nature: [], digital: [] };

        console.log('BonusSoundsManager: Disposed');
    }
}

export default BonusSoundsManager;