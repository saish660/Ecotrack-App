// Main EcoTrack Application
class EcoTrackApp {
  constructor() {
    this.api = new EcoTrackAPI();
    this.requiresSurvey = false;
    this.initializeApp();
  }

  questions_fetched = false;

  userAchievements = [
    {
      id: 1,
      icon: "🌱",
      title: "First Check-In",
      description: "Complete your first daily check-in",
    },
    {
      id: 2,
      icon: "🔥",
      title: "4-Day Streak",
      description: "Maintain a 3-day streak",
    },
    {
      id: 3,
      icon: "⚡",
      title: "7-Day Streak",
      description: "Maintain a 7-day streak",
    },
    {
      id: 4,
      icon: "👑",
      title: "30-Day Streak",
      description: "Maintain a 30-day streak",
    },
    {
      id: 5,
      icon: "🏆",
      title: "50-Day Streak",
      description: "Maintain a 50-day streak",
    },
    {
      id: 6,
      icon: "🏆",
      title: "100-Day Streak",
      description: "Maintain a 100-day streak",
    },
    {
      id: 7,
      icon: "✅",
      title: "5 Habits Master",
      description: "Complete 5 habits in one day",
    },
    {
      id: 8,
      icon: "🌳",
      title: "Eco Champion",
      description: "Reach 80+ sustainability score",
    },
    {
      id: 9,
      icon: "👣",
      title: "Shoes without footprint",
      description: "Reach sustainability score of 100",
    },
  ];

  getAchievementById(id) {
    const foundAchievement = this.userAchievements.find(
      (achievement) => achievement.id === id
    );

    return foundAchievement || false;
  }

  async initializeApp() {
    try {
      // Load dashboard data from API
      await this.loadDashboardData();

      // Initialize UI components
      this.initializeUI();
      this.bindQuestionnaireEvents();

      // Load initial data
      await this.loadAchievements();
    } catch (error) {
      console.error("Failed to initialize app:", error);
      this.showError("Failed to connect to server.");
    }
  }

  async loadDashboardData() {
    try {
      const data = await this.api.getDashboardData();
      this.updateDashboardUI(data);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      // Fallback to default values
      this.updateDashboardUI({
        sustainability_score: 50,
        carbon_footprint: 150,
        habits_completed_today: 0,
        streak_count: 0,
        requires_survey: false,
        survey_prompt: "submit survey",
      });
    }
  }

  updateDashboardUI(data) {
    const requiresSurvey = Boolean(data.requires_survey);
    const surveyPrompt = data.survey_prompt || "submit survey";
    this.requiresSurvey = requiresSurvey;

    // Update sustainability score
    const scoreElement = document.getElementById("sustainability-score");
    const scoreCircle = document.getElementById("score-circle");
    const scoreCircleSvg = document.querySelector(
      ".score-circle-container svg"
    );
    const surveyButton = document.getElementById("survey-cta-button");

    if (scoreElement) {
      if (requiresSurvey) {
        scoreElement.classList.add("hidden");
      } else {
        scoreElement.classList.remove("hidden");
        scoreElement.textContent = data.sustainability_score;
      }
    }

    if (surveyButton) {
      surveyButton.classList.toggle("hidden", !requiresSurvey);
    }

    if (scoreCircleSvg) {
      scoreCircleSvg.style.display = requiresSurvey ? "none" : "";
    }

    if (scoreCircle) {
      const circumference = 2 * Math.PI * 45;
      const numericScore = Number(data.sustainability_score) || 0;
      scoreCircle.style.strokeDashoffset = requiresSurvey
        ? circumference
        : circumference - (numericScore / 100) * circumference;
    }

    // Update carbon footprint
    const carbonElement = document.getElementById("carbon-footprint");
    if (carbonElement) {
      if (requiresSurvey) {
        carbonElement.textContent = "-";
      } else {
        const carbonValue = Number(data.carbon_footprint);
        carbonElement.textContent = Number.isFinite(carbonValue)
          ? `${carbonValue.toFixed(1)}`
          : "-";
      }
    }

    // Update habits completed
    const habitsElement = document.getElementById("habits-completed-today");
    if (habitsElement) {
      habitsElement.textContent = data.habits_completed_today;
    }

    // Update streak count
    const streakElement = document.getElementById("streak-count");
    if (streakElement) {
      streakElement.textContent = `${data.streak_count} days`;
    }
  }

  async loadAchievements() {
    try {
      const data = await this.api.getDashboardData();
      this.renderAchievements(data.achievements || []);
      this.renderProfileAchievementsPreview(data.achievements || []);
      this.lastAchievements = data.achievements || []; // Store for go-back
    } catch (error) {
      console.error("Failed to load achievements:", error);
      this.renderAchievements([]);
      this.renderProfileAchievementsPreview([]);
      this.lastAchievements = []; // Store for go-back
    }
  }

  // Render all achievements in the all-achievements tab
  renderAchievements(achievements) {
    const container = document.getElementById("achievements-container");
    if (!container) return;
    container.innerHTML = "";
    this.userAchievements.forEach((achievement) => {
      const element = document.createElement("div");
      element.className = `achievement-item ${
        achievements.includes(achievement.id) ? "unlocked" : ""
      }`;
      element.innerHTML = `
        <span class="achievement-icon">${achievement.icon}</span>
        <div class="achievement-title">${achievement.title}</div>
        <div class="achievement-desc">${achievement.description}</div>
      `;
      container.appendChild(element);
    });
  }

  // Render only a few achievements in the profile preview
  renderProfileAchievementsPreview(achievements) {
    const previewContainer = document.getElementById(
      "profile-achievements-preview"
    );
    if (!previewContainer) return;
    previewContainer.innerHTML = "";

    const toShow =
      achievements.length > 2 ? achievements.slice(0, 2) : achievements;
    toShow.forEach((id) => {
      const element = document.createElement("div");
      element.className = `achievement-item unlocked`;
      element.innerHTML = `
        <span class="achievement-icon">${
          this.getAchievementById(id).icon
        }</span>
        <div class="achievement-title">${
          this.getAchievementById(id).title
        }</div>
      `;
      previewContainer.appendChild(element);
    });
  }

  initializeUI() {
    // Initialize navigation
    this.initializeNavigation();
    // Only render questionnaire if check-in tab is active
    if (document.getElementById("checkin").classList.contains("active")) {
      this.renderDailyQuestionnaire();
      this.initializeQuestionnaireProgress();
    }
    // Initialize suggestions
    this.renderSuggestions();
    const reloadBtn = document.getElementById("reload-suggestions-btn");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => this.renderSuggestions());
    }
    // Initialize go-back buttons
    this.initializeGoBackButtons();
    // Initialize 3D ecosystem visualization
    this.initializeEcosystem3D();
  }

  initializeNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const tabContents = document.querySelectorAll(".tab-content");
    navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const targetTab = item.dataset.tab;
        navItems.forEach((nav) => nav.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));
        item.classList.add("active");
        document.getElementById(targetTab).classList.add("active");
        // Render carbon graph when profile tab is activated
        if (targetTab === "profile") {
          this.renderCarbonGraph();
        }
        // Render all achievements when all-achievements tab is activated
        if (targetTab === "all-achievements") {
          this.loadAchievements();
        }
        // Render questionnaire only when check-in tab is activated
        if (targetTab === "checkin") {
          this.renderDailyQuestionnaire();
        }
      });
    });

    // Also handle profile preview "View All Badges" button
    const viewAllBadgesBtn = document.querySelector(
      "button[data-tab='all-achievements']"
    );
    if (viewAllBadgesBtn) {
      viewAllBadgesBtn.addEventListener("click", () => {
        navItems.forEach((nav) => nav.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));
        document
          .querySelector(".nav-item[data-tab='profile']")
          .classList.remove("active");
        document
          .querySelector(".nav-item[data-tab='all-achievements']")
          ?.classList.add("active");
        document.getElementById("all-achievements").classList.add("active");
        this.loadAchievements();
      });
    }
  }

  async renderCarbonGraph() {
    const canvas = document.getElementById("carbonGraph");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const data = await this.api.getDashboardData();
    if (
      data.requires_survey ||
      !Array.isArray(data.last_8_footprints) ||
      data.last_8_footprints.length < 8
    ) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "16px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${data.survey_prompt || "submit survey"} to view footprint trends`,
        width / 2,
        height / 2
      );
      return;
    }

    let graphData = data.last_8_footprints.map((value) => Number(value) || 0);
    const lastMonthData = graphData.slice(0, 4);
    const thisMonthData = graphData.slice(4, 8);

    const nextMonthPrediction = thisMonthData.map((current, i) => {
      const trend = current - lastMonthData[i];
      const predicted = current + trend;
      return Math.max(50, Math.min(1200, predicted));
    });
    const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];

    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    const maxValue = Math.max(
      ...thisMonthData,
      ...lastMonthData,
      ...nextMonthPrediction
    );
    const minValue = Math.min(
      ...thisMonthData,
      ...lastMonthData,
      ...nextMonthPrediction
    );

    // Create a nice range with some padding
    const valueRange = maxValue - minValue;
    const paddedMax = maxValue + valueRange * 0.1; // Add 10% padding at top
    const paddedMin = Math.max(0, minValue - valueRange * 0.1); // Add 10% padding at bottom, but don't go below 0
    const totalRange = paddedMax - paddedMin;

    // Number of grid lines/labels
    const gridLines = 5;

    // Draw grid lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Helper function to draw line
    const drawLine = (data, color, lineWidth = 3, isDotted = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Set line dash for dotted lines
      if (isDotted) {
        ctx.setLineDash([8, 5]); // 8px dash, 5px gap
      } else {
        ctx.setLineDash([]); // Solid line
      }

      ctx.beginPath();

      data.forEach((value, index) => {
        const x = padding + (chartWidth / (data.length - 1)) * index;
        // Fix: Use the padded range for proper scaling
        const y =
          height - padding - ((value - paddedMin) / totalRange) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Reset line dash after drawing
      ctx.setLineDash([]);
    };

    // Draw data points
    const drawPoints = (data, color) => {
      ctx.fillStyle = color;
      data.forEach((value, index) => {
        const x = padding + (chartWidth / (data.length - 1)) * index;
        // Fix: Use the padded range for proper scaling
        const y =
          height - padding - ((value - paddedMin) / totalRange) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    };

    // Draw lines
    drawLine(lastMonthData, "#3b82f6", 2);
    drawLine(thisMonthData, "#22c55e", 3);
    drawLine(nextMonthPrediction, "#f59e0b", 2, true); // Orange dotted line for prediction

    // Draw points
    drawPoints(lastMonthData, "#3b82f6");
    drawPoints(thisMonthData, "#22c55e");
    drawPoints(nextMonthPrediction, "#f59e0b");

    // Draw week labels
    ctx.fillStyle = "#222";
    ctx.font = "12px Outfit";
    ctx.textAlign = "center";
    weeks.forEach((week, index) => {
      const x = padding + (chartWidth / (weeks.length - 1)) * index;
      ctx.fillText(week, x, height - 10);
    });

    // Fix: Draw value labels on the left with correct values
    ctx.textAlign = "right";
    ctx.fillStyle = "#666";
    ctx.font = "11px Outfit";

    for (let i = 0; i <= gridLines; i++) {
      // Calculate the actual value for this grid line
      const value = paddedMax - (totalRange / gridLines) * i;
      const y = padding + (chartHeight / gridLines) * i + 4; // +4 for better vertical alignment

      ctx.fillText(`${value.toFixed(1)}kg`, padding - 10, y);
    }
  }

  question_count;

  async renderDailyQuestionnaire() {
    if (this.questions_fetched) {
      return;
    }

    const form = document.getElementById("daily-questionnaire-form");
    if (!form) return;

    console.log("Fetching questions from server...");
    const questions = await fetch("get_questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCsrfToken(),
      },
      body: {},
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network response was not ok (${response.status})`);
        }
        return response.json();
      })
      .then((data) => {
        return data.data;
      });

    this.questions_fetched = true;

    form.innerHTML = "";
    this.question_count = 0;
    questions.forEach((q) => {
      this.question_count += 1;
      const questionDiv = document.createElement("div");
      questionDiv.className = "questionnaire-item";
      questionDiv.id = `${q.question}`;

      const questionText = document.createElement("p");
      questionText.className = "question-text";
      questionText.textContent = q.question;
      questionDiv.appendChild(questionText);

      const optionsGrid = document.createElement("div");
      optionsGrid.className = "options-grid";

      q.options.forEach((option) => {
        const optionLabel = document.createElement("label");
        optionLabel.className = "option-card";
        optionLabel.innerHTML = `
                    <input type="radio" name="${q.question}" value="${option.value}" required>
                    <div class="option-content">
                        <span>${option.text}</span>
                    </div>
                `;
        optionsGrid.appendChild(optionLabel);
      });
      questionDiv.appendChild(optionsGrid);
      form.appendChild(questionDiv);
    });

    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.textContent = "Submit Daily Check-in";
    submitButton.className = "btn btn-primary";
    submitButton.style.marginTop = "1rem";
    form.appendChild(submitButton);

    this.updateQuestionnaireProgress();
  }

  initializeQuestionnaireProgress() {
    const progressFill = document.getElementById("questionnaire-progress");
    const progressText = document.getElementById("progress-text");
    if (progressFill && progressText) {
      progressFill.style.width = "0%";
      progressText.textContent = `0/${this.question_count} questions answered`;
    }
  }

  async renderSuggestions() {
    const container = document.getElementById("suggestion-cards-container");
    if (!container) return;

    // Ensure a status element exists for user-facing messages
    let statusEl = document.getElementById("suggestions-status");
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.id = "suggestions-status";
      statusEl.className = "status-line";
      // Insert before the container if possible
      const suggestionsSection = document.getElementById("suggestions");
      if (suggestionsSection) {
        suggestionsSection.insertBefore(statusEl, container);
      } else {
        // fallback: prepend inside container
        container.prepend(statusEl);
      }
    }
    statusEl.textContent = "";

    // Show loading animation while waiting for AI (Gemini) suggestions
    container.innerHTML = "";
    const loading = document.createElement("div");
    loading.id = "suggestions-loading";
    loading.className = "suggestions-loading";
    loading.innerHTML =
      '<div class="spinner" aria-hidden="true"></div><p>Generating ideas with AI…</p>';
    container.appendChild(loading);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s max

    try {
      const response = await fetch("get_suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken(),
        },
        body: {},
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }

      const data = await response.json();
      const suggestions = data?.data ?? [];

      container.innerHTML = ""; // remove loading

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        statusEl.textContent =
          "No AI suggestions available right now. Please try again later.";
        // Provide a subtle retry button
        const retryBtn = document.createElement("button");
        retryBtn.className = "btn btn-outline";
        retryBtn.textContent = "Retry";
        retryBtn.addEventListener("click", () => this.renderSuggestions());
        container.appendChild(retryBtn);
        return;
      }

      suggestions.forEach((suggestion) => {
        const card = document.createElement("div");
        card.className = "suggestion-card";
        card.innerHTML = `
                    <h3>${suggestion.title}</h3>
                    <p>${suggestion.reason}</p>
                    <div>
                        <span class="suggestion-reduction">${suggestion.carbonReduction}</span>
                    </div>
                    <button class="btn btn-secondary add-suggestion-to-habits-btn" data-title="${suggestion.title}">Start This Habit</button>
                `;
        container.appendChild(card);
      });
      statusEl.textContent = ""; // clear any previous status on success
    } catch (err) {
      clearTimeout(timeoutId);
      container.innerHTML = ""; // remove loading
      let msg = "";
      if (err?.name === "AbortError") {
        msg = "AI took too long to respond (20s). Please try again.";
      } else {
        msg = `Couldn't load suggestions: ${err?.message || "Unknown error"}`;
      }
      statusEl.textContent = msg;

      const retryBtn = document.createElement("button");
      retryBtn.className = "btn btn-outline";
      retryBtn.textContent = "Retry";
      retryBtn.addEventListener("click", () => this.renderSuggestions());
      container.appendChild(retryBtn);
    }
  }

  bindQuestionnaireEvents() {
    const form = document.getElementById("daily-questionnaire-form");
    if (form) {
      form.addEventListener("change", (event) => {
        if (event.target.type === "radio") {
          this.updateQuestionnaireProgress();
          this.updateOptionCardSelection(event.target);
        }
      });

      // Add click event listeners for option cards
      form.addEventListener("click", (event) => {
        const optionCard = event.target.closest(".option-card");
        if (optionCard) {
          const radioInput = optionCard.querySelector('input[type="radio"]');
          if (radioInput) {
            radioInput.checked = true;
            this.updateOptionCardSelection(radioInput);
            this.updateQuestionnaireProgress();
          }
        }
      });
    }
  }

  updateOptionCardSelection(radioInput) {
    // Remove selected class from all option cards in the same group
    const name = radioInput.name;
    const allOptions = document.querySelectorAll(`input[name="${name}"]`);
    allOptions.forEach((option) => {
      const optionCard = option.closest(".option-card");
      if (optionCard) {
        optionCard.classList.remove("selected");
      }
    });

    // Add selected class to the clicked option card
    const selectedOptionCard = radioInput.closest(".option-card");
    if (selectedOptionCard) {
      selectedOptionCard.classList.add("selected");
    }
  }

  updateQuestionnaireProgress() {
    const form = document.getElementById("daily-questionnaire-form");
    const progressFill = document.getElementById("questionnaire-progress");
    const progressText = document.getElementById("progress-text");

    if (!form || !progressFill || !progressText) return;

    const totalQuestions = this.question_count;
    const answeredQuestions = new Set();
    let question_id_list = [];

    document.querySelectorAll(".questionnaire-item").forEach((optionCard) => {
      question_id_list.push(optionCard.id);
    });

    question_id_list.forEach((qId) => {
      const selectedOption = form.querySelector(`input[name="${qId}"]:checked`);
      if (selectedOption) {
        answeredQuestions.add(qId);
      }
    });

    const progressPercentage = (answeredQuestions.size / totalQuestions) * 100;
    progressFill.style.width = `${progressPercentage}%`;
    progressText.textContent = `${answeredQuestions.size}/${totalQuestions} questions answered`;
  }

  initializeGoBackButtons() {
    document.querySelectorAll(".go-back-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-go-back");
        const navItems = document.querySelectorAll(".nav-item");
        const tabContents = document.querySelectorAll(".tab-content");
        navItems.forEach((nav) => nav.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));
        document
          .querySelector(`.nav-item[data-tab='${target}']`)
          .classList.add("active");
        document.getElementById(target).classList.add("active");
        // Special case: if going back to dashboard, re-render ecosystem and habits
        if (target === "dashboard") {
          this.initializeEcosystem3D();
          toggleCheckinForm();
        }
        if (target === "profile") {
          this.renderProfileAchievementsPreview(this.lastAchievements || []);
        }
      });
    });
  }

  initializeEcosystem3D() {
    const container = document.getElementById("ecosystem3d");
    const vizWrapper = document.getElementById(
      "ecosystem-visualization-container"
    );
    const placeholder = document.getElementById("ecosystem-placeholder");
    if (!container || !vizWrapper) return;

    if (this.requiresSurvey) {
      container.innerHTML = "";
      vizWrapper.classList.add("hidden");
      if (placeholder) {
        placeholder.classList.remove("hidden");
      }
      return;
    }

    vizWrapper.classList.remove("hidden");
    if (placeholder) {
      placeholder.classList.add("hidden");
    }
    container.innerHTML = "";
    const width = container.offsetWidth || 400;
    const height = container.offsetHeight || 300;
    const scene = new THREE.Scene();

    // --- Dynamic sky and grass color based on score ---
    let skyColor, grassColor;
    const score = parseInt(
      document.getElementById("sustainability-score")?.textContent || "0"
    );
    const deadGrassColor = 0x8b7a67; // A distinct dead brown/gray for grass

    // NEW: Simplified sky and grass color logic for very low scores
    if (score <= 10) {
      skyColor = 0x5a5a5a; // A very bleak, dark gray sky
      grassColor = 0x6b5a4b; // Dark, dead earth color
    } else if (score < 20) {
      // Changed threshold from 30 to 20 to accommodate new dead elements
      skyColor = 0xadb5bd; // Grayish sky
      grassColor = deadGrassColor; // Distinct dead grass color
    } else if (score > 70) {
      skyColor = 0x7ecbff; // Bright blue sky
      grassColor = 0x3cb043; // Lush green grass
    } else {
      // Interpolate between dead and lush (score 20-70)
      const t = (score - 20) / 50; // Adjusted interpolation range
      // Sky: 0xadb5bd (gray) to 0x7ecbff (blue)
      const skyDead = { r: 0xad, g: 0xb5, b: 0xbd };
      const skyLush = { r: 0x7e, g: 0xcb, b: 0xff };
      const skyR = Math.round(skyDead.r + (skyLush.r - skyDead.r) * t);
      const skyG = Math.round(skyDead.g + (skyLush.g - skyDead.g) * t);
      const skyB = Math.round(skyDead.b + (skyLush.b - skyDead.b) * t);
      skyColor = (skyR << 16) | (skyG << 8) | skyB;

      // Grass: 0x8b7a67 (dead brown/gray) to 0x3cb043 (green)
      const grassDeadRGB = {
        r: (deadGrassColor >> 16) & 0xff,
        g: (deadGrassColor >> 8) & 0xff,
        b: deadGrassColor & 0xff,
      };
      const grassLush = { r: 0x3c, g: 0xb0, b: 0x43 };
      const grassR = Math.round(
        grassDeadRGB.r + (grassLush.r - grassDeadRGB.r) * t
      );
      const grassG = Math.round(
        grassDeadRGB.g + (grassLush.g - grassDeadRGB.g) * t
      );
      const grassB = Math.round(
        grassDeadRGB.b + (grassLush.b - grassDeadRGB.b) * t
      );
      grassColor = (grassR << 16) | (grassG << 8) | grassB;
    }

    // Sky dome (large sphere)
    const skyGeo = new THREE.SphereGeometry(60, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      color: skyColor,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Sun (large yellow sphere in the sky) - Always present
    const sunGeo = new THREE.SphereGeometry(2.2, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff066 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(-10, 18, -18);
    scene.add(sun);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 10, 28);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Ground (dynamic grass color, larger land) - Always present
    const groundGeo = new THREE.CylinderGeometry(16, 16, 1.5, 40);
    const groundMat = new THREE.MeshLambertMaterial({ color: grassColor });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -1;
    scene.add(ground);

    // Rocks (remains same color) - Always present
    for (let i = 0; i < 5; i++) {
      const rockGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3);
      const rockMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const angle = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 4;
      rock.position.set(Math.cos(angle) * r, -0.2, Math.sin(angle) * r);
      rock.rotation.y = Math.random() * Math.PI;
      scene.add(rock);
    }

    // NEW: Add bone pieces/skulls for scores below 10
    if (score <= 10) {
      const boneCount = 8; // A fixed number for the bleakest landscape
      for (let i = 0; i < boneCount; i++) {
        const bone = new THREE.Group();
        const boneGeo = new THREE.CylinderGeometry(0.8, 0.08, 0.8, 6);
        const boneMat = new THREE.MeshLambertMaterial({ color: 0xe0e0d1 }); // Off-white bone color
        const mainBone = new THREE.Mesh(boneGeo, boneMat);
        bone.add(mainBone);

        // Add spherical ends to the bones
        const endGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const end1 = new THREE.Mesh(endGeo, boneMat);
        end1.position.y = 0.4;
        bone.add(end1);
        const end2 = new THREE.Mesh(endGeo, boneMat);
        end2.position.y = -0.4;
        bone.add(end2);

        const angle = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 8;
        bone.position.set(Math.cos(angle) * r, -0.6, Math.sin(angle) * r);
        bone.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        scene.add(bone);
      }
    }

    // NEW: Only add the following ecosystem elements if the score is above 10
    if (score > 10) {
      // Add dirt patch (remains same color)
      const dirtGeo = new THREE.CircleGeometry(4, 24);
      const dirtMat = new THREE.MeshLambertMaterial({ color: 0xc2b280 });
      const dirt = new THREE.Mesh(dirtGeo, dirtMat);
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.y = -0.7;
      scene.add(dirt);

      // NEW: Add dead grass bushes and logs for scores below 20 (but above 10)
      if (score < 30) {
        let logCount = 4;
        for (let i = 0; i < logCount; i++) {
          const angle = (i / logCount) * Math.PI * 2 + Math.random() * 0.2;
          const x = Math.cos(angle) * (8 + Math.random() * 4);
          const z = Math.sin(angle) * (8 + Math.random() * 4);
          // Trunk
          const trunkMatColor = score < 30 ? 0x6b4f2a : 0x8b5a2b; // Dead trunk color for low score
          // MODIFIED: Trunk height now scales with the score
          const trunkHeight = 2 + Math.random() + score / 30;
          const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, trunkHeight, 8);
          const trunkMat = new THREE.MeshLambertMaterial({
            color: trunkMatColor,
          });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(x, trunkHeight / 2 - 1, z); // Adjust Y position based on height
          if (score < 20) trunk.rotation.z = (90 * Math.PI) / 180;
          scene.add(trunk);
        }
      }

      // Flowers (dull or vibrant based on score)
      const flowerBaseColor = score < 30 ? 0x909090 : 0x4caf50; // Duller stem for low score
      const petalBaseColor = score < 30 ? 0xcccccc : 0xffc0cb; // Duller petals for low score
      for (let i = 0; i < 8; i++) {
        const flowerGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8);
        const flowerMat = new THREE.MeshLambertMaterial({
          color: flowerBaseColor,
        });
        const stem = new THREE.Mesh(flowerGeo, flowerMat);
        const angle = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * 5;
        stem.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        // Petal
        const petalGeo = new THREE.SphereGeometry(0.18, 8, 8);
        const petalMat = new THREE.MeshLambertMaterial({
          color: petalBaseColor,
        });
        const petal = new THREE.Mesh(petalGeo, petalMat);
        petal.position.set(0, 0.3, 0);
        stem.add(petal);
        scene.add(stem);
      }

      // Trees: more realistic, multi-cone, color/size/rotation variation
      const treeCount = Math.max(0, Math.floor(score / 20)); // Fewer or no trees for low scores
      let leafColor;
      if (score < 30) {
        leafColor = 0xaaaaaa; // dead/pale leaves
      } else if (score > 70) {
        leafColor = 0x1fa72a; // vivid green
      } else {
        // Interpolate between pale and vivid green (score 30-70)
        const t = (score - 30) / 40;
        const pale = { r: 0xaa, g: 0xaa, b: 0xaa };
        const vivid = { r: 0x1f, g: 0xa7, b: 0x2a };
        const r = Math.round(pale.r + (vivid.r - pale.r) * t);
        const g = Math.round(pale.g + (vivid.g - pale.g) * t);
        const b = Math.round(pale.b + (vivid.b - pale.b) * t);
        leafColor = (r << 16) | (g << 8) | b;
      }

      for (let i = 0; i < treeCount; i++) {
        const angle = (i / treeCount) * Math.PI * 2 + Math.random() * 0.2;
        const x = Math.cos(angle) * (8 + Math.random() * 4);
        const z = Math.sin(angle) * (8 + Math.random() * 4);
        // Trunk
        const trunkMatColor = score < 30 ? 0x6b4f2a : 0x8b5a2b; // Dead trunk color for low score
        // MODIFIED: Trunk height now scales with the score
        const trunkHeight = 1 + Math.random() + score / 30;
        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, trunkHeight, 8);
        const trunkMat = new THREE.MeshLambertMaterial({
          color: trunkMatColor,
        });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(x, trunkHeight / 2 - 1, z); // Adjust Y position based on height
        trunk.rotation.y = Math.random() * Math.PI;
        scene.add(trunk);

        // Leaves (multi-cone)
        let leafTops = [];
        if (score < 30) {
          if (Math.random() < 0.6) continue;
          for (let j = 0; j < 1; j++) {
            const leavesGeo = new THREE.ConeGeometry(
              0.8 + Math.random() * 0.3,
              1.5 + Math.random() * 0.3,
              8
            );
            const leavesMat = new THREE.MeshLambertMaterial({
              color: 0x808080,
            });
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.set(x, trunkHeight - 0.7 + j * 0.5, z); // Adjust Y position based on trunk height
            leaves.rotation.y = Math.random() * Math.PI;
            scene.add(leaves);
            leafTops.push(leaves.position.clone());
          }
        } else {
          for (let j = 0; j < 2 + Math.floor(Math.random() * 2); j++) {
            const leavesGeo = new THREE.ConeGeometry(
              1.1 + Math.random() * 0.5,
              2.2 + score / 50 + Math.random() * 0.5,
              10
            );
            const leavesMat = new THREE.MeshLambertMaterial({
              color: leafColor,
            });
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.set(x, trunkHeight - 0.3 + j * 0.7, z); // Adjust Y position based on trunk height
            leaves.rotation.y = Math.random() * Math.PI;
            scene.add(leaves);
            leafTops.push(leaves.position.clone());
          }
        }
      }

      // Animals: add birds and rabbits, animate them
      const carbonFootprint = parseFloat(
        document.getElementById("carbon-footprint")?.textContent || "0"
      );
      const animalReductionFactor =
        carbonFootprint > 100 && score < 50 ? 0.5 : 1;
      const baseAnimalCount = Math.max(0, Math.floor((score - 20) / 25));
      const animalCount = Math.floor(baseAnimalCount * animalReductionFactor);

      const animals = [];
      for (let i = 0; i < animalCount; i++) {
        if (Math.random() < 0.5) {
          // Bird
          const bird = new THREE.Group();
          const bodyGeo = new THREE.SphereGeometry(0.25, 8, 8);
          const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2196f3 });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          bird.add(body);
          const beakGeo = new THREE.ConeGeometry(0.08, 0.18, 8);
          const beakMat = new THREE.MeshLambertMaterial({ color: 0xffa726 });
          const beak = new THREE.Mesh(beakGeo, beakMat);
          beak.position.set(0, 0, 0.28);
          beak.rotation.x = Math.PI / 2;
          bird.add(beak);
          for (let w = -1; w <= 1; w += 2) {
            const wingGeo = new THREE.BoxGeometry(0.18, 0.05, 0.5);
            const wingMat = new THREE.MeshLambertMaterial({ color: 0x1976d2 });
            const wing = new THREE.Mesh(wingGeo, wingMat);
            wing.position.set(w * 0.22, 0, 0);
            wing.rotation.z = w * 0.3;
            bird.add(wing);
          }
          bird.position.set(
            Math.random() * 10 - 5,
            2.5 + Math.random() * 2,
            Math.random() * 10 - 5
          );
          scene.add(bird);
          animals.push({
            mesh: bird,
            type: "bird",
            baseY: bird.position.y,
            phase: Math.random() * Math.PI * 2,
          });
        } else {
          // Rabbit
          const rabbit = new THREE.Group();
          const bodyGeo = new THREE.SphereGeometry(0.28, 10, 10);
          const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf5f5dc });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          rabbit.add(body);
          const headGeo = new THREE.SphereGeometry(0.18, 10, 10);
          const head = new THREE.Mesh(headGeo, bodyMat);
          head.position.set(0, 0.22, 0.18);
          rabbit.add(head);
          for (let e = -1; e <= 1; e += 2) {
            const earGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.32, 8);
            const earMat = new THREE.MeshLambertMaterial({ color: 0xf5f5dc });
            const ear = new THREE.Mesh(earGeo, earMat);
            ear.position.set(e * 0.08, 0.42, 0.18);
            ear.rotation.x = Math.PI / 2.2;
            rabbit.add(ear);
          }
          rabbit.position.set(
            Math.random() * 10 - 5,
            0.2,
            Math.random() * 10 - 5
          );
          scene.add(rabbit);
          animals.push({
            mesh: rabbit,
            type: "rabbit",
            baseY: rabbit.position.y,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    // Animate
    function animate(time) {
      requestAnimationFrame(animate);

      // Animation logic will only affect animals if they exist
      if (typeof animals !== "undefined" && animals.length > 0) {
        animals.forEach((obj) => {
          if (obj.type === "bird") {
            obj.mesh.position.y =
              obj.baseY + Math.sin(time / 400 + obj.phase) * 0.3;
            obj.mesh.position.x += Math.sin(time / 1000 + obj.phase) * 0.01;
            obj.mesh.position.z += Math.cos(time / 1000 + obj.phase) * 0.01;
          } else if (obj.type === "rabbit") {
            obj.mesh.position.y =
              obj.baseY + Math.abs(Math.sin(time / 500 + obj.phase)) * 0.15;
          }
        });
      }

      renderer.render(scene, camera);
    }

    animate();
  }

  showSuccess(message) {
    this.showMessage(message, "success");
  }

  showError(message) {
    this.showMessage(message, "error");
  }

  showMessage(message, type = "info") {
    const messageBox = document.getElementById("custom-message-box");
    const messageText = document.getElementById("message-box-text");

    if (messageBox && messageText) {
      messageText.textContent = message;
      messageBox.classList.remove("hidden");

      // Auto-hide after 3 seconds
      setTimeout(() => {
        messageBox.classList.add("hidden");
      }, 3000);
    }
  }
}

function isDateToday(inputDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const compareDate = new Date(inputDate);
  compareDate.setHours(0, 0, 0, 0);

  return compareDate.getTime() === today.getTime();
}

async function toggleCheckinForm() {
  let checked_in_today = await fetch("get_user_data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
    },
    body: {},
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Network response was not ok (${response.status})`);
      }
      return response.json();
    })
    .then((data) => {
      return data["data"]["last_checkin_date"];
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  if (isDateToday(checked_in_today)) {
    let checkin_div = document.getElementById("dashboard-checkin-shortcut");
    checkin_div.classList.add("disabled-checkin");
    checkin_div.querySelector("p").innerHTML =
      "Done for today, Come back tomorrow!";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new EcoTrackApp();
  toggleCheckinForm();
});

function logout() {
  window.location.href = "/logout";
}
