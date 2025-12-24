import { v4 as uuidv4 } from 'uuid';

export class Player {
  constructor(name) {
    this.id = uuidv4();
    this.name = name;
    // Attributes
    this.str = 1; // Strength
    this.agi = 1; // Agility
    this.vit = 1; // Vitality
    this.sen = 1; // Sensory
    this.int = 1; // Intelligence
    // Progression
    this.level = 0;
    this.rank = 'F';
    this.xp = { total: 0, push: 0, pull: 0, legs: 0, core: 0 };
    this.challengesCompleted = 0;
    this.dungeonKeys = 0;
    // State
    this.gauntletStages = { push: 1, pull: 1, legs: 1, core: 1 };
    this.isFallen = false;
    this.activeConstellation = null;
    this.sponsorshipCredits = 0;
  }

  calculateLevel() {
    const stages = Object.values(this.gauntletStages);
    const avgStage = stages.reduce((a, b) => a + b, 0) / stages.length;
    this.level = Math.floor(avgStage);
    this.#updateRank();
  }

  #updateRank() {
    const ranks = ['F','E','D','C','B','A','S','SS','SSS'];
    const rankIndex = Math.min(Math.floor(this.level / 10), ranks.length - 1);
    this.rank = ranks[rankIndex];
  }

  completeChallenge() {
    this.challengesCompleted++;
    // Grant key every 5 challenges
    if (this.challengesCompleted % 5 === 0) {
      this.dungeonKeys++;
      console.log(`[SYSTEM] Dungeon Key granted! Total keys: ${this.dungeonKeys}`);
    }
  }

  gainXP(discipline, amount) {
    this.xp[discipline] += amount;
    this.xp.total += amount;
    this.#updateStats();
    console.log(`[SYSTEM] +${amount} ${discipline.toUpperCase()} XP.`);
  }

  #updateStats() {
    // STR from Push + Pull XP
    this.str = 1 + Math.floor((this.xp.push + this.xp.pull) / 250);
    // AGI from Legs/Pull stages (simplified: 1 per 5 stages)
    const agiStages = this.gauntletStages.legs + this.gauntletStages.pull;
    this.agi = 1 + Math.floor(agiStages / 5);
    // VIT from Total XP
    this.vit = 1 + Math.floor(this.xp.total / 500);
    // SEN from Core XP
    this.sen = 1 + Math.floor(this.xp.core / 150);
    // Note: INT updated when boss bonuses are awarded (in Gauntlet)
  }
      }
