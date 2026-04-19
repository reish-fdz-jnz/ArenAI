import React, { useState, useMemo } from "react";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonMenuButton,
  IonRange,
  IonTextarea,
  IonButton,
  IonModal,
  IonSearchbar,
  useIonToast,
} from "@ionic/react";
import {
  menu,
  addCircleOutline,
  closeOutline,
  createOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { getApiUrl } from "../config/api";
import "./AIQuizGenerator.css";
import "../components/StudentHeader.css";
import PageTransition from "../components/PageTransition";
import { useProfessorFilters } from "../hooks/useProfessorFilters";

// Subject Mapping
const SUBJECT_MAP: { [key: string]: number } = {
  Math: 1,
  Science: 2,
  "Social Studies": 3,
  SocialStudies: 3,
  Spanish: 4,
};

const SUBJECTS = ["Math", "Science", "Social Studies", "Spanish"];

const AIQuizGenerator: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [present] = useIonToast();
  const history = useHistory();

  // Loading state for AI generation
  const [isLoading, setIsLoading] = useState(false);

  const {
    selectedGrade: filterGrade,
    selectedSubject: filterSubject,
    selectedSection: filterSection,
  } = useProfessorFilters();

  const [selectedSubject, setSelectedSubject] = useState(
    SUBJECTS.includes(filterSubject) ? filterSubject : "Math",
  );

  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [addedTopics, setAddedTopics] = useState<
    { id: number; key: string; name: string; subject: string }[]
  >([]);
  const [availableTopics, setAvailableTopics] = useState<
    { id: number; key: string; name: string; subject: string }[]
  >([]);

  const [questionCount, setQuestionCount] = useState(5);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [modalSelectedTopics, setModalSelectedTopics] = useState<string[]>([]);

  // Quiz Name State
  const [quizName, setQuizName] = useState("");
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState("");

  // Question Count Modal
  const [showCountModal, setShowCountModal] = useState(false);
  const [tempCount, setTempCount] = useState("");

  // Grade Level State
  const [gradeLevel, setGradeLevel] = useState(filterGrade || 5);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [tempGrade, setTempGrade] = useState("");

  const [activeSession, setActiveSession] = useState<any>(null);

  // 1. Fetch ALL available topics for the selected subject from DB
  React.useEffect(() => {
    const fetchDbTopics = async () => {
      try {
        const subjectId = SUBJECT_MAP[selectedSubject];
        if (!subjectId) return;

        const token = localStorage.getItem("authToken");
        const response = await fetch(
          getApiUrl(`api/subjects/${subjectId}/topics`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const mapped = data.map((t: any) => ({
            id: t.id_topic,
            key: t.name,
            name: t.name,
            subject: selectedSubject,
          }));
          setAvailableTopics(mapped);
        }
      } catch (err) {
        console.error("Error fetching subject topics from DB:", err);
      }
    };
    fetchDbTopics();
  }, [selectedSubject]);

  // 2. Fetch Active Session Topics and Sync
  React.useEffect(() => {
    const fetchActiveSessionData = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) return;

        const params = new URLSearchParams();
        if (filterGrade) params.append("grade", String(filterGrade));
        // Use the actual selected section if available, else 1
        params.append("sectionNumber", filterSection || "1");

        const response = await fetch(
          getApiUrl(`api/class-templates/active?${params.toString()}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const result = await response.json();
          // The API returns the session object directly or null
          if (result && result.id_class) {
            const session = result;
            setActiveSession(session);

            // Add topics from the class we are on!
            if (session.topics && session.topics.length > 0) {
              const sessionTopics = session.topics.map((t: any) => ({
                id: t.id_topic,
                key: t.name,
                name: t.name,
                subject: selectedSubject,
              }));

              // Only pick topics that match current subject to avoid cross-pollination
              // unless we want to show all class topics regardless of subject
              setAddedTopics(sessionTopics);
              setSelectedTopics(sessionTopics.map((t: any) => t.key));
            }
          } else {
            // No active session in this section/grade
            setActiveSession(null);
            setSelectedTopics([]);
            setAddedTopics([]);
          }
        }
      } catch (err) {
        console.error("Error fetching active session for quiz:", err);
      }
    };

    fetchActiveSessionData();
  }, [filterGrade, filterSection, selectedSubject]);

  // Sync Subject from Filters
  React.useEffect(() => {
    if (filterSubject && SUBJECTS.includes(filterSubject)) {
      setSelectedSubject(filterSubject);
    }
  }, [filterSubject]);

  const defaultTopics = useMemo<
    { id: number; key: string; name: string; subject: string }[]
  >(() => {
    return availableTopics.slice(0, 4);
  }, [availableTopics]);

  // All displayed topics - combines defaults with topics from active session or manually added
  const displayedTopics = useMemo(() => {
    const result = [...defaultTopics];
    addedTopics.forEach((topic) => {
      if (!result.find((t) => t.key === topic.key)) {
        result.push(topic);
      }
    });
    return result;
  }, [defaultTopics, addedTopics]);

  // Search filtered topics - Restrict to selected subject
  const searchResults = useMemo(() => {
    let filtered = availableTopics;

    if (!searchText.trim()) return filtered;

    const query = searchText.toLowerCase();
    return filtered.filter((t) => t.name.toLowerCase().includes(query));
  }, [searchText, availableTopics]);

  const toggleTopic = (topicKey: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicKey)
        ? prev.filter((t) => t !== topicKey)
        : [...prev, topicKey],
    );
  };

  const toggleModalTopic = (topicKey: string) => {
    setModalSelectedTopics((prev) =>
      prev.includes(topicKey)
        ? prev.filter((t) => t !== topicKey)
        : [...prev, topicKey],
    );
  };

  const handleAddTopicsFromModal = () => {
    const newTopics = availableTopics.filter((t) =>
      modalSelectedTopics.includes(t.key),
    );
    setAddedTopics((prev) => {
      const existingKeys = prev.map((t) => t.key);
      const toAdd = newTopics.filter((t) => !existingKeys.includes(t.key));
      return [...prev, ...toAdd];
    });
    setSelectedTopics((prev) => [
      ...new Set([...prev, ...modalSelectedTopics]),
    ]);
    setModalSelectedTopics([]);
    setSearchText("");
    setShowTopicModal(false);
  };

  const handleSubjectChange = (subject: string) => {
    setSelectedSubject(subject);
    setSelectedTopics([]);
    setAddedTopics([]);
    setShowSubjectDropdown(false);
  };

  const handleGenerateQuiz = async () => {
    if (selectedTopics.length === 0) {
      present({
        message: "Please select at least one topic",
        duration: 2000,
        color: "danger",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Get language from i18n
      const language = i18n.language?.startsWith("en")
        ? "English"
        : i18n.language?.startsWith("zh")
          ? "Chinese"
          : "Spanish";

      console.log("Generating Quiz with AI...", {
        subject: selectedSubject,
        topics: selectedTopics,
        questionCount,
        gradeLevel,
        language,
        customPrompt,
      });

      const response = await fetch(getApiUrl("/ai/generate-quiz"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: selectedSubject,
          level: gradeLevel,
          topics: selectedTopics.map((key) => {
            const fullTopic = [...availableTopics, ...addedTopics].find(
              (t) => t.key === key,
            );
            return {
              id: fullTopic?.id || null,
              name: key,
            };
          }),
          questionCount,
          language,
          customPrompt: customPrompt || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate quiz");
      }

      const result = await response.json();

      if (!result.success || !result.data?.questions) {
        throw new Error("Invalid response from AI");
      }

      console.log("Quiz generated successfully:", result.data);

      // Store generated quiz data in sessionStorage for preview page
      sessionStorage.removeItem("previewQuiz"); // Clear any stale preview data
      sessionStorage.setItem(
        "generatedQuiz",
        JSON.stringify({
          quizName,
          subject: selectedSubject,
          gradeLevel,
          language,
          questions: result.data.questions,
        }),
      );

      // Navigate directly to preview page
      history.push("/page/quiz-preview");
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      present({
        message: error.message || "Failed to generate quiz. Please try again.",
        duration: 3000,
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = () => {
    setModalSelectedTopics([]);
    setSearchText("");
    setShowTopicModal(true);
  };

  // Name Modal Handlers (like ArenEntity)
  const openNameModal = () => {
    setTempName(quizName);
    setShowNameModal(true);
  };

  const saveQuizName = () => {
    if (tempName.trim()) {
      const newName = tempName.trim();
      setQuizName(newName);

      // Update session storage if it exists to keep preview in sync
      const stored = sessionStorage.getItem("generatedQuiz");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.quizName = newName;
          parsed.subject = selectedSubject; // Keep subject in sync too
          parsed.gradeLevel = gradeLevel; // Keep grade in sync too
          sessionStorage.setItem("generatedQuiz", JSON.stringify(parsed));
        } catch (e) {
          // ignore
        }
      }
    }
    setShowNameModal(false);
  };

  // Question count modal handlers
  const openCountModal = () => {
    setTempCount(String(questionCount));
    setShowCountModal(true);
  };

  const saveQuestionCount = () => {
    const value = parseInt(tempCount, 10);
    if (!isNaN(value) && value >= 5 && value <= 100) {
      setQuestionCount(value);
    }
    setShowCountModal(false);
  };

  return (
    <IonPage className="ai-quiz-page">
      {/* Custom Loading Modal */}
      <IonModal
        isOpen={isLoading}
        className="quiz-loading-modal"
        backdropDismiss={false}
      >
        <div className="quiz-loading-inner">
          <div className="quiz-loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <h3 className="quiz-loading-title">
            {t("quizGenerator.generating")}
          </h3>
          <p className="quiz-loading-text">
            {t("quizGenerator.generatingDesc")}
          </p>
        </div>
      </IonModal>

      {/* Header */}
      <IonHeader className="student-header-container">
        <IonToolbar className="student-toolbar">
          <div className="sh-content">
            <div className="sh-menu-btn-container">
              <IonMenuButton className="sh-menu-btn">
                <IonIcon icon={menu} />
              </IonMenuButton>
            </div>
          </div>
        </IonToolbar>

        <div className="sh-brand-container-absolute">
          <div className="sh-brand-name">ArenAI</div>
          <div className="sh-brand-sub">{t("quizGenerator.title")}</div>
        </div>

        <div className="sh-notch-container">
          <div className="sh-notch">
            <div
              className="sh-subject-display interactive"
              onClick={(e) => {
                e.stopPropagation();
                setShowSubjectDropdown(!showSubjectDropdown);
              }}
              style={{ pointerEvents: "auto", cursor: "pointer" }}
            >
              <span className="sh-subject-text">
                {t(
                  `professor.dashboard.subjects.${selectedSubject.replace(
                    /\s+/g,
                    "",
                  )}`,
                ) || selectedSubject}
              </span>
            </div>
          </div>
        </div>

        {showSubjectDropdown && (
          <div className="quiz-subject-dropdown">
            {SUBJECTS.map((subj) => (
              <div
                key={subj}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubjectChange(subj);
                }}
                className={`quiz-subject-option ${
                  selectedSubject === subj ? "selected" : ""
                }`}
              >
                {t(
                  `professor.dashboard.subjects.${subj.replace(/\s+/g, "")}`,
                ) || subj}
              </div>
            ))}
          </div>
        )}
      </IonHeader>

      <IonContent
        className="ai-quiz-content"
        fullscreen
        onClick={() => showSubjectDropdown && setShowSubjectDropdown(false)}
      >
        <PageTransition variant="fade">
          <div className="quiz-container">
            {/* Quiz Name with Floral Separator */}
            <div className="quiz-name-section">
              <div className="quiz-name-display" onClick={openNameModal}>
                <span className={!quizName ? "placeholder-text" : ""}>
                  {quizName || t("quizGenerator.enterQuizName")}
                </span>
                <IonIcon icon={createOutline} className="quiz-name-edit-icon" />
              </div>
              <div className="floral-separator">
                <div className="floral-line"></div>
                <div className="floral-center">❧</div>
                <div className="floral-line"></div>
              </div>
            </div>

            {/* Quiz Topics Card */}
            <div className="quiz-card">
              <div className="quiz-card-title">
                {t("quizGenerator.quizTopics")}
              </div>

              <div className="quiz-topics-grid">
                {displayedTopics.map((topic) => (
                  <div
                    key={topic.key}
                    className={`quiz-topic-item ${
                      selectedTopics.includes(topic.key) ? "selected" : ""
                    }`}
                    onClick={() => toggleTopic(topic.key)}
                  >
                    <div className="quiz-topic-checkbox">
                      {selectedTopics.includes(topic.key) && (
                        <div className="quiz-topic-checkmark"></div>
                      )}
                    </div>
                    <span className="quiz-topic-name">{topic.name}</span>
                  </div>
                ))}
              </div>

              {/* Add More Button - Half in / Half out */}
              <div className="quiz-add-more-container">
                <div className="quiz-add-more-btn" onClick={openModal}>
                  <IonIcon icon={addCircleOutline} />
                  <span>{t("quizGenerator.addMore")}</span>
                </div>
              </div>
            </div>

            {/* Advanced Settings Card */}
            <div className="quiz-card">
              <div className="quiz-card-title">
                {t("quizGenerator.advancedSettings")}
              </div>

              {/* Questions Row - Click to open modal */}
              <div className="quiz-questions-row" onClick={openCountModal}>
                <div className="quiz-question-circle">
                  <span className="quiz-question-number">{questionCount}</span>
                </div>
                <span className="quiz-questions-label">
                  {t("quizGenerator.questions")}
                </span>
              </div>

              {/* Slider - max 30, show 30+ if count > 30 */}
              <div className="quiz-slider-container">
                <div className="quiz-slider-row">
                  <span className="quiz-slider-label">5</span>
                  <IonRange
                    min={5}
                    max={30}
                    step={1}
                    value={Math.min(questionCount, 30)}
                    onIonChange={(e) => {
                      const val = e.detail.value as number;
                      if (val <= 30) setQuestionCount(val);
                    }}
                    color="secondary"
                    style={{ flex: 1 }}
                  />
                  <span className="quiz-slider-label">
                    {questionCount > 30 ? "30+" : "30"}
                  </span>
                </div>
              </div>

              {/* Grade Level Row - Click to open modal */}
              <div
                className="quiz-questions-row"
                onClick={() => {
                  setTempGrade(String(gradeLevel));
                  setShowGradeModal(true);
                }}
              >
                <div className="quiz-question-circle">
                  <span className="quiz-question-number">{gradeLevel}</span>
                </div>
                <span className="quiz-questions-label">
                  {t("quizGenerator.gradeLevel")}
                </span>
              </div>

              {/* Additional Details */}
              <div className="quiz-details-section">
                <span className="quiz-details-label">
                  {t("quizGenerator.additionalDetails")}
                </span>
                <IonTextarea
                  className="quiz-details-textarea"
                  rows={3}
                  value={customPrompt}
                  onIonInput={(e) => setCustomPrompt(e.detail.value!)}
                  placeholder="Add specific instructions for the AI..."
                />
              </div>
            </div>

            {/* Spacer so content doesn't get hidden by footer */}
            <div className="quiz-footer-spacer"></div>
          </div>
        </PageTransition>
      </IonContent>

      {/* Footer - Like Professor Header (Inverted) */}
      <div className="quiz-footer">
        <div className="quiz-footer-notch">
          <div className="quiz-generate-btn" onClick={handleGenerateQuiz}>
            {t("quizGenerator.generate")}
          </div>
        </div>
      </div>

      {/* Quiz Name Modal - Like ArenEntity */}
      <IonModal
        isOpen={showNameModal}
        onDidDismiss={() => setShowNameModal(false)}
        className="quiz-name-modal"
      >
        <div className="quiz-modal-inner">
          <h2 className="quiz-modal-title">{t("quizGenerator.quizName")}</h2>

          <div className="quiz-input-wrapper">
            <input
              type="text"
              className="quiz-modal-input-field"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder={t("quizGenerator.enterQuizName")}
            />
          </div>

          <div className="quiz-modal-buttons">
            <button
              className="quiz-modal-btn cancel"
              onClick={() => setShowNameModal(false)}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button className="quiz-modal-btn save" onClick={saveQuizName}>
              {t("common.save") || "Save"}
            </button>
          </div>
        </div>
      </IonModal>

      {/* Question Count Modal */}
      <IonModal
        isOpen={showCountModal}
        onDidDismiss={() => setShowCountModal(false)}
        className="quiz-name-modal"
      >
        <div className="quiz-modal-inner">
          <h2 className="quiz-modal-title">
            {t("quizGenerator.numberOfQuestions")}
          </h2>

          <div className="quiz-input-wrapper">
            <input
              type="number"
              className="quiz-modal-input-field"
              value={tempCount}
              onChange={(e) => setTempCount(e.target.value)}
              placeholder="5-100"
              min={5}
              max={100}
            />
          </div>
          <p className="quiz-modal-hint">
            {t("quizGenerator.enterNumberHint")}
          </p>

          <div className="quiz-modal-buttons">
            <button
              className="quiz-modal-btn cancel"
              onClick={() => setShowCountModal(false)}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button className="quiz-modal-btn save" onClick={saveQuestionCount}>
              {t("common.save") || "Save"}
            </button>
          </div>
        </div>
      </IonModal>

      {/* Grade Level Modal */}
      <IonModal
        isOpen={showGradeModal}
        onDidDismiss={() => setShowGradeModal(false)}
        className="quiz-name-modal"
      >
        <div className="quiz-modal-inner">
          <h2 className="quiz-modal-title">{t("quizGenerator.gradeLevel")}</h2>

          <div className="quiz-input-wrapper">
            <input
              type="number"
              className="quiz-modal-input-field"
              value={tempGrade}
              onChange={(e) => setTempGrade(e.target.value)}
              placeholder="1-12"
              min={1}
              max={12}
            />
          </div>
          <p className="quiz-modal-hint">Select grade 1st to 12th</p>

          <div className="quiz-modal-buttons">
            <button
              className="quiz-modal-btn cancel"
              onClick={() => setShowGradeModal(false)}
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              className="quiz-modal-btn save"
              onClick={() => {
                const value = parseInt(tempGrade, 10);
                if (!isNaN(value) && value >= 1 && value <= 12) {
                  setGradeLevel(value);
                }
                setShowGradeModal(false);
              }}
            >
              {t("common.save") || "Save"}
            </button>
          </div>
        </div>
      </IonModal>

      {/* Add Topic Modal */}
      <IonModal
        isOpen={showTopicModal}
        onDidDismiss={() => setShowTopicModal(false)}
        className="quiz-topic-modal"
      >
        <div className="quiz-modal-header">
          <h3>Search Topics</h3>
          <IonIcon
            icon={closeOutline}
            style={{
              fontSize: "28px",
              cursor: "pointer",
              color: "var(--ion-color-primary)",
            }}
            onClick={() => setShowTopicModal(false)}
          />
        </div>

        <div className="quiz-modal-search">
          <IonSearchbar
            value={searchText}
            onIonInput={(e) => setSearchText(e.detail.value || "")}
            placeholder="Search for topics..."
            debounce={200}
            className="quiz-searchbar"
          />
        </div>

        <div className="quiz-modal-content">
          <div className="quiz-modal-grid">
            {searchResults.map((topic) => (
              <div
                key={topic.key}
                className={`quiz-topic-item ${
                  modalSelectedTopics.includes(topic.key) ? "selected" : ""
                }`}
                onClick={() => toggleModalTopic(topic.key)}
              >
                <div className="quiz-topic-checkbox">
                  {modalSelectedTopics.includes(topic.key) && (
                    <div className="quiz-topic-checkmark"></div>
                  )}
                </div>
                <div className="quiz-topic-info">
                  <span className="quiz-topic-name">{topic.name}</span>
                  <span className="quiz-topic-subject">{topic.subject}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="quiz-modal-footer">
          <IonButton
            expand="block"
            className="quiz-modal-add-btn"
            onClick={handleAddTopicsFromModal}
            disabled={modalSelectedTopics.length === 0}
          >
            Add{" "}
            {modalSelectedTopics.length > 0
              ? `(${modalSelectedTopics.length})`
              : ""}{" "}
            Topics
          </IonButton>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default AIQuizGenerator;
