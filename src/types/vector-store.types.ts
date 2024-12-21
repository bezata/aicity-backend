export type VectorStoreType =
  | "conversation"
  | "collaboration"
  | "district"
  | "transport"
  | "agent_residence"
  | "agent_visit";

export interface VectorRecord<T> {
  id: string;
  vector: number[];
  metadata: T;
  score?: number;
}

export interface VectorQuery<T> {
  vector: number[];
  filter?: {
    [K in keyof T]?: {
      $eq?: T[K];
      $ne?: T[K];
      $gt?: number;
      $gte?: number;
      $lt?: number;
      $lte?: number;
      $in?: (string | number)[];
      $nin?: (string | number)[];
      $exists?: boolean;
    };
  };
  limit?: number;
}

export interface TextVectorQuery<T> extends Omit<VectorQuery<T>, "vector"> {
  textQuery: string;
}
