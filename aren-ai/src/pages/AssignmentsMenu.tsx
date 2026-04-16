import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonMenuButton,
  useIonViewWillEnter,
  useIonToast,
  useIonAlert,
} from "@ionic/react";
import {
  menu,
  filterOutline,
  calendarOutline,
  statsChartOutline,
  createOutline,
  trashOutline,
  searchOutline,
  eyeOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ProfessorMenu from "../components/ProfessorMenu";
import PageTransition from "../components/PageTransition";
import { getApiUrl } from "../config/api";
import "./AssignmentsMenu.css";
import "../components/ProfessorHeader.css";
import { useProfessorFilters } from "../hooks/useProfessorFilters";

// Assignment interface
interface Assignment {
  id: string;
  name: string;
  instructions: string;
  dueDate: string;
  totalPoints: number;
  topics: string[];
  hasTextSubmission: boolean;
  studentsTotal: number;
  studentsCompleted: number;
  isOngoing: boolean;
  pendingReviews: number;
  colorStyle: number;
  averageScore: number;
}

const AssignmentsMenu: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();

  // Header state
  const {
    selectedGrade,
    setSelectedGrade,
    selectedSection,
    setSelectedSection,
    selectedSubject,
    setSelectedSubject,
  } = useProfessorFilters();

  // Assignment lists - start empty, fetch from DB
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs / Segment state (nuevo diseño)
  const [activeTab, setActiveTab] = useState<"ongoing" | "previous">("ongoing");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch assignments from database
  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const token =
          localStorage.getItem("authToken") || localStorage.getItem("token");
        const userStr =
          localStorage.getItem("userData") || localStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : null;

        if (token && user?.id) {
          const response = await fetch(
            getApiUrl(`/api/assignments/professor/${user.id}`),
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const now = new Date();
            const transformed: Assignment[] = (data.assignments || []).map(
              (a: any, index: number) => {
                const dueDate = a.due_time ? new Date(a.due_time) : new Date();
                const isOngoing = dueDate >= now;

                return {
                  id: String(a.id_assignment),
                  name: a.title || `Assignment ${a.id_assignment}`,
                  instructions: a.description || a.instructions || "",
                  dueDate: a.due_time || new Date().toISOString(),
                  totalPoints: a.total_points || 100,
                  topics: a.subject_name ? [a.subject_name] : [],
                  hasTextSubmission: false,
                  studentsTotal:
                    Number(a.section_students_total) ||
                    Number(a.students_total) ||
                    0,
                  studentsCompleted: Number(a.students_completed) || 0,
                  isOngoing,
                  pendingReviews: 0,
                  colorStyle: (index % 5) + 1,
                  // Ejemplo falso para promedio dinámico:
                  averageScore: Math.floor(Math.random() * 40) + 60, // 60 a 100
                };
              }
            );
            setAssignments(transformed);
          }
        }
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, []);

  // Auto-reload when page becomes visible
  useIonViewWillEnter(() => {
    const reloadAssignments = async () => {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");
      const userStr =
        localStorage.getItem("userData") || localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      if (token && user?.id) {
        try {
          const response = await fetch(
            getApiUrl(`/api/assignments/professor/${user.id}`),
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const now = new Date();
            const transformed: Assignment[] = (data.assignments || []).map(
              (a: any, index: number) => {
                const dueDate = a.due_time ? new Date(a.due_time) : new Date();
                const isOngoing = dueDate >= now;

                return {
                  id: String(a.id_assignment),
                  name: a.title || `Assignment ${a.id_assignment}`,
                  instructions: a.description || a.instructions || "",
                  dueDate: a.due_time || new Date().toISOString(),
                  totalPoints: a.total_points || 100,
                  topics: a.subject_name ? [a.subject_name] : [],
                  hasTextSubmission: false,
                  studentsTotal:
                    Number(a.section_students_total) ||
                    Number(a.students_total) ||
                    0,
                  studentsCompleted: Number(a.students_completed) || 0,
                  isOngoing,
                  pendingReviews: 0,
                  colorStyle: (index % 5) + 1,
                  averageScore: Math.floor(Math.random() * 40) + 60,
                };
              }
            );
            setAssignments(transformed);
          }
        } catch (error) {
          console.error("Error reloading assignments:", error);
        }
      }
    };
    reloadAssignments();
  });

  // Split and filter based on Active Tab
  const activeAssignments = assignments.filter((a) =>
    activeTab === "ongoing" ? a.isOngoing : !a.isOngoing
  );

  const filteredAssignments = activeAssignments.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.topics.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isOverdue = date < now;
    return {
      text: date.toLocaleDateString("en-US", { weekday: "short" }),
      full: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      isOverdue,
    };
  };

  // Navigate to assignment results
  const goToDetail = (assignment: Assignment) => {
    sessionStorage.setItem("selectedAssignment", JSON.stringify(assignment));
    history.push(`/page/assignment-results`);
  };

  // Navigate to edit assignment
  const goToEdit = (assignment: Assignment) => {
    history.push(`/page/edit-assignment/${assignment.id}`);
  };

  // Navigate to review assignment
  const goToReview = (assignment: Assignment) => {
    sessionStorage.setItem("selectedAssignment", JSON.stringify(assignment));
    history.push(`/page/assignment-review/${assignment.id}`);
  };

  // Delete assignment
  const confirmDelete = (e: React.MouseEvent, assignmentId: string) => {
    e.stopPropagation();
    presentAlert({
      header: "Delete Assignment",
      message: "Are you sure you want to delete this assignment? This cannot be undone.",
      buttons: [
        "Cancel",
        {
          text: "Delete",
          role: "destructive",
          handler: () => handleDeleteAssignment(assignmentId),
        },
      ],
    });
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(getApiUrl(`/api/assignments/${assignmentId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setAssignments(assignments.filter((a) => a.id !== assignmentId));
        present({
          message: "Assignment deleted successfully",
          duration: 2000,
          color: "success",
        });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting assignment:", error);
      present({
        message: "Failed to delete assignment",
        duration: 2000,
        color: "danger",
      });
    }
  };

  // Badge Color Helper
  const getScoreBadgeClass = (score: number) => {
    if (score >= 90) return "score-badge-high";
    if (score >= 70) return "score-badge-medium";
    return "score-badge-low";
  };

  // Render assignment card V3 (Premium Redesign)
  const renderAssignmentCard = (assignment: Assignment) => {
    const dateInfo = formatDate(assignment.dueDate);
    const progressPercent =
      assignment.studentsTotal > 0
        ? (assignment.studentsCompleted / assignment.studentsTotal) * 100
        : 0;

    return (
      <div
        key={assignment.id}
        className="assignment-card-v3"
        onClick={() => goToDetail(assignment)}
      >
        {/* Review notification badge */}
        {assignment.pendingReviews > 0 && (
          <div className="am-review-badge">
            <span className="am-ping"></span>
            {assignment.pendingReviews}
          </div>
        )}

        {/* Card Header Premium */}
        <div className={`am-header-v3 ${assignment.isOngoing ? `gradient-${assignment.colorStyle}` : 'gradient-theme'}`}>
          <div className="am-title-row">
            <h3 className="am-card-title">{assignment.name}</h3>
          </div>

          <div className="am-tags-row">
            {assignment.topics.slice(0, 2).map((topic, i) => (
              <span key={i} className="am-topic-tag">
                {topic}
              </span>
            ))}
            <div className="am-students-pill">
              <IonIcon icon={statsChartOutline} style={{ marginRight: "4px" }} />
              {assignment.studentsTotal}
            </div>
          </div>
        </div>

        {/* Card Body Premium */}
        <div className="am-body-v3">
          {/* Main Info Left Column */}
          <div className="am-info-col">
            <div
              className={`am-due-date ${dateInfo.isOverdue && assignment.isOngoing ? "am-overdue" : ""
                }`}
            >
              <IonIcon icon={calendarOutline} />
              <span>Due {dateInfo.full}</span>
            </div>

            <div className="am-progress-section">
              <div className="am-progress-labels">
                <span className="am-prog-title">Completion</span>
                <span className="am-prog-numbers">
                  {assignment.studentsCompleted} / {assignment.studentsTotal}
                </span>
              </div>
              <div className="am-progress-track">
                <div
                  className="am-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            <div className="am-avg-section">
              <span className="am-avg-title">Avg Score</span>
              <div className={`am-score-badge ${getScoreBadgeClass(assignment.averageScore)}`}>
                {assignment.averageScore}%
              </div>
            </div>
          </div>

          {/* Action Buttons Right Column */}
          <div className="am-actions-col">
            <button
              className="am-action-btn am-review-btn"
              onClick={(e) => {
                e.stopPropagation();
                goToReview(assignment);
              }}
              title="Review Assignment"
            >
              <IonIcon icon={eyeOutline} />
            </button>
            <button
              className="am-action-btn am-edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                goToEdit(assignment);
              }}
              title="Edit Assignment"
            >
              <IonIcon icon={createOutline} />
            </button>
            <button
              className="am-action-btn am-delete-btn"
              onClick={(e) => confirmDelete(e, assignment.id)}
              title="Delete Assignment"
            >
              <IonIcon icon={trashOutline} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Stats for the header
  const totalAssignments = activeAssignments.length;
  const assignmentsNeedingReview = activeAssignments.filter(a => a.pendingReviews > 0).length;

  return (
    <IonPage className="am-dashboard-page">
      {/* Professor Header */}
      <IonHeader className="professor-header-container">
        <IonToolbar color="primary" className="professor-toolbar">
          <div className="ph-content">
            <IonMenuButton className="ph-menu-btn">
              <IonIcon icon={menu} />
            </IonMenuButton>
          </div>
        </IonToolbar>

        {/* Brand / Title */}
        <div className="ph-brand-container-absolute">
          <div className="ph-brand-name">ArenAI</div>
          <div className="ph-brand-sub">Assignments</div>
        </div>

        {/* Notch with dropdowns */}
        <div className="ph-notch-container">
          <div className="ph-notch">
            <div className="ph-dropdowns-display">
              <div className="ph-text-oval">
                <ProfessorMenu
                  selectedGrade={String(selectedGrade)}
                  selectedSection={selectedSection}
                  selectedSubject={t(
                    "professor.dashboard.subjects." +
                    selectedSubject.replace(/\s+/g, "")
                  )}
                  onGradeChange={(grade) =>
                    setSelectedGrade(parseInt(grade, 10))
                  }
                  onSectionChange={setSelectedSection}
                  onSubjectChange={setSelectedSubject}
                />
              </div>
            </div>
          </div>
        </div>
      </IonHeader>

      <IonContent className="am-dashboard-content">
        <PageTransition>
          <div className="am-container">

            {/* Top Dashboard Toggles */}
            <div className="am-top-controls">
              <div className="am-segment-wrapper">
                <button
                  className={`am-segment-btn ${activeTab === 'ongoing' ? 'active' : ''}`}
                  onClick={() => setActiveTab("ongoing")}
                >
                  Ongoing ({assignments.filter(a => a.isOngoing).length})
                </button>
                <button
                  className={`am-segment-btn ${activeTab === 'previous' ? 'active' : ''}`}
                  onClick={() => setActiveTab("previous")}
                >
                  Previous ({assignments.filter(a => !a.isOngoing).length})
                </button>
              </div>
            </div>

            {/* Quick Stats & Search */}
            <div className="am-tools-row">
              <div className="am-quick-stats">
                <div className="am-stat-pill">
                  <span className="am-stat-val">{totalAssignments}</span>
                  <span className="am-stat-lbl">Total</span>
                </div>
                {assignmentsNeedingReview > 0 && (
                  <div className="am-stat-pill warning">
                    <span className="am-stat-val">{assignmentsNeedingReview}</span>
                    <span className="am-stat-lbl">Needs grading</span>
                  </div>
                )}
              </div>

              <div className="am-search-glass">
                <IonIcon icon={searchOutline} className="am-search-icon" />
                <input
                  type="text"
                  className="am-search-input"
                  placeholder={`Search ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="am-filter-btn">
                  <IonIcon icon={filterOutline} />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
              <div className="am-empty-state">
                <div className="am-loader-ping"></div>
                <p>Loading your materials...</p>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="am-empty-state">
                <div className="am-empty-icon-wrapper">
                  <IonIcon icon={calendarOutline} className="am-empty-icon" />
                </div>
                <h2>No {activeTab} assignments found</h2>
                <p>You don't have any matching assignments for this section right now. Take a coffee break!</p>
              </div>
            ) : (
              <div className="am-cards-grid">
                {filteredAssignments.map(renderAssignmentCard)}
              </div>
            )}

            <div className="am-bottom-spacer"></div>
          </div>
        </PageTransition>
      </IonContent>
    </IonPage>
  );
};

export default AssignmentsMenu;
