import { pgTable, text, serial, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Keep the users table for authentication if needed later
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Create a table for plotter settings
export const plotterSettings = pgTable("plotter_settings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  angularMaxSpeed: text("angular_max_speed").notNull(),
  angularAccel: text("angular_accel").notNull(),
  radialMaxSpeed: text("radial_max_speed").notNull(),
  radialAccel: text("radial_accel").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
});

// Create schemas for insertion
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPlotterSettingsSchema = createInsertSchema(plotterSettings).pick({
  name: true, 
  angularMaxSpeed: true,
  angularAccel: true,
  radialMaxSpeed: true,
  radialAccel: true,
  isDefault: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPlotterSettings = z.infer<typeof insertPlotterSettingsSchema>;
export type PlotterSettings = typeof plotterSettings.$inferSelect;
