"use client";

// 世界卷宗 tab 条 + 卷宗编辑 sheet + 新建卷宗 sheet
// 视觉隐喻：每个世界 = 一份牛皮纸案卷，激活的 tab 是「翻开的那份」，
// 与画布纸面连成一体；编辑模式下拍立得可以拖到 tab 上「归档」进别的世界。

import { useState } from "react";
import type { CharacterWorldGroup } from "@/lib/character-world-storage";
import { DEFAULT_CHARACTER_WORLD_ID } from "@/lib/character-world-storage";

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
  onOpenCreate: (parentId?: string) => void;
}) {
  // 顶层卷宗（无 parentId）
  const rootGroups = groups.filter(g => !g.parentId);
  // 当前激活节点及其祖先链（用于展开显示子卷宗）
  const activeGroup = groups.find(g => g.id === currentWorldId);
  const activeChain = new Set<string>();
  let cur = activeGroup;
  while (cur) {
    activeChain.add(cur.id);
    cur = cur.parentId ? groups.find(g => g.id === cur!.parentId) : undefined;
  }

  const renderGroup = (group: CharacterWorldGroup, depth = 0) => {
    const active = group.id === currentWorldId;
    const dropping = group.id === dropTargetWorldId;
    const children = groups.filter(g => g.parentId === group.id);
    const hasChildren = children.length > 0;
    const isExpanded = activeChain.has(group.id);

    return (
      <div key={group.id} className="wt-node-group">
        <button
          type="button"
          role="tab"
          aria-selected={active}
          data-world-tab-id={group.id}
          className={`wt-tab ${active ? "wt-tab-active" : ""} ${dropping ? "wt-tab-drop" : ""} ${depth > 0 ? "wt-tab-sub" : ""}`}
          onClick={() => (active ? onOpenEditor() : onSelect(group.id))}
          style={{ marginLeft: depth * 12 }}
          title={active ? "点按编辑这份卷宗" : `打开「${group.name}」`}
        >
          {depth > 0 && <span className="wt-tab-line">└</span>}
          <span className="wt-tab-name">{group.name}</span>
          <span className="wt-tab-count">{memberCounts.get(group.id) ?? 0}</span>
          {active && <span className="wt-tab-edit" aria-hidden>✎</span>}
        </button>
        {isExpanded && hasChildren && (
          <div className="wt-sub-nodes">
            {children.map(child => renderGroup(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wt-strip" role="tablist" aria-label="世界卷宗">
      {rootGroups.map(group => renderGroup(group))}
      <button type="button" className="wt-tab wt-tab-new" onClick={() => onOpenCreate()} aria-label="新建世界">
        ＋
      </button>
    </div>
  );
}

/** 卷宗编辑：改名 / 世界观描述 / 删除（角色并回默认世界） */
export function WorldCaseSheet({
  group,
  onRename,
  onUpdateDescription,
  onDelete,
  onAddSub,
  onClose,
}: {
  group: CharacterWorldGroup;
  onRename: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onDelete: () => void;
  onAddSub?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isDefault = group.id === DEFAULT_CHARACTER_WORLD_ID;

  const save = () => {
    if (name.trim() && name.trim() !== group.name) onRename(name.trim());
    if (description.trim() !== group.description) onUpdateDescription(description.trim());
    onClose();
  };

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
        <div className="wt-paper-actions">
          {!isDefault && (
            confirmDelete ? (
              <>
                <span className="wt-paper-confirm">确认删除？角色将并回父级或默认世界</span>
                <button type="button" className="wt-btn wt-btn-danger" onClick={onDelete}>删除</button>
                <button type="button" className="wt-btn" onClick={() => setConfirmDelete(false)}>取消</button>
              </>
            ) : (
              <button type="button" className="wt-btn wt-btn-danger" onClick={() => setConfirmDelete(true)}>删除卷宗</button>
            )
          )}
          <span className="wt-paper-spacer" />
          {onAddSub && (
            <button type="button" className="wt-btn" onClick={onAddSub} style={{ marginRight: 8 }}>＋子卷宗</button>
          )}
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
  parentName,
}: {
  onCreate: (name: string) => void;
  onClose: () => void;
  parentName?: string;
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
        <div className="wt-paper-kicker">NEW {parentName ? 'SUB-CASE' : 'CASE'}</div>
        <label className="wt-paper-label">
          {parentName ? `在「${parentName}」下添加子卷宗` : '新卷宗名称'}
        </label>
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
