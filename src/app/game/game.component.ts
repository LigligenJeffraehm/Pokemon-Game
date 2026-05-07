// game.component.ts
import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PokemonService, Pokemon, Score, User } from '../pokemon.service';

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

interface WildPokemon {
  name: string;
  type: string;
  nature: string;
  level: number;
  imageUrl: string;
  icon: string;
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
  
  // ============= LOGIN STATE =============
  showLogin = signal(true);
  loginUsername = signal('');
  loginPassword = signal('');
  registerUsername = signal('');
  registerPassword = signal('');
  authError = signal('');
  isRegistering = signal(false);
  showHowToPlay = signal(false);
  
  // ============= CRUD STATE =============
  editingPokemonId = signal<string | null>(null);
  editForm = signal({ name: '', type: '', level: 0, nature: '' });
  showAddForm = signal(false);
  newPokemonForm = signal({ name: '', type: '', level: 5, nature: '' });
  
  // Admin score management
  editingScoreId = signal<string | null>(null);
  editScoreForm = signal({ score: 0, level: 0, pokemonCaught: 0 });
  
  // UI State
  showNameInput = signal(false);
  showHighScores = signal(false);
  tempPlayerName = signal('');
  
  // Game state
  gameRunning = signal(false);
  gameLoop: any;
  currentScore = signal(0);
  currentLevel = signal(1);
  pokemonCaughtCount = signal(0);
  
  // 3 Rows
  rows = [0, 1, 2];
  activePokemon = signal<GamePokemon | null>(null);
  pokemonRow = signal(1);
  
  // Pokemon queue
  pokemonQueue = signal<GamePokemon[]>([]);
  
  // Obstacles
  obstacles = signal<GameObstacle[]>([]);
  obstacleSpeed = 4;
  obstacleSpawnRate = 70;
  frameCount = 0;
  
  // Animation
  animationFrame = signal(0);
  animationInterval: any;
  isRunning = signal(false);
  
  // Row switching
  canSwitchRow = signal(true);
  switchCooldown = 250;
  
  // Catch mechanics
  showCatchPrompt = signal(false);
  wildPokemon = signal<WildPokemon | null>(null);
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
  
  // Running animation frames
  runningFrames: { [key: string]: string[] } = {
    'Pikachu': ['⚡', '⚡💨', '⚡', '⚡💨'],
    'Charmander': ['🔥', '🔥💨', '🔥', '🔥💨'],
    'Squirtle': ['💧', '💧💨', '💧', '💧💨'],
    'Bulbasaur': ['🌿', '🌿💨', '🌿', '🌿💨'],
    'Jigglypuff': ['🎵', '🎵💨', '🎵', '🎵💨'],
    'Meowth': ['💰', '💰💨', '💰', '💰💨'],
    'Eevee': ['🦊', '🦊💨', '🦊', '🦊💨']
  };
  
  availablePokemon = [
    { name: 'Pikachu', type: 'Electric', natureList: ['Jolly', 'Timid', 'Naive'], icon: '⚡' },
    { name: 'Charmander', type: 'Fire', natureList: ['Brave', 'Adamant', 'Lonely'], icon: '🔥' },
    { name: 'Squirtle', type: 'Water', natureList: ['Calm', 'Relaxed', 'Bold'], icon: '💧' },
    { name: 'Bulbasaur', type: 'Grass', natureList: ['Gentle', 'Careful', 'Docile'], icon: '🌿' },
    { name: 'Jigglypuff', type: 'Normal', natureList: ['Sassy', 'Quiet', 'Serious'], icon: '🎵' },
    { name: 'Meowth', type: 'Normal', natureList: ['Jolly', 'Hasty', 'Naive'], icon: '💰' },
    { name: 'Eevee', type: 'Normal', natureList: ['Timid', 'Bold', 'Calm'], icon: '🦊' }
  ];
  
  ngOnInit() {
    // Check if user is already logged in from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.pokemonService.currentUser.set(user);
      this.pokemonService.isLoggedIn.set(true);
      this.pokemonService.isAdmin.set(user.isAdmin);
      this.showLogin.set(false);
      this.pokemonService.fetchPokemon(user._id);
      this.pokemonService.fetchHighScores();
      this.loadUserPokemonTeam();
    }
    
    this.pokemonService.fetchHighScores();
    this.startAnimationLoop();
  }
  
  // ============= LOGIN METHODS =============
  openHowToPlay() {
  this.showHowToPlay.set(true);
}

closeHowToPlay() {
  this.showHowToPlay.set(false);
}

resetAndClear() {
  this.gameOver.set(false);
  this.gameRunning.set(false);
  this.currentScore.set(0);
  this.currentLevel.set(1);
  this.obstacles.set([]);
  this.pokemonCaughtCount.set(0);
  this.initializePokemonTeam();
}
  login() {
    if (!this.loginUsername() || !this.loginPassword()) {
      this.authError.set('Please enter username and password');
      return;
    }
    
    this.pokemonService.login(this.loginUsername(), this.loginPassword()).subscribe({
      next: (response: any) => {
        const user: User = { 
          _id: response.userId, 
          username: response.username, 
          isAdmin: response.isAdmin 
        };
        this.pokemonService.currentUser.set(user);
        this.pokemonService.isLoggedIn.set(true);
        this.pokemonService.isAdmin.set(response.isAdmin);
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        this.pokemonService.fetchPokemon(user._id);
        this.pokemonService.fetchHighScores();
        
        this.showLogin.set(false);
        this.authError.set('');
        
        this.loadUserPokemonTeam();
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
    
    this.pokemonService.register(this.registerUsername(), this.registerPassword(), false).subscribe({
      next: () => {
        this.authError.set('Registration successful! Please login.');
        this.isRegistering.set(false);
        this.loginUsername.set(this.registerUsername());
        this.registerUsername.set('');
        this.registerPassword.set('');
      },
      error: () => {
        this.authError.set('Username already exists');
      }
    });
  }
  
  logout() {
    this.pokemonService.logout();
    this.showLogin.set(true);
    this.showNameInput.set(false);
    this.gameRunning.set(false);
    this.gameOver.set(false);
    localStorage.removeItem('currentUser');
  }
  
  loadUserPokemonTeam() {
    const userPokemon = this.pokemonService.pokemonList();
    if (userPokemon.length > 0) {
      const gameTeam: GamePokemon[] = userPokemon.map((p: Pokemon) => ({
        id: p._id!,
        name: p.name,
        type: p.type,
        level: p.level,
        nature: p.nature,
        imageUrl: '',
        row: 1,
        isActive: false
      }));
      
      if (gameTeam.length > 0) {
        gameTeam[0].isActive = true;
        this.pokemonQueue.set(gameTeam);
        this.activePokemon.set(gameTeam[0]);
        gameTeam.forEach((p: GamePokemon) => {
          this.fetchPokemonImage(p.name.toLowerCase(), p);
        });
      }
    } else {
      this.initializePokemonTeam();
    }
  }
  
  // ============= ADMIN SCORE MANAGEMENT =============
  
  refreshScores() {
    this.pokemonService.fetchHighScores();
  }
  
  startScoreEdit(score: Score) {
    this.editingScoreId.set(score._id!);
    this.editScoreForm.set({
      score: score.score,
      level: score.level,
      pokemonCaught: score.pokemonCaught
    });
  }
  
  cancelScoreEdit() {
    this.editingScoreId.set(null);
    this.editScoreForm.set({ score: 0, level: 0, pokemonCaught: 0 });
  }
  
  saveScoreEdit(id: string) {
    const updatedData = this.editScoreForm();
    
    this.pokemonService.updateScore(id, updatedData).subscribe({
      next: () => {
        alert('✅ Score updated successfully!');
        this.pokemonService.fetchHighScores();
        this.cancelScoreEdit();
      },
      error: (err: Error) => {
        console.error('Update failed:', err);
        alert('Failed to update score.');
      }
    });
  }
  
  deleteScore(id: string) {
    if (confirm('Are you sure you want to delete this score?')) {
      this.pokemonService.deleteScore(id).subscribe({
        next: () => {
          alert('✅ Score deleted successfully!');
          this.pokemonService.fetchHighScores();
        },
        error: (err: Error) => {
          console.error('Delete failed:', err);
          alert('Failed to delete score.');
        }
      });
    }
  }
  
  // ============= GAME METHODS =============
  
  startGameWithName() {
    if (!this.tempPlayerName() || this.tempPlayerName().trim() === '') {
      alert('Please enter your name!');
      return;
    }
    this.pokemonService.setPlayerName(this.tempPlayerName());
    this.showNameInput.set(false);
    this.startGame();
  }
  
  startAnimationLoop() {
    this.animationInterval = setInterval(() => {
      if (this.gameRunning() && !this.catchInProgress() && !this.gameOver()) {
        this.animationFrame.update(frame => (frame + 1) % 4);
        this.isRunning.set(true);
      } else if (!this.gameRunning()) {
        this.isRunning.set(false);
      }
    }, 150);
  }
  
  initializePokemonTeam() {
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
  
  getPokemonIcon(pokemonName: string): string {
    const icons: {[key: string]: string} = {
      'Pikachu': '⚡', 'Charmander': '🔥', 'Squirtle': '💧',
      'Bulbasaur': '🌿', 'Jigglypuff': '🎵', 'Meowth': '💰',
      'Psyduck': '🦆', 'Growlithe': '🐕', 'Eevee': '🦊',
      'Snorlax': '😴', 'Magikarp': '🐟', 'Gyarados': '🐉',
      'Zubat': '🦇', 'Charizard': '🐲', 'Arceus': '👑'
    };
    return icons[pokemonName] || '🐾';
  }
  
  // ============= CRUD METHODS =============
  
  showAddPokemonForm() {
    this.newPokemonForm.set({ name: '', type: '', level: 5, nature: '' });
    this.showAddForm.set(true);
  }
  
  cancelAddPokemon() {
    this.showAddForm.set(false);
  }
  
  addNewPokemon() {
    const newPokemon = this.newPokemonForm();
    const userId = this.pokemonService.currentUser()?._id;
    
    if (!userId) {
      alert('Please login first!');
      return;
    }
    
    if (!newPokemon.name || !newPokemon.type || !newPokemon.nature) {
      alert('Please fill in all fields!');
      return;
    }
    
    if (newPokemon.level < 1 || newPokemon.level > 100) {
      alert('Level must be between 1 and 100!');
      return;
    }
    
    const pokemonToSave = {
      name: newPokemon.name,
      type: newPokemon.type,
      level: Number(newPokemon.level),
      nature: newPokemon.nature,
      userId: userId
    };
    
    this.pokemonService.savePokemon(pokemonToSave).subscribe({
      next: (savedPokemon: Pokemon) => {
        alert(`✅ ${savedPokemon.name} added to inventory!`);
        this.pokemonService.fetchPokemon(userId);
        this.showAddForm.set(false);
        
        if (!this.gameRunning() && !this.gameOver()) {
          this.fetchPokemonImage(savedPokemon.name.toLowerCase(), {
            id: savedPokemon._id!,
            name: savedPokemon.name,
            type: savedPokemon.type,
            level: savedPokemon.level,
            nature: savedPokemon.nature,
            imageUrl: '',
            row: 1,
            isActive: false
          } as GamePokemon);
        }
      },
      error: (err: Error) => {
        console.error('Failed to add Pokemon:', err);
        alert('Failed to add Pokemon. Please try again.');
      }
    });
  }
  
  startEdit(pokemon: Pokemon) {
    this.editingPokemonId.set(pokemon._id!);
    this.editForm.set({
      name: pokemon.name,
      type: pokemon.type,
      level: pokemon.level,
      nature: pokemon.nature
    });
  }
  
  cancelEdit() {
    this.editingPokemonId.set(null);
    this.editForm.set({ name: '', type: '', level: 0, nature: '' });
  }
  
  saveEdit(id: string) {
    const updatedData = this.editForm();
    
    if (!updatedData.name || !updatedData.type || !updatedData.nature) {
      alert('Please fill in all fields!');
      return;
    }
    
    if (updatedData.level < 1 || updatedData.level > 100) {
      alert('Level must be between 1 and 100!');
      return;
    }
    
    this.pokemonService.updatePokemon(id, updatedData).subscribe({
      next: (updatedPokemon: Pokemon) => {
        alert(`✅ ${updatedPokemon.name} has been updated!`);
        const userId = this.pokemonService.currentUser()?._id;
        if (userId) {
          this.pokemonService.fetchPokemon(userId);
        }
        this.cancelEdit();
        
        const queueIndex = this.pokemonQueue().findIndex(p => p.id === id);
        if (queueIndex !== -1) {
          const updatedQueue = [...this.pokemonQueue()];
          updatedQueue[queueIndex] = {
            ...updatedQueue[queueIndex],
            name: updatedPokemon.name,
            type: updatedPokemon.type,
            level: updatedPokemon.level,
            nature: updatedPokemon.nature
          };
          this.pokemonQueue.set(updatedQueue);
          
          if (this.activePokemon()?.id === id) {
            this.activePokemon.set(updatedQueue[queueIndex]);
          }
        }
      },
      error: (err: Error) => {
        console.error('Update failed:', err);
        alert('Failed to update Pokemon. Please try again.');
      }
    });
  }
  
  deletePokemonFromInventory(id: string) {
    const pokemonToDelete = this.pokemonService.pokemonList().find(p => p._id === id);
    
    if (confirm(`Are you sure you want to release ${pokemonToDelete?.name}?`)) {
      this.pokemonService.deletePokemon(id).subscribe({
        next: () => {
          alert(`💔 ${pokemonToDelete?.name} has been released!`);
          const userId = this.pokemonService.currentUser()?._id;
          if (userId) {
            this.pokemonService.fetchPokemon(userId);
          }
          
          const updatedQueue = this.pokemonQueue().filter(p => p.id !== id);
          this.pokemonQueue.set(updatedQueue);
          
          if (this.activePokemon()?.id === id && updatedQueue.length > 0) {
            const nextPokemon = { ...updatedQueue[0], isActive: true };
            this.activePokemon.set(nextPokemon);
          } else if (updatedQueue.length === 0 && this.gameRunning()) {
            this.endGame();
          }
        },
        error: (err: Error) => {
          console.error('Delete failed:', err);
          alert('Failed to delete Pokemon. Please try again.');
        }
      });
    }
  }
  
  // ============= RUNNING & MOVEMENT =============
  
  getCurrentAnimationFrame(): string {
    const pokemon = this.activePokemon();
    if (!pokemon) return '⚡';
    
    const frames = this.runningFrames[pokemon.name];
    if (!frames) return this.isRunning() ? '🏃' : '⚡';
    
    if (this.isRunning() && this.gameRunning()) {
      return frames[this.animationFrame()];
    }
    return frames[0] || '⚡';
  }
  
  getRunningFrame(pokemonName: string): string {
    const frames = this.runningFrames[pokemonName];
    return frames ? frames[0] : '⚡';
  }
  
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (this.showLogin() || this.showHighScores() || this.showNameInput()) return;
    
    if (!this.gameRunning() || this.catchInProgress() || this.showCatchPrompt()) return;
    
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveRow(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveRow(1);
    }
  }
  
  moveRow(direction: number) {
    if (!this.canSwitchRow()) return;
    
    const newRow = this.pokemonRow() + direction;
    if (newRow >= 0 && newRow <= 2) {
      this.pokemonRow.set(newRow);
      this.canSwitchRow.set(false);
      
      this.switchMessage.set(`Moving to ${newRow === 0 ? 'Top' : newRow === 1 ? 'Middle' : 'Bottom'} row!`);
      setTimeout(() => this.switchMessage.set(''), 500);
      
      setTimeout(() => {
        this.canSwitchRow.set(true);
      }, this.switchCooldown);
    }
  }
  
  startGame() {
    console.log('Game started');
    this.gameRunning.set(true);
    this.gameOver.set(false);
    this.currentScore.set(0);
    this.currentLevel.set(1);
    this.obstacles.set([]);
    this.obstacleSpeed = 4;
    this.obstacleSpawnRate = 70;
    this.frameCount = 0;
    this.pokemonRow.set(1);
    this.animationFrame.set(0);
    this.isRunning.set(true);
    
    this.gameLoop = requestAnimationFrame(() => this.updateGame());
  }
  
  updateGame() {
    if (!this.gameRunning()) return;
    
    this.frameCount++;
    if (this.frameCount >= this.obstacleSpawnRate) {
      this.spawnObstacle();
      this.frameCount = 0;
    }
    
    const updatedObstacles = this.obstacles()
      .map(obs => ({ ...obs, x: obs.x - this.obstacleSpeed }))
      .filter(obs => obs.x > -60);
    
    this.obstacles.set(updatedObstacles);
    this.checkCollisions();
    this.currentScore.update(s => s + 1);
    
    const newLevel = Math.floor(this.currentScore() / 800) + 1;
    if (newLevel > this.currentLevel()) {
      this.levelUp();
    }
    
    this.obstacleSpeed = 4 + Math.floor(this.currentScore() / 1500);
    this.obstacleSpawnRate = Math.max(45, 70 - Math.floor(this.currentScore() / 400));
    
    this.gameLoop = requestAnimationFrame(() => this.updateGame());
  }
  
  spawnObstacle() {
  const row = Math.floor(Math.random() * 3);
  const pokeballTypes = [
    { type: 'pokeball', icon: '⚪', name: 'Pokeball' },
    { type: 'greatball', icon: '🔵', name: 'Great Ball' },
    { type: 'ultraball', icon: '🟡', name: 'Ultra Ball' },
    { type: 'masterball', icon: '🟣', name: 'Master Ball' }
  ];
  const randomBall = pokeballTypes[Math.floor(Math.random() * pokeballTypes.length)];
  
  const obstacle = {
    id: Date.now() + Math.random(),
    x: 800,
    row: row,
    type: randomBall.type,
    icon: randomBall.icon
  };
  
  this.obstacles.update(obs => [...obs, obstacle]);
}
  
  checkCollisions() {
    const currentRow = this.pokemonRow();
    const obstaclesInRow = this.obstacles().filter(obs => obs.row === currentRow);
    
    for (const obstacle of obstaclesInRow) {
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
    this.isRunning.set(false);
    
    if (activePoke.id !== 'starter') {
      this.pokemonService.deletePokemon(activePoke.id).subscribe(() => {
        const userId = this.pokemonService.currentUser()?._id;
        if (userId) {
          this.pokemonService.fetchPokemon(userId);
        }
      });
    }
    
    this.deathMessage.set(`💀 ${activePoke.name} fainted! 💀`);
    setTimeout(() => this.deathMessage.set(''), 1500);
    
    const updatedQueue = this.pokemonQueue().filter(p => p.id !== activePoke.id);
    
    if (updatedQueue.length > 0) {
      const nextPokemon = { ...updatedQueue[0], isActive: true, row: 1 };
      this.pokemonQueue.set(updatedQueue);
      this.activePokemon.set(nextPokemon);
      this.pokemonRow.set(1);
      
      setTimeout(() => {
        this.gameRunning.set(true);
        this.isRunning.set(true);
        this.gameLoop = requestAnimationFrame(() => this.updateGame());
      }, 1500);
    } else {
      this.endGame();
    }
  }
  
  async levelUp() {
    this.currentLevel.update(l => l + 1);
    this.levelUpMessage.set(`🎉 Level ${this.currentLevel()}! A wild Pokemon appears! 🎉`);
    setTimeout(() => this.levelUpMessage.set(''), 2000);
    
    this.gameRunning.set(false);
    this.isRunning.set(false);
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
      
      this.wildPokemon.set({
        name: pokemonRef.name,
        type: pokemonRef.type,
        nature: randomNature,
        level: this.currentLevel(),
        imageUrl: imageUrl,
        icon: pokemonRef.icon
      });
      
      console.log('Wild Pokemon appeared:', this.wildPokemon()?.name);
      
      this.isLoadingPokemon.set(false);
      this.showCatchPrompt.set(true);
    } catch (error) {
      console.error('Error:', error);
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
    const currentWildPokemon = this.wildPokemon();
    if (!currentWildPokemon) {
      console.error('No wild pokemon to catch');
      return;
    }
    
    clearInterval(this.catchTimer);
    
    const guessedName = this.pokemonNameInput().toLowerCase().trim();
    const actualName = currentWildPokemon.name.toLowerCase();
    
    console.log('=== CATCH ATTEMPT ===');
    console.log('Guessed name:', guessedName);
    console.log('Actual name:', actualName);
    console.log('Match:', guessedName === actualName);
    
    if (guessedName === actualName) {
      this.catchSuccess();
    } else {
      this.catchFailed();
    }
  }
  
  catchSuccess() {
    const currentWildPokemon = this.wildPokemon();
    if (!currentWildPokemon) return;
    
    const userId = this.pokemonService.currentUser()?._id;
    if (!userId) {
      alert('Please login to catch Pokemon!');
      this.resumeGame();
      return;
    }
    
    console.log('Catch success! Saving:', currentWildPokemon.name);
    
    const newPokemon = {
      name: currentWildPokemon.name,
      type: currentWildPokemon.type,
      level: currentWildPokemon.level,
      nature: currentWildPokemon.nature,
      userId: userId
    };
    
    this.pokemonService.savePokemon(newPokemon).subscribe({
      next: (savedPokemon: any) => {
        console.log('Pokemon saved successfully:', savedPokemon);
        this.pokemonCaughtCount.update(c => c + 1);
        
        const gamePokemon: GamePokemon = {
          id: savedPokemon._id!,
          name: savedPokemon.name,
          type: savedPokemon.type,
          level: savedPokemon.level,
          nature: savedPokemon.nature,
          imageUrl: currentWildPokemon.imageUrl,
          row: 1,
          isActive: false
        };
        
        this.pokemonQueue.update(queue => [...queue, gamePokemon]);
        this.pokemonService.fetchPokemon(userId);
        alert(`🎉 Success! ${currentWildPokemon.name} was added to your team! 🎉`);
        this.resumeGame();
      },
      error: (err: Error) => {
        console.error('Save failed:', err);
        alert('Failed to save Pokemon. Please check if server is running.');
        this.resumeGame();
      }
    });
  }
  
  catchFailed() {
    const currentWildPokemon = this.wildPokemon();
    console.log('Catch failed for:', currentWildPokemon?.name);
    alert(`❌ ${currentWildPokemon?.name || 'Pokemon'} escaped! ❌`);
    this.resumeGame();
  }
  
  resumeGame() {
    this.catchInProgress.set(false);
    this.wildPokemon.set(null);
    this.pokemonNameInput.set('');
    this.timeLeft.set(15);
    this.showCatchPrompt.set(false);
    
    if (this.catchTimer) {
      clearInterval(this.catchTimer);
    }
    
    if (!this.gameOver()) {
      this.gameRunning.set(true);
      this.isRunning.set(true);
      this.gameLoop = requestAnimationFrame(() => this.updateGame());
    }
  }
  
  endGame() {
    this.gameRunning.set(false);
    this.isRunning.set(false);
    this.gameOver.set(true);
    
    const userId = this.pokemonService.currentUser()?._id;
    const username = this.pokemonService.currentUser()?.username;
    
    if (userId && username) {
      const scoreData = {
        userId: userId,
        username: username,
        score: this.currentScore(),
        level: this.currentLevel(),
        pokemonCaught: this.pokemonCaughtCount()
      };
      
      this.pokemonService.saveScore(scoreData).subscribe({
        next: () => {
          console.log('Score saved successfully');
          this.pokemonService.fetchHighScores();
        },
        error: (err: Error) => {
          console.error('Failed to save score:', err);
        }
      });
    }
  }
  
  resetGame() {
    this.pokemonCaughtCount.set(0);
    this.initializePokemonTeam();
    this.startGame();
  }
  
  viewHighScores() {
    this.showHighScores.set(true);
    this.pokemonService.fetchHighScores();
  }
  
  closeHighScores() {
    this.showHighScores.set(false);
  }
  
  backToNameInput() {
    this.showNameInput.set(true);
    this.gameOver.set(false);
    this.showHighScores.set(false);
  }
  
  ngOnDestroy() {
    if (this.gameLoop) {
      cancelAnimationFrame(this.gameLoop);
    }
    if (this.catchTimer) {
      clearInterval(this.catchTimer);
    }
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }
  }
}