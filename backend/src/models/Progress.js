import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

const Progress = sequelize.define('Progress', {
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
  // Gauntlet progress
  gauntlet_progress: {
    type: DataTypes.JSONB,
    defaultValue: {
      push: {
        current_stage: 1,
        stages_completed: [],
        total_xp: 0,
        boss_bonuses: []
      },
      pull: {
        current_stage: 1,
        stages_completed: [],
        total_xp: 0,
        boss_bonuses: []
      },
      legs: {
        current_stage: 1,
        stages_completed: [],
        total_xp: 0,
        boss_bonuses: []
      },
      core: {
        current_stage: 1,
        stages_completed: [],
        total_xp: 0,
        boss_bonuses: []
      }
    }
  },
  // Statistics
  statistics: {
    type: DataTypes.JSONB,
    defaultValue: {
      total_challenges_completed: 0,
      total_dungeons_completed: 0,
      total_dungeons_failed: 0,
      total_xp_earned: 0,
      total_sc_earned: 0,
      current_streak: 0,
      longest_streak: 0,
      last_activity_date: null
    }
  },
  // Challenges
  active_challenges: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  completed_challenges: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // Dungeon keys and assignments
  dungeon_keys: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  current_dungeon: {
    type: DataTypes.JSONB,
    defaultValue: null
  },
  dungeon_history: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // Promotion status
  promotion_status: {
    type: DataTypes.JSONB,
    defaultValue: {
      can_attempt: false,
      next_rank: null,
      failed_attempts: 0,
      last_attempt: null
    }
  },
  // Purification progress (if Fallen)
  purification_progress: {
    type: DataTypes.JSONB,
    defaultValue: null
  },
  // Daily/weekly tracking
  daily_tracker: {
    type: DataTypes.JSONB,
    defaultValue: {
      challenges_today: 0,
      xp_earned_today: 0,
      sc_earned_today: 0,
      last_reset: new Date().toISOString()
    }
  },
  // Timestamps for progression
  milestones: {
    type: DataTypes.JSONB,
    defaultValue: []
  }
}, {
  tableName: 'progress',
  timestamps: true
});

// Associations
User.hasOne(Progress, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Progress.belongsTo(User, { foreignKey: 'user_id' });

// Instance methods
Progress.prototype.completeChallenge = async function(challengeData) {
  const stats = this.statistics;
  stats.total_challenges_completed += 1;
  stats.total_xp_earned += challengeData.xp_earned || 0;
  
  // Update daily tracker
  this.daily_tracker.challenges_today += 1;
  this.daily_tracker.xp_earned_today += challengeData.xp_earned || 0;
  
  // Check for dungeon key (every 5 challenges)
  if (stats.total_challenges_completed % 5 === 0) {
    this.dungeon_keys += 1;
  }
  
  // Update streak
  const today = new Date().toISOString().split('T')[0];
  const lastActivity = stats.last_activity_date 
    ? new Date(stats.last_activity_date).toISOString().split('T')[0]
    : null;
  
  if (lastActivity === today) {
    // Already counted today
  } else if (lastActivity && this.getYesterdayDate() === lastActivity) {
    stats.current_streak += 1;
    if (stats.current_streak > stats.longest_streak) {
      stats.longest_streak = stats.current_streak;
    }
  } else {
    stats.current_streak = 1;
  }
  
  stats.last_activity_date = new Date().toISOString();
  this.statistics = stats;
  
  await this.save();
  return this;
};

Progress.prototype.getYesterdayDate = function() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
};

Progress.prototype.completeGauntletStage = async function(gauntletType, stageData) {
  const progress = this.gauntlet_progress[gauntletType];
  if (!progress) throw new Error(`Invalid gauntlet type: ${gauntletType}`);
  
  // Add stage to completed
  if (!progress.stages_completed.includes(stageData.stage)) {
    progress.stages_completed.push(stageData.stage);
  }
  
  // Update current stage
  if (stageData.stage >= progress.current_stage) {
    progress.current_stage = stageData.stage + 1;
  }
  
  // Add XP
  progress.total_xp += stageData.xp_earned || 0;
  
  // Check if boss stage
  if (stageData.is_boss) {
    progress.boss_bonuses.push({
      stage: stageData.stage,
      bonus: stageData.boss_bonus,
      completed_at: new Date().toISOString()
    });
  }
  
  this.gauntlet_progress[gauntletType] = progress;
  
  // Update total XP in statistics
  this.statistics.total_xp_earned += stageData.xp_earned || 0;
  this.daily_tracker.xp_earned_today += stageData.xp_earned || 0;
  
  await this.save();
  return this;
};

Progress.prototype.startDungeon = async function(dungeonData) {
  if (this.dungeon_keys < 1) {
    throw new Error('No dungeon keys available');
  }
  
  this.dungeon_keys -= 1;
  this.current_dungeon = {
    ...dungeonData,
    started_at: new Date().toISOString(),
    status: 'in_progress'
  };
  
  await this.save();
  return this;
};

Progress.prototype.completeDungeon = async function(result) {
  if (!this.current_dungeon) {
    throw new Error('No active dungeon');
  }
  
  const dungeon = {
    ...this.current_dungeon,
    completed_at: new Date().toISOString(),
    result: result
  };
  
  // Add to history
  this.dungeon_history.push(dungeon);
  
  // Update statistics
  const stats = this.statistics;
  if (result.success) {
    stats.total_dungeons_completed += 1;
    stats.total_sc_earned += result.sc_earned || 0;
    stats.total_xp_earned += result.xp_earned || 0;
    this.daily_tracker.sc_earned_today += result.sc_earned || 0;
    this.daily_tracker.xp_earned_today += result.xp_earned || 0;
  } else {
    stats.total_dungeons_failed += 1;
  }
  
  // Clear current dungeon
  this.current_dungeon = null;
  this.statistics = stats;
  
  await this.save();
  return this;
};

Progress.prototype.startPurification = async function() {
  this.purification_progress = {
    started_at: new Date().toISOString(),
    current_phase: 1,
    completed_trials: [],
    sacrifices_made: false,
    mirror_defeated: false,
    selected_option: null
  };
  
  await this.save();
  return this;
};

Progress.prototype.updatePurification = async function(phase, data) {
  if (!this.purification_progress) {
    throw new Error('Purification not started');
  }
  
  this.purification_progress.current_phase = phase;
  
  if (data.trial_completed) {
    this.purification_progress.completed_trials.push(data.trial_completed);
  }
  
  if (data.sacrifices_made) {
    this.purification_progress.sacrifices_made = true;
  }
  
  if (data.mirror_defeated) {
    this.purification_progress.mirror_defeated = true;
  }
  
  if (data.selected_option) {
    this.purification_progress.selected_option = data.selected_option;
  }
  
  await this.save();
  return this;
};

export default Progress;
