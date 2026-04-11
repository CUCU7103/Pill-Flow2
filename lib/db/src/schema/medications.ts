import { pgTable, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ─── 약 유형 Enum ────────────────────────────────────────────────────────────
export const medTypeEnum = pgEnum("med_type", ["pill", "capsule", "liquid", "packet"]);

// ─── 복용 시간대 Enum ────────────────────────────────────────────────────────
export const categoryEnum = pgEnum("category", ["morning", "lunch", "evening"]);

// ─── 약 테이블 ───────────────────────────────────────────────────────────────
export const medicationsTable = pgTable("medications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  dosageAmount: integer("dosage_amount").notNull().default(1),
  remainingQuantity: integer("remaining_quantity").notNull().default(30),
  time: text("time").notNull(),
  category: categoryEnum("category").notNull().default("morning"),
  type: medTypeEnum("type").notNull().default("pill"),
  color: text("color").notNull().default("#6C63FF"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── 복용 기록 테이블 ────────────────────────────────────────────────────────
export const medicationLogsTable = pgTable("medication_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  medicationId: text("medication_id").notNull().references(() => medicationsTable.id, { onDelete: "cascade" }),
  takenAt: timestamp("taken_at").defaultNow().notNull(),
  date: text("date").notNull(), // YYYY-MM-DD 형식, 날짜별 조회용
});

// ─── Zod 스키마 ──────────────────────────────────────────────────────────────
export const insertMedicationSchema = createInsertSchema(medicationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectMedicationSchema = createSelectSchema(medicationsTable);

export const insertMedicationLogSchema = createInsertSchema(medicationLogsTable).omit({
  id: true,
  takenAt: true,
});

export const selectMedicationLogSchema = createSelectSchema(medicationLogsTable);

// ─── 타입 ────────────────────────────────────────────────────────────────────
export type InsertMedication = z.infer<typeof insertMedicationSchema>;
export type Medication = typeof medicationsTable.$inferSelect;
export type InsertMedicationLog = z.infer<typeof insertMedicationLogSchema>;
export type MedicationLog = typeof medicationLogsTable.$inferSelect;
