"""
ArenAI – Mock Data (Simula las tablas de la BD real)
=====================================================
ADAPTADO al flujo real de datos: quiz → question (con topic) → response (con time)

Tablas simuladas:
  - topic, topic_father_son_relation, topic_resource
  - quiz, quiz_question (cada pregunta tiene un id_topic)
  - quiz_attempt (un intento por estudiante)
  - quiz_response (una respuesta por pregunta: is_correct, time_taken_seconds)
  - class_student (para promedios de sección)
  - learning_chat_history

Materia: Matemáticas (id_subject = 1)
Sección: 7-1 (id_section = 1, id_class = 1)
"""

# ─────────────────────────────────────────────
#  TOPICS  (tabla: topic)
# ─────────────────────────────────────────────
TOPICS = [
    {"id_topic": 101, "name": "Suma",                "id_subject": 1, "description": "Operaciones basicas de adicion"},
    {"id_topic": 102, "name": "Resta",               "id_subject": 1, "description": "Operaciones basicas de sustraccion"},
    {"id_topic": 103, "name": "Multiplicacion",      "id_subject": 1, "description": "Tablas y operaciones de multiplicar"},
    {"id_topic": 104, "name": "Division",            "id_subject": 1, "description": "Division entera y con decimales"},
    {"id_topic": 105, "name": "Fracciones",          "id_subject": 1, "description": "Operaciones con fracciones"},
    {"id_topic": 106, "name": "Decimales",           "id_subject": 1, "description": "Conversion y operaciones decimales"},
    {"id_topic": 107, "name": "Algebra Basica",      "id_subject": 1, "description": "Variables y expresiones simples"},
    {"id_topic": 108, "name": "Ecuaciones Lineales", "id_subject": 1, "description": "Resolucion de ecuaciones de primer grado"},
]

TOPIC_MAP = {t["id_topic"]: t for t in TOPICS}

# ─────────────────────────────────────────────
#  RELACIONES PADRE-HIJO  (tabla: topic_father_son_relation)
# ─────────────────────────────────────────────
#  Arbol:
#  Suma(101) --0.85--> Resta(102)
#  Suma(101) --0.80--> Multiplicacion(103)
#  Resta(102) -0.75--> Multiplicacion(103)
#  Multiplicacion(103) --0.90--> Division(104)
#  Division(104) --0.85--> Fracciones(105)
#  Multiplicacion(103) --0.70--> Fracciones(105)
#  Fracciones(105) --0.80--> Decimales(106)
#  Suma(101) --0.70--> Algebra Basica(107)
#  Multiplicacion(103) --0.80--> Algebra Basica(107)
#  Algebra Basica(107) --0.95--> Ecuaciones Lineales(108)
#  Resta(102) --0.75--> Ecuaciones Lineales(108)
#

RELATIONS = [
    {"id": 1,  "id_topic_father": 101, "id_topic_son": 102, "correlation": 0.85},
    {"id": 2,  "id_topic_father": 101, "id_topic_son": 103, "correlation": 0.80},
    {"id": 3,  "id_topic_father": 102, "id_topic_son": 103, "correlation": 0.75},
    {"id": 4,  "id_topic_father": 103, "id_topic_son": 104, "correlation": 0.90},
    {"id": 5,  "id_topic_father": 104, "id_topic_son": 105, "correlation": 0.85},
    {"id": 6,  "id_topic_father": 103, "id_topic_son": 105, "correlation": 0.70},
    {"id": 7,  "id_topic_father": 105, "id_topic_son": 106, "correlation": 0.80},
    {"id": 8,  "id_topic_father": 101, "id_topic_son": 107, "correlation": 0.70},
    {"id": 9,  "id_topic_father": 103, "id_topic_son": 107, "correlation": 0.80},
    {"id": 10, "id_topic_father": 107, "id_topic_son": 108, "correlation": 0.95},
    {"id": 11, "id_topic_father": 102, "id_topic_son": 108, "correlation": 0.75},
]

# ─────────────────────────────────────────────
#  RECURSOS POR TEMA  (tabla: topic_resource)
# ─────────────────────────────────────────────
TOPIC_RESOURCES = [
    {"id_topic_resource": 40, "id_topic": 101, "resource_source": "https://example.com/video-suma",         "description": "Video: Suma paso a paso",           "resource_quality": 92},
    {"id_topic_resource": 41, "id_topic": 102, "resource_source": "https://example.com/video-resta",        "description": "Video: Resta con reagrupacion",     "resource_quality": 88},
    {"id_topic_resource": 42, "id_topic": 103, "resource_source": "https://example.com/video-multi",        "description": "Video: Tablas de multiplicar",      "resource_quality": 95},
    {"id_topic_resource": 43, "id_topic": 104, "resource_source": "https://example.com/video-division",     "description": "Video: Division larga",              "resource_quality": 90},
    {"id_topic_resource": 44, "id_topic": 105, "resource_source": "https://example.com/video-fracciones",   "description": "Video: Fracciones simplificadas",    "resource_quality": 85},
    {"id_topic_resource": 45, "id_topic": 106, "resource_source": "https://example.com/video-decimales",    "description": "Video: Operaciones con decimales",   "resource_quality": 80},
    {"id_topic_resource": 46, "id_topic": 107, "resource_source": "https://example.com/video-algebra",      "description": "Video: Intro al algebra",            "resource_quality": 87},
    {"id_topic_resource": 47, "id_topic": 108, "resource_source": "https://example.com/video-ecuaciones",   "description": "Video: Ecuaciones de primer grado",  "resource_quality": 91},
]


# ═════════════════════════════════════════════════════════════
#  QUIZZES, QUESTIONS & RESPONSES  (flujo real del sistema)
# ═════════════════════════════════════════════════════════════
#
#  Un quiz tiene preguntas de MULTIPLES topics.
#  Cada respuesta tiene su propio time_taken_seconds.
#  El diagnostico AGREGA por topic a partir de estas respuestas.
#

QUIZZES = [
    {"id_quiz": 1, "id_professor": 300, "id_subject": 1, "quiz_name": "Examen Parcial 1", "level": "7"},
    {"id_quiz": 2, "id_professor": 300, "id_subject": 1, "quiz_name": "Quiz Rapido: Division y Fracciones", "level": "7"},
    {"id_quiz": 3, "id_professor": 300, "id_subject": 1, "quiz_name": "Quiz Algebra y Ecuaciones", "level": "7"},
]

# Preguntas: cada una con un id_topic
QUIZ_QUESTIONS = [
    # --- Quiz 1: Examen Parcial (covers Suma, Resta, Multiplicacion, Division) ---
    {"id_question": 1,  "id_quiz": 1, "id_topic": 101, "question_text": "Cuanto es 245 + 378?",       "points": 1.00},
    {"id_question": 2,  "id_quiz": 1, "id_topic": 101, "question_text": "Cuanto es 1024 + 976?",      "points": 1.00},
    {"id_question": 3,  "id_quiz": 1, "id_topic": 102, "question_text": "Cuanto es 500 - 237?",       "points": 1.00},
    {"id_question": 4,  "id_quiz": 1, "id_topic": 102, "question_text": "Cuanto es 1000 - 463?",      "points": 1.50},
    {"id_question": 5,  "id_quiz": 1, "id_topic": 103, "question_text": "Cuanto es 12 x 15?",         "points": 1.50},
    {"id_question": 6,  "id_quiz": 1, "id_topic": 103, "question_text": "Cuanto es 25 x 8?",          "points": 1.50},
    {"id_question": 7,  "id_quiz": 1, "id_topic": 103, "question_text": "Cuanto es 7 x 13?",          "points": 2.00},
    {"id_question": 8,  "id_quiz": 1, "id_topic": 104, "question_text": "Cuanto es 144 / 12?",        "points": 2.00},
    {"id_question": 9,  "id_quiz": 1, "id_topic": 104, "question_text": "Cuanto es 225 / 15?",        "points": 2.00},
    {"id_question": 10, "id_quiz": 1, "id_topic": 104, "question_text": "Cuanto es 360 / 24?",        "points": 2.50},

    # --- Quiz 2: Division + Fracciones ---
    {"id_question": 11, "id_quiz": 2, "id_topic": 104, "question_text": "Cuanto es 84 / 7?",          "points": 1.00},
    {"id_question": 12, "id_quiz": 2, "id_topic": 104, "question_text": "Cuanto es 156 / 12?",        "points": 1.50},
    {"id_question": 13, "id_quiz": 2, "id_topic": 105, "question_text": "Cuanto es 1/2 + 1/3?",       "points": 2.00},
    {"id_question": 14, "id_quiz": 2, "id_topic": 105, "question_text": "Simplifica 8/12",            "points": 1.50},
    {"id_question": 15, "id_quiz": 2, "id_topic": 105, "question_text": "Cuanto es 3/4 x 2/5?",      "points": 2.00},

    # --- Quiz 3: Algebra + Ecuaciones ---
    {"id_question": 16, "id_quiz": 3, "id_topic": 107, "question_text": "Simplifica 3x + 2x",        "points": 1.00},
    {"id_question": 17, "id_quiz": 3, "id_topic": 107, "question_text": "Si x=4, cuanto es 2x+3?",   "points": 1.50},
    {"id_question": 18, "id_quiz": 3, "id_topic": 108, "question_text": "Resuelve: x + 5 = 12",      "points": 2.00},
    {"id_question": 19, "id_quiz": 3, "id_topic": 108, "question_text": "Resuelve: 2x - 6 = 10",     "points": 2.50},
    {"id_question": 20, "id_quiz": 3, "id_topic": 108, "question_text": "Resuelve: 3x + 4 = 19",     "points": 2.50},
]

QUESTION_MAP = {q["id_question"]: q for q in QUIZ_QUESTIONS}

# Attempts (student takes a quiz)
QUIZ_ATTEMPTS = [
    # --- Student 201 (Laguna en Multiplicacion) ---
    {"id_attempt": 1,  "id_quiz": 1, "id_student": 201},
    {"id_attempt": 2,  "id_quiz": 2, "id_student": 201},
    {"id_attempt": 3,  "id_quiz": 3, "id_student": 201},
    # --- Student 202 (El bateador / guesser) ---
    {"id_attempt": 4,  "id_quiz": 1, "id_student": 202},
    {"id_attempt": 5,  "id_quiz": 2, "id_student": 202},
    # --- Student 203 (Bases solidas, falla solo ecuaciones) ---
    {"id_attempt": 6,  "id_quiz": 1, "id_student": 203},
    {"id_attempt": 7,  "id_quiz": 3, "id_student": 203},
    # --- Student 204 (Promedio general mediocre) ---
    {"id_attempt": 8,  "id_quiz": 1, "id_student": 204},
    {"id_attempt": 9,  "id_quiz": 2, "id_student": 204},
    {"id_attempt": 10, "id_quiz": 3, "id_student": 204},
]

# ─────────────────────────────────────────────
#  QUIZ RESPONSES — the core granular data
#  Each row: one answer to one question, with time
# ─────────────────────────────────────────────
#  Format: (id_attempt, id_question, is_correct, points_awarded, time_taken_seconds)
#
QUIZ_RESPONSES = [
    # ====== Student 201: Good at Suma/Resta, BAD at Multiplicacion/Division ======
    # Quiz 1 (attempt 1)
    {"id_attempt": 1, "id_question": 1,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 25},   # Suma
    {"id_attempt": 1, "id_question": 2,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 30},   # Suma
    {"id_attempt": 1, "id_question": 3,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 28},   # Resta
    {"id_attempt": 1, "id_question": 4,  "is_correct": True,  "points_awarded": 1.50, "time_taken": 35},   # Resta
    {"id_attempt": 1, "id_question": 5,  "is_correct": False, "points_awarded": 0.00, "time_taken": 65},   # Multi ✗
    {"id_attempt": 1, "id_question": 6,  "is_correct": False, "points_awarded": 0.00, "time_taken": 70},   # Multi ✗
    {"id_attempt": 1, "id_question": 7,  "is_correct": False, "points_awarded": 0.00, "time_taken": 80},   # Multi ✗
    {"id_attempt": 1, "id_question": 8,  "is_correct": False, "points_awarded": 0.00, "time_taken": 90},   # Division ✗
    {"id_attempt": 1, "id_question": 9,  "is_correct": False, "points_awarded": 0.00, "time_taken": 95},   # Division ✗
    {"id_attempt": 1, "id_question": 10, "is_correct": False, "points_awarded": 0.00, "time_taken": 100},  # Division ✗
    # Quiz 2 (attempt 2) — Division + Fracciones
    {"id_attempt": 2, "id_question": 11, "is_correct": False, "points_awarded": 0.00, "time_taken": 85},   # Division ✗
    {"id_attempt": 2, "id_question": 12, "is_correct": False, "points_awarded": 0.00, "time_taken": 90},   # Division ✗
    {"id_attempt": 2, "id_question": 13, "is_correct": False, "points_awarded": 0.00, "time_taken": 110},  # Fracciones ✗
    {"id_attempt": 2, "id_question": 14, "is_correct": False, "points_awarded": 0.00, "time_taken": 95},   # Fracciones ✗
    {"id_attempt": 2, "id_question": 15, "is_correct": False, "points_awarded": 0.00, "time_taken": 100},  # Fracciones ✗
    # Quiz 3 (attempt 3) — Algebra + Ecuaciones
    {"id_attempt": 3, "id_question": 16, "is_correct": True,  "points_awarded": 1.00, "time_taken": 40},   # Algebra ok
    {"id_attempt": 3, "id_question": 17, "is_correct": True,  "points_awarded": 1.50, "time_taken": 45},   # Algebra ok
    {"id_attempt": 3, "id_question": 18, "is_correct": False, "points_awarded": 0.00, "time_taken": 100},  # Ecuaciones ✗
    {"id_attempt": 3, "id_question": 19, "is_correct": False, "points_awarded": 0.00, "time_taken": 120},  # Ecuaciones ✗
    {"id_attempt": 3, "id_question": 20, "is_correct": False, "points_awarded": 0.00, "time_taken": 115},  # Ecuaciones ✗

    # ====== Student 202: GUESSER — answers everything super fast ======
    # Quiz 1 (attempt 4)
    {"id_attempt": 4, "id_question": 1,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 3},    # Lucky guess
    {"id_attempt": 4, "id_question": 2,  "is_correct": False, "points_awarded": 0.00, "time_taken": 4},
    {"id_attempt": 4, "id_question": 3,  "is_correct": False, "points_awarded": 0.00, "time_taken": 3},
    {"id_attempt": 4, "id_question": 4,  "is_correct": False, "points_awarded": 0.00, "time_taken": 5},
    {"id_attempt": 4, "id_question": 5,  "is_correct": True,  "points_awarded": 1.50, "time_taken": 4},    # Lucky guess
    {"id_attempt": 4, "id_question": 6,  "is_correct": False, "points_awarded": 0.00, "time_taken": 3},
    {"id_attempt": 4, "id_question": 7,  "is_correct": False, "points_awarded": 0.00, "time_taken": 6},
    {"id_attempt": 4, "id_question": 8,  "is_correct": False, "points_awarded": 0.00, "time_taken": 5},
    {"id_attempt": 4, "id_question": 9,  "is_correct": False, "points_awarded": 0.00, "time_taken": 4},
    {"id_attempt": 4, "id_question": 10, "is_correct": False, "points_awarded": 0.00, "time_taken": 7},
    # Quiz 2 (attempt 5)
    {"id_attempt": 5, "id_question": 11, "is_correct": False, "points_awarded": 0.00, "time_taken": 3},
    {"id_attempt": 5, "id_question": 12, "is_correct": False, "points_awarded": 0.00, "time_taken": 4},
    {"id_attempt": 5, "id_question": 13, "is_correct": False, "points_awarded": 0.00, "time_taken": 5},
    {"id_attempt": 5, "id_question": 14, "is_correct": True,  "points_awarded": 1.50, "time_taken": 3},    # Lucky
    {"id_attempt": 5, "id_question": 15, "is_correct": False, "points_awarded": 0.00, "time_taken": 4},

    # ====== Student 203: SOLID bases, struggles only with Ecuaciones ======
    # Quiz 1 (attempt 6) — aces everything
    {"id_attempt": 6, "id_question": 1,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 15},
    {"id_attempt": 6, "id_question": 2,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 18},
    {"id_attempt": 6, "id_question": 3,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 20},
    {"id_attempt": 6, "id_question": 4,  "is_correct": True,  "points_awarded": 1.50, "time_taken": 22},
    {"id_attempt": 6, "id_question": 5,  "is_correct": True,  "points_awarded": 1.50, "time_taken": 25},
    {"id_attempt": 6, "id_question": 6,  "is_correct": True,  "points_awarded": 1.50, "time_taken": 20},
    {"id_attempt": 6, "id_question": 7,  "is_correct": True,  "points_awarded": 2.00, "time_taken": 30},
    {"id_attempt": 6, "id_question": 8,  "is_correct": True,  "points_awarded": 2.00, "time_taken": 28},
    {"id_attempt": 6, "id_question": 9,  "is_correct": True,  "points_awarded": 2.00, "time_taken": 35},
    {"id_attempt": 6, "id_question": 10, "is_correct": True,  "points_awarded": 2.50, "time_taken": 40},
    # Quiz 3 (attempt 7) — good at algebra, FAILS ecuaciones
    {"id_attempt": 7, "id_question": 16, "is_correct": True,  "points_awarded": 1.00, "time_taken": 20},   # Algebra ok
    {"id_attempt": 7, "id_question": 17, "is_correct": True,  "points_awarded": 1.50, "time_taken": 25},   # Algebra ok
    {"id_attempt": 7, "id_question": 18, "is_correct": False, "points_awarded": 0.00, "time_taken": 90},   # Ecua ✗ (tried hard)
    {"id_attempt": 7, "id_question": 19, "is_correct": False, "points_awarded": 0.00, "time_taken": 120},  # Ecua ✗
    {"id_attempt": 7, "id_question": 20, "is_correct": True,  "points_awarded": 2.50, "time_taken": 110},  # Ecua got 1/3

    # ====== Student 204: MEDIOCRE across the board ======
    # Quiz 1 (attempt 8)
    {"id_attempt": 8, "id_question": 1,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 30},
    {"id_attempt": 8, "id_question": 2,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 35},
    {"id_attempt": 8, "id_question": 3,  "is_correct": True,  "points_awarded": 1.00, "time_taken": 32},
    {"id_attempt": 8, "id_question": 4,  "is_correct": False, "points_awarded": 0.00, "time_taken": 40},   # Resta miss
    {"id_attempt": 8, "id_question": 5,  "is_correct": True,  "points_awarded": 1.50, "time_taken": 45},
    {"id_attempt": 8, "id_question": 6,  "is_correct": False, "points_awarded": 0.00, "time_taken": 50},   # Multi miss
    {"id_attempt": 8, "id_question": 7,  "is_correct": False, "points_awarded": 0.00, "time_taken": 55},   # Multi miss
    {"id_attempt": 8, "id_question": 8,  "is_correct": False, "points_awarded": 0.00, "time_taken": 60},   # Division miss
    {"id_attempt": 8, "id_question": 9,  "is_correct": True,  "points_awarded": 2.00, "time_taken": 50},
    {"id_attempt": 8, "id_question": 10, "is_correct": False, "points_awarded": 0.00, "time_taken": 65},   # Division miss
    # Quiz 2 (attempt 9)
    {"id_attempt": 9, "id_question": 11, "is_correct": True,  "points_awarded": 1.00, "time_taken": 38},
    {"id_attempt": 9, "id_question": 12, "is_correct": False, "points_awarded": 0.00, "time_taken": 45},
    {"id_attempt": 9, "id_question": 13, "is_correct": False, "points_awarded": 0.00, "time_taken": 55},
    {"id_attempt": 9, "id_question": 14, "is_correct": True,  "points_awarded": 1.50, "time_taken": 40},
    {"id_attempt": 9, "id_question": 15, "is_correct": False, "points_awarded": 0.00, "time_taken": 50},
    # Quiz 3 (attempt 10)
    {"id_attempt": 10, "id_question": 16, "is_correct": True,  "points_awarded": 1.00, "time_taken": 35},
    {"id_attempt": 10, "id_question": 17, "is_correct": False, "points_awarded": 0.00, "time_taken": 50},
    {"id_attempt": 10, "id_question": 18, "is_correct": False, "points_awarded": 0.00, "time_taken": 60},
    {"id_attempt": 10, "id_question": 19, "is_correct": False, "points_awarded": 0.00, "time_taken": 70},
    {"id_attempt": 10, "id_question": 20, "is_correct": False, "points_awarded": 0.00, "time_taken": 55},
]


# ─────────────────────────────────────────────
#  AGGREGATION LAYER
#  quiz_response (per question) --> per-topic metrics
# ─────────────────────────────────────────────
def aggregate_student_topics(student_id):
    """
    Aggregates quiz response data into per-topic metrics for a student.
    This is the function that would be a SQL query in production:

    SELECT qq.id_topic,
           AVG(qr.is_correct) * 100 as correctness_pct,
           AVG(qr.time_taken_seconds) as avg_time,
           COUNT(*) as question_count,
           SUM(qr.points_awarded) / SUM(qq.points) * 100 as score_pct
    FROM quiz_response qr
    JOIN quiz_question qq ON qq.id_question = qr.id_question
    JOIN quiz_attempt qa ON qa.id_attempt = qr.id_attempt
    WHERE qa.id_student = ?
    GROUP BY qq.id_topic

    Returns dict: { topic_id: { score_pct, avg_time, correctness_pct, question_count } }
    """
    # Find all attempts by this student
    student_attempts = {a["id_attempt"] for a in QUIZ_ATTEMPTS if a["id_student"] == student_id}

    # Group responses by topic
    topic_data = {}  # topic_id -> { correct_count, total_count, points_earned, points_possible, total_time }

    for resp in QUIZ_RESPONSES:
        if resp["id_attempt"] not in student_attempts:
            continue

        question = QUESTION_MAP[resp["id_question"]]
        topic_id = question["id_topic"]

        if topic_id not in topic_data:
            topic_data[topic_id] = {
                "correct_count": 0,
                "total_count": 0,
                "points_earned": 0.0,
                "points_possible": 0.0,
                "total_time": 0.0,
                "times": [],  # individual times for guessing detection
            }

        td = topic_data[topic_id]
        td["total_count"] += 1
        td["points_possible"] += question["points"]
        td["points_earned"] += resp["points_awarded"]
        td["total_time"] += resp["time_taken"]
        td["times"].append(resp["time_taken"])
        if resp["is_correct"]:
            td["correct_count"] += 1

    # Convert to final metrics
    result = {}
    for topic_id, td in topic_data.items():
        n = td["total_count"]
        result[topic_id] = {
            "score_pct": round((td["points_earned"] / td["points_possible"]) * 100, 1) if td["points_possible"] > 0 else 0,
            "correctness_pct": round((td["correct_count"] / n) * 100, 1) if n > 0 else 0,
            "avg_time": round(td["total_time"] / n, 1) if n > 0 else 0,
            "question_count": n,
            "times": td["times"],
        }

    return result


def aggregate_class_topics(class_student_ids):
    """
    Aggregates per-topic averages across all students in a class.
    This is the "section average" used for the Individual vs. Group filter.

    Returns dict: { topic_id: { avg_score_pct, avg_time, student_count } }
    """
    # Get per-student per-topic data
    all_topic_scores = {}  # topic_id -> list of score_pcts

    for sid in class_student_ids:
        student_topics = aggregate_student_topics(sid)
        for topic_id, metrics in student_topics.items():
            if topic_id not in all_topic_scores:
                all_topic_scores[topic_id] = []
            all_topic_scores[topic_id].append(metrics["score_pct"])

    result = {}
    for topic_id, scores in all_topic_scores.items():
        n = len(scores)
        result[topic_id] = {
            "avg_score_pct": round(sum(scores) / n, 1) if n > 0 else 0,
            "student_count": n,
        }

    return result


# ─────────────────────────────────────────────
#  CLASS STUDENTS (who is in section 7-1)
# ─────────────────────────────────────────────
CLASS_STUDENTS_NORMAL = [201, 202, 203, 204]  # Section 7-1
CLASS_STUDENTS_SYSTEMIC = [201, 204]  # Simulated weak section (only weak students)


# ─────────────────────────────────────────────
#  HISTORIAL DE CHAT  (tabla: learning_chat_history)
# ─────────────────────────────────────────────
CHAT_HISTORY = [
    # Student 201 -- frustracion en Division
    {"id_user": 201, "id_subject": 1, "role": "user", "content": "No entiendo como dividir fracciones, es muy dificil"},
    {"id_user": 201, "id_subject": 1, "role": "model", "content": "Vamos a repasar paso a paso la relacion entre multiplicacion y division."},
    {"id_user": 201, "id_subject": 1, "role": "user", "content": "Ayuda, sigo sin poder resolver estos ejercicios de division"},
    {"id_user": 201, "id_subject": 1, "role": "user", "content": "Estoy confundido con las tablas de multiplicar"},

    # Student 202 -- poca interaccion
    {"id_user": 202, "id_subject": 1, "role": "user", "content": "ok"},
    {"id_user": 202, "id_subject": 1, "role": "user", "content": "ya termine"},

    # Student 203 -- esfuerzo genuino en ecuaciones
    {"id_user": 203, "id_subject": 1, "role": "user", "content": "He intentado resolver la ecuacion pero no me sale el resultado"},
    {"id_user": 203, "id_subject": 1, "role": "user", "content": "Puedes explicarme otra vez como despejar la x?"},
    {"id_user": 203, "id_subject": 1, "role": "user", "content": "Creo que entiendo el algebra pero las ecuaciones me confunden"},

    # Student 204 -- frustracion general
    {"id_user": 204, "id_subject": 1, "role": "user", "content": "Todo esta dificil, no entiendo nada"},
    {"id_user": 204, "id_subject": 1, "role": "user", "content": "Necesito ayuda con todo"},
]

# ─────────────────────────────────────────────
#  CODIGOS DE CAUSA RAIZ (para analytics / GROUP BY)
# ─────────────────────────────────────────────
CAUSE_CODES = {
    "PREREQUISITE_GAP":   "ERR_GAP",
    "GUESSING":           "ERR_TIME",
    "SYSTEMIC":           "ERR_SYS",
    "CONCEPT_SPECIFIC":   "ERR_CONCEPT",
    "LOW_ENGAGEMENT":     "ERR_ENGAGE",
    "FATIGUE":            "ERR_FATIGUE",
}

# ─────────────────────────────────────────────
#  PALABRAS CLAVE DE FRUSTRACION
# ─────────────────────────────────────────────
FRUSTRATION_KEYWORDS = [
    "no entiendo", "dificil", "ayuda", "confundido", "confunden",
    "no puedo", "no me sale", "no se", "complicado", "perdido",
]
