import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const ConstellationAssignment = sequelize.define('ConstellationAssignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  constellation_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  constellation_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  rarity: {
    type: DataTypes.ENUM('Common', 'Rare', 'VeryRare', 'Mythic', 'Legendary'),
    defaultValue: 'Common'
  },
  primary_attribute: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  level: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  experience: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_corrupted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  corrupted_since: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Effects and perks
  active_effects: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // Task tracking
  completed_tasks: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  active_tasks: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // Milestones for this constellation
  milestones: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // Sponsorship data
  sponsorship_data: {
    type: DataTypes.JSONB,
    defaultValue: {
      total_sc_earned: 0,
      total_tasks_completed: 0,
      days_sponsored: 0,
      last_interaction: null
    }
  },
  // Constellation-specific data
  constellation_data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'constellation_assignments',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'constellation_id'],
      where: {
        is_corrupted: false
      }
    }
  ]
});

// Associations
User.hasMany(ConstellationAssignment, { foreignKey: 'user_id', onDelete: 'CASCADE' });
ConstellationAssignment.belongsTo(User, { foreignKey: 'user_id' });

// Static methods
ConstellationAssignment.findAvailableConstellations = function(user, progress) {
  // This would check various triggers based on user's progress
  const available = [];
  const triggers = this.checkTriggers(user, progress);
  
  triggers.forEach(trigger => {
    const constellation = this.getConstellationByTrigger(trigger);
    if (constellation) {
      available.push(constellation);
    }
  });
  
  return available;
};

ConstellationAssignment.checkTriggers = function(user, progress) {
  const triggers = [];
  const stats = user.character_data;
  const progStats = progress.statistics;
  
  // Check for Naruto trigger (comeback)
  if (progStats.total_dungeons_failed >= 3 && 
      progStats.total_dungeons_completed > progStats.total_dungeons_failed) {
    triggers.push('comeback_spike');
  }
  
  // Check for Goku trigger (PR streak)
  const recentPRs = this.checkRecentPRs(progress);
  if (recentPRs >= 3) {
    triggers.push('pr_streak');
  }
  
  // Check for Levi trigger (perfect promotion)
  if (progress.promotion_status && 
      progress.promotion_status.failed_attempts === 0 &&
      progress.promotion_status.last_attempt &&
      this.isRecent(progress.promotion_status.last_attempt, 7)) {
    triggers.push('perfect_promotion');
  }
  
  // Check for Itachi trigger (sacrifice)
  if (progStats.total_sc_earned > 1000 && 
      user.inventory?.consumables?.length === 0) {
    triggers.push('sacrifice_made');
  }
  
  // Check for Saitama trigger (consistency)
  if (progStats.current_streak >= 30) {
    triggers.push('extreme_consistency');
  }
  
  return triggers;
};

ConstellationAssignment.checkRecentPRs = function(progress) {
  // Check for personal records in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentMilestones = progress.milestones?.filter(m => 
    new Date(m.date) > sevenDaysAgo && m.type === 'personal_record'
  ) || [];
  
  return recentMilestones.length;
};

ConstellationAssignment.isRecent = function(dateString, days) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date > cutoff;
};

ConstellationAssignment.getConstellationByTrigger = function(trigger) {
  const constellations = {
    comeback_spike: {
      id: 'naruto',
      name: 'Naruto Uzumaki',
      title: 'The One Who Refused to Be Left Behind',
      rarity: 'Rare',
      primary_attribute: 'AGI'
    },
    pr_streak: {
      id: 'goku',
      name: 'Son Goku',
      title: 'The One Who Breaks His Limit Again and Again',
      rarity: 'Rare',
      primary_attribute: 'STR'
    },
    perfect_promotion: {
      id: 'levi',
      name: 'Levi Ackerman',
      title: 'The One Who Stands Alone on the Battlefield',
      rarity: 'VeryRare',
      primary_attribute: 'INT'
    },
    sacrifice_made: {
      id: 'itachi',
      name: 'Itachi Uchiha',
      title: 'The One Who Bore the World in Silence',
      rarity: 'VeryRare',
      primary_attribute: 'VIT'
    },
    extreme_consistency: {
      id: 'saitama',
      name: 'Saitama',
      title: 'The One Who Trained When No One Watched',
      rarity: 'Legendary',
      primary_attribute: 'STR'
    }
  };
  
  return constellations[trigger];
};

// Instance methods
ConstellationAssignment.prototype.levelUp = async function() {
  if (this.level >= 10) {
    throw new Error('Maximum constellation level reached');
  }
  
  // Calculate XP needed for next level
  const xpNeeded = this.calculateXPForNextLevel();
  
  if (this.experience >= xpNeeded) {
    this.level += 1;
    this.experience -= xpNeeded;
    
    // Add level-up effect
    this.milestones.push({
      type: 'level_up',
      from: this.level - 1,
      to: this.level,
      date: new Date().toISOString()
    });
    
    await this.save();
    return true;
  }
  
  return false;
};

ConstellationAssignment.prototype.calculateXPForNextLevel = function() {
  // Exponential XP requirement
  return 100 * Math.pow(2, this.level - 1);
};

ConstellationAssignment.prototype.addExperience = async function(amount) {
  this.experience += amount;
  
  // Check for level up
  let leveledUp = false;
  while (await this.levelUp()) {
    leveledUp = true;
  }
  
  await this.save();
  return { leveledUp, newLevel: this.level, xpRemaining: this.experience };
};

ConstellationAssignment.prototype.completeTask = async function(taskData) {
  // Remove from active tasks
  this.active_tasks = this.active_tasks.filter(t => t.id !== taskData.id);
  
  // Add to completed tasks
  this.completed_tasks.push({
    ...taskData,
    completed_at: new Date().toISOString()
  });
  
  // Update sponsorship data
  this.sponsorship_data.total_tasks_completed += 1;
  this.sponsorship_data.total_sc_earned += taskData.reward || 0;
  this.sponsorship_data.last_interaction = new Date().toISOString();
  
  // Add experience for task completion
  const xpEarned = Math.floor((taskData.reward || 0) / 10);
  await this.addExperience(xpEarned);
  
  await this.save();
  return this;
};

ConstellationAssignment.prototype.corrupt = async function() {
  if (this.is_corrupted) {
    throw new Error('Constellation already corrupted');
  }
  
  this.is_corrupted = true;
  this.corrupted_since = new Date();
  
  // Invert effects
  this.active_effects = this.active_effects.map(effect => ({
    ...effect,
    value: -Math.abs(effect.value), // Make negative
    description: `Corrupted: ${effect.description}`
  }));
  
  // Update constellation data for corrupted version
  this.constellation_data.corruption_level = this.level;
  this.constellation_data.original_id = this.constellation_id;
  this.constellation_id = `corrupted_${this.constellation_id}`;
  this.constellation_name = `Corrupted ${this.constellation_name}`;
  
  await this.save();
  return this;
};

ConstellationAssignment.prototype.getEffects = function() {
  const baseEffects = [
    {
      name: 'primary_attribute_boost',
      target: this.primary_attribute.toLowerCase(),
      value: this.level * 0.5, // +0.5 per level to primary attribute
      description: `Boosts ${this.primary_attribute} gains`
    }
  ];
  
  // Constellation-specific effects
  const specificEffects = this.getSpecificEffects();
  
  return [...baseEffects, ...specificEffects, ...this.active_effects];
};

ConstellationAssignment.prototype.getSpecificEffects = function() {
  const effects = {
    naruto: [
      {
        name: 'comeback_spike',
        target: 'agi',
        value: Math.floor(this.level / 2), // +1 AGI every 2 levels
        description: 'AGI boost after failures'
      }
    ],
    goku: [
      {
        name: 'limit_break',
        target: 'str',
        value: this.level, // +1 STR per level
        description: 'STR boost from breaking limits'
      }
    ],
    // Add other constellations...
  };
  
  const baseId = this.constellation_id.replace('corrupted_', '');
  return effects[baseId] || [];
};

export default ConstellationAssignment;
