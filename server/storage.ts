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
    this.createPlotterSettings({
      name: "Default Settings",
      angularMaxSpeed: "600",
      angularAccel: "150",
      radialMaxSpeed: "600",
      radialAccel: "150",
      isDefault: true
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
    const settings: PlotterSettings = { ...insertSettings, id };
    
    // If this is set as default, update other settings
    if (settings.isDefault) {
      for (const [key, existingSettings] of this.settings.entries()) {
        if (existingSettings.isDefault) {
          this.settings.set(key, { ...existingSettings, isDefault: false });
        }
      }
    }
    
    this.settings.set(id, settings);
    return settings;
  }
}

export const storage = new MemStorage();
