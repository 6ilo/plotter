import { users, type User, type InsertUser, plotterSettings, type PlotterSettings, type InsertPlotterSettings } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Plotter settings methods
  getPlotterSettings(id: number): Promise<PlotterSettings | undefined>;
  getDefaultPlotterSettings(): Promise<PlotterSettings | undefined>;
  getAllPlotterSettings(): Promise<PlotterSettings[]>;
  createPlotterSettings(settings: InsertPlotterSettings): Promise<PlotterSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private settings: Map<number, PlotterSettings>;
  private userCurrentId: number;
  private settingsCurrentId: number;

  constructor() {
    this.users = new Map();
    this.settings = new Map();
    this.userCurrentId = 1;
    this.settingsCurrentId = 1;
    
    // Add default settings
    // Using void to ignore the Promise since we're in the constructor
    void this.createPlotterSettings({
      name: "Default Settings",
      angularMaxSpeed: "600",
      angularAccel: "150",
      radialMaxSpeed: "600",
      radialAccel: "150",
      isDefault: true as const // Use const assertion to satisfy TypeScript
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPlotterSettings(id: number): Promise<PlotterSettings | undefined> {
    return this.settings.get(id);
  }

  async getDefaultPlotterSettings(): Promise<PlotterSettings | undefined> {
    return Array.from(this.settings.values()).find(
      (settings) => settings.isDefault
    );
  }

  async getAllPlotterSettings(): Promise<PlotterSettings[]> {
    return Array.from(this.settings.values());
  }

  async createPlotterSettings(insertSettings: InsertPlotterSettings): Promise<PlotterSettings> {
    const id = this.settingsCurrentId++;
    // Ensure isDefault is defined and is a boolean
    const isDefault = insertSettings.isDefault === true;
    const settings: PlotterSettings = { 
      ...insertSettings, 
      id,
      isDefault // Explicitly set isDefault as boolean
    };
    
    // If this is set as default, update other settings
    if (settings.isDefault) {
      // Use Array.from to avoid iterator issues
      const existingSettings = Array.from(this.settings.entries());
      for (const [key, setting] of existingSettings) {
        if (setting.isDefault) {
          this.settings.set(key, { ...setting, isDefault: false });
        }
      }
    }
    
    this.settings.set(id, settings);
    return settings;
  }
}

export const storage = new MemStorage();
