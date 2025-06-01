import json
import math
from typing import List, Dict, Any


def calculate_distance(obj1: Dict[str, float], obj2: Dict[str, float]) -> float:
    """
    Calcule la distance euclidienne entre deux objets 3D basée uniquement sur leurs positions.
    """
    return math.sqrt(
        (obj1['x'] - obj2['x']) ** 2 +
        (obj1['y'] - obj2['y']) ** 2 +
        (obj1['z'] - obj2['z']) ** 2
    )


def calculate_normalized_distance(obj1: Dict[str, float], obj2: Dict[str, float]) -> float:
    """
    Calcule une distance normalisée entre 0 et 1 pour deux objets.
    """
    pos_distance = calculate_distance(obj1, obj2)
    # Normalisation (ajustez max_expected_distance selon vos données)
    max_expected_distance = 200.0
    return min(pos_distance / max_expected_distance, 1.0)


def modify_object_properties(obj: Dict[str, Any],
                             scale_factor: float = 1.0,
                             rotation_offset: Dict[str, float] = None) -> Dict[str, Any]:
    """
    Modifie les propriétés d'un objet (échelle uniforme et ajout de rotation).

    Args:
        obj: L'objet à modifier
        scale_factor: Valeur qui remplace toutes les échelles (ex: 2.0 = set scaleX/Y/Z à 2.0)
        rotation_offset: Dictionnaire avec les rotations à ajouter {'rotationX': 0.5, 'rotationY': 0.0, 'rotationZ': 0.2}

    Returns:
        L'objet modifié (copie)
    """
    modified_obj = obj.copy()

    if rotation_offset is None:
        rotation_offset = {'rotationX': 0.0, 'rotationY': 0.0, 'rotationZ': 0.0}

    # Remplacement de l'échelle (uniforme pour X, Y, Z)
    if 'scaleX' in modified_obj:
        modified_obj['scaleX'] = scale_factor
    if 'scaleY' in modified_obj:
        modified_obj['scaleY'] = scale_factor
    if 'scaleZ' in modified_obj:
        modified_obj['scaleZ'] = scale_factor

    # Ajout des rotations
    for rotation_key in ['rotationX', 'rotationY', 'rotationZ']:
        if rotation_key in modified_obj and rotation_key in rotation_offset:
            original_rotation = modified_obj[rotation_key]
            modified_obj[rotation_key] += rotation_offset[rotation_key]

            # Affichage des modifications de rotation (optionnel)
            if rotation_offset[rotation_key] != 0.0:
                print(
                    f"  {rotation_key}: {original_rotation:.3f} → {modified_obj[rotation_key]:.3f} (+{rotation_offset[rotation_key]:.3f})")

    return modified_obj


def remove_close_objects(objects: List[Dict[str, Any]],
                         threshold: float = 0.1,
                         use_normalized: bool = True,
                         scale_factor: float = 1.0,
                         rotation_offset: Dict[str, float] = None) -> List[Dict[str, Any]]:
    """
    Supprime les objets trop proches selon le seuil donné et modifie leurs propriétés.
    GARDE TOUJOURS UN DES DEUX OBJETS (le premier rencontré).

    La suppression se base sur les positions ORIGINALES,
    les modifications sont appliquées APRÈS le filtrage.

    Args:
        objects: Liste des objets JSON
        threshold: Seuil de proximité (0.0001 à 0.9 si use_normalized=True)
        use_normalized: Utilise la distance normalisée ou la distance brute
        scale_factor: Valeur qui remplace l'échelle de tous les objets (ex: 1.5 = set scaleX/Y/Z à 1.5)
        rotation_offset: Dictionnaire des rotations à ajouter (ex: {'rotationX': 0.5, 'rotationY': 0.0, 'rotationZ': 0.2})

    Returns:
        Liste filtrée des objets avec propriétés modifiées
    """
    if not objects:
        return objects

    if rotation_offset is None:
        rotation_offset = {'rotationX': 0.0, 'rotationY': 0.0, 'rotationZ': 0.0}

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
            filtered_objects_original.append(current_obj)
            print(f"Objet {i} conservé (distance OK)")
        else:
            print(
                f"Objet {i} supprimé car trop proche de l'objet conservé #{closest_index} (distance {closest_distance:.6f} < seuil {threshold})")

    # ÉTAPE 2: Appliquer les modifications (échelle et rotation) APRÈS le filtrage
    final_objects = []
    for i, obj in enumerate(filtered_objects_original):
        print(f"\nModification de l'objet conservé #{i}:")
        modified_obj = modify_object_properties(obj, scale_factor, rotation_offset)
        final_objects.append(modified_obj)

        # Affichage des modifications appliquées
        modifications = []
        if scale_factor != 1.0:
            modifications.append(f"échelle: ={scale_factor}")

        rotation_changes = [f"{k}: +{v}" for k, v in rotation_offset.items() if v != 0.0]
        if rotation_changes:
            modifications.append(f"rotation: {', '.join(rotation_changes)}")

        if modifications:
            print(f"  Modifications: {', '.join(modifications)}")

    print(f"\n--- Résumé du filtrage ---")
    print(f"Objets originaux: {len(objects)}")
    print(f"Objets après filtrage: {len(filtered_objects_original)}")
    print(f"Objets supprimés: {len(objects) - len(filtered_objects_original)}")

    return final_objects


def process_json_file(input_file: str,
                      output_file: str,
                      threshold: float = 0.1,
                      scale_factor: float = 1.0,
                      rotation_offset: Dict[str, float] = None):
    """
    Traite un fichier JSON complet avec les nouvelles modifications simplifiées.

    Args:
        input_file: Fichier JSON d'entrée
        output_file: Fichier JSON de sortie
        threshold: Seuil de proximité pour filtrage
        scale_factor: Valeur d'échelle uniforme qui remplace les scales existants (1.0 = pas de changement)
        rotation_offset: Dictionnaire des rotations à ajouter
    """
    if rotation_offset is None:
        rotation_offset = {'rotationX': 0.0, 'rotationY': 0.0, 'rotationZ': 0.0}

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Si c'est une liste directe d'objets
        if isinstance(data, list):
            filtered_data = remove_close_objects(data, threshold, True, scale_factor, rotation_offset)

        # Si les objets sont dans une clé spécifique
        elif isinstance(data, dict) and 'objects' in data:
            filtered_data = data.copy()
            filtered_data['objects'] = remove_close_objects(
                data['objects'], threshold, True, scale_factor, rotation_offset
            )

        else:
            print("Format JSON non reconnu. Attendu: liste d'objets ou dict avec clé 'objects'")
            return

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(filtered_data, f, indent=2, ensure_ascii=False)

        print(f"\nTraitement terminé:")
        original_count = len(data) if isinstance(data, list) else len(data.get('objects', []))
        final_count = len(filtered_data) if isinstance(filtered_data, list) else len(filtered_data.get('objects', []))
        print(f"Objets originaux: {original_count}")
        print(f"Objets conservés: {final_count}")
        print(f"Objets supprimés: {original_count - final_count}")
        print(f"Valeur d'échelle appliquée: {scale_factor}")
        print(f"Rotations ajoutées: {rotation_offset}")

    except FileNotFoundError:
        print(f"Fichier {input_file} non trouvé")
    except json.JSONDecodeError:
        print(f"Erreur de format JSON dans {input_file}")
    except Exception as e:
        print(f"Erreur: {e}")


# Exemple d'utilisation
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
            "y": 1.890096664428711,
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
            "y": 0.8295907974243164,
            "z": -136.35488891601562,
            "rotationX": 1.5796504791771422,
            "rotationY": 0.044142557249213836,
            "rotationZ": 2.4282955094795726,
            "scaleX": 4.996318042732904,
            "scaleY": 4.996317967849013,
            "scaleZ": 4.996317012813175
        }
    ]

    print("=== Test avec seuil 0.1, échelle =1.5, rotation +0.5 sur X ===")
    rotation_changes = {'rotationX': 0.5, 'rotationY': 0.0, 'rotationZ': 0.0}

    filtered = remove_close_objects(sample_objects,
                                    threshold=0.1,
                                    scale_factor=1.5,
                                    rotation_offset=rotation_changes)

    print(f"\nRésultat: {len(filtered)} objets conservés sur {len(sample_objects)}")

    # Test avec différents paramètres
    print("\n=== Tests avec différents paramètres ===")
    test_params = [
        (0.01, 1.0, {'rotationX': 0.0, 'rotationY': 0.0, 'rotationZ': 0.0}),  # Pas de modifications
        (0.1, 1.2, {'rotationX': 0.5, 'rotationY': 0.0, 'rotationZ': 0.0}),  # Scale = 1.2 + rotation X
        (0.5, 0.8, {'rotationX': 0.0, 'rotationY': 1.0, 'rotationZ': 0.5}),  # Scale = 0.8 + rotations Y et Z
        (0.1, 2.0, {'rotationX': 0.2, 'rotationY': 0.3, 'rotationZ': 0.1}),  # Scale = 2.0 + toutes les rotations
    ]

    for threshold, scale, rotation_offset in test_params:
        print(f"\n--- Test: seuil {threshold}, échelle ={scale}, rotations {rotation_offset} ---")
        filtered = remove_close_objects(sample_objects,
                                        threshold=threshold,
                                        scale_factor=scale,
                                        rotation_offset=rotation_offset)
        print(f"Résultat: {len(filtered)} objets conservés")


if __name__ == "__main__":
    # Configuration des paramètres (modifiez ces valeurs selon vos besoins)
    THRESHOLD = 0.001  # Seuil de proximité
    SCALE_FACTOR = 0.2150344  # Valeur d'échelle uniforme qui remplace les scales existants
    ROTATION_OFFSET = {  # Rotations à ajouter
        'rotationX': -3.141592653589793,
        'rotationY': 0.0,
        'rotationZ': 0.0
    }

    # Exemple d'utilisation
    # example_usage()

    # Pour traiter un fichier avec les nouveaux paramètres:
    process_json_file('treePositions_ThinTrunkPlane.json',
                      'output_ThinTrunkPlane.json',
                      threshold=THRESHOLD,
                      scale_factor=SCALE_FACTOR,
                      rotation_offset=ROTATION_OFFSET)