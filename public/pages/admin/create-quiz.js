const questionsWrapper = document.getElementById('questions-wrapper');
const addQuestionBtn = document.getElementById('add-question-btn');
const quizForm = document.getElementById('create-quiz-form');

// Helper: Generate unique IDs for DOM elements
let questionCount = 0;

function createQuestionElement() {
  questionCount++;
  const qId = `q-${questionCount}`;

  const div = document.createElement('div');
  div.classList.add('question-card');
  div.dataset.id = qId;

  div.innerHTML = `
    <div class="card-header">
      <label>Question ${questionCount}</label>
      <button type="button" class="delete-btn" onclick="removeQuestion('${qId}')">Remove</button>
    </div>
    
    <div class="input-group">
      <input type="text" class="q-text" placeholder="Enter question text here..." required>
    </div>

    <div class="input-group">
      <label>Type</label>
      <select class="q-type" onchange="handleTypeChange(this, '${qId}')">
        <option value="mcq">Multiple Choice</option>
        <option value="multi-select">Multi-Select</option>
        <option value="short-answer">Short Answer</option>
      </select>
    </div>

    <div class="options-container" id="opts-${qId}">
      </div>
  `;

  questionsWrapper.appendChild(div);
  
  // Initialize with MCQ options
  renderOptions(div.querySelector('.options-container'), 'mcq');
}

// Render inputs based on type
function renderOptions(container, type) {
  container.innerHTML = ''; // Clear existing

  if (type === 'short-answer') {
    container.innerHTML = `
      <div class="input-group">
        <label>Correct Answer (Exact text match)</label>
        <input type="text" class="correct-text" placeholder="e.g. 4 or Paris">
      </div>
    `;
  } else {
    // MCQ or Multi-select
    const inputType = type === 'mcq' ? 'radio' : 'checkbox';
    const nameAttr = `ans-${Math.random().toString(36).substring(7)}`;

    container.innerHTML = `
      <label>Options (Check the correct one)</label>
      <div class="options-list">
        ${createOptionRow(inputType, nameAttr, 'a')}
        ${createOptionRow(inputType, nameAttr, 'b')}
        ${createOptionRow(inputType, nameAttr, 'c')}
        ${createOptionRow(inputType, nameAttr, 'd')}
      </div>
      <button type="button" class="add-opt-btn" onclick="addOptionTo(this, '${inputType}', '${nameAttr}')">+ Add Option</button>
    `;
  }
}

function createOptionRow(inputType, nameAttr, val) {
  return `
    <div class="option-row">
      <input type="${inputType}" name="${nameAttr}" value="${val}" class="correct-marker">
      <input type="text" class="opt-text" placeholder="Option text...">
    </div>
  `;
}

// Event Handlers
window.removeQuestion = (id) => {
  const el = document.querySelector(`.question-card[data-id="${id}"]`);
  if (el) el.remove();
};

window.handleTypeChange = (selectElem, qId) => {
  const container = document.getElementById(`opts-${qId}`);
  renderOptions(container, selectElem.value);
};

window.addOptionTo = (btn, inputType, nameAttr) => {
  const list = btn.previousElementSibling;
  // Generate next char (d -> e) logic is simplified here to just timestamp for uniqueness, 
  // but for the backend 'a','b','c' logic, we map by index later.
  const nextVal = String.fromCharCode(97 + list.children.length); 
  
  const div = document.createElement('div');
  div.classList.add('option-row');
  div.innerHTML = `
    <input type="${inputType}" name="${nameAttr}" value="${nextVal}" class="correct-marker">
    <input type="text" class="opt-text" placeholder="Option text...">
    <button type="button" class="delete-btn" style="padding:2px 6px; margin-left:5px;" onclick="this.parentElement.remove()">X</button>
  `;
  list.appendChild(div);
};

// Initial Question
createQuestionElement();
addQuestionBtn.addEventListener('click', createQuestionElement);

// --- Form Submission ---
quizForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('save-quiz-btn');
  saveBtn.textContent = "Saving...";
  saveBtn.disabled = true;

  const title = document.getElementById('quiz-title').value;
  const description = document.getElementById('quiz-desc').value;
  
  const cards = document.querySelectorAll('.question-card');
  const questionsData = [];

  cards.forEach(card => {
    const text = card.querySelector('.q-text').value;
    const type = card.querySelector('.q-type').value;
    
    let options = [];
    let answer = [];

    if (type === 'short-answer') {
      const correctText = card.querySelector('.correct-text').value;
      answer.push(correctText); 
    } else {
      // Handle MCQ / Multi
      const optRows = card.querySelectorAll('.option-row');
      optRows.forEach((row, index) => {
        const txt = row.querySelector('.opt-text').value;
        const isChecked = row.querySelector('.correct-marker').checked;
        const charCode = String.fromCharCode(97 + index); // a, b, c... based on order

        if(txt) {
          options.push(txt);
          if(isChecked) answer.push(charCode);
        }
      });
    }

    questionsData.push({ text, type, options, answer });
  });

  // Send to Server
  try {
    const res = await fetch('/api/create-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, questions: questionsData })
    });
    
    const data = await res.json();
    if(res.ok) {
      alert('Quiz Created Successfully!');
      window.location.href = '/'; // Go home
    } else {
      alert('Error: ' + data.error);
    }
  } catch(err) {
    console.error(err);
    alert('Failed to connect to server.');
  } finally {
    saveBtn.textContent = "Publish Quiz";
    saveBtn.disabled = false;
  }
});