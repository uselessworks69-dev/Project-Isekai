import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const DungeonRun = sequelize.define('DungeonRun', {
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
  dungeon_type: {
    type: DataTypes.ENUM('TIME_TRIAL', 'GRAVITY', 'CURSED', 'HYBRID', 'PROMOTION'),
    allowNull: false
  },
  dungeon_data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'completed', 'failed', 'abandoned'),
    defaultValue: 'in_progress'
  },
  result: {
    type: DataTypes.JSONB,
    defaultValue: null
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration_seconds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  loot_earned: {
    type: DataTypes.JSONB,
    defaultValue: {
      xp: 0,
      sc: 0,
      stat_points: 0,
      items: []
    }
  },
  form_breaks: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  performance_score: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  // For time trials
  time_trial_data: {
    type: DataTypes.JSONB,
    defaultValue: null
  },
  // For gravity dungeons
  tempo_data: {
    type: DataTypes.JSONB,
    defaultValue: null
  },
  // For cursed dungeons
  constraint_data: {
    type: DataTypes.JSONB,
    defaultValue: null
  },
  // Boss fight data
  boss_fight: {
    type: DataTypes.JSONB,
    defaultValue: null
  }
}, {
  tableName: 'dungeon_runs',
  timestamps: true,
  indexes: [
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['dungeon_type']
    },
    {
      fields: ['started_at']
    }
  ]
});

// Associations
User.hasMany(DungeonRun, { foreignKey: 'user_id', onDelete: 'CASCADE' });
DungeonRun.belongsTo(User, { foreignKey: 'user_id' });

// Static methods for dungeon generation
DungeonRun.generateDungeon = function(user, progress) {
  const archetypes = ['TIME_TRIAL', 'GRAVITY', 'CURSED'];
  
  // Choose based on weakest attribute (heuristic)
  const userData = user.character_data;
  const stats = {
    str: userData.str,
    agi: userData.agi,
    vit: userData.vit,
    sen: userData.sen,
    int: userData.int
  };
  
  // Find weakest stat
  const weakestStat = Object.keys(stats).reduce((a, b) => 
    stats[a] < stats[b] ? a : b
  );
  
  let dungeonType;
  switch(weakestStat) {
    case 'str':
      dungeonType = 'GRAVITY';
      break;
    case 'agi':
      dungeonType = 'TIME_TRIAL';
      break;
    case 'vit':
      dungeonType = 'CURSED';
      break;
    default:
      // Random selection
      dungeonType = archetypes[Math.floor(Math.random() * archetypes.length)];
  }
  
  // Generate dungeon data based on type
  const baseDungeon = {
    archetype: dungeonType,
    difficulty: this.calculateDifficulty(userData.level || 0),
    exercises: this.generateExercises(dungeonType, progress),
    requirements: this.generateRequirements(dungeonType),
    rewards: this.calculateRewards(dungeonType, userData.level || 0)
  };
  
  return baseDungeon;
};

DungeonRun.calculateDifficulty = function(level) {
  if (level < 10) return 'easy';
  if (level < 30) return 'medium';
  if (level < 60) return 'hard';
  return 'extreme';
};

DungeonRun.generateExercises = function(dungeonType, progress) {
  const exercises = [];
  
  switch(dungeonType) {
    case 'TIME_TRIAL':
      // 4 exercises from different gauntlets
      const gauntlets = ['push', 'pull', 'legs', 'core'];
      gauntlets.forEach(gauntlet => {
        const currentStage = progress.gauntlet_progress[gauntlet]?.current_stage || 1;
        exercises.push({
          gauntlet,
          stage: currentStage,
          reps: 10,
          rounds: 4,
          rest: 30 // seconds between rounds
        });
      });
      break;
      
    case 'GRAVITY':
      // Focus on Push & Pull with tempo
      exercises.push(
        {
          gauntlet: 'push',
          stage: progress.gauntlet_progress.push?.current_stage || 1,
          reps: 8,
          tempo: '4-0-4', // 4s down, 0s pause, 4s up
          sets: 3
        },
        {
          gauntlet: 'pull',
          stage: progress.gauntlet_progress.pull?.current_stage || 1,
          reps: 8,
          tempo: '4-0-4',
          sets: 3
        }
      );
      break;
      
    case 'CURSED':
      // Endurance challenge with constraint
      exercises.push({
        gauntlet: 'core', // Usually core-focused
        stage: progress.gauntlet_progress.core?.current_stage || 1,
        constraint: 'no_sitting', // Or other constraints
        total_reps: 100,
        time_limit: 600 // 10 minutes
      });
      break;
  }
  
  return exercises;
};

DungeonRun.generateRequirements = function(dungeonType) {
  const requirements = {
    TIME_TRIAL: {
      max_form_breaks: 2,
      max_time: 900, // 15 minutes
      completion_conditions: ['all_exercises_completed', 'within_time_limit']
    },
    GRAVITY: {
      max_form_breaks: 0,
      tempo_tolerance: 0.5, // seconds
      completion_conditions: ['perfect_tempo', 'full_rom']
    },
    CURSED: {
      max_form_breaks: 3,
      constraint_violations: 0,
      completion_conditions: ['meet_rep_target', 'maintain_constraint']
    }
  };
  
  return requirements[dungeonType] || requirements.TIME_TRIAL;
};

DungeonRun.calculateRewards = function(dungeonType, level) {
  const baseXP = 100 + (level * 10);
  const baseSC = 50 + (level * 5);
  
  const multipliers = {
    TIME_TRIAL: { xp: 1.2, sc: 1.0 },
    GRAVITY: { xp: 1.5, sc: 1.2 },
    CURSED: { xp: 1.8, sc: 1.5 },
    HYBRID: { xp: 2.0, sc: 2.0 }
  };
  
  const multiplier = multipliers[dungeonType] || multipliers.TIME_TRIAL;
  
  return {
    xp: Math.floor(baseXP * multiplier.xp),
    sc: Math.floor(baseSC * multiplier.sc),
    stat_points: Math.floor(Math.random() * 3), // 0-2 stat points
    items: []
  };
};

// Instance methods
DungeonRun.prototype.completeRun = async function(resultData) {
  this.status = resultData.success ? 'completed' : 'failed';
  this.completed_at = new Date();
  this.result = resultData;
  
  // Calculate duration
  const start = new Date(this.started_at);
  const end = new Date(this.completed_at);
  this.duration_seconds = Math.floor((end - start) / 1000);
  
  // Calculate performance score
  this.performance_score = this.calculatePerformanceScore(resultData);
  
  // Determine loot based on performance
  this.loot_earned = this.calculateLoot(resultData);
  
  await this.save();
  return this;
};

DungeonRun.prototype.calculatePerformanceScore = function(resultData) {
  let score = 100; // Base score
  
  // Deductions for form breaks
  if (resultData.form_breaks) {
    score -= resultData.form_breaks * 10;
  }
  
  // Bonus for speed (time trials)
  if (this.dungeon_type === 'TIME_TRIAL' && resultData.completion_time) {
    const timeRatio = resultData.completion_time / (this.dungeon_data.requirements?.max_time || 900);
    if (timeRatio < 0.5) score += 20;
    else if (timeRatio < 0.75) score += 10;
  }
  
  // Bonus for perfect form (gravity dungeons)
  if (this.dungeon_type === 'GRAVITY' && resultData.form_breaks === 0) {
    score += 30;
  }
  
  // Bonus for constraint adherence (cursed dungeons)
  if (this.dungeon_type === 'CURSED' && resultData.constraint_violations === 0) {
    score += 25;
  }
  
  return Math.max(0, Math.min(100, score));
};

DungeonRun.prototype.calculateLoot = function(resultData) {
  const baseLoot = this.dungeon_data.rewards || { xp: 100, sc: 50 };
  
  // Apply performance multiplier
  const performanceMultiplier = this.performance_score / 100;
  
  const loot = {
    xp: Math.floor(baseLoot.xp * performanceMultiplier),
    sc: Math.floor(baseLoot.sc * performanceMultiplier),
    stat_points: 0,
    items: []
  };
  
  // Chance for stat points based on performance
  if (this.performance_score > 80) {
    loot.stat_points = 1;
    if (this.performance_score > 95) {
      loot.stat_points = 2;
    }
  }
  
  // Chance for rare items on excellent performance
  if (this.performance_score > 90 && Math.random() > 0.7) {
    loot.items.push({
      type: 'consumable',
      id: 'elite_token',
      name: 'Elite Completion Token',
      description: 'Can be exchanged for special rewards'
    });
  }
  
  return loot;
};

export default DungeonRun;
