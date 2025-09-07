import { llamaBinding } from './llamaBinding.js';
import { HarmonyMessage } from './harmony.js';

export async function warmupModel(modelPath: string): Promise<void> {
  console.log('Starting model warmup...');
  
  await llamaBinding.ensureReady(modelPath);
  
  const testMessages: HarmonyMessage[] = [
    { role: 'user', content: 'Hi' }
  ];
  
  let tokenCount = 0;
  const generator = llamaBinding.generate({
    messages: testMessages,
    params: { maxTokens: 2 }
  });
  
  for await (const { token } of generator) {
    tokenCount++;
    if (tokenCount >= 2) break;
  }
  
  console.log('Model warmup complete');
}