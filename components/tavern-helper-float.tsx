"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadBindingConfig,
  loadPresets,
  resolveBinding,
  savePresets,
} from "@/lib/settings-storage";
import { loadChatSessions } from "@/lib/chat-storage";
import type { PresetConfig, Prompt } from "@/lib/settings-types";

type Pos = { x: number; y: number };

type HelperBtn = {
  id: string;
  label: string;
  sub?: string;
  match: string[];
  exclusiveGroup?: string;
  exact?: boolean;
};

const SEXY: HelperBtn[] = [
  { id: "sexy-light", label: "轻度", sub: "瑟瑟描述", match: ["🥵瑟瑟描述"], exclusiveGroup: "sexy" },
  { id: "sexy-mid", label: "中度", sub: "够用了", match: ["🥵瑟瑟多样化"], exclusiveGroup: "sexy" },
  { id: "sexy-hot", label: "重度", sub: "记得关掉", match: ["🥵超级瑟瑟视角", "cot-🔞深度瑟瑟", "cot-🔞超级瑟瑟"], exclusiveGroup: "sexy" },
];

const ROB: HelperBtn[] = [
  { id: "rob-dialog", label: "对白增多", match: ["👻对话提升", "对话提升"] },
  { id: "rob-ok", label: "可抢话", match: ["😀可抢话"], exclusiveGroup: "rob" },
  { id: "rob-talk", label: "话痨抢话", match: ["😀话痨抢话"], exclusiveGroup: "rob" },
];

const ANTI_ROB: HelperBtn[] = [
  { id: "anti-light", label: "轻度", match: ["🤐防抢话"], exact: true, exclusiveGroup: "anti" },
  { id: "anti-hot", label: "重度", match: ["超级防抢话"], exclusiveGroup: "anti" },
];

const WORDS: HelperBtn[] = [
  { id: "w-low", label: "少字数", match: ["少字数"], exclusiveGroup: "words" },
  { id: "w-mid", label: "中字数", match: ["中字数"], exclusiveGroup: "words" },
  { id: "w-high", label: "多字数", match: ["多字数"], exclusiveGroup: "words" },
];

const POV: HelperBtn[] = [
  { id: "pov-1", label: "第一人称", sub: "我/我的", match: ["第一人称视角"], exclusiveGroup: "pov" },
  { id: "pov-2", label: "第二人称", sub: "你/你的", match: ["第二人称视角"], exclusiveGroup: "pov" },
  { id: "pov-3", label: "第三人称", sub: "他/她/它", match: ["第三人称视角"], exclusiveGroup: "pov" },
];

const POV_NOVEL: HelperBtn = { id: "pov-novel", label: "小说创作视角", match: ["小说创作视角"] };

const RETELL: HelperBtn[] = [
  { id: "retell-expand", label: "转述扩写", match: ["转述+扩写"], exclusiveGroup: "retell" },
  { id: "retell-on", label: "转述", match: ["⚙️转述"], exact: true, exclusiveGroup: "retell" },
  { id: "retell-off", label: "不转述", match: ["不转述"], exclusiveGroup: "retell" },
];

const FEATURES: HelperBtn[] = [
  { id: "f-omni", label: "防全知", match: ["防全知"] },
  { id: "f-wb", label: "读世界书", match: ["防不读世界书"] },
  { id: "f-var", label: "防变量出错", match: ["⚙️防变量出错"], exact: true },
  { id: "f-mei", label: "防媚user", match: ["超级防媚"] },
  { id: "f-think", label: "边写边思考", match: ["边写边思考"] },
  { id: "f-review", label: "剧情审视", match: ["剧情审视", "审视剧情"] },
  { id: "f-live", label: "活人感", match: ["活人感"] },
  { id: "f-fanfic", label: "同人增强", match: ["同人增强"] },
];

const PACE: HelperBtn[] = [
  { id: "p-super", label: "超级快进", match: ["超级快进"], exclusiveGroup: "pace" },
  { id: "p-fast", label: "快速", match: ["快速"], exact: true, exclusiveGroup: "pace" },
  { id: "p-norm", label: "正常", match: ["正常"], exact: true, exclusiveGroup: "pace" },
  { id: "p-slow", label: "慢速", match: ["慢速"], exclusiveGroup: "pace" },
];

const FAN: HelperBtn[] = [
  { id: "fan-act", label: "行动选项", match: ["行动选项"] },
  { id: "fan-inner", label: "npc有内心独白", match: ["内心独白"] },
  { id: "fan-mimi", label: "咪咪吐槽", match: ["咪咪吐槽"] },
  { id: "fan-time", label: "显示时间地点", match: ["显示时间地点"] },
  { id: "fan-plot", label: "剧情推动引擎", match: ["🍭剧情推动", "剧情推动"] },
  { id: "fan-sex", label: "性爱场景特写", match: ["瑟瑟细节展示"] },
  { id: "fan-para", label: "平行事件", match: ["平行事件"] },
];

const MODE: HelperBtn[] = [
  { id: "mode-sum", label: "大总结", match: ["大总结之术"] },
  { id: "mode-hit", label: "拷打AI", match: ["拷打ai", "拷打AI"] },
];

export function isTgbreakPreset(preset: PresetConfig | null | undefined): boolean {
  if (!preset) return false;
  const name = `${preset.name || ""} ${preset.description || ""}`.toLowerCase();
  if (name.includes("tgbreak") || name.includes("tgd") || name.includes("日月西破限")) return true;
  const names = (preset.prompts || []).map(p => p.name || "");
  return names.some(n => n.includes("😾😾别关")) && names.some(n => n.includes("瑟瑟"));
}

function boundPreset(): PresetConfig | null {
  const presets = loadPresets();
  if (!presets.length) return null;
  const sessions = loadChatSessions();
  const latest = [...sessions].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const slot = resolveBinding(loadBindingConfig(), latest?.contactId, "chat");
  return presets.find(p => p.id === slot.presetId) ?? null;
}

function promptMatches(p: Prompt, btn: HelperBtn) {
  const name = p.name || "";
  if (btn.exact) return btn.match.some(k => name === k || name.trim() === k);
  return btn.match.some(k => name.includes(k));
}

function isOn(preset: PresetConfig | null, btn: HelperBtn) {
  if (!preset) return false;
  return preset.prompts.some(p => promptMatches(p, btn) && p.enabled);
}

function setMatches(preset: PresetConfig, btn: HelperBtn, enabled: boolean): PresetConfig {
  const ids = new Set(preset.prompts.filter(p => promptMatches(p, btn)).map(p => p.identifier));
  if (!ids.size) return preset;
  return {
    ...preset,
    updatedAt: Date.now(),
    prompts: preset.prompts.map(p => (ids.has(p.identifier) ? { ...p, enabled } : p)),
    prompt_order: (preset.prompt_order || []).map(o => (ids.has(o.identifier) ? { ...o, enabled } : o)),
  };
}

export function TavernHelperFloat() {
  const [open, setOpen] = useState(false);
  const [spin, setSpin] = useState(false);
  const [pos, setPos] = useState<Pos>({ x: 18, y: 360 });
  const [preset, setPreset] = useState<PresetConfig | null>(null);
  const [toast, setToast] = useState("");
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  const refresh = useCallback(() => setPreset(boundPreset()), []);
  useEffect(() => {
    refresh();
    window.addEventListener("settings-presets-updated", refresh);
    window.addEventListener("settings-bindings-updated", refresh);
    return () => {
      window.removeEventListener("settings-presets-updated", refresh);
      window.removeEventListener("settings-bindings-updated", refresh);
    };
  }, [refresh]);

  const visible = isTgbreakPreset(preset);
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  const apply = (next: PresetConfig) => {
    const presets = loadPresets();
    const idx = presets.findIndex(p => p.id === next.id);
    if (idx < 0) return;
    const copy = [...presets];
    copy[idx] = next;
    savePresets(copy);
    setPreset(next);
  };

  const clickBtn = (btn: HelperBtn, group: HelperBtn[]) => {
    if (!preset) return;
    const turningOn = !isOn(preset, btn);
    let next = preset;
    if (btn.exclusiveGroup && turningOn) {
      for (const other of group) {
        if (other.exclusiveGroup === btn.exclusiveGroup) {
          next = setMatches(next, other, other.id === btn.id);
        }
      }
    } else {
      next = setMatches(next, btn, turningOn);
    }
    apply(next);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = Math.max(8, Math.min(window.innerWidth - 58, e.clientX - drag.current.dx));
    const y = Math.max(8, Math.min(window.innerHeight - 58, e.clientY - drag.current.dy));
    if (Math.abs(x - pos.x) + Math.abs(y - pos.y) > 4) drag.current.moved = true;
    setPos({ x, y });
  };
  const onPointerUp = () => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (!moved) {
      setSpin(true);
      window.setTimeout(() => setSpin(false), 600);
      setOpen(v => !v);
    }
  };

  if (!visible) return null;

  const panelLeft = Math.min(pos.x, Math.max(12, (typeof window !== "undefined" ? window.innerWidth : 400) - 308));
  const panelTop = Math.max(12, Math.min(pos.y - 24, (typeof window !== "undefined" ? window.innerHeight : 700) - 460));

  return (
    <>
      <style>{`
        .th-orb {
          position: fixed; z-index: 80; width: 54px; height: 54px; border-radius: 50%;
          border: 2px solid #9b7cff; padding: 0; cursor: pointer;
          background: radial-gradient(circle at 35% 28%, #5b3dff, #1a0d3a 68%);
          box-shadow: 0 0 0 4px rgba(123,90,255,.22), 0 0 22px rgba(140,90,255,.55), 0 10px 28px rgba(20,0,60,.5);
        }
        .th-star {
          display: block; color: #f3eaff; font-size: 22px; line-height: 1;
          transition: transform .55s ease;
        }
        .th-star.spin { transform: rotate(360deg); }
        .th-panel {
          position: fixed; z-index: 81; width: 292px; max-height: 74vh; overflow: auto;
          background: linear-gradient(180deg, #2b1760 0%, #160c34 100%);
          color: #efe8ff; border-radius: 18px; padding: 12px;
          border: 1px solid rgba(170,130,255,.32);
          box-shadow: 0 18px 40px rgba(10,0,30,.55);
        }
        .th-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .th-title { display:flex; align-items:center; gap:8px; font-weight:700; font-size:14px; }
        .th-dot { width:8px; height:8px; border-radius:50%; background:#c59bff; box-shadow:0 0 8px #c59bff; }
        .th-x { background:none; border:none; color:#cbbfff; font-size:18px; cursor:pointer; }
        .th-sec { font-size:12px; color:#c9b8ff; margin:10px 0 6px; }
        .th-row { display:flex; gap:6px; flex-wrap:wrap; }
        .th-btn {
          flex: 1 1 calc(33.33% - 6px); min-width: 72px; border:none; border-radius:12px;
          padding:8px 6px; background:#3a2a66; color:#d7ccff; cursor:pointer; text-align:center;
        }
        .th-btn.wide { flex: 1 1 calc(50% - 6px); }
        .th-btn.on { background: transparent; color: #ff7ad9; box-shadow: inset 0 0 0 1.5px #ff7ad9; }
        .th-btn .l { display:block; font-size:12px; font-weight:700; }
        .th-btn .s { display:block; font-size:10px; opacity:.8; margin-top:2px; }
        .th-foot { text-align:center; font-size:9px; letter-spacing:.12em; color:#8a78c8; margin-top:10px; }
        .th-toast {
          position: fixed; z-index: 82; left: 50%; transform: translateX(-50%);
          bottom: 28px; background: rgba(20,10,40,.92); color: #fff;
          padding: 8px 14px; border-radius: 999px; font-size: 12px;
        }
      `}</style>

      <button
        type="button"
        className="th-orb"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="TGbreak 助手"
      >
        <span className={`th-star ${spin ? "spin" : ""}`}>✦</span>
      </button>

      {open ? (
        <div className="th-panel" style={{ left: panelLeft, top: panelTop }}>
          <div className="th-head">
            <div className="th-title"><span className="th-dot" />TGbreak</div>
            <button type="button" className="th-x" onClick={() => setOpen(false)}>×</button>
          </div>

          <Section title="色色程度" btns={SEXY} preset={preset} onClick={clickBtn} />
          <Section title="可抢话设置" btns={ROB} preset={preset} onClick={clickBtn} />
          <Section title="不抢话设置" btns={ANTI_ROB} preset={preset} onClick={clickBtn} />
          <Section title="" btns={WORDS} preset={preset} onClick={clickBtn} />
          <Section title="人称设置" btns={POV} preset={preset} onClick={clickBtn} />
          <div className="th-row" style={{ marginTop: 6 }}>
            <button type="button" className={`th-btn wide ${isOn(preset, POV_NOVEL) ? "on" : ""}`} onClick={() => clickBtn(POV_NOVEL, [POV_NOVEL])}>
              <span className="l">{POV_NOVEL.label}</span>
            </button>
          </div>

          <Section title="转述与否" btns={RETELL} preset={preset} onClick={clickBtn} />
          <Section title="预设功能" btns={FEATURES} preset={preset} onClick={clickBtn} wide />
          <Section title="剧情推进速度" btns={PACE} preset={preset} onClick={clickBtn} />
          <Section title="粉丝定制功能" btns={FAN} preset={preset} onClick={clickBtn} wide />
          <Section title="切换模式" btns={MODE} preset={preset} onClick={clickBtn} wide />

          <div className="th-sec">预设检查更新</div>
          <div className="th-row">
            <button type="button" className="th-btn wide" onClick={() => showToast("本地缝合版已是当前版本")}>
              <span className="l">检查更新</span>
              <span className="s">点击查看最新动态</span>
            </button>
            <button type="button" className="th-btn wide" onClick={() => { if (preset) apply(preset); showToast("配置已保存"); }}>
              <span className="l">保存配置</span>
            </button>
          </div>
          <div className="th-foot">TAVERN HELPER · PANEL</div>
        </div>
      ) : null}
      {toast ? <div className="th-toast">{toast}</div> : null}
    </>
  );
}

function Section({
  title,
  btns,
  preset,
  onClick,
  wide,
}: {
  title: string;
  btns: HelperBtn[];
  preset: PresetConfig | null;
  onClick: (btn: HelperBtn, group: HelperBtn[]) => void;
  wide?: boolean;
}) {
  return (
    <>
      {title ? <div className="th-sec">{title}</div> : <div style={{ height: 8 }} />}
      <div className="th-row">
        {btns.map(btn => (
          <button
            key={btn.id}
            type="button"
            className={`th-btn ${wide ? "wide" : ""} ${isOn(preset, btn) ? "on" : ""}`}
            onClick={() => onClick(btn, btns)}
          >
            <span className="l">{btn.label}</span>
            {btn.sub ? <span className="s">{btn.sub}</span> : null}
          </button>
        ))}
      </div>
    </>
  );
}
