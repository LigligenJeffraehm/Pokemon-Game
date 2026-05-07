// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// SIMPLE CONNECTION - Same as your working version
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ============= SCHEMAS =============

// Original Pokemon Schema (keep as is)
const pokemonSchema = new mongoose.Schema({
  name: String,
  type: String,
  level: Number,
  nature: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Add this for user association
  caughtAt: { type: Date, default: Date.now }
});

// User Schema (new)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Score Schema (new)
const scoreSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String,
  score: Number,
  level: Number,
  pokemonCaught: Number,
  date: { type: Date, default: Date.now }
});

const Pokemon = mongoose.model('Pokemon', pokemonSchema);
const User = mongoose.model('User', userSchema);
const Score = mongoose.model('Score', scoreSchema);

// ============= ORIGINAL POKEMON ROUTES (Keep working) =============

app.get('/api/pokemon', async (req, res) => {
  try {
    const pokemon = await Pokemon.find();
    res.send(pokemon);
    console.log("Fetched all pokemon");
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/pokemon/user/:userId', async (req, res) => {
  try {
    const pokemon = await Pokemon.find({ userId: req.params.userId });
    res.send(pokemon);
    console.log(`Fetched ${pokemon.length} pokemon for user ${req.params.userId}`);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/pokemon', async (req, res) => {
  try {
    const pokemon = new Pokemon(req.body);
    await pokemon.save();
    res.send(pokemon);
    console.log("Added new Pokemon: ", pokemon.name);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/pokemon/:id', async (req, res) => {
  try {
    await Pokemon.findByIdAndDelete(req.params.id);
    res.status(204).send();
    console.log("Deleted Pokemon:", req.params.id);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/pokemon/:id', async (req, res) => {
  try {
    const updatePokemon = await Pokemon.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.send(updatePokemon);
    console.log("Updated Pokemon:", updatePokemon?.name);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= NEW USER AUTH ROUTES =============

app.post('/api/register', async (req, res) => {
  console.log('📝 Registration:', req.body.username);
  
  try {
    const { username, password, isAdmin } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const user = new User({ username, password, isAdmin: isAdmin || false });
    await user.save();
    console.log('✅ User created:', username);
    
    res.status(201).json({ 
      message: 'User created successfully', 
      userId: user._id, 
      isAdmin: user.isAdmin 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  console.log('🔐 Login:', req.body.username);
  
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username, password });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    console.log('✅ Login successful:', username);
    res.json({ 
      message: 'Login successful', 
      userId: user._id, 
      username: user.username, 
      isAdmin: user.isAdmin 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= SCORE ROUTES =============

app.post('/api/scores', async (req, res) => {
  try {
    const score = new Score(req.body);
    await score.save();
    res.status(201).json(score);
    console.log("Score saved for:", req.body.username);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/scores', async (req, res) => {
  try {
    const scores = await Score.find().sort({ score: -1 }).limit(20);
    res.json(scores);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/scores/user/:userId', async (req, res) => {
  try {
    const scores = await Score.find({ userId: req.params.userId }).sort({ score: -1 });
    res.json(scores);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/scores/:id', async (req, res) => {
  try {
    const updatedScore = await Score.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedScore);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/scores/:id', async (req, res) => {
  try {
    await Score.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============= TEST ROUTE =============
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!', timestamp: new Date() });
});

// ============= CREATE ADMIN USER =============
async function createAdminIfNotExists() {
  try {
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
      const admin = new User({ username: 'admin', password: 'admin123', isAdmin: true });
      await admin.save();
      console.log('✅ Admin user created - Username: admin, Password: admin123');
    }
  } catch (error) {
    console.error('Error checking/creating admin:', error.message);
  }
}

// Wait for connection then create admin
mongoose.connection.once('connected', () => {
  createAdminIfNotExists();
});

// ============= START SERVER =============
app.listen(3000, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     🚀 SERVER RUNNING ON PORT 3000                  ║
╠══════════════════════════════════════════════════════╣
║  http://localhost:3000                              ║
║                                                     ║
║  Test: http://localhost:3000/api/test              ║
║  Pokemon: http://localhost:3000/api/pokemon        ║
║  Users: http://localhost:3000/api/users            ║
║  Scores: http://localhost:3000/api/scores          ║
╚══════════════════════════════════════════════════════╝
  `);
});