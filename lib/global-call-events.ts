import type { ChatSession } from "@/lib/chat-storage";
import type { Character } from "@/lib/character-types";

export const GLOBAL_CALL_START_EVENT = "ai-global-call-start";
export const GLOBAL_CALL_END_EVENT = "ai-global-call-end";

export type GlobalCallStartDetail = {
    session: ChatSession;
    character: Character;
    type: "voice" | "video";
    initiator?: "user" | "character";
    offlineMode?: boolean;
};

export function dispatchStartGlobalCall(detail: GlobalCallStartDetail): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(GLOBAL_CALL_START_EVENT, { detail }));
}

export function dispatchEndGlobalCall(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(GLOBAL_CALL_END_EVENT));
}
