#!/usr/bin/env node

/**
 * Simple performance comparison test focusing on code execution speed
 * (without actual API calls)
 */

import { SlackService } from './dist/slack/slack-service.js';
import { performance } from 'perf_hooks';

// Mock environment
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.LOG_LEVEL = 'error';

console.log('🚀 Performance Test: Legacy vs Modular Architecture\n');
console.log('=' .repeat(60));

// Test service initialization time
console.log('\n📊 SERVICE INITIALIZATION\n');

// Legacy
process.env.USE_MODULAR_ARCHITECTURE = 'false';
const legacyStart = performance.now();
const legacyService = new SlackService();
const legacyEnd = performance.now();
console.log(`Legacy:   ${(legacyEnd - legacyStart).toFixed(2)}ms`);

// Modular
process.env.USE_MODULAR_ARCHITECTURE = 'true';
process.env.ENABLE_MODULAR_MESSAGES = 'true';
process.env.ENABLE_MODULAR_THREADS = 'true';
process.env.ENABLE_MODULAR_FILES = 'true';
process.env.ENABLE_MODULAR_REACTIONS = 'true';
process.env.ENABLE_MODULAR_WORKSPACE = 'true';
const modularStart = performance.now();
const modularService = new SlackService();
const modularEnd = performance.now();
console.log(`Modular:  ${(modularEnd - modularStart).toFixed(2)}ms`);

const initDiff = ((modularEnd - modularStart) - (legacyEnd - legacyStart)).toFixed(2);
console.log(`Difference: ${initDiff}ms (${initDiff > 0 ? 'slower' : 'faster'})`);

// Test method routing overhead (100 iterations)
console.log('\n📊 METHOD ROUTING OVERHEAD (100 calls)\n');

const iterations = 100;
const testArgs = { user_id: 'U123456' };

// Legacy routing
const legacyRoutingStart = performance.now();
for (let i = 0; i < iterations; i++) {
  try {
    await legacyService.getUserInfo(testArgs);
  } catch (e) {
    // Ignore errors
  }
}
const legacyRoutingEnd = performance.now();
const legacyAvg = ((legacyRoutingEnd - legacyRoutingStart) / iterations).toFixed(3);
console.log(`Legacy routing:   ${legacyAvg}ms per call`);

// Modular routing
const modularRoutingStart = performance.now();
for (let i = 0; i < iterations; i++) {
  try {
    await modularService.getUserInfo(testArgs);
  } catch (e) {
    // Ignore errors
  }
}
const modularRoutingEnd = performance.now();
const modularAvg = ((modularRoutingEnd - modularRoutingStart) / iterations).toFixed(3);
console.log(`Modular routing:  ${modularAvg}ms per call`);

const routingDiff = (parseFloat(modularAvg) - parseFloat(legacyAvg)).toFixed(3);
console.log(`Overhead: ${routingDiff}ms per call`);

// Memory usage
console.log('\n💾 MEMORY USAGE\n');
const memUsage = process.memoryUsage();
console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);

console.log('\n✅ Performance test complete!');
console.log('\n📈 SUMMARY');
console.log('-'.repeat(60));
console.log(`Service Initialization: Modular is ${Math.abs(initDiff)}ms ${initDiff > 0 ? 'slower' : 'faster'}`);
console.log(`Method Routing: Modular adds ${Math.abs(routingDiff)}ms overhead per call`);
console.log(`\nConclusion: ${Math.abs(routingDiff) < 1 ? '✅ Negligible performance impact' : '⚠️ Some performance overhead detected'}`);