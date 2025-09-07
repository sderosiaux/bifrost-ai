export class SoundManager {
  private audioContext: AudioContext | null = null;
  private activeTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  
  constructor() {
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
    }
  }
  
  playMoodSound(mood: string) {
    if (!this.audioContext) return;
    
    // Clear any pending sounds
    this.clearActiveTimeouts();
    
    // Configure sound based on mood
    switch (mood) {
      case 'happy':
        // Bright, cheerful ascending tones
        this.playSequence([523, 587, 659, 784], 100, 0.3); // C, D, E, G
        break;
      case 'serious':
        // Low, steady tone
        this.playTone(130, 200, 0.2); // Low C
        break;
      case 'creative':
        // Dreamy arpeggio
        this.playSequence([440, 554, 659, 554], 150, 0.2); // A, C#, E, C#
        break;
      case 'analytical':
        // Clean, precise beeps
        this.playSequence([880, 880], 50, 0.3); // High A
        break;
      case 'emotional':
        // Soft, warm tone
        this.playTone(330, 300, 0.15); // E
        break;
    }
  }
  
  private clearActiveTimeouts() {
    this.activeTimeouts.forEach(timeout => clearTimeout(timeout));
    this.activeTimeouts.clear();
  }
  
  private playTone(frequency: number, duration: number, volume: number) {
    if (!this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);
  }
  
  private playSequence(frequencies: number[], noteDuration: number, volume: number) {
    if (!this.audioContext) return;
    
    frequencies.forEach((freq, index) => {
      const timeout = setTimeout(() => {
        this.playTone(freq, noteDuration, volume);
        this.activeTimeouts.delete(timeout);
      }, index * noteDuration);
      this.activeTimeouts.add(timeout);
    });
  }
  
  playTypingSound() {
    if (!this.audioContext) return;
    
    // Subtle click sound for typing
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = 1000;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.01);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.01);
  }
}

export const soundManager = new SoundManager();