export class Dungeon {
  static ARCHETYPES = ['TIME_TRIAL', 'GRAVITY', 'CURSED', 'HYBRID'];

  constructor(archetype) {
    this.id = Date.now();
    this.archetype = archetype || this.#assignRandomArchetype();
    this.isCleared = false;
    this.loot = { xpMultiplier: 2.0, statPoints: 0 };
  }

  #assignRandomArchetype() {
    const index = Math.floor(Math.random() * Dungeon.ARCHETYPES.length);
    return Dungeon.ARCHETYPES[index];
  }

  attempt(player) {
    if (player.dungeonKeys < 1) {
      throw new Error('No dungeon keys available');
    }

    player.dungeonKeys--;
    console.log(`[DUNGEON] Entering ${this.archetype} Dungeon... (Keys left: ${player.dungeonKeys})`);

    // Simulate dungeon completion logic
    const success = Math.random() > 0.2; // 80% success rate for demo
    if (success) {
      this.isCleared = true;
      this.#grantLoot(player);
      return { success: true, message: 'Dungeon Cleared!' };
    } else {
      return { success: false, message: 'Dungeon Failed...' };
    }
  }

  #grantLoot(player) {
    // Base XP grant (simplified)
    const baseXp = 100;
    const xpGrant = baseXp * this.loot.xpMultiplier;
    // Distribute XP across random disciplines for demo
    const disciplines = ['push', 'pull', 'legs', 'core'];
    const randomDiscipline = disciplines[Math.floor(Math.random() * disciplines.length)];
    player.gainXP(randomDiscipline, xpGrant);

    // Chance for stat point
    if (Math.random() > 0.7) {
      this.loot.statPoints = 1;
      const stats = ['str', 'agi', 'vit', 'sen', 'int'];
      const randomStat = stats[Math.floor(Math.random() * stats.length)];
      player[randomStat] += 1;
      console.log(`[LOOT] +1 ${randomStat.toUpperCase()}!`);
    }
  }
  }
