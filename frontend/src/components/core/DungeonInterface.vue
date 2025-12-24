<template>
  <div class="system-card p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold text-blue-300">
        <span class="text-2xl mr-2">🏰</span> DUNGEON SYSTEM
      </h3>
      <div class="text-right">
        <div class="text-sm text-gray-400">Keys Available</div>
        <div class="text-2xl font-bold text-yellow-400">{{ dungeonKeys }}</div>
      </div>
    </div>
    
    <!-- Active Dungeon -->
    <div v-if="activeDungeon" class="mb-6">
      <div class="bg-gradient-to-r from-gray-800/50 to-gray-900/50 p-5 rounded-lg border border-gray-700">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h4 class="text-lg font-bold text-white">{{ activeDungeon.archetype }} Dungeon</h4>
            <div class="text-sm text-gray-400">In Progress</div>
          </div>
          <span class="text-xs px-3 py-1 rounded-full bg-blue-900/50 text-blue-300">
            {{ formatDuration(activeDungeon.started_at) }}
          </span>
        </div>
        
        <!-- Dungeon Info -->
        <div class="mb-4">
          <p class="text-gray-300 mb-3">{{ getDungeonDescription(activeDungeon.archetype) }}</p>
          
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="text-center p-3 bg-gray-800/30 rounded">
              <div class="text-sm text-gray-400">Difficulty</div>
              <div class="text-lg font-bold" :class="difficultyColor">
                {{ activeDungeon.difficulty || 'Medium' }}
              </div>
            </div>
            <div class="text-center p-3 bg-gray-800/30 rounded">
              <div class="text-sm text-gray-400">Potential Reward</div>
              <div class="text-lg font-bold text-green-400">
                {{ calculatePotentialReward() }} XP
              </div>
            </div>
          </div>
          
          <!-- Exercises -->
          <div v-if="activeDungeon.exercises" class="mb-4">
            <h5 class="font-semibold text-gray-300 mb-2">Exercises:</h5>
            <div class="space-y-2">
              <div 
                v-for="(exercise, index) in activeDungeon.exercises"
                :key="index"
                class="p-2 bg-gray-900/50 rounded text-sm"
              >
                <div class="flex justify-between">
                  <span class="font-medium">{{ exercise.gauntlet.toUpperCase() }} Stage {{ exercise.stage }}</span>
                  <span class="text-blue-300">
                    {{ exercise.reps || exercise.time || exercise.sets }} {{ getExerciseUnit(exercise) }}
                  </span>
                </div>
                <div v-if="exercise.description" class="text-xs text-gray-400 mt-1">
                  {{ exercise.description }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="grid grid-cols-2 gap-3">
          <button 
            @click="completeDungeon(true)"
            class="system-btn system-btn-success py-3"
            :disabled="isProcessing"
          >
            ✅ Complete
          </button>
          <button 
            @click="abandonDungeon"
            class="system-btn system-btn-danger py-3"
            :disabled="isProcessing"
          >
            🚫 Abandon
          </button>
        </div>
      </div>
    </div>
    
    <!-- No Active Dungeon -->
    <div v-else class="text-center py-8">
      <div class="text-4xl mb-4">🔑</div>
      <h4 class="text-xl font-bold text-gray-300 mb-2">No Active Dungeon</h4>
      <p class="text-gray-400 mb-6">Use a dungeon key to enter a randomly assigned dungeon</p>
      
      <button 
        @click="requestDungeon"
        class="system-btn w-full py-3"
        :disabled="dungeonKeys < 1 || isProcessing"
      >
        {{ dungeonKeys < 1 ? 'Need More Keys' : 'ENTER DUNGEON (1 Key)' }}
      </button>
      
      <div class="mt-4 text-sm text-gray-500">
        Earn keys by completing challenges (1 key per 5 challenges)
      </div>
    </div>
    
    <!-- Dungeon History -->
    <div v-if="dungeonHistory.length > 0" class="mt-6">
      <h5 class="font-semibold text-gray-300 mb-3">Recent Dungeons</h5>
      <div class="space-y-2 max-h-48 overflow-y-auto">
        <div 
          v-for="dungeon in dungeonHistory.slice(0, 5)"
          :key="dungeon.id"
          class="p-3 bg-gray-800/30 rounded text-sm"
        >
          <div class="flex justify-between items-center">
            <div>
              <span class="font-medium">{{ dungeon.archetype }}</span>
              <span class="text-xs text-gray-500 ml-2">{{ formatTimeAgo(dungeon.completed_at) }}</span>
            </div>
            <span :class="dungeon.success ? 'text-green-400' : 'text-red-400'">
              {{ dungeon.success ? '✓ Success' : '✗ Failed' }}
            </span>
          </div>
          <div class="text-xs text-gray-400 mt-1">
            Score: {{ dungeon.score || 'N/A' }} • Loot: {{ dungeon.loot || '0' }} SC
          </div>
        </div>
      </div>
    </div>
    
    <!-- Statistics -->
    <div class="mt-6 pt-4 border-t border-gray-700">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <div class="text-2xl font-bold text-blue-400">{{ totalCompleted }}</div>
          <div class="text-xs text-gray-400">Completed</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-green-400">{{ successRate }}%</div>
          <div class="text-xs text-gray-400">Success Rate</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-yellow-400">{{ totalSCEarned }}</div>
          <div class="text-xs text-gray-400">SC Earned</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { dungeonAPI } from '@/services/api'

const props = defineProps({
  dungeon: {
    type: Object,
    default: null
  },
  progress: {
    type: Object,
    default: () => ({ dungeon_keys: 0, dungeon_history: [] })
  }
})

const emit = defineEmits([
  'dungeon-request',
  'dungeon-complete', 
  'dungeon-abandon'
])

const isProcessing = ref(false)
const dungeonHistory = ref([])

// Computed properties
const activeDungeon = computed(() => props.dungeon)
const dungeonKeys = computed(() => props.progress?.dungeon_keys || 0)

const difficultyColor = computed(() => {
  const difficulty = activeDungeon.value?.difficulty?.toLowerCase()
  const colors = {
    easy: 'text-green-400',
    medium: 'text-yellow-400',
    hard: 'text-orange-400',
    extreme: 'text-red-400'
  }
  return colors[difficulty] || 'text-white'
})

const totalCompleted = computed(() => {
  return dungeonHistory.value.filter(d => d.success).length
})

const successRate = computed(() => {
  if (dungeonHistory.value.length === 0) return 0
  const successful = dungeonHistory.value.filter(d => d.success).length
  return Math.round((successful / dungeonHistory.value.length) * 100)
})

const totalSCEarned = computed(() => {
  return dungeonHistory.value.reduce((sum, d) => sum + (d.loot || 0), 0)
})

// Methods
const getDungeonDescription = (archetype) => {
  const descriptions = {
    TIME_TRIAL: 'Complete all exercises as fast as possible with good form.',
    GRAVITY: 'Maintain perfect tempo and form under increased difficulty.',
    CURSED: 'Endure through constraints and limitations.',
    HYBRID: 'Combination challenge testing multiple attributes.',
    PROMOTION: 'High-stakes test for rank advancement.'
  }
  return descriptions[archetype] || 'Complete the assigned exercises.'
}

const getExerciseUnit = (exercise) => {
  if (exercise.time) return 'seconds'
  if (exercise.reps && exercise.sets) return `reps × ${exercise.sets} sets`
  if (exercise.reps) return 'reps'
  return ''
}

const calculatePotentialReward = () => {
  const base = 100
  const multiplier = {
    easy: 0.8,
    medium: 1.0,
    hard: 1.5,
    extreme: 2.0
  }
  const difficulty = activeDungeon.value?.difficulty?.toLowerCase() || 'medium'
  return Math.floor(base * (multiplier[difficulty] || 1))
}

const formatDuration = (startTime) => {
  if (!startTime) return 'Just started'
  const start = new Date(startTime)
  const now = new Date()
  const diffMs = now - start
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just started'
  if (diffMins < 60) return `${diffMins}m ago`
  return `${Math.floor(diffMins / 60)}h ago`
}

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return 'Recently'
  const time = new Date(timestamp)
  const now = new Date()
  const diffMs = now - time
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays < 1) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

const requestDungeon = async () => {
  if (dungeonKeys.value < 1 || isProcessing.value) return
  
  isProcessing.value = true
  emit('dungeon-request')
  setTimeout(() => isProcessing.value = false, 1000)
}

const completeDungeon = async (success) => {
  if (!activeDungeon.value || isProcessing.value) return
  
  isProcessing.value = true
  
  // Prepare completion data
  const completionData = {
    form_breaks: Math.floor(Math.random() * 3), // Simulated
    completion_time: 300 + Math.floor(Math.random() * 600), // 5-15 minutes
    constraint_violations: 0,
    details: {
      performance_notes: success ? 'Good form maintained' : 'Struggled with tempo'
    }
  }
  
  emit('dungeon-complete', {
    dungeonId: activeDungeon.value.id,
    success,
    data: completionData
  })
  
  // Add to history
  if (success) {
    dungeonHistory.value.unshift({
      id: activeDungeon.value.id,
      archetype: activeDungeon.value.archetype,
      success: true,
      score: 85 + Math.floor(Math.random() * 15),
      loot: calculatePotentialReward(),
      completed_at: new Date().toISOString()
    })
  }
  
  setTimeout(() => isProcessing.value = false, 1500)
}

const abandonDungeon = async () => {
  if (!activeDungeon.value || isProcessing.value) return
  
  isProcessing.value = true
  emit('dungeon-abandon', activeDungeon.value.id)
  setTimeout(() => isProcessing.value = false, 1000)
}

// Load history on mount
onMounted(() => {
  if (props.progress?.dungeon_history) {
    dungeonHistory.value = props.progress.dungeon_history
      .slice(0, 10)
      .map(d => ({
        ...d,
        completed_at: d.completed_at || new Date().toISOString()
      }))
  }
})
</script>
