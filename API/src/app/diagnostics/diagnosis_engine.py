"""
ArenAI – Motor de Diagnóstico de Raíz (SDR)
=============================================
Cada capa devuelve un "suspicion_score" (0.0–1.0).
La función principal elige la capa con el score más alto
y genera el reporte estructurado con cause codes para analytics.

Capas:
  1. Guessing Detector       → ERR_TIME
  2. Prerequisite Backtrack  → ERR_GAP
  3. Group vs Individual     → ERR_SYS
  4. Chat Keyword Miner      → ERR_ENGAGE
"""

from __future__ import annotations
from typing import Any

from mock_data import (
    TOPIC_MAP, RELATIONS, TOPIC_RESOURCES,
    FRUSTRATION_KEYWORDS, CAUSE_CODES,
)

# ─── Configuración ───────────────────────────
MIN_READ_TIME_SECONDS = 10   # debajo de esto = "bateo"
PASSING_SCORE          = 70   # umbral de aprobación
CLASS_FAIL_THRESHOLD   = 60   # si la clase baja de esto → sistémico


# ═══════════════════════════════════════════════
#  CAPA 1 – Detector de Bateo (Guessing)
# ═══════════════════════════════════════════════
def layer_guessing(avg_time: float) -> dict:
    """
    Si el tiempo promedio de respuesta es menor al
    mínimo de lectura, el estudiante no leyó la pregunta.
    """
    if avg_time < MIN_READ_TIME_SECONDS:
        suspicion = min(1.0, 1.0 - (avg_time / MIN_READ_TIME_SECONDS))
        return {
            "layer": "GUESSING",
            "cause_code": CAUSE_CODES["GUESSING"],
            "suspicion_score": round(suspicion, 2),
            "detail": f"Tiempo promedio de {avg_time:.1f}s (mínimo esperado: {MIN_READ_TIME_SECONDS}s)",
        }
    return {
        "layer": "GUESSING",
        "cause_code": CAUSE_CODES["GUESSING"],
        "suspicion_score": 0.0,
        "detail": f"Tiempo promedio de {avg_time:.1f}s — lectura adecuada",
    }


# ═══════════════════════════════════════════════
#  CAPA 2 – Backtracking de Prerrequisitos
# ═══════════════════════════════════════════════
def layer_prerequisites(topic_id: int, student_scores: dict[int, float]) -> dict:
    """
    Busca los temas padre del tema fallido.
    Calcula Gap = correlation × (100 − parent_score).
    Si algún padre está debajo del umbral → laguna encontrada.
    """
    parents = [r for r in RELATIONS if r["id_topic_son"] == topic_id]

    if not parents:
        return {
            "layer": "PREREQUISITE_GAP",
            "cause_code": CAUSE_CODES["PREREQUISITE_GAP"],
            "suspicion_score": 0.0,
            "detail": "Tema raíz — no tiene prerrequisitos",
            "weak_prerequisites": [],
        }

    weak_parents = []
    max_gap = 0.0

    for rel in parents:
        parent_id = rel["id_topic_father"]
        parent_score = student_scores.get(parent_id, 0)
        parent_name = TOPIC_MAP[parent_id]["name"]
        gap = rel["correlation"] * (100 - parent_score)

        if parent_score < PASSING_SCORE:
            weak_parents.append({
                "id_topic": parent_id,
                "name": parent_name,
                "score": parent_score,
                "correlation": rel["correlation"],
                "gap": round(gap, 2),
            })

        if gap > max_gap:
            max_gap = gap

    suspicion = min(1.0, max_gap / 100) if weak_parents else 0.0

    detail = "Sin lagunas detectadas en prerrequisitos"
    if weak_parents:
        worst = max(weak_parents, key=lambda p: p["gap"])
        detail = (
            f"Laguna crítica en '{worst['name']}' "
            f"(score: {worst['score']}%, correlación: {worst['correlation']})"
        )

    return {
        "layer": "PREREQUISITE_GAP",
        "cause_code": CAUSE_CODES["PREREQUISITE_GAP"],
        "suspicion_score": round(suspicion, 2),
        "detail": detail,
        "weak_prerequisites": weak_parents,
    }


# ═══════════════════════════════════════════════
#  CAPA 3 – Filtro Individual vs. Grupal
# ═══════════════════════════════════════════════
def layer_group_filter(
    student_score: float,
    section_avg: float,
) -> dict:
    """
    Compara el score del estudiante con el promedio de la sección.
    - Si ambos son bajos → problema sistémico (método/material).
    - Si la clase es alta pero el estudiante es bajo → problema individual.
    """
    if section_avg < CLASS_FAIL_THRESHOLD:
        suspicion = min(1.0, (CLASS_FAIL_THRESHOLD - section_avg) / CLASS_FAIL_THRESHOLD)
        return {
            "layer": "SYSTEMIC",
            "cause_code": CAUSE_CODES["SYSTEMIC"],
            "suspicion_score": round(suspicion, 2),
            "detail": (
                f"Promedio de la sección: {section_avg}% "
                f"(debajo del umbral de {CLASS_FAIL_THRESHOLD}%). "
                "Problema probable: método de enseñanza o material"
            ),
            "is_systemic": True,
        }

    # Problema individual
    gap_vs_class = max(0, section_avg - student_score)
    suspicion = 0.0
    if gap_vs_class > 20:
        suspicion = min(1.0, gap_vs_class / 100)

    return {
        "layer": "SYSTEMIC",
        "cause_code": CAUSE_CODES["SYSTEMIC"],
        "suspicion_score": round(suspicion, 2),
        "detail": (
            f"Promedio sección: {section_avg}%, Estudiante: {student_score}%. "
            f"Diferencia: {gap_vs_class}pts — "
            + ("Problema individual" if gap_vs_class > 20 else "Dentro del rango normal")
        ),
        "is_systemic": False,
    }


# ═══════════════════════════════════════════════
#  CAPA 4 – Minería de Palabras Clave (Chat)
# ═══════════════════════════════════════════════
def layer_chat_mining(
    user_id: int,
    subject_id: int,
    chat_history: list[dict],
) -> dict:
    """
    Busca señales de frustración en los mensajes del usuario.
    """
    user_msgs = [
        m for m in chat_history
        if m["id_user"] == user_id
        and m["id_subject"] == subject_id
        and m["role"] == "user"
    ]

    hits = 0
    matched_keywords: list[str] = []

    for msg in user_msgs:
        content_lower = msg["content"].lower()
        for kw in FRUSTRATION_KEYWORDS:
            if kw in content_lower:
                hits += 1
                if kw not in matched_keywords:
                    matched_keywords.append(kw)

    suspicion = min(1.0, hits * 0.15)  # cada hit aporta 0.15 (max ~6-7 hits para 1.0)

    return {
        "layer": "LOW_ENGAGEMENT",
        "cause_code": CAUSE_CODES["LOW_ENGAGEMENT"],
        "suspicion_score": round(suspicion, 2),
        "detail": (
            f"{hits} señal(es) de frustración detectada(s): {matched_keywords}"
            if hits > 0
            else "Sin señales de frustración en el chat"
        ),
        "keyword_hits": hits,
        "matched_keywords": matched_keywords,
    }


# ═══════════════════════════════════════════════
#  FUNCIÓN DE DECISIÓN (elige la causa con mayor suspicion)
# ═══════════════════════════════════════════════
def _find_best_resource(topic_id: int) -> dict | None:
    """Busca el recurso con mayor calidad para un tema dado."""
    resources = [r for r in TOPIC_RESOURCES if r["id_topic"] == topic_id]
    if not resources:
        return None
    return max(resources, key=lambda r: r["resource_quality"])


def _compute_success_probability(
    topic_id: int,
    student_scores: dict[int, float],
) -> float:
    """
    P_s = Π (Skill_i × Correlation_i) / 100^n
    Probabilidad de éxito basada en los prereqs.
    """
    parents = [r for r in RELATIONS if r["id_topic_son"] == topic_id]
    if not parents:
        return 1.0

    product = 1.0
    for rel in parents:
        skill = student_scores.get(rel["id_topic_father"], 0) / 100.0
        product *= skill * rel["correlation"]

    return round(product, 4)


def diagnose(
    student_id: int,
    topic_id: int,
    student_scores: dict[int, float],
    quiz_time_avg: float,
    section_avg: float,
    chat_history: list[dict],
    subject_id: int = 1,
) -> dict[str, Any]:
    """
    Ejecuta las 4 capas de diagnóstico y construye el reporte
    con estructura optimizada para analytics (cause codes, severity, etc.)
    """
    student_score = student_scores.get(topic_id, 0)
    topic_name = TOPIC_MAP.get(topic_id, {}).get("name", "Desconocido")

    # ─── Ejecutar cada capa ────────────────────
    result_guessing = layer_guessing(quiz_time_avg)
    result_prereqs  = layer_prerequisites(topic_id, student_scores)
    result_group    = layer_group_filter(student_score, section_avg)
    result_chat     = layer_chat_mining(student_id, subject_id, chat_history)

    # ---- Reunion de capas y seleccion por prioridad ponderada ----
    layers = [result_guessing, result_prereqs, result_group, result_chat]

    # Las capas estructurales (guessing, prereqs, sistémico) tienen
    # multiplicadores de prioridad para que superen a la capa
    # cualitativa (chat) cuando ambas tienen señales.
    #
    # Prioridad: GUESSING (×1.5) > PREREQS (×1.3) > SYSTEMIC (×1.2) > CHAT (×1.0)
    PRIORITY_WEIGHTS = {
        "GUESSING":         1.5,
        "PREREQUISITE_GAP": 1.3,
        "SYSTEMIC":         1.2,
        "LOW_ENGAGEMENT":   1.0,
    }

    for layer in layers:
        weight = PRIORITY_WEIGHTS.get(layer["layer"], 1.0)
        layer["_effective_score"] = round(layer["suspicion_score"] * weight, 3)

    # La capa con mayor score efectivo gana
    primary = max(layers, key=lambda l: l["_effective_score"])

    # Si ninguna capa tiene sospecha real, usamos CONCEPT_SPECIFIC
    if primary["_effective_score"] < 0.05:
        primary = {
            "layer": "CONCEPT_SPECIFIC",
            "cause_code": CAUSE_CODES["CONCEPT_SPECIFIC"],
            "suspicion_score": 0.5,
            "detail": f"Dificultad con el concepto específico de '{topic_name}'",
            "_effective_score": 0.5,
        }

    # ─── Calcular métricas globales ────────────
    severity = round(primary["suspicion_score"] * (1 - student_score / 100), 2)
    success_prob = _compute_success_probability(topic_id, student_scores)

    # ─── Buscar recurso sugerido ───────────────
    suggested_resource = None
    suggested_action = "Continuar con práctica del tema actual"

    if primary["cause_code"] == CAUSE_CODES["PREREQUISITE_GAP"] and result_prereqs["weak_prerequisites"]:
        worst_prereq = max(result_prereqs["weak_prerequisites"], key=lambda p: p["gap"])
        res = _find_best_resource(worst_prereq["id_topic"])
        if res:
            suggested_resource = res
            suggested_action = (
                f"Repasar Recurso ID #{res['id_topic_resource']} "
                f"({res['description']})"
            )
        else:
            suggested_action = f"Repasar '{worst_prereq['name']}' antes de continuar"

    elif primary["cause_code"] == CAUSE_CODES["GUESSING"]:
        suggested_action = "Implementar quiz supervisado con temporizador mínimo"

    elif primary["cause_code"] == CAUSE_CODES["SYSTEMIC"]:
        suggested_action = "Revisar material y método de enseñanza del tema con el profesor"

    elif primary["cause_code"] == CAUSE_CODES["LOW_ENGAGEMENT"]:
        res = _find_best_resource(topic_id)
        if res:
            suggested_resource = res
            suggested_action = (
                f"Sesión guiada con IA + Recurso ID #{res['id_topic_resource']} "
                f"({res['description']})"
            )

    # ─── Construir el reporte final ────────────
    # Determinar behavior_note basada en tiempo
    if quiz_time_avg < MIN_READ_TIME_SECONDS:
        behavior_note = f"Respuestas extremadamente rápidas ({quiz_time_avg:.0f}s avg) → posible bateo"
    elif quiz_time_avg > 90:
        behavior_note = f"Tiempo alto ({quiz_time_avg:.0f}s avg) → esfuerzo genuino sin éxito"
    else:
        behavior_note = f"Tiempo normal ({quiz_time_avg:.0f}s avg)"

    report = {
        "student_id": student_id,
        "topic_id": topic_id,
        "topic_failed": topic_name,
        "student_score": student_score,

        # ── Metadata para analytics (SELECT GROUP BY) ──
        "analysis_metadata": {
            "primary_cause_code": primary["cause_code"],
            "primary_cause_layer": primary["layer"],
            "severity_index": severity,
            "confidence_level": primary["suspicion_score"],
            "success_probability": success_prob,
        },

        # ── Diagnóstico detallado ──
        "root_cause_analysis": {
            "primary_cause": primary["layer"].replace("_", " ").title(),
            "details": primary["detail"],
            "behavior_note": behavior_note,
            "context_check": result_group["detail"],
            "chat_signals": result_chat["detail"],
            "impacted_prerequisite_id": (
                result_prereqs["weak_prerequisites"][0]["id_topic"]
                if result_prereqs["weak_prerequisites"]
                else None
            ),
        },

        # ── Acción sugerida (cierra el ciclo del producto) ──
        "suggested_action": suggested_action,
        "suggested_resource": suggested_resource,

        # ── Todas las capas (para debugging / futuro ML) ──
        "all_layers": layers,
    }

    return report
