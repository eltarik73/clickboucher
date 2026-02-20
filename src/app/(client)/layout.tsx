"use client";

import dynamic from "next/dynamic";
import { BottomNav } from "@/components/layout/BottomNav";
import { CartProviderWrapper } from "@/components/providers/CartProviderWrapper";

const ChatWidget = dynamic(() => import("@/components/chat/ChatWidget").then(m => m.ChatWidget), {
  ssr: false,
});

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProviderWrapper>
      <div className="pb-20">{children}</div>
      <BottomNav />
      <ChatWidget />
    </CartProviderWrapper>
  );
}
