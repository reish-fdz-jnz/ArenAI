import React, { useState, useEffect, useMemo } from "react";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonMenuButton,
  IonButton,
  IonModal,
  IonSearchbar,
  useIonToast,
  IonTextarea,
} from "@ionic/react";
import {
  menu,
  addCircleOutline,
  closeOutline,
  createOutline,
  schoolOutline,
  saveOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import "./CreateClassSession.css";
import "../components/StudentHeader.css";
import PageTransition from "../components/PageTransition";
import { useProfessorFilters } from "../hooks/useProfessorFilters";
import { getApiUrl } from "../config/api";
import { ClassTemplate } from "../types/classSession";

const SUBJECT_MAP: { [key: string]: number } = {
  "Math": 1,
  "Science": 2,
  "Social Studies": 3,
  "Spanish": 4
};

const SUBJECTS = ["Math", "Science", "Social Studies", "Spanish"];

const CreateClassSession: React.FC = () => {
  const { t } = useTranslation();
  const [present] = useIonToast();
  const history = useHistory();

  const { selectedGrade: filterGrade, selectedSubject: filterSubject, setSelectedGrade, setSelectedSubject } =
    useProfessorFilters();

  const [selectedSubject, setStateSelectedSubject] = useState(filterSubject || "Math");
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [availableTopics, setAvailableTopics] = useState<{ id_topic: number; name: string }[]>([]);
  const [description, setDescription] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Modals state
  const [showNameModal, setShowNameModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  
  const [tempName, setTempName] = useState("");
  const [searchText, setSearchText] = useState("");
  const [gradeLevel, setGradeLevel] = useState(filterGrade || 5);

  const [addedTopics, setAddedTopics] = useState<{ id_topic: number; name: string }[]>([]);
  const [modalSelectedTopics, setModalSelectedTopics] = useState<number[]>([]);

  // Sync with Professor Filters & Fetch Topics
  useEffect(() => {
    if (filterSubject && SUBJECTS.includes(filterSubject)) {
      setStateSelectedSubject(filterSubject);
    }
    if (filterGrade) {
      setGradeLevel(filterGrade);
    }
  }, [filterSubject, filterGrade]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const subjectId = SUBJECT_MAP[selectedSubject];
        const token = localStorage.getItem('authToken');
        const response = await fetch(getApiUrl(`api/subjects/${subjectId}/topics`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableTopics(data);
        }
      } catch (err) {
        console.error("Error fetching topics:", err);
      }
    };
    fetchTopics();
  }, [selectedSubject]);

  const defaultTopics = useMemo(() => 
    availableTopics.slice(0, 4),
    [availableTopics]
  );

  const displayedTopics = useMemo(() => {
    const result = [...defaultTopics];
    addedTopics.forEach(topic => {
      if (!result.find(t => t.id_topic === topic.id_topic)) {
        result.push(topic);
      }
    });
    return result;
  }, [defaultTopics, addedTopics]);

  const searchResults = useMemo(() => {
    if (!searchText.trim()) return availableTopics;
    const query = searchText.toLowerCase();
    return availableTopics.filter(t => t.name.toLowerCase().includes(query));
  }, [searchText, availableTopics]);

  const filteredTopics = displayedTopics;

  const toggleTopic = (id: number) => {
    setSelectedTopics(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleModalTopic = (id: number) => {
    setModalSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleAddTopicsFromModal = () => {
    const newTopics = availableTopics.filter(t => modalSelectedTopics.includes(t.id_topic));
    setAddedTopics(prev => {
      const existingIds = prev.map(t => t.id_topic);
      const toAdd = newTopics.filter(t => !existingIds.includes(t.id_topic));
      return [...prev, ...toAdd];
    });
    setSelectedTopics(prev => [...new Set([...prev, ...modalSelectedTopics])]);
    setModalSelectedTopics([]);
    setSearchText("");
    setShowTopicModal(false);
  };

  const handleCreateTemplate = async () => {
    if (!templateName || selectedTopics.length === 0) {
      present({
        message: "Please enter a name and select at least one topic.",
        duration: 2000,
        color: "warning"
      });
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('authToken');
      const subjectId = SUBJECT_MAP[selectedSubject];

      const payload = {
        subjectId,
        name: templateName,
        grade: String(gradeLevel),
        description: description,
        settings: { aiDifficulty: 50, language: "Spanish" },
        topicIds: selectedTopics
      };

      const response = await fetch(getApiUrl(`api/class-templates`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to save template");

      present({
        message: "Template created successfully!",
        duration: 2000,
        color: "success"
      });

      history.push('/class-library');
    } catch (err) {
      present({
        message: "Error saving template.",
        duration: 2000,
        color: "danger"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IonPage className="create-class-page">
       <IonModal
        isOpen={isLoading}
        className="class-loading-modal"
        backdropDismiss={false}
      >
        <div className="class-loading-inner">
          <div className="class-loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <h3 className="class-loading-title">Guardando Template...</h3>
          <p className="class-loading-text">Estamos guardando tu configuración en la librería.</p>
        </div>
      </IonModal>

      {/* Header */}
      <IonHeader className="student-header-container">
        <IonToolbar className="student-toolbar">
          <div className="sh-content">
            <IonMenuButton className="sh-menu-btn">
              <IonIcon icon={menu} />
            </IonMenuButton>
          </div>
        </IonToolbar>

        <div className="sh-brand-container-absolute">
          <div className="sh-brand-name">ArenAI</div>
          <div className="sh-brand-sub">Class Template Maker</div>
        </div>

        <div className="sh-notch-container">
          <div className="sh-notch">
            <div 
              className="sh-subject-display" 
              onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
            >
              <span className="sh-subject-text">{selectedSubject}</span>
            </div>
          </div>
        </div>

        {showSubjectDropdown && (
          <div className="template-subject-dropdown">
            {SUBJECTS.map(subj => (
              <div 
                key={subj} 
                className="template-subject-option"
                onClick={() => {
                  setStateSelectedSubject(subj);
                  setSelectedSubject(subj);
                  setSelectedTopics([]);
                  setShowSubjectDropdown(false);
                }}
              >
                {subj}
              </div>
            ))}
          </div>
        )}
      </IonHeader>

      <IonContent className="create-class-content" fullscreen>
        <PageTransition variant="fade">
          <div className="template-container">
            {/* Template Name Header */}
            <div className="template-name-section">
              <div className="template-name-display" onClick={() => { setTempName(templateName); setShowNameModal(true); }}>
                <span>{templateName || "Nombre del Template"}</span>
                <IonIcon icon={createOutline} />
              </div>
              <div className="floral-separator">
                <div className="floral-line"></div>
                <div className="floral-center">❧</div>
                <div className="floral-line"></div>
              </div>
            </div>

            {/* Grade Selector Card */}
            <div className="template-card">
              <div className="template-card-title">Grado Escolar</div>
              <div className="grade-selector-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(g => (
                  <div 
                    key={g} 
                    className={`grade-item ${gradeLevel === g ? 'selected' : ''}`}
                    onClick={() => { setGradeLevel(g); setSelectedGrade(g); }}
                  >
                    {g}º
                  </div>
                ))}
              </div>
            </div>

            {/* Topics Card */}
            <div className="template-card">
              <div className="template-card-title">Temas a Cubrir</div>
              <div className="template-topics-grid">
                {displayedTopics.map(topic => (
                  <div 
                    key={topic.id_topic} 
                    className={`template-topic-item ${selectedTopics.includes(topic.id_topic) ? 'selected' : ''}`}
                    onClick={() => toggleTopic(topic.id_topic)}
                  >
                    <div className="template-topic-check">
                      {selectedTopics.includes(topic.id_topic) && <div className="check-inner" />}
                    </div>
                    <span>{topic.name}</span>
                  </div>
                ))}
              </div>
              
              <div className="template-add-more-container">
                <div className="template-add-more-btn" onClick={() => { setModalSelectedTopics([]); setShowTopicModal(true); }}>
                  <IonIcon icon={addCircleOutline} />
                  <span>{t("quizGenerator.addMore") || "Agregar más temas"}</span>
                </div>
              </div>
            </div>

            {/* Description Card */}
            <div className="template-card">
              <div className="template-card-title">Resumen / Objetivo</div>
              <IonTextarea 
                placeholder="Escribe una breve descripción del objetivo de esta clase para que sirva como referencia o guía para la sesión..."
                className="template-textarea"
                rows={4}
                value={description}
                onIonInput={(e) => setDescription(e.detail.value!)}
              />
            </div>

            <div className="template-footer-spacer" />
          </div>
        </PageTransition>
      </IonContent>

      <div className="template-action-footer">
        <button className="template-save-btn" onClick={handleCreateTemplate}>
          <IonIcon icon={saveOutline} />
          Guardar Template
        </button>
      </div>

      {/* Beautiful Name Modal */}
      <IonModal
        isOpen={showNameModal}
        onDidDismiss={() => setShowNameModal(false)}
        className="quiz-name-modal"
      >
        <div className="quiz-modal-inner">
          <h2 className="quiz-modal-title">Nombre del Template</h2>
          <div className="quiz-input-wrapper">
            <input
              type="text"
              className="quiz-modal-input-field"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="Ej. Repaso de Ecuaciones"
            />
          </div>
          <div className="quiz-modal-buttons">
            <button className="quiz-modal-btn cancel" onClick={() => setShowNameModal(false)}>
              Cancelar
            </button>
            <button className="quiz-modal-btn save" onClick={() => { setTemplateName(tempName); setShowNameModal(false); }}>
              Guardar
            </button>
          </div>
        </div>
      </IonModal>

      <IonModal
        isOpen={showTopicModal}
        onDidDismiss={() => setShowTopicModal(false)}
        className="quiz-topic-modal-premium"
      >
        <div className="quiz-modal-inner topic-modal-wide">
          <div className="quiz-modal-header-premium">
            <h2 className="quiz-modal-title" style={{ margin: 0 }}>{t("quizGenerator.searchTopics") || "Buscar Temas"}</h2>
            <IonIcon 
              icon={closeOutline} 
              className="modal-close-icon-premium"
              onClick={() => setShowTopicModal(false)} 
            />
          </div>

          <div className="quiz-input-wrapper" style={{ marginBottom: '15px' }}>
            <IonSearchbar 
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value!)}
              placeholder="Busca un tema..."
              debounce={200}
              className="premium-searchbar"
            />
          </div>

          <div className="quiz-modal-content-premium">
            <div className="quiz-modal-grid">
              {searchResults.map(t => (
                <div 
                  key={t.id_topic} 
                  className={`quiz-topic-item ${modalSelectedTopics.includes(t.id_topic) ? 'selected' : ''}`}
                  onClick={() => toggleModalTopic(t.id_topic)}
                >
                  <div className="quiz-topic-checkbox">
                    {modalSelectedTopics.includes(t.id_topic) && <div className="quiz-topic-checkmark" />}
                  </div>
                  <div className="quiz-topic-info">
                    <span className="quiz-topic-name">{t.name}</span>
                    <span className="quiz-topic-subject">{selectedSubject}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="quiz-modal-buttons">
            <button 
              className="quiz-modal-btn save"
              onClick={handleAddTopicsFromModal}
              disabled={modalSelectedTopics.length === 0}
            >
              Agregar {modalSelectedTopics.length > 0 ? `(${modalSelectedTopics.length})` : ""} Temas
            </button>
          </div>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default CreateClassSession;
