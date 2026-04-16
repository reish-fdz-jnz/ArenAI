import React, { useState, useEffect } from "react";
import {
  IonContent,
  IonPage,
  IonSearchbar,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonAvatar,
  IonLabel,
  IonModal,
  IonInput,
} from "@ionic/react";
import {
  personAddOutline,
  closeOutline,
  checkmarkOutline,
  searchOutline,
  notificationsOutline,
  checkmarkCircle,
  closeCircle,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import StudentHeader from "../components/StudentHeader";
import "./ChatMenu.css";
import { getApiUrl } from "../config/api";
import { useTranslation } from "react-i18next";
import { useIonViewWillEnter, useIonViewWillLeave } from "@ionic/react";
import { socketService } from "../services/socket";
import { chatStorage } from "../services/chatStorage";
import { getProfilePicturePath } from "../context/ProfilePictureContext";

const ChatMenu: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [isAddFriendMode, setIsAddFriendMode] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // New State for Features
  const filterOptions = [
    "chatMenu.allChats",
    "chatMenu.friends",
    "chatMenu.groups",
  ];
  const [activeFilter, setActiveFilter] = useState("chatMenu.allChats");
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [chats, setChats] = useState<any[]>([]);
  const processedMessagesRef = React.useRef<Set<string>>(new Set()); // Track processed messages

  // === UNREAD COUNT MANAGEMENT (localStorage-based) ===
  const getUnreadCount = (chatId: string | number): number => {
    try {
      const stored = localStorage.getItem("chat_unread_counts");
      const counts = stored ? JSON.parse(stored) : {};
      return counts[String(chatId)] || 0;
    } catch {
      return 0;
    }
  };

  const setUnreadCount = (chatId: string | number, count: number) => {
    try {
      const stored = localStorage.getItem("chat_unread_counts");
      const counts = stored ? JSON.parse(stored) : {};
      counts[String(chatId)] = Math.max(0, count);
      localStorage.setItem("chat_unread_counts", JSON.stringify(counts));
    } catch (e) {
      console.error("Failed to save unread count:", e);
    }
  };

  const incrementUnread = (chatId: string | number) => {
    const current = getUnreadCount(chatId);
    setUnreadCount(chatId, current + 1);
  };

  const clearUnread = (chatId: string | number) => {
    setUnreadCount(chatId, 0);
  };
  // === END UNREAD MANAGEMENT ===

  // Helper to format date safely
  const formatTime = (dateInput: any) => {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString();
  };

  // Fetch Chats from Backend & Merge with Local History
  const fetchChats = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const userDataStr = localStorage.getItem("userData");

      if (!userDataStr) return;

      const user = JSON.parse(userDataStr);
      const userId = user.id || user.id_user;

      if (!userId) {
        console.error("User ID not found in local storage");
        return;
      }

      const res = await fetch(getApiUrl(`/api/chats/user/${userId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        let backendChats = await res.json();

        // --- Merge with Local Storage History AND Preserve Unread ---
        setChats((currentChats) => {
          const currentMap = new Map(currentChats.map((c) => [c.id, c]));

          const enrichedChats = backendChats.map((chat: any) => {
            // Get last message from chatStorage for accurate preview
            const lastMsg = chatStorage.getLastMessage(chat.id);

            let message = chat.message;
            let timestamp = chat.time;

            if (lastMsg) {
              message = lastMsg.text;
              timestamp = lastMsg.timestamp;
            }

            // Use backend unread count (DB source of truth) - this is updated when viewing chat
            const unreadCount = chat.unread || 0;

            return {
              ...chat,
              message: message,
              rawTime: timestamp ? new Date(timestamp) : new Date(0),
              time: formatTime(timestamp),
              unread: unreadCount,
            };
          });

          enrichedChats.sort(
            (a: any, b: any) => b.rawTime.getTime() - a.rawTime.getTime(),
          );

          return enrichedChats;
        });
      }
    } catch (err) {
      console.error("Failed to fetch chats", err);
    }
  };

  // --- Live Sync & Refresh on Focus ---
  // --- Live Sync & Refresh on Focus ---
  useIonViewWillEnter(() => {
    fetchChats();
    fetchRequests();

    // Refresh Nicknames
    const stored = localStorage.getItem("friendNicknames");
    if (stored) {
      try {
        setLocalNicknames(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse nicknames", e);
      }
    }

    // Connect Socket for Live Updates
    socketService.connect();
    const socket = socketService.socket;

    // NOTE: Message receiving is now handled globally in App.tsx
    // ChatMenu just reads from chatStorage and updates UI
    // Poll every 1 second to update unread counts from chatStorage
    const pollInterval = setInterval(() => {
      setChats((prevChats) =>
        prevChats.map((chat) => ({
          ...chat,
          unread: chatStorage.getUnreadCount(chat.id),
          message: chatStorage.getLastMessage(chat.id)?.text || chat.message,
          time: chatStorage.getLastMessage(chat.id)?.timestamp
            ? formatTime(chatStorage.getLastMessage(chat.id)!.timestamp)
            : chat.time,
        })),
      );
    }, 1000);

    return () => {
      clearInterval(pollInterval);
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      fetchRequests(); // Keep requests polling
    }, 10000);

    // Start periodic sync of chat messages to database (every 10 minutes)
    chatStorage.startPeriodicSync();

    return () => {
      clearInterval(interval);
      // Note: We don't stop periodic sync here because we want it to continue
      // even when navigating away from ChatMenu
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;
      const res = await fetch(getApiUrl("/api/friends/requests"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFriendRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch requests", err);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 3) return;
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(getApiUrl(`/api/friends/search?query=${query}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Search failed", err);
    }
  };

  const sendRequest = async (targetId: number) => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(getApiUrl("/api/friends/request"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: targetId }),
      });
      if (res.ok) {
        alert("Request sent!");
        setSearchResults((prev) => prev.filter((u) => u.id_user !== targetId));
      } else {
        const err = await res.json();
        alert(err.message || "Failed to send request");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const respondToRequest = async (
    reqId: number,
    action: "accept" | "reject",
  ) => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(getApiUrl("/api/friends/respond"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId: reqId, action }),
      });
      if (res.ok) {
        setFriendRequests((prev) => prev.filter((r) => r.id_request !== reqId));
        if (action === "accept") {
          // Check if we need to refresh chat list
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMode = () => {
    setIsAddFriendMode(!isAddFriendMode);
    setSearchText("");
    setSearchResults([]);
  };

  const handleSearchChange = (e: CustomEvent) => {
    const val = e.detail.value!;
    setSearchText(val);
    if (isAddFriendMode && val.length >= 3) {
      searchUsers(val);
    }
  };

  // UI Handlers
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
  };

  // Nickname State
  const [localNicknames, setLocalNicknames] = useState<Record<number, string>>(
    {},
  );

  // Initial load
  useEffect(() => {
    const stored = localStorage.getItem("friendNicknames");
    if (stored) {
      try {
        setLocalNicknames(JSON.parse(stored));
      } catch (e) {}
    }
  }, []);

  const saveNickname = (userId: number, nick: string) => {
    const updated = { ...localNicknames, [userId]: nick };
    setLocalNicknames(updated);
    localStorage.setItem("friendNicknames", JSON.stringify(updated));
  };

  const UI_getUserName = (user: any) => {
    // If we have a local nickname for this user ID, use it.
    // User might have id_user or id_sender depending on object type
    const id = user.id_user || user.id_sender || user.id;
    return localNicknames[id] || user.name || user.sender_name;
  };

  const handleAcceptClick = (req: any) => {
    setSelectedRequest(req);
    setNicknameInput(req.sender_name || "Friend");
    setShowNicknameModal(true);
  };

  const confirmAcceptFriend = async () => {
    if (!selectedRequest) return;
    try {
      await respondToRequest(selectedRequest.id_request, "accept");

      // Save nickname locally
      if (nicknameInput && nicknameInput !== selectedRequest.sender_name) {
        saveNickname(selectedRequest.id_sender, nicknameInput);
      }

      setShowNicknameModal(false);
      setNicknameInput("");
      setSelectedRequest(null);

      // Refresh chats to show the new friend
      fetchChats();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <IonPage className="chat-menu-page">
      <StudentHeader
        pageTitle="sidebar.chat"
        showSubject={true}
        selectedSubject={activeFilter}
        onSubjectChange={handleFilterChange}
        menuOptions={filterOptions}
      />

      <IonContent fullscreen className="chat-menu-content">
        <div className="chat-action-bar">
          <div className="search-container">
            <IonSearchbar
              value={searchText}
              onIonInput={handleSearchChange}
              placeholder={
                isAddFriendMode ? t("chatMenu.addFriend") : t("chatMenu.search")
              }
              className={`custom-searchbar ${
                isAddFriendMode ? "add-mode" : ""
              }`}
              showClearButton="focus"
              animated
            />
          </div>

          <IonButton
            className={`action-toggle-btn ${isAddFriendMode ? "active" : ""}`}
            onClick={handleToggleMode}
            shape="round"
          >
            <IonIcon icon={isAddFriendMode ? closeOutline : personAddOutline} />
          </IonButton>

          {!isAddFriendMode && (
            <div className="notification-btn-wrapper">
              <IonButton
                onClick={() => setShowNotifications(!showNotifications)}
                className={`notification-btn ${
                  showNotifications ? "active" : ""
                }`}
                shape="round"
              >
                <IonIcon icon={notificationsOutline} />
              </IonButton>
              {friendRequests.length > 0 && (
                <span className="notif-badge">{friendRequests.length}</span>
              )}
            </div>
          )}
        </div>

        {/* Glassmorphism Notification Popup */}
        {showNotifications && (
          <div className="glass-popup notification-popup">
            <div className="popup-header">
              <h3>{t("chatMenu.friendRequests")}</h3>
              <IonButton
                fill="clear"
                size="small"
                onClick={() => setShowNotifications(false)}
              >
                <IonIcon icon={closeCircle} />
              </IonButton>
            </div>
            <div className="popup-content">
              {friendRequests.length === 0 ? (
                <p className="empty-state">{t("chatMenu.noRequests")}</p>
              ) : (
                <IonList className="glass-list">
                  {friendRequests.map((req) => (
                    <IonItem
                      key={req.id_request}
                      className="glass-item"
                      lines="none"
                    >
                      <div className="req-info">
                        <h4>{req.sender_name}</h4>
                        <p>@{req.sender_username}</p>
                      </div>
                      <div className="req-actions">
                        <IonButton
                          fill="clear"
                          color="danger"
                          onClick={() =>
                            respondToRequest(req.id_request, "reject")
                          }
                        >
                          <IonIcon icon={closeCircle} slot="icon-only" />
                        </IonButton>
                        <IonButton
                          fill="clear"
                          color="success"
                          onClick={() => handleAcceptClick(req)}
                        >
                          <IonIcon icon={checkmarkCircle} slot="icon-only" />
                        </IonButton>
                      </div>
                    </IonItem>
                  ))}
                </IonList>
              )}
            </div>
          </div>
        )}

        {isAddFriendMode && (
          <div className="add-friend-hint">
            <IonIcon icon={searchOutline} />
            <span>{t("chatMenu.hint")}</span>
            <IonButton fill="clear" size="small" disabled={!searchText}>
              <IonIcon slot="icon-only" icon={checkmarkOutline} />
            </IonButton>
          </div>
        )}

        <IonList className="chat-list" lines="full">
          {isAddFriendMode && searchText.length >= 3
            ? searchResults.map((user) => (
                <IonItem key={user.id_user} className="chat-item">
                  <IonAvatar slot="start" className="chat-avatar">
                    <img
                      src={`https://ui-avatars.com/api/?name=${user.name}`}
                      alt={user.name}
                    />
                  </IonAvatar>
                  <IonLabel>
                    <h2>{UI_getUserName(user)}</h2>
                    <p>@{user.username}</p>
                  </IonLabel>
                  <IonButton
                    slot="end"
                    fill="outline"
                    shape="round"
                    onClick={() => sendRequest(user.id_user)}
                  >
                    Add
                  </IonButton>
                </IonItem>
              ))
            : chats.map((chat) => (
                <IonItem
                  key={chat.id}
                  button
                  detail={false}
                  className="chat-item"
                  onClick={() => {
                    // Mark messages as read in storage
                    chatStorage.markAsRead(chat.id);
                    // Update UI
                    setChats((prev) =>
                      prev.map((c) =>
                        c.id === chat.id ? { ...c, unread: 0 } : c,
                      ),
                    );
                    history.push(`/student-chat/${chat.id}`);
                  }}
                >
                  <IonAvatar slot="start" className="chat-avatar">
                    <img
                      src={getProfilePicturePath(chat.avatar || "axolotl")}
                      alt={chat.name}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                  </IonAvatar>
                  <IonLabel className="chat-info">
                    <div className="chat-header">
                      {/* Use nickname if available */}
                      <h2>{UI_getUserName(chat)}</h2>
                      <span className="chat-time">{chat.time}</span>
                    </div>
                    <p className="chat-preview">{chat.message}</p>
                  </IonLabel>
                  {chat.unread > 0 && (
                    <div className="unread-badge">{chat.unread}</div>
                  )}
                </IonItem>
              ))}
        </IonList>

        <IonModal
          isOpen={showNicknameModal}
          onDidDismiss={() => setShowNicknameModal(false)}
          className="glass-modal"
        >
          <div className="glass-modal-content">
            <h2>Welcome Friend!</h2>
            <p>
              Give <strong>{selectedRequest?.sender_name}</strong> a nickname.
            </p>

            <IonInput
              value={nicknameInput}
              onIonInput={(e) => setNicknameInput(e.detail.value!)}
              placeholder="Enter nickname"
              className="glass-input"
              clearInput
            />

            <div className="modal-actions">
              <IonButton
                fill="clear"
                onClick={() => setShowNicknameModal(false)}
              >
                Cancel
              </IonButton>
              <IonButton
                expand="block"
                shape="round"
                onClick={confirmAcceptFriend}
              >
                Accept & Add
              </IonButton>
            </div>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default ChatMenu;
