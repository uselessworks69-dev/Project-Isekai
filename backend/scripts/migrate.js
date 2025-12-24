import sequelize from '../src/config/database.js';
import User from '../src/models/User.js';
import Progress from '../src/models/Progress.js';
import DungeonRun from '../src/models/DungeonRun.js';
import ConstellationAssignment from '../src/models/ConstellationAssignment.js';

async function migrate() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Sync all models (creates tables if they don't exist)
    console.log('🔄 Syncing User model...');
    await User.sync({ alter: true });
    
    console.log('🔄 Syncing Progress model...');
    await Progress.sync({ alter: true });
    
    console.log('🔄 Syncing DungeonRun model...');
    await DungeonRun.sync({ alter: true });
    
    console.log('🔄 Syncing ConstellationAssignment model...');
    await ConstellationAssignment.sync({ alter: true });
    
    // Set up associations
    console.log('🔗 Setting up model associations...');
    await sequelize.models.User.hasOne(sequelize.models.Progress, { 
      foreignKey: 'user_id', 
      onDelete: 'CASCADE' 
    });
    await sequelize.models.Progress.belongsTo(sequelize.models.User, { 
      foreignKey: 'user_id' 
    });
    
    await sequelize.models.User.hasMany(sequelize.models.DungeonRun, { 
      foreignKey: 'user_id', 
      onDelete: 'CASCADE' 
    });
    await sequelize.models.DungeonRun.belongsTo(sequelize.models.User, { 
      foreignKey: 'user_id' 
    });
    
    await sequelize.models.User.hasMany(sequelize.models.ConstellationAssignment, { 
      foreignKey: 'user_id', 
      onDelete: 'CASCADE' 
    });
    await sequelize.models.ConstellationAssignment.belongsTo(sequelize.models.User, { 
      foreignKey: 'user_id' 
    });
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Database Schema:');
    console.log('- Users table: User accounts and character data');
    console.log('- Progress table: Game progression and statistics');
    console.log('- DungeonRuns table: Dungeon attempts and results');
    console.log('- ConstellationAssignments table: Constellation sponsorships');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
