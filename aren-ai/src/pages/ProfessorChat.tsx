import {
  IonButton,
  IonContent,
  IonPage,
  IonTextarea,
  IonIcon,
} from "@ionic/react";
import { send } from "ionicons/icons";
import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAvatar } from "../context/AvatarContext";
import StudentHeader from "../components/StudentHeader";
import "./ProfessorChat.css";

// Fallback translations
const CHAT_TRANSLATIONS: any = {
  es: {
    title: "Asistente ArenAI",
    welcome:
      "¡Hola, Profesor! Soy tu asistente de IA. ¿En qué puedo ayudarte en tu clase hoy?",
    placeholder: "Pregunta sobre planes de lección, ideas o calificaciones...",
    error: "⚠️ Ocurrió un error. Por favor intenta de nuevo.",
    serverError: "Lo siento, no pude procesar tu solicitud.",
  },
  en: {
    title: "ArenAI Assistant",
    welcome:
      "Hello, Professor! I am your AI assistant. How can I help with your class today?",
    placeholder: "Ask about lesson plans, ideas, or grading...",
    error: "⚠️ An error occurred. Please try again.",
    serverError: "Sorry, I couldn't process your request.",
  },
};

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: Date;
  displayedText?: string;
  isTyping?: boolean;
}

const ProfessorChat: React.FC = () => {
  const { getAvatarAssets } = useAvatar();
  const avatarAssets = getAvatarAssets();
  const { i18n } = useTranslation();

  const getT = (key: string) => {
    const lang = i18n.language?.startsWith("es") ? "es" : "en";
    return CHAT_TRANSLATIONS[lang][key] || CHAT_TRANSLATIONS["en"][key];
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const contentRef = useRef<HTMLIonContentElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdCounter = useRef(1);

  useEffect(() => {
    const initialMessage: Message = {
      id: messageIdCounter.current++,
      text: getT("welcome"),
      isUser: false,
      timestamp: new Date(),
      displayedText: "",
      isTyping: true,
    };

    setMessages([initialMessage]);

    setTimeout(() => {
      startTypewriterEffect(initialMessage.id, initialMessage.text, 40);
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  const startTypewriterEffect = (
    messageId: number,
    fullText: string,
    speed: number = 40
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
          : msg
      )
    );

    typingIntervalRef.current = setInterval(() => {
      if (charIndex < fullText.length) {
        currentText += fullText.charAt(charIndex);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, displayedText: currentText } : msg
          )
        );
        charIndex++;
        scrollToBottom();
      } else {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, isTyping: false } : msg
          )
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

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const API_URL = "http://localhost:3002/ai/chat";

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

    const storedRole = localStorage.getItem("userRole") || "professor";
    const storedUserDataStr = localStorage.getItem("userData");
    const storedUserData = storedUserDataStr
      ? JSON.parse(storedUserDataStr)
      : { name: "Professor" };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: inputMessage,
          userData: {
            name: storedUserData.name,
            role: storedRole,
          },
          context: {
            level: "Professor Dashboard",
            language: i18n.language,
          },
        }),
      });

      if (!response.ok) throw new Error("Server response error");

      const data = await response.json();
      const botResponse = data.response || getT("serverError");

      const botMessage: Message = {
        id: messageIdCounter.current++,
        text: botResponse,
        isUser: false,
        timestamp: new Date(),
        displayedText: "",
        isTyping: true,
      };

      setMessages((prev) => [...prev, botMessage]);
      startTypewriterEffect(botMessage.id, botResponse, 30);
    } catch (error) {
      console.error("Detailed error:", error);
      const errorMessage: Message = {
        id: messageIdCounter.current++,
        text: getT("error"),
        isUser: false,
        timestamp: new Date(),
        displayedText: "",
        isTyping: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
      startTypewriterEffect(errorMessage.id, errorMessage.text, 30);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <IonPage className="chatbot-page">
      <StudentHeader
        pageTitle={getT("title")}
        showSubject={false}
        showNotch={false}
      />

      <IonContent ref={contentRef} className="chat-content">
        <div className="chat-container">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`message-row ${msg.isUser ? "user" : "bot"}`}
            >
              {!msg.isUser && (
                <div className="chat-avatar bot">
                  <img
                    src="/assets/icon/icon.png"
                    alt="AI"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://placehold.co/60x60?text=AI";
                    }}
                  />
                </div>
              )}

              <div className={`chat-bubble ${msg.isUser ? "user" : "bot"}`}>
                <div className="bubble-text">
                  {msg.displayedText}
                  {msg.isTyping && <span className="cursor">|</span>}
                </div>
                <div className="bubble-time">{formatTime(msg.timestamp)}</div>
              </div>

              {msg.isUser && (
                <img
                  className="chat-avatar user"
                  src="https://ui-avatars.com/api/?name=Professor"
                  alt="Me"
                />
              )}
            </div>
          ))}
        </div>
      </IonContent>

      <div className="chat-footer">
        <div className="input-pill">
          <IonTextarea
            placeholder={getT("placeholder")}
            value={inputMessage}
            onIonInput={(e) => setInputMessage(e.detail.value!)}
            autoGrow={true}
            rows={1}
            className="chat-input"
            onKeyDown={handleKeyPress}
          />
          <IonButton
            fill="clear"
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
          >
            <IonIcon icon={send} slot="icon-only" />
          </IonButton>
        </div>
      </div>
    </IonPage>
  );
};

export default ProfessorChat;
