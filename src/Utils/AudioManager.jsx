import {useEffect} from 'react';
import {Howl, Howler} from 'howler';
import useStore from '../Store/useStore';
import { narrationManager } from './NarrationManager';
import { EventBus } from './EventEmitter';

// Classe centrale pour gérer l'audio de l'application
class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.ambientSound = null;
        this.natureAmbience = null;
        this.digitalAmbience = null;
        this.initialized = false;
        this.fadeTime = 1000;
        this.ambienceVolume = 1;
        this.currentAmbience = null;
    }

    // Initialisation du gestionnaire audio
    init() {
        if (this.initialized) return;

        // Configuration globale de Howler à un volume modéré
        Howler.volume(0.5);

        // Charger les sons ici
        this.loadSounds();

        // Initialiser le gestionnaire de narration
        narrationManager.init();

        // S'abonner aux événements pertinents
        EventBus.on('narration-ended', (data) => {
            if (data && (data.narrationId === 'Scene00_Radio2')) {
                console.log('AudioManager: detected radio narration end, will start nature ambience');
                setTimeout(() => this.playNatureAmbience(3000), 500);
            }
        });

        EventBus.on('interface-action', (data) => {
            if (data.type === 'capture' && data.action === 'close' && data.result === 'complete') {
                console.log('AudioManager: detected capture completion, will transition to digital ambience');
                setTimeout(() => this.playDigitalAmbience(3000), 500);
            }
        });

        this.initialized = true;
        console.log('AudioManager initialized with extremely low ambience volume');

        // Rendre l'instance accessible globalement pour faciliter les appels
        window.audioManager = this;
    }

    // Chargement des sons
    loadSounds() {
        // Son ambiant original (garder pour compatibilité)
        this.ambientSound = new Howl({
            src: ['/audios/ambient.wav'],
            loop: true,
            volume: 0.5,
            preload: true,
            onload: () => console.log('Ambient sound loaded'),
            onloaderror: (id, error) => console.error('Error loading ambient sound:', error)
        });

        // Création des ambiances avec un volume EXTRÊMEMENT bas
        try {
            // Nouvelle ambiance sonore nature
            this.natureAmbience = new Howl({
                src: ['/audios/compos/MoodNatureLoop.mp3'],
                loop: true,
                volume: 0, // Commence à 0 pour le fade
                preload: true,
                onload: () => {
                    console.log('Nature ambience loaded');

                    // Forcer un volume très bas dès le chargement
                    this.natureAmbience._volume = this.ambienceVolume;
                    if (this.natureAmbience._sounds && this.natureAmbience._sounds.length > 0) {
                        this.natureAmbience._sounds[0]._node.volume = this.ambienceVolume;
                    }
                },
                onloaderror: (id, error) => console.error('Error loading nature ambience:', error)
            });

            // Nouvelle ambiance sonore digitale
            this.digitalAmbience = new Howl({
                src: ['/audios/compos/MoodDigitalLoop.mp3'],
                loop: true,
                volume: 0, // Commence à 0 pour le fade
                preload: true,
                onload: () => {
                    console.log('Digital ambience loaded');

                    // Forcer un volume très bas dès le chargement
                    this.digitalAmbience._volume = this.ambienceVolume;
                    if (this.digitalAmbience._sounds && this.digitalAmbience._sounds.length > 0) {
                        this.digitalAmbience._sounds[0]._node.volume = this.ambienceVolume;
                    }
                },
                onloaderror: (id, error) => console.error('Error loading digital ambience:', error)
            });
        } catch (e) {
            console.error('Error setting up ambience sounds:', e);
        }

        // Sons ponctuels (inchangés)
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
this.addSound('ultrasound', {
            src: ['/audios/ultrasound.mp3'],
            volume: 0.9,
            preload: true,
            onload: () => console.log('Camera sound loaded'),
            onloaderror: (id, error) => console.error('Error loading camera sound:', error)
        });

        // Sons pour le scanner
        this.addSound('scan-start', {
            src: ['/audios/scan_start.wav'],
            volume: 0.4,
            preload: true,
            onload: () => console.log('Scan start sound loaded'),
            onloaderror: (id, error) => console.error('Error loading scan start sound:', error)
        });

        this.addSound('scan-cancel', {
            src: ['/audios/scan_cancel.wav'],
            volume: 0.5,
            preload: true,
            onload: () => console.log('Scan cancel sound loaded'),
            onloaderror: (id, error) => console.error('Error loading scan cancel sound:', error)
        });

        this.addSound('scan-complete', {
            src: ['/audios/scan_complete.wav'],
            volume: 0.5,
            preload: true,
            onload: () => console.log('Scan complete sound loaded'),
            onloaderror: (id, error) => console.error('Error loading scan complete sound:', error)
        });

        this.addSound('radio-on', {
            src: ['/audios/radio_on.wav'],
            volume: 0.8,
            preload: true,
            onload: () => console.log('Radio on sound loaded'),
            onloaderror: (id, error) => console.error('Error loading radio on sound:', error)
        });

        this.addSound('radio-off', {
            src: ['/audios/radio_off.wav'],
            volume: 0.8,
            preload: true,
            onload: () => console.log('Radio off sound loaded'),
            onloaderror: (id, error) => console.error('Error loading radio off sound:', error)
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

    // Jouer l'ambiance nature avec un volume EXTRÊMEMENT bas
    playNatureAmbience(fadeTime = 2000) {
        console.log(`RADICAL CHANGE: Switching to nature ambience`);

        try {
            // 1. ARRÊTER COMPLÈTEMENT l'ambiance précédente
            if (this.digitalAmbience) {
                this.digitalAmbience.stop();
            }

            if (this.currentAmbience && this.currentAmbience !== this.natureAmbience) {
                this.currentAmbience.stop();
            }

            // 2. S'assurer que l'ambiance nature est chargée
            if (!this.natureAmbience) {
                // Recréer l'ambiance si elle n'existe pas
                this.natureAmbience = new Howl({
                    src: ['/audios/compos/MoodNatureLoop.mp3'],
                    loop: true,
                    volume: 2, // Volume explicitement plus élevé (20%)
                    preload: true
                });
            } else {
                // Réinitialiser le volume à une valeur audible
                this.natureAmbience.volume(2);
            }

            // 3. Démarrer l'ambiance nature immédiatement à son volume cible
            this.natureAmbience.play();

            // 4. Mettre à jour la référence de l'ambiance courante
            this.currentAmbience = this.natureAmbience;

            // Logs de vérification
            console.log("NATURE AMBIENCE STARTED WITH VOLUME:", this.natureAmbience.volume());

            // 5. Mettre à jour l'état du store
            try {
                const store = useStore.getState();
                if (store && store.audio) {
                    store.audio.setAmbienceType('nature');
                    store.audio.ambientPlaying = true;
                }
            } catch (e) {
                console.warn('Unable to update store state', e);
            }
        } catch (error) {
            console.error("Error playing nature ambience:", error);
        }
    }

    // Jouer l'ambiance digitale avec un volume EXTRÊMEMENT bas
    playDigitalAmbience(fadeTime = 2000) {
        console.log(`RADICAL CHANGE: Switching to digital ambience`);

        try {
            // 1. ARRÊTER COMPLÈTEMENT l'ambiance précédente
            if (this.natureAmbience) {
                this.natureAmbience.stop();
            }

            if (this.currentAmbience && this.currentAmbience !== this.digitalAmbience) {
                this.currentAmbience.stop();
            }

            // 2. S'assurer que l'ambiance digitale est chargée
            if (!this.digitalAmbience) {
                // Recréer l'ambiance si elle n'existe pas pour une raison quelconque
                this.digitalAmbience = new Howl({
                    src: ['/audios/compos/MoodDigitalLoop.mp3'],
                    loop: true,
                    volume: 2, // Volume explicitement plus élevé (20%)
                    preload: true
                });
            } else {
                // Réinitialiser le volume à une valeur audible mais pas trop forte
                this.digitalAmbience.volume(2);
            }

            // 3. Démarrer l'ambiance digitale immédiatement à son volume cible
            this.digitalAmbience.play();

            // 4. Mettre à jour la référence de l'ambiance courante
            this.currentAmbience = this.digitalAmbience;

            // Logs de vérification
            console.log("DIGITAL AMBIENCE STARTED WITH VOLUME:", this.digitalAmbience.volume());

            // 5. Mettre à jour l'état du store
            try {
                const store = useStore.getState();
                if (store && store.audio) {
                    store.audio.setAmbienceType('digital');
                    store.audio.ambientPlaying = true;
                }
            } catch (e) {
                console.warn('Unable to update store state', e);
            }
        } catch (error) {
            console.error("Error playing digital ambience:", error);
        }
    }

    // Méthode pour forcer un volume EXTRÊMEMENT bas pour les ambiances
    forceVeryLowVolume() {
        console.log("FORCING ULTRA-LOW VOLUME FOR AMBIENCES");

        try {
            // Accès plus direct à l'API Web Audio pour forcer le volume au minimum
            if (this.natureAmbience) {
                this.natureAmbience.volume(this.ambienceVolume);

                // Manipulation directe des nœuds audio
                if (this.natureAmbience._sounds) {
                    for (let sound of this.natureAmbience._sounds) {
                        if (sound._node) {
                            sound._node.volume = this.ambienceVolume;
                        }
                    }
                }
            }

            if (this.digitalAmbience) {
                this.digitalAmbience.volume(this.ambienceVolume);

                // Manipulation directe des nœuds audio
                if (this.digitalAmbience._sounds) {
                    for (let sound of this.digitalAmbience._sounds) {
                        if (sound._node) {
                            sound._node.volume = this.ambienceVolume;
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error forcing low volume:", error);
        }
    }

    /**
     * Joue un son avec possibilité d'effet de fondu
     * @param {string} id - Identifiant du son
     * @param {{fade: boolean, fadeTime: number}} options - Options de lecture
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

    // Gestion du son ambiant (pour compatibilité)
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

        if (this.currentAmbience && this.currentAmbience.playing()) {
            console.log('Pausing current ambience with fade');
            this.currentAmbience.fade(this.currentAmbience.volume(), 0, this.fadeTime);
            setTimeout(() => {
                this.currentAmbience.pause();
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

        if (this.currentAmbience && !this.currentAmbience.playing()) {
            console.log('Resuming current ambience with fade');
            this.currentAmbience.volume(0);
            this.currentAmbience.play();
            this.currentAmbience.fade(0, this.ambienceVolume, this.fadeTime);
        }
    }

    // Méthodes pour la narration
    playNarration(narrationId) {
        console.log(`Playing narration: ${narrationId}`);
        return narrationManager.playNarration(narrationId);
    }

    // Contrôle global du volume
    setMasterVolume(value) {
        console.log(`Setting master volume to ${value}`);
        Howler.volume(value);

        // Si ce n'est pas muet, mettre aussi à jour le volume des ambiances
        if (value > 0) {
            // Garder le volume des ambiances extrêmement bas
            this.ambienceVolume = Math.min(value * 0.01, 0.5);
            this.forceVeryLowVolume();
        }
    }

    // Vérifier si le son ambiant est en cours de lecture
    isAmbientPlaying() {
        return (this.ambientSound && this.ambientSound.playing()) ||
            (this.currentAmbience && this.currentAmbience.playing());
    }

    // Nettoyage des ressources
    dispose() {
        console.log('Disposing AudioManager');
        if (this.ambientSound) {
            this.ambientSound.stop();
            this.ambientSound = null;
        }

        if (this.natureAmbience) {
            this.natureAmbience.stop();
            this.natureAmbience = null;
        }

        if (this.digitalAmbience) {
            this.digitalAmbience.stop();
            this.digitalAmbience = null;
        }

        this.currentAmbience = null;

        this.sounds.forEach(sound => {
            sound.stop();
        });

        this.sounds.clear();
        this.initialized = false;
    }
}

// Export d'une instance unique (singleton)
export let audioManager = new AudioManager();

// Composant React pour intégrer l'AudioManager dans le cycle de vie React
export default function AudioManagerComponent() {
    const {audio} = useStore();

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