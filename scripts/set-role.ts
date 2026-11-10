// Give a user a staff role and link them to a university.
// Usage: npx tsx scripts/set-role.ts someone@au.edu.pk CHAIR "Air University, Islamabad"
import { PrismaClient, type Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, role, uniName] = process.argv.slice(2);
  const roles = ["STUDENT", "FACULTY", "FOCAL", "CHAIR", "ADMIN"];
  if (!email || !roles.includes(role)) {
    console.error(`Usage: set-role.ts <email> <${roles.join("|")}> ["University name"]`);
    process.exit(1);
  }
  const uni = uniName ? await prisma.university.findUnique({ where: { name: uniName } }) : null;
  if (uniName && !uni) throw new Error(`University not found: ${uniName}`);
  const u = await prisma.user.update({ where: { email }, data: { role: role as Role, universityId: uni?.id ?? undefined } });
  console.log(`${u.email} is now ${u.role}${uni ? ` at ${uni.name}` : ""}. They must sign in at least once before this works.`);
}

main().finally(() => prisma.$disconnect());
