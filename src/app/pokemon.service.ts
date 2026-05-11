// pokemon.service.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';

export interface User {
  _id: string;
  username: string;
  isAdmin: boolean;
}

export interface Pokemon {
  _id?: string;
  name: string;
  type: string;
  level: number;
  nature: string;
  userId: string;
  caughtAt?: Date;
}

export interface Score {
  _id?: string;
  userId: string;
  username: string;
  score: number;
  level: number;
  pokemonCaught: number;
  date?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PokemonService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';
  
  // User state
  currentUser = signal<User | null>(null);
  isLoggedIn = signal(false);
  isAdmin = signal(false);
  playerName = signal<string>('Trainer');
  
  // Pokemon state
  pokemonList = signal<Pokemon[]>([]);
  highScores = signal<Score[]>([]);
  userScores = signal<Score[]>([]);
  serverError = signal<string | null>(null);
  
  // ============= AUTH METHODS =============
  
  register(username: string, password: string, isAdmin: boolean = false) {
    return this.http.post<{ message: string; userId: string; isAdmin: boolean }>(
      `${this.apiUrl}/register`, 
      { username, password, isAdmin }
    );
  }
  
  login(username: string, password: string) {
    return this.http.post<{ message: string; userId: string; username: string; isAdmin: boolean }>(
      `${this.apiUrl}/login`, 
      { username, password }
    );
  }
  
  logout() {
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.isAdmin.set(false);
    this.pokemonList.set([]);
    localStorage.removeItem('currentUser');
  }
  
  setPlayerName(name: string) {
    this.playerName.set(name);
    localStorage.setItem('playerName', name);
  }
  
  loadPlayerName() {
    const saved = localStorage.getItem('playerName');
    if (saved) {
      this.playerName.set(saved);
    }
  }
  
  loadStoredUser() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.currentUser.set(user);
      this.isLoggedIn.set(true);
      this.isAdmin.set(user.isAdmin);
      this.fetchPokemon(user._id);
      this.fetchUserScores(user._id);
    }
  }
  
  // our CRUD functionality 
  
  fetchPokemon(userId: string) {
    this.http.get<Pokemon[]>(`${this.apiUrl}/pokemon/${userId}`).subscribe({
      next: (data) => {
        this.pokemonList.set(data);
        this.serverError.set(null);
      },
      error: (err) => {
        console.error('Failed to fetch Pokemon:', err);
        this.serverError.set('Cannot connect to server.');
      }
    });
  }
  
  savePokemon(pokemon: Omit<Pokemon, '_id'>) {
    return this.http.post<Pokemon>(`${this.apiUrl}/pokemon`, pokemon).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Save error:', error);
        return throwError(() => new Error('Failed to save Pokemon.'));
      })
    );
  }
  
  updatePokemon(id: string, pokemon: Partial<Pokemon>) {
    return this.http.put<Pokemon>(`${this.apiUrl}/pokemon/${id}`, pokemon).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Update error:', error);
        return throwError(() => new Error('Failed to update Pokemon.'));
      })
    );
  }
  
  deletePokemon(id: string) {
    return this.http.delete(`${this.apiUrl}/pokemon/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Delete error:', error);
        return throwError(() => new Error('Failed to delete Pokemon.'));
      })
    );
  }
  
  // SCORE
  
  saveScore(score: Omit<Score, '_id' | 'date'>) {
    return this.http.post<Score>(`${this.apiUrl}/scores`, score).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Save score error:', error);
        return throwError(() => new Error('Failed to save score.'));
      })
    );
  }
  
  fetchHighScores() {
    this.http.get<Score[]>(`${this.apiUrl}/scores`).subscribe({
      next: (data) => {
        this.highScores.set(data);
        this.serverError.set(null);
      },
      error: (err) => {
        console.error('Failed to fetch high scores:', err);
        this.serverError.set('Cannot connect to server.');
      }
    });
  }
  
  fetchUserScores(userId: string) {
    this.http.get<Score[]>(`${this.apiUrl}/scores/user/${userId}`).subscribe({
      next: (data) => {
        this.userScores.set(data);
      },
      error: (err) => {
        console.error('Failed to fetch user scores:', err);
      }
    });
  }
  
  deleteScore(id: string) {
    return this.http.delete(`${this.apiUrl}/scores/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Delete score error:', error);
        return throwError(() => new Error('Failed to delete score.'));
      })
    );
  }
  
  updateScore(id: string, scoreData: Partial<Score>) {
    return this.http.put<Score>(`${this.apiUrl}/scores/${id}`, scoreData).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Update score error:', error);
        return throwError(() => new Error('Failed to update score.'));
      })
    );
  }
  
  checkServerConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.get(`${this.apiUrl}/pokemon`).subscribe({
        next: () => resolve(true),
        error: () => resolve(false)
      });
    });
  }
}