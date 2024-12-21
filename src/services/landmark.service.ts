interface Landmark {
  id: string;
  name: string;
  coordinates: [number, number];
  type: string;
  description?: string;
}

export class LandmarkService {
  private landmarks: Map<string, Landmark> = new Map();

  async getAllLandmarks(): Promise<Landmark[]> {
    return Array.from(this.landmarks.values());
  }

  async addLandmark(landmark: Landmark): Promise<void> {
    this.landmarks.set(landmark.id, landmark);
  }

  async getLandmarkById(id: string): Promise<Landmark | undefined> {
    return this.landmarks.get(id);
  }

  async searchLandmarks(query: string): Promise<Landmark[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.landmarks.values()).filter(
      (landmark) =>
        landmark.name.toLowerCase().includes(lowerQuery) ||
        landmark.description?.toLowerCase().includes(lowerQuery)
    );
  }
}
