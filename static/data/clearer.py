import json
import math
from typing import List, Dict, Any


def calculate_distance(obj1: Dict[str, float], obj2: Dict[str, float]) -> float:
    """
    Calcule la distance euclidienne entre deux objets 3D.
    Prend en compte les coordonnées x, y, z et optionnellement les rotations et échelles.
    """
    # Distance euclidienne basique sur les positions
    pos_distance = math.sqrt(
        (obj1['x'] - obj2['x']) ** 2 +
        (obj1['y'] - obj2['y']) ** 2 +
        (obj1['z'] - obj2['z']) ** 2
    )

    # Distance sur les rotations (optionnel)
    rot_distance = 0
    if all(key in obj1 and key in obj2 for key in ['rotationX', 'rotationY', 'rotationZ']):
        rot_distance = math.sqrt(
            (obj1['rotationX'] - obj2['rotationX']) ** 2 +
            (obj1['rotationY'] - obj2['rotationY']) ** 2 +
            (obj1['rotationZ'] - obj2['rotationZ']) ** 2
        )

    # Distance sur les échelles (optionnel)
    scale_distance = 0
    if all(key in obj1 and key in obj2 for key in ['scaleX', 'scaleY', 'scaleZ']):
        scale_distance = math.sqrt(
            (obj1['scaleX'] - obj2['scaleX']) ** 2 +
            (obj1['scaleY'] - obj2['scaleY']) ** 2 +
            (obj1['scaleZ'] - obj2['scaleZ']) ** 2
        )

    # Combinaison pondérée des distances (vous pouvez ajuster les poids)
    total_distance = pos_distance + (rot_distance * 0.1) + (scale_distance * 0.01)

    return total_distance


def calculate_normalized_distance(obj1: Dict[str, float], obj2: Dict[str, float]) -> float:
    """
    Calcule une distance normalisée entre 0 et 1 pour deux objets.
    Cette version est plus adaptée au seuil 0.0001-0.9.
    """
    # Distance euclidienne sur les positions
    pos_distance = math.sqrt(
        (obj1['x'] - obj2['x']) ** 2 +
        (obj1['y'] - obj2['y']) ** 2 +
        (obj1['z'] - obj2['z']) ** 2
    )

    # Normalisation approximative (ajustez selon vos données)
    # Ici on assume que la distance max attendue est ~200 unités
    max_expected_distance = 200.0
    normalized_distance = min(pos_distance / max_expected_distance, 1.0)

    return normalized_distance


def modify_object_properties(obj: Dict[str, Any],
                             scale_factor: float = 1.0,
                             y_offset: float = 0.0,
                             min_height: float = None) -> Dict[str, Any]:
    """
    Modifie les propriétés d'un objet (échelle, position Y et hauteur minimum).

    Args:
        obj: L'objet à modifier
        scale_factor: Facteur multiplicateur pour l'échelle (ex: 2.0 = double la taille)
        y_offset: Décalage à appliquer sur la position Y (peut être positif ou négatif)
        min_height: Hauteur minimum en Y. Si l'objet (APRÈS décalage) est plus bas, il sera remonté à cette hauteur

    Returns:
        L'objet modifié (copie)
    """
    modified_obj = obj.copy()

    # Modification de l'échelle
    if 'scaleX' in modified_obj:
        modified_obj['scaleX'] *= scale_factor
    if 'scaleY' in modified_obj:
        modified_obj['scaleY'] *= scale_factor
    if 'scaleZ' in modified_obj:
        modified_obj['scaleZ'] *= scale_factor

    # Modification de la position Y (ÉTAPE 1: appliquer le décalage)
    if 'y' in modified_obj:
        original_y = modified_obj['y']
        modified_obj['y'] += y_offset
        y_after_offset = modified_obj['y']

        # Application de la hauteur minimum (ÉTAPE 2: vérifier après décalage)
        if min_height is not None:
            if modified_obj['y'] < min_height:
                print(
                    f"Objet remonté: Y original={original_y:.3f} → Y après décalage={y_after_offset:.3f} → Y final={min_height:.3f} (hauteur minimum)")
                modified_obj['y'] = min_height

    return modified_obj


def remove_close_objects(objects: List[Dict[str, Any]],
                         threshold: float = 0.1,
                         use_normalized: bool = True,
                         scale_factor: float = 1.0,
                         y_offset: float = 0.0,
                         min_height: float = None) -> List[Dict[str, Any]]:
    """
    Supprime les objets trop proches selon le seuil donné et modifie leurs propriétés.
    GARDE TOUJOURS UN DES DEUX OBJETS (le premier rencontré).

    IMPORTANT: La suppression se base sur les positions ORIGINALES,
    les modifications sont appliquées APRÈS le filtrage dans cet ordre :
    1. Échelle (scale_factor)
    2. Décalage Y (y_offset)
    3. Hauteur minimum (min_height) - appliquée sur le résultat final

    Args:
        objects: Liste des objets JSON
        threshold: Seuil de proximité (0.0001 à 0.9 si use_normalized=True)
        use_normalized: Utilise la distance normalisée ou la distance brute
        scale_factor: Facteur multiplicateur pour l'échelle (ex: 1.5 = +50% de taille)
        y_offset: Décalage sur l'axe Y (ex: 2.0 = monte de 2 unités)
        min_height: Hauteur minimum en Y (ex: 1.0 = tous les objets seront au minimum à Y=1.0)

    Returns:
        Liste filtrée des objets avec propriétés modifiées
    """
    if not objects:
        return objects

    # ÉTAPE 1: Filtrage basé sur les positions ORIGINALES
    filtered_objects_original = []
    distance_func = calculate_normalized_distance if use_normalized else calculate_distance

    for i, current_obj in enumerate(objects):
        is_too_close = False
        closest_distance = float('inf')
        closest_index = -1

        # Vérifier la distance avec tous les objets déjà acceptés (POSITIONS ORIGINALES)
        for j, accepted_obj in enumerate(filtered_objects_original):
            distance = distance_func(current_obj, accepted_obj)

            if distance < closest_distance:
                closest_distance = distance
                closest_index = j

            if distance < threshold:
                is_too_close = True
                break

        if not is_too_close:
            # Garder l'objet ORIGINAL pour le moment (sans modifications)
            filtered_objects_original.append(current_obj)
            print(f"Objet {i} conservé (distance OK)")
        else:
            # L'objet est trop proche d'un objet déjà accepté
            print(
                f"Objet {i} supprimé car trop proche de l'objet conservé #{closest_index} (distance {closest_distance:.6f} < seuil {threshold})")

    # ÉTAPE 2: Appliquer les modifications (échelle, Y, hauteur min) APRÈS le filtrage
    final_objects = []
    for i, obj in enumerate(filtered_objects_original):
        modified_obj = modify_object_properties(obj, scale_factor, y_offset, min_height)
        final_objects.append(modified_obj)

        # Affichage des modifications appliquées
        modifications = []
        if scale_factor != 1.0:
            modifications.append(f"échelle: x{scale_factor}")
        if y_offset != 0.0:
            modifications.append(f"Y: +{y_offset}")
        if min_height is not None:
            modifications.append(f"hauteur min: {min_height}")

        if modifications:
            print(f"Objet conservé #{i} modifié ({', '.join(modifications)})")

    print(f"\n--- Résumé du filtrage ---")
    print(f"Objets originaux: {len(objects)}")
    print(f"Objets après filtrage: {len(filtered_objects_original)}")
    print(f"Objets supprimés: {len(objects) - len(filtered_objects_original)}")
    if min_height is not None:
        print(f"Hauteur minimum appliquée: {min_height}")

    return final_objects


def process_json_file(input_file: str,
                      output_file: str,
                      threshold: float = 0.1,
                      scale_factor: float = 1.0,
                      y_offset: float = 0.0,
                      min_height: float = None):
    """
    Traite un fichier JSON complet avec modification des propriétés.

    Args:
        input_file: Fichier JSON d'entrée
        output_file: Fichier JSON de sortie
        threshold: Seuil de proximité pour filtrage
        scale_factor: Facteur d'échelle (1.0 = pas de changement)
        y_offset: Décalage position Y (0.0 = pas de changement)
        min_height: Hauteur minimum en Y (None = pas de hauteur minimum)
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Si c'est une liste directe d'objets
        if isinstance(data, list):
            filtered_data = remove_close_objects(data, threshold, True, scale_factor, y_offset, min_height)

        # Si les objets sont dans une clé spécifique
        elif isinstance(data, dict) and 'objects' in data:
            filtered_data = data.copy()
            filtered_data['objects'] = remove_close_objects(
                data['objects'], threshold, True, scale_factor, y_offset, min_height
            )

        else:
            print("Format JSON non reconnu. Attendu: liste d'objets ou dict avec clé 'objects'")
            return

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_data, f, indent=2, ensure_ascii=False)

        print(f"\nTraitement terminé:")
        original_count = len(data) if isinstance(data, list) else len(data.get('objects', []))
        final_count = len(filtered_data) if isinstance(filtered_data, list) else len(filtered_data.get('objects', []))
        print(f"Objects originaux: {original_count}")
        print(f"Objects conservés: {final_count}")
        print(f"Objects supprimés: {original_count - final_count}")
        print(f"Facteur d'échelle appliqué: {scale_factor}")
        print(f"Décalage Y appliqué: {y_offset}")
        if min_height is not None:
            print(f"Hauteur minimum appliquée: {min_height}")

    except FileNotFoundError:
        print(f"Fichier {input_file} non trouvé")
    except json.JSONDecodeError:
        print(f"Erreur de format JSON dans {input_file}")
    except Exception as e:
        print(f"Erreur: {e}")


# Exemple d'utilisation avec vos données
def example_usage():
    # Vos données d'exemple
    sample_objects = [
        {
            "x": -0.365875244140625,
            "y": 6.226734161376953,
            "z": -69.98272705078125,
            "rotationX": 0.4472027457453762,
            "rotationY": 0.4115408346765261,
            "rotationZ": -0.23082820591802286,
            "scaleX": 4.996317429299222,
            "scaleY": 4.996318373028111,
            "scaleZ": 4.996317932190464
        },
        {
            "x": -18.88863754272461,
            "y": 1.890096664428711,  # Objet plus bas
            "z": -138.70361328125,
            "rotationX": 2.1282555915624712,
            "rotationY": -0.3925090627145855,
            "rotationZ": 2.5281181450206036,
            "scaleX": 4.996320189317805,
            "scaleY": 4.996318367676491,
            "scaleZ": 4.996318882325262
        },
        {
            "x": -16.800365447998047,
            "y": 0.8295907974243164,  # Objet encore plus bas
            "z": -136.35488891601562,
            "rotationX": 1.5796504791771422,
            "rotationY": 0.044142557249213836,
            "rotationZ": 2.4282955094795726,
            "scaleX": 4.996318042732904,
            "scaleY": 4.996317967849013,
            "scaleZ": 4.996317012813175
        }
    ]

    print("=== Test avec seuil 0.1, échelle x1.5, Y+3, hauteur min 5.0 ===")
    print("Ordre des opérations : 1) Échelle 2) Décalage Y 3) Hauteur minimum")
    filtered = remove_close_objects(sample_objects,
                                    threshold=0.1,
                                    scale_factor=1.5,
                                    y_offset=3.0,
                                    min_height=5.0)

    print(f"\nRésultat: {len(filtered)} objets conservés sur {len(sample_objects)}")

    # Afficher les modifications appliquées
    if filtered:
        print("\nExemples de transformations :")
        for i in range(min(len(sample_objects), len(filtered))):
            original = sample_objects[i]
            modified = filtered[i]
            print(f"\nObjet {i}:")
            print(f"  Y original: {original['y']:.3f}")
            print(f"  Y après décalage (+3.0): {original['y'] + 3.0:.3f}")
            print(f"  Y final (après hauteur min 5.0): {modified['y']:.3f}")
            print(f"  Échelle X: {original['scaleX']:.3f} → {modified['scaleX']:.3f}")

    # Test avec différents paramètres incluant hauteur minimum
    print("\n=== Tests avec différents paramètres et hauteur minimum ===")
    test_params = [
        (0.01, 1.0, 0.0, None),  # Pas de hauteur minimum
        (0.1, 1.2, 1.0, 3.0),  # Hauteur minimum à 3.0
        (0.5, 0.8, -2.0, 1.0),  # Hauteur minimum à 1.0
        (0.1, 2.0, 5.0, 8.0),  # Hauteur minimum à 8.0 (tous seront remontés)
    ]

    for threshold, scale, y_off, min_h in test_params:
        print(f"\n--- Test: seuil {threshold}, échelle x{scale}, Y+{y_off}, hauteur min {min_h} ---")
        filtered = remove_close_objects(sample_objects,
                                        threshold=threshold,
                                        scale_factor=scale,
                                        y_offset=y_off,
                                        min_height=min_h)
        print(f"Résultat: {len(filtered)} objets conservés")


if __name__ == "__main__":
    # Configuration des paramètres (modifiez ces valeurs selon vos besoins)
    THRESHOLD = 0.02  # Seuil de proximité
    SCALE_FACTOR = 1.0  # Facteur d'échelle (1.2 = +20% de taille)
    Y_OFFSET = 0.0  # Décalage en Y (2.0 = monte de 2 unités)
    MIN_HEIGHT = 5.25  # Hauteur minimum (tous les objets seront au minimum à Y=1.0)

    # Exemple d'utilisation
    example_usage()

    # Pour traiter un fichier avec les nouveaux paramètres:
    process_json_file('treePositions_ThreeRoof2.json',
                      'output.json',
                      threshold=THRESHOLD,
                      scale_factor=SCALE_FACTOR,
                      y_offset=Y_OFFSET,
                      min_height=MIN_HEIGHT)