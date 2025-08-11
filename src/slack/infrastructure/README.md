# Infrastructure Layer

This directory contains the infrastructure services extracted from the monolithic SlackService class. The infrastructure layer provides reusable, functional components that manage cross-cutting concerns like client management, rate limiting, user caching, and request handling.

## Architecture Overview

The infrastructure layer follows functional programming principles:

- **Pure Functions**: All business logic is implemented as pure functions where possible
- **Immutable Data**: State updates are handled immutably to prevent accidental mutations
- **Dependency Injection**: Services are created using factory functions with explicit dependencies
- **Composition**: Complex behaviors are built by composing simpler functions

## Services

### 1. Client Manager (`client/`)

Manages WebClient instances for both bot and user tokens.

```typescript
import { createSlackClientManager, convertLogLevel } from './client/client-manager.js';
import { createRateLimitService } from './client/rate-limit-service.js';

// Create services
const rateLimitService = createRateLimitService();
const clientManager = createSlackClientManager({
  botToken: 'xoxb-...',
  userToken: 'xoxp-...',
  useUserTokenForRead: true,
  enableRateLimit: true,
  clientConfig: {
    logLevel: convertLogLevel('info'),
    retryConfig: { retries: 3, factor: 2, minTimeout: 1000, maxTimeout: 300000, randomize: true },
    maxRequestConcurrency: 5,
    rejectRateLimitedCalls: false
  }
}, rateLimitService);

// Use clients
const botClient = clientManager.getBotClient();
const userClient = clientManager.getUserClient();
const readClient = clientManager.getClientForOperation('read');
const writeClient = clientManager.getClientForOperation('write');

// Check API availability
clientManager.checkSearchApiAvailability('searchMessages', 'Use getChannelHistory instead');
```

**Key Features:**
- Lazy initialization of WebClient instances
- Automatic rate limiting setup when enabled
- Client selection based on operation type (read/write)
- Search API availability validation

### 2. Rate Limit Service (`client/rate-limit-service.ts`)

Tracks rate limiting metrics and enhances WebClient instances with monitoring.

```typescript
import { createRateLimitService } from './client/rate-limit-service.js';

const rateLimitService = createRateLimitService();

// Enhance client with metrics
const enhancedClient = rateLimitService.createClientWithMetrics(webClient, 'bot');

// Get metrics
const metrics = rateLimitService.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Rate limited: ${metrics.rateLimitedRequests}`);

// Extract API tier
const tier = rateLimitService.extractTierFromUrl('https://slack.com/api/chat.postMessage');
```

**Key Features:**
- Immutable metrics state management
- Automatic request counting
- Rate limit event handling
- API tier categorization

### 3. User Service (`user/`)

Manages user information with intelligent caching.

```typescript
import { createUserService } from './user/user-service.js';

const userService = createUserService({
  getClient: () => clientManager.getClientForOperation('read')
});

// Get single user display name
const displayName = await userService.getDisplayName('U1234567890');

// Get multiple users efficiently
const userIds = ['U1234567890', 'U0987654321'];
const displayNames = await userService.bulkGetDisplayNames(userIds);

// Clear cache if needed
userService.clearCache();
```

**Key Features:**
- Immutable cache management
- Bulk user lookup optimization
- Graceful fallbacks for failed lookups
- Special case handling

### 4. Request Handler (`validation/`)

Provides consistent request validation, error handling, and response formatting.

```typescript
import { createRequestHandler } from './validation/request-handler.js';
import { validateInput } from '../../../utils/validation.js';

const requestHandler = createRequestHandler({
  validateInput,
  formatResponse: (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] }),
  formatError: (error) => ({ content: [{ type: 'text', text: error.message }], isError: true })
});

// Use in service methods
const result = await requestHandler.handle(
  SendMessageSchema,
  args,
  async (input) => {
    return await client.chat.postMessage(input);
  }
);
```

**Key Features:**
- Generic request handling pattern
- Automatic input validation
- Consistent error handling
- Configurable response formatting

## Factory Pattern

Use the factory function to create all infrastructure services with proper dependency injection:

```typescript
import { createInfrastructureServices } from './factory.js';

const infrastructure = createInfrastructureServices({
  botToken: process.env.SLACK_BOT_TOKEN!,
  userToken: process.env.SLACK_USER_TOKEN,
  useUserTokenForRead: true,
  enableRateLimit: true,
  rateLimitRetries: 3,
  maxRequestConcurrency: 5,
  rejectRateLimitedCalls: false,
  logLevel: 'info'
});

// Use services
const { clientManager, rateLimitService, userService, requestHandler } = infrastructure;
```

## Integration with Existing Code

The infrastructure services are designed to be backward compatible. You can gradually migrate existing SlackService methods to use these services:

```typescript
// Before (in SlackService)
async sendMessage(args: unknown) {
  const input = validateInput(SendMessageSchema, args);
  
  try {
    const result = await this.getClientForOperation('write').chat.postMessage({
      channel: input.channel,
      text: input.text,
      ...(input.thread_ts && { thread_ts: input.thread_ts }),
    });

    return {
      content: [{ type: 'text', text: `Message sent successfully` }],
    };
  } catch (error) {
    // Error handling...
  }
}

// After (using infrastructure)
async sendMessage(args: unknown) {
  return this.requestHandler.handle(
    SendMessageSchema,
    args,
    async (input) => {
      const result = await this.clientManager.getClientForOperation('write').chat.postMessage({
        channel: input.channel,
        text: input.text,
        ...(input.thread_ts && { thread_ts: input.thread_ts }),
      });
      
      return `Message sent successfully to ${input.channel}. Timestamp: ${result.ts}`;
    }
  );
}
```

## Testing

The infrastructure services are designed to be easily testable with dependency injection:

```typescript
// Create mock dependencies
const mockClient = createMockWebClient();
const mockClientManager = {
  getClientForOperation: () => mockClient,
  // ... other methods
};

// Test services in isolation
const userService = createUserService({
  getClient: () => mockClient
});

await userService.getDisplayName('U123');
expect(mockClient.users.info).toHaveBeenCalledWith({ user: 'U123' });
```

## Benefits

1. **Separation of Concerns**: Each service has a single, well-defined responsibility
2. **Testability**: Services can be tested in isolation with mocked dependencies
3. **Reusability**: Infrastructure services can be reused across different domain services
4. **Maintainability**: Clear boundaries make the code easier to understand and modify
5. **Type Safety**: Full TypeScript support with proper type definitions
6. **Functional Approach**: Immutable state and pure functions where possible
7. **Performance**: Intelligent caching and efficient bulk operations

## Next Steps

This infrastructure layer enables the next phase of refactoring:

1. **Domain Services**: Create dedicated services for messaging, threads, files, etc.
2. **Service Composition**: Combine infrastructure and domain services
3. **Legacy Migration**: Gradually migrate SlackService methods to use the new architecture
4. **Enhanced Testing**: Add comprehensive integration and unit tests
5. **Performance Optimization**: Implement advanced caching and optimization strategies