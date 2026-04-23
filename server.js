require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
//npx run server.js
//OR npx nodemon server.js


const Pokemon = mongoose.model ('pokemon', new mongoose.Schema(
    {
    name: String,
    type: String,
    level: Number,
    nature: String
    }
));

//request to fecth data from database

app.get('/api/pokemon', async (requestAnimationFrame,res)=>{
    const pokemon =await Pokemon.find();
    res.send(pokemon);
    console.log("Fetched all pokemon")
})
    
//request to save
app.post('/api/pokemon', async(req, res)=>{
    const pokemon = new Pokemon(req.body);
    await pokemon.save();
    res.send (pokemon);
    console.log("Added new Pokemon: ", pokemon);
})

//delete request for data
app.delete('/api/pokemon/:id', async(req, res)=>{
    await Pokemon.findByIdAndDelete(req.params.id);
    res.status(204).send;//205 means we have successful deletion
})

//update request for the data
app.put('/api/pokemon/:id', async (req,res) =>{
    const updatePokemon = await Pokemon.findByIdAndUpdate(req.params.id, req.body, {new: true});
    res.send(updatePokemon);
})