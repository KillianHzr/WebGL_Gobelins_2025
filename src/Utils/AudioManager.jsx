import React, { useEffect } from 'react';
import { Howl, Howler } from 'howler';
import useStore from '../Store/useStore';

// Classe centrale pour gérer l'audio de l'application
class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.ambientSound = null;
        this.initialized = false;
        this.fadeTime = 1000;
    }

    // Initialisation du gestionnaire audio
    init() {
        if (this.initialized) return;

        // Configuration globale de Howler
        Howler.volume(1.0);

        // Charger les sons ici
        this.loadSounds();

        this.initialized = true;
        console.log('AudioManager initialized');
    }

    // Chargement des sons
    loadSounds() {
        // Son ambiant
        this.ambientSound = new Howl({
            src: ['/audios/ambient.wav'],
            loop: true,
            volume: 0.5,
            preload: true,
            onload: () => console.log('Ambient sound loaded'),
            onloaderror: (id, error) => console.error('Error loading ambient sound:', error)
        });

        // Sons ponctuels
        this.addSound('click', {
            src: ['/audios/click.wav'],
            volume: 0.8,
            preload: true,
            onload: () => console.log('Click sound loaded'),
            onloaderror: (id, error) => console.error('Error loading click sound:', error)
        });

        this.addSound('drag', {
            src: ['/audios/drag.wav'],
            volume: 0.8,
            preload: true,
            onload: () => console.log('Drag sound loaded'),
            onloaderror: (id, error) => console.error('Error loading drag sound:', error)
        });

        this.addSound('capture', {
            src: ['/audios/camera_shutter.wav'],
            volume: 0.8,
            preload: true,
            onload: () => console.log('Camera sound loaded'),
            onloaderror: (id, error) => console.error('Error loading camera sound:', error)
        });
    }

    // Ajouter un son à la collection
    addSound(id, options) {
        const sound = new Howl(options);
        this.sounds.set(id, sound);
        return sound;
    }

    // Récupérer un son par son ID
    getSound(id) {
        return this.sounds.get(id);
    }

    /**
     * Joue un son avec possibilité d'effet de fondu
     * @param {string} id - Identifiant du son
     * @param {Object} options - Options de lecture
     * @param {boolean} options.fade - Activer l'effet de fondu
     * @param {number} options.fadeTime - Durée du fondu en ms
     * @param {number} options.volume - Volume du son (0-1)
     * @returns {number|null} - ID du son joué ou null
     */
    playSound(id, options = {}) {
        const sound = this.getSound(id);
        if (!sound) {
            console.warn(`Sound '${id}' not found`);
            return null;
        }

        // Options par défaut
        const {
            fade = false,
            fadeTime = this.fadeTime,
            volume = sound._volume
        } = options;

        if (fade) {
            // Jouer avec effet de fondu
            console.log(`Playing sound '${id}' with fade effect (${fadeTime}ms)`);

            // Régler le volume initial à 0
            sound.volume(0);

            // Jouer le son
            const soundId = sound.play();

            // Appliquer le fondu
            sound.fade(0, volume, fadeTime, soundId);

            return soundId;
        } else {
            // Jouer normalement
            return sound.play();
        }
    }

    /**
     * Arrête un son avec possibilité d'effet de fondu
     * @param {string} id - Identifiant du son
     * @param {Object} options - Options d'arrêt
     * @param {boolean} options.fade - Activer l'effet de fondu
     * @param {number} options.fadeTime - Durée du fondu en ms
     */
    stopSound(id, options = {}) {
        const sound = this.getSound(id);
        if (!sound) {
            console.warn(`Sound '${id}' not found`);
            return;
        }

        // Options par défaut
        const {
            fade = false,
            fadeTime = this.fadeTime
        } = options;

        if (fade) {
            // Arrêter avec effet de fondu
            console.log(`Stopping sound '${id}' with fade effect (${fadeTime}ms)`);

            // Enregistrer le volume actuel
            const currentVolume = sound.volume();

            // Appliquer le fondu
            sound.fade(currentVolume, 0, fadeTime);

            // Arrêter le son après le fondu
            setTimeout(() => {
                sound.stop();
            }, fadeTime);
        } else {
            // Arrêter immédiatement
            sound.stop();
        }
    }

    // Gestion du son ambiant
    playAmbient() {
        if (this.ambientSound) {
            console.log('Playing ambient sound');
            this.ambientSound.volume(0.5);
            this.ambientSound.play();
        }
    }

    pauseAmbient() {
        if (this.ambientSound && this.ambientSound.playing()) {
            console.log('Pausing ambient sound with fade');
            // Fondu sonore avant pause
            this.ambientSound.fade(this.ambientSound.volume(), 0, this.fadeTime);

            // Mettre en pause après le fondu
            setTimeout(() => {
                this.ambientSound.pause();
            }, this.fadeTime);
        }
    }

    resumeAmbient() {
        if (this.ambientSound && !this.ambientSound.playing()) {
            console.log('Resuming ambient sound with fade');
            // Volume à 0 pour commencer
            this.ambientSound.volume(0);

            // Jouer le son
            this.ambientSound.play();

            // Fondu sonore pour augmenter le volume
            this.ambientSound.fade(0, 0.5, this.fadeTime);
        }
    }

    // Contrôle global du volume
    setMasterVolume(value) {
        console.log(`Setting master volume to ${value}`);
        Howler.volume(value);
    }

    // Vérifier si le son ambiant est en cours de lecture
    isAmbientPlaying() {
        return this.ambientSound && this.ambientSound.playing();
    }

    // Nettoyage des ressources
    dispose() {
        console.log('Disposing AudioManager');
        if (this.ambientSound) {
            this.ambientSound.stop();
            this.ambientSound = null;
        }

        this.sounds.forEach(sound => {
            sound.stop();
        });

        this.sounds.clear();
        this.initialized = false;
    }
}

// Export d'une instance unique (singleton)
export const audioManager = new AudioManager();

// Composant React pour intégrer l'AudioManager dans le cycle de vie React
export default function AudioManagerComponent() {
    const { audio } = useStore();

    useEffect(() => {
        // Initialisation
        audioManager.init();

        // Nettoyage lors du démontage
        return () => {
            audioManager.dispose();
        };
    }, []);

    // Synchroniser l'état du store avec l'AudioManager
    useEffect(() => {
        if (audio) {
            if (audio.ambientPlaying && !audioManager.isAmbientPlaying()) {
                audioManager.resumeAmbient();
            } else if (!audio.ambientPlaying && audioManager.isAmbientPlaying()) {
                audioManager.pauseAmbient();
            }

            if (audio.volume !== undefined) {
                audioManager.setMasterVolume(audio.volume);
            }
        }
    }, [audio]);

    // Ce composant ne rend rien visuellement
    return null;
}