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

        // Créer l'élément DOM des sous-titres dès le début
        this.createSubtitleElement();
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
            font-family: Roboto, sans-serif;
            font-weight: 600;
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
        console.log(`Playing narration: ${narrationId}`);

        // Charger les sous-titres d'abord
        const subtitles = await this.loadSubtitles(narrationId);

        // Chercher l'audio dans le cache ou le créer
        let narrationAudio = this.narrationAudios.get(narrationId);

        if (!narrationAudio) {
            narrationAudio = new Howl({
                src: [`/audios/narration/${narrationId}.m4a`],
                html5: true,
                preload: true,
                onend: () => {
                    EventBus.trigger('narration-ended', { narrationId });
                },
                onloaderror: (id, error) => {
                    console.error(`Error loading narration audio ${narrationId}:`, error);
                }
            });

            // Mettre en cache
            this.narrationAudios.set(narrationId, narrationAudio);
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
            subtitles: subtitles
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
            { id: 'Scene00_Radio', label: 'Radio (Introduction)' },
            { id: 'Scene01_Mission', label: 'Mission (Scène 1)' },
            { id: 'Scene02_PanneauInformation', label: 'Panneau d\'information (Scène 2)' },
            { id: 'Scene03_SautAuDessusDeLArbre', label: 'Saut au-dessus de l\'arbre (Scène 3)' },
            { id: 'Scene04_RechercheDesIndices', label: 'Recherche des indices (Scène 4)' },
            { id: 'Scene05_SautAu-DessusDeLaRiviere', label: 'Saut au-dessus de la rivière (Scène 5)' },
            { id: 'Scene06_PassageEn-DessousDeLaBranche', label: 'Passage en-dessous de la branche (Scène 6)' },
            { id: 'Scene07_RemplissageDeLaGourde', label: 'Remplissage de la gourde (Scène 7)' },
            { id: 'Scene08_DecouverteDuVisonMort', label: 'Découverte du vison mort (Scène 8)' },
            { id: 'Scene09_ClairiereDigitalisee', label: 'Clairière digitalisée (Scène 9)' },
            { id: 'SceneGenerique', label: 'Générique de fin' }
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
}

// Export d'une instance unique (singleton)
export const narrationManager = new NarrationManager();

// Ajouter l'instance à window pour pouvoir y accéder facilement depuis la console
if (typeof window !== 'undefined') {
    window.narrationManager = narrationManager;
}

export default narrationManager;