
<template>
  <div class="system-card p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xl font-bold text-blue-300">
        <span class="text-2xl mr-2">📋</span> CHALLENGE LOG
      </h3>
      <div class="text-sm text-gray-400">
        Keys: <span class="text-yellow-400 font-bold">{{ player.dungeonKeys }}</span>
        ({{ challengesUntilKey }} until next)
      </div>
    </div>

    <!-- Active Challenges -->
    <div class="mb-6">
      <div class="flex justify-between items-center mb-3">
        <h4 class="text-lg font-semibold text-gray-300">Active Challenges</h4>
        <button 
          @click="generateNewChallenge"
          class="text-sm system-btn py-1 px-3"
          :disabled="activeChallenges.length >= 3"
        >
          + New Challenge
        </button>
      </div>
      
      <div class="space-y-3">
        <div 
          v-for="challenge in activeChallenges"
          :key="challenge.id"
          class="challenge-item p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition-colors"
        >
          <div class="flex justify-between items-start mb-2">
            <div>
              <span class="font-semibold text-white">{{ challenge.title }}</span>
              <span class="ml-2 text-xs px-2 py-1 rounded" 
                    :class="challengeTypeClass(challenge.type)">
                {{ challenge.type }}
              </span>
            </div>
            <button 
              @click="completeChallenge(challenge.id)"
              class="text-sm system-btn py-1 px-3"
              :disabled="challenge.completing"
            >
              {{ challenge.completing ? '...' : 'Complete' }}
            </button>
          </div>
          
          <p class="text-sm text-gray-400 mb-3">{{ challenge.description }}</p>
          
          <div class="flex justify-between text-xs">
            <div>
              <span class="text-gray-500">Reward:</span>
              <span class="ml-1 text-yellow-400">{{ challenge.reward }} XP</span>
            </div>
            <div>
              <span class="text-gray-500">Time:</span>
              <span class="ml-1" :class="challenge.timeClass">
                {{ challenge.timeEstimate }}
              </span>
            </div>
          </div>
          
          <!-- Progress bar for multi-step challenges -->
          <div v-if="challenge.steps" class="mt-3">
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{{ challenge.currentStep }}/{{ challenge.totalSteps }}</span>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-2">
              <div 
                class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                :style="{ width: `${(challenge.currentStep / challenge.totalSteps) * 100}%` }"
              ></div>
            </div>
          </div>
        </div>
        
        <div v-if="activeChallenges.length === 0" class="text-center py-6 text-gray-500">
          <div class="text-3xl mb-2">🎯</div>
          <p>No active challenges. Generate one to start progressing!</p>
          <button 
            @click="generateNewChallenge"
            class="system-btn mt-4"
          >
            Generate First Challenge
          </button>
        </div>
      </div>
    </div>

    <!-- Recent Completions -->
    <div v-if="recentCompletions.length > 0">
      <h4 class="text-lg font-semibold text-gray-300 mb-3">Recent Completions</h4>
      <div class="space-y-2">
        <div 
          v-for="completion in recentCompletions.slice(0, 5)"
          :key="completion.id"
          class="flex justify-between items-center p-3 bg-gray-800/30 rounded"
        >
          <div>
            <span class="text-sm text-gray-300">{{ completion.title }}</span>
            <span class="text-xs text-gray-500 ml-2">{{ formatTime(completion.timestamp) }}</span>
          </div>
          <span class="text-sm text-green-400">+{{ completion.xp }} XP</span>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="mt-6 pt-4 border-t border-gray-700">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <div class="text-2xl font-bold text-blue-400">{{ player.challengesCompleted }}</div>
          <div class="text-xs text-gray-400">Total Completed</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-green-400">{{ challengeStreak }}</div>
          <div class="text-xs text-gray-400">Day Streak</div>
        </div>
        <div>
          <div class="text-2xl font-bold text-purple-400">{{ Math.floor(player.challengesCompleted / 5) }}</div>
          <div class="text-xs text-gray-400">Keys Earned</div>
        </div>
      </div>
    </div>

    <!-- System Message -->
    <div v-if="systemMessage" class="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
      <p class="text-sm font-mono text-blue-300">{{ systemMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  player: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['challenge-completed'])

// State
const activeChallenges = ref([])
const recentCompletions = ref([])
const systemMessage = ref('')
const challengeStreak = ref(7) // Would come from persistence

// Computed
const challengesUntilKey = computed(() => {
  const completed = props.player.challengesCompleted || 0
  return 5 - (completed % 5)
})

// Challenge templates
const challengeTemplates = [
  {
    type: 'STRENGTH',
    title: 'Push Power Surge',
    description: 'Complete 3 sets of your current Push stage with perfect form',
    reward: 75,
    timeEstimate: '15-20 min',
    difficulty: 'Medium'
  },
  {
    type: 'ENDURANCE',
    title: 'Sustained Effort',
    description: 'Maintain 70% max effort for 10 minutes continuous activity',
    reward: 100,
    timeEstimate: '10 min',
    difficulty: 'Hard'
  },
  {
    type: 'SKILL',
    title: 'Form Perfection',
    description: 'Execute current stage with zero form breaks for 2 clean sets',
    reward: 60,
    timeEstimate: '10-15 min',
    difficulty: 'Medium'
  },
  {
    type: 'RECOVERY',
    title: 'Active Restoration',
    description: 'Complete mobility work focusing on tight areas',
    reward: 40,
    timeEstimate: '20 min',
    difficulty: 'Easy'
  },
  {
    type: 'MIXED',
    title: 'Full System Activation',
    description: 'Complete one stage from each gauntlet in a single session',
    reward: 150,
    timeEstimate: '30-45 min',
    difficulty: 'Hard',
    steps: true
  }
]

// Methods
const generateNewChallenge = () => {
  if (activeChallenges.value.length >= 3) {
    systemMessage.value = '[Maximum active challenges (3) reached. Complete one first.]'
    return
  }
  
  const template = challengeTemplates[Math.floor(Math.random() * challengeTemplates.length)]
  const challenge = {
    id: Date.now() + Math.random(),
    ...template,
    currentStep: 0,
    totalSteps: template.steps ? 4 : 1,
    completing: false
  }
  
  activeChallenges.value.push(challenge)
  systemMessage.value = `[New challenge generated: ${challenge.title}]`
}

const completeChallenge = (challengeId) => {
  const challenge = activeChallenges.value.find(c => c.id === challengeId)
  if (!challenge) return
  
  challenge.completing = true
  
  // Simulate completion process
  setTimeout(() => {
    // Record completion
    recentCompletions.value.unshift({
      id: Date.now(),
      title: challenge.title,
      xp: challenge.reward,
      timestamp: new Date()
    })
    
    // Keep only last 10 completions
    if (recentCompletions.value.length > 10) {
      recentCompletions.value = recentCompletions.value.slice(0, 10)
    }
    
    // Remove from active
    activeChallenges.value = activeChallenges.value.filter(c => c.id !== challengeId)
    
    // Emit to parent
    emit('challenge-completed', {
      challenge,
      reward: challenge.reward
    })
    
    systemMessage.value = `[Challenge completed! +${challenge.reward} XP earned.]`
    
    // Check for dungeon key
    if (challengesUntilKey.value === 1) {
      setTimeout(() => {
        systemMessage.value = '[Dungeon Key acquired! Check Dungeon Interface.]'
      }, 500)
    }
  }, 800)
}

const challengeTypeClass = (type) => {
  const classes = {
    'STRENGTH': 'bg-red-900/50 text-red-300',
    'ENDURANCE': 'bg-green-900/50 text-green-300',
    'SKILL': 'bg-blue-900/50 text-blue-300',
    'RECOVERY': 'bg-purple-900/50 text-purple-300',
    'MIXED': 'bg-gradient-to-r from-blue-900/50 to-purple-900/50 text-white'
  }
  return classes[type] || 'bg-gray-800 text-gray-300'
}

const formatTime = (timestamp) => {
  const now = new Date()
  const time = new Date(timestamp)
  const diffMs = now - time
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}

// Initialize
onMounted(() => {
  // Load any saved challenges from localStorage
  const savedChallenges = localStorage.getItem('isekai_active_challenges')
  if (savedChallenges) {
    try {
      activeChallenges.value = JSON.parse(savedChallenges)
    } catch (e) {
      console.error('Failed to load saved challenges:', e)
    }
  }
  
  // Generate initial challenge if none
  if (activeChallenges.value.length === 0) {
    generateNewChallenge()
  }
})

// Auto-save challenges
setInterval(() => {
  localStorage.setItem('isekai_active_challenges', JSON.stringify(activeChallenges.value))
}, 30000)
</script>

<style scoped>
.challenge-item {
  transition: all 0.3s ease;
}

.challenge-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 180, 255, 0.1);
}
</style>
