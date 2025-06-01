#!/bin/bash

# Script pour optimiser récursivement les fichiers GLB/glTF
# avec compression Draco pour compatibilité Three.js
# Utilise la syntaxe correcte de gltf-transform CLI

SOURCE_DIR="./models_original"
OUTPUT_DIR="./models_optimized"

# Configuration
TEXTURE_SIZE=1024         # Taille max des textures
TEXTURE_FORMAT="webp"     # Format de compression (webp, ktx2, avif)
DRACO_METHOD="edgebreaker" # Méthode Draco (edgebreaker ou sequential)
WEBP_QUALITY=85           # Qualité WebP (0-100)
WELD_TOLERANCE=0.0001     # Tolérance pour weld
RESAMPLE_TOLERANCE=0.001  # Tolérance pour le resampling d'animations

echo "🚀 Optimisation GLB/glTF avec compression Draco"
echo "🔍 Parcours de $SOURCE_DIR pour optimisation..."
echo "📁 Dossier de destination : $OUTPUT_DIR"
echo "🗜️  Configuration:"
echo "   - Méthode Draco: $DRACO_METHOD"
echo "   - Textures: $TEXTURE_FORMAT max ${TEXTURE_SIZE}px (qualité $WEBP_QUALITY)"
echo "   - Weld tolerance: $WELD_TOLERANCE"
echo "   - Resample tolerance: $RESAMPLE_TOLERANCE"
echo ""

# Vérification des dépendances
if ! command -v gltf-transform &> /dev/null; then
    echo "❌ Erreur: gltf-transform n'est pas installé."
    echo "📥 Installation: npm install -g @gltf-transform/cli"
    exit 1
fi

# Vérification de la version
GLTF_VERSION=$(gltf-transform --version 2>/dev/null | head -n1)
echo "🔧 Version gltf-transform: $GLTF_VERSION"
echo ""

# Création du dossier de sortie
mkdir -p "$OUTPUT_DIR"

# Variables globales pour les statistiques
declare -g total_original_size=0
declare -g total_optimized_size=0
declare -g success_count=0
declare -g error_count=0

# Fonction pour détecter les animations
has_animations() {
    local file="$1"
    if gltf-transform inspect "$file" 2>/dev/null | grep -q "animations"; then
        return 0  # A des animations
    else
        return 1  # Pas d'animations
    fi
}

# Fonction pour optimiser un fichier avec la bonne syntaxe
optimize_file() {
    local input_file="$1"
    local output_path="$2"
    local file_number="$3"
    local total_files="$4"

    local relative_path="${input_file#$SOURCE_DIR/}"
    echo "[$file_number/$total_files] 🔧 Optimisation : $relative_path"

    # Détection des animations
    local has_anim=false
    if has_animations "$input_file"; then
        has_anim=true
        echo "  🎬 Animations détectées - optimisations d'animations activées"
    fi

    # Méthode 1: Utiliser la commande optimize (limitée mais efficace)
    echo "  🔄 Optimisation avec commande optimize..."
    if gltf-transform optimize "$input_file" "$output_path" \
        --compress draco \
        --texture-compress "$TEXTURE_FORMAT" 2>/dev/null; then

        echo "  ✅ Optimisation de base réussie"

        # Appliquer les optimisations supplémentaires en chaîne
        local temp_file="$output_path.tmp"
        local current_file="$output_path"

        # Resize des textures si nécessaire
        echo "  🔄 Redimensionnement des textures..."
        if gltf-transform resize "$current_file" "$temp_file" \
            --width "$TEXTURE_SIZE" --height "$TEXTURE_SIZE" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ Textures redimensionnées"
        fi

        # WebP avec qualité spécifique
        echo "  🔄 Compression WebP avec qualité $WEBP_QUALITY..."
        if gltf-transform webp "$current_file" "$temp_file" --quality "$WEBP_QUALITY" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ WebP appliqué"
        fi

        # Weld (fusion des vertices)
        echo "  🔄 Fusion des vertices..."
        if gltf-transform weld "$current_file" "$temp_file" --tolerance "$WELD_TOLERANCE" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ Weld appliqué"
        fi

        # Join (fusion des meshes)
        echo "  🔄 Fusion des meshes..."
        if gltf-transform join "$current_file" "$temp_file" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ Join appliqué"
        fi

        # Instance (création d'instances)
        echo "  🔄 Création d'instances..."
        if gltf-transform instance "$current_file" "$temp_file" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ Instance appliqué"
        fi

        # Optimisations spécifiques aux animations
        if [[ "$has_anim" == true ]]; then
            echo "  🔄 Optimisation des animations..."

            # Resample (ré-échantillonnage)
            if gltf-transform resample "$current_file" "$temp_file" --tolerance "$RESAMPLE_TOLERANCE" 2>/dev/null; then
                mv "$temp_file" "$current_file"
                echo "  ✅ Resample appliqué"
            fi

            # Sparse (compression sparse)
            if gltf-transform sparse "$current_file" "$temp_file" 2>/dev/null; then
                mv "$temp_file" "$current_file"
                echo "  ✅ Sparse appliqué"
            fi
        fi

        # Prune final (nettoyage)
        echo "  🔄 Nettoyage final..."
        if gltf-transform prune "$current_file" "$temp_file" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ Prune appliqué"
        fi

        success_count=$((success_count + 1))
        return 0
    fi

    # Méthode 2: Pipeline manuel étape par étape
    echo "  ⚠️  Échec de optimize, tentative pipeline manuel..."

    # Copie de base
    cp "$input_file" "$output_path"
    local current_file="$output_path"
    local temp_file="$output_path.tmp"

    # Draco en premier
    echo "  🔄 Compression Draco..."
    if gltf-transform draco "$current_file" "$temp_file" --method "$DRACO_METHOD" 2>/dev/null; then
        mv "$temp_file" "$current_file"
        echo "  ✅ Draco appliqué"
    fi

    # Resize des textures
    echo "  🔄 Redimensionnement des textures..."
    if gltf-transform resize "$current_file" "$temp_file" \
        --width "$TEXTURE_SIZE" --height "$TEXTURE_SIZE" 2>/dev/null; then
        mv "$temp_file" "$current_file"
        echo "  ✅ Textures redimensionnées"
    fi

    # WebP
    echo "  🔄 Compression WebP..."
    if gltf-transform webp "$current_file" "$temp_file" --quality "$WEBP_QUALITY" 2>/dev/null; then
        mv "$temp_file" "$current_file"
        echo "  ✅ WebP appliqué"
    fi

    # Weld
    echo "  🔄 Fusion des vertices..."
    if gltf-transform weld "$current_file" "$temp_file" --tolerance "$WELD_TOLERANCE" 2>/dev/null; then
        mv "$temp_file" "$current_file"
        echo "  ✅ Weld appliqué"
    fi

    # Join
    echo "  🔄 Fusion des meshes..."
    if gltf-transform join "$current_file" "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$current_file"
        echo "  ✅ Join appliqué"
    fi

    # Instance
    echo "  🔄 Création d'instances..."
    if gltf-transform instance "$current_file" "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$current_file"
        echo "  ✅ Instance appliqué"
    fi

    # Optimisations d'animations si nécessaire
    if [[ "$has_anim" == true ]]; then
        echo "  🔄 Optimisation des animations..."

        if gltf-transform resample "$current_file" "$temp_file" --tolerance "$RESAMPLE_TOLERANCE" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ Resample appliqué"
        fi

        if gltf-transform sparse "$current_file" "$temp_file" 2>/dev/null; then
            mv "$temp_file" "$current_file"
            echo "  ✅ Sparse appliqué"
        fi
    fi

    # Prune final
    echo "  🔄 Nettoyage final..."
    if gltf-transform prune "$current_file" "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$current_file"
        echo "  ✅ Prune appliqué"
    fi

    success_count=$((success_count + 1))
    return 0
}

# Fonction pour calculer les statistiques de taille
calculate_size_stats() {
    local input_file="$1"
    local output_file="$2"

    if [[ -f "$input_file" && -f "$output_file" ]]; then
        local original_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file" 2>/dev/null || echo "0")
        local optimized_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")

        if [[ "$original_size" != "0" && "$optimized_size" != "0" ]]; then
            local reduction=$((100 - (optimized_size * 100 / original_size)))

            # Formatage des tailles
            local orig_formatted opt_formatted
            if command -v numfmt &> /dev/null; then
                orig_formatted=$(numfmt --to=iec "$original_size")
                opt_formatted=$(numfmt --to=iec "$optimized_size")
            else
                orig_formatted="${original_size} bytes"
                opt_formatted="${optimized_size} bytes"
            fi

            echo "  📊 Taille: $orig_formatted → $opt_formatted (${reduction}% de réduction)"

            total_original_size=$((total_original_size + original_size))
            total_optimized_size=$((total_optimized_size + optimized_size))
        fi
    fi
}

# Recherche et traitement des fichiers
count=0
total_files=$(find "$SOURCE_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f | wc -l)

if [ "$total_files" -eq 0 ]; then
    echo "❌ Aucun fichier GLB/glTF trouvé dans $SOURCE_DIR"
    exit 1
fi

echo "📊 $total_files fichiers trouvés"
echo ""

# Traitement des fichiers
while IFS= read -r input_file; do
    count=$((count + 1))

    # Calcul du chemin de sortie
    relative_path="${input_file#$SOURCE_DIR/}"
    output_path="$OUTPUT_DIR/$relative_path"

    # Création des dossiers nécessaires
    mkdir -p "$(dirname "$output_path")"

    # Optimisation du fichier
    optimize_file "$input_file" "$output_path" "$count" "$total_files"

    # Calcul des statistiques
    calculate_size_stats "$input_file" "$output_path"

    echo ""
done < <(find "$SOURCE_DIR" \( -iname "*.glb" -o -iname "*.gltf" \) -type f)

# Statistiques finales
echo "🎉 Optimisation terminée !"
echo ""
echo "📊 Statistiques:"
echo "   - Fichiers traités: $total_files"
echo "   - Succès: $success_count"
echo "   - Erreurs: $error_count"

if [[ $total_original_size -gt 0 && $total_optimized_size -gt 0 ]]; then
    local total_reduction=$((100 - (total_optimized_size * 100 / total_original_size)))

    local total_orig_formatted total_opt_formatted
    if command -v numfmt &> /dev/null; then
        total_orig_formatted=$(numfmt --to=iec $total_original_size)
        total_opt_formatted=$(numfmt --to=iec $total_optimized_size)
    else
        total_orig_formatted="${total_original_size} bytes"
        total_opt_formatted="${total_optimized_size} bytes"
    fi

    echo "   - Taille totale: $total_orig_formatted → $total_opt_formatted"
    echo "   - Réduction totale: ${total_reduction}%"
fi

echo ""
echo "💡 Optimisations appliquées séquentiellement:"
echo "   ✅ Compression Draco ($DRACO_METHOD)"
echo "   ✅ Textures redimensionnées ($TEXTURE_SIZE px max)"
echo "   ✅ Compression $TEXTURE_FORMAT (qualité $WEBP_QUALITY)"
echo "   ✅ Weld (tolerance $WELD_TOLERANCE) - fusion des vertices"
echo "   ✅ Join - fusion des meshes"
echo "   ✅ Instance - création d'instances pour les meshes dupliqués"
echo "   ✅ Resample (tolerance $RESAMPLE_TOLERANCE) - pour les animations"
echo "   ✅ Sparse - compression sparse des animations"
echo "   ✅ Prune - nettoyage des données inutilisées"
echo ""
echo "💡 Pour Three.js avec Draco, configurez votre loader:"
echo ""
echo "📝 Code Three.js:"
cat << 'EOF'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Configuration du DRACOLoader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/'); // Chemin vers les décodeurs
dracoLoader.preload();

// Configuration du GLTFLoader
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// Chargement du modèle optimisé
gltfLoader.load('model_optimized.glb', (gltf) => {
    scene.add(gltf.scene);
});

// N'oubliez pas de nettoyer
dracoLoader.dispose();
EOF

echo ""
echo "📦 Téléchargez les décodeurs Draco depuis:"
echo "   https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
echo "   Fichiers requis: draco_decoder.js et draco_decoder.wasm"
echo ""
echo "🔗 Documentation complète:"
echo "   https://gltf-transform.dev/cli"