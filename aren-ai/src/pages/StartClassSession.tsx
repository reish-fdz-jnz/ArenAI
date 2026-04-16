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
import AnalogClock from "../components/AnalogClock";
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
  const [modalMode, setModalMode] = useState<'starting' | 'finishing'>('starting');
  const [sessionName, setSessionName] = useState("");
  const [elapsedTime, setElapsedTime] = useState("00:00");
  const [overallPerformance, setOverallPerformance] = useState(0);
  const [activeTopics, setActiveTopics] = useState<any[]>([]);

  const formatSectionLabel = () => `${selectedGrade}-${selectedSection} ${selectedSubject}`;

  // Fetch active session
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!selectedGrade || !selectedSection) return;

        // Check for ANY active session for this professor to prevent starting overlapping ones
        const response = await fetch(getApiUrl(`api/class-templates/active`), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const result = await response.json();
          const active = result?.data !== undefined ? result.data : result;
          // Set to null if active exists but is mathematically falsy or empty
          if (active && active.id_class) {
            setActiveSession(active);
            setSessionName(active.name_session);
          } else {
            setActiveSession(null);
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

  // LIVE TIMER LOGIC
  useEffect(() => {
    if (!activeSession || !activeSession.start_time) {
      setElapsedTime("00:00");
      return;
    }

    const startTime = new Date(activeSession.start_time).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = Math.max(0, now - startTime);
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      const hStr = hours > 0 ? `${hours}:` : "";
      const mStr = minutes.toString().padStart(2, '0');
      const sStr = seconds.toString().padStart(2, '0');
      
      setElapsedTime(`${hStr}${mStr}:${sStr}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // LIVE PERFORMANCE LOGIC
  useEffect(() => {
    if (!activeSession) return;

    const fetchLiveStats = async () => {
        try {
            const token = localStorage.getItem('authToken');
            // Reusing the active session topics fetch logic
            const res = await fetch(getApiUrl(`api/class-templates/active?grade=${selectedGrade}&sectionNumber=${selectedSection}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const session = data?.data !== undefined ? data.data : data;
                if (session && session.topics) {
                    setActiveTopics(session.topics.map((t: any) => ({
                        name: t.name_topic || t.name,
                        percentage: Math.floor(Math.random() * 20), // Placeholder until AI updates the DB
                        icon: "🎓"
                    })));
                    setOverallPerformance(Math.floor(Math.random() * 15)); // Placeholder
                }
            }
        } catch (e) { console.error(e); }
    };

    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [activeSession, selectedGrade, selectedSection]);

  const handleRename = async (newName: string) => {
    if (!activeSession) return;
    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(getApiUrl(`api/class-templates/rename/${activeSession.id_class}`), {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name_session: newName })
        });
        if (response.ok) {
            setActiveSession({ ...activeSession, name_session: newName });
            present({ message: "Nombre actualizado", duration: 1500, color: "success" });
        }
    } catch (e) {
        console.error("Rename failed", e);
    }
  };

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

    try {
      const token = localStorage.getItem('authToken');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      const payload = {
        name_session: sessionName,
        templateId: parseInt(selectedTemplate.ClassTemplateID),
        sectionId: parseInt(selectedSection),
        grade: selectedGrade,
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
      setActiveSession(session); // Update state immediately so button changes

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
    }
  };

  const handleEndSession = async () => {
    if (!activeSession) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(getApiUrl(`api/class-templates/end/${activeSession.id_class}`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Failed to end session");

      // Removed success toast per user request
      setActiveSession(null);
      setSelectedTemplate(null);
      setSessionName(""); // Clear custom name
      
      // Optionally refresh templates to ensure UI is clean
      // fetchTemplates(); 
    } catch (err) {
      present({
        message: "Error al finalizar la clase.",
        duration: 2000,
        color: "danger"
      });
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
        {/* Removed debug launching modal per user request */}

        <PageTransition variant="fade">
          <div className="ss-container">
            
            {activeSession ? (
              /* MODE B: LIVE CONTROL PANEL */
              <div className="ss-live-panel animate-in">
                
                {/* Header with Live Title (Editable) */}
                <div className="ss-page-header">
                  <div className="ss-editable-container">
                    <input
                      type="text"
                      className="ss-editable-title"
                      value={sessionName}
                      onChange={(e) => {
                        setSessionName(e.target.value);
                      }}
                      onBlur={() => handleRename(sessionName)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(sessionName)}
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

                {/* Objective Card (Target Section) */}
                <div className="ss-card section-card-mini">
                  <div className="ss-card-title">SECCIÓN OBJETIVO</div>
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

                {/* Summary Card with Topics */}
                <div className="ss-card overview-card no-margin-top">
                  <div className="ss-card-title">RESUMEN DE LA SESIÓN</div>
                  <div className="ss-template-details">
                    <div className="ss-strategy-chips column">
                        {activeTopics.length > 0 ? (
                            activeTopics.map((t, idx) => (
                                <div key={idx} className="ss-topic-summary-row">
                                    <span className="strategy-chip topic">{t.name}</span>
                                </div>
                            ))
                        ) : (
                            <span className="strategy-chip topic">{t('common.loading', 'Cargando temas...')}</span>
                        )}
                    </div>
                  </div>
                </div>

                {/* CLOCK & TIMER SECTION */}
                <div className="ss-clock-center-section">
                    <div className="ss-timer-display">
                        <div className="ss-timer-pill">
                            {elapsedTime}
                        </div>
                    </div>
                    
                    <div className="ss-analog-container">
                        <AnalogClock />
                    </div>
                </div>

                {/* PERFORMANCE WIDGET (Like dashboard) */}
                <div className="ss-metrics-row">
                    <div className="ss-mini-topics-area">
                        {activeTopics.slice(0, 1).map((t, idx) => (
                             <div key={idx} className="ms-topic-btn mini">
                                <div className="ms-topic-fill-box mini">
                                    <div className="ms-topic-fill" style={{ height: `${t.percentage}%`, backgroundColor: '#78B8B0' }}></div>
                                    <div className="ms-topic-icon">{t.icon}</div>
                                </div>
                                <span className="ms-topic-label">{t.name}</span>
                             </div>
                        ))}
                    </div>

                    <div className="ss-progress-wheel-area">
                        <div 
                            className="ms-progress-circle" 
                            style={{ 
                                width: '80px', height: '80px', 
                                border: `6px solid ${overallPerformance < 40 ? '#FFC107' : '#78B8B0'}`,
                                boxShadow: `inset 0 0 0 3px white`,
                                background: 'linear-gradient(135deg, var(--ion-color-secondary), var(--ion-color-primary))'
                            }}
                        >
                            {overallPerformance}%
                        </div>
                    </div>
                </div>

              </div>
            ) : (
              /* MODE A: TEMPLATE SELECTOR (Existing) */
              <>
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
              </>
            )}

            <div className="ss-footer-spacer"></div>
          </div>
        </PageTransition>

      </IonContent>

      <div className={`ss-footer ${activeSession ? 'semicircle' : ''}`}>
        {activeSession ? (
          <div className="quiz-footer-notch">
            <button 
                className="quiz-generate-btn" 
                onClick={handleEndSession}
                style={{ background: 'var(--ion-color-secondary)' }}
            >
                {t("professor.liveClass.endClass", "End Class")}
            </button>
          </div>
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
