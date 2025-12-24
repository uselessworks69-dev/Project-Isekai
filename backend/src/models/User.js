import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcrypt';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      is: /^[a-zA-Z0-9_]+$/ // Alphanumeric and underscores only
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password_hash: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  // Player progression data (normalized from frontend Player class)
  character_data: {
    type: DataTypes.JSONB,
    defaultValue: {
      // Core stats
      str: 1,
      agi: 1,
      vit: 1,
      sen: 1,
      int: 1,
      
      // Progression
      level: 0,
      rank: 'F',
      
      // Gauntlet progress
      gauntlet_stages: {
        push: 1,
        pull: 1,
        legs: 1,
        core: 1
      },
      
      // XP tracking
      xp: {
        total: 0,
        push: 0,
        pull: 0,
        legs: 0,
        core: 0
      },
      
      // Resources
      challenges_completed: 0,
      dungeon_keys: 0,
      sponsorship_credits: 0,
      
      // State
      is_fallen: false,
      fallen_since: null,
      active_constellation: null,
      corrupted_constellation_level: null,
      
      // Purification progress
      purification_data: {
        is_active: false,
        current_phase: 0,
        completed_trials: [],
        sacrifice_made: false,
        mirror_defeated: false,
        selected_option: null
      },
      
      // Metadata
      created_at: null,
      last_login: null,
      total_play_time: 0 // in minutes
    }
  },
  // Constellation relationship
  active_constellation_id: {
    type: DataTypes.STRING(50),
    references: {
      model: 'Constellations',
      key: 'id'
    },
    allowNull: true
  },
  // Shop inventory
  inventory: {
    type: DataTypes.JSONB,
    defaultValue: {
      consumables: {},
      cosmetics: [],
      permanent_upgrades: []
    }
  },
  // Achievement tracking
  achievements: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  // Settings
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      theme: 'solo_leveling',
      notifications: true,
      sound_volume: 80,
      music_volume: 60,
      privacy: 'public'
    }
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
      user.character_data.created_at = new Date().toISOString();
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    }
  }
});

// Instance methods
User.prototype.verifyPassword = async function(password) {
  return await bcrypt.compare(password, this.password_hash);
};

User.prototype.getCharacterData = function() {
  return {
    ...this.character_data,
    username: this.username,
    email: this.email,
    active_constellation_id: this.active_constellation_id
  };
};

User.prototype.updateCharacterData = function(updates) {
  this.character_data = {
    ...this.character_data,
    ...updates,
    updated_at: new Date().toISOString()
  };
  return this.save();
};

// Static methods
User.findByUsernameOrEmail = async function(identifier) {
  return await this.findOne({
    where: {
      [Sequelize.Op.or]: [
        { username: identifier },
        { email: identifier }
      ]
    }
  });
};

export default User;
