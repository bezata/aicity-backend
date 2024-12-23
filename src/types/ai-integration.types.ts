export interface SystemProtocol {
  name: string;
  version: string;
  rules: string[];
  
}

export interface SystemInitializationConfig {
  agents: string[];
  protocol: SystemProtocol;
  initialState?: Record<string, any>;
}

export interface NetworkStatus {
  isActive: boolean;
  connectedAgents: number;
  protocol: SystemProtocol;
  timestamp: number;
}

export interface SystemInitializationResult {
  systemId: string;
  activeAgents: string[];
  networkStatus: NetworkStatus;
}

export interface AIDecisionContext {
  agentId: string;
  decision: string;
  context: Record<string, any>;
  timestamp: number;
}

export interface AIPattern {
  id: string;
  pattern: string;
  context: Record<string, any>;
  confidence: number;
  timestamp: number;
}

export interface AIProtocol {
  id: string;
  rules: string[];
  constraints: Record<string, any>;
  version: string;
  timestamp: number;
}

export type RecordType =
  | "protocol"
  | "state"
  | "decision"
  | "pattern"
  | "conversation"
  | "collaboration"
  | "district"
  | "transport"
  | "agent_residence"
  | "agent_visit";

export interface BaseMetadata {
  type: RecordType;
  timestamp: number;
}

export interface ChatMetadata extends BaseMetadata {
  type: "conversation";
  senderId: string;
  receiverId: string;
}

export interface StateMetadata extends BaseMetadata {
  type: "state";
  state: Record<string, any>;
}

export interface ProtocolMetadata extends BaseMetadata {
  type: "protocol";
  protocol: string;
}

export interface DecisionMetadata extends BaseMetadata {
  type: "decision";
  agentId: string;
  state?: {
    decision: string;
    context: Record<string, any>;
  };
}

export interface PatternMetadata extends BaseMetadata {
  type: "pattern";
  state?: {
    pattern: string;
    context: Record<string, any>;
    confidence: number;
  };
}

export interface GenericMetadata extends BaseMetadata {
  type: Exclude<
    RecordType,
    "conversation" | "state" | "protocol" | "decision" | "pattern"
  >;
  agentId?: string;
  state?: Record<string, any>;
}

export type RecordMetadata =
  | ChatMetadata
  | StateMetadata
  | ProtocolMetadata
  | DecisionMetadata
  | PatternMetadata
  | GenericMetadata;

export type Metadata = RecordMetadata;

// Type guards
export function isProtocolMetadata(
  metadata: Metadata
): metadata is ProtocolMetadata {
  return metadata.type === "protocol";
}

export function isStateMetadata(metadata: Metadata): metadata is StateMetadata {
  return metadata.type === "state";
}

export function isDecisionMetadata(
  metadata: Metadata
): metadata is DecisionMetadata {
  return metadata.type === "decision";
}

export function isPatternMetadata(
  metadata: Metadata
): metadata is PatternMetadata {
  return metadata.type === "pattern";
}

export function isChatMetadata(metadata: Metadata): metadata is ChatMetadata {
  return metadata.type === "conversation";
}

export function isGenericMetadata(
  metadata: Metadata
): metadata is GenericMetadata {
  return (
    !isProtocolMetadata(metadata) &&
    !isStateMetadata(metadata) &&
    !isDecisionMetadata(metadata) &&
    !isPatternMetadata(metadata) &&
    !isChatMetadata(metadata)
  );
}

// Query result interfaces
export interface QueryMatch {
  id: string;
  score: number;
  metadata: Metadata;
}

export interface QueryResult {
  matches?: QueryMatch[];
  namespace?: string;
}
