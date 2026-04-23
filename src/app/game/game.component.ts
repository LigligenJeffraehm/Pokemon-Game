
import { Component,OnInit,OnDestroy,AfterViewInit,ElementRef,ViewChild,inject,signal, } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PokemonService } from '../pokemon.service';
import { Pokemon } from '../pokemon.model';

interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  img: HTMLImageElement;
}
 
interface Cloud {
  x: number;
  y: number;
  speed: number;
}
@Component({
  selector: 'app-game',
  imports: [CommonModule, FormsModule],
  standalone:true,
  templateUrl: './game.component.html',
  styleUrl: './game.component.css'
})
export class GameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
 
  private pokemonService = inject(PokemonService);
 
  // ── Game state ──────────────────────────────────────────────────────────────
  score = signal(0);
  highScore = signal(0);
  gameOver = signal(false);
  gameStarted = signal(false);
 
  private ctx!: CanvasRenderingContext2D;
  private animId = 0;
  private frameCount = 0;

  readonly W = 800;
  readonly H = 300;
  readonly GROUND = 220;
 
 
  private player = {
    x: 80,
    y: this.GROUND,
    vy: 0,
    width: 56,
    height: 56,
    jumping: false,
    doubleJumped: false,
    frame: 0,
    frameTimer: 0,
  };
  private readonly GRAVITY = 0.6;
  private readonly JUMP_FORCE = -13;
 

  private playerImg: HTMLImageElement | null = null;
  private obstacleImgs: HTMLImageElement[] = [];
  private obstaclePool = [
    'oddish', 'geodude', 'voltorb', 'shellder', 'gastly',
    'ekans', 'paras', 'sandshrew', 'bellsprout', 'caterpie',
  ];
 

  private bgX = 0;
  private bgSpeed = 3;
  private clouds: Cloud[] = [];
 

  private obstacles: Obstacle[] = [];
  private obstacleTimer = 0;
  private obstacleInterval = 90;
 

  private groundY = this.GROUND + 56;
 
  
  rosterList = signal<Pokemon[]>([]);
  formData: Omit<Pokemon, '_id'> = { name: '', type: '', level: 1, nature: '' };
  editingId = signal<string | null>(null);
  crudMessage = signal('');
 

  selectedPokemon = signal('pikachu');
  availablePokemons = [
    'pikachu', 'bulbasaur', 'charmander', 'squirtle',
    'eevee', 'jigglypuff', 'psyduck', 'meowth',
  ];
 
  
  ngOnInit(): void {
    this.loadRoster();
    this.preloadObstacleSprites();
  }
 
  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.loadPlayerSprite(this.selectedPokemon());
    this.initClouds();
    this.drawIdleScreen();
    this.setupInput();
  }
 
  ngOnDestroy(): void {
    cancelAnimationFrame(this.animId);
    window.removeEventListener('keydown', this.handleKey);
  }
 
  
  private handleKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      this.doJump();
    }
  };
 
  setupInput(): void {
    window.addEventListener('keydown', this.handleKey);
  }
 
  onCanvasTap(): void {
    this.doJump();
  }
 
  private doJump(): void {
    if (!this.gameStarted()) {
      this.startGame();
      return;
    }
    if (this.gameOver()) {
      this.restartGame();
      return;
    }
    if (!this.player.jumping) {
      this.player.vy = this.JUMP_FORCE;
      this.player.jumping = true;
      this.player.doubleJumped = false;
    } else if (!this.player.doubleJumped) {
      this.player.vy = this.JUMP_FORCE * 0.85;
      this.player.doubleJumped = true;
    }
  }
 
 
  private loadPlayerSprite(name: string): void {
    const img = new Image();
    img.src = `https://img.pokemondb.net/sprites/black-white/anim/normal/${name}.gif`;
    img.onload = () => { this.playerImg = img; };
    img.onerror = () => {
      
      const fallback = new Image();
      fallback.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${this.getPokemonId(name)}.png`;
      fallback.onload = () => { this.playerImg = fallback; };
    };
  }
 
  private getPokemonId(name: string): number {
    const ids: Record<string, number> = {
      pikachu: 25, bulbasaur: 1, charmander: 4, squirtle: 7,
      eevee: 133, jigglypuff: 39, psyduck: 54, meowth: 52,
    };
    return ids[name] ?? 25;
  }
 
  private preloadObstacleSprites(): void {
    this.obstaclePool.forEach((name) => {
      const img = new Image();
      img.src = `https://img.pokemondb.net/sprites/black-white/anim/normal/${name}.gif`;
      img.onerror = () => {
        const fallback = new Image();
        fallback.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${this.getPokemonObstacleId(name)}.png`;
        this.obstacleImgs.push(fallback);
        return;
      };
      img.onload = () => this.obstacleImgs.push(img);
    });
  }
 
  private getPokemonObstacleId(name: string): number {
    const ids: Record<string, number> = {
      oddish: 43, geodude: 74, voltorb: 100, shellder: 90, gastly: 92,
      ekans: 23, paras: 46, sandshrew: 27, bellsprout: 69, caterpie: 10,
    };
    return ids[name] ?? 100;
  }
 
  
  startGame(): void {
    this.gameStarted.set(true);
    this.gameOver.set(false);
    this.score.set(0);
    this.obstacles = [];
    this.player.y = this.GROUND;
    this.player.vy = 0;
    this.player.jumping = false;
    this.bgSpeed = 3;
    this.obstacleInterval = 90;
    this.frameCount = 0;
    this.loop();
  }
 
  restartGame(): void {
    cancelAnimationFrame(this.animId);
    this.startGame();
  }
 
  private loop(): void {
    this.animId = requestAnimationFrame(() => this.loop());
    this.update();
    this.draw();
    this.frameCount++;
  }
 
  private update(): void {

    this.score.update((s) => s + 1);
    if (this.score() % 300 === 0) {
      this.bgSpeed = Math.min(this.bgSpeed + 0.5, 10);
      this.obstacleInterval = Math.max(this.obstacleInterval - 5, 45);
    }
 

    this.player.vy += this.GRAVITY;
    this.player.y += this.player.vy;
    if (this.player.y >= this.GROUND) {
      this.player.y = this.GROUND;
      this.player.vy = 0;
      this.player.jumping = false;
      this.player.doubleJumped = false;
    }
 

    this.obstacleTimer++;
    if (this.obstacleTimer >= this.obstacleInterval) {
      this.spawnObstacle();
      this.obstacleTimer = 0;
    }
    for (const obs of this.obstacles) {
      obs.x -= this.bgSpeed;
    }
    this.obstacles = this.obstacles.filter((o) => o.x > -100);
 

    for (const c of this.clouds) {
      c.x -= c.speed;
      if (c.x < -100) c.x = this.W + 100;
    }
 

    this.bgX -= this.bgSpeed * 0.5;
    if (this.bgX <= -this.W) this.bgX = 0;
 

    for (const obs of this.obstacles) {
      if (this.checkCollision(obs)) {
        this.endGame();
        return;
      }
    }
  }
 
  private spawnObstacle(): void {
    if (this.obstacleImgs.length === 0) return;
    const img = this.obstacleImgs[Math.floor(Math.random() * this.obstacleImgs.length)];
    const size = 40 + Math.random() * 24;
    this.obstacles.push({
      x: this.W + 10,
      y: this.GROUND + (56 - size),
      width: size,
      height: size,
      img,
    });
  }
 
  private checkCollision(obs: Obstacle): boolean {
    const pad = 10;
    const px = this.player.x + pad;
    const py = this.player.y + pad;
    const pw = this.player.width - pad * 2;
    const ph = this.player.height - pad * 2;
    return (
      px < obs.x + obs.width - pad &&
      px + pw > obs.x + pad &&
      py < obs.y + obs.height - pad &&
      py + ph > obs.y + pad
    );
  }
 
  private endGame(): void {
    cancelAnimationFrame(this.animId);
    this.gameOver.set(true);
    if (this.score() > this.highScore()) {
      this.highScore.set(this.score());
    }
    this.drawGameOver();
  }
 

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
 
    this.drawSky();
    this.drawClouds();
    this.drawTrees();
    this.drawGround();

    for (const obs of this.obstacles) {
      if (obs.img.complete) {
        ctx.drawImage(obs.img, obs.x, obs.y, obs.width, obs.height);
      }
    }
 

    if (this.playerImg && this.playerImg.complete) {
      ctx.drawImage(
        this.playerImg,
        this.player.x,
        this.player.y,
        this.player.width,
        this.player.height
      );
    } else {

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.ellipse(
        this.player.x + 28, this.player.y + 28, 22, 22, 0, 0, Math.PI * 2
      );
      ctx.fill();
    }
 

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(this.W - 140, 8, 132, 28);
    ctx.fillStyle = '#fff';
    ctx.font = '500 14px var(--font-mono, monospace)';
    ctx.textAlign = 'right';
    ctx.fillText(`Score: ${this.score()}`, this.W - 14, 27);
    ctx.textAlign = 'left';
  }
 
  private drawSky(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, this.W, this.groundY);
  }
 
  private drawClouds(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of this.clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 40, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 30, c.y - 8, 28, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 28, c.y - 4, 24, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
 
  private drawTrees(): void {
    const ctx = this.ctx;

    const treePositions = [60, 180, 320, 500, 650, 750];
    for (let i = 0; i < treePositions.length; i++) {
      const tx = ((treePositions[i] + Math.abs(this.bgX) * 0.3) % (this.W + 60)) - 30;

      ctx.fillStyle = '#6B3A2A';
      ctx.fillRect(tx + 10, this.GROUND - 30, 10, 40);

      ctx.fillStyle = '#2D6A4F';
      ctx.beginPath();
      ctx.moveTo(tx, this.GROUND - 30);
      ctx.lineTo(tx + 15, this.GROUND - 80);
      ctx.lineTo(tx + 30, this.GROUND - 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#40916C';
      ctx.beginPath();
      ctx.moveTo(tx + 2, this.GROUND - 50);
      ctx.lineTo(tx + 15, this.GROUND - 95);
      ctx.lineTo(tx + 28, this.GROUND - 50);
      ctx.closePath();
      ctx.fill();
    }
  }
 
  private drawGround(): void {
    const ctx = this.ctx;

    ctx.fillStyle = '#52B788';
    ctx.fillRect(0, this.groundY - 12, this.W, 12);

    ctx.fillStyle = '#A0522D';
    ctx.fillRect(0, this.groundY, this.W, this.H - this.groundY);

    ctx.fillStyle = '#74C69D';
    for (let i = 0; i < this.W; i += 20) {
      const gx = ((i - this.bgX * 0.8) % this.W + this.W) % this.W;
      ctx.fillRect(gx, this.groundY - 16, 4, 8);
      ctx.fillRect(gx + 7, this.groundY - 14, 3, 6);
    }
  }
 
  private drawIdleScreen(): void {
    this.drawSky();
    this.drawClouds();
    this.drawTrees();
    this.drawGround();
 
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(this.W / 2 - 200, this.H / 2 - 50, 400, 90);
    ctx.fillStyle = '#fff';
    ctx.font = '500 22px var(--font-sans, sans-serif)';
    ctx.textAlign = 'center';
    ctx.fillText('Pokemon Forest Run', this.W / 2, this.H / 2 - 15);
    ctx.font = '400 15px var(--font-sans, sans-serif)';
    ctx.fillText('Press SPACE or tap to start', this.W / 2, this.H / 2 + 18);
    ctx.textAlign = 'left';
  }
 
  private drawGameOver(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(this.W / 2 - 180, this.H / 2 - 60, 360, 110);
    ctx.fillStyle = '#FFD700';
    ctx.font = '500 26px var(--font-sans, sans-serif)';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', this.W / 2, this.H / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '400 14px var(--font-sans, sans-serif)';
    ctx.fillText(`Score: ${this.score()}   Best: ${this.highScore()}`, this.W / 2, this.H / 2 + 10);
    ctx.fillText('Press SPACE or tap to restart', this.W / 2, this.H / 2 + 36);
    ctx.textAlign = 'left';
  }
 
  private initClouds(): void {
    this.clouds = [
      { x: 100, y: 50, speed: 0.4 },
      { x: 300, y: 35, speed: 0.3 },
      { x: 550, y: 60, speed: 0.5 },
      { x: 720, y: 42, speed: 0.35 },
    ];
  }
 

  changePlayerPokemon(name: string): void {
    this.selectedPokemon.set(name);
    this.playerImg = null;
    this.loadPlayerSprite(name);
  }
 

  loadRoster(): void {
    this.pokemonService.getAll().subscribe({
      next: (list) => this.rosterList.set(list),
      error: () => this.crudMessage.set('Could not connect to server.'),
    });
  }
 
  submitForm(): void {
    if (this.editingId()) {
      this.pokemonService.update(this.editingId()!, this.formData).subscribe({
        next: () => {
          this.crudMessage.set(`Updated ${this.formData.name}!`);
          this.editingId.set(null);
          this.resetForm();
          this.loadRoster();
        },
      });
    } else {
      this.pokemonService.create(this.formData).subscribe({
        next: () => {
          this.crudMessage.set(`Added ${this.formData.name} to your team!`);
          this.resetForm();
          this.loadRoster();
        },
      });
    }
  }
 
  editPokemon(p: Pokemon): void {
    this.editingId.set(p._id!);
    this.formData = { name: p.name, type: p.type, level: p.level, nature: p.nature };
  }
 
  deletePokemon(id: string, name: string): void {
    if (!confirm(`Remove ${name} from your team?`)) return;
    this.pokemonService.delete(id).subscribe({
      next: () => {
        this.crudMessage.set(`${name} was released.`);
        this.loadRoster();
      },
    });
  }
 
  cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }
 
  private resetForm(): void {
    this.formData = { name: '', type: '', level: 1, nature: '' };
  }
}
