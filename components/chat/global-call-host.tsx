"use client";

import { useEffect, useState, useRef } from "react";
import { VoiceCallScreen } from "./voice-call-screen";
import { VideoCallScreen } from "./video-call-screen";
import { GLOBAL_CALL_START_EVENT, GLOBAL_CALL_END_EVENT, type GlobalCallStartDetail } from "@/lib/global-call-events";
import { CHAT_OPEN_SESSION_EVENT } from "@/lib/chat-notification-events";
import { CHAT_REQUEST_REPLY_EVENT, pushChatMessage } from "@/lib/chat-storage";
import { loadChatOfflineTurns } from "@/lib/chat-offline-storage";

type ActiveCallState = GlobalCallStartDetail & {
    minimized: boolean;
};

export function GlobalCallHost() {
    const [call, setCall] = useState<ActiveCallState | null>(null);
    const [minimizedDuration, setMinimizedDuration] = useState(0);

    // 拖拽状态
    const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
    const draggingRef = useRef(false);
    const dragMovedRef = useRef(false);
    const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

        if (!currentCall.session) return;
        window.dispatchEvent(new CustomEvent("chat-messages-updated", { detail: { sessionId: currentCall.session.id } }));
        if (currentCall.offlineMode) return;
        window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent(CHAT_REQUEST_REPLY_EVENT, {
                detail: { sessionId: currentCall.session.id, characterId: currentCall.character.id },
            }));
        }, 400);
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
                            if (call.initiator === "user" && !call.offlineMode) {
                                const actionText = `[我向${call.character.name}发起了语音通话]`;
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
                            if (call.initiator === "user" && !call.offlineMode) {
                                const actionText = `[我向${call.character.name}发起了视频通话]`;
                                pushChatMessage({ sessionId: call.session.id, role: "user", content: actionText });
                            }
                        }}
                    />
                )}
            </div>

            {/* 最小化圆形可拖拽悬浮球：永远渲染在系统最顶层 z-[99999] */}
            {call.minimized && (
                <div
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        draggingRef.current = true;
                        dragMovedRef.current = false;
                        const rect = e.currentTarget.getBoundingClientRect();
                        dragStartOffsetRef.current = {
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top,
                        };
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                        if (!draggingRef.current) return;
                        e.stopPropagation();
                        dragMovedRef.current = true;
                        const nextX = e.clientX - dragStartOffsetRef.current.x;
                        const nextY = e.clientY - dragStartOffsetRef.current.y;
                        const maxX = window.innerWidth - 64;
                        const maxY = window.innerHeight - 64;
                        setBallPos({
                            x: Math.max(8, Math.min(nextX, maxX)),
                            y: Math.max(8, Math.min(nextY, maxY)),
                        });
                    }}
                    onPointerUp={(e) => {
                        if (!draggingRef.current) return;
                        e.stopPropagation();
                        draggingRef.current = false;
                        if (!dragMovedRef.current) {
                            handleExpandCall();
                        }
                    }}
                    className="fixed z-[99999] w-16 h-16 rounded-full bg-black/85 text-white backdrop-blur-md border border-white/20 shadow-2xl cursor-grab active:cursor-grabbing select-none flex flex-col items-center justify-center gap-0.5 p-1 touch-none"
                    style={{
                        left: ballPos ? `${ballPos.x}px` : undefined,
                        top: ballPos ? `${ballPos.y}px` : "80px",
                        right: ballPos ? undefined : "16px",
                        visibility: "visible",
                        pointerEvents: "auto",
                    }}
                >
                    {call.type === "video" ? (
                        /* 视频通话模式：显示角色圆形头像 */
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/40 bg-gray-700 flex items-center justify-center">
                            {call.character.avatar ? (
                                <img src={call.character.avatar} alt={call.character.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="ts-12 font-bold text-white">{call.character.name?.[0] || "?"}</span>
                            )}
                        </div>
                    ) : (
                        /* 语音通话模式：显示绿色圆形电话图标 */
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </div>
                    )}

                    <span className="ts-10 font-mono font-medium tracking-tight text-emerald-400 whitespace-nowrap">
                        {Math.floor(minimizedDuration / 60).toString().padStart(2, "0")}:
                        {(minimizedDuration % 60).toString().padStart(2, "0")}
                    </span>
                </div>
            )}
        </>
    );
}
