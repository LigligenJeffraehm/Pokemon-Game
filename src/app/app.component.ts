// app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameComponent } from './game/game.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameComponent],
  template: `
    <app-game></app-game>
  `,
  styles: [`
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
  `]
})
export class AppComponent {}