import { loadCharacters } from "@/lib/character-storage";
import {
    createGroupSession,
    loadChatMessages,
    loadChatSessions,
    pushChatMessage,
    saveChatSessions,
    type ChatSession,
} from "@/lib/chat-storage";
import { loadChatOfflineTurns } from "@/lib/chat-offline-storage";
import { formatCharacterRelationsForPrompt } from "@/lib/character-world-storage";
import { loadUserIdentities } from "@/lib/settings-storage";
import type { UserIdentity } from "@/components/settings/user-identity";

export function getImportedUserProxyId(): string | undefined {
    const identities = loadUserIdentities();
    const imported = identities.find(i => i.importToArchives);
    return imported ? `userproxy_${imported.id}` : undefined;
}

export function getImportedUserIdentity(): UserIdentity | null {
    const identities = loadUserIdentities();
    return identities.find(i => i.importToArchives) || identities[0] || null;
}

export function listOfflineInviteCandidates(source: ChatSession) {
    const chars = loadCharacters().filter(c => !c.isUserProxy);
    if (source.isGroup && source.participantIds?.length) {
        const allow = new Set(source.participantIds);
        const inGroup = chars.filter(c => allow.has(c.id));
        return inGroup.length ? inGroup : chars;
    }
    if (!source.isGroup && source.contactId) {
        const current = chars.find(c => c.id === source.contactId);
        const rest = chars.filter(c => c.id !== source.contactId);
        return current ? [current, ...rest] : chars;
    }
    return chars;
}

export function buildOfflinePartyMemoryPrompt(session: ChatSession): string {
    const lines: string[] = [];
    const identity = getImportedUserIdentity();
    const proxyId = session.offlineUserProxyId || getImportedUserProxyId();
    if (identity) {
        lines.push(`用户本人是「${identity.name}」（导入 Archives 的身份，不是可被扮演的角色）。`);
        if (identity.bio) lines.push(`身份简介：${identity.bio}`);
        if (identity.customSettings) lines.push(`身份设定：${identity.customSettings}`);
    }
    if (proxyId) {
        const rel = formatCharacterRelationsForPrompt(proxyId);
        if (rel) lines.push(`与用户身份相关的卷宗关系：\n${rel}`);
    }
    const memberIds = (session.participantIds || []).filter(id => !id.startsWith("userproxy_"));
    const sourceId = session.offlineSourceSessionId;
    if (sourceId) {
        const online = loadChatMessages(sourceId, 12)
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => `${m.role === "user" ? "用户" : (m.senderName || "对方")}：${(m.content || "").slice(0, 80)}`)
            .filter(s => !s.endsWith("："));
        if (online.length) {
            lines.push("来源会话近期线上记录（只作记忆，不要原样复读）：\n" + online.join("\n"));
        }
        const turns = loadChatOfflineTurns(sourceId).slice(-6);
        if (turns.length) {
            lines.push("来源会话近期线下记录（只作记忆）：\n" + turns.map(t => {
                const u = t.userContent ? `用户：${t.userContent.slice(0, 80)}` : "";
                const a = t.assistantContent ? `对方：${String(t.assistantContent).slice(0, 80)}` : "";
                return [u, a].filter(Boolean).join("\n");
            }).join("\n"));
        }
    }
    const sessions = loadChatSessions();
    for (const id of memberIds.slice(0, 6)) {
        const dm = sessions.find(s => !s.isGroup && s.contactId === id);
        if (!dm) continue;
        const recent = loadChatMessages(dm.id, 6)
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => `${m.role === "user" ? "用户" : "对方"}：${(m.content || "").slice(0, 60)}`);
        if (recent.length) lines.push(`与该成员单聊摘录：\n${recent.join("\n")}`);
    }
    lines.push("生成时禁止用用户姓名作为角色发言；用户只通过「用户：」出场。被邀请角色按各自人设对话，并承接上述记忆。");
    return lines.join("\n\n");
}

export function createOfflinePartySession(source: ChatSession, selectedIds: string[]): ChatSession {
    const chars = loadCharacters();
    const ids = [...new Set(selectedIds)].filter(id => {
        const c = chars.find(x => x.id === id);
        return c && !c.isUserProxy;
    });
    if (ids.length === 0) throw new Error("请至少选择一个角色");
    const names = ids.map(id => chars.find(c => c.id === id)?.name || "角色");
    const title = `线下·${source.groupName || source.alias || chars.find(c => c.id === source.contactId)?.name || "聊天"}`;
    const party = createGroupSession(title, ids);
    const proxyId = getImportedUserProxyId();
    saveChatSessions(loadChatSessions().map(s =>
        s.id === party.id
            ? {
                ...s,
                offlineParty: true,
                offlineSourceSessionId: source.id,
                offlineUserProxyId: proxyId,
                groupName: title,
            }
            : s
    ));
    pushChatMessage({
        sessionId: party.id,
        role: "assistant",
        content: `你邀请${names.join("、")}加入这场线下`,
        mediaType: "group_admin_notice",
    });
    return loadChatSessions().find(s => s.id === party.id) ?? party;
}
