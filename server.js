require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// --- 1. Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key_fallback',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// --- 2. Database Connection ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/quiz-app')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- 3. Schemas & Models ---

// A. User Schema
const userSchema = new mongoose.Schema({
    fullname: String,
    username: String,
    email: { type: String, unique: true },
    password: { type: String },
    googleId: String,
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpires: Date
});
const User = mongoose.model('User', userSchema);

// B. Question Schema
const questionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    options: [String],
    answer: { type: [String], required: true },
    type: { type: String, enum: ['mcq', 'short-answer', 'multi-select'], required: true }
});
const Question = mongoose.model('Question', questionSchema);

// C. Quiz Schema (The "Container")
const quizCollectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }]
});
const Quiz = mongoose.model('Quiz', quizCollectionSchema);

// D. Quiz Result Schema (The "Scorecard") -- NEW --
const quizResultSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who took it
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true }, // Which quiz
    score: Number,
    total: Number,
    percentage: Number,
    timeTaken: Number, // In seconds
    date: { type: Date, default: Date.now }
});
const QuizResult = mongoose.model('QuizResult', quizResultSchema);


// --- 4. Database Seeding ---
const seedDatabase = async () => {
    try {
        const quizCount = await Quiz.countDocuments();
        if (quizCount === 0) {
            console.log("Seeding database...");
            const q1 = await Question.create({ text: "What is the capital of France?", options: ["Madrid", "Berlin", "Paris", "Rome"], answer: ["c"], type: "mcq" });
            const q2 = await Question.create({ text: "What is 2 + 2?", answer: ["4"], type: "short-answer" });
            
            // Create a default quiz
            await Quiz.create({
                title: "General Knowledge",
                description: "A basic test of your knowledge.",
                questions: [q1._id, q2._id]
            });
            console.log('Database seeded.');
        }
    } catch (err) { console.error('Seeding error:', err); }
};
seedDatabase();

// --- 5. Auth Setup (Google & Local) ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = await User.findOne({ email: profile.emails[0].value });
            if (user) {
                user.googleId = profile.id; user.isVerified = true; await user.save();
            } else {
                user = new User({ fullname: profile.displayName, email: profile.emails[0].value, googleId: profile.id, isVerified: true });
                await user.save();
            }
        }
        return done(null, user);
    } catch (err) { return done(err, null); }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => { const user = await User.findById(id); done(null, user); });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// --- 6. ROUTES ---

// Page Routes
app.get('/home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/home/landing.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/login/login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup/signup.html')));
app.get('/otp-verify', (req, res) => res.sendFile(path.join(__dirname, 'public', 'otp.html')));
app.get('/quiz', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/quiz/quiz.html')));
app.get('/school-leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/leaderboard/school_leaderboard.html')));
app.get('/college-leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/leaderboard/college_leaderboard.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/about/about.html')));
app.get('/create-quiz', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/admin/create-quiz.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/landing/landing.html')));
app.get('/events', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages/events/events.html')));

app.get('/quiz-questions', async (req, res) => {
    const quizId = req.query.id;
    try {
        let quiz;
        if (quizId) quiz = await Quiz.findById(quizId).populate('questions');
        else quiz = await Quiz.findOne().populate('questions');

        if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

        // Send Quiz ID along with questions so frontend knows what to submit back
        res.json({
            quizId: quiz._id, 
            questions: quiz.questions.map(q => ({
                id: q._id,
                question: q.text,
                options: q.options,
                type: q.type
            }))
        });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch questions' }); }
});

// API: Submit Quiz (With Recording Logic)
app.post('/submit-quiz', async (req, res) => {
    const { answers, timeTaken, quizId } = req.body; // Expect quizId from frontend

    if (!Array.isArray(answers)) return res.status(400).json({ error: 'Invalid answers data' });

    let score = 0;
    const details = [];

    try {
        for (const entry of answers) {
            const { id, answers: userAnsArray } = entry;
            const question = await Question.findById(id);

            if (!question) continue;

            const correct = question.answer || [];
            const user = Array.isArray(userAnsArray) ? userAnsArray : [];
            let isCorrect = false;

            // Grading Logic
            if (question.type === 'multi-select') {
                isCorrect = [...user].sort().toString() === [...correct].sort().toString();
            } else if (question.type === 'short-answer') {
                isCorrect = (user[0] || '').trim().toLowerCase() === (correct[0] || '').trim().toLowerCase();
            } else if (question.type === 'mcq') {
                isCorrect = user[0] === correct[0];
            }

            if (isCorrect) score++;

            details.push({
                id: question._id,
                correct: isCorrect,
                correctAnswer: correct,
                userAnswer: user,
                question: question.text
            });
        }

        const total = answers.length;
        const percentage = (score / total) * 100;

        // --- NEW: Save Result to Database ---
        // Only save if user is logged in (req.user exists)
        if (req.user && quizId) {
            await QuizResult.create({
                user: req.user._id,
                quiz: quizId,
                score: score,
                total: total,
                percentage: percentage,
                timeTaken: timeTaken
            });
            console.log(`Score recorded for user: ${req.user.username || req.user.email}`);
        }

        res.json({
            message: 'Quiz submitted successfully',
            score,
            total,
            percentage,
            timeTaken,
            details
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing quiz submission' });
    }
});

app.post('/api/create-quiz', async (req, res) => {
    // Check if user is logged in (Optional, but recommended)
    // if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    try {
        const questionIds = [];

        // 1. Loop through questions and save them to the Question collection
        for (const q of questions) {
            const newQuestion = new Question({
                text: q.text,
                type: q.type,
                options: q.options, // Array of strings
                answer: q.answer    // Array of strings (e.g. ['a'] or ['Paris'])
            });
            const savedQ = await newQuestion.save();
            questionIds.push(savedQ._id);
        }

        // 2. Create the Quiz linking these questions
        const newQuiz = new Quiz({
            title,
            description,
            questions: questionIds
        });

        await newQuiz.save();

        res.json({ message: 'Quiz created successfully!', quizId: newQuiz._id });
    } catch (err) {
        console.error('Error creating quiz:', err);
        res.status(500).json({ error: 'Failed to create quiz' });
    }
});

// -- Auth API Routes --
app.post('/api/signup', async (req, res) => {
    const { fullname, username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email already exists' });
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ fullname, username, email, password: hashedPassword, otp, otpExpires: Date.now() + 10 * 60 * 1000 });
        await newUser.save();
        await transporter.sendMail({ to: email, subject: 'Verify Account', text: `OTP: ${otp}` });
        res.json({ message: 'OTP sent', email });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user || user.otp !== otp || user.otpExpires < Date.now()) return res.status(400).json({ error: 'Invalid OTP' });
        user.isVerified = true; user.otp = undefined; user.otpExpires = undefined; await user.save();
        res.json({ message: 'Verified' });
    } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => res.redirect('/'));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));