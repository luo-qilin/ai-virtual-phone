"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Image as ImageIcon, MessageSquare, Phone, Video } from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { ChatFallbackAvatar } from "./chat-fallback-avatar";
import { MomentPostCard } from "./moment-post-card";
import type { Character } from "@/lib/character-types";
import { getChatImageFromIndexedDB } from "@/lib/chat-asset-storage";
import { getAllPosts } from "@/lib/moments-storage";
import type { MomentPost } from "@/lib/moments-types";
import { resolveUserIdentity } from "@/lib/settings-storage";

export function formatCharacterRegion(character: Character): string {
    const explicit = character.region?.trim();
    if (explicit) return explicit;
    const zone = character.timeZone?.trim();
    if (!zone) return "未设置";
    const city = zone.split("/").pop() || zone;
    return city.replace(/_/g, " ");
}

type CharacterProfilePageProps = {
    character?: Character | null;
    variant?: "character" | "user";
    onClose: () => void;
    onSendMessage: () => void;
    onStartCall: (type: "voice" | "video") => void;
};

function collectMomentPhotoRefs(posts: MomentPost[]): string[] {
    const refs: string[] = [];
    for (const post of posts) {
        if (post.photoUrl) refs.push(post.photoUrl);
        if (refs.length >= 3) break;
    }
    return refs;
}

export function CharacterProfilePage({
    character,
    variant = "character",
    onClose,
    onSendMessage,
    onStartCall,
}: CharacterProfilePageProps) {
    const isUser = variant === "user" || !character;
    const identity = isUser ? resolveUserIdentity() : null;

    const displayName = isUser ? (identity?.name || "我") : (character?.name || "未命名");
    const displayAvatar = isUser ? (identity?.avatarUrl || null) : (character?.avatar || null);
    const displayWechatId = isUser ? "未设置" : (character?.wechatID || "未设置");
    const displayRegion = isUser ? "未设置" : formatCharacterRegion(character as Character);

    const [showMoments, setShowMoments] = useState(false);
    const [showCallPicker, setShowCallPicker] = useState(false);
    const [momentsTick, setMomentsTick] = useState(0);
    const [previewPhotos, setPreviewPhotos] = useState<string[]>([]);

    const posts = useMemo(() => {
        void momentsTick;
        return getAllPosts()
            .filter(post => (
                isUser
                    ? post.authorType === "user"
                    : post.authorType === "character" && post.authorId === character?.id
            ))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [character?.id, isUser, momentsTick]);

    const photoRefs = useMemo(() => collectMomentPhotoRefs(posts), [posts]);

    useEffect(() => {
        let cancelled = false;
        async function resolvePhotos() {
            const urls: string[] = [];
            for (const ref of photoRefs) {
                if (ref.startsWith("asset://")) {
                    const resolved = await getChatImageFromIndexedDB(ref.slice(8));
                    if (resolved) urls.push(resolved);
                } else if (ref.startsWith("data:") || ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("blob:")) {
                    urls.push(ref);
                }
                if (urls.length >= 3) break;
            }
            if (!cancelled) setPreviewPhotos(urls);
        }
        void resolvePhotos();
        return () => {
            cancelled = true;
        };
    }, [photoRefs]);

    if (showMoments) {
        return (
            <CharacterMomentsPage
                title={`${displayName}的朋友圈`}
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
                            {displayAvatar ? (
                                <img src={displayAvatar} alt="" />
                            ) : (
                                <ChatFallbackAvatar />
                            )}
                        </div>
                        <div className="character-profile-hero-text">
                            <div className="character-profile-name">{displayName}</div>
                            <div className="character-profile-meta">微信号：{displayWechatId}</div>
                            <div className="character-profile-meta">地区：{displayRegion}</div>
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
                                        <img key={`${index}-${url.slice(0, 24)}`} src={url} alt="" />
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
    title,
    posts,
    onBack,
    onUpdate,
}: {
    title: string;
    posts: MomentPost[];
    onBack: () => void;
    onUpdate: () => void;
}) {
    return (
        <PageShell title={title} onBack={onBack} className="character-moments-page">
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
