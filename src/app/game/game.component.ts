// game.component.ts
import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PokemonService, Pokemon, Score } from '../pokemon.service';

interface GameObstacle {
  id: number;
  x: number;
  row: number;
  type: string;
  icon: string;
}

interface GamePokemon {
  id: string;
  name: string;
  type: string;
  level: number;
  nature: string;
  imageUrl: string;
  row: number;
  isActive: boolean;
}

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  pokemonService = inject(PokemonService);
  
  // Authentication
  showLogin = signal(true);
  loginUsername = signal('');
  loginPassword = signal('');
  registerUsername = signal('');
  registerPassword = signal('');
  authError = signal('');
  
  // Game state
  gameRunning = signal(false);
  gameLoop: any;
  score = signal(0);
  level = signal(1);
  
  // 3 Rows for running
  rows = [0, 1, 2];
  activePokemon = signal<GamePokemon | null>(null);
  pokemonRow = signal(1); // Middle row initially
  
  // Pokemon queue (lineup)
  pokemonQueue = signal<GamePokemon[]>([]);
  
  // Obstacles
  obstacles = signal<GameObstacle[]>([]);
  obstacleSpeed = 3;
  obstacleSpawnRate = 80;
  frameCount = 0;
  
  // Row switching cooldown
  canSwitchRow = signal(true);
  switchCooldown = 300; // ms
  
  // Catch mechanics
  showCatchPrompt = signal(false);
  wildPokemon: any = null;
  catchTimer: any;
  timeLeft = signal(15);
  pokemonNameInput = signal('');
  catchInProgress = signal(false);
  gameOver = signal(false);
  isLoadingPokemon = signal(false);
  
  // Messages
  deathMessage = signal('');
  switchMessage = signal('');
  levelUpMessage = signal('');
  
  // Available Pokemon to catch
  availablePokemon = [
    { name: 'Pikachu', type: 'Electric', natureList: ['Jolly', 'Timid', 'Naive'], icon: '⚡' },
    { name: 'Charmander', type: 'Fire', natureList: ['Brave', 'Adamant', 'Lonely'], icon: '🔥' },
    { name: 'Squirtle', type: 'Water', natureList: ['Calm', 'Relaxed', 'Bold'], icon: '💧' },
    { name: 'Bulbasaur', type: 'Grass', natureList: ['Gentle', 'Careful', 'Docile'], icon: '🌿' },
    { name: 'Jigglypuff', type: 'Normal', natureList: ['Sassy', 'Quiet', 'Serious'], icon: '🎵' },
    { name: 'Meowth', type: 'Normal', natureList: ['Jolly', 'Hasty', 'Naive'], icon: '💰' },
    { name: 'Psyduck', type: 'Water', natureList: ['Sassy', 'Modest', 'Quirky'], icon: '🦆' },
    { name: 'Growlithe', type: 'Fire', natureList: ['Adamant', 'Impish', 'Lax'], icon: '🐕' },
    { name: 'Eevee', type: 'Normal', natureList: ['Timid', 'Bold', 'Calm'], icon: '🦊' },
    { name: 'Snorlax', type: 'Normal', natureList: ['Adamant', 'Impish', 'Careful'], icon: '😴' }
  ];
  
  ngOnInit() {
    // Check for saved user
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.pokemonService.currentUser.set(user);
      this.pokemonService.isLoggedIn.set(true);
      this.showLogin.set(false);
      this.loadUserData();
    }
  }
  
  loadUserData() {
    const userId = this.pokemonService.currentUser()?._id;
    if (userId) {
      this.pokemonService.fetchPokemon(userId);
      this.initializePokemonTeam();
    }
  }
  
  initializePokemonTeam() {
    // Start with Pikachu
    const starterPokemon: GamePokemon = {
      id: 'starter',
      name: 'Pikachu',
      type: 'Electric',
      level: 5,
      nature: 'Jolly',
      imageUrl: '',
      row: 1,
      isActive: true
    };
    
    this.pokemonQueue.set([starterPokemon]);
    this.activePokemon.set(starterPokemon);
    this.fetchPokemonImage('pikachu', starterPokemon);
  }
  
  async fetchPokemonImage(pokemonName: string, gamePokemon: GamePokemon) {
    try {
      const imageUrl = await this.getPokemonImage(pokemonName);
      gamePokemon.imageUrl = imageUrl;
      this.activePokemon.set({ ...gamePokemon });
      
      // Update queue
      const updatedQueue = this.pokemonQueue().map(p => 
        p.id === gamePokemon.id ? { ...p, imageUrl } : p
      );
      this.pokemonQueue.set(updatedQueue);
    } catch (error) {
      console.error('Error fetching image:', error);
    }
  }
  
  getPokemonImage(pokemonName: string): Promise<string> {
    return new Promise((resolve) => {
      this.http.get(`https://pokeapi.co/api/v2/pokemon/${pokemonName.toLowerCase()}`)
        .subscribe({
          next: (data: any) => {
            const imageUrl = data.sprites.other['official-artwork'].front_default || 
                            data.sprites.front_default;
            resolve(imageUrl);
          },
          error: () => resolve('')
        });
    });
  }
  
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (!this.gameRunning() || this.catchInProgress() || this.showCatchPrompt()) return;
    
    switch(event.key) {
      case 'ArrowUp':
        event.preventDefault();
        this.moveRow(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveRow(1);
        break;
      case ' ':
      case 'Space':
        event.preventDefault();
        // Space can be used for special ability if needed
        break;
    }
  }
  
  moveRow(direction: number) {
    if (!this.canSwitchRow()) return;
    
    const newRow = this.pokemonRow() + direction;
    if (newRow >= 0 && newRow <= 2) {
      this.pokemonRow.set(newRow);
      this.canSwitchRow.set(false);
      
      // Show switch message
      this.switchMessage.set(`Moving to ${newRow === 0 ? 'Top' : newRow === 1 ? 'Middle' : 'Bottom'} row!`);
      setTimeout(() => this.switchMessage.set(''), 500);
      
      setTimeout(() => {
        this.canSwitchRow.set(true);
      }, this.switchCooldown);
    }
  }
  
  startGame() {
    this.gameRunning.set(true);
    this.gameOver.set(false);
    this.score.set(0);
    this.level.set(1);
    this.obstacles.set([]);
    this.obstacleSpeed = 3;
    this.obstacleSpawnRate = 80;
    this.frameCount = 0;
    this.pokemonRow.set(1);
    
    this.gameLoop = requestAnimationFrame(() => this.updateGame());
  }
  
  updateGame() {
    if (!this.gameRunning()) return;
    
    // Update obstacles
    this.updateObstacles();
    
    // Spawn obstacles
    this.spawnObstacles();
    
    // Check collisions
    this.checkCollisions();
    
    // Update score
    this.score.update(s => s + 1);
    
    // Level up every 1000 points
    const newLevel = Math.floor(this.score() / 1000) + 1;
    if (newLevel > this.level()) {
      this.levelUp();
    }
    
    // Increase difficulty over time
    this.obstacleSpeed = 3 + Math.floor(this.score() / 2000);
    this.obstacleSpawnRate = Math.max(50, 80 - Math.floor(this.score() / 500));
    
    this.gameLoop = requestAnimationFrame(() => this.updateGame());
  }
  
  updateObstacles() {
    const updatedObstacles = this.obstacles()
      .map(obs => ({ ...obs, x: obs.x - this.obstacleSpeed }))
      .filter(obs => obs.x > -50);
    
    this.obstacles.set(updatedObstacles);
  }
  
  spawnObstacles() {
    this.frameCount++;
    if (this.frameCount >= this.obstacleSpawnRate) {
      const row = Math.floor(Math.random() * 3);
      const obstacleTypes = [
        { type: 'fire', icon: '🔥' },
        { type: 'rock', icon: '🪨' },
        { type: 'water', icon: '💧' },
        { type: 'thorn', icon: '🌵' }
      ];
      const randomType = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
      
      const obstacle: GameObstacle = {
        id: Date.now(),
        x: 800,
        row: row,
        type: randomType.type,
        icon: randomType.icon
      };
      
      this.obstacles.update(obs => [...obs, obstacle]);
      this.frameCount = 0;
    }
  }
  
  checkCollisions() {
    const currentRow = this.pokemonRow();
    const collisionObstacles = this.obstacles().filter(obs => obs.row === currentRow);
    
    for (const obstacle of collisionObstacles) {
      // Check if obstacle is near the player (player at x=100)
      if (obstacle.x < 150 && obstacle.x > 50) {
        this.pokemonHit();
        break;
      }
    }
  }
  
  pokemonHit() {
    const activePoke = this.activePokemon();
    if (!activePoke) return;
    
    this.gameRunning.set(false);
    
    // Remove from MongoDB if not starter
    if (activePoke.id !== 'starter') {
      this.pokemonService.deletePokemon(activePoke.id).subscribe();
    }
    
    this.deathMessage.set(`💀 ${activePoke.name} fainted! 💀`);
    setTimeout(() => this.deathMessage.set(''), 1500);
    
    // Remove from queue
    const updatedQueue = this.pokemonQueue().filter(p => p.id !== activePoke.id);
    
    if (updatedQueue.length > 0) {
      // Switch to next Pokemon
      const nextPokemon = { ...updatedQueue[0], isActive: true, row: 1 };
      this.pokemonQueue.set(updatedQueue);
      this.activePokemon.set(nextPokemon);
      this.pokemonRow.set(1);
      
      setTimeout(() => {
        this.gameRunning.set(true);
        this.gameLoop = requestAnimationFrame(() => this.updateGame());
      }, 1500);
    } else {
      // Game Over - Save score
      this.endGame();
    }
  }
  
  async levelUp() {
    this.level.update(l => l + 1);
    this.levelUpMessage.set(`🎉 Level ${this.level()}! A wild Pokemon appears! 🎉`);
    setTimeout(() => this.levelUpMessage.set(''), 2000);
    
    // Pause game for encounter
    this.gameRunning.set(false);
    await this.encounterPokemon();
  }
  
  async encounterPokemon() {
    this.catchInProgress.set(true);
    this.isLoadingPokemon.set(true);
    
    const randomIndex = Math.floor(Math.random() * this.availablePokemon.length);
    const pokemonRef = this.availablePokemon[randomIndex];
    const randomNature = pokemonRef.natureList[Math.floor(Math.random() * pokemonRef.natureList.length)];
    
    try {
      const imageUrl = await this.getPokemonImage(pokemonRef.name);
      
      this.wildPokemon = {
        name: pokemonRef.name,
        type: pokemonRef.type,
        nature: randomNature,
        level: this.level(),
        imageUrl: imageUrl,
        icon: pokemonRef.icon
      };
      
      this.isLoadingPokemon.set(false);
      this.showCatchPrompt.set(true);
    } catch (error) {
      this.isLoadingPokemon.set(false);
      this.resumeGame();
    }
  }
  
  runAway() {
    this.showCatchPrompt.set(false);
    this.resumeGame();
  }
  
  attemptCatch() {
    this.showCatchPrompt.set(false);
    this.startNameTimer();
  }
  
  startNameTimer() {
    this.timeLeft.set(15);
    this.pokemonNameInput.set('');
    
    this.catchTimer = setInterval(() => {
      this.timeLeft.update(t => t - 1);
      
      if (this.timeLeft() <= 0) {
        clearInterval(this.catchTimer);
        this.catchFailed();
      }
    }, 1000);
  }
  
  submitPokemonName() {
    if (!this.wildPokemon) return;
    
    clearInterval(this.catchTimer);
    
    if (this.pokemonNameInput().toLowerCase() === this.wildPokemon.name.toLowerCase()) {
      this.catchSuccess();
    } else {
      this.catchFailed();
    }
  }
  
  catchSuccess() {
    if (!this.wildPokemon) return;
    
    const userId = this.pokemonService.currentUser()?._id;
    if (!userId) return;
    
    const newPokemon: Omit<Pokemon, '_id'> = {
      name: this.wildPokemon.name,
      type: this.wildPokemon.type,
      level: this.wildPokemon.level,
      nature: this.wildPokemon.nature,
      userId: userId
    };
    
    this.pokemonService.savePokemon(newPokemon).subscribe({
      next: (savedPokemon) => {
        // Add to game queue
        const gamePokemon: GamePokemon = {
          id: savedPokemon._id!,
          name: savedPokemon.name,
          type: savedPokemon.type,
          level: savedPokemon.level,
          nature: savedPokemon.nature,
          imageUrl: this.wildPokemon.imageUrl,
          row: 1,
          isActive: false
        };
        
        this.pokemonQueue.update(queue => [...queue, gamePokemon]);
        alert(`🎉 Success! ${this.wildPokemon.name} was added to your team! 🎉`);
        this.resumeGame();
      },
      error: () => {
        alert('Failed to save Pokemon');
        this.resumeGame();
      }
    });
  }
  
  catchFailed() {
    alert(`❌ ${this.wildPokemon?.name} escaped! ❌`);
    this.resumeGame();
  }
  
  resumeGame() {
    this.catchInProgress.set(false);
    this.wildPokemon = null;
    this.pokemonNameInput.set('');
    this.timeLeft.set(15);
    
    if (this.catchTimer) {
      clearInterval(this.catchTimer);
    }
    
    if (!this.gameOver()) {
      this.gameRunning.set(true);
      this.gameLoop = requestAnimationFrame(() => this.updateGame());
    }
  }
  
  endGame() {
    this.gameRunning.set(false);
    this.gameOver.set(true);
    
    // Save score to leaderboard
    const userId = this.pokemonService.currentUser()?._id;
    const username = this.pokemonService.currentUser()?.username;
    
    if (userId && username) {
      const scoreData: Score = {
        userId: userId,
        username: username,
        score: this.score(),
        level: this.level()
      };
      
      this.pokemonService.saveScore(scoreData).subscribe();
      this.pokemonService.fetchLeaderboard();
    }
  }
  
  resetGame() {
    this.initializePokemonTeam();
    this.startGame();
  }
  
  login() {
    if (!this.loginUsername() || !this.loginPassword()) {
      this.authError.set('Please enter username and password');
      return;
    }
    
    this.pokemonService.login(this.loginUsername(), this.loginPassword()).subscribe({
      next: (response: any) => {
        const user = { _id: response.userId, username: response.username };
        this.pokemonService.currentUser.set(user);
        this.pokemonService.isLoggedIn.set(true);
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.showLogin.set(false);
        this.loadUserData();
        this.authError.set('');
      },
      error: () => {
        this.authError.set('Invalid credentials');
      }
    });
  }
  
  register() {
    if (!this.registerUsername() || !this.registerPassword()) {
      this.authError.set('Please enter username and password');
      return;
    }
    
    this.pokemonService.register(this.registerUsername(), this.registerPassword()).subscribe({
      next: () => {
        // Auto login after registration
        this.loginUsername.set(this.registerUsername());
        this.loginPassword.set(this.registerPassword());
        this.login();
      },
      error: () => {
        this.authError.set('Username already exists');
      }
    });
  }
  
  ngOnDestroy() {
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
    }
    if (this.catchTimer) {
      clearInterval(this.catchTimer);
    }
  }
}