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

        // Configuration par défaut
        this.config = {
            bird_voices: {
                path: '/audios/randoms/bird_voices.mp3',
                minInterval: 30,
                maxInterval: 60,
                minVolume: 0.05,
                maxVolume: 0.15,
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
    }

    // Initialiser le système
    init() {
        console.log('Initializing RandomAmbientSounds system');

        // Charger tous les sons
        Object.keys(this.config).forEach(soundId => {
            this.loadSound(soundId);
            this.nextPlayTimes[soundId] = 0; // Initialiser les temps
        });

        return this;
    }

    // Charger un son individuel
    loadSound(soundId) {
        const soundConfig = this.config[soundId];
        if (!soundConfig) return;

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
                            this.scheduleNextPlayback(soundId);
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
                        this.scheduleNextPlayback(soundId);
                    }
                },
                onstop: () => {
                    // Supprimer des sons en cours de lecture si arrêté manuellement
                    delete this.playingSounds[soundId];
                }
            });
        }
    }

    // Démarrer le système
    start() {
        if (this.active) return;
        console.log('Starting RandomAmbientSounds system');

        this.active = true;

        // Programmer le premier déclenchement de chaque son avec un délai initial respectant les intervalles configurés
        Object.keys(this.config).forEach(soundId => {
            this.scheduleInitialPlayback(soundId);
        });
    }

    // Programmer le déclenchement initial d'un son
    scheduleInitialPlayback(soundId) {
        const soundConfig = this.config[soundId];
        if (!soundConfig) return;

        // Délai initial basé sur les intervalles configurés
        const initialDelay = this.getRandomIntervalForSound(soundId);

        // Enregistrer le temps prévu pour la prochaine lecture
        this.nextPlayTimes[soundId] = Date.now() + initialDelay;

        console.log(`Scheduling initial playback for ${soundId} in ${initialDelay/1000}s`);

        this.timers[soundId] = setTimeout(() => {
            if (this.active) {
                this.playSound(soundId);
            }
        }, initialDelay);
    }

    // Programmer la prochaine lecture d'un son
    scheduleNextPlayback(soundId) {
        const nextInterval = this.getRandomIntervalForSound(soundId);

        // Enregistrer le temps prévu pour la prochaine lecture
        this.nextPlayTimes[soundId] = Date.now() + nextInterval;

        console.log(`Next playback of ${soundId} scheduled in ${nextInterval/1000}s after previous playback ended`);

        this.timers[soundId] = setTimeout(() => {
            if (this.active) {
                this.playSound(soundId);
            }
        }, nextInterval);
    }

    // Obtenir un intervalle aléatoire pour un son donné
    getRandomIntervalForSound(soundId) {
        const soundConfig = this.config[soundId];
        if (!soundConfig) return 30000; // Valeur par défaut

        return (soundConfig.minInterval +
            Math.random() * (soundConfig.maxInterval - soundConfig.minInterval)) * 1000;
    }

    // Choisir aléatoirement un variant basé sur les probabilités
    selectRandomVariant(soundId) {
        const soundConfig = this.config[soundId];
        if (!soundConfig.paths || !Array.isArray(soundConfig.paths)) {
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

    // Obtenir le temps restant avant la prochaine lecture (pour l'interface de débogage)
    getTimeRemaining(soundId) {
        if (!this.nextPlayTimes[soundId]) return null;

        const remaining = Math.max(0, this.nextPlayTimes[soundId] - Date.now());
        return remaining;
    }

    // Obtenir le temps de lecture restant pour un son en cours (pour l'interface de débogage)
    getPlaybackRemainingTime(soundId) {
        if (!this.playingSounds[soundId]) return null;

        const playInfo = this.playingSounds[soundId];
        const elapsed = Date.now() - playInfo.startTime;
        const remaining = Math.max(0, playInfo.duration - elapsed);

        return remaining;
    }

    // Obtenir le pourcentage d'avancement de la lecture (pour l'interface de débogage)
    getPlaybackProgress(soundId) {
        if (!this.playingSounds[soundId]) return null;

        const playInfo = this.playingSounds[soundId];
        const elapsed = Date.now() - playInfo.startTime;
        const progress = Math.min(100, (elapsed / playInfo.duration) * 100);

        return progress;
    }

    // Arrêter le système
    stop() {
        if (!this.active) return;
        console.log('Stopping RandomAmbientSounds system');

        this.active = false;

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
    }

    // Jouer un son spécifique
    playSound(soundId) {
        if (!this.active) return;

        const soundConfig = this.config[soundId];
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

            console.log(`Playing random ambient sound: ${soundId} variant ${variantIndex} (${pathInfo.path}) (volume: ${volume.toFixed(2)}) (probability: ${(pathInfo.probability * 100).toFixed(1)}%)`);

            selectedHowl.volume(volume);
            selectedHowl.play();
        } else {
            // Son classique
            console.log(`Playing random ambient sound: ${soundId} (volume: ${volume.toFixed(2)})`);

            howl.volume(volume);
            howl.play();
        }
    }

    // Mise à jour de la configuration d'un son
    updateSoundConfig(soundId, newConfig) {
        if (!this.config[soundId]) {
            console.warn(`Sound ${soundId} not found in config`);
            return false;
        }

        // Mettre à jour la configuration
        this.config[soundId] = {
            ...this.config[soundId],
            ...newConfig
        };

        console.log(`Updated config for ${soundId}:`, this.config[soundId]);

        return true;
    }

    // Mettre à jour toute la configuration
    updateConfig(newConfig) {
        Object.keys(newConfig).forEach(soundId => {
            if (this.config[soundId]) {
                this.updateSoundConfig(soundId, newConfig[soundId]);
            }
        });
    }

    // Obtenir l'état complet des sons (pour le débogage)
    getDebugState() {
        const state = {};

        Object.keys(this.config).forEach(soundId => {
            const howl = this.howls[soundId];
            const config = this.config[soundId];
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

            state[soundId] = {
                isPlaying,
                nextPlayTime: this.nextPlayTimes[soundId],
                remainingTime: this.getTimeRemaining(soundId),
                playbackProgress: isPlaying ? this.getPlaybackProgress(soundId) : null,
                playbackRemaining: isPlaying ? this.getPlaybackRemainingTime(soundId) : null,
                currentVolume,
                duration: this.soundDurations[soundId],
                config: { ...config }
            };
        });

        return state;
    }
}

export default RandomAmbientSounds;