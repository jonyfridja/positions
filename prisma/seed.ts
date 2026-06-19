import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.application.deleteMany();
  await prisma.application.createMany({
    data: [
      {
        company: "Vercel",
        role: "Senior Frontend Engineer",
        status: "INTERVIEW",
        location: "Remote",
        salary: "$180k–$210k",
        link: "https://vercel.com/careers",
        notes: "Recruiter call went well. Tech screen scheduled.",
        appliedAt: new Date("2026-06-01"),
      },
      {
        company: "Linear",
        role: "Product Engineer",
        status: "APPLIED",
        location: "Remote (US/EU)",
        salary: "$170k+",
        link: "https://linear.app/careers",
        appliedAt: new Date("2026-06-10"),
      },
      {
        company: "Stripe",
        role: "Full-Stack Engineer",
        status: "WISHLIST",
        location: "NYC",
        notes: "Wait for referral from Sam before applying.",
      },
      {
        company: "Notion",
        role: "Software Engineer, Growth",
        status: "OFFER",
        location: "SF",
        salary: "$195k + equity",
        appliedAt: new Date("2026-05-12"),
      },
      {
        company: "Figma",
        role: "Frontend Engineer",
        status: "REJECTED",
        location: "Remote",
        notes: "Rejected after final round. Ask for feedback.",
        appliedAt: new Date("2026-05-02"),
      },
    ],
  });
  console.log("Seeded sample applications.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
