/**
 * Pure timeline building functions for thread analysis
 * No side effects, fully testable and functional
 */

import type { SlackMessage } from "../../types/index.js";
import type { TimelineEvent, TimelineAnalysisResult } from './types.js';

/**
 * Parse timestamp from Slack message
 * @param ts - Slack timestamp string
 * @returns Parsed timestamp as number or null if invalid
 */
export function parseSlackTimestamp(ts: string): number | null {
  const timestamp = parseFloat(ts);
  return isNaN(timestamp) ? null : timestamp;
}

/**
 * Calculate time difference in minutes
 * @param startTs - Start timestamp
 * @param endTs - End timestamp
 * @returns Time difference in minutes
 */
export function calculateTimeDifference(startTs: number, endTs: number): number {
  return (endTs - startTs) / 60; // Convert from seconds to minutes
}

/**
 * Build timeline events from messages
 * @param messages - Array of Slack messages (should be sorted by timestamp)
 * @returns Array of timeline events
 */
export function buildTimelineEvents(messages: readonly SlackMessage[]): TimelineEvent[] {
  if (messages.length === 0) return [];

  const events: TimelineEvent[] = [];
  const startTime = parseSlackTimestamp(messages[0]?.ts || '0');

  if (startTime === null) return [];

  messages.forEach((message, index) => {
    const timestamp = parseSlackTimestamp(message.ts || '');

    if (timestamp !== null && message.ts) {
      const timeSinceStart = calculateTimeDifference(startTime, timestamp);

      events.push({
        timestamp: message.ts,
        user_id: message.user || 'unknown',
        event_type: 'message',
        content: message.text,
        messageIndex: index,
        timeSinceStart,
      });
    }
  });

  return events;
}

/**
 * Calculate response times between consecutive messages
 * @param events - Array of timeline events
 * @returns Array of response times in minutes
 */
export function calculateResponseTimes(events: readonly TimelineEvent[]): number[] {
  const responseTimes: number[] = [];

  for (let i = 1; i < events.length; i++) {
    const currentTime = parseSlackTimestamp(events[i]?.timestamp || '');
    const previousTime = parseSlackTimestamp(events[i - 1]?.timestamp || '');

    if (currentTime !== null && previousTime !== null) {
      const responseTime = calculateTimeDifference(previousTime, currentTime);
      responseTimes.push(responseTime);
    }
  }

  return responseTimes;
}

/**
 * Calculate average response time
 * @param responseTimes - Array of response times
 * @returns Average response time in minutes
 */
export function calculateAverageResponseTime(responseTimes: readonly number[]): number {
  if (responseTimes.length === 0) return 0;

  const total = responseTimes.reduce((sum, time) => sum + time, 0);
  return total / responseTimes.length;
}

/**
 * Calculate message velocity (messages per hour)
 * @param events - Timeline events
 * @param totalDurationMinutes - Total duration in minutes
 * @returns Messages per hour
 */
export function calculateMessageVelocity(
  events: readonly TimelineEvent[],
  totalDurationMinutes: number
): number {
  if (totalDurationMinutes <= 0 || events.length === 0) return 0;

  const hours = totalDurationMinutes / 60;
  return events.length / hours;
}

/**
 * Get total duration from timeline events
 * @param events - Timeline events
 * @returns Total duration in minutes
 */
export function getTotalDuration(events: readonly TimelineEvent[]): number {
  if (events.length < 2) return 0;

  const firstTime = parseSlackTimestamp(events[0]?.timestamp || '');
  const lastTime = parseSlackTimestamp(events[events.length - 1]?.timestamp || '');

  if (firstTime === null || lastTime === null) return 0;

  return calculateTimeDifference(firstTime, lastTime);
}

/**
 * Build comprehensive timeline analysis from messages
 * @param messages - Array of Slack messages (should be sorted by timestamp)
 * @returns Complete timeline analysis result
 */
export function buildThreadTimeline(messages: readonly SlackMessage[]): TimelineAnalysisResult {
  const events = buildTimelineEvents(messages);
  const totalDuration = getTotalDuration(events);
  const responseTimes = calculateResponseTimes(events);
  const averageResponseTime = calculateAverageResponseTime(responseTimes);
  const messageVelocity = calculateMessageVelocity(events, totalDuration);

  return {
    events,
    totalDuration,
    averageResponseTime,
    messageVelocity,
  };
}

/**
 * Group events by user
 * @param events - Timeline events
 * @returns Events grouped by user ID
 */
export function groupEventsByUser(events: readonly TimelineEvent[]): Map<string, TimelineEvent[]> {
  const userGroups = new Map<string, TimelineEvent[]>();

  for (const event of events) {
    const userId = event.user_id;
    if (!userGroups.has(userId)) {
      userGroups.set(userId, []);
    }
    userGroups.get(userId)!.push(event);
  }

  return userGroups;
}

/**
 * Get user participation statistics
 * @param events - Timeline events
 * @returns Statistics about user participation
 */
export function getUserParticipationStats(events: readonly TimelineEvent[]): {
  totalUsers: number;
  userMessageCounts: Map<string, number>;
  mostActiveUser: { userId: string; messageCount: number } | null;
  userResponseTimes: Map<string, number[]>;
} {
  const userGroups = groupEventsByUser(events);
  const userMessageCounts = new Map<string, number>();
  const userResponseTimes = new Map<string, number[]>();

  let mostActiveUser: { userId: string; messageCount: number } | null = null;

  for (const [userId, userEvents] of userGroups) {
    const messageCount = userEvents.length;
    userMessageCounts.set(userId, messageCount);

    if (!mostActiveUser || messageCount > mostActiveUser.messageCount) {
      mostActiveUser = { userId, messageCount };
    }

    // Calculate response times for this user
    const userResponseTimes_local: number[] = [];
    for (let i = 1; i < userEvents.length; i++) {
      const currentTime = parseSlackTimestamp(userEvents[i]?.timestamp || '');
      const previousTime = parseSlackTimestamp(userEvents[i - 1]?.timestamp || '');

      if (currentTime !== null && previousTime !== null) {
        const responseTime = calculateTimeDifference(previousTime, currentTime);
        userResponseTimes_local.push(responseTime);
      }
    }
    userResponseTimes.set(userId, userResponseTimes_local);
  }

  return {
    totalUsers: userGroups.size,
    userMessageCounts,
    mostActiveUser,
    userResponseTimes,
  };
}

/**
 * Find periods of high activity
 * @param events - Timeline events
 * @param windowMinutes - Time window size in minutes (default: 30)
 * @param minMessages - Minimum messages for high activity (default: 3)
 * @returns Array of high activity periods
 */
export function findHighActivityPeriods(
  events: readonly TimelineEvent[],
  windowMinutes: number = 30,
  minMessages: number = 3
): Array<{
  startTime: number;
  endTime: number;
  messageCount: number;
  participants: string[];
}> {
  if (events.length === 0) return [];

  const activityPeriods: Array<{
    startTime: number;
    endTime: number;
    messageCount: number;
    participants: string[];
  }> = [];

  const windowSeconds = windowMinutes * 60;

  for (let i = 0; i < events.length; i++) {
    const startTime = parseSlackTimestamp(events[i]?.timestamp || '');
    if (startTime === null) continue;

    const endTime = startTime + windowSeconds;
    const windowEvents = [];
    const participants = new Set<string>();

    // Find all events within the time window
    for (let j = i; j < events.length; j++) {
      const eventTime = parseSlackTimestamp(events[j]?.timestamp || '');
      if (eventTime === null) continue;

      if (eventTime <= endTime) {
        windowEvents.push(events[j]);
        participants.add(events[j]?.user_id || 'unknown');
      } else {
        break;
      }
    }

    if (windowEvents.length >= minMessages) {
      activityPeriods.push({
        startTime,
        endTime,
        messageCount: windowEvents.length,
        participants: Array.from(participants),
      });
    }
  }

  // Remove overlapping periods, keeping the one with most messages
  return deduplicateActivityPeriods(activityPeriods);
}

/**
 * Remove overlapping activity periods, keeping the most active ones
 * @param periods - Array of activity periods
 * @returns Deduplicated activity periods
 */
function deduplicateActivityPeriods(
  periods: Array<{
    startTime: number;
    endTime: number;
    messageCount: number;
    participants: string[];
  }>
): typeof periods {
  if (periods.length <= 1) return periods;

  // Sort by start time
  const sorted = [...periods].sort((a, b) => a.startTime - b.startTime);
  const result: typeof periods = [];

  for (const current of sorted) {
    const hasOverlap = result.some(
      (existing) => current.startTime < existing.endTime && current.endTime > existing.startTime
    );

    if (!hasOverlap) {
      result.push(current);
    } else {
      // Replace if current has more messages
      const overlappingIndex = result.findIndex(
        (existing) => current.startTime < existing.endTime && current.endTime > existing.startTime
      );

      if (
        overlappingIndex !== -1 &&
        current.messageCount > result[overlappingIndex]!.messageCount
      ) {
        result[overlappingIndex] = current;
      }
    }
  }

  return result;
}

/**
 * Find gaps in conversation (periods of silence)
 * @param events - Timeline events
 * @param minGapMinutes - Minimum gap duration to consider (default: 60 minutes)
 * @returns Array of conversation gaps
 */
export function findConversationGaps(
  events: readonly TimelineEvent[],
  minGapMinutes: number = 60
): Array<{
  startTime: number;
  endTime: number;
  durationMinutes: number;
}> {
  if (events.length < 2) return [];

  const gaps: Array<{
    startTime: number;
    endTime: number;
    durationMinutes: number;
  }> = [];

  for (let i = 1; i < events.length; i++) {
    const previousTime = parseSlackTimestamp(events[i - 1]?.timestamp || '');
    const currentTime = parseSlackTimestamp(events[i]?.timestamp || '');

    if (previousTime !== null && currentTime !== null) {
      const gapDuration = calculateTimeDifference(previousTime, currentTime);

      if (gapDuration >= minGapMinutes) {
        gaps.push({
          startTime: previousTime,
          endTime: currentTime,
          durationMinutes: gapDuration,
        });
      }
    }
  }

  return gaps;
}

/**
 * Generate timeline summary text
 * @param analysis - Timeline analysis result
 * @returns Human-readable timeline summary
 */
export function generateTimelineSummary(analysis: TimelineAnalysisResult): string {
  const hours = (analysis.totalDuration / 60).toFixed(1);
  const participationStats = getUserParticipationStats(analysis.events);

  return `Timeline Summary:
• Duration: ${hours} hours (${analysis.totalDuration.toFixed(0)} minutes)
• Messages: ${analysis.events.length}
• Participants: ${participationStats.totalUsers}
• Message Velocity: ${analysis.messageVelocity.toFixed(1)} messages/hour
• Average Response Time: ${analysis.averageResponseTime.toFixed(1)} minutes
• Most Active User: ${participationStats.mostActiveUser?.userId || 'N/A'} (${participationStats.mostActiveUser?.messageCount || 0} messages)`;
}
