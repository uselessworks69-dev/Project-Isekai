import { Player } from './Player.js'

export class Constellation {
  constructor(data) {
    this.id = data.id
    this.name = data.name
    this.title = data.title // e.g., "The One Who Refused to Be Left Behind"
    this.rarity = data.rarity // 'Common', 'Rare', 'VeryRare', 'Mythic', 'Legendary'
    this.primaryAttribute = data.primaryAttribute // 'STR', 'AGI', etc.
    this.description = data.description
    this.cl = 1 // Constellation Level (starts at 1)
    this.isCorrupted = data.isCorrupted || false
    
    // Effect scaling formula: Base + (CL - 1) × ScalingFactor
    this.effects = data.effects || []
    this.triggerConditions = data.triggerConditions || []
  }

  // Calculate effect value based on CL
  getEffectValue(effectName) {
    const effect = this.effects.find(e => e.name === effectName)
    if (!effect) return 0
    
    return effect.baseValue + ((this.cl - 1) * effect.scalingFactor)
  }

  // Check if trigger conditions are met (simplified)
  checkTrigger(playerState, systemEvents) {
    return this.triggerConditions.every(condition => {
      // Example condition: { type: 'comeback', threshold: 3 }
      if (condition.type === 'comeback') {
        return systemEvents.failures >= condition.threshold
      }
      if (condition.type === 'perfect_promotion') {
        return systemEvents.perfectPromotions >= condition.threshold
      }
      return false
    })
  }

  // Sponsor a player
  sponsorPlayer(player) {
    player.activeConstellation = this.id
    player.corruptionLevel = this.isCorrupted ? this.cl : 0
    
    // Apply initial effects
    this.applyEffects(player)
    
    return `[The Constellation '${this.name}' is looking at you with burning tears.]`
  }

  applyEffects(player) {
    // Apply all active effects based on CL
    this.effects.forEach(effect => {
      const value = this.getEffectValue(effect.name)
      
      switch(effect.type) {
        case 'stat_boost':
          player[effect.target] += value
          break
        case 'xp_modifier':
          player.xpMultiplier = 1 + (value / 100)
          break
        case 'shop_discount':
          player.shopDiscount = value
          break
      }
    })
  }

  // Level up the constellation
  levelUp() {
    if (this.cl < 10) { // Max CL 10
      this.cl++
      return true
    }
    return false
  }
}

// Example corrupted constellation
export class CorruptedConstellation extends Constellation {
  constructor(baseConstellation) {
    super({
      ...baseConstellation,
      name: `Corrupted ${baseConstellation.name}`,
      isCorrupted: true,
      effects: baseConstellation.effects.map(effect => ({
        ...effect,
        baseValue: effect.baseValue * -1, // Invert effects
        scalingFactor: effect.scalingFactor * 1.5 // Scale faster negatively
      }))
    })
  }
                                        }
