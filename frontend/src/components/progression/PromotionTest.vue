<template>
  <div class="system-card p-6 border-2" :class="borderClass">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold" :class="titleClass">
        <span class="text-2xl mr-2">🏆</span> PROMOTION TEST
      </h3>
      <div class="text-right">
        <div class="text-sm text-gray-400">Current Rank</div>
        <div class="text-2xl font-bold" :class="rankColor">{{ currentRank }}</div>
      </div>
    </div>
    
    <!-- Test Information -->
    <div class="mb-6">
      <div class="text-center mb-4">
        <h4 class="text-2xl font-bold mb-2">{{ nextRank }} Test</h4>
        <p class="text-gray-300">Prove your worth to advance to the next rank</p>
      </div>
      
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="text-center p-3 bg-gray-800/30 rounded">
          <div class="text-sm text-gray-400">Required Level</div>
          <div class="text-xl font-bold text-blue-400">{{ requiredLevel }}</div>
        </div>
        <div class="text-center p-3 bg-gray-800/30 rounded">
          <div class="text-sm text-gray-400">Your Level</div>
          <div class="text-xl font-bold" :class="levelMet ? 'text-green-400' : 'text-red-400'">
            {{ currentLevel }}
          </div>
        </div>
      </div>
      
      <!-- Requirements -->
      <div class="mb-4">
        <h5 class="font-semibold text-gray-300 mb-2">Requirements:</h5>
        <ul class="space-y-2">
          <li v-for="req in requirements" :key="req.id" class="flex items-center text-sm">
            <span :class="req.met ? 'text-green-400' : 'text-gray-500'" class="mr-2">
              {{ req.met ? '✓' : '○' }}
            </span>
            <span :class="req.met ? 'text-white' : 'text-gray-400'">{{ req.description }}</span>
          </li>
        </ul>
      </div>
      
      <!-- Consequences -->
      <div class="p-4 bg-red-900/20 border border-red-700/50 rounded">
        <div class="flex items-center mb-2">
          <span class="text-red-400 mr-2">⚠️</span>
          <span class="font-semibold text-red-300">WARNING: High Stakes</span>
        </div>
        <p class="text-sm text-red-400/80">
          Failure will result in becoming <span class="font-bold">FALLEN</span>, 
          with increased difficulty and corrupted constellation.
        </p>
      </div>
    </div>
    
    <!-- Test Actions -->
    <div v-if="allRequirementsMet">
      <div class="text-center mb-4">
        <p class="text-gray-300 mb-2">Ready to attempt promotion?</p>
        <p class="text-sm text-gray-400">Ensure you have at least 30 minutes available</p>
      </div>
      
      <div class="space-y-3">
        <button 
          @click="startPromotionTest"
          class="system-btn w-full py-3"
          :class="buttonClass"
          :disabled="isStarting"
        >
          {{ isStarting ? 'Preparing Test...' : 'BEGIN PROMOTION TEST' }}
        </button>
        
        <button 
          @click="showDetails = !showDetails"
          class="text-sm text-gray-400 hover:text-white w-full text-center"
        >
          {{ showDetails ? 'Hide Test Details' : 'Show Test Details' }}
        </button>
      </div>
    </div>
    
    <!-- Not Ready -->
    <div v-else class="text-center py-4">
      <div class="text-3xl mb-2">📊</div>
      <h4 class="text-lg font-bold text-gray-300 mb-2">Not Ready Yet</h4>
      <p class="text-gray-400 mb-4">Complete all requirements to attempt promotion</p>
      <button 
        @click="showRequirements"
        class="system-btn system-btn-warning"
      >
        View Missing Requirements
      </button>
    </div>
    
    <!-- Test Details -->
    <div v-if="showDetails && allRequirementsMet" class="mt-6 pt-4 border-t border-gray-700">
      <h5 class="font-semibold text-gray-300 mb-3">Test Details</h5>
      <div class="space-y-3">
        <div class="p-3 bg-gray-800/50 rounded">
          <div class="font-medium text-white mb-1">Test Structure</div>
          <p class="text-sm text-gray-300">
            Complete exercises from all 4 gauntlets back-to-back with 60s rest between disciplines.
          </p>
        </div>
        
        <div class="p-3 bg-gray-800/50 rounded">
          <div class="font-medium text-white mb-1">Strict Rules</div>
          <ul class="text-sm text-gray-300 space-y-1">
            <li>• No consumables allowed</li>
            <li>• Zero tolerance for form breaks</li>
            <li>• Must complete all sets with perfect form</li>
            <li>• Time limit: 45 minutes total</li>
          </ul>
        </div>
        
        <div class="p-3 bg-gray-800/50 rounded">
          <div class="font-medium text-white mb-1">Success Conditions</div>
          <ul class="text-sm text-gray-300 space-y-1">
            <li>• All exercises completed within time</li>
            <li>• ≤ 2 total form breaks across all exercises</li>
            <li>• No assistance or equipment failure</li>
          </ul>
        </div>
      </div>
    </div>
    
    <!-- Previous Attempts -->
    <div v-if="previousAttempts.length > 0" class="mt-6 pt-4 border-t border-gray-700">
      <h5 class="font-semibold text-gray-300 mb-3">Previous Attempts</h5>
      <div class="space-y-2">
        <div 
          v-for="attempt in previousAttempts"
          :key="attempt.id"
          class="p-3 rounded text-sm"
          :class="attempt.success ? 'bg-green-900/30' : 'bg-red-900/30'"
        >
          <div class="flex justify-between items-center">
            <div>
              <span class="font-medium">{{ attempt.rank }} Test</span>
              <span class="text-xs text-gray-500 ml-2">{{ formatDate(attempt.date) }}</span>
            </div>
            <span :class="attempt.success ? 'text-green-400' : 'text-red-400'">
              {{ attempt.success ? 'SUCCESS' : 'FAILED' }}
            </span>
          </div>
          <div v-if="attempt.notes" class="text-xs text-gray-400 mt-1">
            {{ attempt.notes }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { dungeonAPI } from '@/services/api'

const props = defineProps({
  user: {
    type: Object,
    required: true
  },
  progress: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['promotion-attempt'])

const showDetails = ref(false)
const isStarting = ref(false)
const previousAttempts = ref([])

// Computed properties
const currentRank = computed(() => {
  return props.user?.character_data?.rank || 'F'
})

const currentLevel = computed(() => {
  return props.user?.character_data?.level || 0
})

const nextRank = computed(() => {
  const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']
  const currentIndex = rankOrder.indexOf(currentRank.value)
  return currentIndex < rankOrder.length - 1 ? rankOrder[currentIndex + 1] : 'MAX'
})

const requiredLevel = computed(() => {
  const requirements = {
    'F': 5, 'E': 10, 'D': 20, 'C': 35, 'B': 55, 'A': 80, 'S': 120, 'SS': 180
  }
  return requirements[currentRank.value] || 999
})

const levelMet = computed(() => currentLevel.value >= requiredLevel.value)

const rankColor = computed(() => {
  const colors = {
    'F': 'text-gray-400',
    'E': 'text-gray-300',
    'D': 'text-green-400',
    'C': 'text-blue-400',
    'B': 'text-purple-400',
    'A': 'text-red-400',
    'S': 'text-yellow-400',
    'SS': 'text-orange-400',
    'SSS': 'text-gradient-to-r from-yellow-400 to-red-500'
  }
  return colors[currentRank.value] || 'text-white'
})

const borderClass = computed(() => {
  if (nextRank.value === 'MAX') return 'border-gray-700'
  return levelMet.value ? 'border-green-500/50' : 'border-yellow-500/50'
})

const titleClass = computed(() => {
  return levelMet.value ? 'text-green-300' : 'text-yellow-300'
})

const buttonClass = computed(() => {
  return levelMet.value ? 'system-btn-success' : 'system-btn-warning'
})

const requirements = computed(() => {
  const baseReqs = [
    {
      id: 'level',
      description: `Reach Level ${requiredLevel.value} (Current: ${currentLevel.value})`,
      met: levelMet.value
    },
    {
      id: 'gauntlets',
      description: 'Complete Stage 30 in all gauntlets',
      met: checkGauntletRequirement()
    },
    {
      id: 'dungeons',
      description: 'Complete at least 5 dungeons',
      met: (props.progress?.statistics?.total_dungeons_completed || 0) >= 5
    },
    {
      id: 'challenges',
      description: 'Complete 50+ challenges',
      met: (props.user?.character_data?.challenges_completed || 0) >= 50
    }
  ]
  
  // Add rank-specific requirements
  if (currentRank.value === 'A') {
    baseReqs.push({
      id: 'bosses',
      description: 'Defeat 3 Boss Stages',
      met: checkBossRequirement()
    })
  }
  
  if (currentRank.value === 'S') {
    baseReqs.push({
      id: 'consistency',
      description: 'Maintain 30-day activity streak',
      met: (props.progress?.statistics?.current_streak || 0) >= 30
    })
  }
  
  return baseReqs
})

const allRequirementsMet = computed(() => {
  return requirements.value.every(req => req.met)
})

// Methods
const checkGauntletRequirement = () => {
  const stages = props.user?.character_data?.gauntlet_stages || {}
  const requiredStage = currentRank.value === 'A' ? 40 : 30
  
  return Object.values(stages).every(stage => stage >= requiredStage)
}

const checkBossRequirement = () => {
  const progress = props.progress?.gauntlet_progress || {}
  let bossCount = 0
  
  Object.values(progress).forEach(gauntlet => {
    if (gauntlet.boss_bonuses) {
      bossCount += gauntlet.boss_bonuses.length
    }
  })
  
  return bossCount >= 3
}

const startPromotionTest = async () => {
  if (!allRequirementsMet.value || isStarting.value) return
  
  isStarting.value = true
  
  try {
    // Generate promotion dungeon
    const result = await dungeonAPI.generatePromotionDungeon()
    
    emit('promotion-attempt', {
      dungeon: result.dungeon,
      rank: currentRank.value,
      nextRank: nextRank.value
    })
    
  } catch (error) {
    console.error('Failed to start promotion test:', error)
  } finally {
    isStarting.value = false
  }
}

const showRequirements = () => {
  showDetails.value = true
}

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Load previous attempts
onMounted(() => {
  // This would come from API in real app
  previousAttempts.value = [
    {
      id: 1,
      rank: 'D → C',
      date: '2024-01-15',
      success: true,
      notes: 'Perfect form maintained'
    },
    {
      id: 2,
      rank: 'C → B',
      date: '2024-02-20',
      success: false,
      notes: 'Failed due to form breaks'
    }
  ]
})
</script>
