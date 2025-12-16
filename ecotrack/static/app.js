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

  isLowEndDevice() {
    if (typeof this._isLowEndDevice === "boolean") {
      return this._isLowEndDevice;
    }

    const nav = typeof navigator !== "undefined" ? navigator : {};

    const memoryValue =
      typeof nav.deviceMemory === "number" && nav.deviceMemory > 0
        ? nav.deviceMemory
        : null;
    const coresValue =
      typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0
        ? nav.hardwareConcurrency
        : null;

    // Determine low-end devices strictly via CPU cores and RAM
    const lowResources =
      (memoryValue !== null && memoryValue < 6) ||
      (coresValue !== null && coresValue <= 4);

    this._isLowEndDevice = lowResources;
    return this._isLowEndDevice;
  }

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
    const categorySelect = document.getElementById("suggestions-category");
    if (categorySelect) {
      categorySelect.addEventListener("change", () => this.renderSuggestions());
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
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || canvas.width || 400;
    const cssHeight = canvas.clientHeight || canvas.height || 240;

    const targetWidth = Math.round(cssWidth * dpr);
    const targetHeight = Math.round(cssHeight * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = cssWidth;
    const height = cssHeight;
    ctx.clearRect(0, 0, width, height);

    const exitWithMessage = (message) => {
      this.drawCarbonGraphMessage(ctx, width, height, message);
      ctx.restore();
    };

    let data;
    try {
      data = await this.api.getDashboardData();
    } catch (error) {
      console.error("Failed to load carbon graph data:", error);
      exitWithMessage("Unable to load footprint data.");
      return;
    }

    if (!data || data.requires_survey) {
      const prompt = data?.survey_prompt || "Complete the survey";
      exitWithMessage(`${prompt} to view footprint trends`);
      return;
    }

    const history = this.normalizeFootprintHistory(data.last_8_footprints);
    if (history.length < 2) {
      exitWithMessage("Need at least 2 months of data to forecast.");
      return;
    }

    const actualValues = history.map((item) => item.value);
    const trendValues = this.computeMovingAverage(actualValues, 3);
    const forecastValue = this.computeForecast(actualValues);

    const latestEntry = history[history.length - 1];
    const baseDateSource = latestEntry?.date || new Date();
    const baseDate = new Date(
      baseDateSource.getFullYear(),
      baseDateSource.getMonth(),
      1
    );
    const forecastDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth() + 1,
      1
    );
    const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" });
    const forecastLabel = `${monthFormatter.format(forecastDate)} ${forecastDate
      .getFullYear()
      .toString()
      .slice(-2)}`;

    const fullSeries = [
      ...history,
      {
        value: forecastValue,
        label: forecastLabel,
        date: forecastDate,
        isForecast: true,
      },
    ];

    const padding = 60;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    const valuePool = [...actualValues, ...trendValues, forecastValue];
    const maxValue = Math.max(...valuePool);
    const minValue = Math.min(...valuePool);
    const rawRange = maxValue - minValue;
    const paddingValue =
      rawRange === 0 ? Math.max(25, maxValue * 0.05 || 10) : rawRange * 0.1;
    const paddedMax = maxValue + paddingValue;
    const paddedMin = Math.max(0, minValue - paddingValue);
    const totalRange = paddedMax - paddedMin || 1;

    const xStep = chartWidth / Math.max(fullSeries.length - 1, 1);
    const getX = (idx) => padding + xStep * idx;
    const toY = (value) =>
      height - padding - ((value - paddedMin) / totalRange) * chartHeight;

    const gridLines = 5;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    const drawLine = (
      values,
      xCoords,
      color,
      lineWidth = 3,
      isDotted = false
    ) => {
      if (!values.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(isDotted ? [8, 5] : []);
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = xCoords[index];
        const y = toY(value);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawPoints = (values, xCoords, color) => {
      ctx.fillStyle = color;
      values.forEach((value, index) => {
        const x = xCoords[index];
        const y = toY(value);
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    };

    const actualX = history.map((_, idx) => getX(idx));
    drawLine(actualValues, actualX, "#3b82f6", 3);
    drawPoints(actualValues, actualX, "#3b82f6");

    const trendX = history.map((_, idx) => getX(idx));
    drawLine(trendValues, trendX, "#22c55e", 2);
    drawPoints(trendValues, trendX, "#22c55e");

    const forecastLineValues = [
      actualValues[actualValues.length - 1],
      forecastValue,
    ];
    const forecastX = [getX(history.length - 1), getX(history.length)];
    drawLine(forecastLineValues, forecastX, "#f59e0b", 2, true);
    drawPoints([forecastValue], [getX(history.length)], "#f59e0b");

    ctx.fillStyle = "#222";
    ctx.font = "12px Outfit";
    ctx.textAlign = "center";
    const approximateLabelWidth = 70;
    const labelStep = Math.max(
      1,
      Math.ceil(
        (fullSeries.length * approximateLabelWidth) /
          Math.max(chartWidth, approximateLabelWidth)
      )
    );
    fullSeries.forEach((point, index) => {
      const isLast = index === fullSeries.length - 1;
      if (!isLast && index % labelStep !== 0) {
        return;
      }
      ctx.fillText(point.label, getX(index), height - 10);
    });

    ctx.textAlign = "right";
    ctx.fillStyle = "#666";
    ctx.font = "11px Outfit";
    for (let i = 0; i <= gridLines; i++) {
      const value = paddedMax - (totalRange / gridLines) * i;
      const y = padding + (chartHeight / gridLines) * i + 4;
      ctx.fillText(`${value.toFixed(1)}kg`, padding - 10, y);
    }

    ctx.restore();
  }

  drawCarbonGraphMessage(ctx, width, height, message) {
    if (!ctx) return;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, width / 2, height / 2);
  }

  normalizeFootprintHistory(rawSeries) {
    if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
      return [];
    }

    const trimmed = rawSeries.slice(-8);
    const today = new Date();
    today.setDate(1);
    const startMonth = new Date(
      today.getFullYear(),
      today.getMonth() - (trimmed.length - 1),
      1
    );
    const monthFormatter = new Intl.DateTimeFormat("en", { month: "short" });

    return trimmed.map((entry, index) => {
      let valueCandidate = 0;
      let recordedDate = null;

      if (typeof entry === "number") {
        valueCandidate = entry;
      } else if (entry && typeof entry === "object") {
        const rawValue =
          entry.value ?? entry.amount ?? entry.score ?? entry.measurement;
        valueCandidate = Number(rawValue);
        if (entry.recorded_at) {
          const parsedDate = new Date(entry.recorded_at);
          if (!Number.isNaN(parsedDate.getTime())) {
            recordedDate = parsedDate;
          }
        }
      }

      let numericValue = Number(valueCandidate);
      if (!Number.isFinite(numericValue)) {
        numericValue = 0;
      }
      numericValue = Math.round(numericValue * 100) / 100;

      const fallbackDate = new Date(
        startMonth.getFullYear(),
        startMonth.getMonth() + index,
        1
      );
      const date = recordedDate || fallbackDate;
      const label = `${monthFormatter.format(date)} ${date
        .getFullYear()
        .toString()
        .slice(-2)}`;

      return {
        value: numericValue,
        label,
        date,
      };
    });
  }

  computeMovingAverage(values, windowSize = 3) {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }
    const window = Math.max(1, windowSize);
    return values.map((_, index) => {
      const start = Math.max(0, index - window + 1);
      const subset = values.slice(start, index + 1);
      const avg =
        subset.reduce((total, value) => total + value, 0) / subset.length;
      return Math.round(avg * 100) / 100;
    });
  }

  computeForecast(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }
    const lastValue = Number(values[values.length - 1]) || 0;
    if (values.length === 1) {
      const clampedSingle = Math.min(2000, Math.max(20, lastValue));
      return Math.round(clampedSingle * 100) / 100;
    }

    const n = values.length;
    const sumX = values.reduce((acc, _, index) => acc + index, 0);
    const sumY = values.reduce((acc, value) => acc + value, 0);
    const sumXY = values.reduce((acc, value, index) => acc + index * value, 0);
    const sumX2 = values.reduce((acc, _, index) => acc + index * index, 0);
    const denominator = n * sumX2 - sumX * sumX;
    const regressionSlope =
      denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;

    const recentWindow = values.slice(-4);
    let recentSlope = 0;
    if (recentWindow.length >= 2) {
      const recentChanges = recentWindow.slice(1).map((value, idx) => {
        return value - recentWindow[idx];
      });
      const totalRecentChange = recentChanges.reduce(
        (acc, delta) => acc + delta,
        0
      );
      recentSlope = totalRecentChange / recentChanges.length;
    }

    const blendedDelta =
      (regressionSlope + recentSlope) / 2 || regressionSlope || recentSlope;
    const maxAllowedChange = Math.max(25, Math.abs(lastValue) * 0.15);
    const constrainedDelta = Math.min(
      maxAllowedChange,
      Math.max(-maxAllowedChange, blendedDelta)
    );
    const forecast = lastValue + constrainedDelta;
    const clamped = Math.min(2000, Math.max(20, forecast));
    return Math.round(clamped * 100) / 100;
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

    const categorySelect = document.getElementById("suggestions-category");
    const category = categorySelect?.value || "general";
    const categoryLabel =
      categorySelect?.selectedOptions?.[0]?.textContent?.trim() ||
      "All categories";

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
    statusEl.textContent = `Generating ${categoryLabel.toLowerCase()} ideas…`;

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
        body: JSON.stringify({ category }),
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
          `No AI suggestions available for ${categoryLabel.toLowerCase()} right now. Please try again later.`;
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
      statusEl.textContent = `Showing ${categoryLabel.toLowerCase()} suggestions`;
    } catch (err) {
      clearTimeout(timeoutId);
      container.innerHTML = ""; // remove loading
      let msg = "";
      if (err?.name === "AbortError") {
        msg =
          `AI took too long to respond while loading ${categoryLabel.toLowerCase()} tips. Please try again.`;
      } else {
        msg =
          `Couldn't load ${categoryLabel.toLowerCase()} suggestions: ${
            err?.message || "Unknown error"
          }`;
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
    const lowEndDevice = this.isLowEndDevice();
    const shadowsEnabled = !lowEndDevice;
    const scene = new THREE.Scene();
    const dynamicActors = {
      animals: [],
      clouds: [],
      fireflies: [],
      pondMaterial: null,
    };
    const landGroup = new THREE.Group();
    landGroup.position.set(0, -1.8, 2.3);
    scene.add(landGroup);
    const addToLand = (object) => landGroup.add(object);
    const randRange = (min, max) => Math.random() * (max - min) + min;
    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const noiseSeed = Math.random() * 1000;

    // --- Dynamic sky and grass color based on score ---
    const score = parseInt(
      document.getElementById("sustainability-score")?.textContent || "0"
    );
    const lushGreen = new THREE.Color(0x3cb043);
    const midGreen = new THREE.Color(0x2f8a39);
    const dryBrown = new THREE.Color(0x7b4e2d);
    const deadEarth = new THREE.Color(0x4a3727);
    const bleakSky = new THREE.Color(0x5a5a5a);
    const overcastSky = new THREE.Color(0xadb5bd);
    const brightSky = new THREE.Color(0x7ecbff);

    let skyColor;
    if (score <= 10) {
      skyColor = bleakSky.getHex();
    } else if (score < 50) {
      const t = (score - 10) / 40;
      skyColor = bleakSky.clone().lerp(overcastSky, clamp01(t)).getHex();
    } else if (score > 80) {
      skyColor = brightSky.getHex();
    } else {
      const t = (score - 50) / 30;
      skyColor = overcastSky.clone().lerp(brightSky, clamp01(t)).getHex();
    }

    let grassColorObj;
    if (score >= 80) {
      grassColorObj = lushGreen.clone();
    } else if (score >= 50) {
      const t = (score - 50) / 30;
      grassColorObj = midGreen.clone().lerp(lushGreen, clamp01(t));
    } else {
      const dryness = clamp01((50 - score) / 40);
      grassColorObj = midGreen.clone().lerp(dryBrown, dryness);
      if (score <= 20) {
        const extraDryness = clamp01((20 - score) / 20);
        grassColorObj.lerp(deadEarth, extraDryness);
      }
    }
    const grassColor = grassColorObj.getHex();

    const lushness = clamp01((score - 10) / 90);
    const skyColorObj = new THREE.Color(skyColor);
    scene.background = skyColorObj.clone();

    // Ease off the fog for healthier patches to avoid a gray horizon band
    let fogDensity = 0;
    if (score < 50) {
      const fogFactor = clamp01((50 - score) / 40);
      fogDensity = 0.012 + fogFactor * 0.05;
    }
    scene.fog = fogDensity ? new THREE.FogExp2(skyColorObj, fogDensity) : null;

    // Sky dome (large sphere)
    const skyGeo = new THREE.SphereGeometry(60, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      color: skyColor,
      side: THREE.BackSide,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = -15; // drop skydome so blue fills in behind the land plateau
    scene.add(sky);

    // Sun (large yellow sphere in the sky) - Always present
    const sunGeo = new THREE.SphereGeometry(2.2, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff066 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    const sunPosition = new THREE.Vector3(0, 22, -35);
    sun.position.copy(sunPosition);
    scene.add(sun);
    const sunGlow = new THREE.PointLight(0xfff0a3, 0.55, 120);
    sunGlow.position.copy(sunPosition);
    scene.add(sunGlow);

    const baseCloudCount = score > 70 ? 4 : score > 35 ? 3 : score > 15 ? 2 : 1;
    for (let i = 0; i < baseCloudCount; i++) {
      const cloud = new THREE.Group();
      const puffTotal = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffTotal; p++) {
        const puffGeo = new THREE.SphereGeometry(randRange(0.8, 1.4), 16, 16);
        const puffMat = new THREE.MeshLambertMaterial({
          color: score < 15 ? 0x7b7d86 : score < 30 ? 0xd2dae2 : 0xffffff,
        });
        const puff = new THREE.Mesh(puffGeo, puffMat);
        puff.position.set(
          randRange(-1.2, 1.2),
          randRange(-0.3, 0.4),
          randRange(-0.4, 0.4)
        );
        cloud.add(puff);
      }
      const cloudHeight = score < 20 ? randRange(8, 11) : randRange(10, 16);
      cloud.position.set(randRange(-14, 14), cloudHeight, randRange(-8, 8));
      scene.add(cloud);
      dynamicActors.clouds.push({
        mesh: cloud,
        speed: score < 20 ? randRange(0.001, 0.003) : randRange(0.004, 0.008),
        offset: Math.random() * Math.PI * 2,
      });
    }

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 8.5, 21.8);
    camera.lookAt(0, 1.5, 2.3);

    const skyBackdrop = new THREE.Group();
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: score > 70 ? 0.08 : 0.04,
      depthWrite: false,
    });
    for (let i = 0; i < 3; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(65, 12), rayMat);
      ray.position.set(0, 18 + i * 4, -32 - i * 2);
      ray.rotation.set(-0.2 - i * 0.08, 0, (i - 1) * 0.2);
      skyBackdrop.add(ray);
    }
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfff7c0,
      transparent: false,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(0, 4, 64), haloMat);
    halo.position.copy(
      sun.position.clone().add(new THREE.Vector3(0, -16, 0.5))
    );
    halo.lookAt(camera.position);
    skyBackdrop.add(halo);
    scene.add(skyBackdrop);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !lowEndDevice,
      alpha: true,
      powerPreference: lowEndDevice ? "low-power" : "high-performance",
    });
    renderer.setClearColor(skyColorObj, 1);
    renderer.setSize(width, height);
    const pixelRatio = window.devicePixelRatio || 1;
    const cappedPixelRatio = lowEndDevice
      ? Math.min(pixelRatio, 1.25)
      : pixelRatio;
    renderer.setPixelRatio(cappedPixelRatio);
    renderer.shadowMap.enabled = shadowsEnabled;
    if (shadowsEnabled && THREE.PCFSoftShadowMap) {
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    if (renderer.outputEncoding !== undefined && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    } else if (
      renderer.outputColorSpace !== undefined &&
      THREE.SRGBColorSpace !== undefined
    ) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    if (THREE.ACESFilmicToneMapping && renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
    }
    container.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.45 + lushness * 0.35);
    scene.add(ambient);
    const hemiLight = new THREE.HemisphereLight(
      0xdde7ff,
      0x3c4a2d,
      0.3 + lushness * 0.2
    );
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.copy(sunPosition.clone().add(new THREE.Vector3(0, 0, 8)));
    dirLight.target.position.set(0, 0, 0);
    scene.add(dirLight.target);
    dirLight.castShadow = shadowsEnabled;
    if (shadowsEnabled) {
      dirLight.shadow.mapSize.set(1024, 1024);
      dirLight.shadow.camera.near = 5;
      dirLight.shadow.camera.far = 80;
      dirLight.shadow.camera.left = -40;
      dirLight.shadow.camera.right = 40;
      dirLight.shadow.camera.top = 40;
      dirLight.shadow.camera.bottom = -40;
    }
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xfff0c2, 0.35);
    fillLight.position.set(-18, 9, -14);
    scene.add(fillLight);

    // Ground foundation and rounded plateau
    const plateauGeo = new THREE.CylinderGeometry(13.3, 16.2, 2.1, 96, 6);
    const plateauPositions = plateauGeo.attributes.position;
    for (let i = 0; i < plateauPositions.count; i++) {
      const y = plateauPositions.getY(i);
      if (y < 0.5) continue;
      const x = plateauPositions.getX(i);
      const z = plateauPositions.getZ(i);
      const radius = Math.sqrt(x * x + z * z);
      const rimAttenuation = clamp01(1 - radius / 13.5);
      const undulation =
        Math.sin((x + noiseSeed) * 0.35) * 0.11 +
        Math.cos((z - noiseSeed) * 0.28) * 0.08;
      plateauPositions.setY(
        i,
        y + undulation * rimAttenuation * (0.35 + lushness * 0.25)
      );
    }
    plateauGeo.computeVertexNormals();
    const plateauMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(grassColor).lerp(
        new THREE.Color(0x6d6347),
        0.25 * (1 - lushness)
      ),
      roughness: 0.75 - lushness * 0.2,
      metalness: 0.04,
    });
    const plateau = new THREE.Mesh(plateauGeo, plateauMat);
    plateau.position.y = -0.6;
    plateau.castShadow = true;
    plateau.receiveShadow = true;
    addToLand(plateau);

    // Skip heavy bases/rims so only the plateau surface renders

    // Rocks (remains same color) - Always present
    for (let i = 0; i < 7; i++) {
      const rockGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.4);
      const rockMat = new THREE.MeshStandardMaterial({
        color: 0x7c7c7c,
        roughness: 0.9,
        metalness: 0.05,
      });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const angle = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 4;
      rock.position.set(
        Math.cos(angle) * r,
        score <= 15 ? -0.35 : -0.2,
        Math.sin(angle) * r
      );
      rock.rotation.y = Math.random() * Math.PI;
      rock.castShadow = true;
      rock.receiveShadow = true;
      addToLand(rock);
    }

    const scatterAnimalRemains = (count) => {
      const buildLongBone = (material) => {
        const bone = new THREE.Group();
        const shaftHeight = 1.8 + Math.random() * 0.8;
        const topRadius = 0.16 + Math.random() * 0.03;
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(
            topRadius * 0.85,
            topRadius,
            shaftHeight,
            10
          ),
          material
        );
        bone.add(shaft);
        const endGeo = new THREE.SphereGeometry(
          0.25 + Math.random() * 0.05,
          14,
          12
        );
        const endTop = new THREE.Mesh(endGeo, material);
        endTop.position.y = shaftHeight / 2;
        const endBottom = endTop.clone();
        endBottom.position.y = -shaftHeight / 2;
        bone.add(endTop);
        bone.add(endBottom);
        return { mesh: bone, lift: 0.03 };
      };

      const buildRibSection = (material) => {
        const ribs = new THREE.Group();
        const ribPairs = 5 + Math.floor(Math.random() * 3);
        const ribSpacing = 0.23 + Math.random() * 0.05;
        const ribDepth = 1.55 + Math.random() * 0.3;
        const ribSpread = 0.9 + Math.random() * 0.3;
        const baseHeight = -0.52 + Math.random() * 0.08;
        const sternumTilt = THREE.MathUtils.degToRad(12 + Math.random() * 6);

        const cartilageMaterial = material.clone();
        cartilageMaterial.color = material.color
          ? material.color.clone().lerp(new THREE.Color(0xf4dfc4), 0.6)
          : new THREE.Color(0xf4dfc4);
        cartilageMaterial.roughness = Math.max(0.3, material.roughness - 0.15);
        cartilageMaterial.metalness = Math.max(0.02, material.metalness * 0.5);

        const taperTubeGeometry = (geometry) => {
          const radialSegments = geometry.parameters.radialSegments;
          const tubularSegments = geometry.parameters.tubularSegments;
          const ringSize = radialSegments + 1;
          const center = new THREE.Vector3();
          const offset = new THREE.Vector3();

          for (let ring = 0; ring <= tubularSegments; ring++) {
            center.set(0, 0, 0);
            const start = ring * ringSize;
            const end = start + ringSize;

            for (let i = start; i < end; i++) {
              center.x += geometry.attributes.position.getX(i);
              center.y += geometry.attributes.position.getY(i);
              center.z += geometry.attributes.position.getZ(i);
            }
            center.multiplyScalar(1 / ringSize);

            const t = ring / tubularSegments;
            const taper = THREE.MathUtils.lerp(1, 0.32, Math.pow(t, 1.6));

            for (let i = start; i < end; i++) {
              offset.set(
                geometry.attributes.position.getX(i) - center.x,
                geometry.attributes.position.getY(i) - center.y,
                geometry.attributes.position.getZ(i) - center.z
              );
              offset.multiplyScalar(taper);
              geometry.attributes.position.setXYZ(
                i,
                center.x + offset.x,
                center.y + offset.y,
                center.z + offset.z
              );
            }
          }

          geometry.attributes.position.needsUpdate = true;
          geometry.computeVertexNormals();
        };

        const buildRibPair = (direction, pairIndex) => {
          const height = baseHeight + pairIndex * ribSpacing;
          const archLift = 0.32 + pairIndex * 0.05;
          const forwardReach = ribDepth - pairIndex * 0.03;
          const outwardReach = ribSpread + pairIndex * 0.12;
          const tipDrop = -0.08 - pairIndex * 0.015;

          const curvePoints = [
            new THREE.Vector3(0, height - 0.04, -0.18),
            new THREE.Vector3(
              direction * outwardReach * 0.45,
              height + archLift,
              forwardReach * 0.3
            ),
            new THREE.Vector3(
              direction * outwardReach,
              height + archLift * 0.65,
              forwardReach * 0.68
            ),
            new THREE.Vector3(direction * 0.12, height + tipDrop, forwardReach),
          ];
          const curve = new THREE.CatmullRomCurve3(curvePoints);
          const ribRadius = 0.055 + pairIndex * 0.008;

          const ribGeometry = new THREE.TubeGeometry(
            curve,
            48,
            ribRadius,
            16,
            false
          );
          taperTubeGeometry(ribGeometry);
          const ribBone = new THREE.Mesh(ribGeometry, material);
          ribBone.rotation.y +=
            direction * THREE.MathUtils.degToRad(2.5 + pairIndex * 0.4);

          const cartilageLength = 0.24 + Math.random() * 0.1;
          const cartilage = new THREE.Mesh(
            new THREE.CylinderGeometry(
              ribRadius * 0.9,
              ribRadius * 0.6,
              cartilageLength,
              10
            ),
            cartilageMaterial
          );
          const tip = curve.getPoint(0.98);
          cartilage.position.copy(
            tip.clone().add(new THREE.Vector3(0, 0, cartilageLength * 0.25))
          );
          cartilage.rotation.x = Math.PI / 2.1;
          cartilage.rotation.z = direction > 0 ? Math.PI / 2 : -Math.PI / 2;

          const ribGroup = new THREE.Group();
          ribGroup.add(ribBone);
          ribGroup.add(cartilage);
          return ribGroup;
        };

        for (let pairIndex = 0; pairIndex < ribPairs; pairIndex++) {
          ribs.add(buildRibPair(-1, pairIndex));
          ribs.add(buildRibPair(1, pairIndex));
        }

        const spineLength = ribPairs * ribSpacing + 0.45;
        const spineCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.06, baseHeight - 0.4, -0.28),
          new THREE.Vector3(-0.02, baseHeight + spineLength * 0.4, -0.08),
          new THREE.Vector3(0.02, baseHeight + spineLength * 0.8, 0.22),
        ]);
        const spine = new THREE.Mesh(
          new THREE.TubeGeometry(spineCurve, 36, 0.09, 14, false),
          material
        );
        ribs.add(spine);

        const vertebraCount = Math.max(3, ribPairs - 1);
        for (let v = 0; v < vertebraCount; v++) {
          const t = v / (vertebraCount - 1 || 1);
          const pos = spineCurve.getPoint(Math.min(t, 0.98));
          const vertebra = new THREE.Mesh(
            new THREE.SphereGeometry(0.09 + Math.random() * 0.03, 12, 10),
            material
          );
          vertebra.position.copy(pos);
          vertebra.rotation.z = THREE.MathUtils.degToRad(Math.random() * 6);
          ribs.add(vertebra);
        }

        const sternumHeight = spineLength * 0.85;
        const sternum = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, sternumHeight, 0.22),
          cartilageMaterial
        );
        sternum.position.set(
          0,
          baseHeight + sternumHeight * 0.5 - 0.2,
          ribDepth * 0.92
        );
        sternum.rotation.x = sternumTilt;
        ribs.add(sternum);

        ribs.rotation.y = THREE.MathUtils.degToRad((Math.random() - 0.5) * 14);
        ribs.rotation.x = THREE.MathUtils.degToRad(-10 + Math.random() * 8);

        const scale = 1.25 + Math.random() * 0.25;
        ribs.scale.set(scale, scale, scale);

        return { mesh: ribs, lift: 0.22 };
      };

      const buildSkull = (material) => {
        const skull = new THREE.Group();
        const cranium = new THREE.Mesh(
          new THREE.SphereGeometry(0.36 + Math.random() * 0.08, 18, 16),
          material
        );
        cranium.scale.set(1.1, 0.9, 1.2);
        cranium.position.y = 0.21;
        skull.add(cranium);

        const snout = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.2, 0.45),
          material
        );
        snout.position.set(0, 0.02, 0.28);
        skull.add(snout);

        const jaw = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.38, 12),
          material
        );
        jaw.scale.set(1.2, 1, 1);
        jaw.rotation.x = Math.PI / 2;
        jaw.position.set(0, -0.12, 0.24);
        skull.add(jaw);

        const socketGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12);
        const socketMat = new THREE.MeshStandardMaterial({
          color: 0x1b1b1b,
          roughness: 0.45,
        });
        const socketLeft = new THREE.Mesh(socketGeo, socketMat);
        socketLeft.rotation.x = Math.PI / 2;
        socketLeft.position.set(-0.11, 0.15, 0.08);
        skull.add(socketLeft);
        const socketRight = socketLeft.clone();
        socketRight.position.x = 0.11;
        skull.add(socketRight);

        const hornGeo = new THREE.ConeGeometry(0.09, 0.35, 12);
        const hornLeft = new THREE.Mesh(hornGeo, material);
        hornLeft.position.set(-0.26, 0.32, -0.02);
        hornLeft.rotation.set(Math.PI / 2.3, 0.2, Math.PI / 10);
        skull.add(hornLeft);
        const hornRight = hornLeft.clone();
        hornRight.position.x = 0.26;
        hornRight.rotation.y = -0.2;
        skull.add(hornRight);

        return { mesh: skull, lift: 0.22 };
      };

      const buildSpineScatter = (material) => {
        const spine = new THREE.Group();
        const vertebraCount = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < vertebraCount; i++) {
          const vertebra = new THREE.Mesh(
            new THREE.TorusGeometry(0.18 + Math.random() * 0.05, 0.05, 12, 24),
            material
          );
          vertebra.rotation.x = Math.PI / 2;
          vertebra.position.y = -0.15 + i * 0.12;
          spine.add(vertebra);
        }
        const connector = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, vertebraCount * 0.12, 8),
          material
        );
        connector.rotation.z = Math.PI / 2;
        spine.add(connector);
        return { mesh: spine, lift: 0.05 };
      };

      for (let i = 0; i < count; i++) {
        const boneColor = new THREE.Color(0xd9ccb1).lerp(
          new THREE.Color(0xb9a989),
          Math.random() * 0.35
        );
        const material = new THREE.MeshStandardMaterial({
          color: boneColor,
          roughness: 0.68 + Math.random() * 0.1,
          metalness: 0.05,
        });

        const roll = Math.random();
        let bonePiece;
        if (roll < 0.35) {
          bonePiece = buildLongBone(material);
        } else if (roll < 0.65) {
          bonePiece = buildRibSection(material);
        } else if (roll < 0.9) {
          bonePiece = buildSkull(material);
        } else {
          bonePiece = buildSpineScatter(material);
        }

        const { mesh, lift = 0 } = bonePiece;
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.5 + Math.random() * 8.5;
        mesh.position.set(
          Math.cos(angle) * radius,
          -0.61 + lift + randRange(-0.02, 0.04),
          Math.sin(angle) * radius
        );
        mesh.rotation.y = randRange(-Math.PI, Math.PI);
        mesh.rotation.x += randRange(-0.2, 0.2);
        mesh.rotation.z += randRange(-0.15, 0.15);
        mesh.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        addToLand(mesh);
      }
    };

    if (score < 20) {
      if (score <= 10) {
        const burntPatchCount = 2;
        for (let i = 0; i < burntPatchCount; i++) {
          const ashGeo = new THREE.CircleGeometry(randRange(3, 5), 32);
          const ashMat = new THREE.MeshStandardMaterial({
            color: 0x2f241f,
            roughness: 0.95,
            transparent: true,
            opacity: 0.85,
          });
          const ash = new THREE.Mesh(ashGeo, ashMat);
          ash.rotation.x = -Math.PI / 2;
          ash.position.set(randRange(-4, 4), -0.65, randRange(-4, 4));
          ash.receiveShadow = true;
          addToLand(ash);
        }
      }

      scatterAnimalRemains(score <= 10 ? 9 : 5);
    }

    // NEW: Only add the following ecosystem elements if the score is above 10
    if (score > 10) {
      // Sculpted dirt clearing at the center
      const dirtGeo = new THREE.CircleGeometry(4.8, 48);
      const dirtMat = new THREE.MeshStandardMaterial({
        color: 0xcab28f,
        roughness: 0.82,
        metalness: 0.05,
      });
      const dirt = new THREE.Mesh(dirtGeo, dirtMat);
      dirt.rotation.x = -Math.PI / 2;
      dirt.position.y = -0.62;
      dirt.receiveShadow = true;
      addToLand(dirt);

      if (score > 60) {
        const dampSoil = new THREE.Mesh(
          new THREE.RingGeometry(3.5, 5.1, 32),
          new THREE.MeshStandardMaterial({
            color: 0x8b7f64,
            side: THREE.DoubleSide,
            roughness: 0.7,
            metalness: 0.08,
          })
        );
        dampSoil.rotation.x = Math.PI / 2;
        dampSoil.position.y = -0.61;
        addToLand(dampSoil);
      }

      // NEW: Add dead grass bushes and logs for scores below 30
      if (score < 30) {
        const logCount = 4;
        for (let i = 0; i < logCount; i++) {
          const angle = (i / logCount) * Math.PI * 2 + Math.random() * 0.2;
          const x = Math.cos(angle) * (8 + Math.random() * 4);
          const z = Math.sin(angle) * (8 + Math.random() * 4);
          const trunkHeight = 2 + Math.random() + score / 30;
          const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, trunkHeight, 8);
          const trunkMat = new THREE.MeshStandardMaterial({
            color: score < 30 ? 0x6b4f2a : 0x8b5a2b,
            roughness: 0.85,
          });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(x, trunkHeight / 2 - 1, z);
          if (score < 20) trunk.rotation.z = (90 * Math.PI) / 180;
          trunk.castShadow = true;
          trunk.receiveShadow = true;
          addToLand(trunk);
        }
      }

      // Dense instanced grass for realism
      const grassBladeCount = Math.floor(200 + lushness * 650);
      if (grassBladeCount > 0) {
        const bladeHeight = 0.6 + lushness * 0.55;
        const bladeGeo = new THREE.ConeGeometry(0.05, bladeHeight, 5);
        bladeGeo.translate(0, bladeHeight / 2, 0);
        const bladeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(grassColor).lerp(
            new THREE.Color(0xeafde4),
            0.2
          ),
          roughness: 0.6,
          metalness: 0.05,
        });
        if (THREE.InstancedMesh) {
          const blades = new THREE.InstancedMesh(
            bladeGeo,
            bladeMat,
            grassBladeCount
          );
          const dummy = new THREE.Object3D();
          let placed = 0;
          while (placed < grassBladeCount) {
            const radius = Math.random() * 10.5;
            if (radius < 1.2) continue;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            dummy.position.set(x, -0.55, z);
            dummy.rotation.y = Math.random() * Math.PI;
            dummy.scale.setScalar(0.6 + Math.random() * 0.7);
            dummy.updateMatrix();
            blades.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
          blades.castShadow = true;
          addToLand(blades);
        } else {
          for (let i = 0; i < Math.min(grassBladeCount, 200); i++) {
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 10.5;
            blade.position.set(
              Math.cos(angle) * radius,
              -0.55,
              Math.sin(angle) * radius
            );
            blade.rotation.y = Math.random() * Math.PI;
            blade.castShadow = true;
            addToLand(blade);
          }
        }
      }

      // Add reflective pond for healthier patches
      if (score > 45) {
        const pondGeo = new THREE.CircleGeometry(2.5 + score / 50, 48);
        const pondMat = new THREE.MeshPhysicalMaterial({
          color: 0x73c6ff,
          transparent: true,
          opacity: 0.9,
          roughness: 0.05,
          metalness: 0.1,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
        });
        const pond = new THREE.Mesh(pondGeo, pondMat);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(-3.2, -0.59, 2.3);
        pond.receiveShadow = true;
        addToLand(pond);
        dynamicActors.pondMaterial = pondMat;

        for (let i = 0; i < 8; i++) {
          const reedGeo = new THREE.CylinderGeometry(
            0.05,
            0.08,
            1 + Math.random() * 0.4,
            6
          );
          const reedMat = new THREE.MeshLambertMaterial({ color: 0x5a6f3a });
          const reed = new THREE.Mesh(reedGeo, reedMat);
          const angle = Math.random() * Math.PI * 2;
          const radius = 2.2 + Math.random() * 0.6;
          reed.position.set(
            -3.2 + Math.cos(angle) * radius * 0.5,
            -0.1,
            2.3 + Math.sin(angle) * radius * 0.5
          );
          reed.castShadow = true;
          addToLand(reed);
        }

        const lilyCount = score > 70 ? 12 : 6;
        for (let i = 0; i < lilyCount; i++) {
          const lilyGeo = new THREE.CircleGeometry(randRange(0.22, 0.4), 16);
          const lilyMat = new THREE.MeshStandardMaterial({
            color: score > 70 ? 0xb8f2c8 : 0x9bd7ff,
            side: THREE.DoubleSide,
            roughness: 0.4,
            metalness: 0.05,
          });
          const lily = new THREE.Mesh(lilyGeo, lilyMat);
          lily.rotation.x = -Math.PI / 2;
          const angle = Math.random() * Math.PI * 2;
          const radius = randRange(0.4, 1.1);
          lily.position.set(
            -3.2 + Math.cos(angle) * radius,
            -0.58 + Math.random() * 0.02,
            2.3 + Math.sin(angle) * radius
          );
          lily.receiveShadow = true;
          addToLand(lily);

          if (Math.random() > 0.65) {
            const bloomGeo = new THREE.SphereGeometry(0.08, 8, 8);
            const bloomMat = new THREE.MeshStandardMaterial({
              color: 0xffe4a3,
              emissive: score > 80 ? 0xfff3c4 : 0x0,
              emissiveIntensity: score > 80 ? 0.2 : 0,
            });
            const bloom = new THREE.Mesh(bloomGeo, bloomMat);
            bloom.position.set(0, 0.04, 0);
            bloom.castShadow = true;
            lily.add(bloom);
          }
        }
      }

      // Flowers (dull or vibrant based on score)
      const flowerBaseColor = score < 30 ? 0x909090 : 0x4caf50;
      const petalBaseColor = score < 30 ? 0xcccccc : 0xffc0cb;
      for (let i = 0; i < 10; i++) {
        const flowerGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8);
        const flowerMat = new THREE.MeshStandardMaterial({
          color: flowerBaseColor,
          roughness: 0.4,
        });
        const stem = new THREE.Mesh(flowerGeo, flowerMat);
        const angle = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 6;
        stem.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        stem.castShadow = true;
        // Petal
        const petalGeo = new THREE.SphereGeometry(0.18, 10, 10);
        const petalMat = new THREE.MeshStandardMaterial({
          color: petalBaseColor,
          roughness: 0.2,
          metalness: 0.05,
        });
        const petal = new THREE.Mesh(petalGeo, petalMat);
        petal.position.set(0, 0.3, 0);
        petal.castShadow = true;
        stem.add(petal);
        addToLand(stem);
      }

      if (score > 90) {
        const accentColors = [0xff8fab, 0xffc872, 0x9bf6ff, 0xb388eb];
        const glowColors = [0xfff5d6, 0xfff0ff];
        const patchCount = 4;
        for (let i = 0; i < patchCount; i++) {
          const patch = new THREE.Group();
          const clusterSize = 3 + Math.floor(Math.random() * 4);
          const baseRadius = randRange(3, 8.5);
          const baseAngle = Math.random() * Math.PI * 2;
          const baseX = Math.cos(baseAngle) * baseRadius;
          const baseZ = Math.sin(baseAngle) * baseRadius;

          for (let j = 0; j < clusterSize; j++) {
            const offsetX = randRange(-0.5, 0.5);
            const offsetZ = randRange(-0.5, 0.5);
            const stalkHeight = 0.45 + Math.random() * 0.35;
            const stalk = new THREE.Mesh(
              new THREE.CylinderGeometry(0.04, 0.05, stalkHeight, 6),
              new THREE.MeshStandardMaterial({
                color: 0x3d8c40,
                roughness: 0.5,
              })
            );
            stalk.position.set(
              baseX + offsetX,
              stalkHeight / 2 - 0.05,
              baseZ + offsetZ
            );
            stalk.castShadow = true;

            const blossom = new THREE.Mesh(
              new THREE.SphereGeometry(0.16 + Math.random() * 0.05, 12, 12),
              new THREE.MeshStandardMaterial({
                color:
                  accentColors[Math.floor(Math.random() * accentColors.length)],
                roughness: 0.3,
                metalness: 0.08,
              })
            );
            blossom.position.y = stalkHeight / 2 + 0.05;
            blossom.castShadow = true;
            stalk.add(blossom);

            if (Math.random() > 0.6) {
              const glow = new THREE.Mesh(
                new THREE.CircleGeometry(0.28, 12),
                new THREE.MeshBasicMaterial({
                  color:
                    glowColors[Math.floor(Math.random() * glowColors.length)],
                  transparent: true,
                  opacity: 0.45,
                  side: THREE.DoubleSide,
                  depthWrite: false,
                })
              );
              glow.rotation.x = -Math.PI / 2;
              glow.position.set(0, -stalkHeight / 2 + 0.05, 0);
              stalk.add(glow);
            }

            patch.add(stalk);
          }

          addToLand(patch);
        }
      }

      // Trees with varied foliage
      const densityBonus = score > 80 ? 5 : score > 60 ? 3 : score > 45 ? 1 : 0;
      const treeCount = Math.max(0, Math.floor(score / 18) + densityBonus);
      const saplingCount =
        score > 20 ? Math.min(10, Math.floor((score - 15) / 8)) : 0;
      const shrubCount = score > 25 ? Math.min(14, Math.floor(score / 7)) : 0;
      const mutedGreen = new THREE.Color(0x4b5a2a);
      const balancedGreen = new THREE.Color(0x3f7d2c);
      const lushGreenTone = new THREE.Color(0x18a02c);
      let leafColorObj;
      if (score < 30) {
        const t = clamp01(score / 30);
        leafColorObj = mutedGreen.clone().lerp(balancedGreen, t);
      } else {
        const t = clamp01((score - 30) / 50);
        leafColorObj = balancedGreen.clone().lerp(lushGreenTone, t);
      }
      const leafColor = leafColorObj.getHex();

      // Helper factories keep code manageable while adding new tree silhouettes
      const strugglingTreeFactory = (group) => {
        const trunkHeight = 1 + Math.random() * 0.9 + score / 35;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.4, trunkHeight, 8),
          new THREE.MeshStandardMaterial({
            color: 0x6b4f2a,
            roughness: 0.85,
          })
        );
        trunk.position.y = trunkHeight / 2 - 1;
        trunk.rotation.y = Math.random() * Math.PI;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(
            0.8 + Math.random() * 0.4,
            1.3 + Math.random() * 0.4,
            8
          ),
          new THREE.MeshStandardMaterial({
            color: leafColorObj.clone().lerp(new THREE.Color(0x375020), 0.4),
            roughness: 0.7,
          })
        );
        leaves.position.y = trunkHeight - 0.7;
        leaves.scale.set(0.8, 0.7 + Math.random() * 0.3, 0.8);
        leaves.castShadow = true;
        group.add(leaves);
      };

      const buildConifer = (group) => {
        const trunkHeight = 1.6 + Math.random() * 1 + score / 40;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.34, trunkHeight, 8),
          new THREE.MeshStandardMaterial({
            color: 0x7d502b,
            roughness: 0.78,
          })
        );
        trunk.position.y = trunkHeight / 2 - 1;
        trunk.rotation.y = Math.random() * Math.PI;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const pineLayers = 3 + Math.floor(Math.random() * 2);
        for (let j = 0; j < pineLayers; j++) {
          const leaves = new THREE.Mesh(
            new THREE.ConeGeometry(
              0.9 + Math.random() * 0.4,
              1.4 + Math.random() * 0.6,
              10
            ),
            new THREE.MeshStandardMaterial({
              color: leafColorObj
                .clone()
                .lerp(new THREE.Color(0x0c6a2b), 0.2 + j * 0.05),
              roughness: 0.55,
            })
          );
          leaves.position.y = trunkHeight - 0.4 + j * 0.55;
          leaves.rotation.y = Math.random() * Math.PI;
          leaves.castShadow = true;
          group.add(leaves);
        }
      };

      const buildBroadleaf = (group) => {
        const trunkHeight = 1.2 + Math.random() * 0.8 + score / 45;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.4, trunkHeight, 8),
          new THREE.MeshStandardMaterial({
            color: 0x7d502b,
            roughness: 0.78,
          })
        );
        trunk.position.y = trunkHeight / 2 - 1;
        trunk.rotation.y = Math.random() * Math.PI;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const canopy = new THREE.Group();
        const clumpCount = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < clumpCount; j++) {
          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.9 + Math.random() * 0.4, 14, 14),
            new THREE.MeshStandardMaterial({
              color: leafColorObj
                .clone()
                .lerp(new THREE.Color(0x6fbf4a), Math.random() * 0.25),
              roughness: 0.58,
            })
          );
          sphere.position.set(
            randRange(-0.4, 0.4),
            trunkHeight - 0.2 + randRange(-0.1, 0.5),
            randRange(-0.4, 0.4)
          );
          sphere.castShadow = true;
          canopy.add(sphere);
        }
        group.add(canopy);
      };

      const buildBirch = (group) => {
        const trunkHeight = 1.4 + Math.random() * 0.9 + score / 55;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.22, trunkHeight, 12),
          new THREE.MeshStandardMaterial({
            color: 0xf7f7f0,
            roughness: 0.45,
          })
        );
        trunk.position.y = trunkHeight / 2 - 1;
        trunk.rotation.y = Math.random() * Math.PI;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const tuftCount = 4 + Math.floor(Math.random() * 2);
        for (let j = 0; j < tuftCount; j++) {
          const tuft = new THREE.Mesh(
            new THREE.SphereGeometry(0.7 + Math.random() * 0.3, 12, 12),
            new THREE.MeshStandardMaterial({
              color: leafColorObj
                .clone()
                .lerp(new THREE.Color(0x8ed081), 0.35 + Math.random() * 0.25),
              roughness: 0.5,
            })
          );
          tuft.position.set(
            randRange(-0.2, 0.2),
            trunkHeight - 0.3 + randRange(-0.1, 0.4),
            randRange(-0.2, 0.2)
          );
          tuft.castShadow = true;
          group.add(tuft);
        }
      };

      const buildPalm = (group) => {
        const trunkHeight = 2 + Math.random() * 1 + score / 50;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.26, trunkHeight, 10),
          new THREE.MeshStandardMaterial({
            color: 0x8d5a2e,
            roughness: 0.6,
          })
        );
        trunk.position.y = trunkHeight / 2 - 1;
        trunk.rotation.y = Math.random() * Math.PI;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const buildFrond = () => {
          const geometry = new THREE.PlaneGeometry(0.65, 1.9, 4, 10);
          const pos = geometry.attributes.position;
          for (let v = 0; v < pos.count; v++) {
            const y = pos.getY(v);
            const t = (y + 0.95) / 1.9; // 0 at base, 1 at tip
            const taper = 1 - t * 0.8;
            pos.setX(v, pos.getX(v) * (0.6 + taper * 0.4));
            pos.setZ(v, Math.sin(t * Math.PI) * 0.12);
            pos.setY(v, y + t * 0.2);
          }
          geometry.translate(0, 0.95, 0);
          geometry.computeVertexNormals();
          return geometry;
        };

        const crown = new THREE.Group();
        const crownHeight = trunkHeight - 1 + 0.05;
        crown.position.y = crownHeight;
        group.add(crown);

        const frondCount = 6 + Math.floor(Math.random() * 2);
        for (let j = 0; j < frondCount; j++) {
          const frondMat = new THREE.MeshStandardMaterial({
            color: leafColorObj
              .clone()
              .lerp(new THREE.Color(0x3eb489), 0.25 + Math.random() * 0.25),
            side: THREE.DoubleSide,
            roughness: 0.45,
          });
          const frond = new THREE.Mesh(buildFrond(), frondMat);
          frond.castShadow = true;
          frond.rotation.x = -Math.PI / 3.1 + Math.random() * 0.2;
          frond.rotation.z = randRange(-0.2, 0.2);

          const frondPivot = new THREE.Group();
          frondPivot.rotation.y =
            (Math.PI * 2 * j) / frondCount + randRange(-0.1, 0.1);
          frondPivot.rotation.x = randRange(-0.08, 0.08);
          frond.position.set(0, 0, 0);
          frondPivot.add(frond);
          crown.add(frondPivot);
        }

        const crownCore = new THREE.Mesh(
          new THREE.SphereGeometry(0.22 + Math.random() * 0.08, 10, 10),
          new THREE.MeshStandardMaterial({
            color: leafColorObj
              .clone()
              .lerp(new THREE.Color(0x6abf74), 0.35 + Math.random() * 0.15),
            roughness: 0.5,
          })
        );
        crownCore.castShadow = true;
        crown.add(crownCore);
      };

      const buildBlooming = (group) => {
        const trunkHeight = 1.3 + Math.random() * 0.8 + score / 60;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.32, trunkHeight, 10),
          new THREE.MeshStandardMaterial({
            color: 0x6f4430,
            roughness: 0.7,
          })
        );
        trunk.position.y = trunkHeight / 2 - 1;
        trunk.rotation.y = Math.random() * Math.PI;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        const blossomColors = [0xa8f0ad, 0x8be29d, 0xc6ffb5];
        const canopyLayers = 2 + Math.floor(Math.random() * 2);
        for (let j = 0; j < canopyLayers; j++) {
          const blossom = new THREE.Mesh(
            new THREE.SphereGeometry(0.8 + Math.random() * 0.3, 12, 12),
            new THREE.MeshStandardMaterial({
              color:
                blossomColors[Math.floor(Math.random() * blossomColors.length)],
              emissive: score > 85 ? 0xbfffc1 : 0x0,
              emissiveIntensity: score > 85 ? 0.08 : 0,
            })
          );
          blossom.position.set(
            randRange(-0.25, 0.25),
            trunkHeight - 0.1 + j * 0.6,
            randRange(-0.25, 0.25)
          );
          blossom.castShadow = true;
          group.add(blossom);
        }
      };

      const availableTreeTypes = ["broadleaf"];
      if (score > 55) availableTreeTypes.push("conifer");
      if (score > 40) availableTreeTypes.push("birch");
      if (score > 65) availableTreeTypes.push("palm");
      if (score > 70) availableTreeTypes.push("blooming");

      for (let i = 0; i < treeCount; i++) {
        const angle =
          (i / Math.max(treeCount, 1)) * Math.PI * 2 + Math.random() * 0.2;
        const distance = 8 + Math.random() * 4;
        const treeGroup = new THREE.Group();
        treeGroup.position.set(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        );
        addToLand(treeGroup);

        if (score < 30) {
          strugglingTreeFactory(treeGroup);
          continue;
        }

        const treeType =
          availableTreeTypes[
            Math.floor(Math.random() * availableTreeTypes.length)
          ] || "broadleaf";
        switch (treeType) {
          case "conifer":
            buildConifer(treeGroup);
            break;
          case "birch":
            buildBirch(treeGroup);
            break;
          case "palm":
            buildPalm(treeGroup);
            break;
          case "blooming":
            buildBlooming(treeGroup);
            break;
          default:
            buildBroadleaf(treeGroup);
        }
      }

      if (saplingCount) {
        for (let i = 0; i < saplingCount; i++) {
          const saplingHeight = 0.7 + Math.random() * 0.6;
          const sapling = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.16, saplingHeight, 6),
            new THREE.MeshStandardMaterial({
              color: 0x7a4a2b,
              roughness: 0.85,
            })
          );
          const radius = randRange(2, 6);
          const theta = Math.random() * Math.PI * 2;
          sapling.position.set(
            Math.cos(theta) * radius,
            saplingHeight / 2 - 0.9,
            Math.sin(theta) * radius
          );
          sapling.castShadow = true;
          sapling.receiveShadow = true;
          addToLand(sapling);

          const saplingLeaves = new THREE.Mesh(
            new THREE.SphereGeometry(0.35 + Math.random() * 0.15, 8, 8),
            new THREE.MeshStandardMaterial({
              color: leafColor,
              roughness: 0.6,
            })
          );
          saplingLeaves.position.y = saplingHeight / 2;
          sapling.add(saplingLeaves);
        }
      }

      if (shrubCount) {
        for (let i = 0; i < shrubCount; i++) {
          const shrub = new THREE.Group();
          const moundCount = 2 + Math.floor(Math.random() * 3);
          const shrubColor = score < 40 ? 0x8a7c6f : 0x2f7d32;
          for (let m = 0; m < moundCount; m++) {
            const mound = new THREE.Mesh(
              new THREE.SphereGeometry(randRange(0.3, 0.55), 12, 12),
              new THREE.MeshStandardMaterial({
                color: shrubColor,
                roughness: 0.65,
              })
            );
            mound.position.set(
              randRange(-0.25, 0.25),
              -0.5 + randRange(0, 0.15),
              randRange(-0.25, 0.25)
            );
            mound.castShadow = true;
            shrub.add(mound);
          }

          if (Math.random() < (score > 65 ? 0.4 : 0.2)) {
            const bloom = new THREE.Mesh(
              new THREE.SphereGeometry(0.12, 8, 8),
              new THREE.MeshStandardMaterial({
                color: score > 65 ? 0xffc8dd : 0xf0e5d3,
                emissive: score > 85 ? 0xfff1f1 : 0x0,
                emissiveIntensity: score > 85 ? 0.1 : 0,
              })
            );
            bloom.position.set(0, -0.18, 0);
            shrub.add(bloom);
          }

          const radius = randRange(3, 9);
          const theta = Math.random() * Math.PI * 2;
          shrub.position.set(
            Math.cos(theta) * radius,
            0,
            Math.sin(theta) * radius
          );
          shrub.castShadow = true;
          addToLand(shrub);
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

      const animals = dynamicActors.animals;
      for (let i = 0; i < animalCount; i++) {
        if (Math.random() < 0.5) {
          // Bird
          const bird = new THREE.Group();
          const bodyGeo = new THREE.SphereGeometry(0.25, 8, 8);
          const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2196f3 });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.castShadow = true;
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
          addToLand(bird);
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
          rabbit.castShadow = true;
          addToLand(rabbit);
          animals.push({
            mesh: rabbit,
            type: "rabbit",
            baseY: rabbit.position.y,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }

      const fireflyCount = score > 75 ? 12 : score > 55 ? 6 : 0;
      for (let i = 0; i < fireflyCount; i++) {
        const glowGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xf8ff9a });
        const firefly = new THREE.Mesh(glowGeo, glowMat);
        firefly.position.set(
          randRange(-4, 4),
          randRange(0.4, 2.5),
          randRange(-4, 4)
        );
        addToLand(firefly);
        dynamicActors.fireflies.push({
          mesh: firefly,
          basePosition: firefly.position.clone(),
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Animate
    function animate(time) {
      requestAnimationFrame(animate);

      if (dynamicActors.animals.length) {
        dynamicActors.animals.forEach((obj) => {
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

      if (dynamicActors.clouds.length) {
        dynamicActors.clouds.forEach((cloud) => {
          cloud.mesh.position.x += cloud.speed;
          if (cloud.mesh.position.x > 18) {
            cloud.mesh.position.x = -18;
          }
          cloud.mesh.position.y += Math.sin(time / 2000 + cloud.offset) * 0.002;
        });
      }

      if (dynamicActors.fireflies.length) {
        dynamicActors.fireflies.forEach((fly) => {
          fly.mesh.position.x =
            fly.basePosition.x + Math.sin(time / 900 + fly.phase) * 0.4;
          fly.mesh.position.y =
            fly.basePosition.y + Math.sin(time / 700 + fly.phase) * 0.25;
          fly.mesh.position.z =
            fly.basePosition.z + Math.cos(time / 950 + fly.phase) * 0.4;
        });
      }

      if (dynamicActors.pondMaterial) {
        dynamicActors.pondMaterial.clearcoatRoughness =
          0.08 + Math.sin(time / 1100) * 0.02;
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
