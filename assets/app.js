const SUPPORTED_EXAMS = ["DP-700"];

const params = new URLSearchParams(window.location.search);
const queryExam = (params.get("exam") || "").toUpperCase();
const totalMinutes = Number.parseInt(params.get("minutes") || "90", 10);

const examOptions = [...SUPPORTED_EXAMS];
if (queryExam && !examOptions.includes(queryExam)) {
  examOptions.push(queryExam);
}

const state = {
  examCode: queryExam || "DP-700",
  questions: [],
  currentIndex: 0,
  answersByIndex: {},
  remainingSeconds: Number.isFinite(totalMinutes) ? totalMinutes * 60 : 5400,
  timerId: null,
  navigatorCollapsed: false,
  status: "idle",
};

const ui = {
  examTitle: document.getElementById("examTitle"),
  examSelect: document.getElementById("examSelect"),
  examView: document.getElementById("examView"),
  timerBadge: document.getElementById("timerBadge"),
  startView: document.getElementById("startView"),
  resultView: document.getElementById("resultView"),
  startDescription: document.getElementById("startDescription"),
  startBtn: document.getElementById("startBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  restartBtn: document.getElementById("restartBtn"),
  questionCounter: document.getElementById("questionCounter"),
  questionNumberBadge: document.getElementById("questionNumberBadge"),
  questionText: document.getElementById("questionText"),
  remainingCounter: document.getElementById("remainingCounter"),
  optionsForm: document.getElementById("optionsForm"),
  navigatorPanel: document.getElementById("navigatorPanel"),
  questionNavGrid: document.getElementById("questionNavGrid"),
  progressSummary: document.getElementById("progressSummary"),
  toggleNavigatorBtn: document.getElementById("toggleNavigatorBtn"),
  expandNavigatorBtn: document.getElementById("expandNavigatorBtn"),
  openNavigatorBtn: document.getElementById("openNavigatorBtn"),
  closeNavigatorBtn: document.getElementById("closeNavigatorBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  finishBtn: document.getElementById("finishBtn"),
  scoreSummary: document.getElementById("scoreSummary"),
  resultList: document.getElementById("resultList"),
  newAttemptBtn: document.getElementById("newAttemptBtn"),
};

function getStorageKey(examCode = state.examCode) {
  return `exam:${examCode}`;
}

function formatTime(totalSec) {
  const safeSec = Math.max(0, totalSec);
  const mins = Math.floor(safeSec / 60);
  const sec = safeSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function setView(active) {
  ui.startView.classList.toggle("hidden", active !== "start");
  ui.examView.classList.toggle("hidden", active !== "exam");
  ui.resultView.classList.toggle("hidden", active !== "result");
}

function getCorrectAnswers(question) {
  if (Array.isArray(question?.answers?.platform) && question.answers.platform.length > 0) {
    return question.answers.platform;
  }
  if (Array.isArray(question?.answers?.community) && question.answers.community.length > 0) {
    return question.answers.community;
  }
  return [];
}

function shouldUseMultiSelect(question) {
  const correctCount = getCorrectAnswers(question).length;
  if (correctCount > 1) {
    return true;
  }
  return /choose\s+two|choose\s+three|choose\s+all|select\s+two|select\s+three|select\s+all/i.test(
    question.question || ""
  );
}

function normalizeAnswerSet(answerArray) {
  return [...new Set(answerArray)].sort();
}

function isQuestionAnswered(index) {
  const picks = state.answersByIndex[index];
  return Array.isArray(picks) && picks.length > 0;
}

function getAnsweredCount() {
  return state.questions.reduce((count, _, index) => count + (isQuestionAnswered(index) ? 1 : 0), 0);
}

function updateProgressCounters() {
  const answered = getAnsweredCount();
  const total = state.questions.length;
  const remaining = Math.max(0, total - answered);
  ui.progressSummary.textContent = `Answered ${answered} / ${total}`;
  ui.remainingCounter.textContent = `Remaining: ${remaining}`;
}

function setNavigatorOpen(isOpen) {
  ui.navigatorPanel.classList.toggle("open", Boolean(isOpen));
}

function syncNavigatorState() {
  ui.examView.classList.toggle("navigator-collapsed", state.navigatorCollapsed);
  ui.expandNavigatorBtn.hidden = !state.navigatorCollapsed;
}

function renderNavigator() {
  ui.questionNavGrid.innerHTML = "";
  const total = state.questions.length;

  for (let index = 0; index < total; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-nav-btn";
    if (isQuestionAnswered(index)) {
      button.classList.add("answered");
    }
    if (index === state.currentIndex) {
      button.classList.add("current");
    }
    button.textContent = String(index + 1);

    const question = state.questions[index];
    const topicLabel = Number.isFinite(Number(question?.topic)) ? `T${question.topic} ` : "";
    button.title = `${topicLabel}Q${question?.number || index + 1}`;

    button.addEventListener("click", () => {
      goToQuestion(index);
      if (window.matchMedia("(max-width: 720px)").matches) {
        setNavigatorOpen(false);
      }
    });

    ui.questionNavGrid.appendChild(button);
  }

  updateProgressCounters();
}

function goToQuestion(index) {
  if (state.questions.length === 0) {
    return;
  }
  const clamped = Math.min(Math.max(index, 0), state.questions.length - 1);
  state.currentIndex = clamped;
  renderQuestion();
  persistProgress();
}

function renderQuestion() {
  const question = state.questions[state.currentIndex];
  if (!question) {
    return;
  }

  ui.questionCounter.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
  ui.questionNumberBadge.textContent = `#${question.number}`;
  ui.questionText.textContent = question.question;

  const selected = state.answersByIndex[state.currentIndex] || [];
  const inputType = shouldUseMultiSelect(question) ? "checkbox" : "radio";

  ui.optionsForm.innerHTML = "";
  for (const option of question.options) {
    const wrapper = document.createElement("label");
    wrapper.className = "option";

    const input = document.createElement("input");
    input.type = inputType;
    input.name = "option";
    input.value = option.key;
    input.checked = selected.includes(option.key);

    input.addEventListener("change", () => {
      if (inputType === "radio") {
        state.answersByIndex[state.currentIndex] = [option.key];
      } else {
        const picks = new Set(state.answersByIndex[state.currentIndex] || []);
        if (input.checked) {
          picks.add(option.key);
        } else {
          picks.delete(option.key);
        }
        state.answersByIndex[state.currentIndex] = normalizeAnswerSet([...picks]);
      }
      renderNavigator();
      persistProgress();
    });

    const text = document.createElement("span");
    const keyTag = document.createElement("b");
    keyTag.textContent = `${option.key}.`;
    text.appendChild(keyTag);
    text.appendChild(document.createTextNode(` ${option.text}`));

    wrapper.appendChild(input);
    wrapper.appendChild(text);
    ui.optionsForm.appendChild(wrapper);
  }

  ui.prevBtn.disabled = state.currentIndex === 0;
  ui.nextBtn.textContent = state.currentIndex === state.questions.length - 1 ? "Submit" : "Next";
  renderNavigator();
}

function persistProgress() {
  const payload = {
    examCode: state.examCode,
    currentIndex: state.currentIndex,
    answersByIndex: state.answersByIndex,
    remainingSeconds: state.remainingSeconds,
    navigatorCollapsed: state.navigatorCollapsed,
    status: state.status,
  };
  localStorage.setItem(getStorageKey(), JSON.stringify(payload));
}

function clearProgress(examCode = state.examCode) {
  localStorage.removeItem(getStorageKey(examCode));
}

function loadSavedProgress(examCode = state.examCode) {
  const raw = localStorage.getItem(getStorageKey(examCode));
  if (!raw) {
    return null;
  }

  try {
    const saved = JSON.parse(raw);
    if (saved.examCode !== examCode) {
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

function tickTimer() {
  ui.timerBadge.textContent = formatTime(state.remainingSeconds);
  if (state.remainingSeconds <= 0) {
    finalizeExam(true);
    return;
  }

  state.remainingSeconds -= 1;
  persistProgress();
}

function startTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
  }
  ui.timerBadge.textContent = formatTime(state.remainingSeconds);
  state.timerId = window.setInterval(tickTimer, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startExam(useSaved) {
  if (useSaved) {
    const saved = loadSavedProgress();
    if (saved) {
      state.currentIndex = Math.min(saved.currentIndex || 0, state.questions.length - 1);
      state.answersByIndex = saved.answersByIndex || {};
      state.remainingSeconds = saved.remainingSeconds || state.remainingSeconds;
      state.navigatorCollapsed = Boolean(saved.navigatorCollapsed);
    }
  } else {
    state.currentIndex = 0;
    state.answersByIndex = {};
    state.remainingSeconds = Number.isFinite(totalMinutes) ? totalMinutes * 60 : 5400;
    clearProgress();
  }

  state.status = "in_progress";
  setView("exam");
  syncNavigatorState();
  renderQuestion();
  startTimer();
  persistProgress();
}

function scoreExam() {
  const details = [];
  let correctCount = 0;

  state.questions.forEach((question, index) => {
    const expected = normalizeAnswerSet(getCorrectAnswers(question));
    const actual = normalizeAnswerSet(state.answersByIndex[index] || []);
    const isCorrect = expected.length === actual.length && expected.every((x, idx) => x === actual[idx]);

    if (isCorrect) {
      correctCount += 1;
    }

    details.push({
      question,
      isCorrect,
      expected,
      actual,
    });
  });

  return {
    correctCount,
    total: state.questions.length,
    details,
  };
}

function finalizeExam(isTimeout = false) {
  stopTimer();
  state.status = "finished";
  persistProgress();

  const result = scoreExam();
  const percent = Math.round((result.correctCount / result.total) * 100);
  ui.scoreSummary.textContent = `${result.correctCount}/${result.total} correct (${percent}%). ${
    isTimeout ? "Time is up." : "Attempt submitted."
  }`;

  ui.resultList.innerHTML = "";
  result.details.forEach((entry, idx) => {
    const row = document.createElement("article");
    row.className = `result-item ${entry.isCorrect ? "ok" : "bad"}`;

    const stateLabel = entry.isCorrect ? "Correct" : "Incorrect";
    const userAnswer = entry.actual.length ? entry.actual.join(", ") : "No answer";
    const expectedAnswer = entry.expected.length ? entry.expected.join(", ") : "N/A";

    row.innerHTML = `
      <div class="result-state">${stateLabel} - Question ${idx + 1} (#${entry.question.number})</div>
      <div><strong>Your answer:</strong> ${userAnswer}</div>
      <div><strong>Expected answer:</strong> ${expectedAnswer}</div>
    `;

    ui.resultList.appendChild(row);
  });

  setView("result");
}

async function loadQuestionsSequentially(examCode) {
  const loaded = [];

  for (let topic = 1; ; topic += 1) {
    let loadedInTopic = 0;

    for (let question = 1; ; question += 1) {
      const path = `questions/${examCode}/${topic}-${question}.json`;
      const response = await fetch(path, { cache: "no-store" });

      if (!response.ok) {
        if (response.status === 404) {
          if (question === 1) {
            if (topic === 1 && loaded.length === 0) {
              throw new Error(`No questions found in questions/${examCode}/`);
            }
            return loaded;
          }
          break;
        }
        throw new Error(`Error loading ${path}: ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.question || !Array.isArray(data.options)) {
        throw new Error(`Invalid format in ${path}`);
      }
      loaded.push(data);
      loadedInTopic += 1;
    }

    if (loadedInTopic === 0) {
      break;
    }
  }

  if (loaded.length === 0) {
    throw new Error(`No questions found in questions/${examCode}/`);
  }

  return loaded;
}

function resetSessionState() {
  stopTimer();
  state.questions = [];
  state.currentIndex = 0;
  state.answersByIndex = {};
  state.remainingSeconds = Number.isFinite(totalMinutes) ? totalMinutes * 60 : 5400;
  state.status = "idle";
  ui.timerBadge.textContent = formatTime(state.remainingSeconds);
  ui.questionNavGrid.innerHTML = "";
  ui.progressSummary.textContent = "Answered 0 / 0";
  ui.remainingCounter.textContent = "Remaining: 0";
  setNavigatorOpen(false);
  syncNavigatorState();
}

function applyExamToUrl(examCode) {
  const next = new URL(window.location.href);
  next.searchParams.set("exam", examCode);
  window.history.replaceState({}, "", next);
}

async function loadExam(examCode) {
  state.examCode = examCode;
  resetSessionState();
  setView("start");

  ui.startBtn.hidden = false;
  ui.startBtn.disabled = true;
  ui.resumeBtn.hidden = true;
  ui.restartBtn.hidden = true;
  ui.startDescription.textContent = "Preparing exam content...";
  ui.examTitle.textContent = `Exam simulator ${state.examCode}`;

  try {
    state.questions = await loadQuestionsSequentially(state.examCode);
    ui.startDescription.textContent = `Exam ${state.examCode} is ready. ${state.questions.length} questions detected.`;
    ui.startBtn.disabled = false;

    const saved = loadSavedProgress(state.examCode);
    if (saved && saved.status === "in_progress") {
      ui.startDescription.textContent += " A saved attempt is in progress.";
      ui.startBtn.hidden = true;
      ui.resumeBtn.hidden = false;
      ui.restartBtn.hidden = false;
    }
  } catch (error) {
    ui.startDescription.textContent = `Could not load exam: ${error.message}`;
    ui.startBtn.disabled = true;
  }

  applyExamToUrl(state.examCode);
}

function wireEvents() {
  ui.startBtn.addEventListener("click", () => startExam(false));
  ui.resumeBtn.addEventListener("click", () => startExam(true));
  ui.restartBtn.addEventListener("click", () => startExam(false));

  ui.examSelect.addEventListener("change", async (event) => {
    await loadExam(event.target.value);
  });

  ui.openNavigatorBtn.addEventListener("click", () => setNavigatorOpen(true));
  ui.closeNavigatorBtn.addEventListener("click", () => setNavigatorOpen(false));
  ui.toggleNavigatorBtn.addEventListener("click", () => {
    state.navigatorCollapsed = true;
    syncNavigatorState();
  });
  ui.expandNavigatorBtn.addEventListener("click", () => {
    state.navigatorCollapsed = false;
    syncNavigatorState();
  });

  ui.prevBtn.addEventListener("click", () => {
    goToQuestion(state.currentIndex - 1);
  });

  ui.nextBtn.addEventListener("click", () => {
    if (state.currentIndex < state.questions.length - 1) {
      goToQuestion(state.currentIndex + 1);
      return;
    }
    finalizeExam();
  });

  ui.finishBtn.addEventListener("click", () => finalizeExam());

  ui.newAttemptBtn.addEventListener("click", () => {
    clearProgress();
    state.status = "idle";
    setView("start");
    ui.resumeBtn.hidden = true;
    ui.restartBtn.hidden = true;
    ui.startBtn.hidden = false;
    ui.startBtn.disabled = false;
    ui.startDescription.textContent = `Exam ${state.examCode} is ready. ${state.questions.length} questions detected.`;
    ui.timerBadge.textContent = formatTime(Number.isFinite(totalMinutes) ? totalMinutes * 60 : 5400);
  });

  document.addEventListener("keydown", (event) => {
    if (state.status !== "in_progress") {
      return;
    }
    const active = document.activeElement;
    const tagName = active?.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToQuestion(state.currentIndex - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (state.currentIndex < state.questions.length - 1) {
        goToQuestion(state.currentIndex + 1);
      }
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      goToQuestion(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      goToQuestion(state.questions.length - 1);
    }
  });
}

function populateExamSelect() {
  ui.examSelect.innerHTML = "";
  examOptions.forEach((examCode) => {
    const option = document.createElement("option");
    option.value = examCode;
    option.textContent = examCode;
    option.selected = examCode === state.examCode;
    ui.examSelect.appendChild(option);
  });
}

async function boot() {
  ui.timerBadge.textContent = formatTime(state.remainingSeconds);
  populateExamSelect();
  wireEvents();
  await loadExam(state.examCode);
}

boot();
