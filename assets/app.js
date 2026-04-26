const params = new URLSearchParams(window.location.search);
const examCode = (params.get("exam") || "DF-700").toUpperCase();
const totalMinutes = Number.parseInt(params.get("minutes") || "90", 10);

const state = {
  examCode,
  questions: [],
  currentIndex: 0,
  answersByIndex: {},
  remainingSeconds: Number.isFinite(totalMinutes) ? totalMinutes * 60 : 5400,
  timerId: null,
  status: "idle",
};

const ui = {
  examTitle: document.getElementById("examTitle"),
  timerBadge: document.getElementById("timerBadge"),
  startView: document.getElementById("startView"),
  examView: document.getElementById("examView"),
  resultView: document.getElementById("resultView"),
  startDescription: document.getElementById("startDescription"),
  startBtn: document.getElementById("startBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  restartBtn: document.getElementById("restartBtn"),
  questionCounter: document.getElementById("questionCounter"),
  questionNumberBadge: document.getElementById("questionNumberBadge"),
  questionText: document.getElementById("questionText"),
  optionsForm: document.getElementById("optionsForm"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  finishBtn: document.getElementById("finishBtn"),
  scoreSummary: document.getElementById("scoreSummary"),
  resultList: document.getElementById("resultList"),
  newAttemptBtn: document.getElementById("newAttemptBtn"),
};

const storageKey = `exam:${examCode}`;

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
}

function persistProgress() {
  const payload = {
    examCode: state.examCode,
    currentIndex: state.currentIndex,
    answersByIndex: state.answersByIndex,
    remainingSeconds: state.remainingSeconds,
    status: state.status,
  };
  localStorage.setItem(storageKey, JSON.stringify(payload));
}

function clearProgress() {
  localStorage.removeItem(storageKey);
}

function loadSavedProgress() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const saved = JSON.parse(raw);
    if (saved.examCode !== state.examCode) {
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
    }
  } else {
    state.currentIndex = 0;
    state.answersByIndex = {};
    state.remainingSeconds = Number.isFinite(totalMinutes) ? totalMinutes * 60 : 5400;
    clearProgress();
  }

  state.status = "in_progress";
  setView("exam");
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

async function loadQuestionsSequentially() {
  const loaded = [];

  for (let i = 1; ; i += 1) {
    const path = `questions/${examCode}/${i}.json`;
    const response = await fetch(path, { cache: "no-store" });

    if (!response.ok) {
      if (response.status === 404) {
        break;
      }
      throw new Error(`Error loading ${path}: ${response.status}`);
    }

    const data = await response.json();
    if (!data || !data.question || !Array.isArray(data.options)) {
      throw new Error(`Invalid format in ${path}`);
    }
    loaded.push(data);
  }

  if (loaded.length === 0) {
    throw new Error(`No questions found in questions/${examCode}/`);
  }

  loaded.sort((a, b) => Number(a.number) - Number(b.number));
  return loaded;
}

function wireEvents() {
  ui.startBtn.addEventListener("click", () => startExam(false));
  ui.resumeBtn.addEventListener("click", () => startExam(true));
  ui.restartBtn.addEventListener("click", () => startExam(false));

  ui.prevBtn.addEventListener("click", () => {
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    renderQuestion();
    persistProgress();
  });

  ui.nextBtn.addEventListener("click", () => {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex += 1;
      renderQuestion();
      persistProgress();
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
    ui.startDescription.textContent = `Exam ${examCode} is ready. ${state.questions.length} questions detected.`;
    ui.timerBadge.textContent = formatTime(Number.isFinite(totalMinutes) ? totalMinutes * 60 : 5400);
  });
}

async function boot() {
  ui.examTitle.textContent = `Exam simulator ${examCode}`;
  ui.timerBadge.textContent = formatTime(state.remainingSeconds);
  wireEvents();

  try {
    state.questions = await loadQuestionsSequentially();
    ui.startDescription.textContent = `Exam ${examCode} is ready. ${state.questions.length} questions detected.`;
    ui.startBtn.disabled = false;

    const saved = loadSavedProgress();
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
}

boot();
