"use client";

import { useEffect, useState, useRef } from "react";
import { VoiceCallScreen } from "./voice-call-screen";
import { VideoCallScreen } from "./video-call-screen";
import { GLOBAL_CALL_START_EVENT, GLOBAL_CALL_END_EVENT, type GlobalCallStartDetail } from "@/lib/global-call-events";
import { CHAT_OPEN_SESSION_EVENT } from "@/lib/chat-notification-events";
import { pushChatMessage, triggerChatReply, loadChatMessages } from "@/lib/chat-storage";
import { loadChatOfflineTurns } from "@/lib/chat-offline-storage";

type ActiveCallState = GlobalCallStartDetail & {
    minimized: boolean;
};

export function GlobalCallHost() {
    const [call, setCall] = useState<ActiveCallState | null>(null);
    const [minimizedDuration, setMinimizedDuration] = useState(0);

    useEffect(() => {
        const handleStart = (e: Event) => {
            const detail = (e as CustomEvent<GlobalCallStartDetail>).detail;
            if (!detail || !detail.session || !detail.character) return;
            setCall({
                ...detail,
                minimized: false,
            });
            setMinimizedDuration(0);
        };

        const handleEnd = () => {
            setCall(null);
            setMinimizedDuration(0);
        };

        window.addEventListener(GLOBAL_CALL_START_EVENT, handleStart);
        window.addEventListener(GLOBAL_CALL_END_EVENT, handleEnd);
        return () => {
            window.removeEventListener(GLOBAL_CALL_START_EVENT, handleStart);
            window.removeEventListener(GLOBAL_CALL_END_EVENT, handleEnd);
        };
    }, []);

    // 悬浮球计时器
    useEffect(() => {
        if (!call || !call.minimized) return;
        const timer = setInterval(() => {
            setMinimizedDuration(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [call?.minimized]);

    if (!call) return null;

    const handleEndCall = () => {
        const currentCall = call;
        setCall(null);
        setMinimizedDuration(0);

        // 通知聊天室同步历史
        if (currentCall.session) {
            window.dispatchEvent(new CustomEvent("chat-messages-updated", { detail: { sessionId: currentCall.session.id } }));
        }
    };

    const handleExpandCall = () => {
        setCall(prev => (prev ? { ...prev, minimized: false } : null));
        // 打开手机聊天 APP 并导航至对应的 session
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("open-app", { detail: { appId: "chat" } }));
            window.dispatchEvent(new CustomEvent(CHAT_OPEN_SESSION_EVENT, { detail: { sessionId: call.session.id } }));
        }
    };

    return (
        <>
            {/* 全屏通话界面 */}
            <div
                className={`fixed inset-0 z-[99990] transition-transform duration-300 ${
                    call.minimized ? "translate-y-full pointer-events-none" : "translate-y-0"
                }`}
                style={{ visibility: call.minimized ? "hidden" : "visible", pointerEvents: call.minimized ? "none" : "auto" }}
            >
                {call.type === "voice" ? (
                    <VoiceCallScreen
                        session={call.session}
                        character={call.character}
                        initiator={call.initiator || "user"}
                        offlineMode={call.offlineMode}
                        onMinimize={() => setCall(prev => (prev ? { ...prev, minimized: true } : null))}
                        onEnd={handleEndCall}
                        onConnect={() => {
                            if (call.initiator === "user") {
                                const actionText = call.offlineMode
                                    ? "[我向对方发起并接通了面对面语音对话]"
                                    : `[我向${call.character.name}发起了语音通话]`;
                                pushChatMessage({ sessionId: call.session.id, role: "user", content: actionText });
                            }
                        }}
                    />
                ) : (
                    <VideoCallScreen
                        session={call.session}
                        character={call.character}
                        initiator={call.initiator || "user"}
                        offlineMode={call.offlineMode}
                        onMinimize={() => setCall(prev => (prev ? { ...prev, minimized: true } : null))}
                        onEnd={handleEndCall}
                        onConnect={() => {
                            if (call.initiator === "user") {
                                const actionText = call.offlineMode
                                    ? "[我向对方发起并接通了面对面视频对话]"
                                    : `[我向${call.character.name}发起了视频通话]`;
                                pushChatMessage({ sessionId: call.session.id, role: "user", content: actionText });
                            }
                        }}
                    />
                )}
            </div>

            {/* 最小化悬浮球：永远渲染在系统最顶层 z-[99999] */}
            {call.minimized && (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        handleExpandCall();
                    }}
                    className="fixed right-4 top-20 z-[99999] flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/80 text-white backdrop-blur-md border border-white/25 shadow-2xl cursor-pointer animate-pulse select-none"
                    style={{ visibility: "visible", pointerEvents: "auto" }}
                >
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping shrink-0" />
                    <span className="ts-12 font-medium whitespace-nowrap">
                        {call.type === "video" ? "视频通话" : "语音通话"}{" "}
                        <span>
                            {Math.floor(minimizedDuration / 60).toString().padStart(2, "0")}:
                            {(minimizedDuration % 60).toString().padStart(2, "0")}
                        </span>
                    </span>
                </div>
            )}
        </>
    );
}
