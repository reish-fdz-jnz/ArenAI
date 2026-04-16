import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonSearchbar,
  useIonViewWillEnter,
} from "@ionic/react";
import {
  calendarOutline,
  timeOutline,
  trophyOutline,
  bookOutline,
  filterOutline,
  checkmark,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import StudentHeader from "../components/StudentHeader";
import PageTransition from "../components/PageTransition";
import { getApiUrl } from "../config/api";
import "./StudentAssignments.css";
// import AnimatedMascot from "../components/AnimatedMascot"; // Replaced with BattleLobby style image
import { useAvatar } from "../context/AvatarContext";

interface StudentAssignment {
  id: string;
  quizId?: string;
  assignmentTitle: string;
  quizTitle: string;
  dueDate: string;
  subject: string;
  status: "pending" | "completed" | "overdue";
  score?: number;
  questionCount: number;
  topics: string[];
}

const StudentAssignments: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { getAvatarAssets, currentAvatar } = useAvatar(); // use currentAvatar for name if needed
  // Using static image for Battle Lobby parity, or could use AnimatedMascot if preferred.
  // BattleLobby uses <img src="/assets/battle_sprite_front_capybara.png" ... />
  // User said "inspire yourself of the design of the battle lobby", so I will use that layout.

  const [selectedSubject, setSelectedSubject] = useState("Math");
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [pendingSearch, setPendingSearch] = useState("");
  const [completedSearch, setCompletedSearch] = useState("");

  const fetchAssignments = async () => {
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const userStr =
        localStorage.getItem("userData") || localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      if (token && user?.id) {
        const response = await fetch(
          getApiUrl(`/api/assignments/student/${user.id}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const transformed: StudentAssignment[] = (data || []).map(
            (a: any, index: number) => {
              const dueDate = new Date(a.due_time);
              const now = new Date();
              let status: "pending" | "completed" | "overdue" = "pending";

              if (a.status === "SUBMITTED" || a.status === "GRADED")
                status = "completed";
              else if (a.status === "IN_PROGRESS") status = "pending";
              else if (now > dueDate) status = "overdue";

              return {
                id: String(a.id_assignment),
                quizId: a.id_quiz ? String(a.id_quiz) : undefined,
                assignmentTitle: a.title,
                quizTitle: (a.quiz_name || "Quiz")
                  .replace(/^Quiz:\s*/i, "")
                  .replace(/^Quiz\s+/i, ""),
                dueDate: a.due_time,
                subject: a.subject_name || "General",
                status,
                score: a.grade ? Number(a.grade) : undefined,
                questionCount: a.questions_count || 0,
                topics: a.topics || ["General"],
              };
            },
          );
          setAssignments(transformed);
        }
      }
    } catch (error) {
      console.error("Error fetching student assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  useIonViewWillEnter(() => {
    fetchAssignments();
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFormatDateObj = (dateStr: string, status: string) => {
    const date = new Date(dateStr);
    const isOverdue =
      status === "overdue" || (status === "pending" && date < new Date());
    return {
      full: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      isOverdue,
    };
  };

  const pendingAssignments = assignments.filter(
    (a) => a.status === "pending" || a.status === "overdue",
  );

  const completedAssignments = assignments.filter(
    (a) =>
      a.status === "completed" &&
      (((a.assignmentTitle || "")
        .toLowerCase()
        .includes(completedSearch.toLowerCase())) ||
        ((a.quizTitle || "").toLowerCase().includes(completedSearch.toLowerCase()))),
  );

  const startAssignment = (id: string, dueDate: string, quizId?: string) => {
    let url = `/quiz?assignmentId=${id}`;
    if (quizId) url += `&quizId=${quizId}`;
    history.push(url);
  };

  // Dynamic Mascot Message
  const getMascotMessage = () => {
    if (pendingAssignments.length === 0)
      return t("quizMenu.allCaughtUp", "Great job! No pending quizzes.");
    if (pendingAssignments.length === 1)
      return t("quizMenu.onePending", "You have 1 quiz waiting for you!");
    return t(
      "quizMenu.multiplePending",
      "You have {{count}} quizzes waiting!",
      { count: pendingAssignments.length },
    );
  };

  return (
    <IonPage className="student-assignments-page task-assignment-page">
      <StudentHeader
        showSubject={true}
        selectedSubject={selectedSubject}
        onSubjectChange={setSelectedSubject}
        pageTitle={t("sidebar.assignments")}
      />

      <IonContent
        fullscreen
        className="student-page-content task-assignment-content"
      >
        <PageTransition>
          <div className="task-container">
            {/* TOP SECTION: Battle Lobby Style Avatar Card */}
            <div className="lobby-card avatar-section-card">
              <div className="avatar-info-col">
                <div className="message-container">
                  <div className="name-tag">Aren</div>
                  <div className="speech-bubble">{getMascotMessage()}</div>
                </div>
                {/* Optional Stats or Quote could go here */}
              </div>
              <div className="avatar-visual-col">
                <img
                  src={`/assets/${currentAvatar}-front.png`}
                  alt="Mascot"
                  className="mascot-img-lg"
                />
              </div>
            </div>

            {/* PENDING SECTION - Unified Theme Colors */}
            <div className="task-card white-container">
              <div className="task-card-title brown-pill">
                {t("studentAssignments.pending")} ({pendingAssignments.length})
              </div>

              <div className="assignments-list-vertical">
                {pendingAssignments.length === 0 ? (
                  <div className="no-assignments">
                    <IonIcon icon={bookOutline} />
                    <p>{t("studentAssignments.noPending")}</p>
                  </div>
                ) : (
                  pendingAssignments.map((assignment) => {
                    const dateInfo = getFormatDateObj(
                      assignment.dueDate,
                      assignment.status,
                    );
                    return (
                      <div
                        key={assignment.id}
                        className="assignment-card-v2 theme-card"
                        onClick={() =>
                          startAssignment(
                            assignment.id,
                            assignment.dueDate,
                            assignment.quizId,
                          )
                        }
                      >
                        {/* Unified Theme Header (Brown) */}
                        <div className="assignment-card-header-v2 theme-header">
                          {/* MAIN TITLE: Quiz Name */}
                          <div className="assignment-card-title quiz-main-title">
                            {assignment.quizTitle}
                          </div>

                          {/* SUB TITLE: Assignment Name */}
                          <div className="assignment-sub-title">
                            {t("assignment.assignment")}:{" "}
                            {assignment.assignmentTitle}
                          </div>

                          <div className="assignment-card-subjects">
                            <span className="assignment-subject-tag">
                              {assignment.subject}
                            </span>
                          </div>

                          {assignment.status === "overdue" && (
                            <div className="assignment-overdue-badge">
                              {t("studentAssignments.overdue")}
                            </div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="assignment-card-body">
                          <div
                            className={`assignment-due-row ${dateInfo.isOverdue ? "overdue" : ""}`}
                          >
                            <IonIcon icon={calendarOutline} />
                            <span>Due {dateInfo.full}</span>
                          </div>
                          <div className="assignment-completed-row">
                            <IonIcon
                              icon={bookOutline}
                              style={{ marginRight: "6px", opacity: 0.7 }}
                            />
                            {assignment.questionCount}{" "}
                            {t("studentAssignments.questions")}
                          </div>

                          <div className="assignment-start-link">
                            {t("studentAssignments.start")}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COMPLETED SECTION */}
            <div className="task-card beige-container">
              <div className="task-card-title brown-pill">
                {t("studentAssignments.completedQuizzes")}
              </div>

              <div className="quiz-list-controls">
                <IonSearchbar
                  value={completedSearch}
                  onIonInput={(e) => setCompletedSearch(e.detail.value!)}
                  placeholder={t("studentAssignments.searchCompleted")}
                  className="quiz-list-searchbar"
                />
                <button className="quiz-list-filter-btn">
                  <IonIcon icon={filterOutline} />
                </button>
              </div>

              <div className="quiz-sort-label">
                {t("taskAssignment.sortedBy")}:{" "}
                {t("taskAssignment.newestFirst")}
              </div>

              <div className="task-quiz-grid">
                {completedAssignments.length === 0 ? (
                  <div className="no-assignments">
                    <IonIcon icon={bookOutline} />
                    <p>{t("studentAssignments.noCompleted")}</p>
                  </div>
                ) : (
                  completedAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="task-quiz-card theme-card completed-card-adapter"
                    >
                      <div className="task-quiz-header">
                        <div className="task-quiz-select-circle">
                          {(assignment.score || 0) >= 70 && (
                            <IonIcon icon={checkmark} />
                          )}
                        </div>
                        <div className="task-quiz-info">
                          {/* Main Title: Quiz Name */}
                          <span className="task-quiz-name">
                            {assignment.quizTitle}
                          </span>
                          <span className="task-quiz-subject">
                            {assignment.subject} •{" "}
                            {t("studentAssignments.score")}: {assignment.score}%
                          </span>
                        </div>
                      </div>
                      <div className="task-quiz-date">
                        {t("quizMenu.created")}:{" "}
                        {formatDate(assignment.dueDate)}
                      </div>
                      <button className="task-quiz-details-btn">
                        {t("studentAssignments.viewDetails")}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="task-footer-spacer"></div>
          </div>
        </PageTransition>
      </IonContent>
    </IonPage>
  );
};

export default StudentAssignments;
