"use client";

// 世界卷宗 tab 条 + 卷宗编辑 sheet + 新建卷宗 sheet
// 视觉隐喻：每个世界 = 一份牛皮纸案卷，激活的 tab 是「翻开的那份」，
// 与画布纸面连成一体；编辑模式下拍立得可以拖到 tab 上「归档」进别的世界。

import { useState } from "react";
import type { CharacterWorldGroup } from "@/lib/character-world-storage";
import { DEFAULT_CHARACTER_WORLD_ID } from "@/lib/character-world-storage";
import { loadCharacters } from "@/lib/character-storage";

export function WorldTabStrip({
  groups,
  currentWorldId,
  memberCounts,
  dropTargetWorldId,
  onSelect,
  onOpenEditor,
  onOpenCreate,
}: {
  groups: CharacterWorldGroup[];
  currentWorldId: string;
  memberCounts: Map<string, number>;
  /** 拖拽拍立得悬停中的 tab（高亮为可归档状态） */
  dropTargetWorldId: string | null;
  onSelect: (worldId: string) => void;
  /** 再次点按当前激活的 tab → 打开卷宗编辑 */
  onOpenEditor: () => void;
  onOpenCreate: () => void;
}) {
  return (
    <div className="wt-strip" role="tablist" aria-label="世界卷宗">
      {groups.map(group => {
        const active = group.id === currentWorldId;
        const dropping = group.id === dropTargetWorldId;
        return (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-world-tab-id={group.id}
            className={`wt-tab ${active ? "wt-tab-active" : ""} ${dropping ? "wt-tab-drop" : ""}`}
            onClick={() => (active ? onOpenEditor() : onSelect(group.id))}
            title={active ? "点按编辑这份卷宗" : `打开「${group.name}」`}
          >
            <span className="wt-tab-name">{group.name}</span>
            <span className="wt-tab-count">{memberCounts.get(group.id) ?? 0}</span>
            {active && <span className="wt-tab-edit" aria-hidden>✎</span>}
          </button>
        );
      })}
      <button type="button" className="wt-tab wt-tab-new" onClick={onOpenCreate} aria-label="新建世界">
        ＋
      </button>
    </div>
  );
}

/** 卷宗编辑：改名 / 世界观描述 / 删除（角色并回默认世界） */
import { createCharacterWorldSubGroup, deleteCharacterWorldSubGroup, updateCharacterWorldSubGroup, CharacterWorldSubGroup } from "@/lib/character-world-storage";
import { Plus, Trash, MessageSquare } from "lucide-react";

export function WorldCaseSheet({
  group,
  onRename,
  onUpdateDescription,
  onDelete,
  onClose,
  onOpenSubChat,
}: {
  group: CharacterWorldGroup;
  onRename: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenSubChat?: (sub: CharacterWorldSubGroup) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // 子卷宗管理状态
  const [subWorlds, setSubWorlds] = useState<CharacterWorldSubGroup[]>(() => group.subGroups || []);
  const [newSubName, setNewSubName] = useState("");
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subPromptDraft, setSubPromptDraft] = useState("");
  const [subMembersDraft, setSubMembersDraft] = useState<string[]>([]);

  const isDefault = group.id === DEFAULT_CHARACTER_WORLD_ID;

  const save = () => {
    if (name.trim() && name.trim() !== group.name) onRename(name.trim());
    if (description.trim() !== group.description) onUpdateDescription(description.trim());
    onClose();
  };

  const handleAddSub = () => {
    const title = newSubName.trim();
    if (!title) return;
    const newSub = createCharacterWorldSubGroup(group.id, title);
    setSubWorlds([...subWorlds, newSub]);
    setNewSubName("");
  };

  const handleDeleteSub = (subId: string) => {
    if (!window.confirm("确定要删除这个子卷宗吗？")) return;
    deleteCharacterWorldSubGroup(group.id, subId);
    setSubWorlds(subWorlds.filter(s => s.id !== subId));
  };

  const handleOpenEditSub = (sub: CharacterWorldSubGroup) => {
    setEditingSubId(sub.id);
    setSubPromptDraft(sub.personaPrompt);
    setSubMembersDraft(sub.memberIds || []);
  };

  const handleSaveSubEdit = () => {
    if (!editingSubId) return;
    updateCharacterWorldSubGroup(group.id, editingSubId, {
        personaPrompt: subPromptDraft,
        memberIds: subMembersDraft,
    });
    setSubWorlds(subWorlds.map(s => s.id === editingSubId ? { ...s, personaPrompt: subPromptDraft, memberIds: subMembersDraft } : s));
    setEditingSubId(null);
  };

  const toggleMemberSelection = (charId: string) => {
    setSubMembersDraft(prev => {
        const next = [...prev];
        const idx = next.indexOf(charId);
        if (idx >= 0) next.splice(idx, 1); else next.push(charId);
        return next;
    });
  };

  const allCharacters = loadCharacters().filter(c => group.memberIds.includes(c.id));

  return (
    <div className="wt-modal" onClick={save}>
      <div className="wt-paper" onClick={e => e.stopPropagation()}>
        <div className="wt-paper-tape" aria-hidden />
        <div className="wt-paper-kicker">CASE FILE</div>
        <label className="wt-paper-label">卷宗名称</label>
        <input
          className="wt-paper-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="世界名称"
          disabled={isDefault}
        />
        {isDefault && <p className="wt-paper-hint">默认世界不可改名或删除，删除其他世界时角色会回到这里。</p>}
        <label className="wt-paper-label">世界观描述（会注入该世界所有角色的上下文）</label>
        <textarea
          className="wt-paper-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="写下这个世界的背景、时代、阵营边界、共同常识或角色互动前提…"
        />
        {/* 子卷宗管理区 */}
        <div className="border-t border-dashed border-[#d4c9a8] pt-4 mt-4">
            <h4 className="text-xs font-bold text-[#4a3f2f] uppercase tracking-wider mb-2">子卷宗 (Sub-Archives)</h4>
            
            {/* 新建子卷宗 */}
            <div className="flex gap-2 mb-3">
                <input 
                    type="text" 
                    placeholder="新子卷宗名称..." 
                    value={newSubName}
                    onChange={e => setNewSubName(e.target.value)}
                    className="wt-paper-input flex-1 m-0 h-8 text-xs py-1"
                />
                <button 
                    type="button" 
                    onClick={handleAddSub}
                    className="bg-[#8c7a5a] text-white text-xs px-3 rounded hover:bg-[#76674e] transition-colors flex items-center gap-1 h-8"
                >
                    <Plus size={12} /> 添加
                </button>
            </div>

            {/* 子卷宗列表 */}
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto scrollbar-none">
                {subWorlds.map(sub => (
                    <div key={sub.id} className="p-3 bg-white/40 border border-[#d4c9a8] rounded flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-[#4a3f2f]">{sub.name}</span>
                            <div className="flex gap-1.5">
                                {/* 沙盒群聊入口 */}
                                <button 
                                    type="button"
                                    onClick={() => onOpenSubChat?.(sub)}
                                    className="p-1 rounded bg-[#6c5dd3] text-white hover:bg-[#5649b8] transition-all flex items-center gap-1 text-[10px] px-2 font-semibold"
                                    title="进入子卷宗沙盒群聊"
                                >
                                    <MessageSquare size={10} /> 聊天
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleOpenEditSub(sub)}
                                    className="p-1 rounded bg-[#8c7a5a]/20 text-[#6f5e43] hover:bg-[#8c7a5a]/30 text-[10px] px-2"
                                >
                                    配置
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleDeleteSub(sub.id)}
                                    className="p-1 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20"
                                >
                                    <Trash size={11} />
                                </button>
                            </div>
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                            {sub.personaPrompt ? `提示词: ${sub.personaPrompt.slice(0, 40)}...` : "(未设置提示词)"}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            角色: {sub.memberIds?.length > 0 
                                ? allCharacters.filter(c => sub.memberIds.includes(c.id)).map(c => c.name).join("、") 
                                : "(未绑定角色)"}
                        </div>
                    </div>
                ))}
                {subWorlds.length === 0 && (
                    <p className="text-[10px] text-center text-gray-400 py-3 italic">暂无子卷宗</p>
                )}
            </div>
        </div>

        {/* 子卷宗配置侧滑/弹窗 */}
        {editingSubId && (() => {
            const sub = subWorlds.find(s => s.id === editingSubId)!;
            return (
                <div className="wt-modal" style={{ zIndex: 110000 }}>
                    <div className="wt-paper max-w-[340px]" onClick={e => e.stopPropagation()}>
                        <div className="wt-paper-kicker">SUB FILE: {sub.name}</div>
                        
                        <label className="wt-paper-label">子卷宗专属提示词 (System Prompt)</label>
                        <textarea 
                            value={subPromptDraft}
                            onChange={e => setSubPromptDraft(e.target.value)}
                            placeholder="设定该子卷宗独有的背景暗示、剧情冲突、模型扮演倾向限制等..."
                            className="wt-paper-textarea h-24"
                        />

                        <label className="wt-paper-label">选择参与该子卷宗的角色</label>
                        <div className="grid grid-cols-2 gap-1.5 p-2 bg-white/30 border border-[#d4c9a8] rounded max-h-[140px] overflow-y-auto">
                            {allCharacters.map(char => {
                                const isSelected = subMembersDraft.includes(char.id);
                                return (
                                    <div 
                                        key={char.id}
                                        onClick={() => toggleMemberSelection(char.id)}
                                        className={`flex items-center gap-1.5 p-1.5 rounded border cursor-pointer transition-all ${
                                            isSelected 
                                                ? "bg-[#8c7a5a]/20 border-[#8c7a5a] text-[#4a3f2f] font-bold" 
                                                : "bg-[#f5f0e6]/40 border-transparent text-gray-500"
                                        }`}
                                    >
                                        <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 border border-[#d4c9a8]">
                                            {char.avatar ? <img src={char.avatar} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gray-300 flex items-center justify-center text-[8px]">{char.name.slice(0, 1)}</div>}
                                        </div>
                                        <span className="text-[10px] truncate">{char.name}</span>
                                    </div>
                                );
                            })}
                            {allCharacters.length === 0 && (
                                <p className="text-[9px] text-gray-400 col-span-2 text-center py-2">主卷宗中还没有角色，无法绑定</p>
                            )}
                        </div>

                        <div className="wt-paper-actions mt-4">
                            <button type="button" className="wt-btn" onClick={() => setEditingSubId(null)}>取消</button>
                            <span className="wt-paper-spacer" />
                            <button type="button" className="wt-btn wt-btn-primary" onClick={handleSaveSubEdit}>保存配置</button>
                        </div>
                    </div>
                </div>
            );
        })()}

        <div className="wt-paper-actions">
          {!isDefault && (
            confirmDelete ? (
              <>
                <span className="wt-paper-confirm">确认删除？角色将并回默认世界</span>
                <button type="button" className="wt-btn wt-btn-danger" onClick={onDelete}>删除</button>
                <button type="button" className="wt-btn" onClick={() => setConfirmDelete(false)}>取消</button>
              </>
            ) : (
              <button type="button" className="wt-btn wt-btn-danger" onClick={() => setConfirmDelete(true)}>删除卷宗</button>
            )
          )}
          <span className="wt-paper-spacer" />
          <button type="button" className="wt-btn wt-btn-primary" onClick={save}>完成</button>
        </div>
      </div>
    </div>
  );
}

/** 新建卷宗 */
export function NewWorldSheet({
  onCreate,
  onClose,
}: {
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
  };
  return (
    <div className="wt-modal" onClick={onClose}>
      <div className="wt-paper" onClick={e => e.stopPropagation()}>
        <div className="wt-paper-tape" aria-hidden />
        <div className="wt-paper-kicker">NEW CASE</div>
        <label className="wt-paper-label">新卷宗名称</label>
        <input
          className="wt-paper-input"
          value={name}
          autoFocus
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="例如：现代都市 / 仙侠界"
        />
        <div className="wt-paper-actions">
          <button type="button" className="wt-btn" onClick={onClose}>取消</button>
          <span className="wt-paper-spacer" />
          <button type="button" className="wt-btn wt-btn-primary" disabled={!name.trim()} onClick={submit}>建立</button>
        </div>
      </div>
    </div>
  );
}
