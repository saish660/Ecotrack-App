document.addEventListener("DOMContentLoaded", () => {
  // --- UI Elements ---
  const navItems = document.querySelectorAll(".nav-item");
  const tabContents = document.querySelectorAll(".tab-content");
  const sustainabilityScoreElement = document.getElementById(
    "sustainability-score"
  );
  const scoreCircle = document.getElementById("score-circle");
  const carbonFootprintElement = document.getElementById("carbon-footprint");
  const habitsTodayElement = document.getElementById("habits-completed-today");
  const suggestionCardsContainer = document.getElementById(
    "suggestion-cards-container"
  );
  const dailyQuestionnaireForm = document.getElementById(
    "daily-questionnaire-form"
  );
  const formStatusMessage = document.getElementById("form-status-message");
  const habitCategoryGrid = document.getElementById("habit-category-grid");
  const habitCategoryStatus = document.getElementById("habit-category-status");
  const habitCategorySuggestions = document.getElementById(
    "habit-category-suggestions"
  );

  const customMessageBox = document.getElementById("custom-message-box");
  const messageBoxText = document.getElementById("message-box-text");
  const messageBoxOk = document.getElementById("message-box-ok");

  const DATA_API = new EcoTrackAPI();

  // --- Global Data Variables ---
  let userData = {
    username: "",
    streak: 0,
    carbon_footprint: 0,
    sustainability_score: 0,
    habits: [],
    requires_survey: false,
    survey_prompt: "submit survey",
  };
  let achievements = [];
  let lastQuestionnaireSubmissionDate = null;
  const HABIT_CATEGORY_LIBRARY = {
    food: {
      title: "Food & Kitchen",
      icon: "🥗",
      summary: "Cook greener & cut waste",
      accent: "#16a34a",
      gradient: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
    },
    travel: {
      title: "Travel & Commute",
      icon: "🚲",
      summary: "Lower-impact trips & errands",
      accent: "#0ea5e9",
      gradient: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
    },
    home: {
      title: "Home & Energy",
      icon: "🏡",
      summary: "Efficient routines indoors",
      accent: "#facc15",
      gradient: "linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)",
    },
    community: {
      title: "Lifestyle & Community",
      icon: "🤝",
      summary: "Share and motivate others",
      accent: "#ec4899",
      gradient: "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)",
    },
  };
  let activeHabitCategory = null;
  let habitCategoriesInitialized = false;
  let habitCategoryFetchController = null;

  // --- CSRF Token Function ---
  function getCsrfToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, "csrftoken".length + 1) === "csrftoken=") {
          cookieValue = decodeURIComponent(
            cookie.substring("csrftoken".length + 1)
          );
          break;
        }
      }
    }
    return cookieValue;
  }

  // --- API Functions ---
  async function fetchUserData() {
    try {
      const response = await fetch("get_user_data", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }

      const data = await response.json();
      let habits = data.data.habits || [];

      userData = {
        username: data.data.username || "",
        streak: data.data.streak || 0,
        carbon_footprint: data.data.carbon_footprint || 0,
        sustainability_score: data.data.sustainability_score || 0,
        requires_survey: data.data.requires_survey,
        survey_prompt: data.data.survey_prompt,
        survey_skipped: data.data.survey_skipped,
        habits: habits,
        habits_today: data.data.habits_today || 0,
      };

      return userData;
    } catch (error) {
      console.error("[API] Error fetching user data:", error);
      showAlert("Error loading user data. Please refresh the page.");
      return null;
    }
  }

  async function saveHabit(habitText) {
    try {
      const response = await fetch("save_habit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
        body: JSON.stringify({ habit_text: habitText }),
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }

      const data = await response.json();
      console.log("[API] Habit saved:", data);
      return data;
    } catch (error) {
      console.error("[API] Error saving habit:", error);
      showAlert("Error saving habit. Please try again.");
      return null;
    }
  }

  async function updateHabit(habitId, habitText) {
    try {
      const response = await fetch("update_habit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
        body: JSON.stringify({ habit_id: habitId, habit_text: habitText }),
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }

      const data = await response.json();
      console.log("[API] Habit updated:", data);
      return data;
    } catch (error) {
      console.error("[API] Error updating habit:", error);
      showAlert("Error updating habit. Please try again.");
      return null;
    }
  }

  async function deleteHabit(habitId) {
    try {
      const response = await fetch("delete_habit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
        body: JSON.stringify({ habit_id: habitId }),
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }

      const data = await response.json();
      console.log("[API] Habit deleted:", data);
      return data;
    } catch (error) {
      console.error("[API] Error deleting habit:", error);
      showAlert("Error deleting habit. Please try again.");
      return null;
    }
  }

  function renderHabitCategoryCards() {
    if (!habitCategoryGrid) return;
    habitCategoryGrid.innerHTML = "";

    const entries = Object.entries(HABIT_CATEGORY_LIBRARY);
    if (!entries.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "habit-category-placeholder";
      placeholder.textContent = "No curated categories available right now.";
      habitCategoryGrid.appendChild(placeholder);
      return;
    }

    entries.forEach(([key, meta]) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "habit-category-card";
      if (activeHabitCategory === key) {
        card.classList.add("active");
      }
      card.dataset.category = key;
      if (meta.accent) {
        card.style.setProperty("--habit-card-accent", meta.accent);
      }
      if (meta.gradient) {
        card.style.setProperty("--habit-card-gradient", meta.gradient);
      }

      const icon = document.createElement("span");
      icon.className = "habit-category-icon";
      icon.textContent = meta.icon;

      const copy = document.createElement("div");
      copy.className = "habit-category-copy";
      const titleEl = document.createElement("p");
      titleEl.textContent = meta.title;
      const subEl = document.createElement("small");
      subEl.textContent = meta.summary;
      copy.appendChild(titleEl);
      copy.appendChild(subEl);

      card.appendChild(icon);
      card.appendChild(copy);
      habitCategoryGrid.appendChild(card);
    });
  }

  function renderHabitSuggestionsList(suggestions) {
    if (!habitCategorySuggestions) return;
    habitCategorySuggestions.innerHTML = "";

    if (!Array.isArray(suggestions) || !suggestions.length) {
      const empty = document.createElement("p");
      empty.className = "habit-category-status";
      empty.textContent = "No ready habits in this collection yet.";
      habitCategorySuggestions.appendChild(empty);
      return;
    }

    suggestions.forEach((habit) => {
      const card = document.createElement("div");
      card.className = "habit-suggestion-card";

      const info = document.createElement("div");
      info.className = "habit-suggestion-info";

      const titleEl = document.createElement("p");
      titleEl.className = "habit-suggestion-title";
      titleEl.textContent = habit.title;

      const descEl = document.createElement("p");
      descEl.className = "habit-suggestion-desc";
      descEl.textContent = habit.description;

      info.appendChild(titleEl);
      info.appendChild(descEl);

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-secondary habit-suggestion-add-btn";
      addBtn.dataset.habit = habit.title;
      addBtn.textContent = "Add to my habits";

      card.appendChild(info);
      card.appendChild(addBtn);
      habitCategorySuggestions.appendChild(card);
    });
  }

  async function fetchHabitCategorySuggestions(categoryKey) {
    if (!habitCategorySuggestions) return;
    const entry = HABIT_CATEGORY_LIBRARY[categoryKey];
    if (!entry) return;

    if (habitCategoryFetchController) {
      habitCategoryFetchController.abort();
    }
    habitCategoryFetchController = new AbortController();
    const controller = habitCategoryFetchController;

    habitCategorySuggestions.innerHTML = "";
    const loading = document.createElement("div");
    loading.className = "habit-category-placeholder";
    loading.textContent = `Gathering ${entry.title.toLowerCase()} ideas…`;
    habitCategorySuggestions.appendChild(loading);

    try {
      const response = await fetch("get_habit_category_suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
        body: JSON.stringify({ category: categoryKey }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }

      const data = await response.json();
      if (controller !== habitCategoryFetchController) return;
      if (data.status !== "success") {
        throw new Error(data.message || "Unable to load habits");
      }

      renderHabitSuggestionsList(data.suggestions);
      if (habitCategoryStatus) {
        const label = data.title || entry.title;
        habitCategoryStatus.textContent = `Showing ${label} ideas`;
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      console.error("[Habits] Failed to load category suggestions", error);
      habitCategorySuggestions.innerHTML = "";
      const errorEl = document.createElement("p");
      errorEl.className = "habit-category-status";
      errorEl.textContent =
        "Couldn't load curated habits right now. Please try again.";
      habitCategorySuggestions.appendChild(errorEl);
      if (habitCategoryStatus) {
        habitCategoryStatus.textContent = "Tap a card to retry.";
      }
    }
  }

  function handleHabitCategorySelection(categoryKey) {
    const entry = HABIT_CATEGORY_LIBRARY[categoryKey];
    if (!entry) return;
    activeHabitCategory = categoryKey;
    renderHabitCategoryCards();
    if (habitCategoryStatus) {
      habitCategoryStatus.textContent = `Loading ${entry.title} ideas…`;
    }
    fetchHabitCategorySuggestions(categoryKey);
    if (habitCategorySuggestions) {
      habitCategorySuggestions.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function initializeHabitCategoryPanel() {
    if (habitCategoriesInitialized) return;
    if (!habitCategoryGrid) return;

    habitCategoriesInitialized = true;
    renderHabitCategoryCards();

    habitCategoryGrid.addEventListener("click", (event) => {
      const card = event.target.closest(".habit-category-card");
      if (!card) return;
      const categoryKey = card.dataset.category;
      handleHabitCategorySelection(categoryKey);
    });

    if (habitCategorySuggestions) {
      habitCategorySuggestions.addEventListener("click", async (event) => {
        const addBtn = event.target.closest(".habit-suggestion-add-btn");
        if (!addBtn) return;
        const habitTitle = addBtn.dataset.habit;
        if (!habitTitle) return;

        const originalText = addBtn.textContent;
        addBtn.disabled = true;
        addBtn.textContent = "Adding...";

        try {
          const result = await saveHabit(habitTitle);
          if (result) {
            await refreshUserData();
            renderHabits();
            showAlert(`"${habitTitle}" added to your habits!`);
          }
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = originalText;
        }
      });
    }
  }

  // --- Habits Section Logic ---
  function renderHabits() {
    const habitList = document.getElementById("habit-items-list");
    if (!habitList) return;

    habitList.innerHTML = "";
    console.log("[Habits] Rendering habits:", userData.habits);

    if (!userData.habits || userData.habits.length === 0) {
      habitList.innerHTML =
        '<li style="color: #888; text-align: center;">No habits yet. Add your first habit above!</li>';
      return;
    }

    userData.habits.forEach((habit, idx) => {
      const li = document.createElement("li");
      li.className = "habit-item";
      if (habit.editing) {
        li.innerHTML = `
          <input type='text' class='add-habit-input' value="${habit["text"]}" style="flex:1;max-width:60%;margin-right:0.5rem;" />
          <span class="habit-actions">
            <button class="habit-action-btn save-edit" data-id="${habit["id"]}" title="Save">💾</button>
            <button class="habit-action-btn cancel-edit" data-id="${habit["id"]}" title="Cancel">✖️</button>
          </span>
        `;
      } else {
        li.innerHTML = `
          <label class="habit-checkbox">
            <span class="habit-text">${habit["text"]}</span>
          </label>
          <span class="habit-actions">
            <button class="habit-action-btn edit-habit" data-id="${habit["id"]}" title="Edit">✏️</button>
            <button class="habit-action-btn delete-habit" data-id="${habit["id"]}" title="Delete">🗑️</button>
          </span>
        `;
      }
      habitList.appendChild(li);
    });
  }

  async function setupHabitsSection() {
    const addHabitInput = document.getElementById("habit-input");
    const addHabitBtn = document.getElementById("habit-add-btn");
    const habitList = document.getElementById("habit-items-list");

    console.log("[Habits] Initializing setupHabitsSection");

    if (!addHabitInput || !addHabitBtn || !habitList) {
      console.error("[Habits] Missing required element:", {
        addHabitInput,
        addHabitBtn,
        habitList,
      });
      return;
    }

    // Initial render
    renderHabits();
    initializeHabitCategoryPanel();

    // Add habit functionality
    addHabitBtn.onclick = async () => {
      console.log("[Habits] Add button clicked");
      const val = addHabitInput.value.trim();
      if (val) {
        const result = await saveHabit(val);
        if (result) {
          addHabitInput.value = "";
          await refreshUserData();
          renderHabits();
          showAlert(`"${val}" added to your habits!`);
        }
      }
    };

    addHabitInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addHabitBtn.click();
    });

    // Handle habit actions
    habitList.addEventListener("click", async (e) => {
      const button = e.target.closest("button");
      if (!button) return;

      const habitId = parseInt(button.dataset.id);
      const li = button.closest("li");
      const idx = Array.from(habitList.children).indexOf(li);

      if (button.classList.contains("edit-habit")) {
        userData.habits[idx].editing = true;
        renderHabits();
      } else if (button.classList.contains("delete-habit")) {
        const confirmed = await showConfirm("Delete this habit?");
        if (confirmed) {
          const result = await deleteHabit(habitId);
          if (result) {
            await refreshUserData();
            renderHabits();
            showAlert("Habit deleted successfully!");
          }
        }
      } else if (button.classList.contains("save-edit")) {
        const input = li.querySelector("input[type='text']");
        const newText = input.value.trim();
        if (newText) {
          const result = await updateHabit(habitId, newText);
          if (result) {
            await refreshUserData();
            renderHabits();
            showAlert("Habit updated successfully!");
          }
        }
      } else if (button.classList.contains("cancel-edit")) {
        userData.habits[idx].editing = false;
        renderHabits();
      }
    });
  }

  // --- Confirm Dialog ---
  function ensureModalStyles() {
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
  function showConfirm(message) {
    return new Promise((resolve) => {
      ensureModalStyles();
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
  // --- Utility Functions ---
  function updateDashboardUI() {
    const requiresSurvey = Boolean(userData.requires_survey);
    const surveyPrompt = userData.survey_prompt || "submit survey";

    const scoreCircleSvg = document.querySelector(
      ".score-circle-container svg"
    );
    const surveyButton = document.getElementById("survey-cta-button");

    if (surveyButton) {
      surveyButton.classList.toggle("hidden", !requiresSurvey);
    }

    if (scoreCircleSvg) {
      scoreCircleSvg.style.display = requiresSurvey ? "none" : "";
    }

    if (sustainabilityScoreElement) {
      sustainabilityScoreElement.classList.toggle("hidden", requiresSurvey);
      if (!requiresSurvey) {
        sustainabilityScoreElement.textContent = userData.sustainability_score;
      }
    }
    if (carbonFootprintElement) {
      const carbonValue = Number(userData.carbon_footprint);
      if (requiresSurvey) {
        carbonFootprintElement.textContent = "-";
      } else if (Number.isFinite(carbonValue)) {
        carbonFootprintElement.textContent = carbonValue.toFixed(1);
      } else {
        carbonFootprintElement.textContent = "-";
      }
    }

    if (habitsTodayElement) {
      habitsTodayElement.textContent = userData.habits_today;
    }

    if (scoreCircle) {
      const circumference = 2 * Math.PI * 45; // radius of circle = 45
      scoreCircle.style.strokeDasharray = circumference;
      scoreCircle.style.strokeDashoffset = requiresSurvey
        ? circumference
        : circumference -
          (userData.sustainability_score / 100) * circumference;
    }

    // Update streak if element exists
    const streakElement = document.getElementById("streak-count");
    if (streakElement) {
      streakElement.textContent = userData.streak;
    }

    // Update username if element exists
    const usernameElement = document.getElementById("username");
    if (usernameElement) {
      usernameElement.textContent = userData.username;
    }
  }

  function showAlert(message) {
    if (customMessageBox && messageBoxText) {
      messageBoxText.textContent = message;
      customMessageBox.classList.remove("hidden");
    } else {
      // Create a lightweight inline message as a fallback
      ensureModalStyles();
      let box = document.getElementById("custom-message-box");
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
      }
      const text = document.getElementById("message-box-text");
      const okBtn = document.getElementById("message-box-ok");
      if (text) text.textContent = message;
      box.classList.remove("hidden");
      okBtn?.addEventListener("click", () => box.classList.add("hidden"));
    }
  }

  async function refreshUserData() {
    const data = await fetchUserData();
    if (data) {
      updateDashboardUI();
    }
  }

  // --- Event Handlers ---
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetTab = item.dataset.tab;
      navItems.forEach((nav) => nav.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));
      item.classList.add("active");
      const targetElement = document.getElementById(targetTab);
      if (targetElement) {
        targetElement.classList.add("active");
      }
    });
  });

  if (suggestionCardsContainer) {
    suggestionCardsContainer.addEventListener("click", async (event) => {
      const button = event.target.closest(".add-suggestion-to-habits-btn");
      if (button) {
        const title = button.dataset.title;
        const result = await saveHabit(title);
        if (result) {
          await refreshUserData();
          renderHabits();
          showAlert(`"${title}" added to your habits!`);
          const habitsTab = document.querySelector(
            '.nav-item[data-tab="habits"]'
          );
          if (habitsTab) {
            habitsTab.click();
          }
        }
      }
    });
  }

  function formDataToJson(formData) {
    const obj = {};
    for (const [key, value] of formData.entries()) {
      obj[key] = value;
    }
    return JSON.stringify(obj);
  }

  if (dailyQuestionnaireForm) {
    dailyQuestionnaireForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(dailyQuestionnaireForm);

      // Send questionnaire data to server
      try {
        const response = await fetch("submit_questionnaire", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCsrfToken(),
          },
          body: formDataToJson(formData),
        });

        if (response.ok) {
          await refreshUserData();
          // Hide/disable the form and show the completion message
          dailyQuestionnaireForm.classList.add("disabled");
          if (formStatusMessage) {
            formStatusMessage.classList.remove("hidden");
            window.location.href = "/";
          }
          showAlert("Daily check-in submitted!");
        } else {
          showAlert("Error submitting questionnaire. Please try again.");
          window.location.reload();
        }
      } catch (error) {
        console.error("Error submitting questionnaire:", error);
        showAlert("Error submitting questionnaire. Please try again.");
      }
    });

    // Add event listener to handle the 'selected' class on questionnaire cards
    dailyQuestionnaireForm.addEventListener("change", (event) => {
      if (event.target.type === "radio") {
        const questionName = event.target.name;
        const allOptionsForQuestion = dailyQuestionnaireForm.querySelectorAll(
          `input[name="${questionName}"]`
        );

        allOptionsForQuestion.forEach((radio) => {
          radio.parentElement.classList.remove("selected");
        });

        event.target.parentElement.classList.add("selected");
      }
    });
  }

  if (messageBoxOk) {
    messageBoxOk.addEventListener("click", () => {
      if (customMessageBox) {
        customMessageBox.classList.add("hidden");
      }
    });
  }

  // --- Initialize Application ---
  async function initializeApp() {
    console.log("[App] Initializing application...");

    // Load user data
    await fetchUserData();

    // Update UI
    updateDashboardUI();

    // Setup habits section
    await setupHabitsSection();

    console.log("[App] Application initialized successfully");
  }

  // Start the application
  initializeApp().catch((error) => {
    console.error("[App] Error initializing application:", error);
    showAlert("Error loading application. Please refresh the page.");
  });
});
