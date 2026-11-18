import { PrismaClient } from "@prisma/client";

// Secret fields are never returned unless a query asks for them with select or omit: { field: false }.
const make = () => new PrismaClient({ omit: { user: { passwordHash: true, totpSecret: true }, profile: { cnicEnc: true, cnicHash: true } } });

const g = globalThis as unknown as { prisma?: ReturnType<typeof make> };

export const prisma = g.prisma ?? make();

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
