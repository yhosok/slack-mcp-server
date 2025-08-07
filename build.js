#!/usr/bin/env node

/**
 * Simple build script for the Slack MCP Server
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function run(command) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

function main() {
  console.log('🔧 Building Slack MCP Server...');

  // Ensure dist directory exists
  const distDir = path.join(__dirname, 'dist');
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  // Clean previous build
  console.log('🧹 Cleaning previous build...');
  run('npm run clean');

  // Run TypeScript compiler
  console.log('📦 Compiling TypeScript...');
  run('npx tsc');

  // Run linting
  console.log('🔍 Running linter...');
  run('npm run lint');

  console.log('✅ Build completed successfully!');
  console.log('📁 Output directory: dist/');
  console.log('🚀 Run with: npm start');
}

main();