#!/usr/bin/env node

/**
 * Performance comparison test between legacy and modular implementations
 */

import { SlackService } from './dist/slack/slack-service.js';
import { performance } from 'perf_hooks';

// Mock environment for testing
process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
process.env.SLACK_USER_TOKEN = 'xoxp-test-token';
process.env.LOG_LEVEL = 'error'; // Reduce logging noise

const NUM_ITERATIONS = 100;

// Helper to measure execution time
async function measurePerformance(name, fn, iterations = NUM_ITERATIONS) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      await fn();
    } catch (error) {
      // Ignore errors for performance testing
    }
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return {
    name,
    avg: avg.toFixed(2),
    min: min.toFixed(2),
    max: max.toFixed(2),
    iterations
  };
}

// Test scenarios
async function testScenarios() {
  console.log('🚀 Performance Comparison: Legacy vs Modular Architecture\n');
  console.log('=' .repeat(60));
  
  // Test with legacy implementation
  process.env.USE_MODULAR_ARCHITECTURE = 'false';
  const legacyService = new SlackService();
  
  console.log('\n📊 LEGACY IMPLEMENTATION\n');
  
  // Test 1: Simple method (getUserInfo)
  const legacyUserInfo = await measurePerformance(
    'getUserInfo',
    () => legacyService.getUserInfo({ user_id: 'U123456' })
  );
  console.log(`getUserInfo: avg=${legacyUserInfo.avg}ms, min=${legacyUserInfo.min}ms, max=${legacyUserInfo.max}ms`);
  
  // Test 2: Complex method (analyzeThread)
  const legacyAnalyze = await measurePerformance(
    'analyzeThread',
    () => legacyService.analyzeThread({ 
      channel: 'C123456', 
      thread_ts: '1234567890.123456' 
    }),
    20 // Fewer iterations for complex operations
  );
  console.log(`analyzeThread: avg=${legacyAnalyze.avg}ms, min=${legacyAnalyze.min}ms, max=${legacyAnalyze.max}ms`);
  
  // Test 3: List operation (listChannels)
  const legacyList = await measurePerformance(
    'listChannels',
    () => legacyService.listChannels({ exclude_archived: true })
  );
  console.log(`listChannels: avg=${legacyList.avg}ms, min=${legacyList.min}ms, max=${legacyList.max}ms`);
  
  // Test with modular implementation
  process.env.USE_MODULAR_ARCHITECTURE = 'true';
  process.env.ENABLE_MODULAR_MESSAGES = 'true';
  process.env.ENABLE_MODULAR_THREADS = 'true';
  const modularService = new SlackService();
  
  console.log('\n📊 MODULAR IMPLEMENTATION\n');
  
  // Test 1: Simple method (getUserInfo)
  const modularUserInfo = await measurePerformance(
    'getUserInfo',
    () => modularService.getUserInfo({ user_id: 'U123456' })
  );
  console.log(`getUserInfo: avg=${modularUserInfo.avg}ms, min=${modularUserInfo.min}ms, max=${modularUserInfo.max}ms`);
  
  // Test 2: Complex method (analyzeThread)
  const modularAnalyze = await measurePerformance(
    'analyzeThread',
    () => modularService.analyzeThread({ 
      channel: 'C123456', 
      thread_ts: '1234567890.123456' 
    }),
    20
  );
  console.log(`analyzeThread: avg=${modularAnalyze.avg}ms, min=${modularAnalyze.min}ms, max=${modularAnalyze.max}ms`);
  
  // Test 3: List operation (listChannels)  
  const modularList = await measurePerformance(
    'listChannels',
    () => modularService.listChannels({ exclude_archived: true })
  );
  console.log(`listChannels: avg=${modularList.avg}ms, min=${modularList.min}ms, max=${modularList.max}ms`);
  
  // Performance comparison
  console.log('\n📈 PERFORMANCE COMPARISON\n');
  console.log('Method          | Legacy (avg) | Modular (avg) | Difference');
  console.log('-'.repeat(60));
  
  const userInfoDiff = ((parseFloat(modularUserInfo.avg) - parseFloat(legacyUserInfo.avg)) / parseFloat(legacyUserInfo.avg) * 100).toFixed(1);
  console.log(`getUserInfo     | ${legacyUserInfo.avg}ms      | ${modularUserInfo.avg}ms       | ${userInfoDiff}%`);
  
  const analyzeDiff = ((parseFloat(modularAnalyze.avg) - parseFloat(legacyAnalyze.avg)) / parseFloat(legacyAnalyze.avg) * 100).toFixed(1);
  console.log(`analyzeThread   | ${legacyAnalyze.avg}ms      | ${modularAnalyze.avg}ms       | ${analyzeDiff}%`);
  
  const listDiff = ((parseFloat(modularList.avg) - parseFloat(legacyList.avg)) / parseFloat(legacyList.avg) * 100).toFixed(1);
  console.log(`listChannels    | ${legacyList.avg}ms      | ${modularList.avg}ms       | ${listDiff}%`);
  
  console.log('\n✅ Performance test complete!');
  
  // Memory usage comparison
  console.log('\n💾 MEMORY USAGE\n');
  const memUsage = process.memoryUsage();
  console.log(`RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
}

// Run tests
testScenarios().catch(console.error);