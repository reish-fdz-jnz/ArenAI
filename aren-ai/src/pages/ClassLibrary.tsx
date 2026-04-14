import React, { useState, useEffect } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonSearchbar,
  IonHeader,
  IonToolbar,
  IonMenuButton,
  useIonToast,
  useIonViewWillEnter,
  useIonAlert,
} from "@ionic/react";
import {
  menu,
  filterOutline,
  trashOutline,
  addOutline,
  eyeOutline,
  addCircleOutline,
  playCircleOutline
} from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import ProfessorMenu from "../components/ProfessorMenu";
import PageTransition from "../components/PageTransition";
import { getApiUrl } from "../config/api";
import { ClassTemplate } from "../types/classSession";
import { useProfessorFilters } from "../hooks/useProfessorFilters";
import "./ClassLibrary.css";
import "../components/ProfessorHeader.css";

const ClassLibrary: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [present] = useIonToast();
  const [presentAlert] = useIonAlert();

  const {
    selectedGrade,
    setSelectedGrade,
    selectedSection,
    setSelectedSection,
    selectedSubject,
    setSelectedSubject,
  } = useProfessorFilters();

  // Class templates lists
  const [myTemplates, setMyTemplates] = useState<ClassTemplate[]>([]);
  const [popularTemplates, setPopularTemplates] = useState<ClassTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [mySearch, setMySearch] = useState("");
  const [popularSearch, setPopularSearch] = useState("");

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      if (token) {
        const response = await fetch(getApiUrl(`api/class-templates`), {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            const dbMapped: ClassTemplate[] = data.map((c: any) => ({
                ClassTemplateID: String(c.id_class_template),
                Name: c.name_template || "Untitled Template",
                Grade: isNaN(parseInt(c.grade)) ? 7 : parseInt(c.grade),
                Description: c.description || "",
                Topics: c.topic_names 
                  ? c.topic_names.split(',').map((name: string) => ({ name }))
                  : [],
                Settings: c.settings ? (typeof c.settings === 'string' ? JSON.parse(c.settings) : c.settings) : {},
                subjectId: c.id_subject
            }));
            
            setMyTemplates(dbMapped);
        }
      }
    } catch (error) {
      console.error("Error fetching class templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useIonViewWillEnter(() => {
    fetchTemplates();
  });

  const confirmDelete = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    presentAlert({
      header: "Delete Template",
      message: "Are you sure you want to delete this class template? This cannot be undone.",
      buttons: [
        "Cancel",
        {
          text: "Delete",
          role: "destructive",
          handler: () => handleDeleteTemplate(templateId),
        },
      ],
    });
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      const response = await fetch(getApiUrl(`api/class-templates/${templateId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Delete failed");

      const updated = myTemplates.filter((t) => t.ClassTemplateID !== templateId);
      setMyTemplates(updated);

      present({
        message: "Template deleted successfully",
        duration: 2000,
        color: "success",
      });
    } catch (err) {
      present({
        message: "Error deleting template",
        duration: 2000,
        color: "danger",
      });
    }
  };

  const startLiveClass = (e: React.MouseEvent, template: ClassTemplate) => {
      e.stopPropagation();
      // Redirect to the new Start Session page
      history.push(`/start-class-session`);
  };

  const goToGenerator = () => {
    history.push("/create-class");
  };

  const filteredMyTemplates = myTemplates.filter(
    (c) =>
      c.Name.toLowerCase().includes(mySearch.toLowerCase())
  );

  return (
    <IonPage className="class-menu-page">
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
          <div className="ph-brand-sub">Class Templates</div>
        </div>

        <div className="ph-notch-container">
          <div className="ph-notch">
            <div className="ph-dropdowns-display">
              <div className="ph-text-oval">
                <ProfessorMenu
                  selectedGrade={String(selectedGrade)}
                  selectedSection={selectedSection}
                  selectedSubject={t(
                    "professor.dashboard.subjects." +
                      selectedSubject.replace(/\s+/g, ""),
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

      <IonContent className="class-menu-content">
        <PageTransition>
          <div className="class-menu-container">
            <div className="class-menu-section">
              <div className="class-menu-section-header">
                <h2 className="class-menu-section-title">
                  Your Templates
                  <span className="class-menu-section-count">
                    {filteredMyTemplates.length}
                  </span>
                </h2>
              </div>

              <div className="class-menu-search-row">
                <IonSearchbar
                  className="class-menu-searchbar"
                  value={mySearch}
                  onIonInput={(e) => setMySearch(e.detail.value || "")}
                  placeholder="Search your templates..."
                />
                <button className="class-menu-filter-btn">
                  <IonIcon icon={filterOutline} />
                </button>
              </div>

              {filteredMyTemplates.length === 0 ? (
                <div className="class-menu-empty">
                  No templates found. Create one to start teaching!
                </div>
              ) : (
                <div className="class-menu-grid">
                  {filteredMyTemplates.map((temp) => (
                    <div
                      key={temp.ClassTemplateID}
                      className="class-menu-card"
                    >
                      <div className="class-menu-card-topics">
                        {temp.Topics.slice(0, 3).map((topic, i: number) => (
                          <span key={i} className="class-menu-topic-chip">
                            {topic.name}
                          </span>
                        ))}
                      </div>

                      <div className="class-menu-card-header">
                        <div>
                          <span className="class-menu-card-name">
                            {temp.Name}
                          </span>
                          <span className="class-menu-card-meta">
                             Grade {temp.Grade}
                          </span>
                        </div>
                        <button
                          className="class-menu-delete-btn"
                          onClick={(e) => confirmDelete(e, temp.ClassTemplateID)}
                        >
                          <IonIcon icon={trashOutline} />
                        </button>
                      </div>

                      <div className="class-menu-card-actions">
                        <button
                          className="class-menu-action-btn primary"
                          onClick={(e) => startLiveClass(e, temp)}
                          style={{width: '100%'}}
                        >
                          <IonIcon icon={playCircleOutline} /> Iniciar Clase en Vivo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="class-menu-footer-spacer"></div>
          </div>
        </PageTransition>
      </IonContent>

      <div className="class-menu-footer">
        <button className="class-menu-generate-btn" onClick={goToGenerator}>
          <IonIcon icon={addCircleOutline} />
          Plan New Template
        </button>
      </div>
    </IonPage>
  );
};

export default ClassLibrary;
