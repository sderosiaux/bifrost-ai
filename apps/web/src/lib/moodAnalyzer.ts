export type Mood = 'neutral' | 'happy' | 'serious' | 'creative' | 'analytical' | 'emotional';

interface MoodConfig {
  backgroundColor: string;
  primaryColor: string;
  accentColor: string;
  animation: string;
  borderGlow: string;
  soundEffect?: string;
}

export const moodConfigs: Record<Mood, MoodConfig> = {
  neutral: {
    backgroundColor: 'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800',
    primaryColor: 'bg-primary-600',
    accentColor: 'text-gray-600',
    animation: '',
    borderGlow: '',
  },
  happy: {
    backgroundColor: 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20',
    primaryColor: 'bg-yellow-500',
    accentColor: 'text-yellow-600',
    animation: 'animate-pulse',
    borderGlow: 'shadow-lg shadow-yellow-200/50',
    soundEffect: 'happy',
  },
  serious: {
    backgroundColor: 'bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-gray-900',
    primaryColor: 'bg-slate-700',
    accentColor: 'text-slate-700',
    animation: '',
    borderGlow: 'shadow-sm',
    soundEffect: 'serious',
  },
  creative: {
    backgroundColor: 'bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20',
    primaryColor: 'bg-gradient-to-r from-purple-600 to-pink-600',
    accentColor: 'text-purple-600',
    animation: 'animate-spin-slow',
    borderGlow: 'shadow-lg shadow-purple-200/50',
    soundEffect: 'creative',
  },
  analytical: {
    backgroundColor: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
    primaryColor: 'bg-blue-600',
    accentColor: 'text-blue-600',
    animation: '',
    borderGlow: 'shadow-md shadow-blue-200/30',
    soundEffect: 'analytical',
  },
  emotional: {
    backgroundColor: 'bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20',
    primaryColor: 'bg-rose-600',
    accentColor: 'text-rose-600',
    animation: 'animate-pulse-slow',
    borderGlow: 'shadow-lg shadow-rose-200/50',
    soundEffect: 'emotional',
  },
};

// Keywords for mood detection
const moodKeywords: Record<Mood, string[]> = {
  happy: ['happy', 'joy', 'excited', 'fun', 'great', 'awesome', 'wonderful', 'fantastic', '😊', '😄', '🎉', 'love', 'celebrate'],
  serious: ['important', 'critical', 'urgent', 'problem', 'issue', 'concern', 'serious', 'professional', 'business', 'formal'],
  creative: ['create', 'design', 'imagine', 'build', 'art', 'music', 'story', 'game', 'invent', 'innovative', 'unique'],
  analytical: ['analyze', 'calculate', 'data', 'logic', 'reason', 'explain', 'understand', 'technical', 'code', 'algorithm', 'optimize'],
  emotional: ['feel', 'sad', 'angry', 'worried', 'anxious', 'scared', 'lonely', 'miss', 'cry', 'hurt', 'pain', 'sorry'],
  neutral: [],
};

export function analyzeMood(text: string): Mood {
  const lowerText = text.toLowerCase();
  
  // Count keyword matches for each mood
  const moodScores: Record<Mood, number> = {
    neutral: 0,
    happy: 0,
    serious: 0,
    creative: 0,
    analytical: 0,
    emotional: 0,
  };
  
  for (const [mood, keywords] of Object.entries(moodKeywords) as [Mood, string[]][]) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        moodScores[mood] += 1;
      }
    }
  }
  
  // Find the mood with highest score
  let maxScore = 0;
  let detectedMood: Mood = 'neutral';
  
  for (const [mood, score] of Object.entries(moodScores) as [Mood, number][]) {
    if (score > maxScore) {
      maxScore = score;
      detectedMood = mood;
    }
  }
  
  return detectedMood;
}

export function getConversationMood(messages: Array<{ content: string; role: string }>): Mood {
  // Analyze the last few messages to determine overall mood
  const recentMessages = messages.slice(-5);
  const moods = recentMessages
    .filter(m => m.role !== 'system')
    .map(m => analyzeMood(m.content));
  
  // Return the most common mood
  const moodCounts = moods.reduce((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {} as Record<Mood, number>);
  
  let maxCount = 0;
  let dominantMood: Mood = 'neutral';
  
  for (const [mood, count] of Object.entries(moodCounts) as [Mood, number][]) {
    if (count > maxCount) {
      maxCount = count;
      dominantMood = mood;
    }
  }
  
  return dominantMood;
}