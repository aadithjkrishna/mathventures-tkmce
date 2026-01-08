let quizData = [];
let curr_index = 0;
let userAnswers = [];
let currentQuizId = null; // New global variable to store the Quiz ID

const TOTAL_TIME_SECONDS = 120;
let remainingTime = TOTAL_TIME_SECONDS;
let timerInterval = null;

const questionContainer = document.getElementById("quiz-container-main");
const resultDiv = document.getElementById("result");
const quizOuterContainer = document.getElementById("quiz-container");

const prevButton = document.getElementById('prev-btn');
const submitButton = document.getElementById('submit-btn');
const nextButton = document.getElementById('next-btn');

// Create Timer Element
const timerDiv = document.createElement("div");
timerDiv.id = "timer";
timerDiv.style.marginBottom = "10px";
timerDiv.style.color = "#fff";
timerDiv.style.fontWeight = "600";
quizOuterContainer.insertBefore(timerDiv, quizOuterContainer.firstChild);

// --- 1. Fetch Questions & Quiz ID ---
fetch('/quiz-questions')
  .then(res => res.json())
  .then(data => {
    // Check if the server sent the new object format { quizId, questions }
    if (data.quizId && data.questions) {
      currentQuizId = data.quizId;
      quizData = shuffleArray(data.questions);
    } else if (Array.isArray(data)) {
      // Fallback for old API format
      quizData = shuffleArray(data);
    } else {
      console.error("Invalid data format received from server");
      return;
    }

    console.log("Loaded quizData length:", quizData.length);
    console.log("Quiz ID:", currentQuizId);
    
    userAnswers = new Array(quizData.length).fill(null);
    curr_index = 0;
    renderDiv();
    startTimer();
  })
  .catch(err => console.error("Error loading quiz:", err));

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderDiv() {
  if (quizData.length === 0) return;

  const currentQuestion = quizData[curr_index];
  questionContainer.innerHTML = '';

  const questionText = document.createElement('h1');
  questionText.textContent = `Q${curr_index + 1}. ${currentQuestion.question}`;
  questionContainer.appendChild(questionText);

  switch (currentQuestion.type) {
    case "mcq":
      renderMCQOptions(currentQuestion);
      break;
    case "short-answer":
      renderShortAnswerInput(currentQuestion);
      break;
    case "multi-select":
      renderMultiSelect(currentQuestion);
      break;
    default:
      console.error("Unknown type:", currentQuestion.type);
  }
}

function renderShortAnswerInput(q) {
  const answerInput = document.createElement('input');
  answerInput.type = 'text';
  answerInput.id = 'answer-input';
  answerInput.placeholder = 'Type your answer here';
  questionContainer.appendChild(answerInput);

  const saved = userAnswers[curr_index];
  if (saved && saved[0]) {
    answerInput.value = saved[0];
  }
}

function renderMCQOptions(q) {
  const saved = userAnswers[curr_index];

  q.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.style.display = "block";

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'mcq';
    radio.value = String.fromCharCode(97 + index); // 'a', 'b', 'c'...

    // If user previously selected this, check it
    if (saved && saved[0] === radio.value) {
      radio.checked = true;
    }

    label.appendChild(radio);
    label.appendChild(document.createTextNode(" " + option));
    questionContainer.appendChild(label);
  });
}

function renderMultiSelect(q) {
  const instructions = document.createElement('p');
  instructions.textContent = "Select all that apply:";
  instructions.style.fontSize = "0.9rem";
  instructions.style.color = "#555";
  questionContainer.appendChild(instructions);

  const saved = userAnswers[curr_index] || [];

  q.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.style.display = "block";
    label.style.marginBottom = "5px";
    label.style.cursor = "pointer";

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'multi-answer';
    checkbox.value = String.fromCharCode(97 + index);

    if (saved.includes(checkbox.value)) {
      checkbox.checked = true;
    }

    label.prepend(checkbox);
    label.appendChild(document.createTextNode(" " + option));
    questionContainer.appendChild(label);
  });
}

function captureCurrentAnswer() {
  if (quizData.length === 0) return;

  const currentQuestion = quizData[curr_index];
  let answerForThis = [];

  if (currentQuestion.type === "short-answer") {
    const input = document.getElementById('answer-input');
    if (input) {
      answerForThis = [input.value];
    }
  } else if (currentQuestion.type === "mcq") {
    const selected = document.querySelector('input[name="mcq"]:checked');
    if (selected) {
      answerForThis = [selected.value];
    }
  } else if (currentQuestion.type === "multi-select") {
    const checkedElements = document.querySelectorAll('input[name="multi-answer"]:checked');
    answerForThis = Array.from(checkedElements).map(box => box.value);
  }

  userAnswers[curr_index] = answerForThis;
}

submitButton.addEventListener('click', () => {
  if (quizData.length === 0) return;

  captureCurrentAnswer();

  const unansweredExists = userAnswers.some(ans => ans === null || ans.length === 0);
  let confirmMessage = unansweredExists 
    ? "Some questions are not answered. Do you still want to submit?" 
    : "Are you sure you want to submit the quiz?";

  const confirmSubmit = confirm(confirmMessage);
  if (!confirmSubmit) return;

  sendAllAnswersToServer();
});

// --- 2. Send Answers + Quiz ID ---
function sendAllAnswersToServer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  disableNavigation();

  const payloadAnswers = quizData.map((q, idx) => ({
    id: q.id,
    answers: userAnswers[idx] || []
  }));

  const timeTaken = TOTAL_TIME_SECONDS - remainingTime;

  fetch('/submit-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quizId: currentQuizId, // <--- IMPORTANT: Sending the ID back to server
      answers: payloadAnswers,
      timeTaken
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log('Server response:', data);

      document.body.classList.add('results-mode');
      window.scrollTo(0, 0);

      const quizContainer = document.getElementById("quiz-container");
      quizContainer.innerHTML = "";

      const title = document.createElement("h1");
      title.textContent = `Your Score: ${data.score} / ${data.total}`;
      quizContainer.appendChild(title);

      if (typeof data.percentage === 'number') {
        const percP = document.createElement("p");
        percP.textContent = `Percentage: ${data.percentage.toFixed(2)}%`;
        percP.style.color = "#ddd";
        quizContainer.appendChild(percP);
      }

      if (typeof data.timeTaken === 'number') {
        const timeP = document.createElement("p");
        timeP.textContent = `Time taken: ${formatTime(data.timeTaken)}`;
        timeP.style.marginBottom = "20px";
        timeP.style.fontWeight = "600";
        timeP.style.color = "#fff";
        quizContainer.appendChild(timeP);
      }

      const detailsById = new Map(
        (data.details || []).map(d => [d.id, d])
      );

      const resultList = document.createElement("div");
      resultList.style.marginTop = "20px";

      quizData.forEach((q, i) => {
        const detail = detailsById.get(q.id) || {};
        const isCorrect = !!detail.correct;
        const userAnsArr = detail.userAnswer || userAnswers[i] || [];
        const correctAnsArr = detail.correctAnswer || q.answer || [];

        const wrapper = document.createElement("div");
        wrapper.style.marginBottom = "20px";
        wrapper.style.padding = "10px";
        wrapper.style.border = "2px solid rgba(255,255,255,0.2)";
        wrapper.style.borderRadius = "10px";
        wrapper.style.background = "rgba(0,0,0,0.15)";

        if (isCorrect) {
          wrapper.style.borderColor = "rgba(0, 255, 0, 0.7)";
        } else {
          wrapper.style.borderColor = "rgba(255, 0, 0, 0.7)";
        }

        const qTitle = document.createElement("h3");
        qTitle.textContent = `Q${i + 1}: ${q.question}`;
        wrapper.appendChild(qTitle);

        const userAns = document.createElement("p");
        userAns.textContent = `Your Answer: ${userAnsArr.join(', ') || 'No answer'}`;
        userAns.style.fontWeight = "600";
        userAns.style.color = isCorrect ? "#90ee90" : "#ff7f7f";
        wrapper.appendChild(userAns);

        const correctAns = document.createElement("p");
        correctAns.textContent = `Correct Answer: ${correctAnsArr.join(', ')}`;
        correctAns.style.color = "#ffffff";
        wrapper.appendChild(correctAns);

        resultList.appendChild(wrapper);
      });

      quizContainer.appendChild(resultList);
    })
    .catch(err => {
      console.error('Error submitting quiz:', err);
      resultDiv.textContent = 'Error submitting quiz.';
    });
}

function renderButtons() {
  prevButton.addEventListener('click', () => {
    if (quizData.length === 0) return;
    captureCurrentAnswer();
    if (curr_index > 0) {
      curr_index--;
      renderDiv();
    }
  });

  nextButton.addEventListener('click', () => {
    if (quizData.length === 0) return;
    captureCurrentAnswer();
    if (curr_index < quizData.length - 1) {
      curr_index++;
      renderDiv();
    }
  });
}

renderButtons();

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    remainingTime--;
    if (remainingTime <= 0) {
      remainingTime = 0;
      updateTimerDisplay();
      clearInterval(timerInterval);
      timerInterval = null;

      disableNavigation();
      captureCurrentAnswer();
      sendAllAnswersToServer();
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;
  timerDiv.textContent = `Time left: ${minutes}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

function disableNavigation() {
  prevButton.disabled = true;
  nextButton.disabled = true;
  submitButton.disabled = true;
  prevButton.style.opacity = "0.5";
  nextButton.style.opacity = "0.5";
  submitButton.style.opacity = "0.5";
}