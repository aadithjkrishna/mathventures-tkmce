const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

const baseQuizData = [
  {
    question: "What is the capital of France?",
    options: ["Madrid", "Berlin", "Paris", "Rome"],
    answer: ["c"],
    type: "mcq"
  },
  {
    question: "Which language runs in a browser?",
    options: ["Java", "C++", "Python", "JavaScript"],
    answer: ["d"],
    type: "mcq"
  },
  {
    question: "What does HTML stand for?",
    options: ["HyperText Machine Language", "HyperText Markup Language", "HighText Markdown Language", "None of the above"],
    answer: ["b"],
    type: "mcq"
  },
  {
    question: "What year was JavaScript launched?",
    options: ["1996", "1995", "1994", "None of the above"],
    answer: ["b"],
    type: "mcq"
  },
  {
    question: "What is 2 + 2?",
    answer: ["4"],
    type: "short-answer"
  },
  {
    question: "Select all prime numbers.",
    options: ["2", "3", "4", "5"],
    answer: ["a", "b", "d"],
    type: "multi-select"
  }
];

// Attach an id to each question so we can safely shuffle on the client
const quizData = baseQuizData.map((q, index) => ({
  ...q,
  id: index
}));


app.use(express.json());

app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/quiz', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages/quiz/quiz.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pages/login/login.html'));
});

app.get('/quiz-questions', (req, res) => {
  res.json(quizData);
});

app.post('/submit-quiz', (req, res) => {
  const userAnswers = req.body.answers; // [{ id, answers: [...] }, ...]
  const timeTaken = req.body.timeTaken;  // 🔹 seconds taken on client

  if (!Array.isArray(userAnswers)) {
    return res.status(400).json({ error: 'Invalid answers data' });
  }

  let score = 0;
  const details = [];

  userAnswers.forEach(entry => {
    const { id, answers } = entry;
    const question = quizData.find(q => q.id === id);

    if (!question) return;

    const correct = question.answer || [];
    const user = Array.isArray(answers) ? answers : [];

    let isCorrect = false;

    if (question.type === 'multi-select') {
      const sortedUser = [...user].sort().toString();
      const sortedCorrect = [...correct].sort().toString();
      isCorrect = sortedUser === sortedCorrect;
    } else if (question.type === 'short-answer') {
      const userAns = (user[0] || '').trim().toLowerCase();
      const correctAns = (correct[0] || '').trim().toLowerCase();
      isCorrect = userAns === correctAns;
    } else if (question.type === 'mcq') {
      isCorrect = user[0] === correct[0];
    }

    if (isCorrect) score++;

    details.push({
      id: question.id,
      correct: isCorrect,
      correctAnswer: correct,
      userAnswer: user,
      question: question.question
    });
  });

  // 🔹 "Store" timer value – currently just log it; you can save to DB later
  console.log('Quiz submitted. Time taken (seconds):', timeTaken);

  res.json({
    message: 'Quiz submitted successfully',
    score,
    total: quizData.length,
    timeTaken,   // 🔹 send it back too if you want to display it
    details
  });
});



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
