// backend/src/config/database.js
import { Sequelize } from 'sequelize';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is NOT set');
}

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  pool: {
    max: 10, min: 0, acquire: 30000, idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true
  }
});

export const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected (Render Postgres)');
    return sequelize;
  } catch (error) {
    console.error('❌ DB connection failed:', error);
    throw error;
  }
};

export default sequelize;
