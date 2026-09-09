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
  dropTargetWorldId: string | null;
  onSelect: (worldId: string) => void;
  onOpenEditor: () => void;
  onOpenCreate: (parentId?: string) => void;
}) {
  const activeGroup = groups.find(g => g.id === currentWorldId);
  // 获取当前激活卷宗的根节点（最顶层父级）
  let rootNode = activeGroup;
  while (rootNode?.parentId) {
    const parent = groups.find(g => g.id === rootNode!.parentId);
    if (!parent) break;
    rootNode = parent;
  }

  // 钻取模式逻辑：
  // 1. 如果没有激活卷宗，或激活的是默认卷宗且无父子关系，显示所有顶级卷宗。
  // 2. 如果激活了某个卷宗及其子级，且当前处于“聚焦模式”：只显示该根卷宗及其直接子级。
  const isRootActive = activeGroup && !activeGroup.parentId && activeGroup.id !== DEFAULT_CHARACTER_WORLD_ID;
  const isSubActive = activeGroup && activeGroup.parentId;
  const isDrilling = isRootActive || isSubActive;

  // 初始显示的顶级卷宗
  const topGroups = groups.filter(g => !g.parentId);

  if (!isDrilling) {
    return (
      <div className="wt-strip" role="tablist" aria-label="世界卷宗">
        {topGroups.map(group => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={group.id === currentWorldId}
            data-world-tab-id={group.id}
            className={`wt-tab ${group.id === currentWorldId ? "wt-tab-active" : ""}`}
            onClick={() => onSelect(group.id)}
          >
            <span className="wt-tab-name">{group.name}</span>
            <span className="wt-tab-count">{memberCounts.get(group.id) ?? 0}</span>
          </button>
        ))}
        <button type="button" className="wt-tab wt-tab-new" onClick={() => onOpenCreate()} aria-label="新建世界">＋</button>
      </div>
    );
  }

  // 钻取模式：只显示当前根节点及其直接子级
  const currentRootId = rootNode!.id;
  const subGroups = groups.filter(g => g.parentId === currentRootId);

  return (
    <div className="wt-strip" role="tablist" aria-label="卷宗钻取">
      {/* 根节点：点击它可退出钻取模式 */}
      <button
        type="button"
        role="tab"
        aria-selected={currentWorldId === currentRootId}
        className={`wt-tab wt-tab-drill-root ${currentWorldId === currentRootId ? "wt-tab-active" : ""}`}
        onClick={() => {
          if (currentWorldId === currentRootId) {
            // 再次点击已激活的根节点 -> 退出钻取模式（这里通过逻辑判定，实际上是让它变回普通顶级显示）
            onSelect(DEFAULT_CHARACTER_WORLD_ID);
          } else {
            onSelect(currentRootId);
          }
        }}
      >
        <span className="wt-tab-drill-icon">📂</span>
        <span className="wt-tab-name">{rootNode!.name}</span>
        {currentWorldId === currentRootId && <span className="wt-tab-edit" onClick={(e) => { e.stopPropagation(); onOpenEditor(); }} aria-hidden>✎</span>}
      </button>

      <div className="wt-drill-separator">|</div>

      {subGroups.map(group => (
        <button
          key={group.id}
          type="button"
          role="tab"
          aria-selected={group.id === currentWorldId}
          data-world-tab-id={group.id}
          className={`wt-tab wt-tab-sub ${group.id === currentWorldId ? "wt-tab-active" : ""}`}
          onClick={() => (group.id === currentWorldId ? onOpenEditor() : onSelect(group.id))}
        >
          <span className="wt-tab-name">{group.name}</span>
          <span className="wt-tab-count">{memberCounts.get(group.id) ?? 0}</span>
          {group.id === currentWorldId && <span className="wt-tab-edit" aria-hidden>✎</span>}
        </button>
      ))}
      
      <button type="button" className="wt-tab wt-tab-new" onClick={() => onOpenCreate(currentRootId)} title="添加子卷宗">＋</button>
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
