const EXAM_CODE = "DP-700";

const state = {
  examCode: EXAM_CODE,
  questions: [],
  currentIndex: 0,
  answersByIndex: {},
  revealedByIndex: {},
  status: "idle",
};

const ui = {
  examTitle: document.getElementById("examTitle"),
  examView: document.getElementById("examView"),
  startView: document.getElementById("startView"),
  resultView: document.getElementById("resultView"),
  startDescription: document.getElementById("startDescription"),
  startBtn: document.getElementById("startBtn"),
  resumeBtn: document.getElementById("resumeBtn"),
  restartBtn: document.getElementById("restartBtn"),
  questionCounter: document.getElementById("questionCounter"),
  questionNumberBadge: document.getElementById("questionNumberBadge"),
  progressSummary: document.getElementById("progressSummary"),
  questionText: document.getElementById("questionText"),
  optionsForm: document.getElementById("optionsForm"),
  answerReveal: document.getElementById("answerReveal"),
  viewAnswerBtn: document.getElementById("viewAnswerBtn"),
  submitBtn: document.getElementById("submitBtn"),
  firstBtn: document.getElementById("firstBtn"),
  prevBtn: document.getElementById("prevBtn"),
  pageNumbers: document.getElementById("pageNumbers"),
  nextNavBtn: document.getElementById("nextNavBtn"),
  lastBtn: document.getElementById("lastBtn"),
  scoreSummary: document.getElementById("scoreSummary"),
  resultList: document.getElementById("resultList"),
  newAttemptBtn: document.getElementById("newAttemptBtn"),
};

function getStorageKey(examCode = state.examCode) {
  return `exam:${examCode}`;
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

function isAnswerRevealed(index) {
  return Boolean(state.revealedByIndex[index]);
}

function setAnswerRevealed(index, revealed) {
  if (revealed) {
    state.revealedByIndex[index] = true;
    return;
  }
  delete state.revealedByIndex[index];
}

function updateProgressSummary() {
  const answered = getAnsweredCount();
  const total = state.questions.length;
  ui.progressSummary.textContent = `Answered ${answered} / ${total}`;
}

function renderPager() {
  ui.pageNumbers.innerHTML = "";
  const total = state.questions.length;
  if (total === 0) {
    return;
  }

  const groupStart = Math.floor(state.currentIndex / 10) * 10;
  const groupEnd = Math.min(groupStart + 9, total - 1);

  for (let index = groupStart; index <= groupEnd; index += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn page-btn";
    if (index === state.currentIndex) {
      button.classList.add("current");
    }
    if (isQuestionAnswered(index)) {
      button.classList.add("answered");
    }
    button.textContent = String(index + 1);
    button.addEventListener("click", () => {
      goToQuestion(index);
    });
    ui.pageNumbers.appendChild(button);
  }

  ui.firstBtn.disabled = state.currentIndex === 0;
  ui.prevBtn.disabled = state.currentIndex === 0;
  ui.nextNavBtn.disabled = state.currentIndex >= total - 1;
  ui.lastBtn.disabled = state.currentIndex >= total - 1;
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
  ui.questionNumberBadge.textContent = `#${question.number || state.currentIndex + 1}`;
  ui.questionText.textContent = question.question;

  updateProgressSummary();

  const revealed = isAnswerRevealed(state.currentIndex);
  const expected = normalizeAnswerSet(getCorrectAnswers(question));
  ui.viewAnswerBtn.textContent = revealed ? "Hide answer" : "View answer";

  if (revealed) {
    const correctLabel = expected.length ? expected.join(", ") : "N/A";
    ui.answerReveal.textContent = `Correct answer: ${correctLabel}`;
    ui.answerReveal.classList.remove("hidden");
  } else {
    ui.answerReveal.textContent = "";
    ui.answerReveal.classList.add("hidden");
  }

  const selected = state.answersByIndex[state.currentIndex] || [];
  const inputType = shouldUseMultiSelect(question) ? "checkbox" : "radio";

  ui.optionsForm.innerHTML = "";
  for (const option of question.options) {
    const wrapper = document.createElement("label");
    wrapper.className = "option";

    if (revealed && expected.includes(option.key)) {
      wrapper.classList.add("correct-reveal");
    }

    const input = document.createElement("input");
    input.type = inputType;
    input.name = `option-${state.currentIndex}`;
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
      updateProgressSummary();
      renderPager();
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

  renderPager();
}

function persistProgress() {
  const payload = {
    examCode: state.examCode,
    currentIndex: state.currentIndex,
    answersByIndex: state.answersByIndex,
    revealedByIndex: state.revealedByIndex,
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

function startExam(useSaved) {
  if (useSaved) {
    const saved = loadSavedProgress();
    if (saved) {
      state.currentIndex = Math.min(saved.currentIndex || 0, state.questions.length - 1);
      state.answersByIndex = saved.answersByIndex || {};
      state.revealedByIndex = saved.revealedByIndex || {};
    }
  } else {
    state.currentIndex = 0;
    state.answersByIndex = {};
    state.revealedByIndex = {};
    clearProgress();
  }

  state.status = "in_progress";
  setView("exam");
  renderQuestion();
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

function finalizeExam() {
  state.status = "finished";
  persistProgress();

  const result = scoreExam();
  const percent = Math.round((result.correctCount / result.total) * 100);
  ui.scoreSummary.textContent = `${result.correctCount}/${result.total} correct (${percent}%). Attempt submitted.`;

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

function confirmFinishExam() {
  return window.confirm("Are you sure you want to finish and see results?");
}

async function loadQuestionFile(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Error loading ${path}: ${response.status}`);
  }
  return response.json();
}

async function loadQuestionsSequentially() {
  const loaded = [];
  const MAX_TOPICS = 50;
  const MAX_QUESTIONS_PER_TOPIC = 400;
  const LEADING_GAP_LIMIT = 30;
  const TRAILING_GAP_LIMIT = 15;
  let emptyTopicStreak = 0;

  for (let topic = 1; topic <= MAX_TOPICS; topic += 1) {
    const loadedInTopic = [];
    let leadingMisses = 0;
    let trailingMisses = 0;
    let foundAnyInTopic = false;

    for (let question = 1; question <= MAX_QUESTIONS_PER_TOPIC; question += 1) {
      const path = `questions/${topic}-${question}.json`;
      const data = await loadQuestionFile(path);

      if (!data) {
        if (!foundAnyInTopic) {
          leadingMisses += 1;
          if (leadingMisses >= LEADING_GAP_LIMIT) {
            break;
          }
        } else {
          trailingMisses += 1;
          if (trailingMisses >= TRAILING_GAP_LIMIT) {
            break;
          }
        }
        continue;
      }

      if (!data.question || !Array.isArray(data.options)) {
        throw new Error(`Invalid format in ${path}`);
      }

      foundAnyInTopic = true;
      trailingMisses = 0;
      loadedInTopic.push(data);
    }

    if (loadedInTopic.length === 0) {
      emptyTopicStreak += 1;
      if (emptyTopicStreak >= 3) {
        break;
      }
      continue;
    }

    emptyTopicStreak = 0;
    loaded.push(...loadedInTopic);
  }

  if (loaded.length === 0) {
    throw new Error("No questions found in questions/");
  }

  return loaded;
}

function resetSessionState() {
  state.questions = [];
  state.currentIndex = 0;
  state.answersByIndex = {};
  state.revealedByIndex = {};
  state.status = "idle";
  ui.pageNumbers.innerHTML = "";
  ui.progressSummary.textContent = "Answered 0 / 0";
  ui.answerReveal.textContent = "";
  ui.answerReveal.classList.add("hidden");
}

async function loadExam() {
  resetSessionState();
  setView("start");

  ui.startBtn.hidden = false;
  ui.startBtn.disabled = true;
  ui.resumeBtn.hidden = true;
  ui.restartBtn.hidden = true;
  ui.startDescription.textContent = "Preparing exam content...";
  ui.examTitle.textContent = `Exam simulator ${EXAM_CODE}`;

  try {
    state.questions = await loadQuestionsSequentially();
    ui.startDescription.textContent = `Exam ${EXAM_CODE} is ready. ${state.questions.length} questions detected.`;
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

function wireEvents() {
  ui.startBtn.addEventListener("click", () => startExam(false));
  ui.resumeBtn.addEventListener("click", () => startExam(true));
  ui.restartBtn.addEventListener("click", () => startExam(false));

  ui.viewAnswerBtn.addEventListener("click", () => {
    const nextValue = !isAnswerRevealed(state.currentIndex);
    setAnswerRevealed(state.currentIndex, nextValue);
    renderQuestion();
    persistProgress();
  });

  ui.submitBtn.addEventListener("click", () => {
    if (!confirmFinishExam()) {
      return;
    }
    finalizeExam();
  });

  ui.firstBtn.addEventListener("click", () => {
    goToQuestion(0);
  });

  ui.prevBtn.addEventListener("click", () => {
    goToQuestion(state.currentIndex - 1);
  });

  ui.nextNavBtn.addEventListener("click", () => {
    goToQuestion(state.currentIndex + 1);
  });

  ui.lastBtn.addEventListener("click", () => {
    goToQuestion(state.questions.length - 1);
  });

  ui.newAttemptBtn.addEventListener("click", () => {
    clearProgress();
    state.status = "idle";
    setView("start");
    ui.resumeBtn.hidden = true;
    ui.restartBtn.hidden = true;
    ui.startBtn.hidden = false;
    ui.startBtn.disabled = false;
    ui.startDescription.textContent = `Exam ${EXAM_CODE} is ready. ${state.questions.length} questions detected.`;
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
      goToQuestion(state.currentIndex + 1);
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

async function boot() {
  wireEvents();
  await loadExam();
}

boot();
