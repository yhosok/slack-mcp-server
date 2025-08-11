#!/usr/bin/env node

/**
 * Isolated performance test that doesn't make actual API calls
 */

import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up mock environment
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_USER_TOKEN = 'xoxp-test-token';
process.env.LOG_LEVEL = 'error';
process.env.SLACK_ENABLE_RATE_LIMIT_RETRY = 'false';
process.env.SLACK_REJECT_RATE_LIMITED_CALLS = 'true';
process.env.ENABLE_PERFORMANCE_METRICS = 'true';
process.env.MONITOR_LEGACY_COMPARISON = 'true';

console.log('🚀 Performance Test: Legacy vs Modular Architecture\n');
console.log('=' .repeat(60));

// Test configuration changes
console.log('\n📊 CONFIGURATION SWITCHING OVERHEAD\n');

const testConfigs = [
  { USE_MODULAR_ARCHITECTURE: 'false', name: 'Legacy' },
  { USE_MODULAR_ARCHITECTURE: 'true', ENABLE_MODULAR_MESSAGES: 'true', ENABLE_MODULAR_WORKSPACE: 'true', name: 'Modular (partial)' },
  { USE_MODULAR_ARCHITECTURE: 'true', ENABLE_MODULAR_MESSAGES: 'true', ENABLE_MODULAR_THREADS: 'true', ENABLE_MODULAR_FILES: 'true', ENABLE_MODULAR_REACTIONS: 'true', ENABLE_MODULAR_WORKSPACE: 'true', name: 'Modular (full)' },
];

const results = [];

for (const config of testConfigs) {
  // Apply config
  Object.entries(config).forEach(([key, value]) => {
    if (key !== 'name') {
      process.env[key] = value;
    }
  });
  
  const start = performance.now();
  
  // Import fresh module
  delete require.cache[require.resolve('./dist/slack/slack-service.js')];
  const { SlackService } = await import(`./dist/slack/slack-service.js?t=${Date.now()}`);
  
  // Create service instance
  const service = new SlackService();
  
  const end = performance.now();
  const time = (end - start).toFixed(2);
  
  results.push({ name: config.name, time: parseFloat(time) });
  console.log(`${config.name}: ${time}ms`);
}

// Calculate relative performance
console.log('\n📊 RELATIVE PERFORMANCE\n');
const legacyTime = results.find(r => r.name === 'Legacy').time;
results.forEach(result => {
  if (result.name !== 'Legacy') {
    const diff = result.time - legacyTime;
    const percent = ((diff / legacyTime) * 100).toFixed(1);
    console.log(`${result.name}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}ms (${diff > 0 ? '+' : ''}${percent}%)`);
  }
});

// Memory usage
console.log('\n💾 MEMORY USAGE\n');
const memUsage = process.memoryUsage();
console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);

// Analysis based on LEGACY-CLEANUP-PLAN.md criteria
console.log('\n✅ PERFORMANCE ANALYSIS\n');
console.log('-'.repeat(60));

const maxOverhead = Math.max(...results.filter(r => r.name !== 'Legacy').map(r => r.time - legacyTime));
const maxOverheadPercent = (maxOverhead / legacyTime * 100).toFixed(1);

console.log(`Maximum overhead: ${maxOverhead.toFixed(2)}ms (${maxOverheadPercent}%)`);
console.log(`Target: Within 5% of legacy performance`);
console.log(`Status: ${parseFloat(maxOverheadPercent) <= 5 ? '✅ PASS' : '❌ FAIL'}`);

if (parseFloat(maxOverheadPercent) <= 5) {
  console.log('\n🎉 Modular architecture meets performance requirements!');
  console.log('Ready for production rollout according to LEGACY-CLEANUP-PLAN.md');
} else {
  console.log('\n⚠️ Performance overhead exceeds 5% threshold');
  console.log('Consider optimization before production rollout');
}

process.exit(0);