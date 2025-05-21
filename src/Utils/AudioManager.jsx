import {useEffect} from 'react';
import {Howl, Howler} from 'howler';
import useStore from '../Store/useStore';
import { narrationManager } from './NarrationManager';
import { EventBus } from './EventEmitter';
import RandomAmbientSounds from './RandomAmbientSounds';

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

        // Ajouter le système de sons aléatoires
        this.randomAmbientSounds = null;

        // Système d'ambiances de rivière
        this.riverSounds = {
            river1: null,
            river2: null,
            river3: null
        };
        this.currentRiverSound = null;

        // Volumes individuels pour chaque son de rivière
        this.riverVolumes = {
            river1: 0.03,  // Volume plus bas pour river1
            river2: 0.2,  // Volume moyen pour river2
            river3: 0.3   // Volume plus élevé pour river3
        };

        // Initialiser à false pour ne pas déclencher au démarrage
        this.riverActive = false;

        // Ajouter les seuils de transition pour les rivières
        this.riverTransitionThresholds = {
            startRiver1: 0.0,   // La rivière 1 commence au début
            startRiver2: 0.25,  // La rivière 2 commence à 35% du parcours
            startRiver3: 0.65,  // La rivière 3 commence à 65% du parcours
            endAllRivers: 0.95  // Tous les sons de rivière s'arrêtent à 95% du parcours
        };
    }

    // Initialisation du gestionnaire audio
    init() {
        if (this.initialized) return;

        // Configuration globale de Howler à un volume modéré
        Howler.volume(0.5);

        // Charger les sons ici
        this.loadSounds();

        // Initialiser le système de sons aléatoires
        this.randomAmbientSounds = new RandomAmbientSounds(this).init();

        // Initialiser le gestionnaire de narration
        narrationManager.init();

        // S'abonner aux événements pertinents
        EventBus.on('narration-ended', (data) => {
            if (data && (data.narrationId === 'Scene00_Radio2')) {
                // console.log('AudioManager: detected radio narration end, will start nature ambience');
                setTimeout(() => this.playNatureAmbience(3000), 500);
            }
        });

        EventBus.on('interface-action', (data) => {
            if (data.type === 'capture' && data.action === 'close' && data.result === 'complete') {
                // console.log('AudioManager: detected capture completion, will transition to digital ambience');
                setTimeout(() => this.playDigitalAmbience(3000), 500);
            }
        });

        // S'abonner à l'événement de position normalisée de la timeline pour les sons de rivière
        // Mais ne les activer que lorsque riverActive est true
        EventBus.on('timeline-position-normalized', (data) => {
            if (this.riverActive) {
                this.updateRiverSoundBasedOnPosition(data.position);
            }
        });

        this.initialized = true;
        // console.log('AudioManager initialized with extremely low ambience volume');

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
                    // console.log('Nature ambience loaded');

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
                    // console.log('Digital ambience loaded');

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
            onloaderror: (id, error) => console.error('Error loading click sound:', error)
        });

        this.addSound('drag', {
            src: ['/audios/drag.wav'],
            volume: 0.8,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading drag sound:', error)
        });

        this.addSound('capture', {
            src: ['/audios/camera_shutter.wav'],
            volume: 0.8,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading camera sound:', error)
        });
        this.addSound('ultrasound', {
            src: ['/audios/ultrasound.mp3'],
            volume: 0.9,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading camera sound:', error)
        });

        // Sons pour le scanner
        this.addSound('scan-start', {
            src: ['/audios/scan_start.wav'],
            volume: 0.4,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading scan start sound:', error)
        });

        this.addSound('scan-cancel', {
            src: ['/audios/scan_cancel.wav'],
            volume: 0.5,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading scan cancel sound:', error)
        });

        this.addSound('scan-complete', {
            src: ['/audios/scan_complete.wav'],
            volume: 0.5,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading scan complete sound:', error)
        });

        this.addSound('radio-on', {
            src: ['/audios/radio_on.wav'],
            volume: 0.8,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading radio on sound:', error)
        });

        this.addSound('radio-off', {
            src: ['/audios/radio_off.wav'],
            volume: 0.8,
            preload: true,
            onloaderror: (id, error) => console.error('Error loading radio off sound:', error)
        });

        // Charger les sons de rivière avec volume 0 initialement
        // console.log('RIVER SOUND: Loading river1 sound...');
        this.riverSounds.river1 = new Howl({
            src: ['/audios/river1.wav'],
            loop: true,
            volume: 0, // On démarre à 0 et on n'autoplay pas
            preload: true,
            onloaderror: (id, error) => console.error('RIVER SOUND: Error loading river1 sound:', error)
        });

        // console.log('RIVER SOUND: Loading river2 sound...');
        this.riverSounds.river2 = new Howl({
            src: ['/audios/river2.wav'],
            loop: true,
            volume: 0,
            preload: true,
            onloaderror: (id, error) => console.error('RIVER SOUND: Error loading river2 sound:', error)
        });

        // console.log('RIVER SOUND: Loading river3 sound...');
        this.riverSounds.river3 = new Howl({
            src: ['/audios/river3.wav'],
            loop: true,
            volume: 0,
            preload: true,
            onloaderror: (id, error) => console.error('RIVER SOUND: Error loading river3 sound:', error)
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
        // console.log(`RADICAL CHANGE: Switching to nature ambience`);

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
                    volume: 3, // Volume explicitement plus élevé (20%)
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
            // console.log("NATURE AMBIENCE STARTED WITH VOLUME:", this.natureAmbience.volume());

            // NOUVEAU: Démarrer le système de sons aléatoires
            if (this.randomAmbientSounds) {
                this.randomAmbientSounds.start();
            }

            // IMPORTANT: Activer le système de rivière et démarrer river1 ici
            // console.log("RIVER SOUND: Activating river sounds system along with nature ambience");
            this.riverActive = true;

            // Démarrer immédiatement river1
            // On force la transition vers le premier son de rivière
            this.transitionToRiverSound(this.riverSounds.river1, fadeTime);
            // console.log("RIVER SOUND: Started river1 sound alongside nature ambience");

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

    // Méthode pour gérer la transition entre sons de rivière basée sur la position normalisée
    updateRiverSoundBasedOnPosition(normalizedPosition) {
        // Vérifier si les sons de rivière sont actifs
        if (!this.riverActive) {
            return;
        }

        // Déterminer quel son de rivière doit être joué en fonction de la position
        let targetRiverSound = null;
        let riverName = "none";

        if (normalizedPosition >= this.riverTransitionThresholds.endAllRivers) {
            // Au-delà du seuil final, aucun son de rivière ne devrait jouer
            targetRiverSound = null;
            riverName = "none (past end threshold)";
        } else if (normalizedPosition >= this.riverTransitionThresholds.startRiver3) {
            // Entre le seuil de river3 et le seuil final
            targetRiverSound = this.riverSounds.river3;
            riverName = "river3";
        } else if (normalizedPosition >= this.riverTransitionThresholds.startRiver2) {
            // Entre le seuil de river2 et le seuil de river3
            targetRiverSound = this.riverSounds.river2;
            riverName = "river2";
        } else if (normalizedPosition >= this.riverTransitionThresholds.startRiver1) {
            // Entre le début et le seuil de river2
            targetRiverSound = this.riverSounds.river1;
            riverName = "river1";
        }

        // Si le son cible est différent du son actuel, effectuer la transition
        if (targetRiverSound !== this.currentRiverSound) {
            // console.log(`RIVER SOUND: Position ${normalizedPosition.toFixed(2)} triggered transition to ${riverName}`);
            this.transitionToRiverSound(targetRiverSound);
        }
    }

    // Méthode pour effectuer la transition entre les sons de rivière
    transitionToRiverSound(newSound, fadeTime = 3000) {
        let newSoundName = "none";
        if (newSound === this.riverSounds.river1) newSoundName = "river1";
        else if (newSound === this.riverSounds.river2) newSoundName = "river2";
        else if (newSound === this.riverSounds.river3) newSoundName = "river3";

        let currentSoundName = "none";
        if (this.currentRiverSound === this.riverSounds.river1) currentSoundName = "river1";
        else if (this.currentRiverSound === this.riverSounds.river2) currentSoundName = "river2";
        else if (this.currentRiverSound === this.riverSounds.river3) currentSoundName = "river3";

        // console.log(`RIVER SOUND: Transitioning from ${currentSoundName} to ${newSoundName} (fade: ${fadeTime}ms)`);

        // Arrêter progressivement le son actuel s'il existe
        if (this.currentRiverSound && this.currentRiverSound.playing()) {
            const currentVolume = this.currentRiverSound.volume();
            // console.log(`RIVER SOUND: Fading out ${currentSoundName} from volume ${currentVolume} to 0`);

            this.currentRiverSound.fade(currentVolume, 0, fadeTime);

            // Créer une variable locale pour stocker la référence du son actuel
            const previousSound = this.currentRiverSound;

            setTimeout(() => {
                previousSound.stop();
                // console.log(`RIVER SOUND: ${currentSoundName} stopped after fade out`);
            }, fadeTime);
        }

        // Démarrer le nouveau son s'il existe
        if (newSound) {
            // Déterminer le volume cible basé sur le son spécifique
            let targetVolume = 0.3; // Valeur par défaut sécurisée

            if (newSound === this.riverSounds.river1) {
                targetVolume = this.riverVolumes.river1;
            } else if (newSound === this.riverSounds.river2) {
                targetVolume = this.riverVolumes.river2;
            } else if (newSound === this.riverSounds.river3) {
                targetVolume = this.riverVolumes.river3;
            }

            // IMPORTANT: Vérification de sécurité pour le volume (doit être entre 0 et 1)
            if (targetVolume > 1.0) {
                console.warn(`RIVER SOUND: Volume for ${newSoundName} was too high (${targetVolume}), capped to 1.0`);
                targetVolume = 1.0;
            }

            // console.log(`RIVER SOUND: Starting ${newSoundName} with target volume ${targetVolume}`);

            // Démarrer avec un volume à 0 pour le fade-in
            newSound.volume(0);
            const soundId = newSound.play();

            if (soundId === null) {
                console.error(`RIVER SOUND: Failed to play ${newSoundName}. Trying again...`);
                // Tentative supplémentaire si le premier play échoue
                setTimeout(() => {
                    const retryId = newSound.play();
                    if (retryId === null) {
                        console.error(`RIVER SOUND: Second attempt to play ${newSoundName} failed.`);
                    } else {
                        newSound.fade(0, targetVolume, fadeTime, retryId);
                        // console.log(`RIVER SOUND: ${newSoundName} started successfully on retry`);
                    }
                }, 100);
            } else {
                newSound.fade(0, targetVolume, fadeTime, soundId);
                // console.log(`RIVER SOUND: ${newSoundName} fade-in started (0 to ${targetVolume})`);
            }

            // Mettre à jour la référence du son actuel
            this.currentRiverSound = newSound;

            // Ajouter une vérification après la transition pour s'assurer que le son joue toujours
            setTimeout(() => {
                if (this.currentRiverSound === newSound && !newSound.playing()) {
                    console.error(`RIVER SOUND: ${newSoundName} stopped playing unexpectedly! Restarting...`);
                    newSound.volume(targetVolume);
                    newSound.play();
                } else if (this.currentRiverSound === newSound) {
                    // console.log(`RIVER SOUND: ${newSoundName} is playing correctly after transition`);
                }
            }, fadeTime + 500); // Vérifier juste après la fin de la transition
        } else {
            console.log(`RIVER SOUND: No new river sound to play, setting currentRiverSound to null`);
            this.currentRiverSound = null;
        }
    }

    forcePlayRiverSound(riverName, volume = null) {
        console.log(`RIVER SOUND: Forcing playback of ${riverName}`);

        let selectedSound = null;
        let targetVolume = null;

        if (riverName === 'river1') {
            selectedSound = this.riverSounds.river1;
            targetVolume = volume !== null ? volume : this.riverVolumes.river1;
        } else if (riverName === 'river2') {
            selectedSound = this.riverSounds.river2;
            targetVolume = volume !== null ? volume : this.riverVolumes.river2;
        } else if (riverName === 'river3') {
            selectedSound = this.riverSounds.river3;
            targetVolume = volume !== null ? volume : this.riverVolumes.river3;
        }

        if (selectedSound) {
            // Arrêter tout son de rivière en cours
            this.stopAllRiverSounds(500);

            // Attendre que tout soit arrêté
            setTimeout(() => {
                // S'assurer que le volume est dans une plage acceptable
                if (targetVolume > 1.0) targetVolume = 1.0;
                if (targetVolume < 0) targetVolume = 0;

                selectedSound.volume(targetVolume);
                selectedSound.play();
                this.currentRiverSound = selectedSound;
                this.riverActive = true;

                console.log(`RIVER SOUND: ${riverName} forced to play at volume ${targetVolume}`);
            }, 600);
        }

        return `Trying to force play ${riverName}. Check console for results.`;
    }

    // Méthode pour arrêter tous les sons de rivière
    stopAllRiverSounds(fadeTime = 1000) {
        console.log(`RIVER SOUND: Stopping all river sounds (fade: ${fadeTime}ms)`);

        Object.entries(this.riverSounds).forEach(([key, sound]) => {
            if (sound && sound.playing()) {
                const currentVolume = sound.volume();
                console.log(`RIVER SOUND: Stopping ${key} (current volume: ${currentVolume})`);

                sound.fade(currentVolume, 0, fadeTime);
                setTimeout(() => {
                    sound.stop();
                    console.log(`RIVER SOUND: ${key} stopped after fade out`);
                }, fadeTime);
            }
        });

        // Désactiver le système de rivière
        this.riverActive = false;
        this.currentRiverSound = null;
        console.log(`RIVER SOUND: River sound system deactivated`);
    }

    // Méthode pour ajuster le volume des sons de rivière
    setRiverVolumes(volumes) {
        // volumes doit être un objet comme {river1: 0.2, river2: 0.3, river3: 0.4}
        console.log(`RIVER SOUND: Setting new river volumes:`, volumes);

        if (volumes.river1 !== undefined) {
            this.riverVolumes.river1 = volumes.river1;
            // Appliquer immédiatement si c'est le son actuel
            if (this.currentRiverSound === this.riverSounds.river1) {
                this.currentRiverSound.volume(volumes.river1);
                console.log(`RIVER SOUND: Applied new volume ${volumes.river1} to currently playing river1`);
            }
        }

        if (volumes.river2 !== undefined) {
            this.riverVolumes.river2 = volumes.river2;
            if (this.currentRiverSound === this.riverSounds.river2) {
                this.currentRiverSound.volume(volumes.river2);
                console.log(`RIVER SOUND: Applied new volume ${volumes.river2} to currently playing river2`);
            }
        }

        if (volumes.river3 !== undefined) {
            this.riverVolumes.river3 = volumes.river3;
            if (this.currentRiverSound === this.riverSounds.river3) {
                this.currentRiverSound.volume(volumes.river3);
                console.log(`RIVER SOUND: Applied new volume ${volumes.river3} to currently playing river3`);
            }
        }
    }

    // Jouer l'ambiance digitale avec un volume EXTRÊMEMENT bas
    playDigitalAmbience(fadeTime = 2000) {
        console.log(`RADICAL CHANGE: Switching to digital ambience`);

        try {
            // NOUVEAU: Arrêter le système de sons aléatoires
            if (this.randomAmbientSounds) {
                this.randomAmbientSounds.stop();
            }

            // Arrêter tous les sons de rivière
            this.stopAllRiverSounds(fadeTime);

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

    // Méthodes pour configurer les sons aléatoires
    updateRandomSoundConfig(soundId, config) {
        if (this.randomAmbientSounds) {
            return this.randomAmbientSounds.updateSoundConfig(soundId, config);
        }
        return false;
    }

    updateAllRandomSoundsConfig(config) {
        if (this.randomAmbientSounds) {
            this.randomAmbientSounds.updateConfig(config);
            return true;
        }
        return false;
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

        // NOUVEAU: Arrêter et nettoyer le système de sons aléatoires
        if (this.randomAmbientSounds) {
            this.randomAmbientSounds.stop();
            this.randomAmbientSounds = null;
        }

        this.currentAmbience = null;

        this.sounds.forEach(sound => {
            sound.stop();
        });

        // Nettoyer les sons de rivière
        console.log('RIVER SOUND: Cleaning up river sounds');
        Object.entries(this.riverSounds).forEach(([key, sound]) => {
            if (sound) {
                sound.stop();
                console.log(`RIVER SOUND: Stopped ${key} during cleanup`);
            }
        });
        this.riverSounds = { river1: null, river2: null, river3: null };
        this.currentRiverSound = null;
        this.riverActive = false;

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

        // Exposer la fonction setRiverVolumes à la fenêtre pour permettre de la modifier facilement
        window.setRiverVolumes = (volumes) => {
            if (audioManager) {
                audioManager.setRiverVolumes(volumes);
                console.log("RIVER SOUND: Volumes updated via global function");
            }
        };

        // Exposer la fonction forcePlayRiverSound pour le débogage
        window.forcePlayRiverSound = (riverName, volume) => {
            if (audioManager) {
                return audioManager.forcePlayRiverSound(riverName, volume);
            }
        };

        // NOUVEAU: Exposer les fonctions pour configurer les sons aléatoires
        window.updateRandomSoundConfig = (soundId, config) => {
            if (audioManager) {
                return audioManager.updateRandomSoundConfig(soundId, config);
            }
        };

        window.updateAllRandomSoundsConfig = (config) => {
            if (audioManager) {
                return audioManager.updateAllRandomSoundsConfig(config);
            }
        };

        // Nettoyage lors du démontage
        return () => {
            audioManager.dispose();
            // Nettoyer les fonctions globales
            delete window.setRiverVolumes;
            delete window.forcePlayRiverSound;
            delete window.updateRandomSoundConfig;
            delete window.updateAllRandomSoundsConfig;
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