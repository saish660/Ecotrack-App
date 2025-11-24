// Community Management JavaScript
class CommunityManager {
  constructor() {
    this.currentCommunity = null;
    this.messagePollingInterval = null;
    this.initializeEventListeners();
    this.loadUserCommunities();
  }

  initializeEventListeners() {
    // Modal buttons
    document
      .getElementById("create-community-btn")
      ?.addEventListener("click", () => {
        this.showCreateCommunityModal();
      });

    document
      .getElementById("join-community-btn")
      ?.addEventListener("click", () => {
        this.showJoinCommunityModal();
      });

    document
      .getElementById("browse-communities-btn")
      ?.addEventListener("click", () => {
        this.togglePublicCommunities();
      });

    // Modal forms
    document
      .getElementById("create-community-form")
      ?.addEventListener("submit", (e) => {
        this.handleCreateCommunity(e);
      });

    document
      .getElementById("join-community-form")
      ?.addEventListener("submit", (e) => {
        this.handleJoinCommunity(e);
      });

    // Modal cancellation
    document
      .getElementById("cancel-create-community")
      ?.addEventListener("click", () => {
        this.hideModal("create-community-modal");
      });

    document
      .getElementById("cancel-join-community")
      ?.addEventListener("click", () => {
        this.hideModal("join-community-modal");
      });

    // Chat functionality
    document
      .getElementById("send-message-btn")
      ?.addEventListener("click", () => {
        this.sendMessage();
      });

    document
      .getElementById("message-input")
      ?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

    document
      .getElementById("back-to-communities")
      ?.addEventListener("click", () => {
        this.closeCommunityChat();
      });

    document
      .getElementById("leave-community-btn")
      ?.addEventListener("click", () => {
        this.leaveCommunity();
      });

    // Share join code button
    document
      .getElementById("share-join-code-btn")
      ?.addEventListener("click", () => {
        this.shareJoinCode();
      });

    // Auto-convert join code to uppercase
    document.getElementById("join-code")?.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }

  async loadUserCommunities() {
    try {
      const response = await fetch(
        `/api/communities/my-communities?t=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      const loadingElement = document.getElementById("communities-loading");
      const emptyElement = document.getElementById("communities-empty");
      const listElement = document.getElementById("my-communities-list");

      if (loadingElement) loadingElement.classList.add("hidden");

      if (data.status === "success") {
        const communities = data.data;

        if (communities.length === 0) {
          // Clear any stale items and show empty state
          if (listElement) listElement.innerHTML = "";
          emptyElement?.classList.remove("hidden");
        } else {
          emptyElement?.classList.add("hidden");
          this.renderCommunities(communities, listElement);
        }
      } else {
        this.showMessage(data.message || "Failed to load communities", "error");
      }
    } catch (error) {
      console.error("Error loading communities:", error);
      this.showMessage("Failed to load communities", "error");
      document.getElementById("communities-loading")?.classList.add("hidden");
    }
  }

  renderCommunities(communities, container) {
    if (!container) return;

    container.innerHTML = "";

    communities.forEach((community) => {
      const communityElement = document.createElement("div");
      communityElement.className = "community-item";

      const badges = [];
      if (community.is_creator) {
        badges.push('<span class="creator-badge">Creator</span>');
      }
      if (community.role) {
        badges.push(
          `<span class="meta-pill role-pill">${this.escapeHtml(
            community.role
          )}</span>`
        );
      }

      communityElement.innerHTML = `
        <div class="community-card-header">
          <div>
            <h4 class="community-name">${this.escapeHtml(community.name)}</h4>
            <p class="community-description">${this.escapeHtml(
              community.description || "No description"
            )}</p>
          </div>
          <div class="community-badges">${badges.join(" ")}</div>
        </div>
        <div class="community-meta-tags">
          <span class="meta-pill">${community.member_count} members</span>
        </div>
        <div class="community-card-footer">
          <div class="community-actions">
            <button class="btn btn-primary btn-sm" onclick="communityManager.openCommunityChat(${
              community.id
            }, '${this.escapeHtml(community.name)}', ${
        community.member_count
      })">
              Open Chat
            </button>
          </div>
        </div>
      `;

      container.appendChild(communityElement);
    });
  }

  async togglePublicCommunities() {
    const publicCard = document.getElementById("public-communities-card");
    const browseBtn = document.getElementById("browse-communities-btn");

    const browseLabel =
      browseBtn?.querySelector(".icon-circle + span") || browseBtn;

    if (publicCard.classList.contains("hidden")) {
      // Show public communities
      await this.loadPublicCommunities();
      publicCard.classList.remove("hidden");
      if (browseLabel) {
        browseLabel.textContent = "Hide";
      }
    } else {
      // Hide public communities
      publicCard.classList.add("hidden");
      if (browseLabel) {
        browseLabel.textContent = "Browse";
      }
    }
  }

  async loadPublicCommunities() {
    try {
      const response = await fetch(`/api/communities/public?t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (data.status === "success") {
        const container = document.getElementById("public-communities-list");
        this.renderPublicCommunities(data.data, container);
      } else {
        this.showMessage(
          data.message || "Failed to load public communities",
          "error"
        );
      }
    } catch (error) {
      console.error("Error loading public communities:", error);
      this.showMessage("Failed to load public communities", "error");
    }
  }

  renderPublicCommunities(communities, container) {
    if (!container) return;

    container.innerHTML = "";

    if (communities.length === 0) {
      container.innerHTML =
        '<p class="empty-state">No public communities available to join.</p>';
      return;
    }

    communities.forEach((community) => {
      const communityElement = document.createElement("div");
      communityElement.className = "community-item";
      const createdDate = community.created_at
        ? new Date(community.created_at).toLocaleDateString()
        : "Recently created";

      communityElement.innerHTML = `
        <div class="community-card-header">
          <div>
            <h4 class="community-name">${this.escapeHtml(community.name)}</h4>
            <p class="community-description">${this.escapeHtml(
              community.description || "No description"
            )}</p>
          </div>
          <div class="community-badges">
            <span class="meta-pill">Public</span>
          </div>
        </div>
        <div class="community-meta-tags">
          <span class="meta-pill">${community.member_count} members</span>
          <span class="meta-pill">Created ${createdDate}</span>
        </div>
        <div class="community-card-footer">
          <div class="community-actions">
            <button class="btn btn-primary btn-sm" onclick="communityManager.joinPublicCommunity(${
              community.id
            })">
              Join Community
            </button>
          </div>
        </div>
      `;

      container.appendChild(communityElement);
    });
  }

  async joinPublicCommunity(communityId) {
    try {
      const response = await fetch("/api/communities/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({ community_id: communityId }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showMessage(data.message, "success");
        // Refresh communities lists
        this.loadUserCommunities();
        this.loadPublicCommunities();
      } else {
        this.showMessage(data.message || "Failed to join community", "error");
      }
    } catch (error) {
      console.error("Error joining community:", error);
      this.showMessage("Failed to join community", "error");
    }
  }

  showCreateCommunityModal() {
    this.showModal("create-community-modal");
    // Clear form
    document.getElementById("create-community-form").reset();
  }

  showJoinCommunityModal() {
    this.showModal("join-community-modal");
    // Clear form
    document.getElementById("join-community-form").reset();
  }

  async handleCreateCommunity(e) {
    e.preventDefault();

    const name = document.getElementById("community-name").value.trim();
    const description = document
      .getElementById("community-description")
      .value.trim();
    const isPrivate = document.getElementById("community-private").checked;

    if (!name) {
      this.showMessage("Community name is required", "error");
      return;
    }

    try {
      const response = await fetch("/api/communities/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          name,
          description,
          is_private: isPrivate,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.hideModal("create-community-modal");
        this.showMessage(
          `Community "${data.data.name}" created successfully!`,
          "success"
        );

        if (isPrivate) {
          this.showMessage(`Join code: ${data.data.join_code}`, "info");
        }

        // Refresh communities list
        this.loadUserCommunities();
      } else {
        this.showMessage(data.message || "Failed to create community", "error");
      }
    } catch (error) {
      console.error("Error creating community:", error);
      this.showMessage("Failed to create community", "error");
    }
  }

  async handleJoinCommunity(e) {
    e.preventDefault();

    const joinCode = document
      .getElementById("join-code")
      .value.trim()
      .toUpperCase();

    if (!joinCode) {
      this.showMessage("Join code is required", "error");
      return;
    }

    try {
      const response = await fetch("/api/communities/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({ join_code: joinCode }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.hideModal("join-community-modal");
        this.showMessage(data.message, "success");
        // Refresh communities list
        this.loadUserCommunities();
      } else {
        this.showMessage(data.message || "Failed to join community", "error");
      }
    } catch (error) {
      console.error("Error joining community:", error);
      this.showMessage("Failed to join community", "error");
    }
  }

  async openCommunityChat(communityId, communityName, memberCount) {
    this.currentCommunity = {
      id: communityId,
      name: communityName,
      memberCount: memberCount,
    };

    // Get the full community data to access join code
    const memberships = document.querySelectorAll(".community-item");
    let joinCode = "";
    memberships.forEach((item) => {
      const nameElement = item.querySelector(".community-name");
      if (nameElement && nameElement.textContent === communityName) {
        const joinCodeElement = item.querySelector(".join-code-value");
        if (joinCodeElement) {
          joinCode = joinCodeElement.textContent;
        }
      }
    });

    this.currentCommunity.joinCode = joinCode;

    // Hide communities list, show chat
    document.getElementById("community-actions-card").classList.add("hidden");
    document.getElementById("my-communities-card").classList.add("hidden");
    document.getElementById("public-communities-card").classList.add("hidden");
    document.getElementById("community-chat-card").classList.remove("hidden");

    // Update chat header
    document.getElementById("chat-community-name").textContent = communityName;
    const memberCountElement = document.getElementById("chat-member-count");
    memberCountElement.innerHTML = `
            ${memberCount} members
            ${
              joinCode
                ? `
                <span class="chat-join-code">
                    | Join Code: 
                    <span class="join-code-value" title="Click to copy" onclick="communityManager.copyJoinCode('${joinCode}')">${joinCode}</span>
                </span>
            `
                : ""
            }
        `;

    // Load messages
    await this.loadCommunityMessages(communityId);

    // Start polling for new messages
    this.startMessagePolling();
  }

  async loadCommunityMessages(communityId, page = 1) {
    try {
      const response = await fetch(
        `/api/communities/${communityId}/messages?page=${page}`
      );
      const data = await response.json();

      if (data.status === "success") {
        const messagesContainer = document.getElementById("chat-messages");

        if (page === 1) {
          messagesContainer.innerHTML = "";
        }

        const orderedMessages = [...data.data.messages].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        orderedMessages.forEach((message) => {
          this.renderMessage(message, messagesContainer);
        });

        // Scroll to bottom for new messages
        if (page === 1) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      } else {
        this.showMessage(data.message || "Failed to load messages", "error");
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      this.showMessage("Failed to load messages", "error");
    }
  }

  renderMessage(message, container) {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${message.message_type}`;

    const messageTime = new Date(message.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const typeIcon = this.getMessageTypeIcon(message.message_type);

    messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${this.escapeHtml(
                  message.sender
                )}</span>
                <span class="message-type-icon">${typeIcon}</span>
                <span class="message-time">${messageTime}</span>
            </div>
            <div class="message-content">
                ${this.escapeHtml(message.content)}
            </div>
            ${
              message.is_pinned
                ? '<div class="pinned-indicator">📌 Pinned</div>'
                : ""
            }
        `;

    container.appendChild(messageElement);
  }

  getMessageTypeIcon(messageType) {
    const icons = {
      text: "💬",
      task: "📋",
      achievement: "🏆",
      announcement: "📢",
    };
    return icons[messageType] || "💬";
  }

  async sendMessage() {
    const messageInput = document.getElementById("message-input");
    const messageType = document.getElementById("message-type").value;
    const content = messageInput.value.trim();

    if (!content || !this.currentCommunity) {
      return;
    }

    try {
      const response = await fetch("/api/communities/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          community_id: this.currentCommunity.id,
          content: content,
          message_type: messageType,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        messageInput.value = "";
        // Message will appear through polling
      } else {
        this.showMessage(data.message || "Failed to send message", "error");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      this.showMessage("Failed to send message", "error");
    }
  }

  async shareJoinCode() {
    if (!this.currentCommunity || !this.currentCommunity.joinCode) {
      this.showMessage("Join code not available", "error");
      return;
    }

    const joinCode = this.currentCommunity.joinCode;
    const communityName = this.currentCommunity.name;
    const messageContent = `🔗 Join our eco-community "${communityName}"! Use code: ${joinCode}`;

    try {
      const response = await fetch("/api/communities/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          community_id: this.currentCommunity.id,
          content: messageContent,
          message_type: "announcement",
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showMessage("Join code shared successfully!", "success");
      } else {
        this.showMessage(data.message || "Failed to share join code", "error");
      }
    } catch (error) {
      console.error("Error sharing join code:", error);
      this.showMessage("Failed to share join code", "error");
    }
  }

  startMessagePolling() {
    if (this.messagePollingInterval) {
      clearInterval(this.messagePollingInterval);
    }

    this.messagePollingInterval = setInterval(() => {
      if (this.currentCommunity) {
        this.loadCommunityMessages(this.currentCommunity.id);
      }
    }, 5000); // Poll every 5 seconds
  }

  stopMessagePolling() {
    if (this.messagePollingInterval) {
      clearInterval(this.messagePollingInterval);
      this.messagePollingInterval = null;
    }
  }

  closeCommunityChat() {
    this.stopMessagePolling();
    this.currentCommunity = null;

    // Show communities list, hide chat
    document
      .getElementById("community-actions-card")
      .classList.remove("hidden");
    document.getElementById("my-communities-card").classList.remove("hidden");
    document.getElementById("community-chat-card").classList.add("hidden");
  }

  async leaveCommunity() {
    if (!this.currentCommunity) return;

    const confirmed = await this.confirmDialog(
      `Are you sure you want to leave ${this.currentCommunity.name}?`
    );
    if (!confirmed) return;

    try {
      const response = await fetch("/api/communities/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          community_id: this.currentCommunity.id,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showMessage(data.message, "success");
        this.closeCommunityChat();
        // Refresh both lists so UI reflects that user is no longer a member
        await this.loadUserCommunities();
        await this.loadPublicCommunities();
      } else {
        this.showMessage(data.message || "Failed to leave community", "error");
      }
    } catch (error) {
      console.error("Error leaving community:", error);
      this.showMessage("Failed to leave community", "error");
    }
  }

  // Confirmation dialog helper (returns Promise<boolean>)
  confirmDialog(message) {
    return new Promise((resolve) => {
      this.#ensureModalStyles();
      let box = document.getElementById("custom-confirm-box");
      let text = document.getElementById("confirm-box-text");
      let okBtn = document.getElementById("confirm-box-ok");
      let cancelBtn = document.getElementById("confirm-box-cancel");

      if (!box) {
        box = document.createElement("div");
        box.id = "custom-confirm-box";
        box.className = "custom-confirm-box";
        box.innerHTML = `
          <div class="confirm-box-content">
            <div id="confirm-box-text" class="confirm-box-text"></div>
            <div class="confirm-box-actions">
              <button id="confirm-box-cancel" class="btn btn-outline">Cancel</button>
              <button id="confirm-box-ok" class="btn btn-primary">OK</button>
            </div>
          </div>
        `;
        document.body.appendChild(box);
        text = box.querySelector("#confirm-box-text");
        okBtn = box.querySelector("#confirm-box-ok");
        cancelBtn = box.querySelector("#confirm-box-cancel");
      }

      const cleanup = () => {
        document.removeEventListener("keydown", onKeydown);
        box.classList.add("hidden");
      };

      const onKeydown = (e) => {
        if (e.key === "Escape") {
          cleanup();
          resolve(false);
        }
      };

      text.textContent = message;
      box.classList.remove("hidden");
      document.addEventListener("keydown", onKeydown);

      okBtn?.addEventListener(
        "click",
        () => {
          cleanup();
          resolve(true);
        },
        { once: true }
      );
      cancelBtn?.addEventListener(
        "click",
        () => {
          cleanup();
          resolve(false);
        },
        { once: true }
      );
    });
  }

  // Utility methods
  copyJoinCode(joinCode) {
    if (navigator.clipboard && window.isSecureContext) {
      // Use the modern clipboard API
      navigator.clipboard
        .writeText(joinCode)
        .then(() => {
          this.showMessage(
            `Join code "${joinCode}" copied to clipboard!`,
            "success"
          );
        })
        .catch((err) => {
          console.error("Failed to copy join code: ", err);
          this.fallbackCopyJoinCode(joinCode);
        });
    } else {
      // Fallback for older browsers or non-secure contexts
      this.fallbackCopyJoinCode(joinCode);
    }
  }

  fallbackCopyJoinCode(joinCode) {
    // Create a temporary text area
    const textArea = document.createElement("textarea");
    textArea.value = joinCode;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      this.showMessage(
        `Join code "${joinCode}" copied to clipboard!`,
        "success"
      );
    } catch (err) {
      console.error("Fallback: Failed to copy join code: ", err);
      this.showMessage(`Join code: ${joinCode}`, "info");
    } finally {
      document.body.removeChild(textArea);
    }
  }

  showModal(modalId) {
    document.getElementById(modalId)?.classList.remove("hidden");
  }

  hideModal(modalId) {
    document.getElementById(modalId)?.classList.add("hidden");
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  getCSRFToken() {
    // Try multiple ways to get CSRF token
    let token = document.querySelector("[name=csrfmiddlewaretoken]")?.value;
    if (!token) {
      token = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content");
    }
    if (!token) {
      // Try to get from cookie
      const cookies = document.cookie.split(";");
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === "csrftoken") {
          token = value;
          break;
        }
      }
    }
    return token || "";
  }

  showMessage(message, type = "info") {
    // Use existing message system if available
    if (window.app && typeof window.app.showMessage === "function") {
      window.app.showMessage(message, type);
    } else {
      console.log(`${type.toUpperCase()}: ${message}`);
      // Fallback to custom inline message modal
      this.#ensureModalStyles();
      this.#showInlineMessage(message, type);
    }
  }

  // Create a simple inline message modal if global app message is unavailable
  #showInlineMessage(message, type = "info") {
    this.#ensureModalStyles();
    let box = document.getElementById("custom-message-box");
    let text = document.getElementById("message-box-text");
    let okBtn = document.getElementById("message-box-ok");

    if (!box) {
      box = document.createElement("div");
      box.id = "custom-message-box";
      box.className = "custom-message-box";
      box.innerHTML = `
        <div class="message-box-content">
          <div id="message-box-text" class="message-box-text"></div>
          <button id="message-box-ok" class="btn btn-primary">OK</button>
        </div>
      `;
      document.body.appendChild(box);
      text = box.querySelector("#message-box-text");
      okBtn = box.querySelector("#message-box-ok");
      okBtn?.addEventListener("click", () => box.classList.add("hidden"));
    }

    text.textContent = message;
    box.classList.remove("hidden");
    // Optional: auto-hide for non-error types
    if (type !== "error") {
      setTimeout(() => {
        if (!box.classList.contains("hidden")) box.classList.add("hidden");
      }, 3000);
    }
  }

  #ensureModalStyles() {
    if (document.getElementById("custom-modal-styles")) return;
    const style = document.createElement("style");
    style.id = "custom-modal-styles";
    style.textContent = `
      .hidden { display: none !important; }
      .custom-message-box, .custom-confirm-box { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
      .message-box-content, .confirm-box-content { background: #fff; color: #111; border-radius: 10px; padding: 16px 20px; width: min(420px, calc(100% - 32px)); box-shadow: 0 12px 28px rgba(0,0,0,0.25); }
      .confirm-box-text, .message-box-text { margin-bottom: 12px; }
      .confirm-box-actions { display: flex; gap: 10px; justify-content: flex-end; }
    `;
    document.head.appendChild(style);
  }
}

// Initialize community manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.communityManager = new CommunityManager();
});
