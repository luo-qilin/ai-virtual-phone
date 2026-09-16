"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Image as ImageIcon, MessageSquare, Phone, Video } from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { ChatFallbackAvatar } from "./chat-fallback-avatar";
import { MomentPostCard } from "./moment-post-card";
import type { Character } from "@/lib/character-types";
import { getAllPosts } from "@/lib/moments-storage";
import type { MomentPost } from "@/lib/moments-types";

export function formatCharacterRegion(character: Character): string {
    const explicit = character.region?.trim();
    if (explicit) return explicit;
    const zone = character.timeZone?.trim();
    if (!zone) return "未设置";
    const city = zone.split("/").pop() || zone;
    return city.replace(/_/g, " ");
}

type CharacterProfilePageProps = {
    character: Character;
    onClose: () => void;
    onSendMessage: () => void;
    onStartCall: (type: "voice" | "video") => void;
};

export function CharacterProfilePage({ character, onClose, onSendMessage, onStartCall }: CharacterProfilePageProps) {
    const [showMoments, setShowMoments] = useState(false);
    const [showCallPicker, setShowCallPicker] = useState(false);
    const [momentsTick, setMomentsTick] = useState(0);

    const posts = useMemo(() => {
        void momentsTick;
        return getAllPosts()
            .filter(post => post.authorType === "character" && post.authorId === character.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [character.id, momentsTick]);

    const previewPhotos = useMemo(() => {
        const urls: string[] = [];
        for (const post of posts) {
            if (post.photoUrl) urls.push(post.photoUrl);
            if (urls.length >= 3) break;
        }
        return urls;
    }, [posts]);

    if (showMoments) {
        return (
            <CharacterMomentsPage
                character={character}
                posts={posts}
                onBack={() => setShowMoments(false)}
                onUpdate={() => setMomentsTick(n => n + 1)}
            />
        );
    }

    return (
        <>
            <PageShell title="详细资料" onBack={onClose} className="character-profile-page">
                <div className="character-profile-body">
                    <section className="character-profile-hero">
                        <div className="character-profile-avatar">
                            {character.avatar ? (
                                <img src={character.avatar} alt="" />
                            ) : (
                                <ChatFallbackAvatar />
                            )}
                        </div>
                        <div className="character-profile-hero-text">
                            <div className="character-profile-name">{character.name || "未命名"}</div>
                            <div className="character-profile-meta">微信号：{character.wechatID || "未设置"}</div>
                            <div className="character-profile-meta">地区：{formatCharacterRegion(character)}</div>
                        </div>
                    </section>

                    <section className="character-profile-card">
                        <button
                            type="button"
                            className="character-profile-row"
                            onClick={() => setShowMoments(true)}
                        >
                            <span className="character-profile-row-label">朋友圈</span>
                            <span className="character-profile-moments-preview">
                                {previewPhotos.length > 0 ? (
                                    previewPhotos.map((url, index) => (
                                        <img key={`${url}-${index}`} src={url} alt="" />
                                    ))
                                ) : posts.length > 0 ? (
                                    <span className="character-profile-moments-count">{posts.length}条动态</span>
                                ) : (
                                    <span className="character-profile-moments-empty">暂无</span>
                                )}
                                <ChevronRight size={16} />
                            </span>
                        </button>
                    </section>

                    <section className="character-profile-actions">
                        <button type="button" className="character-profile-action" onClick={onSendMessage}>
                            <MessageSquare size={18} strokeWidth={1.8} />
                            发消息
                        </button>
                        <button
                            type="button"
                            className="character-profile-action"
                            onClick={() => setShowCallPicker(true)}
                        >
                            <Phone size={18} strokeWidth={1.8} />
                            音视频通话
                        </button>
                    </section>
                </div>
            </PageShell>

            {showCallPicker && (
                <div className="modal-overlay character-profile-call-overlay" onClick={() => setShowCallPicker(false)}>
                    <div className="character-profile-call-sheet" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            className="character-profile-call-option"
                            onClick={() => {
                                setShowCallPicker(false);
                                onStartCall("video");
                            }}
                        >
                            <Video size={18} strokeWidth={1.8} />
                            视频通话
                        </button>
                        <button
                            type="button"
                            className="character-profile-call-option"
                            onClick={() => {
                                setShowCallPicker(false);
                                onStartCall("voice");
                            }}
                        >
                            <Phone size={18} strokeWidth={1.8} />
                            语音通话
                        </button>
                        <button
                            type="button"
                            className="character-profile-call-cancel"
                            onClick={() => setShowCallPicker(false)}
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

function CharacterMomentsPage({
    character,
    posts,
    onBack,
    onUpdate,
}: {
    character: Character;
    posts: MomentPost[];
    onBack: () => void;
    onUpdate: () => void;
}) {
    return (
        <PageShell title={`${character.name || "角色"}的朋友圈`} onBack={onBack} className="character-moments-page">
            <div className="character-moments-body">
                {posts.length === 0 ? (
                    <div className="character-moments-empty">
                        <ImageIcon size={28} strokeWidth={1.4} />
                        <span>还没有发布过朋友圈</span>
                    </div>
                ) : (
                    posts.map(post => (
                        <MomentPostCard key={post.id} post={post} onUpdate={onUpdate} />
                    ))
                )}
            </div>
        </PageShell>
    );
}
