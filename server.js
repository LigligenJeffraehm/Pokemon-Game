// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI);

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Pokemon Schema
const pokemonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  level: { type: Number, required: true },
  nature: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  caughtAt: { type: Date, default: Date.now }
});

// Score Schema for Leaderboard
const scoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  score: { type: Number, required: true },
  level: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Pokemon = mongoose.model('Pokemon', pokemonSchema);
const Score = mongoose.model('Score', scoreSchema);

// ============= USER ROUTES =============
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const user = new User({ username, password });
    await user.save();
    res.status(201).json({ message: 'User created successfully', userId: user._id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ message: 'Login successful', userId: user._id, username: user.username });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= POKEMON ROUTES =============
app.get('/api/pokemon/:userId', async (req, res) => {
  try {
    const pokemon = await Pokemon.find({ userId: req.params.userId });
    res.json(pokemon);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/pokemon', async (req, res) => {
  try {
    const pokemon = new Pokemon(req.body);
    await pokemon.save();
    res.status(201).json(pokemon);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/pokemon/:id', async (req, res) => {
  try {
    await Pokemon.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/pokemon/:id', async (req, res) => {
  try {
    const updatedPokemon = await Pokemon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedPokemon);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= SCORE/LEADERBOARD ROUTES =============
app.post('/api/scores', async (req, res) => {
  try {
    const score = new Score(req.body);
    await score.save();
    res.status(201).json(score);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await Score.find()
      .sort({ score: -1 })
      .limit(10);
    res.json(leaderboard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});