import { Howl } from 'howler';
import { EventBus } from './EventEmitter';

/**
 * Gestionnaire de narration pour synchroniser les audios et les sous-titres
 */
class NarrationManager {
    constructor() {
        this.currentNarration = null;
        this.currentNarrationId = null;
        this.narrationAudios = new Map();
        this.subtitlesCache = new Map();
        this.initialized = false;

        // Gestion des sous-titres
        this.activeSubtitles = null;
        this.currentSubtitleIndex = -1;
        this.subtitleTimer = null;
        this.subtitleElement = null;

        // Configuration des volumes spécifiques par narration
        this.narrationVolumes = {
            // Narrations avec volume plus élevé (0.3)
            'Scene01_Mission': 0.8,
            'Scene02_PanneauInformation': 0.8,
            'Scene03_SautAuDessusDeLArbre': 0.8,
            'Scene04_RechercheDesIndices': 0.8,
            'Scene04_RechercheDesIndices_part1': 0.8,
            'Scene04_RechercheDesIndices_part2': 0.8,
            'Scene04_RechercheDesIndices_part3': 0.8,
            'Scene05_SautAu-DessusDeLaRiviere': 0.8,
            'Scene06_PassageEn-DessousDeLaBranche': 0.8,
            'Scene07_RemplissageDeLaGourde': 0.8,
            'Scene08_DecouverteDuVisonMort': 0.8,
            'Scene08_DecouverteDuVisonMort_Success': 0.8,
            'Scene09_ClairiereDigitalisee': 0.8,
            'Scene10_Photo1': 0.8,
            'Scene10_Photo2': 0.8,
            'Scene10_Photo3': 0.8,

            'Scene00_Radio1': 0.15,
            'Scene00_Radio2': 0.15,
            'SceneGenerique': 0.2,
            'Scene99_Message1': 0.4,
            'Scene99_Message2': 0.4,
            'Scene99_Message3': 0.4,
            'Scene99_Message4': 0.4,
        };

        // Volume par défaut pour les narrations non spécifiées
        this.defaultNarrationVolume = 0.1;

        // Créer l'élément DOM des sous-titres dès le début
        this.createSubtitleElement();
    }

    /**
     * Obtient le volume configuré pour une narration spécifique
     * @param {string} narrationId - Identifiant de la narration
     * @returns {number} - Volume configuré (entre 0 et 1)
     */
    getNarrationVolume(narrationId) {
        const volume = this.narrationVolumes[narrationId] || this.defaultNarrationVolume;
        console.log(`🔊 NarrationManager: Volume pour ${narrationId}: ${volume}`);
        return volume;
    }

    /**
     * Met à jour le volume d'une narration spécifique
     * @param {string} narrationId - Identifiant de la narration
     * @param {number} volume - Nouveau volume (entre 0 et 1)
     */
    setNarrationVolume(narrationId, volume) {
        this.narrationVolumes[narrationId] = Math.max(0, Math.min(1, volume));
        console.log(`🔊 NarrationManager: Volume mis à jour pour ${narrationId}: ${this.narrationVolumes[narrationId]}`);

        // Si cette narration est actuellement en lecture, mettre à jour son volume
        const audio = this.narrationAudios.get(narrationId);
        if (audio && audio.playing()) {
            audio.volume(this.narrationVolumes[narrationId]);
        }
    }

    /**
     * Crée l'élément DOM pour l'affichage des sous-titres
     */
    createSubtitleElement() {
        // Ne pas exécuter côté serveur
        if (typeof document === 'undefined') return;

        // Ne pas créer plusieurs fois
        if (this.subtitleElement) return;

        this.subtitleElement = document.createElement('div');
        this.subtitleElement.id = 'narration-subtitle';

        // Appliquer exactement le style du SubtitleComponent original
        this.subtitleElement.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            color: #F9FFFB;
            font-size: 16px;
            font-family: "Articulat CF";
            font-weight: 700;
            font-style: italic;
            text-align: center;
            z-index: 12000;
            padding: 8px 16px;
            pointer-events: none;
            width: 90%;
            white-space: pre-line;
            display: none;
        `;

        document.body.appendChild(this.subtitleElement);
        console.log('NarrationManager: Élément de sous-titre créé');
    }

    /**
     * Affiche un sous-titre
     * @param {string} text - Texte à afficher
     */
    showSubtitle(text) {
        if (!this.subtitleElement) this.createSubtitleElement();
        if (!this.subtitleElement) return;

        console.log(`NarrationManager: Affichage sous-titre: "${text}"`);

        const processedText = this._processFormattingTags(text);

        // Use innerHTML instead of textContent to allow HTML formatting
        this.subtitleElement.innerHTML = processedText;
        this.subtitleElement.style.display = 'block';

        // Également émettre l'événement pour compatibilité
        EventBus.trigger('subtitle-changed', { text });
    }

    /**
     * Traite les balises de formatage spéciales dans le texte
     * @param {string} text - Texte à traiter
     * @returns {string} - Texte avec balises HTML
     */
    _processFormattingTags(text) {
        if (!text) return '';

        // Remplacer \strong par <strong>
        let processedText = text.replace(/\\strong\s(.*?)(?:\n|$)/g, '<strong>$1</strong>');

        // Conserver les sauts de ligne (remplacer \n par <br>)
        processedText = processedText.replace(/\n/g, '<br>');

        return processedText;
    }

    /**
     * Cache le sous-titre
     */
    hideSubtitle() {
        if (!this.subtitleElement) return;

        console.log('NarrationManager: Masquage sous-titre');
        this.subtitleElement.style.display = 'none';

        // Également émettre l'événement pour compatibilité
        EventBus.trigger('subtitle-changed', { text: '' });
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('NarrationManager initialized');

        // S'inscrire à l'événement de mise à jour audio pour synchroniser les sous-titres
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Écouter les événements d'audio
        EventBus.on('narration-ended', this._onNarrationEnded.bind(this));
    }

    /**
     * Charge un fichier de sous-titres VTT
     * @param {string} narrationId - Identifiant de la narration
     * @returns {Promise<Array>} - Tableau des sous-titres parsés
     */
    async loadSubtitles(narrationId) {
        // Si les sous-titres sont déjà en cache, les retourner
        if (this.subtitlesCache.has(narrationId)) {
            return this.subtitlesCache.get(narrationId);
        }

        try {
            // Construire le chemin vers le fichier VTT
            const subtitlePath = `/audios/narration/${narrationId}.vtt`;
            console.log(`Loading subtitles from: ${subtitlePath}`);

            // Charger le fichier VTT
            const response = await fetch(subtitlePath);
            if (!response.ok) {
                throw new Error(`Failed to load subtitle file: ${subtitlePath}`);
            }

            const vttContent = await response.text();
            console.log(`VTT content loaded, length: ${vttContent.length}`);

            const parsedSubtitles = this._parseVTT(vttContent);
            console.log(`Parsed subtitles: ${parsedSubtitles.length} entries`);

            // Mettre en cache pour une utilisation future
            this.subtitlesCache.set(narrationId, parsedSubtitles);

            return parsedSubtitles;
        } catch (error) {
            console.error('Error loading subtitles:', error);
            return [];
        }
    }

    /**
     * Analyse un fichier VTT pour en extraire les sous-titres
     * @param {string} vttContent - Contenu du fichier VTT
     * @returns {Array} - Tableau des sous-titres analysés
     */
    _parseVTT(vttContent) {
        const lines = vttContent.trim().split('\n');
        const subtitles = [];

        let currentSubtitle = null;
        let textBuffer = [];
        let lineIndex = 0;

        // Ignorer la première ligne (WEBVTT)
        if (lines[0].includes('WEBVTT')) {
            lineIndex = 1;
        }

        // Parcourir les lignes
        while (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            lineIndex++;

            // Ignorer les lignes vides
            if (line === '') continue;

            // Vérifier si c'est un timestamp (format: 00:00:00.000 --> 00:00:00.000)
            if (line.includes(' --> ')) {
                // Si on avait déjà un sous-titre en cours, l'ajouter au tableau
                if (currentSubtitle && textBuffer.length > 0) {
                    currentSubtitle.text = textBuffer.join('\n');
                    subtitles.push(currentSubtitle);
                    textBuffer = [];
                }

                // Extraire les timestamps
                const [startTime, endTime] = line.split(' --> ').map(this._timeToSeconds);

                // Créer un nouveau sous-titre
                currentSubtitle = {
                    start: startTime,
                    end: endTime,
                    text: ''
                };
            }
            // Si ce n'est pas un timestamp, c'est du texte pour le sous-titre actuel
            else if (currentSubtitle) {
                textBuffer.push(line);
            }
        }

        // Ajouter le dernier sous-titre s'il existe
        if (currentSubtitle && textBuffer.length > 0) {
            currentSubtitle.text = textBuffer.join('\n');
            subtitles.push(currentSubtitle);
        }

        return subtitles;
    }

    /**
     * Convertit un timestamp VTT en secondes
     * @param {string} timeString - Format: 00:00:00.000 ou 00:00.000
     * @returns {number} - Temps en secondes
     */
    _timeToSeconds(timeString) {
        const parts = timeString.split(':');
        let seconds = 0;

        if (parts.length === 3) {  // Format HH:MM:SS.mmm
            seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        } else if (parts.length === 2) {  // Format MM:SS.mmm
            seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        }

        return seconds;
    }

    /**
     * Joue un audio de narration et charge ses sous-titres
     * @param {string} narrationId - Identifiant de la narration (sans extension)
     */
    async playNarration(narrationId) {
        console.log(`🎵 Playing narration: ${narrationId}`);

        // Charger les sous-titres d'abord
        const subtitles = await this.loadSubtitles(narrationId);

        // Obtenir le volume configuré pour cette narration
        const narrationVolume = this.getNarrationVolume(narrationId);

        // Chercher l'audio dans le cache ou le créer
        let narrationAudio = this.narrationAudios.get(narrationId);

        if (!narrationAudio) {
            console.log(`🎵 Creating new Howl for ${narrationId} with volume ${narrationVolume}`);

            narrationAudio = new Howl({
                src: [`/audios/narration/${narrationId}.m4a`],
                html5: true,
                preload: true,
                volume: narrationVolume, // Appliquer le volume configuré
                onend: () => {
                    EventBus.trigger('narration-ended', { narrationId });
                },
                onloaderror: (id, error) => {
                    console.error(`Error loading narration audio ${narrationId}:`, error);
                }
            });

            // Mettre en cache
            this.narrationAudios.set(narrationId, narrationAudio);
        } else {
            // Si l'audio existe déjà, s'assurer qu'il a le bon volume
            console.log(`🎵 Using cached Howl for ${narrationId}, updating volume to ${narrationVolume}`);
            narrationAudio.volume(narrationVolume);
        }

        // Jouer l'audio
        narrationAudio.play();

        // Configurer les sous-titres
        this.currentNarration = narrationAudio;
        this.currentNarrationId = narrationId;
        this.activeSubtitles = subtitles;
        this.currentSubtitleIndex = -1;

        // Notifier que la narration a commencé
        EventBus.trigger('narration-started', {
            narrationId,
            subtitles: subtitles,
            volume: narrationVolume
        });

        // Programmer les sous-titres en fonction de leur timestamp
        for (let i = 0; i < subtitles.length; i++) {
            const subtitle = subtitles[i];
            const duration = subtitle.end - subtitle.start;

            // Programmer l'affichage
            setTimeout(() => {
                // Ne montrer le sous-titre que si la narration est toujours en cours
                if (this.currentNarration === narrationAudio) {
                    this.showSubtitle(subtitle.text);

                    // Programmer la fin de ce sous-titre
                    setTimeout(() => {
                        if (this.currentNarration === narrationAudio) {
                            this.hideSubtitle();
                        }
                    }, duration * 1000);
                }
            }, subtitle.start * 1000);
        }
    }

    /**
     * Nettoie les ressources liées aux sous-titres
     */
    _cleanupSubtitles() {
        if (this.subtitleTimer) {
            clearTimeout(this.subtitleTimer);
            this.subtitleTimer = null;
        }

        this.currentNarration = null;
        this.currentNarrationId = null;
        this.activeSubtitles = null;
        this.currentSubtitleIndex = -1;

        // Masquer le sous-titre
        this.hideSubtitle();
    }

    /**
     * Gère la fin de la narration
     */
    _onNarrationEnded() {
        this._cleanupSubtitles();
    }

    /**
     * Récupère la liste des narrations disponibles
     * @returns {Promise<Array>} - Tableau des narrations disponibles
     */
    async getNarrationList() {
        // Liste statique pour l'instant
        return [
            { id: 'Scene00_Radio1', label: 'Radio 1 (Introduction)' },
            { id: 'Scene00_Radio2', label: 'Radio 2 (Introduction)' },
            { id: 'Scene01_Mission', label: 'Mission (Scène 1)' },
            { id: 'Scene02_PanneauInformation', label: 'Panneau d\'information (Scène 2)' },
            { id: 'Scene03_SautAuDessusDeLArbre', label: 'Saut au-dessus de l\'arbre (Scène 3)' },
            { id: 'Scene04_RechercheDesIndices', label: 'Recherche des indices (Scène 4)' },
            { id: 'Scene05_SautAu-DessusDeLaRiviere', label: 'Saut au-dessus de la rivière (Scène 5)' },
            { id: 'Scene06_PassageEn-DessousDeLaBranche', label: 'Passage en-dessous de la branche (Scène 6)' },
            { id: 'Scene07_RemplissageDeLaGourde', label: 'Remplissage de la gourde (Scène 7)' },
            { id: 'Scene08_DecouverteDuVisonMort', label: 'Découverte du vison mort (Scène 8)' },
            { id: 'Scene08_DecouverteDuVisonMort_Success', label: 'Succès - Découverte du vison mort (Scène 8)'},
            { id: 'Scene09_ClairiereDigitalisee', label: 'Clairière digitalisée (Scène 9)' },
            { id: 'Scene10_Photo1', label: 'Photo 1 - Première tentative (Scène 10)' },
            { id: 'Scene10_Photo2', label: 'Photo 2 - Deuxième tentative (Scène 10)' },
            { id: 'Scene10_Photo3', label: 'Photo 3 - Troisième tentative (Scène 10)' },
            { id: 'SceneGenerique', label: 'Générique de fin' },
            { id: 'Scene99_Message1', label: 'Message 1 (Conclusion)' },
            { id: 'Scene99_Message2', label: 'Message 2 (Conclusion)' },
            { id: 'Scene99_Message3', label: 'Message 3 (Conclusion)' },
        ];
    }

    /**
     * Méthode utilitaire pour tester l'affichage des sous-titres
     */
    testSubtitles() {
        const testTexts = [
            "Premier sous-titre de test",
            "Second sous-titre\nAvec un retour à la ligne",
            "Troisième et dernier sous-titre de test"
        ];

        // Nettoyer l'état actuel
        this._cleanupSubtitles();

        // Afficher chaque sous-titre pendant 2 secondes
        testTexts.forEach((text, index) => {
            setTimeout(() => {
                this.showSubtitle(text);

                // Masquer après 2 secondes, sauf le dernier
                if (index < testTexts.length - 1) {
                    setTimeout(() => this.hideSubtitle(), 1900);
                } else {
                    // Masquer le dernier après 3 secondes
                    setTimeout(() => this.hideSubtitle(), 3000);
                }
            }, index * 2000);
        });
    }

    /**
     * Méthode de debug pour afficher les volumes configurés
     */
    getVolumeConfiguration() {
        console.log('🔊 Configuration des volumes de narration:');
        console.table(this.narrationVolumes);
        console.log(`🔊 Volume par défaut: ${this.defaultNarrationVolume}`);
        return this.narrationVolumes;
    }
}

// Export d'une instance unique (singleton)
export const narrationManager = new NarrationManager();

// Ajouter l'instance à window pour pouvoir y accéder facilement depuis la console
if (typeof window !== 'undefined') {
    window.narrationManager = narrationManager;

    // Exposer les fonctions de configuration de volume pour le debug
    window.setNarrationVolume = (narrationId, volume) => {
        narrationManager.setNarrationVolume(narrationId, volume);
    };

    window.getNarrationVolumes = () => {
        return narrationManager.getVolumeConfiguration();
    };
}

export default narrationManager;