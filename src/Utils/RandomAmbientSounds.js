import { Howl } from 'howler';

class RandomAmbientSounds {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.active = false;
        this.sounds = {};
        this.timers = {};
        this.howls = {};

        // Ajouter un suivi des délais pour le débogage
        this.nextPlayTimes = {};

        // Ajouter un suivi des sons en cours de lecture
        this.playingSounds = {};
        this.soundDurations = {};

        // Gestion des phases (nature/digital)
        this.currentPhase = 'nature'; // 'nature' ou 'digital'
        this.phaseTransitionProgress = 0; // 0-1, progression dans la timeline
        this.digitalPhaseStarted = false;

        // Configuration des sons nature (existants)
        this.natureConfig = {
            bird_voices: {
                path: '/audios/randoms/bird_voices.mp3',
                minInterval: 30,
                maxInterval: 60,
                minVolume: 0.05,
                maxVolume: 0.08,
                preload: true
            },
            insectes: {
                path: '/audios/randoms/insectes.mp3',
                minInterval: 30,
                maxInterval: 60,
                minVolume: 0.5,
                maxVolume: 0.6,
                preload: true
            },
            soft_wind_1: {
                path: '/audios/randoms/soft_wind_1.mp3',
                minInterval: 15,
                maxInterval: 45,
                minVolume: 0.1,
                maxVolume: 0.3,
                preload: true
            },
            soft_wind_2: {
                path: '/audios/randoms/soft_wind_2.mp3',
                minInterval: 15,
                maxInterval: 45,
                minVolume: 0.1,
                maxVolume: 0.3,
                preload: true
            },
            vison_step: {
                paths: [
                    { path: '/audios/randoms/vison_step_1.mp3', probability: 0.38 },
                    { path: '/audios/randoms/vison_step_2.mp3', probability: 0.38 },
                    { path: '/audios/randoms/vison_sound.mp3', probability: 0.24 }
                ],
                minInterval: 60,
                maxInterval: 75,
                minVolume: 0.5,
                maxVolume: 0.7,
                preload: true
            }
        };

        // Configuration des sons digitaux
        this.digitalConfig = {
            electric_sounds: {
                path: '/audios/randoms/electric_sounds.mp3',
                minInterval: 90,
                maxInterval: 120,
                minVolume: 0.1,
                maxVolume: 0.3,
                preload: true
            },
            three_beeps: {
                path: '/audios/randoms/3_beeps.mp3',
                minInterval: 30,
                maxInterval: 60,
                minVolume: 0.1,
                maxVolume: 0.3,
                preload: true
            },
            beep: {
                path: '/audios/randoms/beep.mp3',
                minInterval: 30,
                maxInterval: 60,
                minVolume: 0.1,
                maxVolume: 0.3,
                preload: true
            },
            humming_sounds: {
                paths: [
                    { path: '/audios/randoms/big_humming.mp3', probability: 0.5 },
                    { path: '/audios/randoms/small_humming.mp3', probability: 0.5 }
                ],
                minInterval: 60,
                maxInterval: 120,
                minVolume: 0.3,
                maxVolume: 0.5,
                preload: true
            },
            radio_frequency_interference: {
                path: '/audios/randoms/radio_frequency_interference.mp3',
                minInterval: 120,
                maxInterval: 180,
                minVolume: 0.1,
                maxVolume: 0.1,
                preload: true
            }
        };

        // Configuration combinée (pour compatibilité avec l'existant)
        this.config = { ...this.natureConfig };
    }

    // Initialiser le système
    init() {
        console.log('Initializing RandomAmbientSounds system with digital phase support');

        // Charger tous les sons (nature + digital)
        Object.keys(this.natureConfig).forEach(soundId => {
            this.loadSound(soundId, this.natureConfig[soundId]);
            this.nextPlayTimes[soundId] = 0;
        });

        Object.keys(this.digitalConfig).forEach(soundId => {
            this.loadSound(soundId, this.digitalConfig[soundId]);
            this.nextPlayTimes[soundId] = 0;
        });

        // Écouter les événements de timeline pour gérer la transition
        this.setupTimelineListener();

        return this;
    }

    // Configuration de l'écoute des événements de timeline
    setupTimelineListener() {
        if (typeof window !== 'undefined' && window.EventBus) {
            console.log('RandomAmbientSounds: Setting up timeline listener');

            this.timelineSubscription = window.EventBus.on('timeline-position-normalized', (data) => {
                this.updatePhaseBasedOnTimeline(data.position);
            });
        } else {
            // Retry après un délai si EventBus n'est pas encore disponible
            setTimeout(() => {
                this.setupTimelineListener();
            }, 1000);
        }
    }

    // Mise à jour de la phase basée sur la progression de la timeline
    updatePhaseBasedOnTimeline(normalizedPosition) {
        this.phaseTransitionProgress = normalizedPosition;

        const DIGITAL_PHASE_THRESHOLD = 0.6; // 60% du parcours

        // Transition vers la phase digitale
        if (normalizedPosition >= DIGITAL_PHASE_THRESHOLD && this.currentPhase === 'nature') {
            console.log('RandomAmbientSounds: Transitioning to digital phase at', normalizedPosition);
            this.transitionToDigitalPhase();
        }
        // Retour vers la phase nature (si on recule dans la timeline)
        else if (normalizedPosition < DIGITAL_PHASE_THRESHOLD && this.currentPhase === 'digital') {
            console.log('RandomAmbientSounds: Transitioning back to nature phase at', normalizedPosition);
            this.transitionToNaturePhase();
        }
    }

    // Transition vers la phase digitale
    transitionToDigitalPhase() {
        this.currentPhase = 'digital';

        // Arrêter la reprogrammation des sons nature (mais ne pas couper ceux en cours)
        Object.keys(this.natureConfig).forEach(soundId => {
            if (this.timers[soundId]) {
                clearTimeout(this.timers[soundId]);
                this.timers[soundId] = null;
                console.log(`RandomAmbientSounds: Stopped scheduling new ${soundId} sounds`);
            }
        });

        // Démarrer les sons digitaux si le système est actif
        if (this.active && !this.digitalPhaseStarted) {
            this.digitalPhaseStarted = true;
            Object.keys(this.digitalConfig).forEach(soundId => {
                this.scheduleInitialPlayback(soundId, this.digitalConfig[soundId]);
            });
            console.log('RandomAmbientSounds: Digital sounds started');
        }
    }

    // Transition vers la phase nature (retour en arrière)
    transitionToNaturePhase() {
        this.currentPhase = 'nature';
        this.digitalPhaseStarted = false;

        // Arrêter la reprogrammation des sons digitaux
        Object.keys(this.digitalConfig).forEach(soundId => {
            if (this.timers[soundId]) {
                clearTimeout(this.timers[soundId]);
                this.timers[soundId] = null;
                console.log(`RandomAmbientSounds: Stopped scheduling ${soundId} digital sounds`);
            }
        });

        // Redémarrer les sons nature si le système est actif
        if (this.active) {
            Object.keys(this.natureConfig).forEach(soundId => {
                this.scheduleInitialPlayback(soundId, this.natureConfig[soundId]);
            });
            console.log('RandomAmbientSounds: Nature sounds resumed');
        }
    }

    // Charger un son individuel (modifié pour supporter les deux configs)
    loadSound(soundId, soundConfig = null) {
        // Si pas de config fournie, chercher dans les deux configs
        if (!soundConfig) {
            soundConfig = this.natureConfig[soundId] || this.digitalConfig[soundId];
        }

        if (!soundConfig) {
            console.warn(`RandomAmbientSounds: No config found for sound ${soundId}`);
            return;
        }

        console.log(`Loading random ambient sound: ${soundId}`);

        // Vérifier si c'est un son avec multiples paths
        if (soundConfig.paths && Array.isArray(soundConfig.paths)) {
            // Charger tous les variants
            this.howls[soundId] = [];
            soundConfig.paths.forEach((pathConfig, index) => {
                const howl = new Howl({
                    src: [pathConfig.path],
                    loop: false,
                    volume: 0,  // Commencer à volume zéro
                    preload: soundConfig.preload,
                    onload: () => {
                        console.log(`Random ambient sound variant loaded: ${soundId}_${index} (${pathConfig.path})`);

                        // Stocker la durée du son pour les calculs de progression
                        const duration = howl.duration();
                        if (!this.soundDurations[soundId]) {
                            this.soundDurations[soundId] = duration; // Utiliser la durée du premier variant
                        }
                        console.log(`Sound ${soundId}_${index} duration: ${duration.toFixed(2)}s`);
                    },
                    onloaderror: (id, error) => console.error(`Error loading random ambient sound ${soundId}_${index}:`, error),
                    onplay: () => {
                        // Enregistrer le début de la lecture
                        this.playingSounds[soundId] = {
                            startTime: Date.now(),
                            duration: (this.soundDurations[soundId] || 0) * 1000 // en ms
                        };
                    },
                    onend: () => {
                        // Supprimer des sons en cours de lecture
                        delete this.playingSounds[soundId];

                        // Lorsque le son se termine, programmer la prochaine lecture
                        if (this.active) {
                            this.scheduleNextPlayback(soundId, soundConfig);
                        }
                    },
                    onstop: () => {
                        // Supprimer des sons en cours de lecture si arrêté manuellement
                        delete this.playingSounds[soundId];
                    }
                });

                this.howls[soundId].push(howl);
            });
        } else {
            // Format classique avec un seul path
            this.howls[soundId] = new Howl({
                src: [soundConfig.path],
                loop: false,
                volume: 0,  // Commencer à volume zéro
                preload: soundConfig.preload,
                onload: () => {
                    console.log(`Random ambient sound loaded: ${soundId}`);

                    // Stocker la durée du son pour les calculs de progression
                    const duration = this.howls[soundId].duration();
                    this.soundDurations[soundId] = duration;
                    console.log(`Sound ${soundId} duration: ${duration.toFixed(2)}s`);
                },
                onloaderror: (id, error) => console.error(`Error loading random ambient sound ${soundId}:`, error),
                onplay: () => {
                    // Enregistrer le début de la lecture
                    this.playingSounds[soundId] = {
                        startTime: Date.now(),
                        duration: this.soundDurations[soundId] * 1000 // en ms
                    };
                },
                onend: () => {
                    // Supprimer des sons en cours de lecture
                    delete this.playingSounds[soundId];

                    // Lorsque le son se termine, programmer la prochaine lecture
                    if (this.active) {
                        this.scheduleNextPlayback(soundId, soundConfig);
                    }
                },
                onstop: () => {
                    // Supprimer des sons en cours de lecture si arrêté manuellement
                    delete this.playingSounds[soundId];
                }
            });
        }
    }

    // Démarrer le système (modifié pour la gestion des phases)
    start() {
        if (this.active) return;
        console.log('Starting RandomAmbientSounds system');

        this.active = true;

        // Démarrer selon la phase actuelle
        if (this.currentPhase === 'nature') {
            // Programmer le premier déclenchement des sons nature
            Object.keys(this.natureConfig).forEach(soundId => {
                this.scheduleInitialPlayback(soundId, this.natureConfig[soundId]);
            });
        } else if (this.currentPhase === 'digital') {
            // Programmer le premier déclenchement des sons digitaux
            this.digitalPhaseStarted = true;
            Object.keys(this.digitalConfig).forEach(soundId => {
                this.scheduleInitialPlayback(soundId, this.digitalConfig[soundId]);
            });
        }
    }

    // Programmer le déclenchement initial d'un son (modifié)
    scheduleInitialPlayback(soundId, soundConfig = null) {
        if (!soundConfig) {
            soundConfig = this.natureConfig[soundId] || this.digitalConfig[soundId];
        }

        if (!soundConfig) return;

        // Vérifier si on doit programmer ce son selon la phase actuelle
        const isNatureSound = !!this.natureConfig[soundId];
        const isDigitalSound = !!this.digitalConfig[soundId];

        if ((this.currentPhase === 'nature' && !isNatureSound) ||
            (this.currentPhase === 'digital' && !isDigitalSound)) {
            return; // Ne pas programmer ce son dans la phase actuelle
        }

        // Délai initial basé sur les intervalles configurés
        const initialDelay = this.getRandomIntervalForSound(soundId, soundConfig);

        // Enregistrer le temps prévu pour la prochaine lecture
        this.nextPlayTimes[soundId] = Date.now() + initialDelay;

        console.log(`Scheduling initial playback for ${soundId} in ${initialDelay/1000}s (${this.currentPhase} phase)`);

        this.timers[soundId] = setTimeout(() => {
            if (this.active) {
                this.playSound(soundId, soundConfig);
            }
        }, initialDelay);
    }

    // Programmer la prochaine lecture d'un son (modifié)
    scheduleNextPlayback(soundId, soundConfig = null) {
        if (!soundConfig) {
            soundConfig = this.natureConfig[soundId] || this.digitalConfig[soundId];
        }

        if (!soundConfig) return;

        // Vérifier si on doit reprogrammer ce son selon la phase actuelle
        const isNatureSound = !!this.natureConfig[soundId];
        const isDigitalSound = !!this.digitalConfig[soundId];

        if ((this.currentPhase === 'nature' && !isNatureSound) ||
            (this.currentPhase === 'digital' && !isDigitalSound)) {
            console.log(`Not rescheduling ${soundId} - wrong phase (current: ${this.currentPhase})`);
            return; // Ne pas reprogrammer ce son dans la phase actuelle
        }

        const nextInterval = this.getRandomIntervalForSound(soundId, soundConfig);

        // Enregistrer le temps prévu pour la prochaine lecture
        this.nextPlayTimes[soundId] = Date.now() + nextInterval;

        console.log(`Next playback of ${soundId} scheduled in ${nextInterval/1000}s after previous playback ended (${this.currentPhase} phase)`);

        this.timers[soundId] = setTimeout(() => {
            if (this.active) {
                this.playSound(soundId, soundConfig);
            }
        }, nextInterval);
    }

    // Obtenir un intervalle aléatoire pour un son donné (modifié)
    getRandomIntervalForSound(soundId, soundConfig = null) {
        if (!soundConfig) {
            soundConfig = this.natureConfig[soundId] || this.digitalConfig[soundId];
        }

        if (!soundConfig) return 30000; // Valeur par défaut

        return (soundConfig.minInterval +
            Math.random() * (soundConfig.maxInterval - soundConfig.minInterval)) * 1000;
    }

    // Choisir aléatoirement un variant basé sur les probabilités (inchangé)
    selectRandomVariant(soundId) {
        const soundConfig = this.natureConfig[soundId] || this.digitalConfig[soundId];
        if (!soundConfig || !soundConfig.paths || !Array.isArray(soundConfig.paths)) {
            return 0; // Index par défaut pour les sons classiques
        }

        const random = Math.random();
        let cumulative = 0;

        for (let i = 0; i < soundConfig.paths.length; i++) {
            cumulative += soundConfig.paths[i].probability;
            if (random <= cumulative) {
                return i;
            }
        }

        // Fallback au dernier variant si les probabilités sont mal configurées
        return soundConfig.paths.length - 1;
    }

    // Obtenir le temps restant avant la prochaine lecture (inchangé)
    getTimeRemaining(soundId) {
        if (!this.nextPlayTimes[soundId]) return null;

        const remaining = Math.max(0, this.nextPlayTimes[soundId] - Date.now());
        return remaining;
    }

    // Obtenir le temps de lecture restant pour un son en cours (inchangé)
    getPlaybackRemainingTime(soundId) {
        if (!this.playingSounds[soundId]) return null;

        const playInfo = this.playingSounds[soundId];
        const elapsed = Date.now() - playInfo.startTime;
        const remaining = Math.max(0, playInfo.duration - elapsed);

        return remaining;
    }

    // Obtenir le pourcentage d'avancement de la lecture (inchangé)
    getPlaybackProgress(soundId) {
        if (!this.playingSounds[soundId]) return null;

        const playInfo = this.playingSounds[soundId];
        const elapsed = Date.now() - playInfo.startTime;
        const progress = Math.min(100, (elapsed / playInfo.duration) * 100);

        return progress;
    }

    // Arrêter le système (modifié pour gérer les deux phases)
    stop() {
        if (!this.active) return;
        console.log('Stopping RandomAmbientSounds system');

        this.active = false;
        this.digitalPhaseStarted = false;

        // Arrêter tous les timers
        Object.keys(this.timers).forEach(soundId => {
            if (this.timers[soundId]) {
                clearTimeout(this.timers[soundId]);
                this.timers[soundId] = null;
                this.nextPlayTimes[soundId] = 0;
            }
        });

        // Arrêter tous les sons en cours
        Object.keys(this.howls).forEach(soundId => {
            const howl = this.howls[soundId];
            if (Array.isArray(howl)) {
                // Sons avec multiples variants
                howl.forEach(h => h.stop());
            } else if (howl) {
                // Son classique
                howl.stop();
            }
        });

        // Vider les informations de lecture
        this.playingSounds = {};

        // Nettoyer l'abonnement timeline
        if (this.timelineSubscription && typeof this.timelineSubscription === 'function') {
            this.timelineSubscription();
            this.timelineSubscription = null;
        }
    }

    // Jouer un son spécifique (modifié)
    playSound(soundId, soundConfig = null) {
        if (!this.active) return;

        if (!soundConfig) {
            soundConfig = this.natureConfig[soundId] || this.digitalConfig[soundId];
        }

        const howl = this.howls[soundId];

        if (!soundConfig || !howl) return;

        // Générer un volume aléatoire
        const volume = soundConfig.minVolume +
            Math.random() * (soundConfig.maxVolume - soundConfig.minVolume);

        // Réinitialiser le temps de prochaine lecture puisque le son commence maintenant
        this.nextPlayTimes[soundId] = 0;

        // Gérer les sons avec multiples variants
        if (Array.isArray(howl)) {
            const variantIndex = this.selectRandomVariant(soundId);
            const selectedHowl = howl[variantIndex];
            const pathInfo = soundConfig.paths[variantIndex];

            console.log(`Playing random ambient sound: ${soundId} variant ${variantIndex} (${pathInfo.path}) (volume: ${volume.toFixed(2)}) (probability: ${(pathInfo.probability * 100).toFixed(1)}%) [${this.currentPhase} phase]`);

            selectedHowl.volume(volume);
            selectedHowl.play();
        } else {
            // Son classique
            console.log(`Playing random ambient sound: ${soundId} (volume: ${volume.toFixed(2)}) [${this.currentPhase} phase]`);

            howl.volume(volume);
            howl.play();
        }
    }

    // Mise à jour de la configuration d'un son (modifié pour supporter les deux configs)
    updateSoundConfig(soundId, newConfig) {
        let targetConfig = null;

        if (this.natureConfig[soundId]) {
            targetConfig = this.natureConfig;
        } else if (this.digitalConfig[soundId]) {
            targetConfig = this.digitalConfig;
        } else {
            console.warn(`Sound ${soundId} not found in any config`);
            return false;
        }

        // Mettre à jour la configuration
        targetConfig[soundId] = {
            ...targetConfig[soundId],
            ...newConfig
        };

        // Maintenir la config combinée pour compatibilité
        this.config = { ...this.natureConfig, ...this.digitalConfig };

        console.log(`Updated config for ${soundId}:`, targetConfig[soundId]);

        return true;
    }

    // Mettre à jour toute la configuration (modifié)
    updateConfig(newConfig) {
        Object.keys(newConfig).forEach(soundId => {
            if (this.natureConfig[soundId] || this.digitalConfig[soundId]) {
                this.updateSoundConfig(soundId, newConfig[soundId]);
            }
        });
    }

    // Obtenir l'état complet des sons (modifié pour inclure les infos de phase)
    getDebugState() {
        const state = {};

        // Combiner les deux configs pour l'état de debug
        const allConfigs = { ...this.natureConfig, ...this.digitalConfig };

        Object.keys(allConfigs).forEach(soundId => {
            const howl = this.howls[soundId];
            const config = allConfigs[soundId];
            let isPlaying = false;
            let currentVolume = 0;

            // Gérer les sons avec multiples variants
            if (Array.isArray(howl)) {
                isPlaying = howl.some(h => h.playing());
                const playingHowl = howl.find(h => h.playing());
                currentVolume = playingHowl ? playingHowl.volume() : 0;
            } else if (howl) {
                isPlaying = howl.playing();
                currentVolume = howl.volume();
            }

            // Déterminer le type de son
            const isNatureSound = !!this.natureConfig[soundId];
            const isDigitalSound = !!this.digitalConfig[soundId];
            const soundType = isNatureSound ? 'nature' : (isDigitalSound ? 'digital' : 'unknown');

            state[soundId] = {
                isPlaying,
                nextPlayTime: this.nextPlayTimes[soundId],
                remainingTime: this.getTimeRemaining(soundId),
                playbackProgress: isPlaying ? this.getPlaybackProgress(soundId) : null,
                playbackRemaining: isPlaying ? this.getPlaybackRemainingTime(soundId) : null,
                currentVolume,
                duration: this.soundDurations[soundId],
                config: { ...config },
                // Infos de phase
                soundType,
                isActiveInCurrentPhase: (
                    (this.currentPhase === 'nature' && isNatureSound) ||
                    (this.currentPhase === 'digital' && isDigitalSound)
                )
            };
        });

        // Ajouter les infos globales de phase
        state._phaseInfo = {
            currentPhase: this.currentPhase,
            phaseTransitionProgress: this.phaseTransitionProgress,
            digitalPhaseStarted: this.digitalPhaseStarted,
            digitalPhaseThreshold: 0.6
        };

        return state;
    }

    // Méthodes utilitaires pour le debug
    getCurrentPhase() {
        return this.currentPhase;
    }

    getPhaseTransitionProgress() {
        return this.phaseTransitionProgress;
    }

    // Forcer la transition de phase (pour debug)
    forcePhaseTransition(phase) {
        if (phase === 'nature') {
            this.transitionToNaturePhase();
        } else if (phase === 'digital') {
            this.transitionToDigitalPhase();
        }
        console.log(`RandomAmbientSounds: Forced transition to ${phase} phase`);
    }
}

export default RandomAmbientSounds;