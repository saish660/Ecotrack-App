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


    const customMessageBox = document.getElementById("custom-message-box");
    const messageBoxText = document.getElementById("message-box-text");
    const messageBoxOk = document.getElementById("message-box-ok");

    const DATA_API = new EcoTrackAPI();

    // --- Global Data Variables ---
    let userData = {
        username: '',
        streak: 0,
        carbon_footprint: 0,
        sustainability_score: 0,
        habits: []
    };
    let achievements = [];
    let lastQuestionnaireSubmissionDate = null;

    // --- CSRF Token Function ---
    function getCsrfToken() {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken=')) {
                    cookieValue = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
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
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                }
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok (${response.status})`);
            }

            const data = await response.json();
            let habits = data.data.habits || [];

            userData = {
                username: data.data.username || '',
                streak: data.data.streak || 0,
                carbon_footprint: data.data.carbon_footprint || 0,
                sustainability_score: data.data.sustainability_score || 0,
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({habit_text: habitText})
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({habit_id: habitId, habit_text: habitText})
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
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken(),
                },
                body: JSON.stringify({habit_id: habitId})
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
          <input type='text' class='add-habit-input' value="${habit['text']}" style="flex:1;max-width:60%;margin-right:0.5rem;" />
          <span class="habit-actions">
            <button class="habit-action-btn save-edit" data-id="${habit['id']}" title="Save">💾</button>
            <button class="habit-action-btn cancel-edit" data-id="${habit['id']}" title="Cancel">✖️</button>
          </span>
        `;
            } else {
                li.innerHTML = `
          <label class="habit-checkbox">
            <span class="habit-text">${habit['text']}</span>
          </label>
          <span class="habit-actions">
            <button class="habit-action-btn edit-habit" data-id="${habit['id']}" title="Edit">✏️</button>
            <button class="habit-action-btn delete-habit" data-id="${habit['id']}" title="Delete">🗑️</button>
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
                if (confirm("Delete this habit?")) {
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

    // --- Utility Functions ---
    function updateDashboardUI() {
        if (sustainabilityScoreElement) {
            sustainabilityScoreElement.textContent = userData.sustainability_score;
        }
        if (carbonFootprintElement) {
            carbonFootprintElement.textContent = userData.carbon_footprint.toFixed(1);
        }

        if (habitsTodayElement) {
            habitsTodayElement.textContent = userData.habits_today;
        }

        if (scoreCircle) {
            const circumference = 2 * Math.PI * 45; // radius of circle = 45
            scoreCircle.style.strokeDasharray = circumference;
            scoreCircle.style.strokeDashoffset = circumference - (userData.sustainability_score / 100) * circumference;
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
            alert(message);
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
                    const habitsTab = document.querySelector('.nav-item[data-tab="habits"]');
                    if (habitsTab) {
                        habitsTab.click();
                    }
                }
            }
        });
    }

    function formDataToJson(formData)
    {
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
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken(),
                    },
                    body: formDataToJson(formData)
                });

                if (response.ok) {
                    await refreshUserData();
                    // Hide/disable the form and show the completion message
                    dailyQuestionnaireForm.classList.add("disabled");
                    if (formStatusMessage) {
                        formStatusMessage.classList.remove("hidden");
                        window.location.href = "/"
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
    initializeApp().catch(error => {
        console.error("[App] Error initializing application:", error);
        showAlert("Error loading application. Please refresh the page.");
    });
});