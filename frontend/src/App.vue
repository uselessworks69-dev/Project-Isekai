<template>
  <div class="min-h-screen bg-gray-900 text-gray-100 font-sans">
    <!-- System Header with real data -->
    <SystemHeader 
      :user="gameState.user" 
      :progress="gameState.progress"
      @logout="handleLogout"
    />
    
    <main class="container mx-auto px-4 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p class="text-blue-300">Loading system data...</p>
      </div>
      
      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <div class="text-4xl mb-4">⚠️</div>
        <h2 class="text-2xl font-bold text-red-400 mb-2">System Error</h2>
        <p class="text-gray-300 mb-4">{{ error }}</p>
        <button @click="retryLoad" class="system-btn">
          Retry Connection
        </button>
      </div>
      
      <!-- Main Interface -->
      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Game Activities -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Challenge Log -->
          <ChallengeLog 
            :progress="gameState.progress"
            @challenge-completed="handleChallengeComplete"
          />
          
          <!-- Gauntlet Progress -->
          <div class="grid grid-cols-2 gap-4">
            <GauntletTracker 
              v-for="gauntlet in ['push', 'pull', 'legs', 'core']"
              :key="gauntlet"
              :type="gauntlet"
              :progress="gameState.progress?.gauntlet_progress?.[gauntlet]"
              :user="gameState.user"
              @stage-completed="handleStageComplete"
            />
          </div>
          
          <!-- Dungeon Interface -->
          <DungeonInterface 
            :dungeon="gameState.activeDungeon"
            :progress="gameState.progress"
            @dungeon-request="handleDungeonRequest"
            @dungeon-complete="handleDungeonComplete"
            @dungeon-abandon="handleDungeonAbandon"
          />
        </div>
        
        <!-- Right Column: Systems & Status -->
        <div class="space-y-6">
          <!-- Constellation Display -->
          <ConstellationSigil 
            v-if="gameState.user?.character_data?.active_constellation"
            :constellation="gameState.user.character_data.active_constellation"
            :user="gameState.user"
          />
          
          <!-- Fallen State / Purification -->
          <PurificationArc 
            v-if="gameState.user?.character_data?.is_fallen"
            :user="gameState.user"
            :progress="gameState.progress"
            @purification-start="handlePurificationStart"
            @purification-progress="handlePurificationProgress"
          />
          
          <!-- Promotion Test -->
          <PromotionTest 
            v-if="gameState.progress?.promotion_status?.can_attempt"
            :user="gameState.user"
            :progress="gameState.progress"
            @promotion-attempt="handlePromotionAttempt"
          />
          
          <!-- Sponsor Tasks -->
          <SponsorTasks 
            v-if="gameState.user?.character_data?.active_constellation"
            :user="gameState.user"
            @task-completed="handleTaskComplete"
          />
          
          <!-- Constellation Shop -->
          <ConstellationShop 
            :user="gameState.user"
            @purchase-item="handleShopPurchase"
            @use-item="handleItemUse"
          />
        </div>
      </div>
    </main>
    
    <!-- System Notifications -->
    <NotificationSystem ref="notifications" />
    
    <!-- WebSocket Status -->
    <div v-if="socketConnected" class="fixed bottom-4 left-4">
      <div class="flex items-center text-xs text-green-400">
        <div class="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></div>
        Live Updates Connected
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { GameState, authAPI, progressAPI, dungeonAPI, shopAPI } from '@/services/api'
import io from 'socket.io-client'

// Components
import SystemHeader from '@/components/core/SystemHeader.vue'
import ChallengeLog from '@/components/progression/ChallengeLog.vue'
import GauntletTracker from '@/components/core/GauntletTracker.vue'
import DungeonInterface from '@/components/core/DungeonInterface.vue'
import ConstellationSigil from '@/components/core/ConstellationSigil.vue'
import PurificationArc from '@/components/progression/PurificationArc.vue'
import PromotionTest from '@/components/progression/PromotionTest.vue'
import SponsorTasks from '@/components/economy/SponsorTasks.vue'
import ConstellationShop from '@/components/economy/ConstellationShop.vue'
import NotificationSystem from '@/components/core/NotificationSystem.vue'

const router = useRouter()

// State
const gameState = ref(GameState.getInstance().getState())
const loading = ref(true)
const error = ref(null)
const socketConnected = ref(false)
const socket = ref(null)
const notifications = ref(null)

// Initialize
onMounted(async () => {
  await initializeApp()
})

onUnmounted(() => {
  if (socket.value) {
    socket.value.disconnect()
  }
})

// Methods
const initializeApp = async () => {
  try {
    loading.value = true
    error.value = null
    
    // Check if user is authenticated
    const token = localStorage.getItem('isekai_token')
    if (!token) {
      router.push('/login')
      return
    }
    
    // Initialize game state
    const success = await GameState.getInstance().initialize()
    if (!success) {
      throw new Error('Failed to initialize game state')
    }
    
    // Set up state listener
    GameState.getInstance().addListener((state) => {
      gameState.value = state
    })
    
    // Connect to WebSocket
    connectWebSocket()
    
    // Load initial data
    await loadInitialData()
    
    loading.value = false
    
  } catch (err) {
    console.error('Failed to initialize app:', err)
    error.value = err.message || 'Failed to load system data'
    loading.value = false
    
    // If auth error, redirect to login
    if (err.type === 'INVALID_TOKEN' || err.type === 'NO_TOKEN') {
      router.push('/login')
    }
  }
}

const connectWebSocket = () => {
  const token = localStorage.getItem('isekai_token')
  if (!token) return
  
  socket.value = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
    auth: { token },
    transports: ['websocket', 'polling']
  })
  
  socket.value.on('connect', () => {
    console.log('WebSocket connected')
    socketConnected.value = true
    
    // Join user-specific room
    if (gameState.value.user?.id) {
      socket.value.emit('join-room', `user-${gameState.value.user.id}`)
    }
  })
  
  socket.value.on('disconnect', () => {
    console.log('WebSocket disconnected')
    socketConnected.value = false
  })
  
  socket.value.on('progress-updated', (data) => {
    // Update local state when server pushes updates
    GameState.getInstance().updateProgress(data.progress)
    
    // Show notification
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'info',
        message: data.message || 'Progress updated',
        duration: 3000
      })
    }
  })
  
  socket.value.on('system-message', (message) => {
    if (notifications.value) {
      notifications.value.addNotification({
        type: message.type || 'info',
        message: message.text,
        duration: 5000
      })
    }
  })
  
  socket.value.on('error', (error) => {
    console.error('WebSocket error:', error)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: error.message || 'Connection error',
        duration: 5000
      })
    }
  })
}

const loadInitialData = async () => {
  try {
    // Load available constellations
    if (!gameState.value.user?.character_data?.active_constellation) {
      const available = await progressAPI.getAvailableConstellations()
      if (available.available.length > 0) {
        // Could show constellation offer modal
        console.log('Available constellations:', available.available)
      }
    }
    
    // Load shop items
    // shopAPI.getShopItems() would be called by shop component
    
    // Load inventory
    // shopAPI.getInventory() would be called by shop component
    
  } catch (err) {
    console.error('Failed to load initial data:', err)
  }
}

const retryLoad = () => {
  initializeApp()
}

// Event Handlers
const handleLogout = async () => {
  try {
    await authAPI.logout()
  } catch (err) {
    // Continue with client-side cleanup even if API call fails
  }
  
  GameState.getInstance().clear()
  localStorage.removeItem('isekai_token')
  localStorage.removeItem('isekai_user')
  
  router.push('/login')
}

const handleChallengeComplete = async (challenge) => {
  try {
    const result = await GameState.getInstance().completeChallenge(challenge)
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'success',
        message: `Challenge completed! +${challenge.xp} XP`,
        duration: 3000
      })
      
      // Check for dungeon key notification
      if (result.progress.dungeon_keys > 0 && 
          (gameState.value.progress?.dungeon_keys || 0) < result.progress.dungeon_keys) {
        setTimeout(() => {
          notifications.value.addNotification({
            type: 'info',
            message: 'Dungeon Key acquired!',
            duration: 4000
          })
        }, 1000)
      }
    }
    
  } catch (err) {
    console.error('Failed to complete challenge:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to complete challenge',
        duration: 5000
      })
    }
  }
}

const handleStageComplete = async ({ type, stage }) => {
  try {
    // Calculate XP based on stage (this would come from your XP table)
    const stageNumber = parseInt(stage)
    const xpTable = [
      { range: [1, 10], xp: 10 },
      { range: [11, 20], xp: 20 },
      { range: [21, 30], xp: 30 },
      { range: [31, 40], xp: 40 },
      { range: [41, 50], xp: 60 },
      { range: [51, 60], xp: 80 },
      { range: [61, 70], xp: 110 },
      { range: [71, 80], xp: 160 }
    ]
    
    const xpEntry = xpTable.find(entry => 
      stageNumber >= entry.range[0] && stageNumber <= entry.range[1]
    )
    const xpEarned = xpEntry?.xp || 10
    
    // Check if boss stage
    const isBoss = stageNumber % 10 === 0
    const bossBonus = isBoss ? xpEarned * 5 : 0 // Boss bonus is 5x stage XP
    
    const result = await GameState.getInstance().completeGauntletStage(type, {
      stage: stageNumber,
      xp: xpEarned,
      isBoss,
      bossBonus
    })
    
    if (notifications.value) {
      let message = `${type.toUpperCase()} Stage ${stage} cleared! +${xpEarned} XP`
      if (isBoss) {
        message += ` (+${bossBonus} Boss Bonus, +1 INT)`
      }
      
      notifications.value.addNotification({
        type: 'success',
        message,
        duration: 4000
      })
    }
    
  } catch (err) {
    console.error('Failed to complete stage:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to complete stage',
        duration: 5000
      })
    }
  }
}

const handleDungeonRequest = async () => {
  try {
    const result = await GameState.getInstance().requestDungeon()
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'info',
        message: `Entering ${result.dungeon.archetype} Dungeon...`,
        duration: 4000
      })
    }
    
  } catch (err) {
    console.error('Failed to request dungeon:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to request dungeon',
        duration: 5000
      })
    }
  }
}

const handleDungeonComplete = async ({ dungeonId, success, data }) => {
  try {
    const result = await dungeonAPI.completeDungeon(dungeonId, success, data)
    
    // Update local state
    GameState.getInstance().updateActiveDungeon(null)
    
    if (notifications.value) {
      const message = success 
        ? `Dungeon cleared! +${result.result.loot.xp} XP, +${result.result.loot.sc} SC`
        : 'Dungeon failed...'
      
      notifications.value.addNotification({
        type: success ? 'success' : 'warning',
        message,
        duration: 5000
      })
    }
    
  } catch (err) {
    console.error('Failed to complete dungeon:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to complete dungeon',
        duration: 5000
      })
    }
  }
}

const handleDungeonAbandon = async (dungeonId) => {
  try {
    await dungeonAPI.abandonDungeon(dungeonId)
    GameState.getInstance().updateActiveDungeon(null)
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'warning',
        message: 'Dungeon abandoned',
        duration: 3000
      })
    }
    
  } catch (err) {
    console.error('Failed to abandon dungeon:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to abandon dungeon',
        duration: 5000
      })
    }
  }
}

const handlePurificationStart = async () => {
  try {
    const result = await progressAPI.startPurification()
    
    // Update local state
    if (gameState.value.progress) {
      gameState.value.progress.purification_progress = result.purification
    }
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'info',
        message: 'Purification arc begun. The cost will be everything.',
        duration: 6000
      })
    }
    
  } catch (err) {
    console.error('Failed to start purification:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to start purification',
        duration: 5000
      })
    }
  }
}

const handlePurificationProgress = async ({ phase, data }) => {
  try {
    const result = await progressAPI.completePurificationPhase(phase, data)
    
    // Update local state
    if (gameState.value.progress) {
      gameState.value.progress.purification_progress = result.purification
    }
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'success',
        message: `Purification phase ${phase} completed`,
        duration: 4000
      })
    }
    
  } catch (err) {
    console.error('Failed to complete purification phase:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to complete purification phase',
        duration: 5000
      })
    }
  }
}

const handlePromotionAttempt = async (attemptData) => {
  try {
    // First generate promotion dungeon
    const dungeonResult = await dungeonAPI.generatePromotionDungeon()
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'warning',
        message: 'Promotion dungeon generated. Extreme caution advised.',
        duration: 5000
      })
    }
    
    // Here you would navigate to the promotion dungeon interface
    // For now, just update active dungeon
    GameState.getInstance().updateActiveDungeon(dungeonResult.dungeon)
    
  } catch (err) {
    console.error('Failed to start promotion attempt:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to start promotion attempt',
        duration: 5000
      })
    }
  }
}

const handleTaskComplete = async (task) => {
  try {
    // Task completion would be handled by backend when conditions met
    // This is just for notification
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'success',
        message: `Sponsor task completed! +${task.reward} SC`,
        duration: 4000
      })
    }
    
  } catch (err) {
    console.error('Task completion error:', err)
  }
}

const handleShopPurchase = async ({ itemId, quantity }) => {
  try {
    const result = await shopAPI.purchaseItem(itemId, quantity)
    
    // Update user SC balance
    if (gameState.value.user) {
      gameState.value.user.character_data.sponsorship_credits = 
        result.purchase.remaining_sc
    }
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'success',
        message: `Purchased ${itemId} x${quantity}`,
        duration: 4000
      })
    }
    
  } catch (err) {
    console.error('Failed to purchase item:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to purchase item',
        duration: 5000
      })
    }
  }
}

const handleItemUse = async ({ itemId, context }) => {
  try {
    const result = await shopAPI.useItem(itemId, context)
    
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'info',
        message: result.message,
        duration: 4000
      })
    }
    
  } catch (err) {
    console.error('Failed to use item:', err)
    if (notifications.value) {
      notifications.value.addNotification({
        type: 'error',
        message: err.message || 'Failed to use item',
        duration: 5000
      })
    }
  }
}
</script>

<style>
/* Global styles */
@import '@/assets/css/main.css';
</style>
