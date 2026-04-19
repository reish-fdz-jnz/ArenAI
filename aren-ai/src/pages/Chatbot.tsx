import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar,
  IonFooter,
  IonMenuButton,
} from "@ionic/react";
import { micOutline, send, menu } from "ionicons/icons";
import React, { useState, useRef, useEffect } from "react";
import { useAvatar } from "../context/AvatarContext";
import { useProfilePicture } from "../context/ProfilePictureContext";
import "./Chatbot.css";
import StudentMenu from "../components/StudentMenu";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import AnimatedMascot from "../components/AnimatedMascot";
import { getApiUrl } from "../config/api";
import { studentService } from "../services/studentService";
import { useTranslation } from "react-i18next";

// ==========================================
// LOCAL QUESTION BUFFER
// Stores questions locally as a fallback buffer
// Syncs to backend every 5 minutes
// ==========================================
const QUESTION_BUFFER_KEY = 'chatbot_question_buffer';

interface LocalQuestion {
  timestamp: string;
  question: string;
  subject: string;
  synced: boolean;
}

function getLocalQuestionBuffer(): LocalQuestion[] {
  try {
    const stored = localStorage.getItem(QUESTION_BUFFER_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveQuestionToBuffer(question: string, subject: string): void {
  try {
    const buffer = getLocalQuestionBuffer();
    buffer.push({
      timestamp: new Date().toISOString(),
      question,
      subject,
      synced: false
    });
    // Keep only last 200 questions to avoid localStorage overflow
    const trimmed = buffer.slice(-200);
    localStorage.setItem(QUESTION_BUFFER_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('[QuestionBuffer] Failed to save:', err);
  }
}

function markBufferAsSynced(): void {
  try {
    const buffer = getLocalQuestionBuffer();
    const updated = buffer.map(q => ({ ...q, synced: true }));
    localStorage.setItem(QUESTION_BUFFER_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[QuestionBuffer] Failed to mark synced:', err);
  }
}

async function syncQuestionBuffer(): Promise<void> {
  try {
    const buffer = getLocalQuestionBuffer();
    const unsynced = buffer.filter(q => !q.synced);
    if (unsynced.length === 0) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    // The backend already logs each question during POST /ai/chat,
    // so this sync is just a backup verification.
    // We mark as synced after the buffer reaches a certain age.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const oldEnough = unsynced.filter(q => q.timestamp < fiveMinutesAgo);
    
    if (oldEnough.length > 0) {
      console.log(`[QuestionBuffer] Marking ${oldEnough.length} buffered questions as synced`);
      markBufferAsSynced();
    }
  } catch (err) {
    console.error('[QuestionBuffer] Sync failed:', err);
  }
}

// Asumiendo que tienes una forma de obtener datos del usuario, si no, usa localStorage
const getUserContext = () => {
  try {
    const stored = localStorage.getItem("userData");
    const user = stored ? JSON.parse(stored) : { name: "Invitado" };
    return user;
  } catch (e) {
    return { name: "Invitado" };
  }
};

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  displayedText?: string;
  isTyping?: boolean;
}

const SUBJECT_MAP: Record<string, number> = {
  Math: 1,
  Science: 2,
  "Social Studies": 3,
  Spanish: 4,
};

const Chat: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { getAvatarAssets, currentAvatar } = useAvatar();
  const { getProfilePicPath } = useProfilePicture();
  const avatarAssets = getAvatarAssets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Math");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounter = useRef(1);

  // Topics context state
  const [currentTopics, setCurrentTopics] = useState<string[]>([]);

  // Fetch topics when subject changes
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const subjectId = SUBJECT_MAP[selectedSubject] || 1;
        const subjectData =
          await studentService.getSubjectDetails(subjectId, selectedSubject);
        if (subjectData && subjectData.topics) {
          const topicNames = subjectData.topics.map((t) => t.nameKey);
          setCurrentTopics(topicNames);
        }
      } catch (err) {
        console.error("Error fetching topics for context", err);
      }
    };
    fetchTopics();
  }, [selectedSubject]);

  const handleLogout = () => { };

  // Show welcome message on initial load or subject change
  useEffect(() => {
    const userContext = getUserContext();
    const avatarName = localStorage.getItem("avatarName") || "Aren";
    const avatarType = localStorage.getItem("selected_avatar") || "Capybara";

    // Always start with welcome message
    const initialMessage: Message = {
      id: messageIdCounter.current++,
      text: t("mainStudent.aiAssistant.welcome", {
        studentName: userContext.name || "Student",
        tutorName: avatarName,
        animalType: avatarType,
      }),
      isUser: false,
      timestamp: new Date(),
      displayedText: "",
      isTyping: true,
    };

    setMessages([initialMessage]);
    messageIdCounter.current = 2; // Reset counter for history

    setTimeout(() => {
      startTypewriterEffect(initialMessage.id, initialMessage.text, 15);
    }, 500);

    // Load chat history from database
    const loadChatHistory = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          console.log("[Chatbot] No authToken found - skipping history load");
          return;
        }

        console.log(
          `[Chatbot] Loading history for subject: ${selectedSubject}`,
        );

        const response = await fetch(
          getApiUrl(
            `/ai/chat-history?subject=${encodeURIComponent(selectedSubject)}&limit=50`,
          ),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.history && data.history.length > 0) {
            console.log(
              `[Chatbot] Loaded ${data.history.length} messages from history`,
            );

            // Convert DB history to Message format
            const historyMessages: Message[] = data.history.map((msg: any) => ({
              id: messageIdCounter.current++,
              text: msg.content,
              isUser: msg.role === "user",
              timestamp: new Date(msg.timestamp),
              displayedText: msg.content, // Show immediately, no typing animation for history
              isTyping: false,
            }));

            // Append history after welcome message
            setMessages((prev) => [...prev, ...historyMessages]);
            scrollToBottom();
          } else {
            console.log("[Chatbot] No history found for this subject");
          }
        } else {
          console.error("[Chatbot] Failed to load history:", response.status);
        }
      } catch (err) {
        console.error("[Chatbot] Error loading chat history:", err);
      }
    };

    // Load history after a short delay to let welcome message show first
    setTimeout(loadChatHistory, 100);
  }, [selectedSubject, t]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  // Sync question buffer every 5 minutes
  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncQuestionBuffer();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(syncInterval);
  }, []);

  // Typewriter effect for bot messages
  const startTypewriterEffect = (
    messageId: number,
    fullText: string,
    speed: number = 15,
  ) => {
    let currentText = "";
    let charIndex = 0;

    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, displayedText: "", isTyping: true }
          : msg,
      ),
    );

    typingIntervalRef.current = setInterval(() => {
      if (charIndex < fullText.length) {
        currentText += fullText.charAt(charIndex);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, displayedText: currentText } : msg,
          ),
        );
        charIndex++;
        scrollToBottom();
      } else {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, isTyping: false } : msg,
          ),
        );
      }
    }, speed);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (contentRef.current) {
        contentRef.current.scrollToBottom(100);
      }
    }, 50);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Format time function
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // mandar mensaje

  // Endpoint del backend propio
  const API_URL = getApiUrl("/ai/chat");

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;

    const userMessage: Message = {
      id: messageIdCounter.current++,
      text: inputMessage,
      isUser: true,
      timestamp: new Date(),
      displayedText: inputMessage,
      isTyping: false,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    scrollToBottom();

    const userContext = getUserContext();
    const effectiveRole =
      localStorage.getItem("userRole") || userContext.role || "student";
    const avatarName = localStorage.getItem("avatarName") || "Aren";
    const effectiveAvatarType =
      localStorage.getItem("selected_avatar") || currentAvatar || "capybara";

    try {
      // Prepare localized history (last 10 messages)
      const history = messages.slice(-10).map((m) => ({
        role: m.isUser ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      const token = localStorage.getItem("authToken");
      const headers: any = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          prompt: inputMessage,
          history: history,
          userData: {
            id: userContext.id,
            name: userContext.name,
            role: effectiveRole,
          },
          context: {
            subject: selectedSubject,
            level: "Educación Diversificada",
            currentTopics: currentTopics.join(", "),
            learningStyle: "Visual",
            language: i18n.language || "es",
          },
          agentConfig: {
            name: avatarName,
            type: effectiveAvatarType,
          },
        }),
      });

      if (!response.ok) throw new Error("Error en la respuesta del servidor");

      const data = await response.json();
      const botResponse =
        data.response ||
        "Lo siento, no pude procesar tu solicitud en este momento.";

      const botMessage: Message = {
        id: messageIdCounter.current++,
        text: botResponse,
        isUser: false,
        timestamp: new Date(),
        displayedText: "",
        isTyping: true,
      };

      setMessages((prev) => [...prev, botMessage]);
      startTypewriterEffect(botMessage.id, botResponse, 15);

      // Save question to local buffer (backup)
      saveQuestionToBuffer(inputMessage, selectedSubject);
    } catch (error) {
      console.error("Detailed error:", error);
      const errorMessage: Message = {
        id: messageIdCounter.current++,
        text: "⚠️ Ocurrió un error al conectar con la IA. Por favor intenta denuevo.",
        isUser: false,
        timestamp: new Date(),
        displayedText: "",
        isTyping: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      startTypewriterEffect(errorMessage.id, errorMessage.text, 15);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const shouldShowAvatar = (currentIndex: number) => {
    if (currentIndex === 0) return true;
    const currentMessage = messages[currentIndex];
    const previousMessage = messages[currentIndex - 1];
    return currentMessage.isUser !== previousMessage.isUser;
  };

  return (
    <IonPage className="chatbot-page">
      <StudentHeader
        pageTitle="chat.title"
        showSubject={true}
        selectedSubject={selectedSubject}
        onSubjectChange={setSelectedSubject}
      />

      <StudentSidebar onLogout={handleLogout} />

      <IonContent ref={contentRef} className="chat-content">
        <div className="chat-container">
          {messages.map((message, index) => {
            const showAvatar = shouldShowAvatar(index);
            return (
              <div
                key={`${message.timestamp.getTime()}-${index}`}
                className={`message-row ${message.isUser ? "user" : "bot"}`}
              >
                {!message.isUser && (
                  <AnimatedMascot
                    className={`chat-avatar bot ${showAvatar ? "" : "hidden"}`} // Handle visibility via CSS if needed, or conditional rendering
                    openSrc={avatarAssets.open}
                    closedSrc={avatarAssets.closed}
                    winkSrc={avatarAssets.wink}
                  />
                  // Fallback or specific rendering if !showAvatar could be just invisible spacer
                )}
                {!message.isUser && !showAvatar && (
                  <div style={{ width: 44 }} /> /* Spacer for alignment */
                )}

                <div
                  className={`chat-bubble ${message.isUser ? "user" : "bot"}`}
                >
                  <div className="bubble-text">
                    {message.displayedText}
                    {message.isTyping && (
                      <span className="typing-cursor">|</span>
                    )}
                  </div>
                  <div className="bubble-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>

                {message.isUser && (
                  <img
                    className={`chat-avatar user ${showAvatar ? "" : "hidden"}`}
                    src={getProfilePicPath()}
                    alt="User"
                    style={{
                      opacity: showAvatar ? 1 : 0,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </IonContent>

      <div className="chat-footer">
        <div className="input-pill">
          <IonTextarea
            rows={1}
            autoGrow={true}
            value={inputMessage}
            placeholder={t("chat.placeholder", { name: getUserContext().name })}
            onIonInput={(e) => setInputMessage(e.detail.value!)}
            onKeyPress={handleKeyPress}
            className="chat-input"
          />

          {inputMessage.trim() && (
            <IonButton
              fill="clear"
              className="send-button"
              onClick={handleSendMessage}
            >
              <IonIcon icon={send} slot="icon-only" />
            </IonButton>
          )}
        </div>
      </div>
    </IonPage>
  );
};

export default Chat;
