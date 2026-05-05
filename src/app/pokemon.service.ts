// pokemon.service.ts - Add the updatePokemon method
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, throwError } from 'rxjs';

export interface Pokemon {
  _id?: string;
  name: string;
  type: string;
  level: number;
  nature: string;
  caughtAt?: Date;
}

export interface Score {
  _id?: string;
  playerName: string;
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
  
  // State
  pokemonList = signal<Pokemon[]>([]);
  highScores = signal<Score[]>([]);
  playerName = signal<string>('Trainer');
  serverError = signal<string | null>(null);
  
  // CREATE - Save new Pokemon
  savePokemon(pokemon: Omit<Pokemon, '_id'>) {
    return this.http.post<Pokemon>(`${this.apiUrl}/pokemon`, pokemon).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Save error:', error);
        return throwError(() => new Error('Failed to save Pokemon.'));
      })
    );
  }
  
  // READ - Fetch all Pokemon
  fetchPokemon() {
    this.http.get<Pokemon[]>(`${this.apiUrl}/pokemon`).subscribe({
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
  
  // UPDATE - Edit existing Pokemon (ADD THIS METHOD)
  updatePokemon(id: string, pokemon: Partial<Pokemon>) {
    return this.http.put<Pokemon>(`${this.apiUrl}/pokemon/${id}`, pokemon).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Update error:', error);
        return throwError(() => new Error('Failed to update Pokemon.'));
      })
    );
  }
  
  // DELETE - Remove Pokemon
  deletePokemon(id: string) {
    return this.http.delete(`${this.apiUrl}/pokemon/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Delete error:', error);
        return throwError(() => new Error('Failed to delete Pokemon.'));
      })
    );
  }
  
  // Score methods
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
  
  checkServerConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      this.http.get(`${this.apiUrl}/pokemon`).subscribe({
        next: () => resolve(true),
        error: () => resolve(false)
      });
    });
  }
}