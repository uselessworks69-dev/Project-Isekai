<template>
  <div class="system-card p-6" v-if="activeConstellation">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-xl font-bold text-purple-300">
        <span class="text-2xl mr-2">📜</span> SPONSOR TASKS
      </h3>
      <div class="flex items-center">
        <span class="text-sm text-gray-400 mr-2">Sponsored by:</span>
        <span class="font-bold" :style="{ color: constellationColor }">
          {{ constellationName }}
        </span>
      </div>
    </div>

    <!-- Current Task -->
    <div v-if="currentTask" class="mb-6">
      <div class="flex justify-between items-center mb-3">
        <h4 class="text-lg font-semibold text-white">Active Task</h4>
        <span class="text-xs px-3 py-1 rounded-full" 
              :class="taskRarityClass(currentTask.rarity)">
          {{ currentTask.rarity }}
        </span>
      </div>
      
      <div class="bg-gradient-to-r from-gray-800/50 to-gray-900/50 p-5 rounded-lg border border-gray-700">
        <h5 class="text-xl font-bold mb-2 text-white">{{ currentTask.name }}</h5>
        <p class="text-gray-300 mb-4">{{ currentTask.description }}</p>
        
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="text-center p-3 bg-gray-800/30 rounded">
            <div class="text-sm text-gray-400">Reward</div>
            <div class="text-xl font-bold text-yellow-400">{{ currentTaskReward }} SC</div>
          </div>
          <div class="text-center p-3 bg-gray-800/30 rounded">
            <div class="text-sm text-gray-400">CL Bonus</div>
            <div class="text-lg text-green-400">+{{ clBonus }}%</div>
          </div>
        </div>
        
        <!-- Progress if multi-step -->
        <div v-if="currentTask.progress" class="mb-4">
          <div class="flex justify-between text-sm text-gray-400 mb-1">
            <span>Progress</span>
            <span>{{ currentTask.current }}/{{ currentTask.required }}</span>
          </div>
          <div class="w-full bg-gray-800 rounded-full h-2">
            <div 
              class="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
              :style="{ width: `${(currentTask.current / currentTask.required) * 100}%` }"
            ></div>
          </div>
        </div>
        
        <!-- Requirements -->
        <div v-if="currentTask.requirements" class="mb-4">
          <div class="text-sm text-gray-400 mb-2">Requirements:</div>
          <ul class="text-sm text-gray-300 space-y-1">
            <li v-for="(req, index) in currentTask.requirements" 
                :key="index"
                class="flex items-center">
              <span :class="req.met ? 'text-green-400' : 'text-gray-500'"
                    class="mr-2">•</span>
              {{ req.description }}
            </li>
          </ul>
        </div>
        
        <button 
          @click="attemptTask"
          class="system-btn w-full py-3"
          :class="canComplete ? 'system-btn-success' : 'system-btn-warning'"
          :disabled="!canComplete || isCompleting"
        >
          {{ isCompleting ? 'Processing...' : canComplete ? 'COMPLETE TASK' : 'Requirements Pending' }}
        </button>
      </div>
    </div>

    <!-- Available Tasks -->
    <div v-if="availableTasks.length > 0">
      <h4 class="text-lg font-semibold text-gray-300 mb-3">Available Tasks</h4>
      <div class="space-y-3">
        <div 
          v-for="task in availableTasks"
          :key="task.id"
          class="task-item p-4 rounded-lg border border-gray-700 hover:border-purple-500 transition-all cursor-pointer"
          @click="selectTask(task)"
        >
          <div class="flex justify-between items-center mb-2">
            <span class="font-semibold text-white">{{ task.name }}</span>
            <div class="flex items-center">
              <span class="text-xs mr-2 px-2 py-1 rounded" 
                    :class="taskRarityClass(task.rarity)">
                {{ task.rarity }}
              </span>
              <span class="text-sm text-yellow-400 font-bold">
                {{ calculateTaskReward(task) }} SC
              </span>
            </div>
          </div>
          <p class="text-sm text-gray-400">{{ task.description }}</p>
          <div class="mt-2 flex justify-between text-xs text-gray-500">
            <span>CL Bonus: +{{ (activeConstellation.cl - 1) * 8 }}%</span>
            <span v-if="task.timeLimit">{{ task.timeLimit }}h remaining</span>
          </div>
        </div>
      </div>
    </div>

    <!-- No Tasks -->
    <div v-else-if="!currentTask" class="text-center py-8 text-gray-500">
      <div class="text-4xl mb-3">📭</div>
      <p class="mb-4">No sponsor tasks available</p>
      <p class="text-sm text-gray-400">Complete dungeons or reach milestones to unlock new tasks</p>
    </div>

    <!-- Task History -->
    <div v-if="completedTasks.length > 0" class="mt-6">
      <h4 class="text-lg font-semibold text-gray-300 mb-3">Recently Completed</h4>
      <div class="space-y-2">
        <div 
          v-for="task in completedTasks.slice(0, 3)"
          :key="task.id"
          class="flex justify-between items-center p-3 bg-gray-800/30 rounded"
        >
          <div>
            <span class="text-sm text-gray-300">{{ task.name }}</span>
            <span class="text-xs text-gray-500 ml-2">{{ formatTime(task.completedAt) }}</span>
          </div>
          <span class="text-sm text-green-400">+{{ task.reward }} SC</span>
        </div>
      </div>
    </div>

    <!-- Constellation Info -->
    <div class="mt-6 pt-4 border-t border-gray-700">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm text-gray-400">Constellation Level</div>
          <div class="text-xl font-bold" :style="{ color: constellationColor }">
            CL {{ activeConstellation.cl }}
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm text-gray-400">Total Earned (This Sponsor)</div>
          <div class="text-xl font-bold text-yellow-400">{{ totalEarnedFromSponsor }} SC</div>
        </div>
      </div>
    </div>

    <!-- System Message -->
    <div v-if="systemMessage" class="mt-4 p-3 bg-purple-900/30 border border-purple-700 rounded">
      <p class="text-sm font-mono text-purple-300">{{ systemMessage }}</p>
    </div>
  </div>
  
  <div v-else class="system-card p-6 text-center">
    <div class="text-4xl mb-3">🌟</div>
    <h3 class="text-xl font-bold text-gray-300 mb-2">No Active Sponsor</h3>
    <p class="text-gray-400 mb-4">Complete significant achievements to attract a Constellation</p>
    <button class="system-btn opacity-50 cursor-not-allowed" disabled>
      Tasks Locked
    </button>
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

const emit = defineEmits(['task-completed'])

// State
const activeConstellation = ref(null)
const currentTask = ref(null)
const availableTasks = ref([])
const completedTasks = ref([])
const systemMessage = ref('')
const isCompleting = ref(false)
const totalEarnedFromSponsor = ref(0)

// Sample tasks data (would come from constellation data)
const taskDatabase = {
  naruto: [
    {
      id: 'naruto_comeback',
      name: 'Comeback Clear',
      description: 'Clear a dungeon after failing it twice before',
      rarity: 'Common',
      baseReward: 200,
      requirements: [
        { type: 'failed_dungeons', value: 2, met: false },
        { type: 'dungeon_clear', value: 1, met: false }
      ]
    },
    {
      id: 'naruto_giveback',
      name: 'Give-Back Run',
      description: 'Forfeit loot on a successful dungeon clear',
      rarity: 'Uncommon',
      baseReward: 150,
      requirements: [
        { type: 'dungeon_clear', value: 1, met: false },
        { type: 'forfeit_loot', value: true, met: false }
      ]
    }
  ],
  goku: [
    {
      id: 'goku_pr',
      name: 'PR During Pressure',
      description: 'Set a personal record during a dungeon run',
      rarity: 'Rare',
      baseReward: 400,
      requirements: [
        { type: 'personal_record', value: 1, met: false },
        { type: 'dungeon_completion', value: 1, met: false }
      ]
    }
  ]
  // Add other constellations...
}

// Computed
const constellationName = computed(() => {
  if (!activeConstellation.value) return 'Unknown'
  const names = {
    'naruto': 'Naruto Uzumaki',
    'goku': 'Son Goku',
    'levi': 'Levi Ackerman',
    'corrupted_goku': 'Black Goku'
  }
  return names[activeConstellation.value.id] || activeConstellation.value.name
})

const constellationColor = computed(() => {
  if (!activeConstellation.value) return '#9d4edd'
  const colors = {
    'naruto': '#FF6B00',
    'goku': '#FFD700',
    'levi': '#00B4FF',
    'corrupted_goku': '#800080'
  }
  return colors[activeConstellation.value.id] || '#9d4edd'
})

const currentTaskReward = computed(() => {
  if (!currentTask.value) return 0
  return calculateTaskReward(currentTask.value)
})

const clBonus = computed(() => {
  if (!activeConstellation.value) return 0
  return (activeConstellation.value.cl - 1) * 8
})

const canComplete = computed(() => {
  if (!currentTask.value || !currentTask.value.requirements) return true
  return currentTask.value.requirements.every(req => req.met)
})

// Methods
const calculateTaskReward = (task) => {
  if (!activeConstellation.value) return task.baseReward
  
  const cl = activeConstellation.value.cl
  const multiplier = 1 + (0.08 * (cl - 1))
  
  // Apply rarity multiplier
  const rarityMultipliers = {
    'Common': 1.0,
    'Uncommon': 1.25,
    'Rare': 1.5,
    'VeryRare': 1.75,
    'Legendary': 2.0
  }
  
  const rarityMultiplier = rarityMultipliers[task.rarity] || 1.0
  
  return Math.floor(task.baseReward * multiplier * rarityMultiplier)
}

const taskRarityClass = (rarity) => {
  const classes = {
    'Common': 'bg-gray-700 text-gray-300',
    'Uncommon': 'bg-green-900/50 text-green-300',
    'Rare': 'bg-blue-900/50 text-blue-300',
    'VeryRare': 'bg-purple-900/50 text-purple-300',
    'Legendary': 'bg-gradient-to-r from-yellow-900/50 to-orange-900/50 text-yellow-300'
  }
  return classes[rarity] || 'bg-gray-800 text-gray-300'
}

const selectTask = (task) => {
  currentTask.value = {
    ...task,
    progress: task.requirements ? { current: 0, required: task.requirements.length } : null
  }
  systemMessage.value = `[Task selected: ${task.name}]`
}

const attemptTask = async () => {
  if (!currentTask.value || !canComplete.value || isCompleting.value) return
  
  isCompleting.value = true
  
  // Simulate task completion
  setTimeout(() => {
    const reward = currentTaskReward.value
    
    // Record completion
    completedTasks.value.unshift({
      ...currentTask.value,
      reward: reward,
      completedAt: new Date()
    })
    
    // Update player SC
    emit('task-completed', { 
      task: currentTask.value,
      reward: { sc: reward }
    })
    
    // Update total earned
    totalEarnedFromSponsor.value += reward
    
    // Clear current task
    currentTask.value = null
    
    // Generate new available task
    generateAvailableTasks()
    
    systemMessage.value = `[Task completed! +${reward} Sponsorship Credits earned.]`
    isCompleting.value = false
  }, 1500)
}

const generateAvailableTasks = () => {
  if (!activeConstellation.value) return
  
  const constellationTasks = taskDatabase[activeConstellation.value.id] || []
  availableTasks.value = constellationTasks.map(task => ({
    ...task,
    id: `${task.id}_${Date.now()}` // Make unique
  })).slice(0, 3) // Limit to 3 available
}

const formatTime = (timestamp) => {
  const now = new Date()
  const time = new Date(timestamp)
  const diffHours = Math.floor((now - time) / 3600000)
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

// Initialize
onMounted(() => {
  // For demo, set Naruto as active constellation
  activeConstellation.value = {
    id: 'naruto',
    name: 'Naruto Uzumaki',
    cl: 3,
    rarity: 'Rare'
  }
  
  // Load completed tasks from localStorage
  const savedCompleted = localStorage.getItem('isekai_completed_tasks')
  if (savedCompleted) {
    try {
      completedTasks.value = JSON.parse(savedCompleted)
      totalEarnedFromSponsor.value = completedTasks.value.reduce((sum, task) => sum + task.reward, 0)
    } catch (e) {
      console.error('Failed to load completed tasks:', e)
    }
  }
  
  generateAvailableTasks()
  
  // If no current task, select first available
  if (!currentTask.value && availableTasks.value.length > 0) {
    selectTask(availableTasks.value[0])
  }
})

// Save completed tasks
setInterval(() => {
  localStorage.setItem('isekai_completed_tasks', JSON.stringify(completedTasks.value))
}, 30000)
</script>

<style scoped>
.task-item {
  transition: all 0.3s ease;
}

.task-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 5px 15px rgba(157, 78, 221, 0.2);
}
</style>
