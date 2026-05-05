// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI);

// Pokemon Schema
const pokemonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  level: { type: Number, required: true },
  nature: { type: String, required: true },
  caughtAt: { type: Date, default: Date.now }
});

// Score Schema for leaderboard
const scoreSchema = new mongoose.Schema({
  playerName: { type: String, default: "Trainer" },
  score: { type: Number, required: true },
  level: { type: Number, required: true },
  pokemonCaught: { type: Number, default: 0 },
  date: { type: Date, default: Date.now }
});

const Pokemon = mongoose.model('Pokemon', pokemonSchema);
const Score = mongoose.model('Score', scoreSchema);

// ============= POKEMON ROUTES =============
app.get('/api/pokemon', async (req, res) => {
  try {
    const pokemon = await Pokemon.find().sort({ caughtAt: -1 });
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

// ============= SCORE ROUTES =============
app.post('/api/scores', async (req, res) => {
  try {
    const { playerName, score, level, pokemonCaught } = req.body;
    const newScore = new Score({ 
      playerName: playerName || "Trainer", 
      score, 
      level, 
      pokemonCaught: pokemonCaught || 0 
    });
    await newScore.save();
    res.status(201).json(newScore);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/scores', async (req, res) => {
  try {
    const scores = await Score.find().sort({ score: -1 }).limit(10);
    res.json(scores);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/scores', async (req, res) => {
  try {
    await Score.deleteMany({});
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});