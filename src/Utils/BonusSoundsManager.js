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

        // Configuration des sons disponibles - NOUVEAUTÉ: sons de test intégrés
        this.availableSounds = {
            nature: ['nature_test_01', 'nature_test_02'], // Sons réduits pour test
            digital: ['digital_test_01', 'digital_test_02'] // Sons réduits pour test
        };

        // NOUVEAUTÉ: Tracking des fichiers qui ont échoué au chargement
        this.failedSounds = {
            nature: [],
            digital: []
        };

        // NOUVEAUTÉ: Utiliser des sons alternatifs si les fichiers bonus ne sont pas trouvés
        this.fallbackSounds = {
            nature: [
                '/audios/randoms/bird_voices.mp3',
                '/audios/randoms/soft_wind_1.mp3'
            ],
            digital: [
                '/audios/randoms/3_beeps.mp3',
                '/audios/randoms/beep.mp3'
            ]
        };

        // Timer pour vérifier les conditions
        this.checkTimer = null;
        this.lastSoundPlayedTime = 0;

        // Flags pour éviter les vérifications trop fréquentes
        this.isInInteraction = false;
        this.isInterfaceOpen = false;

        // NOUVEAUTÉ: Flag pour indiquer si le système doit utiliser les sons de fallback
        this.useFallbackSounds = false;

        console.log('BonusSoundsManager: Initialized with error handling');
    }

    /**
     * Initialise le système
     */
    init() {
        console.log('BonusSoundsManager: Starting initialization with robust error handling');

        // Vérifier d'abord si les sons bonus existent, sinon utiliser les fallbacks
        this.checkAndLoadSounds();

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
     * NOUVEAUTÉ: Vérifie et charge les sons avec gestion des erreurs
     */
    async checkAndLoadSounds() {
        console.log('BonusSoundsManager: Checking for available bonus sounds...');

        // Tenter de charger les sons bonus originaux
        const originalSounds = {
            nature: ['nature01', 'nature02', 'nature03', 'nature04'],
            digital: [
                'digital01', 'digital02', 'digital03', 'digital04',
                'digital05', 'digital06', 'digital07', 'digital08',
                'digital09', 'digital10', 'digital11', 'digital12', 'digital13',
            ]
        };

        let loadedNature = 0;
        let loadedDigital = 0;

        // Essayer de charger quelques sons tests pour vérifier la disponibilité
        const testPromises = [];

        // Test nature sounds
        testPromises.push(
            this.testSoundLoad('nature01', 'nature').then(success => {
                if (success) loadedNature++;
            })
        );

        // Test digital sounds
        testPromises.push(
            this.testSoundLoad('digital01', 'digital').then(success => {
                if (success) loadedDigital++;
            })
        );

        // Attendre les tests
        await Promise.all(testPromises);

        // Décider quelle stratégie utiliser
        if (loadedNature === 0 && loadedDigital === 0) {
            // console.warn('BonusSoundsManager: No bonus sounds found, switching to fallback sounds');
            this.useFallbackSounds = true;
            this.loadFallbackSounds();
        } else {
            console.log('BonusSoundsManager: Bonus sounds available, loading original set');
            this.availableSounds = originalSounds;
            this.loadAllSounds();
        }
    }

    /**
     * NOUVEAUTÉ: Teste le chargement d'un son individuel
     */
    testSoundLoad(soundId, type) {
        return new Promise((resolve) => {
            const testSound = new Howl({
                src: [`/audios/narration/bonus/${soundId}.mp3`],
                volume: 0,
                preload: true,
                onload: () => {
                    console.log(`BonusSoundsManager: Test load successful for ${soundId}`);
                    testSound.unload(); // Nettoyer immédiatement
                    resolve(true);
                },
                onloaderror: () => {
                    console.log(`BonusSoundsManager: Test load failed for ${soundId}`);
                    testSound.unload(); // Nettoyer même en cas d'erreur
                    resolve(false);
                }
            });

            // Timeout de sécurité
            setTimeout(() => {
                testSound.unload();
                resolve(false);
            }, 5000);
        });
    }

    /**
     * NOUVEAUTÉ: Charge les sons de fallback depuis les sons existants
     */
    loadFallbackSounds() {
        console.log('BonusSoundsManager: Loading fallback sounds from existing audio files');

        // Charger les sons nature de fallback
        this.fallbackSounds.nature.forEach((src, index) => {
            const soundId = `nature_fallback_${index + 1}`;
            this.sounds.nature[soundId] = new Howl({
                src: [src],
                loop: false,
                volume: 0.8, // Volume plus bas pour les sons de fallback
                preload: true,
                onload: () => console.log(`BonusSoundsManager: Loaded fallback nature sound ${soundId}`),
                onloaderror: (id, error) => {
                    // console.warn(`BonusSoundsManager: Error loading fallback nature sound ${soundId}:`, error);
                    this.failedSounds.nature.push(soundId);
                }
            });
        });

        // Charger les sons digital de fallback
        this.fallbackSounds.digital.forEach((src, index) => {
            const soundId = `digital_fallback_${index + 1}`;
            this.sounds.digital[soundId] = new Howl({
                src: [src],
                loop: false,
                volume: 0.8, // Volume plus bas pour les sons de fallback
                preload: true,
                onload: () => console.log(`BonusSoundsManager: Loaded fallback digital sound ${soundId}`),
                onloaderror: (id, error) => {
                    // console.warn(`BonusSoundsManager: Error loading fallback digital sound ${soundId}:`, error);
                    this.failedSounds.digital.push(soundId);
                }
            });
        });

        // Mettre à jour la liste des sons disponibles
        this.availableSounds = {
            nature: Object.keys(this.sounds.nature),
            digital: Object.keys(this.sounds.digital)
        };

        console.log('BonusSoundsManager: Fallback sounds loaded', {
            nature: this.availableSounds.nature.length,
            digital: this.availableSounds.digital.length
        });
    }

    /**
     * Charge tous les sons bonus (version originale avec gestion d'erreurs améliorée)
     */
    loadAllSounds() {
        console.log('BonusSoundsManager: Loading all bonus sounds with error handling');

        // Charger les sons nature
        this.availableSounds.nature.forEach(soundId => {
            this.sounds.nature[soundId] = new Howl({
                src: [`/audios/narration/bonus/${soundId}.mp3`],
                loop: false,
                volume: 0.7,
                preload: true,
                onload: () => console.log(`BonusSoundsManager: Loaded ${soundId}`),
                onloaderror: (id, error) => {
                    // console.warn(`BonusSoundsManager: Error loading ${soundId}:`, error);
                    this.failedSounds.nature.push(soundId);
                    // Supprimer le son défaillant de la liste disponible
                    this.availableSounds.nature = this.availableSounds.nature.filter(s => s !== soundId);
                    delete this.sounds.nature[soundId];
                }
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
                onloaderror: (id, error) => {
                    // console.warn(`BonusSoundsManager: Error loading ${soundId}:`, error);
                    this.failedSounds.digital.push(soundId);
                    // Supprimer le son défaillant de la liste disponible
                    this.availableSounds.digital = this.availableSounds.digital.filter(s => s !== soundId);
                    delete this.sounds.digital[soundId];
                }
            });
        });

        // Nettoyer les listes après un délai pour permettre le chargement
        setTimeout(() => {
            this.cleanupFailedSounds();
        }, 3000);
    }

    /**
     * NOUVEAUTÉ: Nettoie les sons qui ont échoué au chargement
     */
    cleanupFailedSounds() {
        const natureCount = this.availableSounds.nature.length;
        const digitalCount = this.availableSounds.digital.length;

        console.log(`BonusSoundsManager: Cleanup complete. Available sounds: ${natureCount} nature, ${digitalCount} digital`);

        if (this.failedSounds.nature.length > 0) {
            // console.warn(`BonusSoundsManager: ${this.failedSounds.nature.length} nature sounds failed to load:`, this.failedSounds.nature);
        }

        if (this.failedSounds.digital.length > 0) {
            // console.warn(`BonusSoundsManager: ${this.failedSounds.digital.length} digital sounds failed to load:`, this.failedSounds.digital);
        }

        // Si aucun son n'a pu être chargé, essayer les fallbacks
        if (natureCount === 0 && digitalCount === 0 && !this.useFallbackSounds) {
            // console.warn('BonusSoundsManager: No sounds loaded successfully, switching to fallback mode');
            this.useFallbackSounds = true;
            this.loadFallbackSounds();
        }
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
                // console.warn('BonusSoundsManager: Error checking interface state:', error);
            }
        }
    }

    /**
     * Gère l'activité de scroll
     */
    handleScrollActivity(normalizedPosition) {
        this.lastScrollTime = Date.now();
        this.currentScrollProgress = normalizedPosition;
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
     * Joue le prochain son bonus approprié (avec gestion d'erreurs)
     */
    playNextBonusSound() {
        // Déterminer le type de son à jouer selon la progression
        const soundType = this.currentScrollProgress < this.NATURE_DIGITAL_THRESHOLD ? 'nature' : 'digital';

        // Vérifier qu'il y a des sons disponibles pour ce type
        if (this.availableSounds[soundType].length === 0) {
            // console.warn(`BonusSoundsManager: No ${soundType} sounds available`);
            return;
        }

        // Obtenir le prochain son de la file
        let soundId = this.getNextSoundFromQueue(soundType);

        if (!soundId) {
            // console.warn(`BonusSoundsManager: No sound available for type ${soundType}`);
            return;
        }

        // Jouer le son
        const sound = this.sounds[soundType][soundId];
        if (sound) {
            console.log(`BonusSoundsManager: Playing bonus sound ${soundId} (type: ${soundType}, progress: ${(this.currentScrollProgress * 100).toFixed(1)}%) ${this.useFallbackSounds ? '[FALLBACK]' : ''}`);

            try {
                sound.play();
                this.lastSoundPlayedTime = Date.now();

                // Émettre un événement pour notifier qu'un son bonus est joué
                EventBus.trigger('bonus-sound-played', {
                    soundId,
                    soundType,
                    scrollProgress: this.currentScrollProgress,
                    usingFallback: this.useFallbackSounds
                });
            } catch (error) {
                console.error(`BonusSoundsManager: Error playing sound ${soundId}:`, error);
            }
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

        if (this.availableSounds[type].length === 0) {
            return `No ${type} sounds available`;
        }

        const soundId = this.getNextSoundFromQueue(type);
        if (soundId && this.sounds[type][soundId]) {
            try {
                this.sounds[type][soundId].play();
                this.lastSoundPlayedTime = Date.now();
                return `Played ${soundId} (${type}) ${this.useFallbackSounds ? '[FALLBACK]' : ''}`;
            } catch (error) {
                console.error(`BonusSoundsManager: Error force playing ${soundId}:`, error);
                return `Error playing ${soundId}`;
            }
        }

        return `No ${type} sound available`;
    }

    /**
     * Obtient l'état de debug du système (avec infos sur les erreurs)
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
            },
            usingFallbackSounds: this.useFallbackSounds,
            failedSounds: this.failedSounds,
            availableSoundsCount: {
                nature: this.availableSounds.nature.length,
                digital: this.availableSounds.digital.length
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