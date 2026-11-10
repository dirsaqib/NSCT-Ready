"use client";
import TicketThread from "@/components/TicketThread";

export default function TicketPage({ params }: { params: { id: string } }) {
  return <TicketThread id={params.id} />;
}
