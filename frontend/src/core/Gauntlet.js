export class Gauntlet {
  static XP_TABLE = [
    { stageStart: 1, xpPerStage: 10, bossBonus: 50 },
    { stageStart: 11, xpPerStage: 20, bossBonus: 100 },
    { stageStart: 21, xpPerStage: 30, bossBonus: 150 },
    { stageStart: 31, xpPerStage: 40, bossBonus: 200 },
    { stageStart: 41, xpPerStage: 60, bossBonus: 300 },
    { stageStart: 51, xpPerStage: 80, bossBonus: 400 },
    { stageStart: 61, xpPerStage: 110, bossBonus: 600 },
    { stageStart: 71, xpPerStage: 160, bossBonus: 1000 }
  ];

  constructor(type, player) {
    this.type = type; // 'push', 'pull', 'legs', 'core'
    this.player = player;
    this.currentStage = player.gauntletStages[type] || 1;
  }

  getStageXp(stageNumber) {
    const block = Gauntlet.XP_TABLE.find(b => stageNumber >= b.stageStart && stageNumber < b.stageStart + 10);
    return block ? block.xpPerStage : 0;
  }

  completeStage() {
    const xpEarned = this.getStageXp(this.currentStage);
    this.player.gainXP(this.type, xpEarned);
    
    // Check for boss stage
    if (this.currentStage % 10 === 0) {
      const bossBonus = this.getBossBonus(this.currentStage);
      // Award INT for boss bonus (your rule: +1 INT per boss bonus)
      this.player.int += 1;
      console.log(`[GAUNTLET] ${this.type.toUpperCase()} Stage ${this.currentStage} BOSS CLEAR! +${bossBonus} Boss Bonus, +1 INT.`);
    }
    
    // Progress stage
    this.currentStage++;
    this.player.gauntletStages[this.type] = this.currentStage;
    this.player.calculateLevel();
    
    console.log(`[GAUNTLET] ${this.type.toUpperCase()} advanced to Stage ${this.currentStage}.`);
    return { xpEarned, newStage: this.currentStage };
  }

  getBossBonus(stageNumber) {
    const block = Gauntlet.XP_TABLE.find(b => stageNumber >= b.stageStart && stageNumber < b.stageStart + 10);
    return block ? block.bossBonus : 0;
  }
}
