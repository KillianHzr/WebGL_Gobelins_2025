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
                // C'est ici qu'on calcule l'intervalle entre la fin de ce son et le début du prochain
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
            if (this.howls[soundId]) {
                this.howls[soundId].stop();
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

        console.log(`Playing random ambient sound: ${soundId} (volume: ${volume.toFixed(2)})`);

        // Réinitialiser le temps de prochaine lecture puisque le son commence maintenant
        this.nextPlayTimes[soundId] = 0;

        // Définir le volume et jouer le son
        howl.volume(volume);
        howl.play();

        // Note: La programmation du prochain son est gérée par l'événement onend
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
            const isPlaying = howl ? howl.playing() : false;

            state[soundId] = {
                isPlaying,
                nextPlayTime: this.nextPlayTimes[soundId],
                remainingTime: this.getTimeRemaining(soundId),
                playbackProgress: isPlaying ? this.getPlaybackProgress(soundId) : null,
                playbackRemaining: isPlaying ? this.getPlaybackRemainingTime(soundId) : null,
                currentVolume: howl ? howl.volume() : 0,
                duration: this.soundDurations[soundId],
                config: { ...config }
            };
        });

        return state;
    }
}

export default RandomAmbientSounds;