"""
ArenAI – Debug Runner (SDR Test Scenarios)
===========================================
Ejecuta 5 escenarios de prueba y muestra la matriz de relaciones.

Uso:
  cd c:\\ArenAI\\ArenAI\\API\\src\\app\\diagnostics
  python run_debug.py
"""

import sys
import json

# Fix Windows cp1252 encoding
sys.stdout.reconfigure(encoding='utf-8')

from mock_data import (
    aggregate_student_topics,
    aggregate_class_topics,
    CLASS_STUDENTS_NORMAL,
    CLASS_STUDENTS_SYSTEMIC,
    CHAT_HISTORY, TOPIC_MAP,
)
from diagnosis_engine import diagnose
from matrix_builder import (
    build_adjacency_matrix, print_matrix,
    print_dependency_chain, find_bottleneck_topics,
)


def separator(title: str) -> None:
    print(f"\n{'#' * 60}")
    print(f"  {title}")
    print(f"{'#' * 60}")


def print_report(report: dict) -> None:
    """Imprime el reporte en formato JSON indentado con colores ASCII."""
    # Solo metadata + root cause + suggested action (sin all_layers para limpieza)
    clean = {k: v for k, v in report.items() if k != "all_layers"}
    print(json.dumps(clean, indent=2, ensure_ascii=False))


def run_all_scenarios():
    """Ejecuta los 5 escenarios de diagnóstico."""

    # ═══════════════════════════════════════════
    #  PARTE 1: MATRIZ DE RELACIONES
    # ═══════════════════════════════════════════
    separator("PARTE 1: MATRIZ DE RELACIONES ENTRE TEMAS")

    matrix_data = build_adjacency_matrix()

    # Matriz limpia (sin scores)
    print_matrix(matrix_data, title="MATRIZ DE CORRELACIONES (padre → hijo)")

    # Generate aggregated topic data for Student 201
    student_201_metrics = aggregate_student_topics(201)
    student_201_scores = {topic_id: data["score_pct"] for topic_id, data in student_201_metrics.items()}

    # Matriz con overlay de Student 201 (laguna en multiplicación)
    print_matrix(
        matrix_data,
        student_scores=student_201_scores,
        title="OVERLAY: Estudiante 201 (Laguna en Multiplicación)",
    )

    # Cadena de prerrequisitos para Ecuaciones Lineales
    print_dependency_chain(108)

    # Cuellos de botella del estudiante 201
    bottlenecks = find_bottleneck_topics(student_201_scores)
    print("🚧 CUELLOS DE BOTELLA — Estudiante 201:")
    print(f"{'-' * 50}")
    for b in bottlenecks:
        print(f"  ✗ {b['name']} (score: {b['score']}%) → bloquea {b['blocks_count']} temas: {b['blocks_topics']}")
    print()

    # ═══════════════════════════════════════════
    #  PARTE 2: ESCENARIOS DE DIAGNÓSTICO
    # ═══════════════════════════════════════════

    # Compute section averages
    section_metrics_normal = aggregate_class_topics(CLASS_STUDENTS_NORMAL)
    section_metrics_systemic = aggregate_class_topics(CLASS_STUDENTS_SYSTEMIC)

    # Compute students aggregated metrics
    student_metrics = {
        sid: aggregate_student_topics(sid)
        for sid in CLASS_STUDENTS_NORMAL
    }

    # Helper function to get simple score dict for diagnosis engine and matrix builder
    def get_scores_dict(sid):
        return {tid: data["score_pct"] for tid, data in student_metrics[sid].items()}
        
    def get_avg_time(sid, tid):
        if tid in student_metrics[sid]:
            return student_metrics[sid][tid]["avg_time"]
        return 0
        
    def get_section_avg(tid, systemic=False):
        section = section_metrics_systemic if systemic else section_metrics_normal
        if tid in section:
            return section[tid]["avg_score_pct"]
        return 0

    # ─── Escenario A: Laguna de Prerrequisito ───
    separator("ESCENARIO A: Laguna de Prerrequisito")
    print("Estudiante 201 falla en División (104). Base débil en Multiplicación (103).")
    print("Expectativa: primary_cause_code = ERR_GAP\n")
    report_a = diagnose(
        student_id=201,
        topic_id=104,
        student_scores=get_scores_dict(201),
        quiz_time_avg=get_avg_time(201, 104),
        section_avg=get_section_avg(104),
        chat_history=CHAT_HISTORY,
    )
    print_report(report_a)

    # ─── Escenario B: Bateo / Guessing ───
    separator("ESCENARIO B: Bateo / Respuesta al Azar")
    print("Estudiante 202 responde en ≤6 segundos promedio. Score bajísimo.")
    print("Expectativa: primary_cause_code = ERR_TIME\n")
    report_b = diagnose(
        student_id=202,
        topic_id=104,
        student_scores=get_scores_dict(202),
        quiz_time_avg=get_avg_time(202, 104),
        section_avg=get_section_avg(104),
        chat_history=CHAT_HISTORY,
    )
    print_report(report_b)

    # ─── Escenario C: Concepto Específico ───
    separator("ESCENARIO C: Concepto Específico Difícil")
    print("Estudiante 203 tiene bases sólidas (>85% en todo) pero falla en Ecuaciones (108).")
    print("Expectativa: primary_cause_code = ERR_CONCEPT o ERR_ENGAGE (sin prereqs débiles)\n")
    report_c = diagnose(
        student_id=203,
        topic_id=108,
        student_scores=get_scores_dict(203),
        quiz_time_avg=get_avg_time(203, 108),
        section_avg=get_section_avg(108),
        chat_history=CHAT_HISTORY,
    )
    print_report(report_c)

    # ─── Escenario D: Problema Sistémico ───
    separator("ESCENARIO D: Problema Sistémico (Toda la Clase Falla)")
    print("Estudiante 204 en sección 7-2 donde el promedio grupal baja de 60%.")
    print("Expectativa: primary_cause_code = ERR_SYS\n")
    report_d = diagnose(
        student_id=204,
        topic_id=104,
        student_scores=get_scores_dict(204),
        quiz_time_avg=get_avg_time(204, 104),
        section_avg=get_section_avg(104, systemic=True),
        chat_history=CHAT_HISTORY,
    )
    print_report(report_d)

    # ─── Escenario E: Señales de Frustración en Chat ───
    separator("ESCENARIO E: Frustración Detectada en Chat")
    print("Estudiante 201 tiene múltiples mensajes con 'no entiendo', 'difícil', 'ayuda'.")
    print("Expectativa: chat_signals muestra keywords + contexto cualitativo\n")
    # Reutilizamos report_a ya que incluye los datos de chat del estudiante 201
    print("(Los datos de chat ya se incluyeron en el Escenario A)")
    print(f"  Chat signals: {report_a['root_cause_analysis']['chat_signals']}")
    print()

    # ─── Extra: Comparativa de todos los estudiantes en un tema ───
    separator("COMPARATIVA: Todos los Estudiantes en División (104)")
    for sid in CLASS_STUDENTS_NORMAL:
        r = diagnose(
            student_id=sid,
            topic_id=104,
            student_scores=get_scores_dict(sid),
            quiz_time_avg=get_avg_time(sid, 104),
            section_avg=get_section_avg(104),
            chat_history=CHAT_HISTORY,
        )
        meta = r["analysis_metadata"]
        print(
            f"  Estudiante {sid}: "
            f"Score={r['student_score']:>3}% │ "
            f"Causa={meta['primary_cause_code']:<12} │ "
            f"Severidad={meta['severity_index']:.2f} │ "
            f"Confianza={meta['confidence_level']:.2f} │ "
            f"P(éxito)={meta['success_probability']:.4f} │ "
            f"Acción: {r['suggested_action'][:50]}"
        )

    print(f"\n{'═' * 60}")
    print("  ✅ DEBUG COMPLETO — SDR ArenAI")
    print(f"{'═' * 60}\n")


if __name__ == "__main__":
    run_all_scenarios()
