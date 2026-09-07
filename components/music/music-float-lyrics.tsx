// components/music/music-float-lyrics.tsx — Desktop Floating Lyrics Pill (draggable, glass, transparent)
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMusicPlayerOptional } from "@/lib/music-context";

const DRAG_THRESHOLD = 5;

export default function MusicFloatLyrics({ hidden }: { hidden?: boolean }) {
    const player = useMusicPlayerOptional();
    const pillRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: 40, y: 110 });
    const dragRef = useRef<{
        pointerId: number | null;
        active: boolean;
        startX: number;
        startY: number;
        origX: number;
        origY: number;
        moved: boolean;
    }>({
        pointerId: null,
        active: false,
        startX: 0,
        startY: 0,
        origX: 0,
        origY: 0,
        moved: false,
    });

    const clampPos = useCallback((x: number, y: number) => {
        const el = pillRef.current;
        const parent = el?.closest("[data-ui='phone-screen']") as HTMLElement | null;
        if (!el || !parent) return { x, y };
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;
        const ew = el.offsetWidth;
        const eh = el.offsetHeight;
        return {
            x: Math.max(10, Math.min(x, pw - ew - 10)),
            y: Math.max(30, Math.min(y, ph - eh - 30)),
        };
    }, []);

    // Parse lyrics
    const parsedLyrics = useMemo(() => {
        const lrc = player?.currentTrack?.lyrics || "";
        if (!lrc) return [];
        const lines: { time: number; text: string }[] = [];
        for (const line of lrc.split("\n")) {
            const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
            if (match) {
                const mins = parseInt(match[1], 10);
                const secs = parseFloat(match[2]);
                const text = match[3].trim();
                if (text) lines.push({ time: mins * 60 + secs, text });
            }
        }
        lines.sort((a, b) => a.time - b.time);
        return lines;
    }, [player?.currentTrack?.lyrics]);

    const currentLyricText = useMemo(() => {
        if (!player || parsedLyrics.length === 0) {
            return player?.currentTrack ? `🎵 ${player.currentTrack.title}` : "";
        }
        const ct = player.currentTime;
        let line = "";
        for (let i = parsedLyrics.length - 1; i >= 0; i--) {
            if (ct >= parsedLyrics[i].time) {
                line = parsedLyrics[i].text;
                break;
            }
        }
        return line || `🎵 ${player.currentTrack?.title || ""}`;
    }, [player, parsedLyrics]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        pillRef.current?.setPointerCapture?.(e.pointerId);
        dragRef.current = {
            pointerId: e.pointerId,
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            origX: pos.x,
            origY: pos.y,
            moved: false,
        };
    }, [pos]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d.active || d.pointerId !== e.pointerId) return;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            d.moved = true;
            setPos(clampPos(d.origX + dx, d.origY + dy));
        }
    }, [clampPos]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        const d = dragRef.current;
        if (!d.active || d.pointerId !== e.pointerId) return;
        if (pillRef.current?.hasPointerCapture?.(e.pointerId)) {
            pillRef.current.releasePointerCapture(e.pointerId);
        }
        d.active = false;
        d.pointerId = null;
        if (!d.moved && player) {
            // 点击桌面歌词胶囊直接打开播放器全屏
            player.openFullPlayer();
        }
    }, [player]);

    if (!player || !player.currentTrack || hidden || player.floatDismissed) return null;

    return (
        <div
            ref={pillRef}
            className="music-float-lyrics-pill"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            title="拖动调节位置，点击进入播放器"
        >
            <span className="music-float-lyrics-text">{currentLyricText}</span>
        </div>
    );
}
