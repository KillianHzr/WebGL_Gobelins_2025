#!/bin/bash

# Script d'optimisation des textures pour Three.js - Version Bash 3.x Compatible
# Compatible avec la structure du TextureManager fourni
# Utilise ImageMagick v7 (magick) et les outils natifs macOS
# Correction: Création ORM individuelle par basename de modèle (100% compatible Bash 3.x)

# Configuration
SOURCE_DIR="./textures"
OUTPUT_DIR="./textures_optimized"
TEMP_DIR="./temp_texture_processing"

# Paramètres d'optimisation
DESKTOP_TEXTURE_SIZE=1024      # Taille pour desktop
MOBILE_TEXTURE_SIZE=512        # Taille pour mobile
WEBP_QUALITY=85               # Qualité WebP
JPEG_QUALITY=85               # Qualité JPEG
PNG_COMPRESSION=9             # Compression PNG

echo "🚀 Optimisation des textures pour Three.js (Version Bash 3.x Compatible)"
echo "🎯 Compatible avec votre TextureManager"
echo "🔧 Correction: ORM créée individuellement par basename de modèle"
echo "📁 Source: $SOURCE_DIR"
echo "📁 Destination: $OUTPUT_DIR"
echo ""

# Fonction pour détecter la version d'ImageMagick et définir la commande
detect_imagemagick_version() {
    if command -v magick >/dev/null 2>&1; then
        # ImageMagick v7
        MAGICK_CMD="magick"
        MAGICK_VERSION="7"
        echo "✅ ImageMagick v7 détecté (commande: magick)"
    elif command -v convert >/dev/null 2>&1; then
        # ImageMagick v6 ou convert system
        if convert -version 2>/dev/null | grep -q "ImageMagick"; then
            MAGICK_CMD="convert"
            MAGICK_VERSION="6"
            echo "✅ ImageMagick v6 détecté (commande: convert)"
        else
            echo "⚠️  Convert système détecté (non ImageMagick)"
            return 1
        fi
    else
        echo "❌ ImageMagick non trouvé"
        return 1
    fi
    return 0
}

# Vérification des dépendances basiques
check_basic_dependencies() {
    echo "🔍 Vérification des dépendances basiques..."

    local missing_tools=""

    # ImageMagick
    if ! detect_imagemagick_version; then
        missing_tools="ImageMagick"
    fi

    # SIPS (natif macOS)
    if ! command -v sips >/dev/null 2>&1; then
        if [ -n "$missing_tools" ]; then
            missing_tools="$missing_tools SIPS"
        else
            missing_tools="SIPS"
        fi
    fi

    if [ -n "$missing_tools" ]; then
        echo "❌ Outils manquants: $missing_tools"
        echo ""
        echo "📥 Installation rapide:"
        echo "   brew install imagemagick"
        echo ""
        echo "💡 Le script peut fonctionner avec SIPS uniquement (natif macOS)"
        echo "   mais ImageMagick offre de meilleures performances"
        echo ""

        # Demander si on continue avec SIPS seulement
        if command -v sips >/dev/null 2>&1; then
            echo "🤔 Continuer avec SIPS uniquement ? (y/n)"
            read -r response
            if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
                USE_SIPS_ONLY="true"
                echo "✅ Utilisation de SIPS pour l'optimisation"
            else
                exit 1
            fi
        else
            exit 1
        fi
    else
        USE_SIPS_ONLY="false"
        echo "✅ Toutes les dépendances sont disponibles"
    fi

    # Vérifier les outils optionnels
    PNGQUANT_AVAILABLE="false"
    OXIPNG_AVAILABLE="false"

    if command -v pngquant >/dev/null 2>&1; then
        PNGQUANT_AVAILABLE="true"
        echo "✅ pngquant détecté (optimisation PNG avancée disponible)"
    fi

    if command -v oxipng >/dev/null 2>&1; then
        OXIPNG_AVAILABLE="true"
        echo "✅ oxipng détecté (compression PNG maximale disponible)"
    fi

    echo ""
}

# Création des dossiers
setup_directories() {
    echo "📁 Création de la structure de dossiers..."

    mkdir -p "$OUTPUT_DIR"
    mkdir -p "$TEMP_DIR"

    # Créer les sous-dossiers pour desktop et mobile
    mkdir -p "$OUTPUT_DIR/desktop"
    mkdir -p "$OUTPUT_DIR/mobile"

    echo "✅ Structure de dossiers créée"
    echo ""
}

# Fonction pour détecter le type de texture basé sur le nom de fichier
detect_texture_type() {
    local filename="$1"
    local basename_lower
    basename_lower=$(basename "$filename" | tr '[:upper:]' '[:lower:]')

    if echo "$basename_lower" | grep -E "(basecolor|diffuse|albedo)" >/dev/null; then
        echo "basecolor"
    elif echo "$basename_lower" | grep "normal" >/dev/null; then
        if echo "$basename_lower" | grep "opengl" >/dev/null; then
            echo "normal_opengl"
        else
            echo "normal"
        fi
    elif echo "$basename_lower" | grep "roughness" >/dev/null; then
        echo "roughness"
    elif echo "$basename_lower" | grep -E "(metallic|metalness)" >/dev/null; then
        echo "metalness"
    elif echo "$basename_lower" | grep -E "(height|displacement)" >/dev/null; then
        echo "height"
    elif echo "$basename_lower" | grep "alpha" >/dev/null; then
        echo "alpha"
    elif echo "$basename_lower" | grep "opacity" >/dev/null; then
        echo "opacity"
    elif echo "$basename_lower" | grep -E "(ao|occlusion)" >/dev/null; then
        echo "ao"
    elif echo "$basename_lower" | grep -E "(emission|emissive)" >/dev/null; then
        echo "emissive"
    else
        echo "unknown"
    fi
}

# Fonction pour optimiser une texture avec SIPS (natif macOS)
optimize_texture_with_sips() {
    local input_file="$1"
    local output_dir="$2"
    local target_size="$3"
    local texture_type="$4"

    local filename
    filename=$(basename "$input_file")
    local name_without_ext="${filename%.*}"

    # Déterminer le format de sortie selon le type de texture
    local output_format="png"
    local output_quality=""

    case "$texture_type" in
        "basecolor"|"emissive")
            output_format="jpeg"
            output_quality="--setProperty quality $JPEG_QUALITY"
            ;;
        *)
            output_format="png"
            ;;
    esac

    # Redimensionner et optimiser avec SIPS
    if [ "$output_format" = "jpeg" ]; then
        sips -s format jpeg \
             -z "$target_size" "$target_size" \
             $output_quality \
             "$input_file" \
             --out "$output_dir/${name_without_ext}.jpg" >/dev/null 2>&1
    else
        sips -s format png \
             -z "$target_size" "$target_size" \
             "$input_file" \
             --out "$output_dir/${name_without_ext}.png" >/dev/null 2>&1
    fi
}

# Fonction pour optimiser une texture avec ImageMagick (compatible v6 et v7)
optimize_texture_with_imagemagick() {
    local input_file="$1"
    local output_dir="$2"
    local target_size="$3"
    local texture_type="$4"

    local filename
    filename=$(basename "$input_file")
    local name_without_ext="${filename%.*}"

    echo "  🔧 Optimisation: $filename (type: $texture_type)"

    # Définir les paramètres selon le type de texture
    local output_format="png"
    local quality=$PNG_COMPRESSION

    case "$texture_type" in
        "basecolor"|"emissive")
            # Essayer WebP d'abord, fallback sur JPEG
            if $MAGICK_CMD -list format | grep -q "WEBP"; then
                output_format="webp"
                quality=$WEBP_QUALITY
            else
                output_format="jpg"
                quality=$JPEG_QUALITY
            fi
            ;;
        "normal"|"normal_opengl"|"roughness"|"metalness"|"ao"|"height"|"alpha"|"opacity")
            output_format="png"
            quality=95
            ;;
        *)
            output_format="png"
            quality=$PNG_COMPRESSION
            ;;
    esac

    # Optimisation avec ImageMagick (compatible v6 et v7)
    case "$output_format" in
        "webp")
            $MAGICK_CMD "$input_file" \
                -resize "${target_size}x${target_size}>" \
                -strip \
                -quality "$quality" \
                "$output_dir/${name_without_ext}.webp" 2>/dev/null
            ;;
        "jpg")
            $MAGICK_CMD "$input_file" \
                -resize "${target_size}x${target_size}>" \
                -strip \
                -quality "$quality" \
                "$output_dir/${name_without_ext}.jpg" 2>/dev/null
            ;;
        "png")
            $MAGICK_CMD "$input_file" \
                -resize "${target_size}x${target_size}>" \
                -strip \
                -depth 8 \
                "$TEMP_DIR/temp_${filename}" 2>/dev/null

            # Utiliser pngquant si disponible pour les textures couleur
            if [ "$PNGQUANT_AVAILABLE" = "true" ] && [ "$texture_type" = "basecolor" ]; then
                pngquant --quality=80-95 --strip \
                    "$TEMP_DIR/temp_${filename}" \
                    -o "$TEMP_DIR/quant_${filename}" 2>/dev/null

                if [ -f "$TEMP_DIR/quant_${filename}" ]; then
                    mv "$TEMP_DIR/quant_${filename}" "$TEMP_DIR/temp_${filename}"
                fi
            fi

            # Utiliser oxipng si disponible
            if [ "$OXIPNG_AVAILABLE" = "true" ]; then
                oxipng -o 4 --strip safe \
                    "$TEMP_DIR/temp_${filename}" \
                    --out "$output_dir/${filename}" \
                    >/dev/null 2>&1
            else
                mv "$TEMP_DIR/temp_${filename}" "$output_dir/${filename}"
            fi

            # Nettoyer
            rm -f "$TEMP_DIR/temp_${filename}"
            ;;
    esac
}

# Fonction principale d'optimisation
optimize_texture() {
    local input_file="$1"
    local output_dir="$2"
    local target_size="$3"
    local platform="$4"

    local texture_type
    texture_type=$(detect_texture_type "$input_file")

    if [ "$USE_SIPS_ONLY" = "true" ]; then
        optimize_texture_with_sips "$input_file" "$output_dir" "$target_size" "$texture_type"
    else
        optimize_texture_with_imagemagick "$input_file" "$output_dir" "$target_size" "$texture_type"
    fi
}

# Fonction CORRIGÉE pour extraire le basename d'un fichier de texture
extract_model_basename() {
    local filename="$1"
    local name_without_ext="${filename%.*}"

    # Supprimer les suffixes de types de texture communs pour obtenir le basename du modèle
    local basename="$name_without_ext"

    echo "    🔍 Analyse fichier: $filename" >&2

    # Supprimer les suffixes en mode case-insensitive
    local suffix_found=""
    for suffix in "_BaseColor" "_Diffuse" "_Albedo" "_Color" "_Col" "_Normal" "_NormalOpenGL" "_NormalDirectX" "_Norm" "_Nrm" "_Roughness" "_Rough" "_Rgh" "_Metallic" "_Metalness" "_Metal" "_Met" "_Height" "_Displacement" "_Disp" "_Hgt" "_AO" "_Occlusion" "_AmbientOcclusion" "_Ambient" "_Emissive" "_Emission" "_Emit" "_Glow" "_Alpha" "_Opacity" "_Mask" "_Specular" "_Spec" "_Gloss" "_Glossiness"; do
        # Convertir en minuscules pour la comparaison
        local basename_lower
        basename_lower=$(echo "$basename" | tr '[:upper:]' '[:lower:]')
        local suffix_lower
        suffix_lower=$(echo "$suffix" | tr '[:upper:]' '[:lower:]')

        if echo "$basename_lower" | grep -q "$suffix_lower$"; then
            # Supprimer le suffixe en préservant la casse originale
            local suffix_length=${#suffix}
            basename="${basename:0:${#basename}-$suffix_length}"
            suffix_found="$suffix"
            echo "    ✂️  Suffixe détecté et supprimé: $suffix_found" >&2
            break
        fi
    done

    # Si aucun suffixe trouvé, retourner le nom complet comme basename
    if [ -z "$suffix_found" ]; then
        echo "    ⚠️  Aucun suffixe reconnu dans: $filename" >&2
        echo "    💡 Utilisation du nom complet comme basename: $basename" >&2
    fi

    # Supprimer les tirets bas et traits d'union en fin de nom
    basename=$(echo "$basename" | sed 's/[_-]*$//')

    echo "    ➡️  Basename extrait: '$basename'" >&2

    # Validation du basename
    if [ -z "$basename" ] || [ "$basename" = "." ] || [ "$basename" = ".." ]; then
        echo "    ❌ Basename invalide, utilisation du nom complet" >&2
        basename="$name_without_ext"
    fi

    echo "$basename"
}

# Fonction CORRIGÉE pour créer une texture ORM par modèle distinct (compatible Bash 3.x)
create_individual_orm_textures() {
    local material_dir="$1"
    local output_dir="$2"
    local target_size="$3"
    local platform="$4"

    echo "  🔍 Analyse des modèles individuels dans le dossier..."

    # Utiliser des fichiers temporaires au lieu de tableaux associatifs (compatible Bash 3.x)
    local temp_models="$TEMP_DIR/models_list.txt"
    local temp_ao="$TEMP_DIR/ao_files.txt"
    local temp_roughness="$TEMP_DIR/roughness_files.txt"
    local temp_metalness="$TEMP_DIR/metalness_files.txt"

    # Nettoyer les fichiers temporaires
    > "$temp_models"
    > "$temp_ao"
    > "$temp_roughness"
    > "$temp_metalness"

    # Phase 1: Analyser tous les fichiers et les regrouper par basename
    for file in "$material_dir"/*; do
        if [ -f "$file" ]; then
            local filename
            filename=$(basename "$file")
            local ext="${filename##*.}"

            # Vérifier que c'est une image
            if echo "$ext" | grep -E "^(png|jpg|jpeg|tga|tiff|bmp)$" >/dev/null; then
                echo "  📄 Analyse du fichier: $filename"

                local model_basename
                model_basename=$(extract_model_basename "$filename")
                local texture_type
                texture_type=$(detect_texture_type "$filename")

                # Ajouter le modèle à la liste s'il n'y est pas déjà
                if ! grep -q "^$model_basename$" "$temp_models"; then
                    echo "$model_basename" >> "$temp_models"
                fi

                echo "  🎯 Basename: '$model_basename', Type: '$texture_type'"

                # Regrouper selon le type de texture
                case "$texture_type" in
                    "ao")
                        echo "$model_basename|$file" >> "$temp_ao"
                        echo "    🔴 AO ajouté pour modèle '$model_basename'"
                        ;;
                    "roughness")
                        echo "$model_basename|$file" >> "$temp_roughness"
                        echo "    🟢 Roughness ajouté pour modèle '$model_basename'"
                        ;;
                    "metalness")
                        echo "$model_basename|$file" >> "$temp_metalness"
                        echo "    🔵 Metalness ajouté pour modèle '$model_basename'"
                        ;;
                    *)
                        echo "    ⚪ Type '$texture_type' ignoré pour ORM"
                        ;;
                esac
            fi
        fi
    done

    local models_list
    models_list=$(cat "$temp_models")
    echo "  📊 Modèles découverts: $models_list"

    local orm_created=0

    # Phase 2: Créer une texture ORM pour chaque modèle ayant au moins 1 composant
    while IFS= read -r model_basename; do
        if [ -n "$model_basename" ]; then
            echo ""
            echo "  🎨 Traitement du modèle: '$model_basename'"

            # Chercher les composants pour ce modèle
            local ao_file=""
            local roughness_file=""
            local metalness_file=""

            # Rechercher AO
            if [ -f "$temp_ao" ]; then
                ao_file=$(grep "^$model_basename|" "$temp_ao" | cut -d'|' -f2 | head -1)
            fi

            # Rechercher Roughness
            if [ -f "$temp_roughness" ]; then
                roughness_file=$(grep "^$model_basename|" "$temp_roughness" | cut -d'|' -f2 | head -1)
            fi

            # Rechercher Metalness
            if [ -f "$temp_metalness" ]; then
                metalness_file=$(grep "^$model_basename|" "$temp_metalness" | cut -d'|' -f2 | head -1)
            fi

            # Compter les composants trouvés
            local components_found=0
            [ -n "$ao_file" ] && components_found=$((components_found + 1))
            [ -n "$roughness_file" ] && components_found=$((components_found + 1))
            [ -n "$metalness_file" ] && components_found=$((components_found + 1))

            echo "    📊 Composants ORM trouvés pour '$model_basename': $components_found/3"
            [ -n "$ao_file" ] && echo "      🔴 AO: $(basename "$ao_file")"
            [ -n "$roughness_file" ] && echo "      🟢 Roughness: $(basename "$roughness_file")"
            [ -n "$metalness_file" ] && echo "      🔵 Metalness: $(basename "$metalness_file")"

            # Créer la texture ORM si on a au moins 1 composant et ImageMagick disponible
            if [ "$components_found" -ge 1 ] && [ "$USE_SIPS_ONLY" = "false" ]; then
                echo "    🔧 Génération de la texture ORM pour '$model_basename' avec $components_found composant(s)..."

                local orm_output="$output_dir/${model_basename}_ORM.png"

                # Créer les fichiers temporaires pour chaque canal
                local temp_ao_chan="$TEMP_DIR/ao_${model_basename}.png"
                local temp_roughness_chan="$TEMP_DIR/roughness_${model_basename}.png"
                local temp_metalness_chan="$TEMP_DIR/metalness_${model_basename}.png"

                # Canal Rouge - AO (Ambient Occlusion)
                if [ -n "$ao_file" ]; then
                    $MAGICK_CMD "$ao_file" \
                        -resize "${target_size}x${target_size}>" \
                        -colorspace Gray \
                        "$temp_ao_chan" 2>/dev/null
                    echo "      ✅ Canal Rouge (AO): $(basename "$ao_file")"
                else
                    # Valeur par défaut pour AO: blanc (pas d'occlusion)
                    $MAGICK_CMD -size "${target_size}x${target_size}" xc:white "$temp_ao_chan" 2>/dev/null
                    echo "      ⚪ Canal Rouge (AO): valeur par défaut (blanc)"
                fi

                # Canal Vert - Roughness
                if [ -n "$roughness_file" ]; then
                    $MAGICK_CMD "$roughness_file" \
                        -resize "${target_size}x${target_size}>" \
                        -colorspace Gray \
                        "$temp_roughness_chan" 2>/dev/null
                    echo "      ✅ Canal Vert (Roughness): $(basename "$roughness_file")"
                else
                    # Valeur par défaut pour Roughness: gris moyen (semi-rugueux)
                    $MAGICK_CMD -size "${target_size}x${target_size}" xc:"gray50" "$temp_roughness_chan" 2>/dev/null
                    echo "      ⚪ Canal Vert (Roughness): valeur par défaut (gris moyen)"
                fi

                # Canal Bleu - Metalness
                if [ -n "$metalness_file" ]; then
                    $MAGICK_CMD "$metalness_file" \
                        -resize "${target_size}x${target_size}>" \
                        -colorspace Gray \
                        "$temp_metalness_chan" 2>/dev/null
                    echo "      ✅ Canal Bleu (Metalness): $(basename "$metalness_file")"
                else
                    # Valeur par défaut pour Metalness: noir (non-métallique)
                    $MAGICK_CMD -size "${target_size}x${target_size}" xc:black "$temp_metalness_chan" 2>/dev/null
                    echo "      ⚪ Canal Bleu (Metalness): valeur par défaut (noir)"
                fi

                # Combiner les trois canaux en une texture ORM
                echo "    🎨 Combinaison des canaux RGB..."
                $MAGICK_CMD "$temp_ao_chan" "$temp_roughness_chan" "$temp_metalness_chan" \
                    -channel RGB -combine \
                    -strip \
                    "$orm_output" 2>/dev/null

                if [ -f "$orm_output" ]; then
                    echo "    ✅ Texture ORM créée: ${model_basename}_ORM.png"
                    echo "      📍 Localisation: $orm_output"
                    echo "      🎯 Format: Rouge=AO, Vert=Roughness, Bleu=Metalness"
                    echo "      📊 Composants utilisés: $components_found/3"

                    # Afficher le détail des composants
                    local components_detail=""
                    [ -n "$ao_file" ] && components_detail="${components_detail}AO "
                    [ -n "$roughness_file" ] && components_detail="${components_detail}Roughness "
                    [ -n "$metalness_file" ] && components_detail="${components_detail}Metalness "
                    echo "      🔍 Composants: $components_detail(+ valeurs par défaut)"

                    orm_created=$((orm_created + 1))
                else
                    echo "    ❌ Échec de création de la texture ORM pour '$model_basename'"
                fi

                # Nettoyer les fichiers temporaires
                rm -f "$temp_ao_chan" "$temp_roughness_chan" "$temp_metalness_chan"

            elif [ "$USE_SIPS_ONLY" = "true" ]; then
                echo "    ℹ️  Création ORM non disponible avec SIPS pour '$model_basename'"
                echo "    💡 Installez ImageMagick pour activer cette fonctionnalité"
            else
                echo "    ⚠️  Aucun composant ORM trouvé pour '$model_basename'"
            fi
        fi
    done < "$temp_models"

    # Nettoyer les fichiers temporaires
    rm -f "$temp_models" "$temp_ao" "$temp_roughness" "$temp_metalness"

    echo ""
    echo "  🎉 Récapitulatif ORM:"
    echo "    📊 $orm_created textures ORM générées"
    echo "    🔧 Méthode: 1 ORM par basename de modèle (compatible Bash 3.x)"

    return $orm_created
}

# Fonction pour traiter un dossier de matériau (compatible Bash 3.x) - PRÉSERVE L'ARBORESCENCE
process_material_folder() {
    local material_dir="$1"
    local platform="$2"
    local target_size="$3"

    local folder_name
    folder_name=$(basename "$material_dir")

    # CORRECTION: Préserver l'arborescence exacte
    local relative_path="${material_dir#$SOURCE_DIR/}"
    local material_output_dir="$OUTPUT_DIR/$platform/$relative_path"

    # Créer le dossier de sortie avec l'arborescence exacte
    mkdir -p "$material_output_dir"

    echo "📦 Traitement du dossier: $relative_path ($platform)"

    # Utiliser un fichier temporaire pour compter les modèles uniques
    local temp_basenames="$TEMP_DIR/basenames_${platform}_$(echo "$relative_path" | tr '/' '_').txt"
    > "$temp_basenames"

    local texture_count=0

    # Identifier tous les modèles uniques dans le dossier
    for texture_file in "$material_dir"/*; do
        if [ -f "$texture_file" ]; then
            local filename
            filename=$(basename "$texture_file")
            local ext="${texture_file##*.}"

            # Vérifier que c'est une image
            if echo "$ext" | grep -E "^(png|jpg|jpeg|tga|tiff|bmp)$" >/dev/null; then
                # Extraire le basename du modèle
                local model_basename
                model_basename=$(extract_model_basename "$filename")

                # Ajouter à la liste des modèles uniques s'il n'y est pas déjà
                if ! grep -q "^$model_basename$" "$temp_basenames"; then
                    echo "$model_basename" >> "$temp_basenames"
                fi

                # Optimiser la texture
                optimize_texture "$texture_file" "$material_output_dir" "$target_size" "$platform"
                texture_count=$((texture_count + 1))
            fi
        fi
    done

    # Compter les modèles uniques
    local unique_models_count
    unique_models_count=$(wc -l < "$temp_basenames")
    local models_list
    models_list=$(tr '\n' ' ' < "$temp_basenames")

    # Afficher les modèles détectés
    echo "  🎯 Modèles détectés par basename: $models_list"
    echo "  📊 Nombre de modèles uniques: $unique_models_count"

    # Créer les textures ORM individuelles
    local orm_count=0
    if [ "$unique_models_count" -gt 0 ]; then
        orm_count=$(create_individual_orm_textures "$material_dir" "$material_output_dir" "$target_size" "$platform")
    fi

    echo "  📊 $texture_count textures optimisées"
    echo "  🏗️  $unique_models_count modèles uniques détectés"
    if [ "$orm_count" -gt 0 ]; then
        echo "  🎨 $orm_count textures ORM créées individuellement"
    fi
    echo "  📁 Dossier de sortie: $material_output_dir"
    echo ""

    # Nettoyer
    rm -f "$temp_basenames"
}

# Fonction principale de traitement - PRÉSERVE L'ARBORESCENCE EXACTE
process_textures() {
    echo "🔄 Début du traitement des textures..."
    echo "📁 Préservation de l'arborescence exacte de $SOURCE_DIR"
    echo ""

    # Traiter pour desktop
    echo "🖥️  === OPTIMISATION DESKTOP (${DESKTOP_TEXTURE_SIZE}px) ==="
    echo ""

    # Parcourir TOUS les dossiers et sous-dossiers récursivement
    find "$SOURCE_DIR" -type d | while read -r material_dir; do
        # Ignorer le dossier racine lui-même
        if [ "$material_dir" != "$SOURCE_DIR" ]; then
            # Vérifier si le dossier contient des images
            if find "$material_dir" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.tga" -o -iname "*.tiff" -o -iname "*.bmp" \) | grep -q .; then
                process_material_folder "$material_dir" "desktop" "$DESKTOP_TEXTURE_SIZE"
            else
                # Créer le dossier vide pour préserver la structure
                local relative_path="${material_dir#$SOURCE_DIR/}"
                local empty_output_dir="$OUTPUT_DIR/desktop/$relative_path"
                mkdir -p "$empty_output_dir"
                echo "📁 Dossier vide préservé: $relative_path"
            fi
        fi
    done

    echo "📱 === OPTIMISATION MOBILE (${MOBILE_TEXTURE_SIZE}px) ==="
    echo ""

    # Parcourir TOUS les dossiers et sous-dossiers récursivement pour mobile
    find "$SOURCE_DIR" -type d | while read -r material_dir; do
        # Ignorer le dossier racine lui-même
        if [ "$material_dir" != "$SOURCE_DIR" ]; then
            # Vérifier si le dossier contient des images
            if find "$material_dir" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.tga" -o -iname "*.tiff" -o -iname "*.bmp" \) | grep -q .; then
                process_material_folder "$material_dir" "mobile" "$MOBILE_TEXTURE_SIZE"
            else
                # Créer le dossier vide pour préserver la structure
                local relative_path="${material_dir#$SOURCE_DIR/}"
                local empty_output_dir="$OUTPUT_DIR/mobile/$relative_path"
                mkdir -p "$empty_output_dir"
                echo "📁 Dossier vide préservé: $relative_path"
            fi
        fi
    done
}

# Fonction pour calculer les statistiques
calculate_statistics() {
    echo "📊 === STATISTIQUES FINALES ==="
    echo ""

    local original_size=0
    local desktop_size=0
    local mobile_size=0

    if command -v du >/dev/null 2>&1; then
        original_size=$(du -sm "$SOURCE_DIR" 2>/dev/null | cut -f1)
        desktop_size=$(du -sm "$OUTPUT_DIR/desktop" 2>/dev/null | cut -f1)
        mobile_size=$(du -sm "$OUTPUT_DIR/mobile" 2>/dev/null | cut -f1)
    fi

    local original_files
    original_files=$(find "$SOURCE_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.tga" -o -iname "*.tiff" -o -iname "*.bmp" \) | wc -l)
    local desktop_files
    desktop_files=$(find "$OUTPUT_DIR/desktop" -type f | wc -l)
    local mobile_files
    mobile_files=$(find "$OUTPUT_DIR/mobile" -type f | wc -l)
    local orm_files
    orm_files=$(find "$OUTPUT_DIR" -name "*_ORM.png" 2>/dev/null | wc -l)

    echo "📁 Fichiers originaux: $original_files"
    echo "🖥️  Fichiers desktop: $desktop_files"
    echo "📱 Fichiers mobile: $mobile_files"
    echo "🎨 Textures ORM créées: $orm_files"
    echo ""

    if [ "$original_size" -gt 0 ]; then
        local total_optimized_size=$((desktop_size + mobile_size))
        local reduction=$((100 - (total_optimized_size * 100 / original_size)))

        echo "💾 Taille originale: ${original_size}MB"
        echo "🖥️  Taille desktop: ${desktop_size}MB"
        echo "📱 Taille mobile: ${mobile_size}MB"
        echo "📊 Taille totale optimisée: ${total_optimized_size}MB"
        echo "💡 Réduction globale: ${reduction}%"
    fi

    echo ""
    echo "🔧 Correction appliquée:"
    echo "   ✅ Une texture ORM par basename de modèle distinct"
    echo "   ✅ Fini le regroupement de tous les fichiers en un seul ORM"
    echo "   ✅ Chaque modèle (BigRock, RockWater, etc.) a sa propre ORM"
    echo "   ✅ Compatible Bash 3.x (macOS par défaut)"
    echo ""
}

# Fonction pour générer un guide d'intégration corrigé
generate_corrected_integration_guide() {
    local guide_file="$OUTPUT_DIR/INTEGRATION_GUIDE_CORRECTED.md"

    cat > "$guide_file" << 'EOF'
# Guide d'intégration corrigé - Textures ORM par modèle individuel

## 🔧 Correction majeure appliquée

### Problème identifié
- **Avant**: Tous les fichiers sans suffixes reconnus étaient regroupés dans un modèle générique "0"
- **Résultat**: Une seule texture ORM massive pour tout le dossier
- **Problème**: Impossible d'appliquer des textures spécifiques par modèle

### Solution implémentée
- **Maintenant**: Chaque basename unique génère sa propre texture ORM
- **Résultat**: `BigRock_ORM.png`, `RockWater_ORM.png`, `TreeNaked_ORM.png`, etc.
- **Avantage**: Correspondance 1:1 entre modèle et texture ORM
- **Compatibilité**: 100% compatible Bash 3.x (macOS par défaut)

## Structure des fichiers avec arborescence préservée

```
textures/                           # Dossier source
├── forest/
│   ├── trees/
│   │   ├── BigRock_BaseColor.png
│   │   ├── BigRock_Roughness.png
│   │   └── BigRock_Metallic.png
│   └── water/
│       ├── RockWater_BaseColor.png
│       └── RockWater_Normal.png
├── digital/
│   ├── neon/
│   └── metal/
└── primary/
    └── basic/

textures_optimized/                 # 🎯 ARBORESCENCE IDENTIQUE
├── desktop/
│   ├── forest/
│   │   ├── trees/
│   │   │   ├── BigRock_BaseColor.webp
│   │   │   ├── BigRock_Normal.png
│   │   │   └── BigRock_ORM.png      # 🆕 ORM spécifique
│   │   └── water/
│   │       ├── RockWater_BaseColor.webp
│   │       ├── RockWater_Normal.png
│   │       └── RockWater_ORM.png    # 🆕 ORM spécifique
│   ├── digital/
│   │   ├── neon/
│   │   └── metal/
│   └── primary/
│       └── basic/
└── mobile/ (structure identique, tailles réduites)
```

## Modifications pour votre TextureManager

### 1. Méthode addTextureMapping corrigée

```javascript
// Version corrigée avec mapping 1:1 modèle/ORM
async addTextureMapping(modelId, folder, filePrefix = null, materialProperties = null) {
    const prefix = filePrefix || modelId;
    const platform = this.detectPlatform();
    const basePath = `/textures_optimized/${platform}/${folder}`;

    // Initialiser les chemins de base
    this.texturePaths[modelId] = {
        baseColor: `${basePath}/${prefix}_BaseColor.webp`,
        normal: `${basePath}/${prefix}_Normal.png`,
        normalOpenGL: `${basePath}/${prefix}_NormalOpenGL.png`,
        height: `${basePath}/${prefix}_Height.png`
    };

    // 🔧 CORRECTION: Chercher l'ORM spécifique au modèle
    const ormPath = `${basePath}/${prefix}_ORM.png`;
    const hasORM = await this.checkIfFileExists(ormPath);

    if (hasORM) {
        // Utiliser l'ORM spécifique au modèle
        this.texturePaths[modelId].orm = ormPath;
        this.texturePaths[modelId].useORM = true;
        console.log(`✅ ORM spécifique trouvée pour ${modelId}: ${ormPath}`);
    } else {
        // Fallback sur les textures individuelles
        this.texturePaths[modelId].roughness = `${basePath}/${prefix}_Roughness.png`;
        this.texturePaths[modelId].metalness = `${basePath}/${prefix}_Metallic.png`;
        this.texturePaths[modelId].ao = `${basePath}/${prefix}_AO.png`;
        this.texturePaths[modelId].useORM = false;
        console.log(`⚠️ Pas d'ORM pour ${modelId}, utilisation des textures individuelles`);
    }

    // Stocker les propriétés du matériau
    if (materialProperties) {
        this.materialProperties[modelId] = materialProperties;
    }
}
```

Cette correction garantit que chaque modèle 3D aura ses propres propriétés matériaux via une texture ORM dédiée, permettant un contrôle précis et une optimisation maximale du rendu.
EOF

    echo "📖 Guide d'intégration corrigé généré: $guide_file"
}

# Fonction de nettoyage
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        echo "🧹 Fichiers temporaires nettoyés"
    fi
}

# Fonction principale
main() {
    echo "🎮 Optimiseur de textures pour Three.js (Version Bash 3.x Compatible)"
    echo "🎯 Compatible avec votre TextureManager"
    echo "🔧 Correction: ORM créée individuellement par basename de modèle"
    echo "📅 $(date)"
    echo ""

    # Vérifications préliminaires
    if [ ! -d "$SOURCE_DIR" ]; then
        echo "❌ Erreur: Le dossier source '$SOURCE_DIR' n'existe pas"
        echo "💡 Créez le dossier ou modifiez SOURCE_DIR dans le script"
        exit 1
    fi

    local total_images
    total_images=$(find "$SOURCE_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.tga" -o -iname "*.tiff" -o -iname "*.bmp" \) | wc -l)

    if [ "$total_images" -eq 0 ]; then
        echo "❌ Aucun fichier image trouvé dans $SOURCE_DIR"
        exit 1
    fi

    echo "🖼️  $total_images fichiers image trouvés"
    echo ""

    # Exécution
    check_basic_dependencies
    setup_directories

    trap cleanup EXIT

    local start_time
    start_time=$(date +%s)

    process_textures
    calculate_statistics
    generate_corrected_integration_guide

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo "⏱️  Temps de traitement: ${duration}s"
    echo ""
    echo "🎉 Optimisation corrigée terminée !"
    echo ""
    echo "📋 Prochaines étapes:"
    echo "   1. Consultez le guide corrigé: $OUTPUT_DIR/INTEGRATION_GUIDE_CORRECTED.md"
    echo "   2. Vérifiez que chaque modèle a sa propre ORM"
    echo "   3. Testez le nouveau mapping 1:1 modèle/ORM"
    echo "   4. Utilisez diagnosticTextureUsage() pour validation"
    echo ""
    echo "🔧 Correction appliquée:"
    echo "   ✅ Une texture ORM par basename de modèle distinct"
    echo "   ✅ Fini le regroupement de tous les fichiers en un seul ORM"
    echo "   ✅ Chaque modèle (BigRock, RockWater, etc.) a sa propre ORM"
    echo "   ✅ Correspondance exacte modèle 3D ↔ texture ORM"
    echo "   ✅ Compatible Bash 3.x (macOS par défaut)"
    echo ""
}

# Gestion des arguments
while [ $# -gt 0 ]; do
    case $1 in
        --source)
            SOURCE_DIR="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --desktop-size)
            DESKTOP_TEXTURE_SIZE="$2"
            shift 2
            ;;
        --mobile-size)
            MOBILE_TEXTURE_SIZE="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --source DIR          Dossier source (défaut: ./textures)"
            echo "  --output DIR          Dossier de sortie (défaut: ./textures_optimized)"
            echo "  --desktop-size SIZE   Taille textures desktop (défaut: 1024)"
            echo "  --mobile-size SIZE    Taille textures mobile (défaut: 512)"
            echo "  -h, --help           Afficher cette aide"
            echo ""
            echo "🔧 Correction de cette version:"
            echo "  - Une texture ORM par basename de modèle distinct"
            echo "  - Fini le regroupement en un seul ORM générique"
            echo "  - Correspondance exacte modèle 3D ↔ texture ORM"
            echo "  - Compatible Bash 3.x (macOS par défaut)"
            echo ""
            echo "Exemple:"
            echo "  $0 --source ./my_textures --desktop-size 2048"
            echo ""
            echo "Note: Compatible ImageMagick v6 et v7, détection automatique"
            exit 0
            ;;
        *)
            echo "Option inconnue: $1"
            echo "Utilisez --help pour voir les options disponibles"
            exit 1
            ;;
    esac
done

# Lancer le script principal
main