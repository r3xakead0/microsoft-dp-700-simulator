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
  progressSummary: document.getElementById("progressSummary"),
  questionText: document.getElementById("questionText"),
  questionMedia: document.getElementById("questionMedia"),
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

function parseTextWithImages(rawValue) {
  const value = String(rawValue || "");
  const imageUrls = [];
  const text = value
    .replace(/\[(?:Imagen|Image)\]:\s*(https?:\/\/\S+)/gi, (_, url) => {
      imageUrls.push(url.trim());
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    text,
    imageUrls: [...new Set(imageUrls)],
  };
}

function normalizeLooseText(rawValue) {
  return String(rawValue || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function mapAnswerTokenToOptionKey(question, answerToken) {
  if (!question || !Array.isArray(question.options) || question.options.length === 0) {
    return null;
  }

  const token = String(answerToken || "").trim();
  const direct = question.options.find((option) => option.key === token);
  if (direct) {
    return direct.key;
  }

  const parsedToken = parseTextWithImages(token);
  if (parsedToken.imageUrls.length > 0) {
    const byImage = question.options.filter((option) => {
      const parsedOption = parseTextWithImages(option.text);
      return parsedOption.imageUrls.some((url) => parsedToken.imageUrls.includes(url));
    });
    if (byImage.length === 1) {
      return byImage[0].key;
    }
  }

  const tokenText = normalizeLooseText(parsedToken.text || token);
  if (tokenText) {
    const byText = question.options.filter((option) => {
      const parsedOption = parseTextWithImages(option.text);
      return normalizeLooseText(parsedOption.text || option.text) === tokenText;
    });
    if (byText.length === 1) {
      return byText[0].key;
    }
  }

  if (question.options.length === 1) {
    return question.options[0].key;
  }

  return null;
}

function getExpectedAnswerKeys(question) {
  const mapped = getCorrectAnswers(question)
    .map((token) => mapAnswerTokenToOptionKey(question, token))
    .filter(Boolean);
  return normalizeAnswerSet(mapped);
}

function createImageElement(url, altText) {
  const image = document.createElement("img");
  image.className = "exam-image";
  image.src = url;
  image.alt = altText;
  image.loading = "lazy";
  image.addEventListener("error", () => {
    image.classList.add("hidden");
    const fallback = document.createElement("span");
    fallback.className = "media-fallback";
    fallback.textContent = "Image unavailable";
    image.insertAdjacentElement("afterend", fallback);
  });
  return image;
}

function appendImageSet(container, imageUrls, labelPrefix) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return;
  }

  const media = document.createElement("div");
  media.className = "media-group";
  imageUrls.forEach((url, index) => {
    media.appendChild(createImageElement(url, `${labelPrefix} image ${index + 1}`));
  });
  container.appendChild(media);
}

function createOptionSummary(question, key) {
  const item = document.createElement("div");
  item.className = "answer-item";

  const option = question.options.find((candidate) => candidate.key === key);
  const keyTag = document.createElement("b");
  keyTag.textContent = `${key}.`;
  item.appendChild(keyTag);

  if (!option) {
    return item;
  }

  const parsedOption = parseTextWithImages(option.text);
  if (parsedOption.text) {
    item.appendChild(document.createTextNode(` ${parsedOption.text}`));
  }
  appendImageSet(item, parsedOption.imageUrls, `Option ${key}`);
  return item;
}

function createRawAnswerSummary(answerToken) {
  const item = document.createElement("div");
  item.className = "answer-item";
  const parsed = parseTextWithImages(answerToken);

  if (parsed.text) {
    item.textContent = parsed.text;
  }
  appendImageSet(item, parsed.imageUrls, "Answer");

  if (!parsed.text && parsed.imageUrls.length === 0) {
    item.textContent = String(answerToken || "").trim();
  }

  return item;
}

function renderAnswerLine(container, label, question, answerKeys, emptyLabel = "No answer", rawAnswers = []) {
  const row = document.createElement("div");
  row.className = "result-answer-row";

  const title = document.createElement("strong");
  title.textContent = `${label}:`;
  row.appendChild(title);

  const hasKeys = Array.isArray(answerKeys) && answerKeys.length > 0;
  const hasRawAnswers = Array.isArray(rawAnswers) && rawAnswers.length > 0;

  if (!hasKeys && !hasRawAnswers) {
    row.appendChild(document.createTextNode(` ${emptyLabel}`));
    container.appendChild(row);
    return;
  }

  const answers = document.createElement("div");
  answers.className = "answer-list";
  if (hasKeys) {
    answerKeys.forEach((key) => {
      answers.appendChild(createOptionSummary(question, key));
    });
  } else {
    rawAnswers.forEach((token) => {
      answers.appendChild(createRawAnswerSummary(token));
    });
  }
  row.appendChild(answers);
  container.appendChild(row);
}

function shouldUseMultiSelect(question) {
  const correctCount = getExpectedAnswerKeys(question).length;
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
  ui.progressSummary.textContent = `Answered ${answered} of ${total}`;
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
  const parsedQuestion = parseTextWithImages(question.question);
  ui.questionText.textContent = parsedQuestion.text;
  ui.questionMedia.innerHTML = "";
  appendImageSet(ui.questionMedia, parsedQuestion.imageUrls, "Question");

  updateProgressSummary();

  const revealed = isAnswerRevealed(state.currentIndex);
  const expected = getExpectedAnswerKeys(question);
  ui.viewAnswerBtn.textContent = revealed ? "Hide answer" : "View answer";

  if (revealed) {
    ui.answerReveal.innerHTML = "";
    renderAnswerLine(ui.answerReveal, "Correct answer", question, expected, "N/A", getCorrectAnswers(question));
    ui.answerReveal.classList.remove("hidden");
  } else {
    ui.answerReveal.innerHTML = "";
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

    const parsedOption = parseTextWithImages(option.text);
    const text = document.createElement("span");
    text.className = "option-content";
    const keyTag = document.createElement("b");
    keyTag.textContent = `${option.key}.`;
    text.appendChild(keyTag);
    if (parsedOption.text) {
      text.appendChild(document.createTextNode(` ${parsedOption.text}`));
    }
    appendImageSet(text, parsedOption.imageUrls, `Option ${option.key}`);

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
    const expected = getExpectedAnswerKeys(question);
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

    const stateBlock = document.createElement("div");
    stateBlock.className = "result-state";
    stateBlock.textContent = `${stateLabel} - Question ${idx + 1} (#${entry.question.number})`;
    row.appendChild(stateBlock);

    renderAnswerLine(row, "Your answer", entry.question, entry.actual);
    renderAnswerLine(
      row,
      "Expected answer",
      entry.question,
      entry.expected,
      "N/A",
      getCorrectAnswers(entry.question)
    );

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

  const contentType = (response.headers.get("content-type") || "").toLowerCase();

  if (!response.ok) {
    throw new Error(`Error loading ${path}: ${response.status}`);
  }

  if (contentType.includes("text/html")) {
    return null;
  }

  if (!contentType.includes("application/json") && !contentType.includes("text/json")) {
    throw new Error(`Unexpected content type for ${path}: ${contentType || "unknown"}`);
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
  ui.progressSummary.textContent = "Answered 0 of 0";
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
