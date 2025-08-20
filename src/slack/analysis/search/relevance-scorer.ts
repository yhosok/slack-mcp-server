/**
 * RelevanceScorer - Advanced search relevance scoring with MiniSearch integration
 * 
 * This class implements sophisticated relevance scoring for Slack messages using:
 * - TF-IDF scoring via MiniSearch for content relevance
 * - Time decay scoring for message recency
 * - Engagement scoring based on reactions, replies, and mentions
 * - Composite scoring with configurable weights
 * - Performance optimization with caching and concurrent processing
 */

import MiniSearch from 'minisearch';
import type { SlackMessage } from '../../types/index.js';
import type {
  RelevanceScore,
  RelevanceScorerConfig,
  TFIDFResult,
  RelevanceResult,
} from '../../types/index.js';
import type { ServiceResult } from '../../types/typesafe-api-patterns.js';

/**
 * Default configuration for relevance scoring
 */
const DEFAULT_CONFIG: RelevanceScorerConfig = {
  weights: {
    tfidf: 0.4,
    timeDecay: 0.25,
    engagement: 0.2,
    urgency: 0.1,
    importance: 0.05,
  },
  timeDecayHalfLife: 24, // hours
  miniSearchConfig: {
    fields: ['text', 'user'],
    storeFields: ['id', 'timestamp', 'threadTs'],
    searchOptions: {
      boost: { text: 2, user: 1.5 },
      fuzzy: 0.2,
    },
  },
  engagementMetrics: {
    reactionWeight: 0.3,
    replyWeight: 0.5,
    mentionWeight: 0.2,
  },
  cacheTTL: 900000, // 15 minutes
};

/**
 * Cache interface for TF-IDF results
 */
interface TFIDFCache {
  result: TFIDFResult;
  timestamp: number;
}

/**
 * Document interface for MiniSearch
 */
interface SearchDocument {
  id: string;
  text: string;
  user: string;
  timestamp: string;
  threadTs?: string;
}

/**
 * RelevanceScorer class for advanced search relevance calculation
 */
export class RelevanceScorer {
  private config: RelevanceScorerConfig;
  private miniSearch: MiniSearch<SearchDocument>;
  private tfidfCache = new Map<string, TFIDFCache>();

  constructor(config: Partial<RelevanceScorerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (!this.config.miniSearchConfig) {
      throw new Error('MiniSearch configuration is required');
    }

    // Initialize MiniSearch with configuration
    this.miniSearch = new MiniSearch({
      fields: this.config.miniSearchConfig.fields,
      storeFields: this.config.miniSearchConfig.storeFields,
      searchOptions: this.config.miniSearchConfig.searchOptions,
    });
  }

  /**
   * Calculate TF-IDF scores using MiniSearch
   */
  async calculateTFIDFScore(messages: SlackMessage[], searchQuery: string): Promise<TFIDFResult> {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = `${JSON.stringify(messages.map(m => m.ts))}-${searchQuery}`;
    const cached = this.tfidfCache.get(cacheKey);
    
    if (cached && this.config.cacheTTL) {
      const age = Date.now() - cached.timestamp;
      if (age < this.config.cacheTTL) {
        return { ...cached.result, cacheHit: true };
      }
    }

    // Handle empty query
    if (!searchQuery.trim()) {
      const emptyResult: TFIDFResult = {
        scores: new Array(messages.length).fill(0),
        fieldBoosts: this.config.miniSearchConfig.searchOptions.boost,
        cacheHit: false,
        queryProcessingTime: performance.now() - startTime,
      };
      return emptyResult;
    }

    try {
      // Prepare documents for MiniSearch
      const documents: SearchDocument[] = messages.map((message, index) => ({
        id: index.toString(),
        text: this.cleanText(message.text || ''),
        user: message.user || '',
        timestamp: message.ts,
        threadTs: message.thread_ts,
      }));

      // Clear and rebuild search index
      this.miniSearch.removeAll();
      this.miniSearch.addAll(documents);

      // Perform search with fuzzy matching
      const searchResults = this.miniSearch.search(searchQuery, {
        ...this.config.miniSearchConfig.searchOptions,
        combineWith: 'AND',
      });

      // Create score array
      const scores = new Array(messages.length).fill(0);
      
      // Map search results to scores
      searchResults.forEach((result) => {
        const index = parseInt(result.id, 10);
        if (index >= 0 && index < scores.length) {
          // MiniSearch returns scores where higher = more relevant
          scores[index] = result.score || 0;
        }
      });

      // Normalize scores to 0-1 range
      const maxScore = Math.max(...scores);
      if (maxScore > 0) {
        for (let i = 0; i < scores.length; i++) {
          scores[i] = scores[i] / maxScore;
        }
      }

      const result: TFIDFResult = {
        scores,
        fieldBoosts: this.config.miniSearchConfig.searchOptions.boost,
        cacheHit: false,
        queryProcessingTime: performance.now() - startTime,
      };

      // Cache the result
      if (this.config.cacheTTL) {
        this.tfidfCache.set(cacheKey, {
          result: { ...result },
          timestamp: Date.now(),
        });
      }

      return result;
    } catch {
      // Return zero scores on error
      const errorResult: TFIDFResult = {
        scores: new Array(messages.length).fill(0),
        fieldBoosts: this.config.miniSearchConfig.searchOptions.boost,
        cacheHit: false,
        queryProcessingTime: performance.now() - startTime,
      };
      return errorResult;
    }
  }

  /**
   * Calculate time decay score for a message timestamp
   */
  calculateTimeDecay(timestamp: string): number {
    try {
      const timestampFloat = parseFloat(timestamp);
      if (isNaN(timestampFloat)) {
        return 0; // Invalid timestamp
      }
      
      const messageTime = timestampFloat * 1000; // Convert to milliseconds
      const now = Date.now();
      const hoursSinceMessage = (now - messageTime) / (1000 * 60 * 60);
      
      // For very recent messages (negative time difference), clamp to near 1
      if (hoursSinceMessage < 0) {
        return 1;
      }
      
      // Exponential decay: exp(-λ * t) where λ = ln(2) / half-life
      const lambda = Math.log(2) / this.config.timeDecayHalfLife;
      const decay = Math.exp(-lambda * hoursSinceMessage);
      
      return Math.max(0, Math.min(1, decay));
    } catch {
      return 0; // Invalid timestamp
    }
  }

  /**
   * Calculate engagement score based on reactions, replies, and mentions
   */
  calculateEngagementScore(message: SlackMessage): number {
    let score = 0;

    // Reaction score
    if (message.reactions && message.reactions.length > 0) {
      const totalReactions = message.reactions.reduce((sum, reaction) => sum + (reaction.count || 0), 0);
      score += totalReactions * this.config.engagementMetrics.reactionWeight;
    }

    // Reply score
    if (message.reply_count && message.reply_count > 0) {
      score += message.reply_count * this.config.engagementMetrics.replyWeight;
    }

    // Mention score
    if (message.text) {
      const mentions = (message.text.match(/<@[A-Z0-9]+>/g) || []).length;
      score += mentions * this.config.engagementMetrics.mentionWeight;
    }

    // Normalize to reasonable range (0-1)
    return Math.min(1, score / 10);
  }

  /**
   * Calculate composite relevance scores for messages
   */
  async calculateRelevance(messages: SlackMessage[], searchQuery: string): Promise<RelevanceResult> {
    const startTime = performance.now();

    try {
      // Handle malformed input - filter out null/undefined/invalid messages
      const validMessages = messages.filter(m => m && typeof m === 'object' && m.ts);
      
      if (validMessages.length === 0) {
        return {
          scores: new Array(messages.length).fill({
            tfidfScore: 0,
            timeDecayScore: 0,
            engagementScore: 0,
            compositeScore: 0,
            confidence: 0,
          }),
          processingTime: performance.now() - startTime,
          totalMessages: messages.length,
        };
      }

      // Calculate TF-IDF scores
      const tfidfResult = await this.calculateTFIDFScore(validMessages, searchQuery);

      // Calculate individual scores
      const scores: RelevanceScore[] = validMessages.map((message, index) => {
        const tfidfScore = tfidfResult.scores[index] || 0;
        const timeDecayScore = this.calculateTimeDecay(message.ts);
        const engagementScore = this.calculateEngagementScore(message);

        // Calculate composite score using weighted average
        const compositeScore = (
          tfidfScore * this.config.weights.tfidf +
          timeDecayScore * this.config.weights.timeDecay +
          engagementScore * this.config.weights.engagement
        );

        // Calculate confidence based on available data
        let confidence = 0.5; // Base confidence
        if (tfidfScore > 0) confidence += 0.3;
        if (engagementScore > 0) confidence += 0.2;
        confidence = Math.min(1, confidence);

        return {
          tfidfScore,
          timeDecayScore,
          engagementScore,
          compositeScore,
          confidence,
        };
      });

      // Handle original array size if there were invalid messages
      const allScores: RelevanceScore[] = [];
      let validIndex = 0;
      
      for (let i = 0; i < messages.length; i++) {
        if (messages[i] && typeof messages[i] === 'object' && messages[i]?.ts) {
          allScores.push(scores[validIndex++] || {
            tfidfScore: 0,
            timeDecayScore: 0,
            engagementScore: 0,
            compositeScore: 0,
            confidence: 0,
          });
        } else {
          // Zero score for invalid messages
          allScores.push({
            tfidfScore: 0,
            timeDecayScore: 0,
            engagementScore: 0,
            compositeScore: 0,
            confidence: 0,
          });
        }
      }

      return {
        scores: allScores,
        processingTime: performance.now() - startTime,
        cacheHit: tfidfResult.cacheHit,
        totalMessages: messages.length,
      };
    } catch {
      // Return zero scores for all messages on error
      const errorScores: RelevanceScore[] = messages.map(() => ({
        tfidfScore: 0,
        timeDecayScore: 0,
        engagementScore: 0,
        compositeScore: 0,
        confidence: 0,
      }));

      return {
        scores: errorScores,
        processingTime: performance.now() - startTime,
        totalMessages: messages.length,
      };
    }
  }

  /**
   * Re-rank search results based on relevance scores
   */
  async reRankResults<T extends Record<string, unknown>>(
    results: T[],
    query: string
  ): Promise<T[]> {
    if (!results.length) return results;

    try {
      // Convert results to messages for scoring
      const messages: SlackMessage[] = results.map((result, _index) => ({
        type: 'message',
        ts: (result.timestamp as string) || Date.now().toString(),
        text: (result.text as string) || '',
        user: (result.user as string) || '',
      }));

      // Calculate relevance scores
      const relevanceResult = await this.calculateRelevance(messages, query);

      // Create pairs of results with their scores
      const resultPairs = results.map((result, index) => ({
        result,
        score: relevanceResult.scores[index]?.compositeScore || 0,
      }));

      // Sort by composite score (descending)
      resultPairs.sort((a, b) => b.score - a.score);

      // Return sorted results
      return resultPairs.map(pair => pair.result);
    } catch {
      // Return original order on error
      return results;
    }
  }

  /**
   * TypeSafeAPI service wrapper for relevance calculation
   */
  async calculateRelevanceService(args: unknown): Promise<ServiceResult<{ scores: RelevanceScore[] }> & { statusCode: number }> {
    try {
      // Basic validation
      if (!args || typeof args !== 'object') {
        return {
          success: false,
          error: 'Invalid arguments: object expected',
          message: 'Invalid request parameters',
          statusCode: 400,
        };
      }

      const { messages, query } = args as { messages: unknown; query: unknown };

      if (!Array.isArray(messages)) {
        return {
          success: false,
          error: 'Invalid messages: array expected',
          message: 'Invalid request parameters',
          statusCode: 400,
        };
      }

      if (typeof query !== 'string') {
        return {
          success: false,
          error: 'Invalid query: string expected',
          message: 'Invalid request parameters',
          statusCode: 400,
        };
      }

      // Calculate relevance
      const result = await this.calculateRelevance(messages as SlackMessage[], query);

      return {
        success: true,
        data: { scores: result.scores },
        message: 'Relevance scores calculated successfully',
        statusCode: 200,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to calculate relevance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        message: 'Relevance calculation failed',
        statusCode: 500,
      };
    }
  }

  /**
   * Clean text for better search indexing
   */
  private cleanText(text: string): string {
    if (!text) return '';
    
    return text
      // Remove Slack-specific formatting
      .replace(/<@[A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#[A-Z0-9]+>/g, '') // Remove channel mentions
      .replace(/<[^>]+>/g, '') // Remove other angle bracket formats
      .replace(/:[a-z_]+:/g, '') // Remove emoji codes
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}