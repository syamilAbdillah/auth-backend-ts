import { pgTable, uniqueIndex, serial, text, varchar } from "drizzle-orm/pg-core";
 
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  nama: varchar('nama', { length: 256 }),
  email: varchar('email', { length: 256 }),
  password: text('password'),
}, users => ({
  uniqueIdx: uniqueIndex('unique_idx').on(users.email),
}));