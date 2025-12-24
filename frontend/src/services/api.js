import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('isekai_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // Server responded with error
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Token expired or invalid
          localStorage.removeItem('isekai_token');
          localStorage.removeItem('isekai_user');
          window.location.href = '/login';
          break;
          
        case 403:
          // Forbidden
          console.error('Forbidden:', data.error?.message);
          break;
          
        case 404:
          // Not found
          console.error('Not found:', data.error?.message);
          break;
          
        case 429:
          // Rate limited
          console.error('Rate limited:', data.error?.message);
          break;
          
        default:
          console.error('API Error:', data.error?.message);
      }
      
      return Promise.reject(data.error || error);
    } else if (error.request) {
      // Request made but no response
      console.error('Network error:', error.message);
      return Promise.reject({
        type: 'NETWORK_ERROR',
        message: 'Unable to connect to server. Please check your connection.'
      });
    } else {
      // Something else happened
      console.error('Request error:', error.message);
      return Promise.reject(error);
    }
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (identifier, password) => api.post('/auth/login', { identifier, password }),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
  
  // Password reset
  requestPasswordReset: (email) => api.post('/auth/password-reset-request', { email }),
  confirmPasswordReset: (token, newPassword) => 
    api.post('/auth/password-reset-confirm', { token, new_password: newPassword })
};

// Progress API
export const progressAPI = {
  getProgress: () => api.get('/progress'),
  updateCharacter: (updates) => api.put('/progress/character', { updates }),
  
  // Challenges
  completeChallenge: (challengeId, xpEarned, details) => 
    api.post('/progress/challenges/complete', { challenge_id: challengeId, xp_earned: xpEarned, details }),
  
  // Gauntlets
  completeGauntletStage: (gauntletType, stage, xpEarned, isBoss, bossBonus) =>
    api.post(`/progress/gauntlets/${gauntletType}/stages/${stage}/complete`, {
      xp_earned: xpEarned,
      is_boss: isBoss,
      boss_bonus: bossBonus
    }),
  
  // Constellations
  getAvailableConstellations: () => api.get('/progress/constellations/available'),
  acceptConstellation: (constellationId) => api.post(`/progress/constellations/${constellationId}/accept`),
  
  // Purification
  startPurification: () => api.post('/progress/purification/start'),
  completePurificationPhase: (phase, data) => 
    api.post(`/progress/purification/phase/${phase}/complete`, data)
};

// Dungeon API
export const dungeonAPI = {
  requestDungeon: () => api.post('/dungeons/request'),
  getActiveDungeon: () => api.get('/dungeons/active'),
  completeDungeon: (dungeonId, success, data) => 
    api.post(`/dungeons/${dungeonId}/complete`, { success, ...data }),
  abandonDungeon: (dungeonId) => api.post(`/dungeons/${dungeonId}/abandon`),
  getDungeonHistory: (page = 1, limit = 20) => 
    api.get('/dungeons/history', { params: { page, limit } }),
  getDungeonStatistics: () => api.get('/dungeons/statistics'),
  
  // Promotion
  generatePromotionDungeon: () => api.post('/dungeons/promotion/generate')
};

// Shop API
export const shopAPI = {
  getShopItems: () => api.get('/shop/items'),
  purchaseItem: (itemId, quantity = 1) => 
    api.post('/shop/purchase', { item_id: itemId, quantity }),
  getInventory: () => api.get('/shop/inventory'),
  useItem: (itemId, context) => 
    api.post('/shop/inventory/use', { item_id: itemId, context })
};

// Game state management
export class GameState {
  constructor() {
    this.user = null;
    this.progress = null;
    this.activeDungeon = null;
    this.listeners = new Set();
  }
  
  // Singleton pattern
  static getInstance() {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }
  
  // Initialize from stored data
  async initialize() {
    const token = localStorage.getItem('isekai_token');
    const userData = localStorage.getItem('isekai_user');
    
    if (token && userData) {
      try {
        this.user = JSON.parse(userData);
        
        // Load progress
        const progressData = await progressAPI.getProgress();
        this.progress = progressData.progress;
        
        // Load active dungeon
        try {
          const dungeonData = await dungeonAPI.getActiveDungeon();
          this.activeDungeon = dungeonData.dungeon;
        } catch (error) {
          // No active dungeon is okay
          this.activeDungeon = null;
        }
        
        this.notifyListeners();
        return true;
      } catch (error) {
        console.error('Failed to initialize game state:', error);
        this.clear();
        return false;
      }
    }
    
    return false;
  }
  
  // Update methods
  async updateUser(userData) {
    this.user = userData;
    localStorage.setItem('isekai_user', JSON.stringify(userData));
    this.notifyListeners();
  }
  
  async updateProgress(progressData) {
    this.progress = progressData;
    this.notifyListeners();
  }
  
  async updateActiveDungeon(dungeonData) {
    this.activeDungeon = dungeonData;
    this.notifyListeners();
  }
  
  // Game actions
  async completeChallenge(challengeData) {
    try {
      const result = await progressAPI.completeChallenge(
        challengeData.id,
        challengeData.xp,
        challengeData.details
      );
      
      // Update local state
      if (this.progress) {
        this.progress.statistics.total_challenges_completed = result.progress.challenges_completed;
        this.progress.dungeon_keys = result.progress.dungeon_keys;
        this.progress.statistics.current_streak = result.progress.streak;
      }
      
      // Update user character data
      if (this.user) {
        this.user.character_data.xp.total += challengeData.xp;
        this.user.character_data.challenges_completed += 1;
        this.user.character_data.dungeon_keys = result.progress.dungeon_keys;
      }
      
      this.notifyListeners();
      return result;
    } catch (error) {
      console.error('Failed to complete challenge:', error);
      throw error;
    }
  }
  
  async completeGauntletStage(gauntletType, stageData) {
    try {
      const result = await progressAPI.completeGauntletStage(
        gauntletType,
        stageData.stage,
        stageData.xp,
        stageData.isBoss,
        stageData.bossBonus
      );
      
      // Update local state
      if (this.progress && this.progress.gauntlet_progress[gauntletType]) {
        this.progress.gauntlet_progress[gauntletType] = result.progress;
      }
      
      // Update user character data
      if (this.user) {
        this.user.character_data.gauntlet_stages[gauntletType] = result.progress.current_stage;
        this.user.character_data.xp.total += stageData.xp;
        this.user.character_data.xp[gauntletType] += stageData.xp;
        
        if (stageData.isBoss) {
          this.user.character_data.int += 1;
        }
      }
      
      this.notifyListeners();
      return result;
    } catch (error) {
      console.error('Failed to complete gauntlet stage:', error);
      throw error;
    }
  }
  
  async requestDungeon() {
    try {
      const result = await dungeonAPI.requestDungeon();
      this.activeDungeon = result.dungeon;
      this.progress.dungeon_keys = result.dungeon.keys_remaining;
      
      this.notifyListeners();
      return result;
    } catch (error) {
      console.error('Failed to request dungeon:', error);
      throw error;
    }
  }
  
  // Listener pattern
  addListener(listener) {
    this.listeners.add(listener);
  }
  
  removeListener(listener) {
    this.listeners.delete(listener);
  }
  
  notifyListeners() {
    this.listeners.forEach(listener => {
      if (typeof listener === 'function') {
        listener(this.getState());
      }
    });
  }
  
  getState() {
    return {
      user: this.user,
      progress: this.progress,
      activeDungeon: this.activeDungeon
    };
  }
  
  clear() {
    this.user = null;
    this.progress = null;
    this.activeDungeon = null;
    localStorage.removeItem('isekai_token');
    localStorage.removeItem('isekai_user');
    this.notifyListeners();
  }
}

export default {
  authAPI,
  progressAPI,
  dungeonAPI,
  shopAPI,
  GameState
};
