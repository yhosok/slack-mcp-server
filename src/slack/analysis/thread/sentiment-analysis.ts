/**
 * Pure sentiment analysis functions for thread messages
 * No side effects, fully testable and functional
 */

import type { SlackMessage } from '../../types.js';
import type { 
  SentimentScore, 
  SentimentAnalysisResult, 
  SentimentConfig 
} from './types.js';

/**
 * Default sentiment analysis configuration
 */
export const DEFAULT_SENTIMENT_CONFIG: SentimentConfig = {
  positiveWords: [
    'good', 'great', 'excellent', 'awesome', 'perfect', 
    'love', 'like', 'happy', 'yes', 'agree', 'amazing',
    'fantastic', 'wonderful', 'brilliant', 'outstanding',
    'success', 'achieved', 'completed', 'solved', 'resolved'
  ] as const,
  negativeWords: [
    'bad', 'terrible', 'awful', 'hate', 'dislike', 
    'angry', 'no', 'disagree', 'problem', 'issue',
    'error', 'bug', 'broken', 'failed', 'wrong',
    'difficult', 'hard', 'stuck', 'blocked', 'frustrated'
  ] as const,
  threshold: 1.2 // Ratio threshold for determining sentiment
} as const;

/**
 * Extract and combine text from messages for analysis
 * @param messages - Array of Slack messages
 * @returns Combined text string in lowercase
 */
export function extractTextFromMessages(messages: readonly SlackMessage[]): string {
  return messages
    .map((message) => message.text || '')
    .join(' ')
    .toLowerCase()
    .trim();
}

/**
 * Count occurrences of words in text
 * @param text - Text to analyze
 * @param words - Array of words to count
 * @returns Total count of all word occurrences
 */
export function countWordOccurrences(text: string, words: readonly string[]): number {
  let count = 0;
  
  for (const word of words) {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'g');
    const matches = text.match(regex);
    if (matches) {
      count += matches.length;
    }
  }
  
  return count;
}

/**
 * Analyze sentiment of messages using keyword-based approach
 * @param messages - Array of messages to analyze
 * @param config - Configuration for sentiment analysis
 * @returns Detailed sentiment analysis result
 */
export function analyzeSentiment(
  messages: readonly SlackMessage[], 
  config: SentimentConfig = DEFAULT_SENTIMENT_CONFIG
): SentimentAnalysisResult {
  const text = extractTextFromMessages(messages);
  
  if (!text) {
    return {
      sentiment: 'neutral',
      positiveCount: 0,
      negativeCount: 0,
      totalWords: 0
    };
  }
  
  const positiveCount = countWordOccurrences(text, config.positiveWords);
  const negativeCount = countWordOccurrences(text, config.negativeWords);
  const totalWords = text.split(/\s+/).length;
  
  let sentiment: SentimentScore = 'neutral';
  
  // Apply threshold-based sentiment determination
  if (positiveCount > negativeCount * config.threshold) {
    sentiment = 'positive';
  } else if (negativeCount > positiveCount * config.threshold) {
    sentiment = 'negative';
  }
  
  return {
    sentiment,
    positiveCount,
    negativeCount,
    totalWords
  };
}

/**
 * Get sentiment score as a number between -1 and 1
 * @param result - Sentiment analysis result
 * @returns Numeric sentiment score (-1 = negative, 0 = neutral, 1 = positive)
 */
export function getSentimentScore(result: SentimentAnalysisResult): number {
  const { positiveCount, negativeCount, totalWords } = result;
  
  if (totalWords === 0) return 0;
  
  // Normalize by total words to get relative sentiment strength
  const positiveRatio = positiveCount / totalWords;
  const negativeRatio = negativeCount / totalWords;
  
  // Calculate net sentiment
  const netSentiment = positiveRatio - negativeRatio;
  
  // Clamp to [-1, 1] range
  return Math.max(-1, Math.min(1, netSentiment * 10));
}

/**
 * Check if sentiment analysis has sufficient data for reliable results
 * @param result - Sentiment analysis result
 * @returns True if analysis is based on sufficient data
 */
export function isSentimentReliable(result: SentimentAnalysisResult): boolean {
  const { positiveCount, negativeCount, totalWords } = result;
  const totalSentimentWords = positiveCount + negativeCount;
  
  // Consider reliable if we have sentiment words and sufficient total text
  return totalSentimentWords >= 2 && totalWords >= 10;
}

/**
 * Get detailed sentiment explanation
 * @param result - Sentiment analysis result
 * @returns Human-readable explanation of the sentiment analysis
 */
export function explainSentiment(result: SentimentAnalysisResult): string {
  const { sentiment, positiveCount, negativeCount, totalWords } = result;
  const totalSentimentWords = positiveCount + negativeCount;
  
  if (totalWords === 0) {
    return 'No text available for sentiment analysis.';
  }
  
  if (totalSentimentWords === 0) {
    return `Neutral sentiment - no clear positive or negative indicators found in ${totalWords} words.`;
  }
  
  const reliability = isSentimentReliable(result) ? 'reliable' : 'limited';
  const ratio = negativeCount > 0 ? (positiveCount / negativeCount).toFixed(1) : 'infinite';
  
  return `${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} sentiment (${reliability} analysis) - ` +
    `${positiveCount} positive vs ${negativeCount} negative indicators ` +
    `(ratio: ${ratio}) in ${totalWords} total words.`;
}