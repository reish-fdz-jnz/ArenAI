import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonMenuButton,
  useIonToast,
  IonButton,
  IonModal,
} from "@ionic/react";
import {
  menu,
  playCircleOutline,
  schoolOutline,
  peopleOutline,
  bookOutline,
  flaskOutline,
  globeOutline,
  languageOutline,
  createOutline,
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ProfessorMenu from "../components/ProfessorMenu";
import PageTransition from "../components/PageTransition";
import { useProfessorFilters } from "../hooks/useProfessorFilters";
import { ClassTemplate } from "../types/classSession";
import { getApiUrl } from "../config/api";
import "./StartClassSession.css";

const StartClassSession: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [present] = useIonToast();
  const { 
    selectedGrade, 
    selectedSection, 
    selectedSubject, 
    setSelectedGrade, 
    setSelectedSection, 
    setSelectedSubject 
  } = useProfessorFilters();

  const [templates, setTemplates] = useState<ClassTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ClassTemplate | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [sessionName, setSessionName] = useState("");

  const formatSectionLabel = () => `${selectedGrade}-${selectedSection} ${selectedSubject}`;

  // Fetch active session
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const sectionId = parseInt(selectedSection);
        if (!sectionId) return;

        const response = await fetch(getApiUrl(`api/class-templates/active?sectionId=${sectionId}`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const active = await response.json();
          setActiveSession(active);
          if (active) {
            setSessionName(active.name_session);
          }
        } else {
          setActiveSession(null);
        }
      } catch (err) {
        console.error("Error checking active session:", err);
      }
    };
    checkActiveSession();
  }, [selectedSection, selectedGrade, selectedSubject]);

  useEffect(() => {
    if (activeSession) return; // Don't override existing session name

    if (selectedTemplate) {
      setSessionName(`${selectedTemplate.Name}: ${formatSectionLabel()}`);
    } else {
      setSessionName(`Clase Nueva: ${formatSectionLabel()}`);
    }
  }, [selectedTemplate, selectedGrade, selectedSection, selectedSubject, activeSession]);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(getApiUrl(`api/class-templates`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const allTemplates = await response.json();
          const targetSubjectId = selectedSubject === 'Math' ? 1 
                                : selectedSubject === 'Science' ? 2 
                                : selectedSubject === 'Social Studies' ? 3 
                                : 4;

          const filtered = allTemplates.filter((temp: any) => 
            parseInt(temp.grade) === selectedGrade && temp.id_subject === targetSubjectId
          ).map((t: any) => ({
            ClassTemplateID: String(t.id_class_template),
            Name: t.name_template || "Untitled",
            Grade: parseInt(t.grade),
            Description: t.description || "",
            Topics: t.topic_names 
              ? t.topic_names.split(',').map((name: string) => ({ name }))
              : [],
            Settings: t.settings ? (typeof t.settings === 'string' ? JSON.parse(t.settings) : t.settings) : { aiDifficulty: 50 },
            subjectId: t.id_subject
          }));
          
          setTemplates(filtered);
        }
      } catch (err) {
        console.error("Error loading templates:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTemplates();
  }, [selectedGrade, selectedSubject]);

  const handleStartSession = async () => {
    if (!selectedTemplate) {
      present({
        message: t("professor.liveClass.selectTemplateFirst"),
        duration: 2000,
        color: "warning"
      });
      return;
    }

    setIsLaunching(true);

    try {
      const token = localStorage.getItem('authToken');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      const payload = {
        name_session: sessionName,
        templateId: parseInt(selectedTemplate.ClassTemplateID),
        sectionId: parseInt(selectedSection),
        institutionId: user?.id_institution || null
      };

      const response = await fetch(getApiUrl(`api/class-templates/start-session`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Failed to start session");

      const session = await response.json();

      present({
        message: t("professor.liveClass.startingClass", { name: selectedTemplate.Name, section: selectedSection }),
        duration: 3000,
        color: "success"
      });

      // Redirect to the active teaching interface
      history.push(`/prof-attendance`);
      
    } catch (err) {
      present({
        message: "Error starting session.",
        duration: 2000,
        color: "danger"
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    setIsLaunching(true);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(getApiUrl(`api/class-templates/end/${activeSession.id_class}`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Failed to end session");

      present({
        message: "Clase finalizada correctamente",
        duration: 2000,
        color: "success"
      });

      setActiveSession(null);
      setSelectedTemplate(null);
    } catch (err) {
      present({
        message: "Error al finalizar la clase.",
        duration: 2000,
        color: "danger"
      });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <IonPage className="start-session-page">
      <IonHeader className="professor-header-container">
        <IonToolbar color="primary" className="professor-toolbar">
          <div className="ph-content">
            <IonMenuButton className="ph-menu-btn">
              <IonIcon icon={menu} />
            </IonMenuButton>
          </div>
        </IonToolbar>

        <div className="ph-brand-container-absolute">
          <div className="ph-brand-name">ArenAI</div>
          <div className="ph-brand-sub">{t("professor.liveClass.initSession", "Initialize Session")}</div>
        </div>

        <div className="ph-notch-container">
          <div className="ph-notch">
            <div className="ph-dropdowns-display">
              <div className="ph-text-oval">
                <ProfessorMenu
                  selectedGrade={String(selectedGrade)}
                  selectedSection={selectedSection}
                  selectedSubject={t("professor.dashboard.subjects." + selectedSubject.replace(/\s+/g, ""))}
                  onGradeChange={(grade) => setSelectedGrade(parseInt(grade, 10))}
                  onSectionChange={setSelectedSection}
                  onSubjectChange={setSelectedSubject}
                />
              </div>
            </div>
          </div>
        </div>
      </IonHeader>

      <IonContent className="start-session-content">
        <IonModal
          isOpen={isLaunching}
          className="class-loading-modal"
          backdropDismiss={false}
        >
          <div className="class-loading-inner">
            <div className="class-loading-spinner">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
            </div>
            <h3 className="class-loading-title">Iniciando Sesión...</h3>
            <p className="class-loading-text">Estamos preparando el entorno de aprendizaje en vivo.</p>
          </div>
        </IonModal>

        <PageTransition variant="fade">
          <div className="ss-container">
            
            {/* Page Header with Editable Title */}
            <div className="ss-page-header">
              <div className="ss-editable-container">
                <input
                  type="text"
                  className="ss-editable-title"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Nombre de la sesión..."
                />
                <IonIcon icon={createOutline} className="ss-edit-indicator" />
              </div>
              
              <div className="floral-separator">
                <div className="floral-line"></div>
                <div className="floral-center">❧</div>
                <div className="floral-line"></div>
              </div>
            </div>

            {/* Target Card */}
            <div className="ss-card section-card-mini">
              <div className="ss-card-title">{t("professor.liveClass.targetTitle", "Focus Section")}</div>
              <div className="ss-section-display-mini">
                <div className="ss-section-icon-box-mini">
                  <IonIcon icon={peopleOutline} />
                </div>
                <div className="ss-section-text-mini">
                  <h2>{formatSectionLabel()}</h2>
                </div>
                <div className="ss-live-badge-mini">READY</div>
              </div>
            </div>

            {/* Overview Card */}
            {selectedTemplate && (
              <div className="ss-card overview-card animate-in">
                <div className="ss-card-title">{t("professor.liveClass.overview", "Session Strategy")}</div>
                <div className="ss-template-details">
                  <p className="ss-template-desc">
                    {selectedTemplate.Description || t("common.noDescription", "No description provided.")}
                  </p>
                  <div className="ss-strategy-chips">
                    {selectedTemplate.Topics.slice(0, 3).map((t, idx) => (
                      <span key={idx} className="strategy-chip topic">{t.name}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="ss-card mini-library-card">
              <div className="ss-card-title">{t("professor.liveClass.chooseTemplate", "Template Library")}</div>
              <div className="mini-library-grid">
                {templates.length === 0 ? (
                  <div className="ss-empty-box">
                    <IonIcon icon={schoolOutline} style={{ fontSize: '32px', marginBottom: '8px' }} />
                    <p>{t("professor.liveClass.noTemplates", "No templates found.")}</p>
                    <IonButton 
                      fill="clear" 
                      onClick={() => history.push('/create-class')}
                      size="small"
                    >
                      {t("professor.liveClass.createNew", "Create New Template")}
                    </IonButton>
                  </div>
                ) : (
                  templates.map((temp) => (
                    <div 
                      key={temp.ClassTemplateID} 
                      className={`mini-card ${selectedTemplate?.ClassTemplateID === temp.ClassTemplateID ? 'selected' : ''}`}
                      onClick={() => setSelectedTemplate(temp)}
                    >
                      <div className="mini-card-name">{temp.Name}</div>
                      <div className="mini-card-topics">
                        {temp.Topics.slice(0, 2).map(t => t.name).join(', ')}
                      </div>
                      <div className="mini-card-meta">Grade {temp.Grade}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="ss-footer-spacer"></div>
          </div>
        </PageTransition>
      </IonContent>

      <div className="ss-footer">
        {activeSession ? (
          <button 
            className="ss-start-btn end-session-btn" 
            onClick={handleEndSession}
          >
            <IonIcon icon={playCircleOutline} />
            Finalizar Clase
          </button>
        ) : (
          <button 
            className="ss-start-btn" 
            onClick={handleStartSession}
            disabled={!selectedTemplate}
          >
            <IonIcon icon={playCircleOutline} />
            {t("professor.liveClass.launchClass", "Launch Class")}
          </button>
        )}
      </div>
    </IonPage>
  );
};

export default StartClassSession;
