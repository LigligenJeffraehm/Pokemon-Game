import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Pokemon } from './pokemon.model';

@Injectable({ providedIn: 'root' })
export class PokemonService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api/pokemon';

  getAll(): Observable<Pokemon[]> {
    return this.http.get<Pokemon[]>(this.apiUrl);
  }

  create(pokemon: Omit<Pokemon, '_id'>): Observable<Pokemon> {
    return this.http.post<Pokemon>(this.apiUrl, pokemon);
  }

  update(id: string, pokemon: Partial<Pokemon>): Observable<Pokemon> {
    return this.http.put<Pokemon>(`${this.apiUrl}/${id}`, pokemon);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}