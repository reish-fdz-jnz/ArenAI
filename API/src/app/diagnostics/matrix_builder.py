"""
ArenAI – Matrix Builder (Matriz de Relaciones entre Temas)
============================================================
Genera una matriz de adyacencia que muestra:
  • Dependencias entre temas (padre → hijo)
  • Correlación de cada relación
  • Overlay de scores de un estudiante (visual de "cuellos de botella")
"""

from __future__ import annotations
from mock_data import TOPICS, RELATIONS, TOPIC_MAP


def build_adjacency_matrix(
    topics: list[dict] | None = None,
    relations: list[dict] | None = None,
) -> dict:
    """
    Construye la matriz de adyacencia y la devuelve como dict:
    {
      "topic_ids": [101, 102, ...],
      "topic_names": ["Suma", "Resta", ...],
      "matrix": [[0, 0.85, 0.80, ...], ...]   # [row=padre][col=hijo]
    }
    """
    topics = topics or TOPICS
    relations = relations or RELATIONS

    ids = [t["id_topic"] for t in topics]
    names = [t["name"] for t in topics]
    n = len(ids)
    idx = {tid: i for i, tid in enumerate(ids)}

    matrix = [[0.0] * n for _ in range(n)]

    for rel in relations:
        father = rel["id_topic_father"]
        son = rel["id_topic_son"]
        if father in idx and son in idx:
            matrix[idx[father]][idx[son]] = rel["correlation"]

    return {
        "topic_ids": ids,
        "topic_names": names,
        "matrix": matrix,
    }


def print_matrix(
    matrix_data: dict,
    student_scores: dict[int, float] | None = None,
    title: str = "MATRIZ DE RELACIONES ENTRE TEMAS",
) -> None:
    """
    Imprime la matriz en la terminal con formato legible.
    Si se pasan student_scores, añade una fila extra con el rendimiento.
    """
    ids = matrix_data["topic_ids"]
    names = matrix_data["topic_names"]
    matrix = matrix_data["matrix"]
    n = len(ids)

    # Ancho de columna
    max_name_len = max(len(name) for name in names)
    col_w = 6  # ancho para valores numéricos
    name_w = max_name_len + 2

    print()
    print(f"{'=' * (name_w + col_w * n + 4)}")
    print(f"  {title}")
    print(f"{'=' * (name_w + col_w * n + 4)}")
    print()

    # Encabezado: IDs de columnas
    header_ids = " " * name_w + "|"
    for tid in ids:
        header_ids += f" {tid:>{col_w - 1}}"
    print(header_ids)

    # Encabezado: Nombres cortos (primeras 4 letras)
    header_short = " " * name_w + "|"
    for name in names:
        short = name[:col_w - 1]
        header_short += f" {short:>{col_w - 1}}"
    print(header_short)

    # Separador
    print("-" * name_w + "+" + "-" * (col_w * n + 1))

    # Filas de la matriz
    for i, (tid, name) in enumerate(zip(ids, names)):
        row_str = f"{name:<{name_w}}|"
        for j in range(n):
            val = matrix[i][j]
            if val > 0:
                row_str += f" {val:>{col_w - 1}.2f}"
            else:
                row_str += f" {'.':>{col_w - 1}}"
        print(row_str)

    # Separador
    print("-" * name_w + "+" + "-" * (col_w * n + 1))

    # Fila de scores del estudiante (si se proporcionan)
    if student_scores:
        score_row = f"{'[SCORES]':<{name_w}}|"
        for tid in ids:
            score = student_scores.get(tid, 0)
            # Indicador visual
            if score >= 70:
                indicator = f"  {score:>3}+"
            elif score >= 50:
                indicator = f"  {score:>3}~"
            else:
                indicator = f"  {score:>3}X"
            score_row += indicator
        print(score_row)
        print()

    # Leyenda
    print("  Leyenda: Valores = correlación padre→hijo")
    print("           . = sin relacion directa")
    if student_scores:
        print("           + = score >= 70% (aprobado)")
        print("           ~ = score 50-69% (en riesgo)")
        print("           X = score < 50% (reprobado)")
    print()


def print_dependency_chain(topic_id: int) -> None:
    """
    Muestra la cadena completa de prerrequisitos para un tema dado,
    incluyendo prerrequisitos transitivos (abuelos).
    """
    topic_name = TOPIC_MAP.get(topic_id, {}).get("name", "?")
    print(f"\n>> Cadena de prerrequisitos para '{topic_name}' (ID {topic_id}):")
    print(f"{'-' * 50}")

    visited = set()
    _print_chain_recursive(topic_id, 0, visited)
    print()


def _print_chain_recursive(topic_id: int, depth: int, visited: set) -> None:
    """Recorre el árbol hacia arriba (padres) de forma recursiva."""
    if topic_id in visited:
        return
    visited.add(topic_id)

    parents = [r for r in RELATIONS if r["id_topic_son"] == topic_id]

    if not parents:
        indent = "  " * depth
        name = TOPIC_MAP.get(topic_id, {}).get("name", "?")
        print(f"{indent}[ROOT] {name} (ID {topic_id}) -- Tema raiz")
        return

    for rel in parents:
        parent_id = rel["id_topic_father"]
        parent_name = TOPIC_MAP.get(parent_id, {}).get("name", "?")
        indent = "  " * depth
        print(f"{indent}<- {parent_name} (ID {parent_id}, corr: {rel['correlation']})")
        _print_chain_recursive(parent_id, depth + 1, visited)


def find_bottleneck_topics(
    student_scores: dict[int, float],
    threshold: float = 70.0,
) -> list[dict]:
    """
    Identifica los "cuellos de botella": temas con score bajo
    que bloquean múltiples temas hijos.
    Ordenados por cantidad de hijos bloqueados (descendente).
    """
    bottlenecks = []

    for topic in TOPICS:
        tid = topic["id_topic"]
        score = student_scores.get(tid, 0)

        if score >= threshold:
            continue

        # Contar cuántos hijos dependen de este tema
        children = [r for r in RELATIONS if r["id_topic_father"] == tid]
        if not children:
            continue

        child_names = [
            TOPIC_MAP[r["id_topic_son"]]["name"]
            for r in children
            if r["id_topic_son"] in TOPIC_MAP
        ]

        bottlenecks.append({
            "id_topic": tid,
            "name": topic["name"],
            "score": score,
            "blocks_count": len(children),
            "blocks_topics": child_names,
        })

    bottlenecks.sort(key=lambda b: b["blocks_count"], reverse=True)
    return bottlenecks
