// pokemon.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

export interface User {
  _id: string;
  username: string;
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
  userId: string;
  username: string;
  score: number;
  level: number;
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
  
  // Pokemon state
  pokemonList = signal<Pokemon[]>([]);
  
  // Leaderboard
  leaderboard = signal<Score[]>([]);
  
  // Login/Register
  register(username: string, password: string) {
    return this.http.post<{ message: string; userId: string }>(`${this.apiUrl}/register`, { username, password });
  }
  
  login(username: string, password: string) {
    return this.http.post<{ message: string; userId: string; username: string }>(`${this.apiUrl}/login`, { username, password });
  }
  
  // Pokemon CRUD
  fetchPokemon(userId: string) {
    this.http.get<Pokemon[]>(`${this.apiUrl}/pokemon/${userId}`).subscribe(data => {
      this.pokemonList.set(data);
    });
  }
  
  savePokemon(pokemon: Omit<Pokemon, '_id'>) {
    return this.http.post<Pokemon>(`${this.apiUrl}/pokemon`, pokemon);
  }
  
  deletePokemon(id: string) {
    return this.http.delete(`${this.apiUrl}/pokemon/${id}`);
  }
  
  // Leaderboard
  saveScore(score: Score) {
    return this.http.post<Score>(`${this.apiUrl}/scores`, score);
  }
  
  fetchLeaderboard() {
    this.http.get<Score[]>(`${this.apiUrl}/leaderboard`).subscribe(data => {
      this.leaderboard.set(data);
    });
  }
  
  logout() {
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    this.pokemonList.set([]);
    localStorage.removeItem('currentUser');
  }
}