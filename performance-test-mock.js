#!/usr/bin/env node

/**
 * Performance comparison test with mocked API (no actual calls)
 */

import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Mock environment with rate limit disabled
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.LOG_LEVEL = 'error';
process.env.SLACK_ENABLE_RATE_LIMIT_RETRY = 'false';
process.env.SLACK_REJECT_RATE_LIMITED_CALLS = 'true';

// Create mock WebClient before importing
const mockWebClientInstance = {
  chat: {
    postMessage: jest.fn(() => Promise.resolve({ ok: true, ts: '1234567890.123456' })),
  },
  conversations: {
    list: jest.fn(() => Promise.resolve({
      ok: true,
      channels: [
        { id: 'C123', name: 'general', is_member: true, is_archived: false },
      ],
    })),
  },
  users: {
    info: jest.fn(() => Promise.resolve({
      ok: true,
      user: { id: 'U123', name: 'testuser', real_name: 'Test User' },
    })),
  },
  team: {
    info: jest.fn(() => Promise.resolve({
      ok: true,
      team: { id: 'T123', name: 'Test Team', domain: 'test-team' },
    })),
  },
  on: jest.fn(),
};

// Mock the WebClient module
jest.unstable_mockModule('@slack/web-api', () => ({
  WebClient: jest.fn(() => mockWebClientInstance),
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
  },
  WebClientEvent: {
    RATE_LIMITED: 'rate_limited',
  },
}));

// Now import after mocking
const { SlackService } = await import('./dist/slack/slack-service.js');

console.log('🚀 Performance Test: Legacy vs Modular Architecture (Mocked)\n');
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
const testArgs = { user: 'U123456' };

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

// Test different method types
console.log('\n📊 METHOD TYPE COMPARISON\n');

const testMethods = [
  { name: 'listChannels', args: { exclude_archived: true } },
  { name: 'getWorkspaceInfo', args: {} },
  { name: 'sendMessage', args: { channel: 'C123', text: 'Test' } },
];

for (const method of testMethods) {
  // Legacy
  const legacyMethodStart = performance.now();
  for (let i = 0; i < 10; i++) {
    try {
      await legacyService[method.name](method.args);
    } catch (e) {
      // Ignore
    }
  }
  const legacyMethodEnd = performance.now();
  const legacyMethodAvg = ((legacyMethodEnd - legacyMethodStart) / 10).toFixed(3);
  
  // Modular
  const modularMethodStart = performance.now();
  for (let i = 0; i < 10; i++) {
    try {
      await modularService[method.name](method.args);
    } catch (e) {
      // Ignore
    }
  }
  const modularMethodEnd = performance.now();
  const modularMethodAvg = ((modularMethodEnd - modularMethodStart) / 10).toFixed(3);
  
  const methodDiff = (parseFloat(modularMethodAvg) - parseFloat(legacyMethodAvg)).toFixed(3);
  console.log(`${method.name}:`);
  console.log(`  Legacy: ${legacyMethodAvg}ms | Modular: ${modularMethodAvg}ms | Diff: ${methodDiff}ms`);
}

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

// Performance criteria from LEGACY-CLEANUP-PLAN.md
const performanceWithin5Percent = Math.abs(routingDiff) / parseFloat(legacyAvg) < 0.05;
console.log(`\n${performanceWithin5Percent ? '✅' : '❌'} Performance within 5% of legacy (${((Math.abs(routingDiff) / parseFloat(legacyAvg)) * 100).toFixed(1)}%)`);

process.exit(0);