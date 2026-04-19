import React, { useState } from 'react';
import {
    IonContent,
    IonPage,
    IonIcon,
    IonAccordion,
    IonAccordionGroup,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonButton,
    IonToast
} from '@ionic/react';
import { helpCircle, mail, chevronDown, search, book, checkmarkCircle, send } from 'ionicons/icons';
import StudentHeader from '../components/StudentHeader';
import PageTransition from '../components/PageTransition';
import './Help.css'; // Reuse common help styles

const ProfessorHelp: React.FC = () => {
    const [searchText, setSearchText] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [contactForm, setContactForm] = useState({ subject: '', message: '' });

    const faqs = [
        {
            question: "¿Cómo creo una nueva sección o grupo?",
            answer: "Dirígete a 'Crear Sección' en el menú lateral. Allí podrás definir el nombre del grupo, la materia y obtener el código de acceso para tus estudiantes."
        },
        {
            question: "¿Cómo funciona el generador de quizzes con IA?",
            answer: "En 'Generador de Quiz', ingresa el tema y nivel educativo. Nuestra IA generará preguntas automáticas que podrás editar, guardar y asignar a tus grupos en segundos."
        },
        {
            question: "¿Cómo puedo ver el progreso de mis alumnos?",
            answer: "Usa la sección 'Estadísticas por Tema' o 'Mis Estudiantes'. Podrás ver gráficas de rendimiento individual y grupal, así como identificar temas que necesitan refuerzo."
        },
        {
            question: "¿Cómo inicio una sesión en vivo?",
            answer: "Primero planea tu sesión en 'Planear Sesión'. Una vez guardada, aparecerá en tu panel principal. Haz clic en 'Iniciar' para generar el QR de acceso para tus alumnos."
        },
        {
            question: "¿Cómo asigno tareas a mis grupos?",
            answer: "Ve a 'Nueva Tarea', selecciona los cuestionarios que deseas incluir y elige las secciones o alumnos específicos. Define una fecha límite y haz clic en guardar."
        }
    ];

    const filteredFaqs = faqs.filter(faq =>
        faq.question.toLowerCase().includes(searchText.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchText.toLowerCase())
    );

    const handleContactSubmit = () => {
        console.log("Professor contact form submitted:", contactForm);
        setContactForm({ subject: '', message: '' });
        setShowToast(true);
    };

    return (
        <IonPage className="help-page-container">
            <StudentHeader pageTitle="sidebar.help" showNotch={false} />

            <IonContent fullscreen className="help-page-content">
                <PageTransition variant="fade">
                    <div className="help-hero">
                        <IonIcon icon={helpCircle} className="help-hero-icon" />
                        <h1>Panel de Ayuda para Profesores</h1>
                        <div className="search-bar-container">
                            <IonIcon icon={search} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Buscar tutoriales o preguntas..."
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="help-section">
                        <div className="section-header">
                            <IonIcon icon={book} />
                            <h2>Guía del Educador</h2>
                        </div>

                        <IonAccordionGroup className="faq-accordion">
                            {filteredFaqs.map((faq, index) => (
                                <IonAccordion value={index.toString()} key={index}>
                                    <IonItem slot="header" lines="none" className="faq-header-item">
                                        <IonLabel className="faq-question">{faq.question}</IonLabel>
                                        <IonIcon icon={chevronDown} slot="end" className="faq-arrow" />
                                    </IonItem>
                                    <div className="ion-padding" slot="content">
                                        <p className="faq-answer">{faq.answer}</p>
                                    </div>
                                </IonAccordion>
                            ))}
                            {filteredFaqs.length === 0 && (
                                <div className="no-results">
                                    No encontramos resultados para "{searchText}".
                                </div>
                            )}
                        </IonAccordionGroup>
                    </div>

                    <div className="help-section contact-section">
                        <div className="section-header">
                            <IonIcon icon={mail} />
                            <h2>Soporte Técnico Especializado</h2>
                        </div>
                        <p className="contact-desc">¿Necesitas ayuda con la gestión de tus grupos? Contáctanos.</p>

                        <div className="contact-form">
                            <IonItem className="input-item" lines="none">
                                <IonLabel position="stacked">Asunto de Gestión</IonLabel>
                                <IonInput
                                    value={contactForm.subject}
                                    placeholder="Ej. Error al subir calificaciones"
                                    onIonChange={e => setContactForm({ ...contactForm, subject: e.detail.value! })}
                                />
                            </IonItem>
                            <IonItem className="input-item" lines="none">
                                <IonLabel position="stacked">Detalle del Requerimiento</IonLabel>
                                <IonTextarea
                                    rows={4}
                                    value={contactForm.message}
                                    placeholder="Explícanos cómo podemos apoyarte con tu clase..."
                                    onIonChange={e => setContactForm({ ...contactForm, message: e.detail.value! })}
                                />
                            </IonItem>

                            <IonButton expand="block" color="primary" className="btn-send-help" onClick={handleContactSubmit}>
                                Enviar a Soporte Académico <IonIcon slot="end" icon={send} />
                            </IonButton>
                        </div>
                    </div>
                </PageTransition>

                <IonToast
                    isOpen={showToast}
                    onDidDismiss={() => setShowToast(false)}
                    message="Solicitud enviada. Un asesor académico te contactará pronto."
                    duration={3000}
                    position="bottom"
                    color="success"
                    icon={checkmarkCircle}
                />
            </IonContent>
        </IonPage>
    );
};

export default ProfessorHelp;
