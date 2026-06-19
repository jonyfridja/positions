"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STATUS_META, isStatus, statusLabel } from "@/lib/status";

function str(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed === "" ? null : trimmed;
}

export async function createApplication(formData: FormData) {
  const company = str(formData, "company");
  const role = str(formData, "role");
  if (!company || !role) throw new Error("Company and role are required.");

  const statusRaw = formData.get("status");
  const status = isStatus(statusRaw) ? statusRaw : "WISHLIST";
  const appliedAt = str(formData, "appliedAt");

  await prisma.application.create({
    data: {
      company,
      role,
      status,
      location: str(formData, "location"),
      salary: str(formData, "salary"),
      link: str(formData, "link"),
      notes: str(formData, "notes"),
      appliedAt: appliedAt ? new Date(appliedAt) : null,
      events: {
        create: {
          type: "CREATED",
          message: `Added to ${STATUS_META[status].label}`,
        },
      },
    },
  });

  revalidatePath("/");
}

export async function updateApplication(id: string, formData: FormData) {
  const company = str(formData, "company");
  const role = str(formData, "role");
  if (!company || !role) throw new Error("Company and role are required.");

  const appliedAt = str(formData, "appliedAt");

  await prisma.application.update({
    where: { id },
    data: {
      company,
      role,
      location: str(formData, "location"),
      salary: str(formData, "salary"),
      link: str(formData, "link"),
      notes: str(formData, "notes"),
      appliedAt: appliedAt ? new Date(appliedAt) : null,
      events: { create: { type: "UPDATED", message: "Details updated" } },
    },
  });

  revalidatePath("/");
  revalidatePath(`/applications/${id}`);
}

export async function updateStatus(id: string, status: string) {
  if (!isStatus(status)) throw new Error("Invalid status.");

  const current = await prisma.application.findUnique({ where: { id } });
  if (!current) throw new Error("Application not found.");
  if (current.status === status) return;

  await prisma.application.update({
    where: { id },
    data: {
      status,
      // Stamp the application date the first time it leaves the wishlist.
      appliedAt:
        status !== "WISHLIST" && !current.appliedAt ? new Date() : current.appliedAt,
      events: {
        create: {
          type: "STATUS_CHANGE",
          message: `${statusLabel(current.status)} → ${STATUS_META[status].label}`,
        },
      },
    },
  });

  revalidatePath("/");
  revalidatePath(`/applications/${id}`);
}

export async function addNote(id: string, formData: FormData) {
  const message = str(formData, "message");
  if (!message) return;

  await prisma.event.create({
    data: { applicationId: id, type: "NOTE", message },
  });

  revalidatePath(`/applications/${id}`);
}

export async function deleteApplication(id: string) {
  await prisma.application.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}
