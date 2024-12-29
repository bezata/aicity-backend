# AI City Technical Documentation

## Core Architecture

### Backend Stack

- **Runtime**: Bun.js
- **Framework**: Elysia.js
- **Database**: Vector Store (Pinecone)
- **WebSocket**: Native Bun WebSocket Server
- **AI Integration**: Together AI
- **Vector Embeddings**: Together AI Embeddings

### AI Services Architecture

#### 1. Core AI Services

```typescript
// AI Integration Service - Main interface for AI operations
interface AIIntegrationService {
  // System initialization
  initializeSystem(config: {
    agents: string[];
    protocol: string;
    initialState?: Record<string, any>;
  }): Promise<InitializationResult>;

  // Decision recording and analysis
  recordDecision(
    agentId: string,
    decision: string,
    context: Record<string, any>
  ): Promise<void>;

  // Pattern recognition and storage
  storePattern(
    pattern: string,
    context: Record<string, any>,
    confidence: number
  ): Promise<void>;

  // Pattern similarity search
  findSimilarPatterns(
    content: string,
    limit?: number
  ): Promise<Array<{ pattern: string; confidence: number }>>;

  // Decision similarity search
  findSimilarDecisions(
    content: string,
    limit?: number
  ): Promise<Array<{ decision: string; context: Record<string, any> }>>;

  // System status check
  getSystemStatus(): SystemStatus;
}

// Vector Store Service - Handles embeddings and semantic search
interface VectorStoreService {
  createEmbedding(text: string): Promise<number[]>;

  query(params: {
    vector: number[];
    filter?: Record<string, any>;
    topK?: number;
    includeMetadata?: boolean;
  }): Promise<QueryResult>;

  upsert(params: {
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }): Promise<void>;
}

// Agent Conversation Service - Manages AI agent interactions
interface AgentConversationService {
  startNewConversation(
    agentIds: string[],
    context: ConversationContext
  ): Promise<Conversation>;

  handleUserMessage(conversationId: string, message: string): Promise<void>;

  generateResponse(
    districtId: string,
    agentId: string,
    message: string,
    context?: ConversationContext
  ): Promise<{
    response: string;
    sentiment: number;
    topics: string[];
  }>;
}
```

#### 2. AI Context Types

```typescript
// Conversation Context
interface ConversationContext {
  districtId: string;
  activity: string;
  socialMood: {
    positivity: number; // 0-1
    engagement: number; // 0-1
  };
  culturalContext: {
    events: string[];
    traditions: string[];
  };
}

// System Status
interface SystemStatus {
  initialized: boolean;
  activeAgents: number;
  totalPatterns: number;
  totalDecisions: number;
  uptime: number;
  lastUpdate: string;
  performance: {
    responseTime: number;
    successRate: number;
    errorRate: number;
  };
}

// Agent Types
interface AgentPersonality {
  traits: {
    openness: number; // 0-1
    conscientiousness: number; // 0-1
    extraversion: number; // 0-1
    agreeableness: number; // 0-1
    stability: number; // 0-1
  };
  interests: string[];
  communication_style: string;
}

interface AgentMetrics {
  interactions: number;
  successfulDecisions: number;
  learningRate: number;
  adaptabilityScore: number;
  trustScore: number;
}
```

#### 3. AI Integration Configuration

```typescript
// Together AI Configuration
interface TogetherAIConfig {
  model: string; // e.g., "togethercomputer/llama-2-70b-chat"
  max_tokens: number; // typically 512
  temperature: number; // 0.7 for balanced responses
  top_p: number; // 0.8 for good diversity
  repetition_penalty: number; // 1.1 to prevent loops
}

// Vector Store Configuration
interface VectorStoreConfig {
  dimension: number; // 1536 for Together AI embeddings
  metric: "cosine" | "euclidean" | "dotproduct";
  pods: number;
  replicas: number;
  pod_type: string;
}
```

#### 4. AI Service Events

```typescript
// Event Types
type AIServiceEvent = {
  // Pattern Recognition Events
  "pattern:discovered": {
    pattern: string;
    confidence: number;
    context: Record<string, any>;
  };

  // Decision Events
  "decision:made": {
    agentId: string;
    decision: string;
    context: Record<string, any>;
    confidence: number;
  };

  // Learning Events
  "learning:progress": {
    agentId: string;
    metric: string;
    improvement: number;
  };

  // Error Events
  "ai:error": {
    type: string;
    message: string;
    context: Record<string, any>;
  };
};
```

#### 2. WebSocket Communication

```typescript
// Real-time communication system
interface WebSocketData {
  createdAt: number;
  url: string;
  messageHistory: Map<string, { content: string; timestamp: number }>;
  activeConversations: Set<string>;
}

// Message Types
type WebSocketMessage = {
  type: "agent_conversation" | "system_message" | "donation_reaction";
  timestamp: number;
  data: any;
};
```

#### 3. Agent System

```typescript
// Core agent types
interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  districtId: string;
}

// Agent conversation handling
interface AgentConversationService {
  startNewConversation(
    agentIds: string[],
    context: ConversationContext
  ): Promise<Conversation>;

  handleUserMessage(conversationId: string, message: string): Promise<void>;
}
```

## API Routes

### 1. AI Management

```typescript
// Initialize AI System
POST /api/ai/initialize
Body: {
  agents: string[];
  protocol: string;
  initialState?: Record<string, any>;
}

// Record AI Decision
POST /api/ai/decision
Body: {
  agentId: string;
  decision: string;
  context: Record<string, any>;
}

// Store AI Pattern
POST /api/ai/pattern
Body: {
  pattern: string;
  context: Record<string, any>;
  confidence: number;
}
```

### 2. Real-time Communication

```typescript
// WebSocket Connection
WS /ws

// Message Format
{
  type: string;
  timestamp: number;
  data: {
    conversationId?: string;
    message?: {
      content: string;
      agentName: string;
      agentRole: string;
      timestamp: number;
    };
    location?: string;
    activity?: string;
  }
}
```

## System Configuration

### Environment Variables

```env
PORT=3001                    # Server port
TOGETHER_API_KEY=            # Together AI API key
VECTOR_STORE_API_KEY=        # Vector store API key
JWT_SECRET=                  # JWT signing secret
```

### Network Configuration

- Backend ports: 3001 (HTTP), 3002 (WebSocket)
- Frontend port: 3000
- Docker network: aicity-network

## Development Setup

### Prerequisites

```bash
# Required software
- Bun >= 1.0.0
- Docker
- Node.js >= 18 (for development tools)

# Environment setup
cp .env.example .env
```

### Docker Setup

```bash
# Build images
docker build -t aicity-backend .

# Run containers
docker run --name aicity-backend \
  --network aicity-network \
  -p 3001:3001 -p 3002:3002 \
  --env-file .env \
  -d aicity-backend
```

## Core Features

### 1. Agent Conversations

- Real-time multi-agent conversations
- Context-aware responses
- Sentiment analysis
- Topic tracking
- Conversation history in vector store

### 2. AI Decision Making

- Pattern recognition
- Learning from interactions
- Context-based decisions
- Historical data analysis

### 3. Real-time Updates

- WebSocket-based communication
- Event broadcasting
- Message deduplication
- Connection state management

## Performance Considerations

### Rate Limits

- Maximum concurrent conversations: 1 per user
- Message interval: 60 seconds
- API calls: 100,000 per day

### Optimization

- Message deduplication (5-second window)
- Vector store query optimization
- WebSocket connection pooling
- Event listener cleanup

## Security

### Authentication

- JWT-based authentication
- API key validation
- WebSocket connection validation

### Data Protection

- Environment variable encryption
- Secure WebSocket communication
- Rate limiting
- Input validation

## Error Handling

### Common Error Patterns

```typescript
// API Error Response
interface ErrorResponse {
  success: false;
  error: string;
  code: number;
}

// Error Codes
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error
```

## Monitoring

### Health Checks

- System status monitoring
- Agent health tracking
- Connection state monitoring
- Resource usage tracking

### Logging

```typescript
// Log Format
{
  timestamp: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  context?: Record<string, any>;
}
```

## Best Practices

### Development Guidelines

1. Always handle WebSocket disconnections
2. Clean up event listeners
3. Validate input data
4. Use proper error handling
5. Follow rate limiting guidelines

### Deployment Guidelines

1. Set up proper environment variables
2. Configure proper network settings
3. Monitor resource usage
4. Implement proper logging
5. Regular health checks

## Contributing

1. Fork the repository
2. Create feature branch
3. Follow code style guidelines
4. Write tests
5. Submit pull request

## AI Implementation Details

### 1. Agent Conversation System

```typescript
interface AgentConversationService {
  // Core conversation management
  startNewConversation(
    agentIds: string[],
    context: ConversationContext
  ): Promise<Conversation>;

  handleUserMessage(conversationId: string, message: string): Promise<void>;

  // Response generation
  generateResponse(
    districtId: string,
    agentId: string,
    message: string,
    context?: ConversationContext
  ): Promise<{
    response: string;
    sentiment: number;
    topics: string[];
  }>;

  // Agent lifecycle management
  registerAgent(agent: Agent): Promise<void>;
  getRegisteredAgents(): Map<string, Agent>;
}

// Conversation State Analysis
interface ConversationState {
  emotionalDynamics: {
    tension: number;
    agreement: number;
    empathy: number;
  };
  interactionPatterns: {
    turnTakingBalance: number;
    responseLatency: number[];
    topicInitiationCount: Map<string, number>;
  };
  environmentalContext: {
    noise: number;
    crowding: number;
    timeConstraints: boolean;
  };
}
```

### 2. AI Integration System

```typescript
interface AIIntegrationService {
  // System Management
  initializeSystem(config: {
    agents: string[];
    protocol: SystemProtocol;
    initialState?: Record<string, any>;
  }): Promise<InitializationResult>;

  // Pattern Management
  storePattern(
    pattern: string,
    context: Record<string, any>,
    confidence: number
  ): Promise<void>;

  findSimilarPatterns(
    content: string,
    limit?: number
  ): Promise<Array<{ pattern: string; confidence: number }>>;

  // Decision Management
  recordDecision(
    agentId: string,
    decision: string,
    context: Record<string, any>
  ): Promise<void>;

  findSimilarDecisions(
    content: string,
    limit?: number
  ): Promise<Array<{ decision: string; context: Record<string, any> }>>;
}

// System Protocol Definition
interface SystemProtocol {
  name: string;
  version: string;
  rules: string[];
}
```

### 3. Vector Store Integration

```typescript
interface VectorStoreService {
  createEmbedding(text: string): Promise<number[]>;

  query(params: {
    vector: number[];
    filter?: Record<string, any>;
    topK?: number;
    includeMetadata?: boolean;
  }): Promise<QueryResult>;

  upsert(params: {
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }): Promise<void>;
}
```

### 4. AI Service Lifecycle

#### Initialization Process

```typescript
// Service startup sequence
1. Initialize Vector Store connection
2. Register AI agents
3. Start heartbeat monitoring
4. Initialize conversation service
5. Start lifecycle management

// Heartbeat monitoring
private startHeartbeatMonitoring() {
  setInterval(() => this.checkAgentHeartbeats(), 60 * 1000);
}

// Agent registration
public async registerAgent(agent: Agent): Promise<void> {
  this.registeredAgents.set(agent.id, agent);
  await this.generateAIRoutines(agent);
}
```

#### Conversation Management

```typescript
// Conversation lifecycle
1. Start conversation
2. Process messages
3. Generate responses
4. Monitor state
5. End conversation

// Conversation state monitoring
private async shouldEndConversation(
  conversation: AgentConversation,
  lastMessage: Message,
  state: ConversationState
): Promise<boolean> {
  return [
    state.conversationDepth > 0.8,
    state.turnsInCurrentTopic > 10,
    state.emotionalDynamics.agreement > 0.7,
    conversation.messages.length > 20,
    Math.random() > 0.8,
  ].filter(Boolean).length >= 3;
}
```

### 5. AI Response Generation

```typescript
// Response generation process
async generateEnhancedResponse(
  speaker: Agent,
  conversation: AgentConversation,
  systemPrompt: string,
  state: ConversationState
): Promise<string> {
  // 1. Retry logic
  const maxRetries = 3;

  // 2. Response validation
  if (/^[\d.]+$/.test(response.trim())) {
    // Retry if response is just a number
    continue;
  }

  // 3. Context enhancement
  systemPrompt += "\n\nIMPORTANT: Respond naturally as your character. " +
    "Do not output sentiment scores or analysis. " +
    "Just have a normal conversation.";

  // 4. Error handling
  try {
    response = await this.togetherService.generateResponse(
      speaker,
      conversation.messages,
      systemPrompt
    );
  } catch (error) {
    // Handle error and retry
  }
}
```

### 6. Performance Optimizations

```typescript
// Message deduplication
const isDuplicateMessage = (
  messageHistory: Map<string, { content: string; timestamp: number }>,
  type: string,
  content: string
): boolean => {
  const key = `${type}-${content}`;
  const lastMessage = messageHistory.get(key);
  const now = Date.now();

  return lastMessage && now - lastMessage.timestamp < 5000;
};

// Vector store query optimization
const queryConfig = {
  dimension: 1536, // Together AI embeddings
  metric: "cosine",
  pods: 1,
  replicas: 1,
  pod_type: "p1.x1",
};
```

### 7. Rate Limiting

```typescript
// Service rate limits
const limits = {
  maxConcurrentConversations: 1,
  messageInterval: 60000,
  maxDailyAPICalls: 100000,
  conversationCooldown: 60000,
  topicSwitchThreshold: 5,
};

// Conversation timing
const timing = {
  minDelay: 5000,
  maxDelay: 10000,
  responseDelay: 5000,
  typingSpeed: 100,
};
```
